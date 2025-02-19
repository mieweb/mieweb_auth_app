Package["core-runtime"].queue("ddp-server",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var Retry = Package.retry.Retry;
var MongoID = Package['mongo-id'].MongoID;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var ECMAScript = Package.ecmascript.ECMAScript;
var DDPCommon = Package['ddp-common'].DDPCommon;
var DDP = Package['ddp-client'].DDP;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var RoutePolicy = Package.routepolicy.RoutePolicy;
var Hook = Package['callback-hook'].Hook;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var StreamServer, DDPServer, id, Server;

var require = meteorInstall({"node_modules":{"meteor":{"ddp-server":{"stream_server.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/stream_server.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let once;
    module.link("lodash.once", {
      default(v) {
        once = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    // By default, we use the permessage-deflate extension with default
    // configuration. If $SERVER_WEBSOCKET_COMPRESSION is set, then it must be valid
    // JSON. If it represents a falsey value, then we do not use permessage-deflate
    // at all; otherwise, the JSON value is used as an argument to deflate's
    // configure method; see
    // https://github.com/faye/permessage-deflate-node/blob/master/README.md
    //
    // (We do this in an _.once instead of at startup, because we don't want to
    // crash the tool during isopacket load if your JSON doesn't parse. This is only
    // a problem because the tool has to load the DDP server code just in order to
    // be a DDP client; see https://github.com/meteor/meteor/issues/3452 .)
    var websocketExtensions = once(function () {
      var extensions = [];
      var websocketCompressionConfig = process.env.SERVER_WEBSOCKET_COMPRESSION ? JSON.parse(process.env.SERVER_WEBSOCKET_COMPRESSION) : {};
      if (websocketCompressionConfig) {
        extensions.push(Npm.require('permessage-deflate').configure(websocketCompressionConfig));
      }
      return extensions;
    });
    var pathPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || "";
    StreamServer = function () {
      var self = this;
      self.registration_callbacks = [];
      self.open_sockets = [];

      // Because we are installing directly onto WebApp.httpServer instead of using
      // WebApp.app, we have to process the path prefix ourselves.
      self.prefix = pathPrefix + '/sockjs';
      RoutePolicy.declare(self.prefix + '/', 'network');

      // set up sockjs
      var sockjs = Npm.require('sockjs');
      var serverOptions = {
        prefix: self.prefix,
        log: function () {},
        // this is the default, but we code it explicitly because we depend
        // on it in stream_client:HEARTBEAT_TIMEOUT
        heartbeat_delay: 45000,
        // The default disconnect_delay is 5 seconds, but if the server ends up CPU
        // bound for that much time, SockJS might not notice that the user has
        // reconnected because the timer (of disconnect_delay ms) can fire before
        // SockJS processes the new connection. Eventually we'll fix this by not
        // combining CPU-heavy processing with SockJS termination (eg a proxy which
        // converts to Unix sockets) but for now, raise the delay.
        disconnect_delay: 60 * 1000,
        // Allow disabling of CORS requests to address
        // https://github.com/meteor/meteor/issues/8317.
        disable_cors: !!process.env.DISABLE_SOCKJS_CORS,
        // Set the USE_JSESSIONID environment variable to enable setting the
        // JSESSIONID cookie. This is useful for setting up proxies with
        // session affinity.
        jsessionid: !!process.env.USE_JSESSIONID
      };

      // If you know your server environment (eg, proxies) will prevent websockets
      // from ever working, set $DISABLE_WEBSOCKETS and SockJS clients (ie,
      // browsers) will not waste time attempting to use them.
      // (Your server will still have a /websocket endpoint.)
      if (process.env.DISABLE_WEBSOCKETS) {
        serverOptions.websocket = false;
      } else {
        serverOptions.faye_server_options = {
          extensions: websocketExtensions()
        };
      }
      self.server = sockjs.createServer(serverOptions);

      // Install the sockjs handlers, but we want to keep around our own particular
      // request handler that adjusts idle timeouts while we have an outstanding
      // request.  This compensates for the fact that sockjs removes all listeners
      // for "request" to add its own.
      WebApp.httpServer.removeListener('request', WebApp._timeoutAdjustmentRequestCallback);
      self.server.installHandlers(WebApp.httpServer);
      WebApp.httpServer.addListener('request', WebApp._timeoutAdjustmentRequestCallback);

      // Support the /websocket endpoint
      self._redirectWebsocketEndpoint();
      self.server.on('connection', function (socket) {
        // sockjs sometimes passes us null instead of a socket object
        // so we need to guard against that. see:
        // https://github.com/sockjs/sockjs-node/issues/121
        // https://github.com/meteor/meteor/issues/10468
        if (!socket) return;

        // We want to make sure that if a client connects to us and does the initial
        // Websocket handshake but never gets to the DDP handshake, that we
        // eventually kill the socket.  Once the DDP handshake happens, DDP
        // heartbeating will work. And before the Websocket handshake, the timeouts
        // we set at the server level in webapp_server.js will work. But
        // faye-websocket calls setTimeout(0) on any socket it takes over, so there
        // is an "in between" state where this doesn't happen.  We work around this
        // by explicitly setting the socket timeout to a relatively large time here,
        // and setting it back to zero when we set up the heartbeat in
        // livedata_server.js.
        socket.setWebsocketTimeout = function (timeout) {
          if ((socket.protocol === 'websocket' || socket.protocol === 'websocket-raw') && socket._session.recv) {
            socket._session.recv.connection.setTimeout(timeout);
          }
        };
        socket.setWebsocketTimeout(45 * 1000);
        socket.send = function (data) {
          socket.write(data);
        };
        socket.on('close', function () {
          self.open_sockets = self.open_sockets.filter(function (value) {
            return value !== socket;
          });
        });
        self.open_sockets.push(socket);

        // only to send a message after connection on tests, useful for
        // socket-stream-client/server-tests.js
        if (process.env.TEST_METADATA && process.env.TEST_METADATA !== "{}") {
          socket.send(JSON.stringify({
            testMessageOnConnect: true
          }));
        }

        // call all our callbacks when we get a new socket. they will do the
        // work of setting up handlers and such for specific messages.
        self.registration_callbacks.forEach(function (callback) {
          callback(socket);
        });
      });
    };
    Object.assign(StreamServer.prototype, {
      // call my callback when a new socket connects.
      // also call it for all current connections.
      register: function (callback) {
        var self = this;
        self.registration_callbacks.push(callback);
        self.all_sockets().forEach(function (socket) {
          callback(socket);
        });
      },
      // get a list of all sockets
      all_sockets: function () {
        var self = this;
        return Object.values(self.open_sockets);
      },
      // Redirect /websocket to /sockjs/websocket in order to not expose
      // sockjs to clients that want to use raw websockets
      _redirectWebsocketEndpoint: function () {
        var self = this;
        // Unfortunately we can't use a connect middleware here since
        // sockjs installs itself prior to all existing listeners
        // (meaning prior to any connect middlewares) so we need to take
        // an approach similar to overshadowListeners in
        // https://github.com/sockjs/sockjs-node/blob/cf820c55af6a9953e16558555a31decea554f70e/src/utils.coffee
        ['request', 'upgrade'].forEach(event => {
          var httpServer = WebApp.httpServer;
          var oldHttpServerListeners = httpServer.listeners(event).slice(0);
          httpServer.removeAllListeners(event);

          // request and upgrade have different arguments passed but
          // we only care about the first one which is always request
          var newListener = function (request /*, moreArguments */) {
            // Store arguments for use within the closure below
            var args = arguments;

            // TODO replace with url package
            var url = Npm.require('url');

            // Rewrite /websocket and /websocket/ urls to /sockjs/websocket while
            // preserving query string.
            var parsedUrl = url.parse(request.url);
            if (parsedUrl.pathname === pathPrefix + '/websocket' || parsedUrl.pathname === pathPrefix + '/websocket/') {
              parsedUrl.pathname = self.prefix + '/websocket';
              request.url = url.format(parsedUrl);
            }
            oldHttpServerListeners.forEach(function (oldListener) {
              oldListener.apply(httpServer, args);
            });
          };
          httpServer.addListener(event, newListener);
        });
      }
    });
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livedata_server.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/livedata_server.js                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectSpread;
    module.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 0);
    let isEmpty;
    module.link("lodash.isempty", {
      default(v) {
        isEmpty = v;
      }
    }, 0);
    let isString;
    module.link("lodash.isstring", {
      default(v) {
        isString = v;
      }
    }, 1);
    let isObject;
    module.link("lodash.isobject", {
      default(v) {
        isObject = v;
      }
    }, 2);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    DDPServer = {};

    // Publication strategies define how we handle data from published cursors at the collection level
    // This allows someone to:
    // - Choose a trade-off between client-server bandwidth and server memory usage
    // - Implement special (non-mongo) collections like volatile message queues
    const publicationStrategies = {
      // SERVER_MERGE is the default strategy.
      // When using this strategy, the server maintains a copy of all data a connection is subscribed to.
      // This allows us to only send deltas over multiple publications.
      SERVER_MERGE: {
        useDummyDocumentView: false,
        useCollectionView: true,
        doAccountingForCollection: true
      },
      // The NO_MERGE_NO_HISTORY strategy results in the server sending all publication data
      // directly to the client. It does not remember what it has previously sent
      // to it will not trigger removed messages when a subscription is stopped.
      // This should only be chosen for special use cases like send-and-forget queues.
      NO_MERGE_NO_HISTORY: {
        useDummyDocumentView: false,
        useCollectionView: false,
        doAccountingForCollection: false
      },
      // NO_MERGE is similar to NO_MERGE_NO_HISTORY but the server will remember the IDs it has
      // sent to the client so it can remove them when a subscription is stopped.
      // This strategy can be used when a collection is only used in a single publication.
      NO_MERGE: {
        useDummyDocumentView: false,
        useCollectionView: false,
        doAccountingForCollection: true
      },
      // NO_MERGE_MULTI is similar to `NO_MERGE`, but it does track whether a document is
      // used by multiple publications. This has some memory overhead, but it still does not do
      // diffing so it's faster and slimmer than SERVER_MERGE.
      NO_MERGE_MULTI: {
        useDummyDocumentView: true,
        useCollectionView: true,
        doAccountingForCollection: true
      }
    };
    DDPServer.publicationStrategies = publicationStrategies;

    // This file contains classes:
    // * Session - The server's connection to a single DDP client
    // * Subscription - A single subscription for a single client
    // * Server - An entire server that may talk to > 1 client. A DDP endpoint.
    //
    // Session and Subscription are file scope. For now, until we freeze
    // the interface, Server is package scope (in the future it should be
    // exported).
    var DummyDocumentView = function () {
      var self = this;
      self.existsIn = new Set(); // set of subscriptionHandle
      self.dataByKey = new Map(); // key-> [ {subscriptionHandle, value} by precedence]
    };
    Object.assign(DummyDocumentView.prototype, {
      getFields: function () {
        return {};
      },
      clearField: function (subscriptionHandle, key, changeCollector) {
        changeCollector[key] = undefined;
      },
      changeField: function (subscriptionHandle, key, value, changeCollector, isAdd) {
        changeCollector[key] = value;
      }
    });

    // Represents a single document in a SessionCollectionView
    var SessionDocumentView = function () {
      var self = this;
      self.existsIn = new Set(); // set of subscriptionHandle
      self.dataByKey = new Map(); // key-> [ {subscriptionHandle, value} by precedence]
    };
    DDPServer._SessionDocumentView = SessionDocumentView;
    DDPServer._getCurrentFence = function () {
      let currentInvocation = this._CurrentWriteFence.get();
      if (currentInvocation) {
        return currentInvocation;
      }
      currentInvocation = DDP._CurrentMethodInvocation.get();
      return currentInvocation ? currentInvocation.fence : undefined;
    };
    Object.assign(SessionDocumentView.prototype, {
      getFields: function () {
        var self = this;
        var ret = {};
        self.dataByKey.forEach(function (precedenceList, key) {
          ret[key] = precedenceList[0].value;
        });
        return ret;
      },
      clearField: function (subscriptionHandle, key, changeCollector) {
        var self = this;
        // Publish API ignores _id if present in fields
        if (key === "_id") return;
        var precedenceList = self.dataByKey.get(key);

        // It's okay to clear fields that didn't exist. No need to throw
        // an error.
        if (!precedenceList) return;
        var removedValue = undefined;
        for (var i = 0; i < precedenceList.length; i++) {
          var precedence = precedenceList[i];
          if (precedence.subscriptionHandle === subscriptionHandle) {
            // The view's value can only change if this subscription is the one that
            // used to have precedence.
            if (i === 0) removedValue = precedence.value;
            precedenceList.splice(i, 1);
            break;
          }
        }
        if (precedenceList.length === 0) {
          self.dataByKey.delete(key);
          changeCollector[key] = undefined;
        } else if (removedValue !== undefined && !EJSON.equals(removedValue, precedenceList[0].value)) {
          changeCollector[key] = precedenceList[0].value;
        }
      },
      changeField: function (subscriptionHandle, key, value, changeCollector, isAdd) {
        var self = this;
        // Publish API ignores _id if present in fields
        if (key === "_id") return;

        // Don't share state with the data passed in by the user.
        value = EJSON.clone(value);
        if (!self.dataByKey.has(key)) {
          self.dataByKey.set(key, [{
            subscriptionHandle: subscriptionHandle,
            value: value
          }]);
          changeCollector[key] = value;
          return;
        }
        var precedenceList = self.dataByKey.get(key);
        var elt;
        if (!isAdd) {
          elt = precedenceList.find(function (precedence) {
            return precedence.subscriptionHandle === subscriptionHandle;
          });
        }
        if (elt) {
          if (elt === precedenceList[0] && !EJSON.equals(value, elt.value)) {
            // this subscription is changing the value of this field.
            changeCollector[key] = value;
          }
          elt.value = value;
        } else {
          // this subscription is newly caring about this field
          precedenceList.push({
            subscriptionHandle: subscriptionHandle,
            value: value
          });
        }
      }
    });

    /**
     * Represents a client's view of a single collection
     * @param {String} collectionName Name of the collection it represents
     * @param {Object.<String, Function>} sessionCallbacks The callbacks for added, changed, removed
     * @class SessionCollectionView
     */
    var SessionCollectionView = function (collectionName, sessionCallbacks) {
      var self = this;
      self.collectionName = collectionName;
      self.documents = new Map();
      self.callbacks = sessionCallbacks;
    };
    DDPServer._SessionCollectionView = SessionCollectionView;
    Object.assign(SessionCollectionView.prototype, {
      isEmpty: function () {
        var self = this;
        return self.documents.size === 0;
      },
      diff: function (previous) {
        var self = this;
        DiffSequence.diffMaps(previous.documents, self.documents, {
          both: self.diffDocument.bind(self),
          rightOnly: function (id, nowDV) {
            self.callbacks.added(self.collectionName, id, nowDV.getFields());
          },
          leftOnly: function (id, prevDV) {
            self.callbacks.removed(self.collectionName, id);
          }
        });
      },
      diffDocument: function (id, prevDV, nowDV) {
        var self = this;
        var fields = {};
        DiffSequence.diffObjects(prevDV.getFields(), nowDV.getFields(), {
          both: function (key, prev, now) {
            if (!EJSON.equals(prev, now)) fields[key] = now;
          },
          rightOnly: function (key, now) {
            fields[key] = now;
          },
          leftOnly: function (key, prev) {
            fields[key] = undefined;
          }
        });
        self.callbacks.changed(self.collectionName, id, fields);
      },
      added: function (subscriptionHandle, id, fields) {
        var self = this;
        var docView = self.documents.get(id);
        var added = false;
        if (!docView) {
          added = true;
          if (Meteor.server.getPublicationStrategy(this.collectionName).useDummyDocumentView) {
            docView = new DummyDocumentView();
          } else {
            docView = new SessionDocumentView();
          }
          self.documents.set(id, docView);
        }
        docView.existsIn.add(subscriptionHandle);
        var changeCollector = {};
        Object.entries(fields).forEach(function (_ref) {
          let [key, value] = _ref;
          docView.changeField(subscriptionHandle, key, value, changeCollector, true);
        });
        if (added) self.callbacks.added(self.collectionName, id, changeCollector);else self.callbacks.changed(self.collectionName, id, changeCollector);
      },
      changed: function (subscriptionHandle, id, changed) {
        var self = this;
        var changedResult = {};
        var docView = self.documents.get(id);
        if (!docView) throw new Error("Could not find element with id " + id + " to change");
        Object.entries(changed).forEach(function (_ref2) {
          let [key, value] = _ref2;
          if (value === undefined) docView.clearField(subscriptionHandle, key, changedResult);else docView.changeField(subscriptionHandle, key, value, changedResult);
        });
        self.callbacks.changed(self.collectionName, id, changedResult);
      },
      removed: function (subscriptionHandle, id) {
        var self = this;
        var docView = self.documents.get(id);
        if (!docView) {
          var err = new Error("Removed nonexistent document " + id);
          throw err;
        }
        docView.existsIn.delete(subscriptionHandle);
        if (docView.existsIn.size === 0) {
          // it is gone from everyone
          self.callbacks.removed(self.collectionName, id);
          self.documents.delete(id);
        } else {
          var changed = {};
          // remove this subscription from every precedence list
          // and record the changes
          docView.dataByKey.forEach(function (precedenceList, key) {
            docView.clearField(subscriptionHandle, key, changed);
          });
          self.callbacks.changed(self.collectionName, id, changed);
        }
      }
    });

    /******************************************************************************/
    /* Session                                                                    */
    /******************************************************************************/

    var Session = function (server, version, socket, options) {
      var self = this;
      self.id = Random.id();
      self.server = server;
      self.version = version;
      self.initialized = false;
      self.socket = socket;

      // Set to null when the session is destroyed. Multiple places below
      // use this to determine if the session is alive or not.
      self.inQueue = new Meteor._DoubleEndedQueue();
      self.blocked = false;
      self.workerRunning = false;
      self.cachedUnblock = null;

      // Sub objects for active subscriptions
      self._namedSubs = new Map();
      self._universalSubs = [];
      self.userId = null;
      self.collectionViews = new Map();

      // Set this to false to not send messages when collectionViews are
      // modified. This is done when rerunning subs in _setUserId and those messages
      // are calculated via a diff instead.
      self._isSending = true;

      // If this is true, don't start a newly-created universal publisher on this
      // session. The session will take care of starting it when appropriate.
      self._dontStartNewUniversalSubs = false;

      // When we are rerunning subscriptions, any ready messages
      // we want to buffer up for when we are done rerunning subscriptions
      self._pendingReady = [];

      // List of callbacks to call when this connection is closed.
      self._closeCallbacks = [];

      // XXX HACK: If a sockjs connection, save off the URL. This is
      // temporary and will go away in the near future.
      self._socketUrl = socket.url;

      // Allow tests to disable responding to pings.
      self._respondToPings = options.respondToPings;

      // This object is the public interface to the session. In the public
      // API, it is called the `connection` object.  Internally we call it
      // a `connectionHandle` to avoid ambiguity.
      self.connectionHandle = {
        id: self.id,
        close: function () {
          self.close();
        },
        onClose: function (fn) {
          var cb = Meteor.bindEnvironment(fn, "connection onClose callback");
          if (self.inQueue) {
            self._closeCallbacks.push(cb);
          } else {
            // if we're already closed, call the callback.
            Meteor.defer(cb);
          }
        },
        clientAddress: self._clientAddress(),
        httpHeaders: self.socket.headers
      };
      self.send({
        msg: 'connected',
        session: self.id
      });

      // On initial connect, spin up all the universal publishers.
      self.startUniversalSubs();
      if (version !== 'pre1' && options.heartbeatInterval !== 0) {
        // We no longer need the low level timeout because we have heartbeats.
        socket.setWebsocketTimeout(0);
        self.heartbeat = new DDPCommon.Heartbeat({
          heartbeatInterval: options.heartbeatInterval,
          heartbeatTimeout: options.heartbeatTimeout,
          onTimeout: function () {
            self.close();
          },
          sendPing: function () {
            self.send({
              msg: 'ping'
            });
          }
        });
        self.heartbeat.start();
      }
      Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "sessions", 1);
    };
    Object.assign(Session.prototype, {
      sendReady: function (subscriptionIds) {
        var self = this;
        if (self._isSending) {
          self.send({
            msg: "ready",
            subs: subscriptionIds
          });
        } else {
          subscriptionIds.forEach(function (subscriptionId) {
            self._pendingReady.push(subscriptionId);
          });
        }
      },
      _canSend(collectionName) {
        return this._isSending || !this.server.getPublicationStrategy(collectionName).useCollectionView;
      },
      sendAdded(collectionName, id, fields) {
        if (this._canSend(collectionName)) {
          this.send({
            msg: 'added',
            collection: collectionName,
            id,
            fields
          });
        }
      },
      sendChanged(collectionName, id, fields) {
        if (isEmpty(fields)) return;
        if (this._canSend(collectionName)) {
          this.send({
            msg: "changed",
            collection: collectionName,
            id,
            fields
          });
        }
      },
      sendRemoved(collectionName, id) {
        if (this._canSend(collectionName)) {
          this.send({
            msg: "removed",
            collection: collectionName,
            id
          });
        }
      },
      getSendCallbacks: function () {
        var self = this;
        return {
          added: self.sendAdded.bind(self),
          changed: self.sendChanged.bind(self),
          removed: self.sendRemoved.bind(self)
        };
      },
      getCollectionView: function (collectionName) {
        var self = this;
        var ret = self.collectionViews.get(collectionName);
        if (!ret) {
          ret = new SessionCollectionView(collectionName, self.getSendCallbacks());
          self.collectionViews.set(collectionName, ret);
        }
        return ret;
      },
      added(subscriptionHandle, collectionName, id, fields) {
        if (this.server.getPublicationStrategy(collectionName).useCollectionView) {
          const view = this.getCollectionView(collectionName);
          view.added(subscriptionHandle, id, fields);
        } else {
          this.sendAdded(collectionName, id, fields);
        }
      },
      removed(subscriptionHandle, collectionName, id) {
        if (this.server.getPublicationStrategy(collectionName).useCollectionView) {
          const view = this.getCollectionView(collectionName);
          view.removed(subscriptionHandle, id);
          if (view.isEmpty()) {
            this.collectionViews.delete(collectionName);
          }
        } else {
          this.sendRemoved(collectionName, id);
        }
      },
      changed(subscriptionHandle, collectionName, id, fields) {
        if (this.server.getPublicationStrategy(collectionName).useCollectionView) {
          const view = this.getCollectionView(collectionName);
          view.changed(subscriptionHandle, id, fields);
        } else {
          this.sendChanged(collectionName, id, fields);
        }
      },
      startUniversalSubs: function () {
        var self = this;
        // Make a shallow copy of the set of universal handlers and start them. If
        // additional universal publishers start while we're running them (due to
        // yielding), they will run separately as part of Server.publish.
        var handlers = [...self.server.universal_publish_handlers];
        handlers.forEach(function (handler) {
          self._startSubscription(handler);
        });
      },
      // Destroy this session and unregister it at the server.
      close: function () {
        var self = this;

        // Destroy this session, even if it's not registered at the
        // server. Stop all processing and tear everything down. If a socket
        // was attached, close it.

        // Already destroyed.
        if (!self.inQueue) return;

        // Drop the merge box data immediately.
        self.inQueue = null;
        self.collectionViews = new Map();
        if (self.heartbeat) {
          self.heartbeat.stop();
          self.heartbeat = null;
        }
        if (self.socket) {
          self.socket.close();
          self.socket._meteorSession = null;
        }
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "sessions", -1);
        Meteor.defer(function () {
          // Stop callbacks can yield, so we defer this on close.
          // sub._isDeactivated() detects that we set inQueue to null and
          // treats it as semi-deactivated (it will ignore incoming callbacks, etc).
          self._deactivateAllSubscriptions();

          // Defer calling the close callbacks, so that the caller closing
          // the session isn't waiting for all the callbacks to complete.
          self._closeCallbacks.forEach(function (callback) {
            callback();
          });
        });

        // Unregister the session.
        self.server._removeSession(self);
      },
      // Send a message (doing nothing if no socket is connected right now).
      // It should be a JSON object (it will be stringified).
      send: function (msg) {
        const self = this;
        if (self.socket) {
          if (Meteor._printSentDDP) Meteor._debug("Sent DDP", DDPCommon.stringifyDDP(msg));
          self.socket.send(DDPCommon.stringifyDDP(msg));
        }
      },
      // Send a connection error.
      sendError: function (reason, offendingMessage) {
        var self = this;
        var msg = {
          msg: 'error',
          reason: reason
        };
        if (offendingMessage) msg.offendingMessage = offendingMessage;
        self.send(msg);
      },
      // Process 'msg' as an incoming message. As a guard against
      // race conditions during reconnection, ignore the message if
      // 'socket' is not the currently connected socket.
      //
      // We run the messages from the client one at a time, in the order
      // given by the client. The message handler is passed an idempotent
      // function 'unblock' which it may call to allow other messages to
      // begin running in parallel in another fiber (for example, a method
      // that wants to yield). Otherwise, it is automatically unblocked
      // when it returns.
      //
      // Actually, we don't have to 'totally order' the messages in this
      // way, but it's the easiest thing that's correct. (unsub needs to
      // be ordered against sub, methods need to be ordered against each
      // other).
      processMessage: function (msg_in) {
        var self = this;
        if (!self.inQueue)
          // we have been destroyed.
          return;

        // Respond to ping and pong messages immediately without queuing.
        // If the negotiated DDP version is "pre1" which didn't support
        // pings, preserve the "pre1" behavior of responding with a "bad
        // request" for the unknown messages.
        //
        // Fibers are needed because heartbeats use Meteor.setTimeout, which
        // needs a Fiber. We could actually use regular setTimeout and avoid
        // these new fibers, but it is easier to just make everything use
        // Meteor.setTimeout and not think too hard.
        //
        // Any message counts as receiving a pong, as it demonstrates that
        // the client is still alive.
        if (self.heartbeat) {
          self.heartbeat.messageReceived();
        }
        ;
        if (self.version !== 'pre1' && msg_in.msg === 'ping') {
          if (self._respondToPings) self.send({
            msg: "pong",
            id: msg_in.id
          });
          return;
        }
        if (self.version !== 'pre1' && msg_in.msg === 'pong') {
          // Since everything is a pong, there is nothing to do
          return;
        }
        self.inQueue.push(msg_in);
        if (self.workerRunning) return;
        self.workerRunning = true;
        var processNext = function () {
          var msg = self.inQueue && self.inQueue.shift();
          if (!msg) {
            self.workerRunning = false;
            return;
          }
          function runHandlers() {
            var blocked = true;
            var unblock = function () {
              if (!blocked) return; // idempotent
              blocked = false;
              processNext();
            };
            self.server.onMessageHook.each(function (callback) {
              callback(msg, self);
              return true;
            });
            if (msg.msg in self.protocol_handlers) {
              const result = self.protocol_handlers[msg.msg].call(self, msg, unblock);
              if (Meteor._isPromise(result)) {
                result.finally(() => unblock());
              } else {
                unblock();
              }
            } else {
              self.sendError('Bad request', msg);
              unblock(); // in case the handler didn't already do it
            }
          }
          runHandlers();
        };
        processNext();
      },
      protocol_handlers: {
        sub: async function (msg, unblock) {
          var self = this;

          // cacheUnblock temporarly, so we can capture it later
          // we will use unblock in current eventLoop, so this is safe
          self.cachedUnblock = unblock;

          // reject malformed messages
          if (typeof msg.id !== "string" || typeof msg.name !== "string" || 'params' in msg && !(msg.params instanceof Array)) {
            self.sendError("Malformed subscription", msg);
            return;
          }
          if (!self.server.publish_handlers[msg.name]) {
            self.send({
              msg: 'nosub',
              id: msg.id,
              error: new Meteor.Error(404, "Subscription '".concat(msg.name, "' not found"))
            });
            return;
          }
          if (self._namedSubs.has(msg.id))
            // subs are idempotent, or rather, they are ignored if a sub
            // with that id already exists. this is important during
            // reconnect.
            return;

          // XXX It'd be much better if we had generic hooks where any package can
          // hook into subscription handling, but in the mean while we special case
          // ddp-rate-limiter package. This is also done for weak requirements to
          // add the ddp-rate-limiter package in case we don't have Accounts. A
          // user trying to use the ddp-rate-limiter must explicitly require it.
          if (Package['ddp-rate-limiter']) {
            var DDPRateLimiter = Package['ddp-rate-limiter'].DDPRateLimiter;
            var rateLimiterInput = {
              userId: self.userId,
              clientAddress: self.connectionHandle.clientAddress,
              type: "subscription",
              name: msg.name,
              connectionId: self.id
            };
            DDPRateLimiter._increment(rateLimiterInput);
            var rateLimitResult = DDPRateLimiter._check(rateLimiterInput);
            if (!rateLimitResult.allowed) {
              self.send({
                msg: 'nosub',
                id: msg.id,
                error: new Meteor.Error('too-many-requests', DDPRateLimiter.getErrorMessage(rateLimitResult), {
                  timeToReset: rateLimitResult.timeToReset
                })
              });
              return;
            }
          }
          var handler = self.server.publish_handlers[msg.name];
          await self._startSubscription(handler, msg.id, msg.params, msg.name);

          // cleaning cached unblock
          self.cachedUnblock = null;
        },
        unsub: function (msg) {
          var self = this;
          self._stopSubscription(msg.id);
        },
        method: async function (msg, unblock) {
          var self = this;

          // Reject malformed messages.
          // For now, we silently ignore unknown attributes,
          // for forwards compatibility.
          if (typeof msg.id !== "string" || typeof msg.method !== "string" || 'params' in msg && !(msg.params instanceof Array) || 'randomSeed' in msg && typeof msg.randomSeed !== "string") {
            self.sendError("Malformed method invocation", msg);
            return;
          }
          var randomSeed = msg.randomSeed || null;

          // Set up to mark the method as satisfied once all observers
          // (and subscriptions) have reacted to any writes that were
          // done.
          var fence = new DDPServer._WriteFence();
          fence.onAllCommitted(function () {
            // Retire the fence so that future writes are allowed.
            // This means that callbacks like timers are free to use
            // the fence, and if they fire before it's armed (for
            // example, because the method waits for them) their
            // writes will be included in the fence.
            fence.retire();
            self.send({
              msg: 'updated',
              methods: [msg.id]
            });
          });

          // Find the handler
          var handler = self.server.method_handlers[msg.method];
          if (!handler) {
            self.send({
              msg: 'result',
              id: msg.id,
              error: new Meteor.Error(404, "Method '".concat(msg.method, "' not found"))
            });
            await fence.arm();
            return;
          }
          var invocation = new DDPCommon.MethodInvocation({
            name: msg.method,
            isSimulation: false,
            userId: self.userId,
            setUserId(userId) {
              return self._setUserId(userId);
            },
            unblock: unblock,
            connection: self.connectionHandle,
            randomSeed: randomSeed,
            fence
          });
          const promise = new Promise((resolve, reject) => {
            // XXX It'd be better if we could hook into method handlers better but
            // for now, we need to check if the ddp-rate-limiter exists since we
            // have a weak requirement for the ddp-rate-limiter package to be added
            // to our application.
            if (Package['ddp-rate-limiter']) {
              var DDPRateLimiter = Package['ddp-rate-limiter'].DDPRateLimiter;
              var rateLimiterInput = {
                userId: self.userId,
                clientAddress: self.connectionHandle.clientAddress,
                type: "method",
                name: msg.method,
                connectionId: self.id
              };
              DDPRateLimiter._increment(rateLimiterInput);
              var rateLimitResult = DDPRateLimiter._check(rateLimiterInput);
              if (!rateLimitResult.allowed) {
                reject(new Meteor.Error("too-many-requests", DDPRateLimiter.getErrorMessage(rateLimitResult), {
                  timeToReset: rateLimitResult.timeToReset
                }));
                return;
              }
            }
            resolve(DDPServer._CurrentWriteFence.withValue(fence, () => DDP._CurrentMethodInvocation.withValue(invocation, () => maybeAuditArgumentChecks(handler, invocation, msg.params, "call to '" + msg.method + "'"))));
          });
          async function finish() {
            await fence.arm();
            unblock();
          }
          const payload = {
            msg: "result",
            id: msg.id
          };
          return promise.then(async result => {
            await finish();
            if (result !== undefined) {
              payload.result = result;
            }
            self.send(payload);
          }, async exception => {
            await finish();
            payload.error = wrapInternalException(exception, "while invoking method '".concat(msg.method, "'"));
            self.send(payload);
          });
        }
      },
      _eachSub: function (f) {
        var self = this;
        self._namedSubs.forEach(f);
        self._universalSubs.forEach(f);
      },
      _diffCollectionViews: function (beforeCVs) {
        var self = this;
        DiffSequence.diffMaps(beforeCVs, self.collectionViews, {
          both: function (collectionName, leftValue, rightValue) {
            rightValue.diff(leftValue);
          },
          rightOnly: function (collectionName, rightValue) {
            rightValue.documents.forEach(function (docView, id) {
              self.sendAdded(collectionName, id, docView.getFields());
            });
          },
          leftOnly: function (collectionName, leftValue) {
            leftValue.documents.forEach(function (doc, id) {
              self.sendRemoved(collectionName, id);
            });
          }
        });
      },
      // Sets the current user id in all appropriate contexts and reruns
      // all subscriptions
      async _setUserId(userId) {
        var self = this;
        if (userId !== null && typeof userId !== "string") throw new Error("setUserId must be called on string or null, not " + typeof userId);

        // Prevent newly-created universal subscriptions from being added to our
        // session. They will be found below when we call startUniversalSubs.
        //
        // (We don't have to worry about named subscriptions, because we only add
        // them when we process a 'sub' message. We are currently processing a
        // 'method' message, and the method did not unblock, because it is illegal
        // to call setUserId after unblock. Thus we cannot be concurrently adding a
        // new named subscription).
        self._dontStartNewUniversalSubs = true;

        // Prevent current subs from updating our collectionViews and call their
        // stop callbacks. This may yield.
        self._eachSub(function (sub) {
          sub._deactivate();
        });

        // All subs should now be deactivated. Stop sending messages to the client,
        // save the state of the published collections, reset to an empty view, and
        // update the userId.
        self._isSending = false;
        var beforeCVs = self.collectionViews;
        self.collectionViews = new Map();
        self.userId = userId;

        // _setUserId is normally called from a Meteor method with
        // DDP._CurrentMethodInvocation set. But DDP._CurrentMethodInvocation is not
        // expected to be set inside a publish function, so we temporary unset it.
        // Inside a publish function DDP._CurrentPublicationInvocation is set.
        await DDP._CurrentMethodInvocation.withValue(undefined, async function () {
          // Save the old named subs, and reset to having no subscriptions.
          var oldNamedSubs = self._namedSubs;
          self._namedSubs = new Map();
          self._universalSubs = [];
          await Promise.all([...oldNamedSubs].map(async _ref3 => {
            let [subscriptionId, sub] = _ref3;
            const newSub = sub._recreate();
            self._namedSubs.set(subscriptionId, newSub);
            // nb: if the handler throws or calls this.error(), it will in fact
            // immediately send its 'nosub'. This is OK, though.
            await newSub._runHandler();
          }));

          // Allow newly-created universal subs to be started on our connection in
          // parallel with the ones we're spinning up here, and spin up universal
          // subs.
          self._dontStartNewUniversalSubs = false;
          self.startUniversalSubs();
        }, {
          name: '_setUserId'
        });

        // Start sending messages again, beginning with the diff from the previous
        // state of the world to the current state. No yields are allowed during
        // this diff, so that other changes cannot interleave.
        Meteor._noYieldsAllowed(function () {
          self._isSending = true;
          self._diffCollectionViews(beforeCVs);
          if (!isEmpty(self._pendingReady)) {
            self.sendReady(self._pendingReady);
            self._pendingReady = [];
          }
        });
      },
      _startSubscription: function (handler, subId, params, name) {
        var self = this;
        var sub = new Subscription(self, handler, subId, params, name);
        let unblockHander = self.cachedUnblock;
        // _startSubscription may call from a lot places
        // so cachedUnblock might be null in somecases
        // assign the cachedUnblock
        sub.unblock = unblockHander || (() => {});
        if (subId) self._namedSubs.set(subId, sub);else self._universalSubs.push(sub);
        return sub._runHandler();
      },
      // Tear down specified subscription
      _stopSubscription: function (subId, error) {
        var self = this;
        var subName = null;
        if (subId) {
          var maybeSub = self._namedSubs.get(subId);
          if (maybeSub) {
            subName = maybeSub._name;
            maybeSub._removeAllDocuments();
            maybeSub._deactivate();
            self._namedSubs.delete(subId);
          }
        }
        var response = {
          msg: 'nosub',
          id: subId
        };
        if (error) {
          response.error = wrapInternalException(error, subName ? "from sub " + subName + " id " + subId : "from sub id " + subId);
        }
        self.send(response);
      },
      // Tear down all subscriptions. Note that this does NOT send removed or nosub
      // messages, since we assume the client is gone.
      _deactivateAllSubscriptions: function () {
        var self = this;
        self._namedSubs.forEach(function (sub, id) {
          sub._deactivate();
        });
        self._namedSubs = new Map();
        self._universalSubs.forEach(function (sub) {
          sub._deactivate();
        });
        self._universalSubs = [];
      },
      // Determine the remote client's IP address, based on the
      // HTTP_FORWARDED_COUNT environment variable representing how many
      // proxies the server is behind.
      _clientAddress: function () {
        var self = this;

        // For the reported client address for a connection to be correct,
        // the developer must set the HTTP_FORWARDED_COUNT environment
        // variable to an integer representing the number of hops they
        // expect in the `x-forwarded-for` header. E.g., set to "1" if the
        // server is behind one proxy.
        //
        // This could be computed once at startup instead of every time.
        var httpForwardedCount = parseInt(process.env['HTTP_FORWARDED_COUNT']) || 0;
        if (httpForwardedCount === 0) return self.socket.remoteAddress;
        var forwardedFor = self.socket.headers["x-forwarded-for"];
        if (!isString(forwardedFor)) return null;
        forwardedFor = forwardedFor.trim().split(/\s*,\s*/);

        // Typically the first value in the `x-forwarded-for` header is
        // the original IP address of the client connecting to the first
        // proxy.  However, the end user can easily spoof the header, in
        // which case the first value(s) will be the fake IP address from
        // the user pretending to be a proxy reporting the original IP
        // address value.  By counting HTTP_FORWARDED_COUNT back from the
        // end of the list, we ensure that we get the IP address being
        // reported by *our* first proxy.

        if (httpForwardedCount < 0 || httpForwardedCount > forwardedFor.length) return null;
        return forwardedFor[forwardedFor.length - httpForwardedCount];
      }
    });

    /******************************************************************************/
    /* Subscription                                                               */
    /******************************************************************************/

    // Ctor for a sub handle: the input to each publish function

    // Instance name is this because it's usually referred to as this inside a
    // publish
    /**
     * @summary The server's side of a subscription
     * @class Subscription
     * @instanceName this
     * @showInstanceName true
     */
    var Subscription = function (session, handler, subscriptionId, params, name) {
      var self = this;
      self._session = session; // type is Session

      /**
       * @summary Access inside the publish function. The incoming [connection](#meteor_onconnection) for this subscription.
       * @locus Server
       * @name  connection
       * @memberOf Subscription
       * @instance
       */
      self.connection = session.connectionHandle; // public API object

      self._handler = handler;

      // My subscription ID (generated by client, undefined for universal subs).
      self._subscriptionId = subscriptionId;
      // Undefined for universal subs
      self._name = name;
      self._params = params || [];

      // Only named subscriptions have IDs, but we need some sort of string
      // internally to keep track of all subscriptions inside
      // SessionDocumentViews. We use this subscriptionHandle for that.
      if (self._subscriptionId) {
        self._subscriptionHandle = 'N' + self._subscriptionId;
      } else {
        self._subscriptionHandle = 'U' + Random.id();
      }

      // Has _deactivate been called?
      self._deactivated = false;

      // Stop callbacks to g/c this sub.  called w/ zero arguments.
      self._stopCallbacks = [];

      // The set of (collection, documentid) that this subscription has
      // an opinion about.
      self._documents = new Map();

      // Remember if we are ready.
      self._ready = false;

      // Part of the public API: the user of this sub.

      /**
       * @summary Access inside the publish function. The id of the logged-in user, or `null` if no user is logged in.
       * @locus Server
       * @memberOf Subscription
       * @name  userId
       * @instance
       */
      self.userId = session.userId;

      // For now, the id filter is going to default to
      // the to/from DDP methods on MongoID, to
      // specifically deal with mongo/minimongo ObjectIds.

      // Later, you will be able to make this be "raw"
      // if you want to publish a collection that you know
      // just has strings for keys and no funny business, to
      // a DDP consumer that isn't minimongo.

      self._idFilter = {
        idStringify: MongoID.idStringify,
        idParse: MongoID.idParse
      };
      Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "subscriptions", 1);
    };
    Object.assign(Subscription.prototype, {
      _runHandler: async function () {
        // XXX should we unblock() here? Either before running the publish
        // function, or before running _publishCursor.
        //
        // Right now, each publish function blocks all future publishes and
        // methods waiting on data from Mongo (or whatever else the function
        // blocks on). This probably slows page load in common cases.

        if (!this.unblock) {
          this.unblock = () => {};
        }
        const self = this;
        let resultOrThenable = null;
        try {
          resultOrThenable = DDP._CurrentPublicationInvocation.withValue(self, () => maybeAuditArgumentChecks(self._handler, self, EJSON.clone(self._params),
          // It's OK that this would look weird for universal subscriptions,
          // because they have no arguments so there can never be an
          // audit-argument-checks failure.
          "publisher '" + self._name + "'"), {
            name: self._name
          });
        } catch (e) {
          self.error(e);
          return;
        }

        // Did the handler call this.error or this.stop?
        if (self._isDeactivated()) return;

        // Both conventional and async publish handler functions are supported.
        // If an object is returned with a then() function, it is either a promise
        // or thenable and will be resolved asynchronously.
        const isThenable = resultOrThenable && typeof resultOrThenable.then === 'function';
        if (isThenable) {
          try {
            await self._publishHandlerResult(await resultOrThenable);
          } catch (e) {
            self.error(e);
          }
        } else {
          await self._publishHandlerResult(resultOrThenable);
        }
      },
      async _publishHandlerResult(res) {
        // SPECIAL CASE: Instead of writing their own callbacks that invoke
        // this.added/changed/ready/etc, the user can just return a collection
        // cursor or array of cursors from the publish function; we call their
        // _publishCursor method which starts observing the cursor and publishes the
        // results. Note that _publishCursor does NOT call ready().
        //
        // XXX This uses an undocumented interface which only the Mongo cursor
        // interface publishes. Should we make this interface public and encourage
        // users to implement it themselves? Arguably, it's unnecessary; users can
        // already write their own functions like
        //   var publishMyReactiveThingy = function (name, handler) {
        //     Meteor.publish(name, function () {
        //       var reactiveThingy = handler();
        //       reactiveThingy.publishMe();
        //     });
        //   };

        var self = this;
        var isCursor = function (c) {
          return c && c._publishCursor;
        };
        if (isCursor(res)) {
          try {
            await res._publishCursor(self);
          } catch (e) {
            self.error(e);
            return;
          }
          // _publishCursor only returns after the initial added callbacks have run.
          // mark subscription as ready.
          self.ready();
        } else if (Array.isArray(res)) {
          // Check all the elements are cursors
          if (!res.every(isCursor)) {
            self.error(new Error("Publish function returned an array of non-Cursors"));
            return;
          }
          // Find duplicate collection names
          // XXX we should support overlapping cursors, but that would require the
          // merge box to allow overlap within a subscription
          var collectionNames = {};
          for (var i = 0; i < res.length; ++i) {
            var collectionName = res[i]._getCollectionName();
            if (collectionNames[collectionName]) {
              self.error(new Error("Publish function returned multiple cursors for collection " + collectionName));
              return;
            }
            collectionNames[collectionName] = true;
          }
          try {
            await Promise.all(res.map(cur => cur._publishCursor(self)));
          } catch (e) {
            self.error(e);
            return;
          }
          self.ready();
        } else if (res) {
          // Truthy values other than cursors or arrays are probably a
          // user mistake (possible returning a Mongo document via, say,
          // `coll.findOne()`).
          self.error(new Error("Publish function can only return a Cursor or " + "an array of Cursors"));
        }
      },
      // This calls all stop callbacks and prevents the handler from updating any
      // SessionCollectionViews further. It's used when the user unsubscribes or
      // disconnects, as well as during setUserId re-runs. It does *NOT* send
      // removed messages for the published objects; if that is necessary, call
      // _removeAllDocuments first.
      _deactivate: function () {
        var self = this;
        if (self._deactivated) return;
        self._deactivated = true;
        self._callStopCallbacks();
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "subscriptions", -1);
      },
      _callStopCallbacks: function () {
        var self = this;
        // Tell listeners, so they can clean up
        var callbacks = self._stopCallbacks;
        self._stopCallbacks = [];
        callbacks.forEach(function (callback) {
          callback();
        });
      },
      // Send remove messages for every document.
      _removeAllDocuments: function () {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._documents.forEach(function (collectionDocs, collectionName) {
            collectionDocs.forEach(function (strId) {
              self.removed(collectionName, self._idFilter.idParse(strId));
            });
          });
        });
      },
      // Returns a new Subscription for the same session with the same
      // initial creation parameters. This isn't a clone: it doesn't have
      // the same _documents cache, stopped state or callbacks; may have a
      // different _subscriptionHandle, and gets its userId from the
      // session, not from this object.
      _recreate: function () {
        var self = this;
        return new Subscription(self._session, self._handler, self._subscriptionId, self._params, self._name);
      },
      /**
       * @summary Call inside the publish function.  Stops this client's subscription, triggering a call on the client to the `onStop` callback passed to [`Meteor.subscribe`](#meteor_subscribe), if any. If `error` is not a [`Meteor.Error`](#meteor_error), it will be [sanitized](#meteor_error).
       * @locus Server
       * @param {Error} error The error to pass to the client.
       * @instance
       * @memberOf Subscription
       */
      error: function (error) {
        var self = this;
        if (self._isDeactivated()) return;
        self._session._stopSubscription(self._subscriptionId, error);
      },
      // Note that while our DDP client will notice that you've called stop() on the
      // server (and clean up its _subscriptions table) we don't actually provide a
      // mechanism for an app to notice this (the subscribe onError callback only
      // triggers if there is an error).

      /**
       * @summary Call inside the publish function.  Stops this client's subscription and invokes the client's `onStop` callback with no error.
       * @locus Server
       * @instance
       * @memberOf Subscription
       */
      stop: function () {
        var self = this;
        if (self._isDeactivated()) return;
        self._session._stopSubscription(self._subscriptionId);
      },
      /**
       * @summary Call inside the publish function.  Registers a callback function to run when the subscription is stopped.
       * @locus Server
       * @memberOf Subscription
       * @instance
       * @param {Function} func The callback function
       */
      onStop: function (callback) {
        var self = this;
        callback = Meteor.bindEnvironment(callback, 'onStop callback', self);
        if (self._isDeactivated()) callback();else self._stopCallbacks.push(callback);
      },
      // This returns true if the sub has been deactivated, *OR* if the session was
      // destroyed but the deferred call to _deactivateAllSubscriptions hasn't
      // happened yet.
      _isDeactivated: function () {
        var self = this;
        return self._deactivated || self._session.inQueue === null;
      },
      /**
       * @summary Call inside the publish function.  Informs the subscriber that a document has been added to the record set.
       * @locus Server
       * @memberOf Subscription
       * @instance
       * @param {String} collection The name of the collection that contains the new document.
       * @param {String} id The new document's ID.
       * @param {Object} fields The fields in the new document.  If `_id` is present it is ignored.
       */
      added(collectionName, id, fields) {
        if (this._isDeactivated()) return;
        id = this._idFilter.idStringify(id);
        if (this._session.server.getPublicationStrategy(collectionName).doAccountingForCollection) {
          let ids = this._documents.get(collectionName);
          if (ids == null) {
            ids = new Set();
            this._documents.set(collectionName, ids);
          }
          ids.add(id);
        }
        this._session.added(this._subscriptionHandle, collectionName, id, fields);
      },
      /**
       * @summary Call inside the publish function.  Informs the subscriber that a document in the record set has been modified.
       * @locus Server
       * @memberOf Subscription
       * @instance
       * @param {String} collection The name of the collection that contains the changed document.
       * @param {String} id The changed document's ID.
       * @param {Object} fields The fields in the document that have changed, together with their new values.  If a field is not present in `fields` it was left unchanged; if it is present in `fields` and has a value of `undefined` it was removed from the document.  If `_id` is present it is ignored.
       */
      changed(collectionName, id, fields) {
        if (this._isDeactivated()) return;
        id = this._idFilter.idStringify(id);
        this._session.changed(this._subscriptionHandle, collectionName, id, fields);
      },
      /**
       * @summary Call inside the publish function.  Informs the subscriber that a document has been removed from the record set.
       * @locus Server
       * @memberOf Subscription
       * @instance
       * @param {String} collection The name of the collection that the document has been removed from.
       * @param {String} id The ID of the document that has been removed.
       */
      removed(collectionName, id) {
        if (this._isDeactivated()) return;
        id = this._idFilter.idStringify(id);
        if (this._session.server.getPublicationStrategy(collectionName).doAccountingForCollection) {
          // We don't bother to delete sets of things in a collection if the
          // collection is empty.  It could break _removeAllDocuments.
          this._documents.get(collectionName).delete(id);
        }
        this._session.removed(this._subscriptionHandle, collectionName, id);
      },
      /**
       * @summary Call inside the publish function.  Informs the subscriber that an initial, complete snapshot of the record set has been sent.  This will trigger a call on the client to the `onReady` callback passed to  [`Meteor.subscribe`](#meteor_subscribe), if any.
       * @locus Server
       * @memberOf Subscription
       * @instance
       */
      ready: function () {
        var self = this;
        if (self._isDeactivated()) return;
        if (!self._subscriptionId) return; // Unnecessary but ignored for universal sub
        if (!self._ready) {
          self._session.sendReady([self._subscriptionId]);
          self._ready = true;
        }
      }
    });

    /******************************************************************************/
    /* Server                                                                     */
    /******************************************************************************/

    Server = function () {
      let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var self = this;

      // The default heartbeat interval is 30 seconds on the server and 35
      // seconds on the client.  Since the client doesn't need to send a
      // ping as long as it is receiving pings, this means that pings
      // normally go from the server to the client.
      //
      // Note: Troposphere depends on the ability to mutate
      // Meteor.server.options.heartbeatTimeout! This is a hack, but it's life.
      self.options = _objectSpread({
        heartbeatInterval: 15000,
        heartbeatTimeout: 15000,
        // For testing, allow responding to pings to be disabled.
        respondToPings: true,
        defaultPublicationStrategy: publicationStrategies.SERVER_MERGE
      }, options);

      // Map of callbacks to call when a new connection comes in to the
      // server and completes DDP version negotiation. Use an object instead
      // of an array so we can safely remove one from the list while
      // iterating over it.
      self.onConnectionHook = new Hook({
        debugPrintExceptions: "onConnection callback"
      });

      // Map of callbacks to call when a new message comes in.
      self.onMessageHook = new Hook({
        debugPrintExceptions: "onMessage callback"
      });
      self.publish_handlers = {};
      self.universal_publish_handlers = [];
      self.method_handlers = {};
      self._publicationStrategies = {};
      self.sessions = new Map(); // map from id to session

      self.stream_server = new StreamServer();
      self.stream_server.register(function (socket) {
        // socket implements the SockJSConnection interface
        socket._meteorSession = null;
        var sendError = function (reason, offendingMessage) {
          var msg = {
            msg: 'error',
            reason: reason
          };
          if (offendingMessage) msg.offendingMessage = offendingMessage;
          socket.send(DDPCommon.stringifyDDP(msg));
        };
        socket.on('data', function (raw_msg) {
          if (Meteor._printReceivedDDP) {
            Meteor._debug("Received DDP", raw_msg);
          }
          try {
            try {
              var msg = DDPCommon.parseDDP(raw_msg);
            } catch (err) {
              sendError('Parse error');
              return;
            }
            if (msg === null || !msg.msg) {
              sendError('Bad request', msg);
              return;
            }
            if (msg.msg === 'connect') {
              if (socket._meteorSession) {
                sendError("Already connected", msg);
                return;
              }
              self._handleConnect(socket, msg);
              return;
            }
            if (!socket._meteorSession) {
              sendError('Must connect first', msg);
              return;
            }
            socket._meteorSession.processMessage(msg);
          } catch (e) {
            // XXX print stack nicely
            Meteor._debug("Internal exception while processing message", msg, e);
          }
        });
        socket.on('close', function () {
          if (socket._meteorSession) {
            socket._meteorSession.close();
          }
        });
      });
    };
    Object.assign(Server.prototype, {
      /**
       * @summary Register a callback to be called when a new DDP connection is made to the server.
       * @locus Server
       * @param {function} callback The function to call when a new DDP connection is established.
       * @memberOf Meteor
       * @importFromPackage meteor
       */
      onConnection: function (fn) {
        var self = this;
        return self.onConnectionHook.register(fn);
      },
      /**
       * @summary Set publication strategy for the given publication. Publications strategies are available from `DDPServer.publicationStrategies`. You call this method from `Meteor.server`, like `Meteor.server.setPublicationStrategy()`
       * @locus Server
       * @alias setPublicationStrategy
       * @param publicationName {String}
       * @param strategy {{useCollectionView: boolean, doAccountingForCollection: boolean}}
       * @memberOf Meteor.server
       * @importFromPackage meteor
       */
      setPublicationStrategy(publicationName, strategy) {
        if (!Object.values(publicationStrategies).includes(strategy)) {
          throw new Error("Invalid merge strategy: ".concat(strategy, " \n        for collection ").concat(publicationName));
        }
        this._publicationStrategies[publicationName] = strategy;
      },
      /**
       * @summary Gets the publication strategy for the requested publication. You call this method from `Meteor.server`, like `Meteor.server.getPublicationStrategy()`
       * @locus Server
       * @alias getPublicationStrategy
       * @param publicationName {String}
       * @memberOf Meteor.server
       * @importFromPackage meteor
       * @return {{useCollectionView: boolean, doAccountingForCollection: boolean}}
       */
      getPublicationStrategy(publicationName) {
        return this._publicationStrategies[publicationName] || this.options.defaultPublicationStrategy;
      },
      /**
       * @summary Register a callback to be called when a new DDP message is received.
       * @locus Server
       * @param {function} callback The function to call when a new DDP message is received.
       * @memberOf Meteor
       * @importFromPackage meteor
       */
      onMessage: function (fn) {
        var self = this;
        return self.onMessageHook.register(fn);
      },
      _handleConnect: function (socket, msg) {
        var self = this;

        // The connect message must specify a version and an array of supported
        // versions, and it must claim to support what it is proposing.
        if (!(typeof msg.version === 'string' && Array.isArray(msg.support) && msg.support.every(isString) && msg.support.includes(msg.version))) {
          socket.send(DDPCommon.stringifyDDP({
            msg: 'failed',
            version: DDPCommon.SUPPORTED_DDP_VERSIONS[0]
          }));
          socket.close();
          return;
        }

        // In the future, handle session resumption: something like:
        //  socket._meteorSession = self.sessions[msg.session]
        var version = calculateVersion(msg.support, DDPCommon.SUPPORTED_DDP_VERSIONS);
        if (msg.version !== version) {
          // The best version to use (according to the client's stated preferences)
          // is not the one the client is trying to use. Inform them about the best
          // version to use.
          socket.send(DDPCommon.stringifyDDP({
            msg: 'failed',
            version: version
          }));
          socket.close();
          return;
        }

        // Yay, version matches! Create a new session.
        // Note: Troposphere depends on the ability to mutate
        // Meteor.server.options.heartbeatTimeout! This is a hack, but it's life.
        socket._meteorSession = new Session(self, version, socket, self.options);
        self.sessions.set(socket._meteorSession.id, socket._meteorSession);
        self.onConnectionHook.each(function (callback) {
          if (socket._meteorSession) callback(socket._meteorSession.connectionHandle);
          return true;
        });
      },
      /**
       * Register a publish handler function.
       *
       * @param name {String} identifier for query
       * @param handler {Function} publish handler
       * @param options {Object}
       *
       * Server will call handler function on each new subscription,
       * either when receiving DDP sub message for a named subscription, or on
       * DDP connect for a universal subscription.
       *
       * If name is null, this will be a subscription that is
       * automatically established and permanently on for all connected
       * client, instead of a subscription that can be turned on and off
       * with subscribe().
       *
       * options to contain:
       *  - (mostly internal) is_auto: true if generated automatically
       *    from an autopublish hook. this is for cosmetic purposes only
       *    (it lets us determine whether to print a warning suggesting
       *    that you turn off autopublish).
       */

      /**
       * @summary Publish a record set.
       * @memberOf Meteor
       * @importFromPackage meteor
       * @locus Server
       * @param {String|Object} name If String, name of the record set.  If Object, publications Dictionary of publish functions by name.  If `null`, the set has no name, and the record set is automatically sent to all connected clients.
       * @param {Function} func Function called on the server each time a client subscribes.  Inside the function, `this` is the publish handler object, described below.  If the client passed arguments to `subscribe`, the function is called with the same arguments.
       */
      publish: function (name, handler, options) {
        var self = this;
        if (!isObject(name)) {
          options = options || {};
          if (name && name in self.publish_handlers) {
            Meteor._debug("Ignoring duplicate publish named '" + name + "'");
            return;
          }
          if (Package.autopublish && !options.is_auto) {
            // They have autopublish on, yet they're trying to manually
            // pick stuff to publish. They probably should turn off
            // autopublish. (This check isn't perfect -- if you create a
            // publish before you turn on autopublish, it won't catch
            // it, but this will definitely handle the simple case where
            // you've added the autopublish package to your app, and are
            // calling publish from your app code).
            if (!self.warned_about_autopublish) {
              self.warned_about_autopublish = true;
              Meteor._debug("** You've set up some data subscriptions with Meteor.publish(), but\n" + "** you still have autopublish turned on. Because autopublish is still\n" + "** on, your Meteor.publish() calls won't have much effect. All data\n" + "** will still be sent to all clients.\n" + "**\n" + "** Turn off autopublish by removing the autopublish package:\n" + "**\n" + "**   $ meteor remove autopublish\n" + "**\n" + "** .. and make sure you have Meteor.publish() and Meteor.subscribe() calls\n" + "** for each collection that you want clients to see.\n");
            }
          }
          if (name) self.publish_handlers[name] = handler;else {
            self.universal_publish_handlers.push(handler);
            // Spin up the new publisher on any existing session too. Run each
            // session's subscription in a new Fiber, so that there's no change for
            // self.sessions to change while we're running this loop.
            self.sessions.forEach(function (session) {
              if (!session._dontStartNewUniversalSubs) {
                session._startSubscription(handler);
              }
            });
          }
        } else {
          Object.entries(name).forEach(function (_ref4) {
            let [key, value] = _ref4;
            self.publish(key, value, {});
          });
        }
      },
      _removeSession: function (session) {
        var self = this;
        self.sessions.delete(session.id);
      },
      /**
       * @summary Tells if the method call came from a call or a callAsync.
       * @locus Anywhere
       * @memberOf Meteor
       * @importFromPackage meteor
       * @returns boolean
       */
      isAsyncCall: function () {
        return DDP._CurrentMethodInvocation._isCallAsyncMethodRunning();
      },
      /**
       * @summary Defines functions that can be invoked over the network by clients.
       * @locus Anywhere
       * @param {Object} methods Dictionary whose keys are method names and values are functions.
       * @memberOf Meteor
       * @importFromPackage meteor
       */
      methods: function (methods) {
        var self = this;
        Object.entries(methods).forEach(function (_ref5) {
          let [name, func] = _ref5;
          if (typeof func !== 'function') throw new Error("Method '" + name + "' must be a function");
          if (self.method_handlers[name]) throw new Error("A method named '" + name + "' is already defined");
          self.method_handlers[name] = func;
        });
      },
      call: function (name) {
        for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          args[_key - 1] = arguments[_key];
        }
        if (args.length && typeof args[args.length - 1] === "function") {
          // If it's a function, the last argument is the result callback, not
          // a parameter to the remote method.
          var callback = args.pop();
        }
        return this.apply(name, args, callback);
      },
      // A version of the call method that always returns a Promise.
      callAsync: function (name) {
        var _args$;
        for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
          args[_key2 - 1] = arguments[_key2];
        }
        const options = (_args$ = args[0]) !== null && _args$ !== void 0 && _args$.hasOwnProperty('returnStubValue') ? args.shift() : {};
        DDP._CurrentMethodInvocation._setCallAsyncMethodRunning(true);
        const promise = new Promise((resolve, reject) => {
          DDP._CurrentCallAsyncInvocation._set({
            name,
            hasCallAsyncParent: true
          });
          this.applyAsync(name, args, _objectSpread({
            isFromCallAsync: true
          }, options)).then(resolve).catch(reject).finally(() => {
            DDP._CurrentCallAsyncInvocation._set();
          });
        });
        return promise.finally(() => DDP._CurrentMethodInvocation._setCallAsyncMethodRunning(false));
      },
      apply: function (name, args, options, callback) {
        // We were passed 3 arguments. They may be either (name, args, options)
        // or (name, args, callback)
        if (!callback && typeof options === 'function') {
          callback = options;
          options = {};
        } else {
          options = options || {};
        }
        const promise = this.applyAsync(name, args, options);

        // Return the result in whichever way the caller asked for it. Note that we
        // do NOT block on the write fence in an analogous way to how the client
        // blocks on the relevant data being visible, so you are NOT guaranteed that
        // cursor observe callbacks have fired when your callback is invoked. (We
        // can change this if there's a real use case).
        if (callback) {
          promise.then(result => callback(undefined, result), exception => callback(exception));
        } else {
          return promise;
        }
      },
      // @param options {Optional Object}
      applyAsync: function (name, args, options) {
        // Run the handler
        var handler = this.method_handlers[name];
        if (!handler) {
          return Promise.reject(new Meteor.Error(404, "Method '".concat(name, "' not found")));
        }
        // If this is a method call from within another method or publish function,
        // get the user state from the outer method or publish function, otherwise
        // don't allow setUserId to be called
        var userId = null;
        let setUserId = () => {
          throw new Error("Can't call setUserId on a server initiated method call");
        };
        var connection = null;
        var currentMethodInvocation = DDP._CurrentMethodInvocation.get();
        var currentPublicationInvocation = DDP._CurrentPublicationInvocation.get();
        var randomSeed = null;
        if (currentMethodInvocation) {
          userId = currentMethodInvocation.userId;
          setUserId = userId => currentMethodInvocation.setUserId(userId);
          connection = currentMethodInvocation.connection;
          randomSeed = DDPCommon.makeRpcSeed(currentMethodInvocation, name);
        } else if (currentPublicationInvocation) {
          userId = currentPublicationInvocation.userId;
          setUserId = userId => currentPublicationInvocation._session._setUserId(userId);
          connection = currentPublicationInvocation.connection;
        }
        var invocation = new DDPCommon.MethodInvocation({
          isSimulation: false,
          userId,
          setUserId,
          connection,
          randomSeed
        });
        return new Promise((resolve, reject) => {
          let result;
          try {
            result = DDP._CurrentMethodInvocation.withValue(invocation, () => maybeAuditArgumentChecks(handler, invocation, EJSON.clone(args), "internal call to '" + name + "'"));
          } catch (e) {
            return reject(e);
          }
          if (!Meteor._isPromise(result)) {
            return resolve(result);
          }
          result.then(r => resolve(r)).catch(reject);
        }).then(EJSON.clone);
      },
      _urlForSession: function (sessionId) {
        var self = this;
        var session = self.sessions.get(sessionId);
        if (session) return session._socketUrl;else return null;
      }
    });
    var calculateVersion = function (clientSupportedVersions, serverSupportedVersions) {
      var correctVersion = clientSupportedVersions.find(function (version) {
        return serverSupportedVersions.includes(version);
      });
      if (!correctVersion) {
        correctVersion = serverSupportedVersions[0];
      }
      return correctVersion;
    };
    DDPServer._calculateVersion = calculateVersion;

    // "blind" exceptions other than those that were deliberately thrown to signal
    // errors to the client
    var wrapInternalException = function (exception, context) {
      if (!exception) return exception;

      // To allow packages to throw errors intended for the client but not have to
      // depend on the Meteor.Error class, `isClientSafe` can be set to true on any
      // error before it is thrown.
      if (exception.isClientSafe) {
        if (!(exception instanceof Meteor.Error)) {
          const originalMessage = exception.message;
          exception = new Meteor.Error(exception.error, exception.reason, exception.details);
          exception.message = originalMessage;
        }
        return exception;
      }

      // Tests can set the '_expectedByTest' flag on an exception so it won't go to
      // the server log.
      if (!exception._expectedByTest) {
        Meteor._debug("Exception " + context, exception.stack);
        if (exception.sanitizedError) {
          Meteor._debug("Sanitized and reported to the client as:", exception.sanitizedError);
          Meteor._debug();
        }
      }

      // Did the error contain more details that could have been useful if caught in
      // server code (or if thrown from non-client-originated code), but also
      // provided a "sanitized" version with more context than 500 Internal server error? Use that.
      if (exception.sanitizedError) {
        if (exception.sanitizedError.isClientSafe) return exception.sanitizedError;
        Meteor._debug("Exception " + context + " provides a sanitizedError that " + "does not have isClientSafe property set; ignoring");
      }
      return new Meteor.Error(500, "Internal server error");
    };

    // Audit argument checks, if the audit-argument-checks package exists (it is a
    // weak dependency of this package).
    var maybeAuditArgumentChecks = function (f, context, args, description) {
      args = args || [];
      if (Package['audit-argument-checks']) {
        return Match._failIfArgumentsAreNotAllChecked(f, context, args, description);
      }
      return f.apply(context, args);
    };
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"writefence.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/writefence.js                                                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// A write fence collects a group of writes, and provides a callback
// when all of the writes are fully committed and propagated (all
// observers have been notified of the write and acknowledged it.)
//
DDPServer._WriteFence = class {
  constructor() {
    this.armed = false;
    this.fired = false;
    this.retired = false;
    this.outstanding_writes = 0;
    this.before_fire_callbacks = [];
    this.completion_callbacks = [];
  }

  // Start tracking a write, and return an object to represent it. The
  // object has a single method, committed(). This method should be
  // called when the write is fully committed and propagated. You can
  // continue to add writes to the WriteFence up until it is triggered
  // (calls its callbacks because all writes have committed.)
  beginWrite() {
    if (this.retired) return {
      committed: function () {}
    };
    if (this.fired) throw new Error("fence has already activated -- too late to add writes");
    this.outstanding_writes++;
    let committed = false;
    const _committedFn = async () => {
      if (committed) throw new Error("committed called twice on the same write");
      committed = true;
      this.outstanding_writes--;
      await this._maybeFire();
    };
    return {
      committed: _committedFn
    };
  }

  // Arm the fence. Once the fence is armed, and there are no more
  // uncommitted writes, it will activate.
  arm() {
    if (this === DDPServer._getCurrentFence()) throw Error("Can't arm the current fence");
    this.armed = true;
    return this._maybeFire();
  }

  // Register a function to be called once before firing the fence.
  // Callback function can add new writes to the fence, in which case
  // it won't fire until those writes are done as well.
  onBeforeFire(func) {
    if (this.fired) throw new Error("fence has already activated -- too late to " + "add a callback");
    this.before_fire_callbacks.push(func);
  }

  // Register a function to be called when the fence fires.
  onAllCommitted(func) {
    if (this.fired) throw new Error("fence has already activated -- too late to " + "add a callback");
    this.completion_callbacks.push(func);
  }
  async _armAndWait() {
    let resolver;
    const returnValue = new Promise(r => resolver = r);
    this.onAllCommitted(resolver);
    await this.arm();
    return returnValue;
  }
  // Convenience function. Arms the fence, then blocks until it fires.
  async armAndWait() {
    return this._armAndWait();
  }
  async _maybeFire() {
    if (this.fired) throw new Error("write fence already activated?");
    if (this.armed && !this.outstanding_writes) {
      const invokeCallback = async func => {
        try {
          await func(this);
        } catch (err) {
          Meteor._debug("exception in write fence callback:", err);
        }
      };
      this.outstanding_writes++;
      while (this.before_fire_callbacks.length > 0) {
        const cb = this.before_fire_callbacks.shift();
        await invokeCallback(cb);
      }
      this.outstanding_writes--;
      if (!this.outstanding_writes) {
        this.fired = true;
        const callbacks = this.completion_callbacks || [];
        this.completion_callbacks = [];
        while (callbacks.length > 0) {
          const cb = callbacks.shift();
          await invokeCallback(cb);
        }
      }
    }
  }

  // Deactivate this fence so that adding more writes has no effect.
  // The fence must have already fired.
  retire() {
    if (!this.fired) throw new Error("Can't retire a fence that hasn't fired.");
    this.retired = true;
  }
};

// The current write fence. When there is a current write fence, code
// that writes to databases should register their writes with it using
// beginWrite().
//
DDPServer._CurrentWriteFence = new Meteor.EnvironmentVariable();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"crossbar.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/crossbar.js                                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// A "crossbar" is a class that provides structured notification registration.
// See _match for the definition of how a notification matches a trigger.
// All notifications and triggers must have a string key named 'collection'.

DDPServer._Crossbar = function (options) {
  var self = this;
  options = options || {};
  self.nextId = 1;
  // map from collection name (string) -> listener id -> object. each object has
  // keys 'trigger', 'callback'.  As a hack, the empty string means "no
  // collection".
  self.listenersByCollection = {};
  self.listenersByCollectionCount = {};
  self.factPackage = options.factPackage || "livedata";
  self.factName = options.factName || null;
};
Object.assign(DDPServer._Crossbar.prototype, {
  // msg is a trigger or a notification
  _collectionForMessage: function (msg) {
    var self = this;
    if (!('collection' in msg)) {
      return '';
    } else if (typeof msg.collection === 'string') {
      if (msg.collection === '') throw Error("Message has empty collection!");
      return msg.collection;
    } else {
      throw Error("Message has non-string collection!");
    }
  },
  // Listen for notification that match 'trigger'. A notification
  // matches if it has the key-value pairs in trigger as a
  // subset. When a notification matches, call 'callback', passing
  // the actual notification.
  //
  // Returns a listen handle, which is an object with a method
  // stop(). Call stop() to stop listening.
  //
  // XXX It should be legal to call fire() from inside a listen()
  // callback?
  listen: function (trigger, callback) {
    var self = this;
    var id = self.nextId++;
    var collection = self._collectionForMessage(trigger);
    var record = {
      trigger: EJSON.clone(trigger),
      callback: callback
    };
    if (!(collection in self.listenersByCollection)) {
      self.listenersByCollection[collection] = {};
      self.listenersByCollectionCount[collection] = 0;
    }
    self.listenersByCollection[collection][id] = record;
    self.listenersByCollectionCount[collection]++;
    if (self.factName && Package['facts-base']) {
      Package['facts-base'].Facts.incrementServerFact(self.factPackage, self.factName, 1);
    }
    return {
      stop: function () {
        if (self.factName && Package['facts-base']) {
          Package['facts-base'].Facts.incrementServerFact(self.factPackage, self.factName, -1);
        }
        delete self.listenersByCollection[collection][id];
        self.listenersByCollectionCount[collection]--;
        if (self.listenersByCollectionCount[collection] === 0) {
          delete self.listenersByCollection[collection];
          delete self.listenersByCollectionCount[collection];
        }
      }
    };
  },
  // Fire the provided 'notification' (an object whose attribute
  // values are all JSON-compatibile) -- inform all matching listeners
  // (registered with listen()).
  //
  // If fire() is called inside a write fence, then each of the
  // listener callbacks will be called inside the write fence as well.
  //
  // The listeners may be invoked in parallel, rather than serially.
  fire: async function (notification) {
    var self = this;
    var collection = self._collectionForMessage(notification);
    if (!(collection in self.listenersByCollection)) {
      return;
    }
    var listenersForCollection = self.listenersByCollection[collection];
    var callbackIds = [];
    Object.entries(listenersForCollection).forEach(function (_ref) {
      let [id, l] = _ref;
      if (self._matches(notification, l.trigger)) {
        callbackIds.push(id);
      }
    });

    // Listener callbacks can yield, so we need to first find all the ones that
    // match in a single iteration over self.listenersByCollection (which can't
    // be mutated during this iteration), and then invoke the matching
    // callbacks, checking before each call to ensure they haven't stopped.
    // Note that we don't have to check that
    // self.listenersByCollection[collection] still === listenersForCollection,
    // because the only way that stops being true is if listenersForCollection
    // first gets reduced down to the empty object (and then never gets
    // increased again).
    for (const id of callbackIds) {
      if (id in listenersForCollection) {
        await listenersForCollection[id].callback(notification);
      }
    }
  },
  // A notification matches a trigger if all keys that exist in both are equal.
  //
  // Examples:
  //  N:{collection: "C"} matches T:{collection: "C"}
  //    (a non-targeted write to a collection matches a
  //     non-targeted query)
  //  N:{collection: "C", id: "X"} matches T:{collection: "C"}
  //    (a targeted write to a collection matches a non-targeted query)
  //  N:{collection: "C"} matches T:{collection: "C", id: "X"}
  //    (a non-targeted write to a collection matches a
  //     targeted query)
  //  N:{collection: "C", id: "X"} matches T:{collection: "C", id: "X"}
  //    (a targeted write to a collection matches a targeted query targeted
  //     at the same document)
  //  N:{collection: "C", id: "X"} does not match T:{collection: "C", id: "Y"}
  //    (a targeted write to a collection does not match a targeted query
  //     targeted at a different document)
  _matches: function (notification, trigger) {
    // Most notifications that use the crossbar have a string `collection` and
    // maybe an `id` that is a string or ObjectID. We're already dividing up
    // triggers by collection, but let's fast-track "nope, different ID" (and
    // avoid the overly generic EJSON.equals). This makes a noticeable
    // performance difference; see https://github.com/meteor/meteor/pull/3697
    if (typeof notification.id === 'string' && typeof trigger.id === 'string' && notification.id !== trigger.id) {
      return false;
    }
    if (notification.id instanceof MongoID.ObjectID && trigger.id instanceof MongoID.ObjectID && !notification.id.equals(trigger.id)) {
      return false;
    }
    return Object.keys(trigger).every(function (key) {
      return !(key in notification) || EJSON.equals(trigger[key], notification[key]);
    });
  }
});

// The "invalidation crossbar" is a specific instance used by the DDP server to
// implement write fence notifications. Listener callbacks on this crossbar
// should call beginWrite on the current write fence before they return, if they
// want to delay the write fence from firing (ie, the DDP method-data-updated
// message from being sent).
DDPServer._InvalidationCrossbar = new DDPServer._Crossbar({
  factName: "invalidation-crossbar-listeners"
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"server_convenience.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/server_convenience.js                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
if (process.env.DDP_DEFAULT_CONNECTION_URL) {
  __meteor_runtime_config__.DDP_DEFAULT_CONNECTION_URL = process.env.DDP_DEFAULT_CONNECTION_URL;
}
Meteor.server = new Server();
Meteor.refresh = async function (notification) {
  await DDPServer._InvalidationCrossbar.fire(notification);
};

// Proxy the public methods of Meteor.server so they can
// be called directly on Meteor.

['publish', 'isAsyncCall', 'methods', 'call', 'callAsync', 'apply', 'applyAsync', 'onConnection', 'onMessage'].forEach(function (name) {
  Meteor[name] = Meteor.server[name].bind(Meteor.server);
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"lodash.once":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/ddp-server/node_modules/lodash.once/package.json                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.once",
  "version": "4.1.1"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/ddp-server/node_modules/lodash.once/index.js                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.isempty":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/ddp-server/node_modules/lodash.isempty/package.json                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.isempty",
  "version": "4.4.0"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/ddp-server/node_modules/lodash.isempty/index.js                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.isstring":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/ddp-server/node_modules/lodash.isstring/package.json                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.isstring",
  "version": "4.0.1"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/ddp-server/node_modules/lodash.isstring/index.js                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.isobject":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/ddp-server/node_modules/lodash.isobject/package.json                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.isobject",
  "version": "3.0.2"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/ddp-server/node_modules/lodash.isobject/index.js                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      DDPServer: DDPServer
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/ddp-server/stream_server.js",
    "/node_modules/meteor/ddp-server/livedata_server.js",
    "/node_modules/meteor/ddp-server/writefence.js",
    "/node_modules/meteor/ddp-server/crossbar.js",
    "/node_modules/meteor/ddp-server/server_convenience.js"
  ]
}});

//# sourceURL=meteor://💻app/packages/ddp-server.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLXNlcnZlci9zdHJlYW1fc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtc2VydmVyL2xpdmVkYXRhX3NlcnZlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLXNlcnZlci93cml0ZWZlbmNlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtc2VydmVyL2Nyb3NzYmFyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtc2VydmVyL3NlcnZlcl9jb252ZW5pZW5jZS5qcyJdLCJuYW1lcyI6WyJvbmNlIiwibW9kdWxlIiwibGluayIsImRlZmF1bHQiLCJ2IiwiX19yZWlmeVdhaXRGb3JEZXBzX18iLCJ3ZWJzb2NrZXRFeHRlbnNpb25zIiwiZXh0ZW5zaW9ucyIsIndlYnNvY2tldENvbXByZXNzaW9uQ29uZmlnIiwicHJvY2VzcyIsImVudiIsIlNFUlZFUl9XRUJTT0NLRVRfQ09NUFJFU1NJT04iLCJKU09OIiwicGFyc2UiLCJwdXNoIiwiTnBtIiwicmVxdWlyZSIsImNvbmZpZ3VyZSIsInBhdGhQcmVmaXgiLCJfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fIiwiUk9PVF9VUkxfUEFUSF9QUkVGSVgiLCJTdHJlYW1TZXJ2ZXIiLCJzZWxmIiwicmVnaXN0cmF0aW9uX2NhbGxiYWNrcyIsIm9wZW5fc29ja2V0cyIsInByZWZpeCIsIlJvdXRlUG9saWN5IiwiZGVjbGFyZSIsInNvY2tqcyIsInNlcnZlck9wdGlvbnMiLCJsb2ciLCJoZWFydGJlYXRfZGVsYXkiLCJkaXNjb25uZWN0X2RlbGF5IiwiZGlzYWJsZV9jb3JzIiwiRElTQUJMRV9TT0NLSlNfQ09SUyIsImpzZXNzaW9uaWQiLCJVU0VfSlNFU1NJT05JRCIsIkRJU0FCTEVfV0VCU09DS0VUUyIsIndlYnNvY2tldCIsImZheWVfc2VydmVyX29wdGlvbnMiLCJzZXJ2ZXIiLCJjcmVhdGVTZXJ2ZXIiLCJXZWJBcHAiLCJodHRwU2VydmVyIiwicmVtb3ZlTGlzdGVuZXIiLCJfdGltZW91dEFkanVzdG1lbnRSZXF1ZXN0Q2FsbGJhY2siLCJpbnN0YWxsSGFuZGxlcnMiLCJhZGRMaXN0ZW5lciIsIl9yZWRpcmVjdFdlYnNvY2tldEVuZHBvaW50Iiwib24iLCJzb2NrZXQiLCJzZXRXZWJzb2NrZXRUaW1lb3V0IiwidGltZW91dCIsInByb3RvY29sIiwiX3Nlc3Npb24iLCJyZWN2IiwiY29ubmVjdGlvbiIsInNldFRpbWVvdXQiLCJzZW5kIiwiZGF0YSIsIndyaXRlIiwiZmlsdGVyIiwidmFsdWUiLCJURVNUX01FVEFEQVRBIiwic3RyaW5naWZ5IiwidGVzdE1lc3NhZ2VPbkNvbm5lY3QiLCJmb3JFYWNoIiwiY2FsbGJhY2siLCJPYmplY3QiLCJhc3NpZ24iLCJwcm90b3R5cGUiLCJyZWdpc3RlciIsImFsbF9zb2NrZXRzIiwidmFsdWVzIiwiZXZlbnQiLCJvbGRIdHRwU2VydmVyTGlzdGVuZXJzIiwibGlzdGVuZXJzIiwic2xpY2UiLCJyZW1vdmVBbGxMaXN0ZW5lcnMiLCJuZXdMaXN0ZW5lciIsInJlcXVlc3QiLCJhcmdzIiwiYXJndW1lbnRzIiwidXJsIiwicGFyc2VkVXJsIiwicGF0aG5hbWUiLCJmb3JtYXQiLCJvbGRMaXN0ZW5lciIsImFwcGx5IiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwiYXN5bmMiLCJfb2JqZWN0U3ByZWFkIiwiaXNFbXB0eSIsImlzU3RyaW5nIiwiaXNPYmplY3QiLCJERFBTZXJ2ZXIiLCJwdWJsaWNhdGlvblN0cmF0ZWdpZXMiLCJTRVJWRVJfTUVSR0UiLCJ1c2VEdW1teURvY3VtZW50VmlldyIsInVzZUNvbGxlY3Rpb25WaWV3IiwiZG9BY2NvdW50aW5nRm9yQ29sbGVjdGlvbiIsIk5PX01FUkdFX05PX0hJU1RPUlkiLCJOT19NRVJHRSIsIk5PX01FUkdFX01VTFRJIiwiRHVtbXlEb2N1bWVudFZpZXciLCJleGlzdHNJbiIsIlNldCIsImRhdGFCeUtleSIsIk1hcCIsImdldEZpZWxkcyIsImNsZWFyRmllbGQiLCJzdWJzY3JpcHRpb25IYW5kbGUiLCJrZXkiLCJjaGFuZ2VDb2xsZWN0b3IiLCJ1bmRlZmluZWQiLCJjaGFuZ2VGaWVsZCIsImlzQWRkIiwiU2Vzc2lvbkRvY3VtZW50VmlldyIsIl9TZXNzaW9uRG9jdW1lbnRWaWV3IiwiX2dldEN1cnJlbnRGZW5jZSIsImN1cnJlbnRJbnZvY2F0aW9uIiwiX0N1cnJlbnRXcml0ZUZlbmNlIiwiZ2V0IiwiRERQIiwiX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uIiwiZmVuY2UiLCJyZXQiLCJwcmVjZWRlbmNlTGlzdCIsInJlbW92ZWRWYWx1ZSIsImkiLCJsZW5ndGgiLCJwcmVjZWRlbmNlIiwic3BsaWNlIiwiZGVsZXRlIiwiRUpTT04iLCJlcXVhbHMiLCJjbG9uZSIsImhhcyIsInNldCIsImVsdCIsImZpbmQiLCJTZXNzaW9uQ29sbGVjdGlvblZpZXciLCJjb2xsZWN0aW9uTmFtZSIsInNlc3Npb25DYWxsYmFja3MiLCJkb2N1bWVudHMiLCJjYWxsYmFja3MiLCJfU2Vzc2lvbkNvbGxlY3Rpb25WaWV3Iiwic2l6ZSIsImRpZmYiLCJwcmV2aW91cyIsIkRpZmZTZXF1ZW5jZSIsImRpZmZNYXBzIiwiYm90aCIsImRpZmZEb2N1bWVudCIsImJpbmQiLCJyaWdodE9ubHkiLCJpZCIsIm5vd0RWIiwiYWRkZWQiLCJsZWZ0T25seSIsInByZXZEViIsInJlbW92ZWQiLCJmaWVsZHMiLCJkaWZmT2JqZWN0cyIsInByZXYiLCJub3ciLCJjaGFuZ2VkIiwiZG9jVmlldyIsIk1ldGVvciIsImdldFB1YmxpY2F0aW9uU3RyYXRlZ3kiLCJhZGQiLCJlbnRyaWVzIiwiX3JlZiIsImNoYW5nZWRSZXN1bHQiLCJFcnJvciIsIl9yZWYyIiwiZXJyIiwiU2Vzc2lvbiIsInZlcnNpb24iLCJvcHRpb25zIiwiUmFuZG9tIiwiaW5pdGlhbGl6ZWQiLCJpblF1ZXVlIiwiX0RvdWJsZUVuZGVkUXVldWUiLCJibG9ja2VkIiwid29ya2VyUnVubmluZyIsImNhY2hlZFVuYmxvY2siLCJfbmFtZWRTdWJzIiwiX3VuaXZlcnNhbFN1YnMiLCJ1c2VySWQiLCJjb2xsZWN0aW9uVmlld3MiLCJfaXNTZW5kaW5nIiwiX2RvbnRTdGFydE5ld1VuaXZlcnNhbFN1YnMiLCJfcGVuZGluZ1JlYWR5IiwiX2Nsb3NlQ2FsbGJhY2tzIiwiX3NvY2tldFVybCIsIl9yZXNwb25kVG9QaW5ncyIsInJlc3BvbmRUb1BpbmdzIiwiY29ubmVjdGlvbkhhbmRsZSIsImNsb3NlIiwib25DbG9zZSIsImZuIiwiY2IiLCJiaW5kRW52aXJvbm1lbnQiLCJkZWZlciIsImNsaWVudEFkZHJlc3MiLCJfY2xpZW50QWRkcmVzcyIsImh0dHBIZWFkZXJzIiwiaGVhZGVycyIsIm1zZyIsInNlc3Npb24iLCJzdGFydFVuaXZlcnNhbFN1YnMiLCJoZWFydGJlYXRJbnRlcnZhbCIsImhlYXJ0YmVhdCIsIkREUENvbW1vbiIsIkhlYXJ0YmVhdCIsImhlYXJ0YmVhdFRpbWVvdXQiLCJvblRpbWVvdXQiLCJzZW5kUGluZyIsInN0YXJ0IiwiUGFja2FnZSIsIkZhY3RzIiwiaW5jcmVtZW50U2VydmVyRmFjdCIsInNlbmRSZWFkeSIsInN1YnNjcmlwdGlvbklkcyIsInN1YnMiLCJzdWJzY3JpcHRpb25JZCIsIl9jYW5TZW5kIiwic2VuZEFkZGVkIiwiY29sbGVjdGlvbiIsInNlbmRDaGFuZ2VkIiwic2VuZFJlbW92ZWQiLCJnZXRTZW5kQ2FsbGJhY2tzIiwiZ2V0Q29sbGVjdGlvblZpZXciLCJ2aWV3IiwiaGFuZGxlcnMiLCJ1bml2ZXJzYWxfcHVibGlzaF9oYW5kbGVycyIsImhhbmRsZXIiLCJfc3RhcnRTdWJzY3JpcHRpb24iLCJzdG9wIiwiX21ldGVvclNlc3Npb24iLCJfZGVhY3RpdmF0ZUFsbFN1YnNjcmlwdGlvbnMiLCJfcmVtb3ZlU2Vzc2lvbiIsIl9wcmludFNlbnRERFAiLCJfZGVidWciLCJzdHJpbmdpZnlERFAiLCJzZW5kRXJyb3IiLCJyZWFzb24iLCJvZmZlbmRpbmdNZXNzYWdlIiwicHJvY2Vzc01lc3NhZ2UiLCJtc2dfaW4iLCJtZXNzYWdlUmVjZWl2ZWQiLCJwcm9jZXNzTmV4dCIsInNoaWZ0IiwicnVuSGFuZGxlcnMiLCJ1bmJsb2NrIiwib25NZXNzYWdlSG9vayIsImVhY2giLCJwcm90b2NvbF9oYW5kbGVycyIsInJlc3VsdCIsImNhbGwiLCJfaXNQcm9taXNlIiwiZmluYWxseSIsInN1YiIsIm5hbWUiLCJwYXJhbXMiLCJBcnJheSIsInB1Ymxpc2hfaGFuZGxlcnMiLCJlcnJvciIsImNvbmNhdCIsIkREUFJhdGVMaW1pdGVyIiwicmF0ZUxpbWl0ZXJJbnB1dCIsInR5cGUiLCJjb25uZWN0aW9uSWQiLCJfaW5jcmVtZW50IiwicmF0ZUxpbWl0UmVzdWx0IiwiX2NoZWNrIiwiYWxsb3dlZCIsImdldEVycm9yTWVzc2FnZSIsInRpbWVUb1Jlc2V0IiwidW5zdWIiLCJfc3RvcFN1YnNjcmlwdGlvbiIsIm1ldGhvZCIsInJhbmRvbVNlZWQiLCJfV3JpdGVGZW5jZSIsIm9uQWxsQ29tbWl0dGVkIiwicmV0aXJlIiwibWV0aG9kcyIsIm1ldGhvZF9oYW5kbGVycyIsImFybSIsImludm9jYXRpb24iLCJNZXRob2RJbnZvY2F0aW9uIiwiaXNTaW11bGF0aW9uIiwic2V0VXNlcklkIiwiX3NldFVzZXJJZCIsInByb21pc2UiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsIndpdGhWYWx1ZSIsIm1heWJlQXVkaXRBcmd1bWVudENoZWNrcyIsImZpbmlzaCIsInBheWxvYWQiLCJ0aGVuIiwiZXhjZXB0aW9uIiwid3JhcEludGVybmFsRXhjZXB0aW9uIiwiX2VhY2hTdWIiLCJmIiwiX2RpZmZDb2xsZWN0aW9uVmlld3MiLCJiZWZvcmVDVnMiLCJsZWZ0VmFsdWUiLCJyaWdodFZhbHVlIiwiZG9jIiwiX2RlYWN0aXZhdGUiLCJvbGROYW1lZFN1YnMiLCJhbGwiLCJtYXAiLCJfcmVmMyIsIm5ld1N1YiIsIl9yZWNyZWF0ZSIsIl9ydW5IYW5kbGVyIiwiX25vWWllbGRzQWxsb3dlZCIsInN1YklkIiwiU3Vic2NyaXB0aW9uIiwidW5ibG9ja0hhbmRlciIsInN1Yk5hbWUiLCJtYXliZVN1YiIsIl9uYW1lIiwiX3JlbW92ZUFsbERvY3VtZW50cyIsInJlc3BvbnNlIiwiaHR0cEZvcndhcmRlZENvdW50IiwicGFyc2VJbnQiLCJyZW1vdGVBZGRyZXNzIiwiZm9yd2FyZGVkRm9yIiwidHJpbSIsInNwbGl0IiwiX2hhbmRsZXIiLCJfc3Vic2NyaXB0aW9uSWQiLCJfcGFyYW1zIiwiX3N1YnNjcmlwdGlvbkhhbmRsZSIsIl9kZWFjdGl2YXRlZCIsIl9zdG9wQ2FsbGJhY2tzIiwiX2RvY3VtZW50cyIsIl9yZWFkeSIsIl9pZEZpbHRlciIsImlkU3RyaW5naWZ5IiwiTW9uZ29JRCIsImlkUGFyc2UiLCJyZXN1bHRPclRoZW5hYmxlIiwiX0N1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24iLCJlIiwiX2lzRGVhY3RpdmF0ZWQiLCJpc1RoZW5hYmxlIiwiX3B1Ymxpc2hIYW5kbGVyUmVzdWx0IiwicmVzIiwiaXNDdXJzb3IiLCJjIiwiX3B1Ymxpc2hDdXJzb3IiLCJyZWFkeSIsImlzQXJyYXkiLCJldmVyeSIsImNvbGxlY3Rpb25OYW1lcyIsIl9nZXRDb2xsZWN0aW9uTmFtZSIsImN1ciIsIl9jYWxsU3RvcENhbGxiYWNrcyIsImNvbGxlY3Rpb25Eb2NzIiwic3RySWQiLCJvblN0b3AiLCJpZHMiLCJTZXJ2ZXIiLCJkZWZhdWx0UHVibGljYXRpb25TdHJhdGVneSIsIm9uQ29ubmVjdGlvbkhvb2siLCJIb29rIiwiZGVidWdQcmludEV4Y2VwdGlvbnMiLCJfcHVibGljYXRpb25TdHJhdGVnaWVzIiwic2Vzc2lvbnMiLCJzdHJlYW1fc2VydmVyIiwicmF3X21zZyIsIl9wcmludFJlY2VpdmVkRERQIiwicGFyc2VERFAiLCJfaGFuZGxlQ29ubmVjdCIsIm9uQ29ubmVjdGlvbiIsInNldFB1YmxpY2F0aW9uU3RyYXRlZ3kiLCJwdWJsaWNhdGlvbk5hbWUiLCJzdHJhdGVneSIsImluY2x1ZGVzIiwib25NZXNzYWdlIiwic3VwcG9ydCIsIlNVUFBPUlRFRF9ERFBfVkVSU0lPTlMiLCJjYWxjdWxhdGVWZXJzaW9uIiwicHVibGlzaCIsImF1dG9wdWJsaXNoIiwiaXNfYXV0byIsIndhcm5lZF9hYm91dF9hdXRvcHVibGlzaCIsIl9yZWY0IiwiaXNBc3luY0NhbGwiLCJfaXNDYWxsQXN5bmNNZXRob2RSdW5uaW5nIiwiX3JlZjUiLCJmdW5jIiwiX2xlbiIsIl9rZXkiLCJwb3AiLCJjYWxsQXN5bmMiLCJfYXJncyQiLCJfbGVuMiIsIl9rZXkyIiwiaGFzT3duUHJvcGVydHkiLCJfc2V0Q2FsbEFzeW5jTWV0aG9kUnVubmluZyIsIl9DdXJyZW50Q2FsbEFzeW5jSW52b2NhdGlvbiIsIl9zZXQiLCJoYXNDYWxsQXN5bmNQYXJlbnQiLCJhcHBseUFzeW5jIiwiaXNGcm9tQ2FsbEFzeW5jIiwiY2F0Y2giLCJjdXJyZW50TWV0aG9kSW52b2NhdGlvbiIsImN1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24iLCJtYWtlUnBjU2VlZCIsInIiLCJfdXJsRm9yU2Vzc2lvbiIsInNlc3Npb25JZCIsImNsaWVudFN1cHBvcnRlZFZlcnNpb25zIiwic2VydmVyU3VwcG9ydGVkVmVyc2lvbnMiLCJjb3JyZWN0VmVyc2lvbiIsIl9jYWxjdWxhdGVWZXJzaW9uIiwiY29udGV4dCIsImlzQ2xpZW50U2FmZSIsIm9yaWdpbmFsTWVzc2FnZSIsIm1lc3NhZ2UiLCJkZXRhaWxzIiwiX2V4cGVjdGVkQnlUZXN0Iiwic3RhY2siLCJzYW5pdGl6ZWRFcnJvciIsImRlc2NyaXB0aW9uIiwiTWF0Y2giLCJfZmFpbElmQXJndW1lbnRzQXJlTm90QWxsQ2hlY2tlZCIsImNvbnN0cnVjdG9yIiwiYXJtZWQiLCJmaXJlZCIsInJldGlyZWQiLCJvdXRzdGFuZGluZ193cml0ZXMiLCJiZWZvcmVfZmlyZV9jYWxsYmFja3MiLCJjb21wbGV0aW9uX2NhbGxiYWNrcyIsImJlZ2luV3JpdGUiLCJjb21taXR0ZWQiLCJfY29tbWl0dGVkRm4iLCJfbWF5YmVGaXJlIiwib25CZWZvcmVGaXJlIiwiX2FybUFuZFdhaXQiLCJyZXNvbHZlciIsInJldHVyblZhbHVlIiwiYXJtQW5kV2FpdCIsImludm9rZUNhbGxiYWNrIiwiRW52aXJvbm1lbnRWYXJpYWJsZSIsIl9Dcm9zc2JhciIsIm5leHRJZCIsImxpc3RlbmVyc0J5Q29sbGVjdGlvbiIsImxpc3RlbmVyc0J5Q29sbGVjdGlvbkNvdW50IiwiZmFjdFBhY2thZ2UiLCJmYWN0TmFtZSIsIl9jb2xsZWN0aW9uRm9yTWVzc2FnZSIsImxpc3RlbiIsInRyaWdnZXIiLCJyZWNvcmQiLCJmaXJlIiwibm90aWZpY2F0aW9uIiwibGlzdGVuZXJzRm9yQ29sbGVjdGlvbiIsImNhbGxiYWNrSWRzIiwibCIsIl9tYXRjaGVzIiwiT2JqZWN0SUQiLCJrZXlzIiwiX0ludmFsaWRhdGlvbkNyb3NzYmFyIiwiRERQX0RFRkFVTFRfQ09OTkVDVElPTl9VUkwiLCJyZWZyZXNoIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBQUEsSUFBSUEsSUFBSTtJQUFDQyxNQUFNLENBQUNDLElBQUksQ0FBQyxhQUFhLEVBQUM7TUFBQ0MsT0FBT0EsQ0FBQ0MsQ0FBQyxFQUFDO1FBQUNKLElBQUksR0FBQ0ksQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUFDLElBQUlDLG9CQUFvQixDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU1BLG9CQUFvQixDQUFDLENBQUMsRUFBRSxDQUFDO0lBRXZIO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxJQUFJQyxtQkFBbUIsR0FBR04sSUFBSSxDQUFDLFlBQVk7TUFDekMsSUFBSU8sVUFBVSxHQUFHLEVBQUU7TUFFbkIsSUFBSUMsMEJBQTBCLEdBQUdDLE9BQU8sQ0FBQ0MsR0FBRyxDQUFDQyw0QkFBNEIsR0FDakVDLElBQUksQ0FBQ0MsS0FBSyxDQUFDSixPQUFPLENBQUND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VSxPQUFPLENBQUM3VixHQUFHLENBQUMsRUFBRWdXLFlBQVksQ0FBQ2hXLEdBQUcsQ0FBQyxDQUFDO0lBQy9FLENBQUMsQ0FBQztFQUNMO0FBQ0YsQ0FBQyxDQUFDOztBQUVGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQWpCLFNBQVMsQ0FBQ3dYLHFCQUFxQixHQUFHLElBQUl4WCxTQUFTLENBQUNzVyxTQUFTLENBQUM7RUFDeERLLFFBQVEsRUFBRTtBQUNaLENBQUMsQ0FBQyxDOzs7Ozs7Ozs7OztBQ3JLRixJQUFJbGMsT0FBTyxDQUFDQyxHQUFHLENBQUMrYywwQkFBMEIsRUFBRTtFQUMxQ3RjLHlCQUF5QixDQUFDc2MsMEJBQTBCLEdBQ2xEaGQsT0FBTyxDQUFDQyxHQUFHLENBQUMrYywwQkFBMEI7QUFDMUM7QUFFQWhULE1BQU0sQ0FBQ2pJLE1BQU0sR0FBRyxJQUFJMFUsTUFBTSxDQUFDLENBQUM7QUFFNUJ6TSxNQUFNLENBQUNpVCxPQUFPLEdBQUcsZ0JBQWdCVCxZQUFZLEVBQUU7RUFDN0MsTUFBTWpYLFNBQVMsQ0FBQ3dYLHFCQUFxQixDQUFDUixJQUFJLENBQUNDLFlBQVksQ0FBQztBQUMxRCxDQUFDOztBQUVEO0FBQ0E7O0FBRUUsQ0FDRSxTQUFTLEVBQ1QsYUFBYSxFQUNiLFNBQVMsRUFDVCxNQUFNLEVBQ04sV0FBVyxFQUNYLE9BQU8sRUFDUCxZQUFZLEVBQ1osY0FBYyxFQUNkLFdBQVcsQ0FDWixDQUFDL1ksT0FBTyxDQUNULFVBQVN1TSxJQUFJLEVBQUU7RUFDYmhHLE1BQU0sQ0FBQ2dHLElBQUksQ0FBQyxHQUFHaEcsTUFBTSxDQUFDakksTUFBTSxDQUFDaU8sSUFBSSxDQUFDLENBQUM5RyxJQUFJLENBQUNjLE1BQU0sQ0FBQ2pJLE1BQU0sQ0FBQztBQUN4RCxDQUNGLENBQUMsQyIsImZpbGUiOiIvcGFja2FnZXMvZGRwLXNlcnZlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBvbmNlIGZyb20gJ2xvZGFzaC5vbmNlJztcblxuLy8gQnkgZGVmYXVsdCwgd2UgdXNlIHRoZSBwZXJtZXNzYWdlLWRlZmxhdGUgZXh0ZW5zaW9uIHdpdGggZGVmYXVsdFxuLy8gY29uZmlndXJhdGlvbi4gSWYgJFNFUlZFUl9XRUJTT0NLRVRfQ09NUFJFU1NJT04gaXMgc2V0LCB0aGVuIGl0IG11c3QgYmUgdmFsaWRcbi8vIEpTT04uIElmIGl0IHJlcHJlc2VudHMgYSBmYWxzZXkgdmFsdWUsIHRoZW4gd2UgZG8gbm90IHVzZSBwZXJtZXNzYWdlLWRlZmxhdGVcbi8vIGF0IGFsbDsgb3RoZXJ3aXNlLCB0aGUgSlNPTiB2YWx1ZSBpcyB1c2VkIGFzIGFuIGFyZ3VtZW50IHRvIGRlZmxhdGUnc1xuLy8gY29uZmlndXJlIG1ldGhvZDsgc2VlXG4vLyBodHRwczovL2dpdGh1Yi5jb20vZmF5ZS9wZXJtZXNzYWdlLWRlZmxhdGUtbm9kZS9ibG9iL21hc3Rlci9SRUFETUUubWRcbi8vXG4vLyAoV2UgZG8gdGhpcyBpbiBhbiBfLm9uY2UgaW5zdGVhZCBvZiBhdCBzdGFydHVwLCBiZWNhdXNlIHdlIGRvbid0IHdhbnQgdG9cbi8vIGNyYXNoIHRoZSB0b29sIGR1cmluZyBpc29wYWNrZXQgbG9hZCBpZiB5b3VyIEpTT04gZG9lc24ndCBwYXJzZS4gVGhpcyBpcyBvbmx5XG4vLyBhIHByb2JsZW0gYmVjYXVzZSB0aGUgdG9vbCBoYXMgdG8gbG9hZCB0aGUgRERQIHNlcnZlciBjb2RlIGp1c3QgaW4gb3JkZXIgdG9cbi8vIGJlIGEgRERQIGNsaWVudDsgc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL2lzc3Vlcy8zNDUyIC4pXG52YXIgd2Vic29ja2V0RXh0ZW5zaW9ucyA9IG9uY2UoZnVuY3Rpb24gKCkge1xuICB2YXIgZXh0ZW5zaW9ucyA9IFtdO1xuXG4gIHZhciB3ZWJzb2NrZXRDb21wcmVzc2lvbkNvbmZpZyA9IHByb2Nlc3MuZW52LlNFUlZFUl9XRUJTT0NLRVRfQ09NUFJFU1NJT05cbiAgICAgICAgPyBKU09OLnBhcnNlKHByb2Nlc3MuZW52LlNFUlZFUl9XRUJTT0NLRVRfQ09NUFJFU1NJT04pIDoge307XG4gIGlmICh3ZWJzb2NrZXRDb21wcmVzc2lvbkNvbmZpZykge1xuICAgIGV4dGVuc2lvbnMucHVzaChOcG0ucmVxdWlyZSgncGVybWVzc2FnZS1kZWZsYXRlJykuY29uZmlndXJlKFxuICAgICAgd2Vic29ja2V0Q29tcHJlc3Npb25Db25maWdcbiAgICApKTtcbiAgfVxuXG4gIHJldHVybiBleHRlbnNpb25zO1xufSk7XG5cbnZhciBwYXRoUHJlZml4ID0gX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5ST09UX1VSTF9QQVRIX1BSRUZJWCB8fCAgXCJcIjtcblxuU3RyZWFtU2VydmVyID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYucmVnaXN0cmF0aW9uX2NhbGxiYWNrcyA9IFtdO1xuICBzZWxmLm9wZW5fc29ja2V0cyA9IFtdO1xuXG4gIC8vIEJlY2F1c2Ugd2UgYXJlIGluc3RhbGxpbmcgZGlyZWN0bHkgb250byBXZWJBcHAuaHR0cFNlcnZlciBpbnN0ZWFkIG9mIHVzaW5nXG4gIC8vIFdlYkFwcC5hcHAsIHdlIGhhdmUgdG8gcHJvY2VzcyB0aGUgcGF0aCBwcmVmaXggb3Vyc2VsdmVzLlxuICBzZWxmLnByZWZpeCA9IHBhdGhQcmVmaXggKyAnL3NvY2tqcyc7XG4gIFJvdXRlUG9saWN5LmRlY2xhcmUoc2VsZi5wcmVmaXggKyAnLycsICduZXR3b3JrJyk7XG5cbiAgLy8gc2V0IHVwIHNvY2tqc1xuICB2YXIgc29ja2pzID0gTnBtLnJlcXVpcmUoJ3NvY2tqcycpO1xuICB2YXIgc2VydmVyT3B0aW9ucyA9IHtcbiAgICBwcmVmaXg6IHNlbGYucHJlZml4LFxuICAgIGxvZzogZnVuY3Rpb24oKSB7fSxcbiAgICAvLyB0aGlzIGlzIHRoZSBkZWZhdWx0LCBidXQgd2UgY29kZSBpdCBleHBsaWNpdGx5IGJlY2F1c2Ugd2UgZGVwZW5kXG4gICAgLy8gb24gaXQgaW4gc3RyZWFtX2NsaWVudDpIRUFSVEJFQVRfVElNRU9VVFxuICAgIGhlYXJ0YmVhdF9kZWxheTogNDUwMDAsXG4gICAgLy8gVGhlIGRlZmF1bHQgZGlzY29ubmVjdF9kZWxheSBpcyA1IHNlY29uZHMsIGJ1dCBpZiB0aGUgc2VydmVyIGVuZHMgdXAgQ1BVXG4gICAgLy8gYm91bmQgZm9yIHRoYXQgbXVjaCB0aW1lLCBTb2NrSlMgbWlnaHQgbm90IG5vdGljZSB0aGF0IHRoZSB1c2VyIGhhc1xuICAgIC8vIHJlY29ubmVjdGVkIGJlY2F1c2UgdGhlIHRpbWVyIChvZiBkaXNjb25uZWN0X2RlbGF5IG1zKSBjYW4gZmlyZSBiZWZvcmVcbiAgICAvLyBTb2NrSlMgcHJvY2Vzc2VzIHRoZSBuZXcgY29ubmVjdGlvbi4gRXZlbnR1YWxseSB3ZSdsbCBmaXggdGhpcyBieSBub3RcbiAgICAvLyBjb21iaW5pbmcgQ1BVLWhlYXZ5IHByb2Nlc3Npbmcgd2l0aCBTb2NrSlMgdGVybWluYXRpb24gKGVnIGEgcHJveHkgd2hpY2hcbiAgICAvLyBjb252ZXJ0cyB0byBVbml4IHNvY2tldHMpIGJ1dCBmb3Igbm93LCByYWlzZSB0aGUgZGVsYXkuXG4gICAgZGlzY29ubmVjdF9kZWxheTogNjAgKiAxMDAwLFxuICAgIC8vIEFsbG93IGRpc2FibGluZyBvZiBDT1JTIHJlcXVlc3RzIHRvIGFkZHJlc3NcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9pc3N1ZXMvODMxNy5cbiAgICBkaXNhYmxlX2NvcnM6ICEhcHJvY2Vzcy5lbnYuRElTQUJMRV9TT0NLSlNfQ09SUyxcbiAgICAvLyBTZXQgdGhlIFVTRV9KU0VTU0lPTklEIGVudmlyb25tZW50IHZhcmlhYmxlIHRvIGVuYWJsZSBzZXR0aW5nIHRoZVxuICAgIC8vIEpTRVNTSU9OSUQgY29va2llLiBUaGlzIGlzIHVzZWZ1bCBmb3Igc2V0dGluZyB1cCBwcm94aWVzIHdpdGhcbiAgICAvLyBzZXNzaW9uIGFmZmluaXR5LlxuICAgIGpzZXNzaW9uaWQ6ICEhcHJvY2Vzcy5lbnYuVVNFX0pTRVNTSU9OSURcbiAgfTtcblxuICAvLyBJZiB5b3Uga25vdyB5b3VyIHNlcnZlciBlbnZpcm9ubWVudCAoZWcsIHByb3hpZXMpIHdpbGwgcHJldmVudCB3ZWJzb2NrZXRzXG4gIC8vIGZyb20gZXZlciB3b3JraW5nLCBzZXQgJERJU0FCTEVfV0VCU09DS0VUUyBhbmQgU29ja0pTIGNsaWVudHMgKGllLFxuICAvLyBicm93c2Vycykgd2lsbCBub3Qgd2FzdGUgdGltZSBhdHRlbXB0aW5nIHRvIHVzZSB0aGVtLlxuICAvLyAoWW91ciBzZXJ2ZXIgd2lsbCBzdGlsbCBoYXZlIGEgL3dlYnNvY2tldCBlbmRwb2ludC4pXG4gIGlmIChwcm9jZXNzLmVudi5ESVNBQkxFX1dFQlNPQ0tFVFMpIHtcbiAgICBzZXJ2ZXJPcHRpb25zLndlYnNvY2tldCA9IGZhbHNlO1xuICB9IGVsc2Uge1xuICAgIHNlcnZlck9wdGlvbnMuZmF5ZV9zZXJ2ZXJfb3B0aW9ucyA9IHtcbiAgICAgIGV4dGVuc2lvbnM6IHdlYnNvY2tldEV4dGVuc2lvbnMoKVxuICAgIH07XG4gIH1cblxuICBzZWxmLnNlcnZlciA9IHNvY2tqcy5jcmVhdGVTZXJ2ZXIoc2VydmVyT3B0aW9ucyk7XG5cbiAgLy8gSW5zdGFsbCB0aGUgc29ja2pzIGhhbmRsZXJzLCBidXQgd2Ugd2FudCB0byBrZWVwIGFyb3VuZCBvdXIgb3duIHBhcnRpY3VsYXJcbiAgLy8gcmVxdWVzdCBoYW5kbGVyIHRoYXQgYWRqdXN0cyBpZGxlIHRpbWVvdXRzIHdoaWxlIHdlIGhhdmUgYW4gb3V0c3RhbmRpbmdcbiAgLy8gcmVxdWVzdC4gIFRoaXMgY29tcGVuc2F0ZXMgZm9yIHRoZSBmYWN0IHRoYXQgc29ja2pzIHJlbW92ZXMgYWxsIGxpc3RlbmVyc1xuICAvLyBmb3IgXCJyZXF1ZXN0XCIgdG8gYWRkIGl0cyBvd24uXG4gIFdlYkFwcC5odHRwU2VydmVyLnJlbW92ZUxpc3RlbmVyKFxuICAgICdyZXF1ZXN0JywgV2ViQXBwLl90aW1lb3V0QWRqdXN0bWVudFJlcXVlc3RDYWxsYmFjayk7XG4gIHNlbGYuc2VydmVyLmluc3RhbGxIYW5kbGVycyhXZWJBcHAuaHR0cFNlcnZlcik7XG4gIFdlYkFwcC5odHRwU2VydmVyLmFkZExpc3RlbmVyKFxuICAgICdyZXF1ZXN0JywgV2ViQXBwLl90aW1lb3V0QWRqdXN0bWVudFJlcXVlc3RDYWxsYmFjayk7XG5cbiAgLy8gU3VwcG9ydCB0aGUgL3dlYnNvY2tldCBlbmRwb2ludFxuICBzZWxmLl9yZWRpcmVjdFdlYnNvY2tldEVuZHBvaW50KCk7XG5cbiAgc2VsZi5zZXJ2ZXIub24oJ2Nvbm5lY3Rpb24nLCBmdW5jdGlvbiAoc29ja2V0KSB7XG4gICAgLy8gc29ja2pzIHNvbWV0aW1lcyBwYXNzZXMgdXMgbnVsbCBpbnN0ZWFkIG9mIGEgc29ja2V0IG9iamVjdFxuICAgIC8vIHNvIHdlIG5lZWQgdG8gZ3VhcmQgYWdhaW5zdCB0aGF0LiBzZWU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3NvY2tqcy9zb2NranMtbm9kZS9pc3N1ZXMvMTIxXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3IvaXNzdWVzLzEwNDY4XG4gICAgaWYgKCFzb2NrZXQpIHJldHVybjtcblxuICAgIC8vIFdlIHdhbnQgdG8gbWFrZSBzdXJlIHRoYXQgaWYgYSBjbGllbnQgY29ubmVjdHMgdG8gdXMgYW5kIGRvZXMgdGhlIGluaXRpYWxcbiAgICAvLyBXZWJzb2NrZXQgaGFuZHNoYWtlIGJ1dCBuZXZlciBnZXRzIHRvIHRoZSBERFAgaGFuZHNoYWtlLCB0aGF0IHdlXG4gICAgLy8gZXZlbnR1YWxseSBraWxsIHRoZSBzb2NrZXQuICBPbmNlIHRoZSBERFAgaGFuZHNoYWtlIGhhcHBlbnMsIEREUFxuICAgIC8vIGhlYXJ0YmVhdGluZyB3aWxsIHdvcmsuIEFuZCBiZWZvcmUgdGhlIFdlYnNvY2tldCBoYW5kc2hha2UsIHRoZSB0aW1lb3V0c1xuICAgIC8vIHdlIHNldCBhdCB0aGUgc2VydmVyIGxldmVsIGluIHdlYmFwcF9zZXJ2ZXIuanMgd2lsbCB3b3JrLiBCdXRcbiAgICAvLyBmYXllLXdlYnNvY2tldCBjYWxscyBzZXRUaW1lb3V0KDApIG9uIGFueSBzb2NrZXQgaXQgdGFrZXMgb3Zlciwgc28gdGhlcmVcbiAgICAvLyBpcyBhbiBcImluIGJldHdlZW5cIiBzdGF0ZSB3aGVyZSB0aGlzIGRvZXNuJ3QgaGFwcGVuLiAgV2Ugd29yayBhcm91bmQgdGhpc1xuICAgIC8vIGJ5IGV4cGxpY2l0bHkgc2V0dGluZyB0aGUgc29ja2V0IHRpbWVvdXQgdG8gYSByZWxhdGl2ZWx5IGxhcmdlIHRpbWUgaGVyZSxcbiAgICAvLyBhbmQgc2V0dGluZyBpdCBiYWNrIHRvIHplcm8gd2hlbiB3ZSBzZXQgdXAgdGhlIGhlYXJ0YmVhdCBpblxuICAgIC8vIGxpdmVkYXRhX3NlcnZlci5qcy5cbiAgICBzb2NrZXQuc2V0V2Vic29ja2V0VGltZW91dCA9IGZ1bmN0aW9uICh0aW1lb3V0KSB7XG4gICAgICBpZiAoKHNvY2tldC5wcm90b2NvbCA9PT0gJ3dlYnNvY2tldCcgfHxcbiAgICAgICAgICAgc29ja2V0LnByb3RvY29sID09PSAnd2Vic29ja2V0LXJhdycpXG4gICAgICAgICAgJiYgc29ja2V0Ll9zZXNzaW9uLnJlY3YpIHtcbiAgICAgICAgc29ja2V0Ll9zZXNzaW9uLnJlY3YuY29ubmVjdGlvbi5zZXRUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgfVxuICAgIH07XG4gICAgc29ja2V0LnNldFdlYnNvY2tldFRpbWVvdXQoNDUgKiAxMDAwKTtcblxuICAgIHNvY2tldC5zZW5kID0gZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgIHNvY2tldC53cml0ZShkYXRhKTtcbiAgICB9O1xuICAgIHNvY2tldC5vbignY2xvc2UnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLm9wZW5fc29ja2V0cyA9IHNlbGYub3Blbl9zb2NrZXRzLmZpbHRlcihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWUgIT09IHNvY2tldDtcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHNlbGYub3Blbl9zb2NrZXRzLnB1c2goc29ja2V0KTtcblxuICAgIC8vIG9ubHkgdG8gc2VuZCBhIG1lc3NhZ2UgYWZ0ZXIgY29ubmVjdGlvbiBvbiB0ZXN0cywgdXNlZnVsIGZvclxuICAgIC8vIHNvY2tldC1zdHJlYW0tY2xpZW50L3NlcnZlci10ZXN0cy5qc1xuICAgIGlmIChwcm9jZXNzLmVudi5URVNUX01FVEFEQVRBICYmIHByb2Nlc3MuZW52LlRFU1RfTUVUQURBVEEgIT09IFwie31cIikge1xuICAgICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoeyB0ZXN0TWVzc2FnZU9uQ29ubmVjdDogdHJ1ZSB9KSk7XG4gICAgfVxuXG4gICAgLy8gY2FsbCBhbGwgb3VyIGNhbGxiYWNrcyB3aGVuIHdlIGdldCBhIG5ldyBzb2NrZXQuIHRoZXkgd2lsbCBkbyB0aGVcbiAgICAvLyB3b3JrIG9mIHNldHRpbmcgdXAgaGFuZGxlcnMgYW5kIHN1Y2ggZm9yIHNwZWNpZmljIG1lc3NhZ2VzLlxuICAgIHNlbGYucmVnaXN0cmF0aW9uX2NhbGxiYWNrcy5mb3JFYWNoKGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgY2FsbGJhY2soc29ja2V0KTtcbiAgICB9KTtcbiAgfSk7XG5cbn07XG5cbk9iamVjdC5hc3NpZ24oU3RyZWFtU2VydmVyLnByb3RvdHlwZSwge1xuICAvLyBjYWxsIG15IGNhbGxiYWNrIHdoZW4gYSBuZXcgc29ja2V0IGNvbm5lY3RzLlxuICAvLyBhbHNvIGNhbGwgaXQgZm9yIGFsbCBjdXJyZW50IGNvbm5lY3Rpb25zLlxuICByZWdpc3RlcjogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYucmVnaXN0cmF0aW9uX2NhbGxiYWNrcy5wdXNoKGNhbGxiYWNrKTtcbiAgICBzZWxmLmFsbF9zb2NrZXRzKCkuZm9yRWFjaChmdW5jdGlvbiAoc29ja2V0KSB7XG4gICAgICBjYWxsYmFjayhzb2NrZXQpO1xuICAgIH0pO1xuICB9LFxuXG4gIC8vIGdldCBhIGxpc3Qgb2YgYWxsIHNvY2tldHNcbiAgYWxsX3NvY2tldHM6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXMoc2VsZi5vcGVuX3NvY2tldHMpO1xuICB9LFxuXG4gIC8vIFJlZGlyZWN0IC93ZWJzb2NrZXQgdG8gL3NvY2tqcy93ZWJzb2NrZXQgaW4gb3JkZXIgdG8gbm90IGV4cG9zZVxuICAvLyBzb2NranMgdG8gY2xpZW50cyB0aGF0IHdhbnQgdG8gdXNlIHJhdyB3ZWJzb2NrZXRzXG4gIF9yZWRpcmVjdFdlYnNvY2tldEVuZHBvaW50OiBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgLy8gVW5mb3J0dW5hdGVseSB3ZSBjYW4ndCB1c2UgYSBjb25uZWN0IG1pZGRsZXdhcmUgaGVyZSBzaW5jZVxuICAgIC8vIHNvY2tqcyBpbnN0YWxscyBpdHNlbGYgcHJpb3IgdG8gYWxsIGV4aXN0aW5nIGxpc3RlbmVyc1xuICAgIC8vIChtZWFuaW5nIHByaW9yIHRvIGFueSBjb25uZWN0IG1pZGRsZXdhcmVzKSBzbyB3ZSBuZWVkIHRvIHRha2VcbiAgICAvLyBhbiBhcHByb2FjaCBzaW1pbGFyIHRvIG92ZXJzaGFkb3dMaXN0ZW5lcnMgaW5cbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vc29ja2pzL3NvY2tqcy1ub2RlL2Jsb2IvY2Y4MjBjNTVhZjZhOTk1M2UxNjU1ODU1NWEzMWRlY2VhNTU0ZjcwZS9zcmMvdXRpbHMuY29mZmVlXG4gICAgWydyZXF1ZXN0JywgJ3VwZ3JhZGUnXS5mb3JFYWNoKChldmVudCkgPT4ge1xuICAgICAgdmFyIGh0dHBTZXJ2ZXIgPSBXZWJBcHAuaHR0cFNlcnZlcjtcbiAgICAgIHZhciBvbGRIdHRwU2VydmVyTGlzdGVuZXJzID0gaHR0cFNlcnZlci5saXN0ZW5lcnMoZXZlbnQpLnNsaWNlKDApO1xuICAgICAgaHR0cFNlcnZlci5yZW1vdmVBbGxMaXN0ZW5lcnMoZXZlbnQpO1xuXG4gICAgICAvLyByZXF1ZXN0IGFuZCB1cGdyYWRlIGhhdmUgZGlmZmVyZW50IGFyZ3VtZW50cyBwYXNzZWQgYnV0XG4gICAgICAvLyB3ZSBvbmx5IGNhcmUgYWJvdXQgdGhlIGZpcnN0IG9uZSB3aGljaCBpcyBhbHdheXMgcmVxdWVzdFxuICAgICAgdmFyIG5ld0xpc3RlbmVyID0gZnVuY3Rpb24ocmVxdWVzdCAvKiwgbW9yZUFyZ3VtZW50cyAqLykge1xuICAgICAgICAvLyBTdG9yZSBhcmd1bWVudHMgZm9yIHVzZSB3aXRoaW4gdGhlIGNsb3N1cmUgYmVsb3dcbiAgICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG5cbiAgICAgICAgLy8gVE9ETyByZXBsYWNlIHdpdGggdXJsIHBhY2thZ2VcbiAgICAgICAgdmFyIHVybCA9IE5wbS5yZXF1aXJlKCd1cmwnKTtcblxuICAgICAgICAvLyBSZXdyaXRlIC93ZWJzb2NrZXQgYW5kIC93ZWJzb2NrZXQvIHVybHMgdG8gL3NvY2tqcy93ZWJzb2NrZXQgd2hpbGVcbiAgICAgICAgLy8gcHJlc2VydmluZyBxdWVyeSBzdHJpbmcuXG4gICAgICAgIHZhciBwYXJzZWRVcmwgPSB1cmwucGFyc2UocmVxdWVzdC51cmwpO1xuICAgICAgICBpZiAocGFyc2VkVXJsLnBhdGhuYW1lID09PSBwYXRoUHJlZml4ICsgJy93ZWJzb2NrZXQnIHx8XG4gICAgICAgICAgICBwYXJzZWRVcmwucGF0aG5hbWUgPT09IHBhdGhQcmVmaXggKyAnL3dlYnNvY2tldC8nKSB7XG4gICAgICAgICAgcGFyc2VkVXJsLnBhdGhuYW1lID0gc2VsZi5wcmVmaXggKyAnL3dlYnNvY2tldCc7XG4gICAgICAgICAgcmVxdWVzdC51cmwgPSB1cmwuZm9ybWF0KHBhcnNlZFVybCk7XG4gICAgICAgIH1cbiAgICAgICAgb2xkSHR0cFNlcnZlckxpc3RlbmVycy5mb3JFYWNoKGZ1bmN0aW9uKG9sZExpc3RlbmVyKSB7XG4gICAgICAgICAgb2xkTGlzdGVuZXIuYXBwbHkoaHR0cFNlcnZlciwgYXJncyk7XG4gICAgICAgIH0pO1xuICAgICAgfTtcbiAgICAgIGh0dHBTZXJ2ZXIuYWRkTGlzdGVuZXIoZXZlbnQsIG5ld0xpc3RlbmVyKTtcbiAgICB9KTtcbiAgfVxufSk7IiwiaW1wb3J0IGlzRW1wdHkgZnJvbSAnbG9kYXNoLmlzZW1wdHknO1xuaW1wb3J0IGlzU3RyaW5nIGZyb20gJ2xvZGFzaC5pc3N0cmluZyc7XG5pbXBvcnQgaXNPYmplY3QgZnJvbSAnbG9kYXNoLmlzb2JqZWN0JztcblxuRERQU2VydmVyID0ge307XG5cblxuLy8gUHVibGljYXRpb24gc3RyYXRlZ2llcyBkZWZpbmUgaG93IHdlIGhhbmRsZSBkYXRhIGZyb20gcHVibGlzaGVkIGN1cnNvcnMgYXQgdGhlIGNvbGxlY3Rpb24gbGV2ZWxcbi8vIFRoaXMgYWxsb3dzIHNvbWVvbmUgdG86XG4vLyAtIENob29zZSBhIHRyYWRlLW9mZiBiZXR3ZWVuIGNsaWVudC1zZXJ2ZXIgYmFuZHdpZHRoIGFuZCBzZXJ2ZXIgbWVtb3J5IHVzYWdlXG4vLyAtIEltcGxlbWVudCBzcGVjaWFsIChub24tbW9uZ28pIGNvbGxlY3Rpb25zIGxpa2Ugdm9sYXRpbGUgbWVzc2FnZSBxdWV1ZXNcbmNvbnN0IHB1YmxpY2F0aW9uU3RyYXRlZ2llcyA9IHtcbiAgLy8gU0VSVkVSX01FUkdFIGlzIHRoZSBkZWZhdWx0IHN0cmF0ZWd5LlxuICAvLyBXaGVuIHVzaW5nIHRoaXMgc3RyYXRlZ3ksIHRoZSBzZXJ2ZXIgbWFpbnRhaW5zIGEgY29weSBvZiBhbGwgZGF0YSBhIGNvbm5lY3Rpb24gaXMgc3Vic2NyaWJlZCB0by5cbiAgLy8gVGhpcyBhbGxvd3MgdXMgdG8gb25seSBzZW5kIGRlbHRhcyBvdmVyIG11bHRpcGxlIHB1YmxpY2F0aW9ucy5cbiAgU0VSVkVSX01FUkdFOiB7XG4gICAgdXNlRHVtbXlEb2N1bWVudFZpZXc6IGZhbHNlLFxuICAgIHVzZUNvbGxlY3Rpb25WaWV3OiB0cnVlLFxuICAgIGRvQWNjb3VudGluZ0ZvckNvbGxlY3Rpb246IHRydWUsXG4gIH0sXG4gIC8vIFRoZSBOT19NRVJHRV9OT19ISVNUT1JZIHN0cmF0ZWd5IHJlc3VsdHMgaW4gdGhlIHNlcnZlciBzZW5kaW5nIGFsbCBwdWJsaWNhdGlvbiBkYXRhXG4gIC8vIGRpcmVjdGx5IHRvIHRoZSBjbGllbnQuIEl0IGRvZXMgbm90IHJlbWVtYmVyIHdoYXQgaXQgaGFzIHByZXZpb3VzbHkgc2VudFxuICAvLyB0byBpdCB3aWxsIG5vdCB0cmlnZ2VyIHJlbW92ZWQgbWVzc2FnZXMgd2hlbiBhIHN1YnNjcmlwdGlvbiBpcyBzdG9wcGVkLlxuICAvLyBUaGlzIHNob3VsZCBvbmx5IGJlIGNob3NlbiBmb3Igc3BlY2lhbCB1c2UgY2FzZXMgbGlrZSBzZW5kLWFuZC1mb3JnZXQgcXVldWVzLlxuICBOT19NRVJHRV9OT19ISVNUT1JZOiB7XG4gICAgdXNlRHVtbXlEb2N1bWVudFZpZXc6IGZhbHNlLFxuICAgIHVzZUNvbGxlY3Rpb25WaWV3OiBmYWxzZSxcbiAgICBkb0FjY291bnRpbmdGb3JDb2xsZWN0aW9uOiBmYWxzZSxcbiAgfSxcbiAgLy8gTk9fTUVSR0UgaXMgc2ltaWxhciB0byBOT19NRVJHRV9OT19ISVNUT1JZIGJ1dCB0aGUgc2VydmVyIHdpbGwgcmVtZW1iZXIgdGhlIElEcyBpdCBoYXNcbiAgLy8gc2VudCB0byB0aGUgY2xpZW50IHNvIGl0IGNhbiByZW1vdmUgdGhlbSB3aGVuIGEgc3Vic2NyaXB0aW9uIGlzIHN0b3BwZWQuXG4gIC8vIFRoaXMgc3RyYXRlZ3kgY2FuIGJlIHVzZWQgd2hlbiBhIGNvbGxlY3Rpb24gaXMgb25seSB1c2VkIGluIGEgc2luZ2xlIHB1YmxpY2F0aW9uLlxuICBOT19NRVJHRToge1xuICAgIHVzZUR1bW15RG9jdW1lbnRWaWV3OiBmYWxzZSxcbiAgICB1c2VDb2xsZWN0aW9uVmlldzogZmFsc2UsXG4gICAgZG9BY2NvdW50aW5nRm9yQ29sbGVjdGlvbjogdHJ1ZSxcbiAgfSxcbiAgLy8gTk9fTUVSR0VfTVVMVEkgaXMgc2ltaWxhciB0byBgTk9fTUVSR0VgLCBidXQgaXQgZG9lcyB0cmFjayB3aGV0aGVyIGEgZG9jdW1lbnQgaXNcbiAgLy8gdXNlZCBieSBtdWx0aXBsZSBwdWJsaWNhdGlvbnMuIFRoaXMgaGFzIHNvbWUgbWVtb3J5IG92ZXJoZWFkLCBidXQgaXQgc3RpbGwgZG9lcyBub3QgZG9cbiAgLy8gZGlmZmluZyBzbyBpdCdzIGZhc3RlciBhbmQgc2xpbW1lciB0aGFuIFNFUlZFUl9NRVJHRS5cbiAgTk9fTUVSR0VfTVVMVEk6IHtcbiAgICB1c2VEdW1teURvY3VtZW50VmlldzogdHJ1ZSxcbiAgICB1c2VDb2xsZWN0aW9uVmlldzogdHJ1ZSxcbiAgICBkb0FjY291bnRpbmdGb3JDb2xsZWN0aW9uOiB0cnVlXG4gIH1cbn07XG5cbkREUFNlcnZlci5wdWJsaWNhdGlvblN0cmF0ZWdpZXMgPSBwdWJsaWNhdGlvblN0cmF0ZWdpZXM7XG5cbi8vIFRoaXMgZmlsZSBjb250YWlucyBjbGFzc2VzOlxuLy8gKiBTZXNzaW9uIC0gVGhlIHNlcnZlcidzIGNvbm5lY3Rpb24gdG8gYSBzaW5nbGUgRERQIGNsaWVudFxuLy8gKiBTdWJzY3JpcHRpb24gLSBBIHNpbmdsZSBzdWJzY3JpcHRpb24gZm9yIGEgc2luZ2xlIGNsaWVudFxuLy8gKiBTZXJ2ZXIgLSBBbiBlbnRpcmUgc2VydmVyIHRoYXQgbWF5IHRhbGsgdG8gPiAxIGNsaWVudC4gQSBERFAgZW5kcG9pbnQuXG4vL1xuLy8gU2Vzc2lvbiBhbmQgU3Vic2NyaXB0aW9uIGFyZSBmaWxlIHNjb3BlLiBGb3Igbm93LCB1bnRpbCB3ZSBmcmVlemVcbi8vIHRoZSBpbnRlcmZhY2UsIFNlcnZlciBpcyBwYWNrYWdlIHNjb3BlIChpbiB0aGUgZnV0dXJlIGl0IHNob3VsZCBiZVxuLy8gZXhwb3J0ZWQpLlxudmFyIER1bW15RG9jdW1lbnRWaWV3ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYuZXhpc3RzSW4gPSBuZXcgU2V0KCk7IC8vIHNldCBvZiBzdWJzY3JpcHRpb25IYW5kbGVcbiAgc2VsZi5kYXRhQnlLZXkgPSBuZXcgTWFwKCk7IC8vIGtleS0+IFsge3N1YnNjcmlwdGlvbkhhbmRsZSwgdmFsdWV9IGJ5IHByZWNlZGVuY2VdXG59O1xuXG5PYmplY3QuYXNzaWduKER1bW15RG9jdW1lbnRWaWV3LnByb3RvdHlwZSwge1xuICBnZXRGaWVsZHM6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4ge31cbiAgfSxcblxuICBjbGVhckZpZWxkOiBmdW5jdGlvbiAoc3Vic2NyaXB0aW9uSGFuZGxlLCBrZXksIGNoYW5nZUNvbGxlY3Rvcikge1xuICAgIGNoYW5nZUNvbGxlY3RvcltrZXldID0gdW5kZWZpbmVkXG4gIH0sXG5cbiAgY2hhbmdlRmllbGQ6IGZ1bmN0aW9uIChzdWJzY3JpcHRpb25IYW5kbGUsIGtleSwgdmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgY2hhbmdlQ29sbGVjdG9yLCBpc0FkZCkge1xuICAgIGNoYW5nZUNvbGxlY3RvcltrZXldID0gdmFsdWVcbiAgfVxufSk7XG5cbi8vIFJlcHJlc2VudHMgYSBzaW5nbGUgZG9jdW1lbnQgaW4gYSBTZXNzaW9uQ29sbGVjdGlvblZpZXdcbnZhciBTZXNzaW9uRG9jdW1lbnRWaWV3ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYuZXhpc3RzSW4gPSBuZXcgU2V0KCk7IC8vIHNldCBvZiBzdWJzY3JpcHRpb25IYW5kbGVcbiAgc2VsZi5kYXRhQnlLZXkgPSBuZXcgTWFwKCk7IC8vIGtleS0+IFsge3N1YnNjcmlwdGlvbkhhbmRsZSwgdmFsdWV9IGJ5IHByZWNlZGVuY2VdXG59O1xuXG5ERFBTZXJ2ZXIuX1Nlc3Npb25Eb2N1bWVudFZpZXcgPSBTZXNzaW9uRG9jdW1lbnRWaWV3O1xuXG5ERFBTZXJ2ZXIuX2dldEN1cnJlbnRGZW5jZSA9IGZ1bmN0aW9uICgpIHtcbiAgbGV0IGN1cnJlbnRJbnZvY2F0aW9uID0gdGhpcy5fQ3VycmVudFdyaXRlRmVuY2UuZ2V0KCk7XG4gIGlmIChjdXJyZW50SW52b2NhdGlvbikge1xuICAgIHJldHVybiBjdXJyZW50SW52b2NhdGlvbjtcbiAgfVxuICBjdXJyZW50SW52b2NhdGlvbiA9IEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uZ2V0KCk7XG4gIHJldHVybiBjdXJyZW50SW52b2NhdGlvbiA/IGN1cnJlbnRJbnZvY2F0aW9uLmZlbmNlIDogdW5kZWZpbmVkO1xufTtcblxuT2JqZWN0LmFzc2lnbihTZXNzaW9uRG9jdW1lbnRWaWV3LnByb3RvdHlwZSwge1xuXG4gIGdldEZpZWxkczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgcmV0ID0ge307XG4gICAgc2VsZi5kYXRhQnlLZXkuZm9yRWFjaChmdW5jdGlvbiAocHJlY2VkZW5jZUxpc3QsIGtleSkge1xuICAgICAgcmV0W2tleV0gPSBwcmVjZWRlbmNlTGlzdFswXS52YWx1ZTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmV0O1xuICB9LFxuXG4gIGNsZWFyRmllbGQ6IGZ1bmN0aW9uIChzdWJzY3JpcHRpb25IYW5kbGUsIGtleSwgY2hhbmdlQ29sbGVjdG9yKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIC8vIFB1Ymxpc2ggQVBJIGlnbm9yZXMgX2lkIGlmIHByZXNlbnQgaW4gZmllbGRzXG4gICAgaWYgKGtleSA9PT0gXCJfaWRcIilcbiAgICAgIHJldHVybjtcbiAgICB2YXIgcHJlY2VkZW5jZUxpc3QgPSBzZWxmLmRhdGFCeUtleS5nZXQoa2V5KTtcblxuICAgIC8vIEl0J3Mgb2theSB0byBjbGVhciBmaWVsZHMgdGhhdCBkaWRuJ3QgZXhpc3QuIE5vIG5lZWQgdG8gdGhyb3dcbiAgICAvLyBhbiBlcnJvci5cbiAgICBpZiAoIXByZWNlZGVuY2VMaXN0KVxuICAgICAgcmV0dXJuO1xuXG4gICAgdmFyIHJlbW92ZWRWYWx1ZSA9IHVuZGVmaW5lZDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHByZWNlZGVuY2VMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcHJlY2VkZW5jZSA9IHByZWNlZGVuY2VMaXN0W2ldO1xuICAgICAgaWYgKHByZWNlZGVuY2Uuc3Vic2NyaXB0aW9uSGFuZGxlID09PSBzdWJzY3JpcHRpb25IYW5kbGUpIHtcbiAgICAgICAgLy8gVGhlIHZpZXcncyB2YWx1ZSBjYW4gb25seSBjaGFuZ2UgaWYgdGhpcyBzdWJzY3JpcHRpb24gaXMgdGhlIG9uZSB0aGF0XG4gICAgICAgIC8vIHVzZWQgdG8gaGF2ZSBwcmVjZWRlbmNlLlxuICAgICAgICBpZiAoaSA9PT0gMClcbiAgICAgICAgICByZW1vdmVkVmFsdWUgPSBwcmVjZWRlbmNlLnZhbHVlO1xuICAgICAgICBwcmVjZWRlbmNlTGlzdC5zcGxpY2UoaSwgMSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAocHJlY2VkZW5jZUxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgICBzZWxmLmRhdGFCeUtleS5kZWxldGUoa2V5KTtcbiAgICAgIGNoYW5nZUNvbGxlY3RvcltrZXldID0gdW5kZWZpbmVkO1xuICAgIH0gZWxzZSBpZiAocmVtb3ZlZFZhbHVlICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgICAgICFFSlNPTi5lcXVhbHMocmVtb3ZlZFZhbHVlLCBwcmVjZWRlbmNlTGlzdFswXS52YWx1ZSkpIHtcbiAgICAgIGNoYW5nZUNvbGxlY3RvcltrZXldID0gcHJlY2VkZW5jZUxpc3RbMF0udmFsdWU7XG4gICAgfVxuICB9LFxuXG4gIGNoYW5nZUZpZWxkOiBmdW5jdGlvbiAoc3Vic2NyaXB0aW9uSGFuZGxlLCBrZXksIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZUNvbGxlY3RvciwgaXNBZGQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgLy8gUHVibGlzaCBBUEkgaWdub3JlcyBfaWQgaWYgcHJlc2VudCBpbiBmaWVsZHNcbiAgICBpZiAoa2V5ID09PSBcIl9pZFwiKVxuICAgICAgcmV0dXJuO1xuXG4gICAgLy8gRG9uJ3Qgc2hhcmUgc3RhdGUgd2l0aCB0aGUgZGF0YSBwYXNzZWQgaW4gYnkgdGhlIHVzZXIuXG4gICAgdmFsdWUgPSBFSlNPTi5jbG9uZSh2YWx1ZSk7XG5cbiAgICBpZiAoIXNlbGYuZGF0YUJ5S2V5LmhhcyhrZXkpKSB7XG4gICAgICBzZWxmLmRhdGFCeUtleS5zZXQoa2V5LCBbe3N1YnNjcmlwdGlvbkhhbmRsZTogc3Vic2NyaXB0aW9uSGFuZGxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWV9XSk7XG4gICAgICBjaGFuZ2VDb2xsZWN0b3Jba2V5XSA9IHZhbHVlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgcHJlY2VkZW5jZUxpc3QgPSBzZWxmLmRhdGFCeUtleS5nZXQoa2V5KTtcbiAgICB2YXIgZWx0O1xuICAgIGlmICghaXNBZGQpIHtcbiAgICAgIGVsdCA9IHByZWNlZGVuY2VMaXN0LmZpbmQoZnVuY3Rpb24gKHByZWNlZGVuY2UpIHtcbiAgICAgICAgICByZXR1cm4gcHJlY2VkZW5jZS5zdWJzY3JpcHRpb25IYW5kbGUgPT09IHN1YnNjcmlwdGlvbkhhbmRsZTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChlbHQpIHtcbiAgICAgIGlmIChlbHQgPT09IHByZWNlZGVuY2VMaXN0WzBdICYmICFFSlNPTi5lcXVhbHModmFsdWUsIGVsdC52YWx1ZSkpIHtcbiAgICAgICAgLy8gdGhpcyBzdWJzY3JpcHRpb24gaXMgY2hhbmdpbmcgdGhlIHZhbHVlIG9mIHRoaXMgZmllbGQuXG4gICAgICAgIGNoYW5nZUNvbGxlY3RvcltrZXldID0gdmFsdWU7XG4gICAgICB9XG4gICAgICBlbHQudmFsdWUgPSB2YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdGhpcyBzdWJzY3JpcHRpb24gaXMgbmV3bHkgY2FyaW5nIGFib3V0IHRoaXMgZmllbGRcbiAgICAgIHByZWNlZGVuY2VMaXN0LnB1c2goe3N1YnNjcmlwdGlvbkhhbmRsZTogc3Vic2NyaXB0aW9uSGFuZGxlLCB2YWx1ZTogdmFsdWV9KTtcbiAgICB9XG5cbiAgfVxufSk7XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIGNsaWVudCdzIHZpZXcgb2YgYSBzaW5nbGUgY29sbGVjdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IGNvbGxlY3Rpb25OYW1lIE5hbWUgb2YgdGhlIGNvbGxlY3Rpb24gaXQgcmVwcmVzZW50c1xuICogQHBhcmFtIHtPYmplY3QuPFN0cmluZywgRnVuY3Rpb24+fSBzZXNzaW9uQ2FsbGJhY2tzIFRoZSBjYWxsYmFja3MgZm9yIGFkZGVkLCBjaGFuZ2VkLCByZW1vdmVkXG4gKiBAY2xhc3MgU2Vzc2lvbkNvbGxlY3Rpb25WaWV3XG4gKi9cbnZhciBTZXNzaW9uQ29sbGVjdGlvblZpZXcgPSBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIHNlc3Npb25DYWxsYmFja3MpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLmNvbGxlY3Rpb25OYW1lID0gY29sbGVjdGlvbk5hbWU7XG4gIHNlbGYuZG9jdW1lbnRzID0gbmV3IE1hcCgpO1xuICBzZWxmLmNhbGxiYWNrcyA9IHNlc3Npb25DYWxsYmFja3M7XG59O1xuXG5ERFBTZXJ2ZXIuX1Nlc3Npb25Db2xsZWN0aW9uVmlldyA9IFNlc3Npb25Db2xsZWN0aW9uVmlldztcblxuXG5PYmplY3QuYXNzaWduKFNlc3Npb25Db2xsZWN0aW9uVmlldy5wcm90b3R5cGUsIHtcblxuICBpc0VtcHR5OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBzZWxmLmRvY3VtZW50cy5zaXplID09PSAwO1xuICB9LFxuXG4gIGRpZmY6IGZ1bmN0aW9uIChwcmV2aW91cykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBEaWZmU2VxdWVuY2UuZGlmZk1hcHMocHJldmlvdXMuZG9jdW1lbnRzLCBzZWxmLmRvY3VtZW50cywge1xuICAgICAgYm90aDogc2VsZi5kaWZmRG9jdW1lbnQuYmluZChzZWxmKSxcblxuICAgICAgcmlnaHRPbmx5OiBmdW5jdGlvbiAoaWQsIG5vd0RWKSB7XG4gICAgICAgIHNlbGYuY2FsbGJhY2tzLmFkZGVkKHNlbGYuY29sbGVjdGlvbk5hbWUsIGlkLCBub3dEVi5nZXRGaWVsZHMoKSk7XG4gICAgICB9LFxuXG4gICAgICBsZWZ0T25seTogZnVuY3Rpb24gKGlkLCBwcmV2RFYpIHtcbiAgICAgICAgc2VsZi5jYWxsYmFja3MucmVtb3ZlZChzZWxmLmNvbGxlY3Rpb25OYW1lLCBpZCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG5cbiAgZGlmZkRvY3VtZW50OiBmdW5jdGlvbiAoaWQsIHByZXZEViwgbm93RFYpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGZpZWxkcyA9IHt9O1xuICAgIERpZmZTZXF1ZW5jZS5kaWZmT2JqZWN0cyhwcmV2RFYuZ2V0RmllbGRzKCksIG5vd0RWLmdldEZpZWxkcygpLCB7XG4gICAgICBib3RoOiBmdW5jdGlvbiAoa2V5LCBwcmV2LCBub3cpIHtcbiAgICAgICAgaWYgKCFFSlNPTi5lcXVhbHMocHJldiwgbm93KSlcbiAgICAgICAgICBmaWVsZHNba2V5XSA9IG5vdztcbiAgICAgIH0sXG4gICAgICByaWdodE9ubHk6IGZ1bmN0aW9uIChrZXksIG5vdykge1xuICAgICAgICBmaWVsZHNba2V5XSA9IG5vdztcbiAgICAgIH0sXG4gICAgICBsZWZ0T25seTogZnVuY3Rpb24oa2V5LCBwcmV2KSB7XG4gICAgICAgIGZpZWxkc1trZXldID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHNlbGYuY2FsbGJhY2tzLmNoYW5nZWQoc2VsZi5jb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcyk7XG4gIH0sXG5cbiAgYWRkZWQ6IGZ1bmN0aW9uIChzdWJzY3JpcHRpb25IYW5kbGUsIGlkLCBmaWVsZHMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGRvY1ZpZXcgPSBzZWxmLmRvY3VtZW50cy5nZXQoaWQpO1xuICAgIHZhciBhZGRlZCA9IGZhbHNlO1xuICAgIGlmICghZG9jVmlldykge1xuICAgICAgYWRkZWQgPSB0cnVlO1xuICAgICAgaWYgKE1ldGVvci5zZXJ2ZXIuZ2V0UHVibGljYXRpb25TdHJhdGVneSh0aGlzLmNvbGxlY3Rpb25OYW1lKS51c2VEdW1teURvY3VtZW50Vmlldykge1xuICAgICAgICBkb2NWaWV3ID0gbmV3IER1bW15RG9jdW1lbnRWaWV3KCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkb2NWaWV3ID0gbmV3IFNlc3Npb25Eb2N1bWVudFZpZXcoKTtcbiAgICAgIH1cblxuICAgICAgc2VsZi5kb2N1bWVudHMuc2V0KGlkLCBkb2NWaWV3KTtcbiAgICB9XG4gICAgZG9jVmlldy5leGlzdHNJbi5hZGQoc3Vic2NyaXB0aW9uSGFuZGxlKTtcbiAgICB2YXIgY2hhbmdlQ29sbGVjdG9yID0ge307XG4gICAgT2JqZWN0LmVudHJpZXMoZmllbGRzKS5mb3JFYWNoKGZ1bmN0aW9uIChba2V5LCB2YWx1ZV0pIHtcbiAgICAgIGRvY1ZpZXcuY2hhbmdlRmllbGQoXG4gICAgICAgIHN1YnNjcmlwdGlvbkhhbmRsZSwga2V5LCB2YWx1ZSwgY2hhbmdlQ29sbGVjdG9yLCB0cnVlKTtcbiAgICB9KTtcbiAgICBpZiAoYWRkZWQpXG4gICAgICBzZWxmLmNhbGxiYWNrcy5hZGRlZChzZWxmLmNvbGxlY3Rpb25OYW1lLCBpZCwgY2hhbmdlQ29sbGVjdG9yKTtcbiAgICBlbHNlXG4gICAgICBzZWxmLmNhbGxiYWNrcy5jaGFuZ2VkKHNlbGYuY29sbGVjdGlvbk5hbWUsIGlkLCBjaGFuZ2VDb2xsZWN0b3IpO1xuICB9LFxuXG4gIGNoYW5nZWQ6IGZ1bmN0aW9uIChzdWJzY3JpcHRpb25IYW5kbGUsIGlkLCBjaGFuZ2VkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBjaGFuZ2VkUmVzdWx0ID0ge307XG4gICAgdmFyIGRvY1ZpZXcgPSBzZWxmLmRvY3VtZW50cy5nZXQoaWQpO1xuICAgIGlmICghZG9jVmlldylcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNvdWxkIG5vdCBmaW5kIGVsZW1lbnQgd2l0aCBpZCBcIiArIGlkICsgXCIgdG8gY2hhbmdlXCIpO1xuICAgICAgT2JqZWN0LmVudHJpZXMoY2hhbmdlZCkuZm9yRWFjaChmdW5jdGlvbiAoW2tleSwgdmFsdWVdKSB7XG4gICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZClcbiAgICAgICAgZG9jVmlldy5jbGVhckZpZWxkKHN1YnNjcmlwdGlvbkhhbmRsZSwga2V5LCBjaGFuZ2VkUmVzdWx0KTtcbiAgICAgIGVsc2VcbiAgICAgICAgZG9jVmlldy5jaGFuZ2VGaWVsZChzdWJzY3JpcHRpb25IYW5kbGUsIGtleSwgdmFsdWUsIGNoYW5nZWRSZXN1bHQpO1xuICAgIH0pO1xuICAgIHNlbGYuY2FsbGJhY2tzLmNoYW5nZWQoc2VsZi5jb2xsZWN0aW9uTmFtZSwgaWQsIGNoYW5nZWRSZXN1bHQpO1xuICB9LFxuXG4gIHJlbW92ZWQ6IGZ1bmN0aW9uIChzdWJzY3JpcHRpb25IYW5kbGUsIGlkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBkb2NWaWV3ID0gc2VsZi5kb2N1bWVudHMuZ2V0KGlkKTtcbiAgICBpZiAoIWRvY1ZpZXcpIHtcbiAgICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoXCJSZW1vdmVkIG5vbmV4aXN0ZW50IGRvY3VtZW50IFwiICsgaWQpO1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgICBkb2NWaWV3LmV4aXN0c0luLmRlbGV0ZShzdWJzY3JpcHRpb25IYW5kbGUpO1xuICAgIGlmIChkb2NWaWV3LmV4aXN0c0luLnNpemUgPT09IDApIHtcbiAgICAgIC8vIGl0IGlzIGdvbmUgZnJvbSBldmVyeW9uZVxuICAgICAgc2VsZi5jYWxsYmFja3MucmVtb3ZlZChzZWxmLmNvbGxlY3Rpb25OYW1lLCBpZCk7XG4gICAgICBzZWxmLmRvY3VtZW50cy5kZWxldGUoaWQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgY2hhbmdlZCA9IHt9O1xuICAgICAgLy8gcmVtb3ZlIHRoaXMgc3Vic2NyaXB0aW9uIGZyb20gZXZlcnkgcHJlY2VkZW5jZSBsaXN0XG4gICAgICAvLyBhbmQgcmVjb3JkIHRoZSBjaGFuZ2VzXG4gICAgICBkb2NWaWV3LmRhdGFCeUtleS5mb3JFYWNoKGZ1bmN0aW9uIChwcmVjZWRlbmNlTGlzdCwga2V5KSB7XG4gICAgICAgIGRvY1ZpZXcuY2xlYXJGaWVsZChzdWJzY3JpcHRpb25IYW5kbGUsIGtleSwgY2hhbmdlZCk7XG4gICAgICB9KTtcblxuICAgICAgc2VsZi5jYWxsYmFja3MuY2hhbmdlZChzZWxmLmNvbGxlY3Rpb25OYW1lLCBpZCwgY2hhbmdlZCk7XG4gICAgfVxuICB9XG59KTtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8qIFNlc3Npb24gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICovXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG52YXIgU2Vzc2lvbiA9IGZ1bmN0aW9uIChzZXJ2ZXIsIHZlcnNpb24sIHNvY2tldCwgb3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYuaWQgPSBSYW5kb20uaWQoKTtcblxuICBzZWxmLnNlcnZlciA9IHNlcnZlcjtcbiAgc2VsZi52ZXJzaW9uID0gdmVyc2lvbjtcblxuICBzZWxmLmluaXRpYWxpemVkID0gZmFsc2U7XG4gIHNlbGYuc29ja2V0ID0gc29ja2V0O1xuXG4gIC8vIFNldCB0byBudWxsIHdoZW4gdGhlIHNlc3Npb24gaXMgZGVzdHJveWVkLiBNdWx0aXBsZSBwbGFjZXMgYmVsb3dcbiAgLy8gdXNlIHRoaXMgdG8gZGV0ZXJtaW5lIGlmIHRoZSBzZXNzaW9uIGlzIGFsaXZlIG9yIG5vdC5cbiAgc2VsZi5pblF1ZXVlID0gbmV3IE1ldGVvci5fRG91YmxlRW5kZWRRdWV1ZSgpO1xuXG4gIHNlbGYuYmxvY2tlZCA9IGZhbHNlO1xuICBzZWxmLndvcmtlclJ1bm5pbmcgPSBmYWxzZTtcblxuICBzZWxmLmNhY2hlZFVuYmxvY2sgPSBudWxsO1xuXG4gIC8vIFN1YiBvYmplY3RzIGZvciBhY3RpdmUgc3Vic2NyaXB0aW9uc1xuICBzZWxmLl9uYW1lZFN1YnMgPSBuZXcgTWFwKCk7XG4gIHNlbGYuX3VuaXZlcnNhbFN1YnMgPSBbXTtcblxuICBzZWxmLnVzZXJJZCA9IG51bGw7XG5cbiAgc2VsZi5jb2xsZWN0aW9uVmlld3MgPSBuZXcgTWFwKCk7XG5cbiAgLy8gU2V0IHRoaXMgdG8gZmFsc2UgdG8gbm90IHNlbmQgbWVzc2FnZXMgd2hlbiBjb2xsZWN0aW9uVmlld3MgYXJlXG4gIC8vIG1vZGlmaWVkLiBUaGlzIGlzIGRvbmUgd2hlbiByZXJ1bm5pbmcgc3VicyBpbiBfc2V0VXNlcklkIGFuZCB0aG9zZSBtZXNzYWdlc1xuICAvLyBhcmUgY2FsY3VsYXRlZCB2aWEgYSBkaWZmIGluc3RlYWQuXG4gIHNlbGYuX2lzU2VuZGluZyA9IHRydWU7XG5cbiAgLy8gSWYgdGhpcyBpcyB0cnVlLCBkb24ndCBzdGFydCBhIG5ld2x5LWNyZWF0ZWQgdW5pdmVyc2FsIHB1Ymxpc2hlciBvbiB0aGlzXG4gIC8vIHNlc3Npb24uIFRoZSBzZXNzaW9uIHdpbGwgdGFrZSBjYXJlIG9mIHN0YXJ0aW5nIGl0IHdoZW4gYXBwcm9wcmlhdGUuXG4gIHNlbGYuX2RvbnRTdGFydE5ld1VuaXZlcnNhbFN1YnMgPSBmYWxzZTtcblxuICAvLyBXaGVuIHdlIGFyZSByZXJ1bm5pbmcgc3Vic2NyaXB0aW9ucywgYW55IHJlYWR5IG1lc3NhZ2VzXG4gIC8vIHdlIHdhbnQgdG8gYnVmZmVyIHVwIGZvciB3aGVuIHdlIGFyZSBkb25lIHJlcnVubmluZyBzdWJzY3JpcHRpb25zXG4gIHNlbGYuX3BlbmRpbmdSZWFkeSA9IFtdO1xuXG4gIC8vIExpc3Qgb2YgY2FsbGJhY2tzIHRvIGNhbGwgd2hlbiB0aGlzIGNvbm5lY3Rpb24gaXMgY2xvc2VkLlxuICBzZWxmLl9jbG9zZUNhbGxiYWNrcyA9IFtdO1xuXG5cbiAgLy8gWFhYIEhBQ0s6IElmIGEgc29ja2pzIGNvbm5lY3Rpb24sIHNhdmUgb2ZmIHRoZSBVUkwuIFRoaXMgaXNcbiAgLy8gdGVtcG9yYXJ5IGFuZCB3aWxsIGdvIGF3YXkgaW4gdGhlIG5lYXIgZnV0dXJlLlxuICBzZWxmLl9zb2NrZXRVcmwgPSBzb2NrZXQudXJsO1xuXG4gIC8vIEFsbG93IHRlc3RzIHRvIGRpc2FibGUgcmVzcG9uZGluZyB0byBwaW5ncy5cbiAgc2VsZi5fcmVzcG9uZFRvUGluZ3MgPSBvcHRpb25zLnJlc3BvbmRUb1BpbmdzO1xuXG4gIC8vIFRoaXMgb2JqZWN0IGlzIHRoZSBwdWJsaWMgaW50ZXJmYWNlIHRvIHRoZSBzZXNzaW9uLiBJbiB0aGUgcHVibGljXG4gIC8vIEFQSSwgaXQgaXMgY2FsbGVkIHRoZSBgY29ubmVjdGlvbmAgb2JqZWN0LiAgSW50ZXJuYWxseSB3ZSBjYWxsIGl0XG4gIC8vIGEgYGNvbm5lY3Rpb25IYW5kbGVgIHRvIGF2b2lkIGFtYmlndWl0eS5cbiAgc2VsZi5jb25uZWN0aW9uSGFuZGxlID0ge1xuICAgIGlkOiBzZWxmLmlkLFxuICAgIGNsb3NlOiBmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLmNsb3NlKCk7XG4gICAgfSxcbiAgICBvbkNsb3NlOiBmdW5jdGlvbiAoZm4pIHtcbiAgICAgIHZhciBjYiA9IE1ldGVvci5iaW5kRW52aXJvbm1lbnQoZm4sIFwiY29ubmVjdGlvbiBvbkNsb3NlIGNhbGxiYWNrXCIpO1xuICAgICAgaWYgKHNlbGYuaW5RdWV1ZSkge1xuICAgICAgICBzZWxmLl9jbG9zZUNhbGxiYWNrcy5wdXNoKGNiKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGlmIHdlJ3JlIGFscmVhZHkgY2xvc2VkLCBjYWxsIHRoZSBjYWxsYmFjay5cbiAgICAgICAgTWV0ZW9yLmRlZmVyKGNiKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIGNsaWVudEFkZHJlc3M6IHNlbGYuX2NsaWVudEFkZHJlc3MoKSxcbiAgICBodHRwSGVhZGVyczogc2VsZi5zb2NrZXQuaGVhZGVyc1xuICB9O1xuXG4gIHNlbGYuc2VuZCh7IG1zZzogJ2Nvbm5lY3RlZCcsIHNlc3Npb246IHNlbGYuaWQgfSk7XG5cbiAgLy8gT24gaW5pdGlhbCBjb25uZWN0LCBzcGluIHVwIGFsbCB0aGUgdW5pdmVyc2FsIHB1Ymxpc2hlcnMuXG4gIHNlbGYuc3RhcnRVbml2ZXJzYWxTdWJzKCk7XG5cbiAgaWYgKHZlcnNpb24gIT09ICdwcmUxJyAmJiBvcHRpb25zLmhlYXJ0YmVhdEludGVydmFsICE9PSAwKSB7XG4gICAgLy8gV2Ugbm8gbG9uZ2VyIG5lZWQgdGhlIGxvdyBsZXZlbCB0aW1lb3V0IGJlY2F1c2Ugd2UgaGF2ZSBoZWFydGJlYXRzLlxuICAgIHNvY2tldC5zZXRXZWJzb2NrZXRUaW1lb3V0KDApO1xuXG4gICAgc2VsZi5oZWFydGJlYXQgPSBuZXcgRERQQ29tbW9uLkhlYXJ0YmVhdCh7XG4gICAgICBoZWFydGJlYXRJbnRlcnZhbDogb3B0aW9ucy5oZWFydGJlYXRJbnRlcnZhbCxcbiAgICAgIGhlYXJ0YmVhdFRpbWVvdXQ6IG9wdGlvbnMuaGVhcnRiZWF0VGltZW91dCxcbiAgICAgIG9uVGltZW91dDogZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLmNsb3NlKCk7XG4gICAgICB9LFxuICAgICAgc2VuZFBpbmc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2VsZi5zZW5kKHttc2c6ICdwaW5nJ30pO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHNlbGYuaGVhcnRiZWF0LnN0YXJ0KCk7XG4gIH1cblxuICBQYWNrYWdlWydmYWN0cy1iYXNlJ10gJiYgUGFja2FnZVsnZmFjdHMtYmFzZSddLkZhY3RzLmluY3JlbWVudFNlcnZlckZhY3QoXG4gICAgXCJsaXZlZGF0YVwiLCBcInNlc3Npb25zXCIsIDEpO1xufTtcblxuT2JqZWN0LmFzc2lnbihTZXNzaW9uLnByb3RvdHlwZSwge1xuICBzZW5kUmVhZHk6IGZ1bmN0aW9uIChzdWJzY3JpcHRpb25JZHMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2lzU2VuZGluZykge1xuICAgICAgc2VsZi5zZW5kKHttc2c6IFwicmVhZHlcIiwgc3Viczogc3Vic2NyaXB0aW9uSWRzfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN1YnNjcmlwdGlvbklkcy5mb3JFYWNoKGZ1bmN0aW9uIChzdWJzY3JpcHRpb25JZCkge1xuICAgICAgICBzZWxmLl9wZW5kaW5nUmVhZHkucHVzaChzdWJzY3JpcHRpb25JZCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG5cbiAgX2NhblNlbmQoY29sbGVjdGlvbk5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5faXNTZW5kaW5nIHx8ICF0aGlzLnNlcnZlci5nZXRQdWJsaWNhdGlvblN0cmF0ZWd5KGNvbGxlY3Rpb25OYW1lKS51c2VDb2xsZWN0aW9uVmlldztcbiAgfSxcblxuXG4gIHNlbmRBZGRlZChjb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcykge1xuICAgIGlmICh0aGlzLl9jYW5TZW5kKGNvbGxlY3Rpb25OYW1lKSkge1xuICAgICAgdGhpcy5zZW5kKHsgbXNnOiAnYWRkZWQnLCBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcyB9KTtcbiAgICB9XG4gIH0sXG5cbiAgc2VuZENoYW5nZWQoY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpIHtcbiAgICBpZiAoaXNFbXB0eShmaWVsZHMpKVxuICAgICAgcmV0dXJuO1xuXG4gICAgaWYgKHRoaXMuX2NhblNlbmQoY29sbGVjdGlvbk5hbWUpKSB7XG4gICAgICB0aGlzLnNlbmQoe1xuICAgICAgICBtc2c6IFwiY2hhbmdlZFwiLFxuICAgICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgaWQsXG4gICAgICAgIGZpZWxkc1xuICAgICAgfSk7XG4gICAgfVxuICB9LFxuXG4gIHNlbmRSZW1vdmVkKGNvbGxlY3Rpb25OYW1lLCBpZCkge1xuICAgIGlmICh0aGlzLl9jYW5TZW5kKGNvbGxlY3Rpb25OYW1lKSkge1xuICAgICAgdGhpcy5zZW5kKHttc2c6IFwicmVtb3ZlZFwiLCBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uTmFtZSwgaWR9KTtcbiAgICB9XG4gIH0sXG5cbiAgZ2V0U2VuZENhbGxiYWNrczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4ge1xuICAgICAgYWRkZWQ6IHNlbGYuc2VuZEFkZGVkLmJpbmQoc2VsZiksXG4gICAgICBjaGFuZ2VkOiBzZWxmLnNlbmRDaGFuZ2VkLmJpbmQoc2VsZiksXG4gICAgICByZW1vdmVkOiBzZWxmLnNlbmRSZW1vdmVkLmJpbmQoc2VsZilcbiAgICB9O1xuICB9LFxuXG4gIGdldENvbGxlY3Rpb25WaWV3OiBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHJldCA9IHNlbGYuY29sbGVjdGlvblZpZXdzLmdldChjb2xsZWN0aW9uTmFtZSk7XG4gICAgaWYgKCFyZXQpIHtcbiAgICAgIHJldCA9IG5ldyBTZXNzaW9uQ29sbGVjdGlvblZpZXcoY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5nZXRTZW5kQ2FsbGJhY2tzKCkpO1xuICAgICAgc2VsZi5jb2xsZWN0aW9uVmlld3Muc2V0KGNvbGxlY3Rpb25OYW1lLCByZXQpO1xuICAgIH1cbiAgICByZXR1cm4gcmV0O1xuICB9LFxuXG4gIGFkZGVkKHN1YnNjcmlwdGlvbkhhbmRsZSwgY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpIHtcbiAgICBpZiAodGhpcy5zZXJ2ZXIuZ2V0UHVibGljYXRpb25TdHJhdGVneShjb2xsZWN0aW9uTmFtZSkudXNlQ29sbGVjdGlvblZpZXcpIHtcbiAgICAgIGNvbnN0IHZpZXcgPSB0aGlzLmdldENvbGxlY3Rpb25WaWV3KGNvbGxlY3Rpb25OYW1lKTtcbiAgICAgIHZpZXcuYWRkZWQoc3Vic2NyaXB0aW9uSGFuZGxlLCBpZCwgZmllbGRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zZW5kQWRkZWQoY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpO1xuICAgIH1cbiAgfSxcblxuICByZW1vdmVkKHN1YnNjcmlwdGlvbkhhbmRsZSwgY29sbGVjdGlvbk5hbWUsIGlkKSB7XG4gICAgaWYgKHRoaXMuc2VydmVyLmdldFB1YmxpY2F0aW9uU3RyYXRlZ3koY29sbGVjdGlvbk5hbWUpLnVzZUNvbGxlY3Rpb25WaWV3KSB7XG4gICAgICBjb25zdCB2aWV3ID0gdGhpcy5nZXRDb2xsZWN0aW9uVmlldyhjb2xsZWN0aW9uTmFtZSk7XG4gICAgICB2aWV3LnJlbW92ZWQoc3Vic2NyaXB0aW9uSGFuZGxlLCBpZCk7XG4gICAgICBpZiAodmlldy5pc0VtcHR5KCkpIHtcbiAgICAgICAgIHRoaXMuY29sbGVjdGlvblZpZXdzLmRlbGV0ZShjb2xsZWN0aW9uTmFtZSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2VuZFJlbW92ZWQoY29sbGVjdGlvbk5hbWUsIGlkKTtcbiAgICB9XG4gIH0sXG5cbiAgY2hhbmdlZChzdWJzY3JpcHRpb25IYW5kbGUsIGNvbGxlY3Rpb25OYW1lLCBpZCwgZmllbGRzKSB7XG4gICAgaWYgKHRoaXMuc2VydmVyLmdldFB1YmxpY2F0aW9uU3RyYXRlZ3koY29sbGVjdGlvbk5hbWUpLnVzZUNvbGxlY3Rpb25WaWV3KSB7XG4gICAgICBjb25zdCB2aWV3ID0gdGhpcy5nZXRDb2xsZWN0aW9uVmlldyhjb2xsZWN0aW9uTmFtZSk7XG4gICAgICB2aWV3LmNoYW5nZWQoc3Vic2NyaXB0aW9uSGFuZGxlLCBpZCwgZmllbGRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zZW5kQ2hhbmdlZChjb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcyk7XG4gICAgfVxuICB9LFxuXG4gIHN0YXJ0VW5pdmVyc2FsU3ViczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAvLyBNYWtlIGEgc2hhbGxvdyBjb3B5IG9mIHRoZSBzZXQgb2YgdW5pdmVyc2FsIGhhbmRsZXJzIGFuZCBzdGFydCB0aGVtLiBJZlxuICAgIC8vIGFkZGl0aW9uYWwgdW5pdmVyc2FsIHB1Ymxpc2hlcnMgc3RhcnQgd2hpbGUgd2UncmUgcnVubmluZyB0aGVtIChkdWUgdG9cbiAgICAvLyB5aWVsZGluZyksIHRoZXkgd2lsbCBydW4gc2VwYXJhdGVseSBhcyBwYXJ0IG9mIFNlcnZlci5wdWJsaXNoLlxuICAgIHZhciBoYW5kbGVycyA9IFsuLi5zZWxmLnNlcnZlci51bml2ZXJzYWxfcHVibGlzaF9oYW5kbGVyc107XG4gICAgaGFuZGxlcnMuZm9yRWFjaChmdW5jdGlvbiAoaGFuZGxlcikge1xuICAgICAgc2VsZi5fc3RhcnRTdWJzY3JpcHRpb24oaGFuZGxlcik7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gRGVzdHJveSB0aGlzIHNlc3Npb24gYW5kIHVucmVnaXN0ZXIgaXQgYXQgdGhlIHNlcnZlci5cbiAgY2xvc2U6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAvLyBEZXN0cm95IHRoaXMgc2Vzc2lvbiwgZXZlbiBpZiBpdCdzIG5vdCByZWdpc3RlcmVkIGF0IHRoZVxuICAgIC8vIHNlcnZlci4gU3RvcCBhbGwgcHJvY2Vzc2luZyBhbmQgdGVhciBldmVyeXRoaW5nIGRvd24uIElmIGEgc29ja2V0XG4gICAgLy8gd2FzIGF0dGFjaGVkLCBjbG9zZSBpdC5cblxuICAgIC8vIEFscmVhZHkgZGVzdHJveWVkLlxuICAgIGlmICghIHNlbGYuaW5RdWV1ZSlcbiAgICAgIHJldHVybjtcblxuICAgIC8vIERyb3AgdGhlIG1lcmdlIGJveCBkYXRhIGltbWVkaWF0ZWx5LlxuICAgIHNlbGYuaW5RdWV1ZSA9IG51bGw7XG4gICAgc2VsZi5jb2xsZWN0aW9uVmlld3MgPSBuZXcgTWFwKCk7XG5cbiAgICBpZiAoc2VsZi5oZWFydGJlYXQpIHtcbiAgICAgIHNlbGYuaGVhcnRiZWF0LnN0b3AoKTtcbiAgICAgIHNlbGYuaGVhcnRiZWF0ID0gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAoc2VsZi5zb2NrZXQpIHtcbiAgICAgIHNlbGYuc29ja2V0LmNsb3NlKCk7XG4gICAgICBzZWxmLnNvY2tldC5fbWV0ZW9yU2Vzc2lvbiA9IG51bGw7XG4gICAgfVxuXG4gICAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgICAgXCJsaXZlZGF0YVwiLCBcInNlc3Npb25zXCIsIC0xKTtcblxuICAgIE1ldGVvci5kZWZlcihmdW5jdGlvbiAoKSB7XG4gICAgICAvLyBTdG9wIGNhbGxiYWNrcyBjYW4geWllbGQsIHNvIHdlIGRlZmVyIHRoaXMgb24gY2xvc2UuXG4gICAgICAvLyBzdWIuX2lzRGVhY3RpdmF0ZWQoKSBkZXRlY3RzIHRoYXQgd2Ugc2V0IGluUXVldWUgdG8gbnVsbCBhbmRcbiAgICAgIC8vIHRyZWF0cyBpdCBhcyBzZW1pLWRlYWN0aXZhdGVkIChpdCB3aWxsIGlnbm9yZSBpbmNvbWluZyBjYWxsYmFja3MsIGV0YykuXG4gICAgICBzZWxmLl9kZWFjdGl2YXRlQWxsU3Vic2NyaXB0aW9ucygpO1xuXG4gICAgICAvLyBEZWZlciBjYWxsaW5nIHRoZSBjbG9zZSBjYWxsYmFja3MsIHNvIHRoYXQgdGhlIGNhbGxlciBjbG9zaW5nXG4gICAgICAvLyB0aGUgc2Vzc2lvbiBpc24ndCB3YWl0aW5nIGZvciBhbGwgdGhlIGNhbGxiYWNrcyB0byBjb21wbGV0ZS5cbiAgICAgIHNlbGYuX2Nsb3NlQ2FsbGJhY2tzLmZvckVhY2goZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIC8vIFVucmVnaXN0ZXIgdGhlIHNlc3Npb24uXG4gICAgc2VsZi5zZXJ2ZXIuX3JlbW92ZVNlc3Npb24oc2VsZik7XG4gIH0sXG5cbiAgLy8gU2VuZCBhIG1lc3NhZ2UgKGRvaW5nIG5vdGhpbmcgaWYgbm8gc29ja2V0IGlzIGNvbm5lY3RlZCByaWdodCBub3cpLlxuICAvLyBJdCBzaG91bGQgYmUgYSBKU09OIG9iamVjdCAoaXQgd2lsbCBiZSBzdHJpbmdpZmllZCkuXG4gIHNlbmQ6IGZ1bmN0aW9uIChtc2cpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5zb2NrZXQpIHtcbiAgICAgIGlmIChNZXRlb3IuX3ByaW50U2VudEREUClcbiAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhcIlNlbnQgRERQXCIsIEREUENvbW1vbi5zdHJpbmdpZnlERFAobXNnKSk7XG4gICAgICBzZWxmLnNvY2tldC5zZW5kKEREUENvbW1vbi5zdHJpbmdpZnlERFAobXNnKSk7XG4gICAgfVxuICB9LFxuXG4gIC8vIFNlbmQgYSBjb25uZWN0aW9uIGVycm9yLlxuICBzZW5kRXJyb3I6IGZ1bmN0aW9uIChyZWFzb24sIG9mZmVuZGluZ01lc3NhZ2UpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIG1zZyA9IHttc2c6ICdlcnJvcicsIHJlYXNvbjogcmVhc29ufTtcbiAgICBpZiAob2ZmZW5kaW5nTWVzc2FnZSlcbiAgICAgIG1zZy5vZmZlbmRpbmdNZXNzYWdlID0gb2ZmZW5kaW5nTWVzc2FnZTtcbiAgICBzZWxmLnNlbmQobXNnKTtcbiAgfSxcblxuICAvLyBQcm9jZXNzICdtc2cnIGFzIGFuIGluY29taW5nIG1lc3NhZ2UuIEFzIGEgZ3VhcmQgYWdhaW5zdFxuICAvLyByYWNlIGNvbmRpdGlvbnMgZHVyaW5nIHJlY29ubmVjdGlvbiwgaWdub3JlIHRoZSBtZXNzYWdlIGlmXG4gIC8vICdzb2NrZXQnIGlzIG5vdCB0aGUgY3VycmVudGx5IGNvbm5lY3RlZCBzb2NrZXQuXG4gIC8vXG4gIC8vIFdlIHJ1biB0aGUgbWVzc2FnZXMgZnJvbSB0aGUgY2xpZW50IG9uZSBhdCBhIHRpbWUsIGluIHRoZSBvcmRlclxuICAvLyBnaXZlbiBieSB0aGUgY2xpZW50LiBUaGUgbWVzc2FnZSBoYW5kbGVyIGlzIHBhc3NlZCBhbiBpZGVtcG90ZW50XG4gIC8vIGZ1bmN0aW9uICd1bmJsb2NrJyB3aGljaCBpdCBtYXkgY2FsbCB0byBhbGxvdyBvdGhlciBtZXNzYWdlcyB0b1xuICAvLyBiZWdpbiBydW5uaW5nIGluIHBhcmFsbGVsIGluIGFub3RoZXIgZmliZXIgKGZvciBleGFtcGxlLCBhIG1ldGhvZFxuICAvLyB0aGF0IHdhbnRzIHRvIHlpZWxkKS4gT3RoZXJ3aXNlLCBpdCBpcyBhdXRvbWF0aWNhbGx5IHVuYmxvY2tlZFxuICAvLyB3aGVuIGl0IHJldHVybnMuXG4gIC8vXG4gIC8vIEFjdHVhbGx5LCB3ZSBkb24ndCBoYXZlIHRvICd0b3RhbGx5IG9yZGVyJyB0aGUgbWVzc2FnZXMgaW4gdGhpc1xuICAvLyB3YXksIGJ1dCBpdCdzIHRoZSBlYXNpZXN0IHRoaW5nIHRoYXQncyBjb3JyZWN0LiAodW5zdWIgbmVlZHMgdG9cbiAgLy8gYmUgb3JkZXJlZCBhZ2FpbnN0IHN1YiwgbWV0aG9kcyBuZWVkIHRvIGJlIG9yZGVyZWQgYWdhaW5zdCBlYWNoXG4gIC8vIG90aGVyKS5cbiAgcHJvY2Vzc01lc3NhZ2U6IGZ1bmN0aW9uIChtc2dfaW4pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCFzZWxmLmluUXVldWUpIC8vIHdlIGhhdmUgYmVlbiBkZXN0cm95ZWQuXG4gICAgICByZXR1cm47XG5cbiAgICAvLyBSZXNwb25kIHRvIHBpbmcgYW5kIHBvbmcgbWVzc2FnZXMgaW1tZWRpYXRlbHkgd2l0aG91dCBxdWV1aW5nLlxuICAgIC8vIElmIHRoZSBuZWdvdGlhdGVkIEREUCB2ZXJzaW9uIGlzIFwicHJlMVwiIHdoaWNoIGRpZG4ndCBzdXBwb3J0XG4gICAgLy8gcGluZ3MsIHByZXNlcnZlIHRoZSBcInByZTFcIiBiZWhhdmlvciBvZiByZXNwb25kaW5nIHdpdGggYSBcImJhZFxuICAgIC8vIHJlcXVlc3RcIiBmb3IgdGhlIHVua25vd24gbWVzc2FnZXMuXG4gICAgLy9cbiAgICAvLyBGaWJlcnMgYXJlIG5lZWRlZCBiZWNhdXNlIGhlYXJ0YmVhdHMgdXNlIE1ldGVvci5zZXRUaW1lb3V0LCB3aGljaFxuICAgIC8vIG5lZWRzIGEgRmliZXIuIFdlIGNvdWxkIGFjdHVhbGx5IHVzZSByZWd1bGFyIHNldFRpbWVvdXQgYW5kIGF2b2lkXG4gICAgLy8gdGhlc2UgbmV3IGZpYmVycywgYnV0IGl0IGlzIGVhc2llciB0byBqdXN0IG1ha2UgZXZlcnl0aGluZyB1c2VcbiAgICAvLyBNZXRlb3Iuc2V0VGltZW91dCBhbmQgbm90IHRoaW5rIHRvbyBoYXJkLlxuICAgIC8vXG4gICAgLy8gQW55IG1lc3NhZ2UgY291bnRzIGFzIHJlY2VpdmluZyBhIHBvbmcsIGFzIGl0IGRlbW9uc3RyYXRlcyB0aGF0XG4gICAgLy8gdGhlIGNsaWVudCBpcyBzdGlsbCBhbGl2ZS5cbiAgICBpZiAoc2VsZi5oZWFydGJlYXQpIHtcbiAgICAgIHNlbGYuaGVhcnRiZWF0Lm1lc3NhZ2VSZWNlaXZlZCgpO1xuICAgIH07XG5cbiAgICBpZiAoc2VsZi52ZXJzaW9uICE9PSAncHJlMScgJiYgbXNnX2luLm1zZyA9PT0gJ3BpbmcnKSB7XG4gICAgICBpZiAoc2VsZi5fcmVzcG9uZFRvUGluZ3MpXG4gICAgICAgIHNlbGYuc2VuZCh7bXNnOiBcInBvbmdcIiwgaWQ6IG1zZ19pbi5pZH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoc2VsZi52ZXJzaW9uICE9PSAncHJlMScgJiYgbXNnX2luLm1zZyA9PT0gJ3BvbmcnKSB7XG4gICAgICAvLyBTaW5jZSBldmVyeXRoaW5nIGlzIGEgcG9uZywgdGhlcmUgaXMgbm90aGluZyB0byBkb1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHNlbGYuaW5RdWV1ZS5wdXNoKG1zZ19pbik7XG4gICAgaWYgKHNlbGYud29ya2VyUnVubmluZylcbiAgICAgIHJldHVybjtcbiAgICBzZWxmLndvcmtlclJ1bm5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIHByb2Nlc3NOZXh0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIG1zZyA9IHNlbGYuaW5RdWV1ZSAmJiBzZWxmLmluUXVldWUuc2hpZnQoKTtcblxuICAgICAgaWYgKCFtc2cpIHtcbiAgICAgICAgc2VsZi53b3JrZXJSdW5uaW5nID0gZmFsc2U7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gcnVuSGFuZGxlcnMoKSB7XG4gICAgICAgIHZhciBibG9ja2VkID0gdHJ1ZTtcblxuICAgICAgICB2YXIgdW5ibG9jayA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBpZiAoIWJsb2NrZWQpXG4gICAgICAgICAgICByZXR1cm47IC8vIGlkZW1wb3RlbnRcbiAgICAgICAgICBibG9ja2VkID0gZmFsc2U7XG4gICAgICAgICAgcHJvY2Vzc05leHQoKTtcbiAgICAgICAgfTtcblxuICAgICAgICBzZWxmLnNlcnZlci5vbk1lc3NhZ2VIb29rLmVhY2goZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgICAgY2FsbGJhY2sobXNnLCBzZWxmKTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKG1zZy5tc2cgaW4gc2VsZi5wcm90b2NvbF9oYW5kbGVycykge1xuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHNlbGYucHJvdG9jb2xfaGFuZGxlcnNbbXNnLm1zZ10uY2FsbChcbiAgICAgICAgICAgIHNlbGYsXG4gICAgICAgICAgICBtc2csXG4gICAgICAgICAgICB1bmJsb2NrXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIGlmIChNZXRlb3IuX2lzUHJvbWlzZShyZXN1bHQpKSB7XG4gICAgICAgICAgICByZXN1bHQuZmluYWxseSgoKSA9PiB1bmJsb2NrKCkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB1bmJsb2NrKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNlbGYuc2VuZEVycm9yKCdCYWQgcmVxdWVzdCcsIG1zZyk7XG4gICAgICAgICAgdW5ibG9jaygpOyAvLyBpbiBjYXNlIHRoZSBoYW5kbGVyIGRpZG4ndCBhbHJlYWR5IGRvIGl0XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcnVuSGFuZGxlcnMoKTtcbiAgICB9O1xuXG4gICAgcHJvY2Vzc05leHQoKTtcbiAgfSxcblxuICBwcm90b2NvbF9oYW5kbGVyczoge1xuICAgIHN1YjogYXN5bmMgZnVuY3Rpb24gKG1zZywgdW5ibG9jaykge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAvLyBjYWNoZVVuYmxvY2sgdGVtcG9yYXJseSwgc28gd2UgY2FuIGNhcHR1cmUgaXQgbGF0ZXJcbiAgICAgIC8vIHdlIHdpbGwgdXNlIHVuYmxvY2sgaW4gY3VycmVudCBldmVudExvb3AsIHNvIHRoaXMgaXMgc2FmZVxuICAgICAgc2VsZi5jYWNoZWRVbmJsb2NrID0gdW5ibG9jaztcblxuICAgICAgLy8gcmVqZWN0IG1hbGZvcm1lZCBtZXNzYWdlc1xuICAgICAgaWYgKHR5cGVvZiAobXNnLmlkKSAhPT0gXCJzdHJpbmdcIiB8fFxuICAgICAgICAgIHR5cGVvZiAobXNnLm5hbWUpICE9PSBcInN0cmluZ1wiIHx8XG4gICAgICAgICAgKCdwYXJhbXMnIGluIG1zZyAmJiAhKG1zZy5wYXJhbXMgaW5zdGFuY2VvZiBBcnJheSkpKSB7XG4gICAgICAgIHNlbGYuc2VuZEVycm9yKFwiTWFsZm9ybWVkIHN1YnNjcmlwdGlvblwiLCBtc2cpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmICghc2VsZi5zZXJ2ZXIucHVibGlzaF9oYW5kbGVyc1ttc2cubmFtZV0pIHtcbiAgICAgICAgc2VsZi5zZW5kKHtcbiAgICAgICAgICBtc2c6ICdub3N1YicsIGlkOiBtc2cuaWQsXG4gICAgICAgICAgZXJyb3I6IG5ldyBNZXRlb3IuRXJyb3IoNDA0LCBgU3Vic2NyaXB0aW9uICcke21zZy5uYW1lfScgbm90IGZvdW5kYCl9KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoc2VsZi5fbmFtZWRTdWJzLmhhcyhtc2cuaWQpKVxuICAgICAgICAvLyBzdWJzIGFyZSBpZGVtcG90ZW50LCBvciByYXRoZXIsIHRoZXkgYXJlIGlnbm9yZWQgaWYgYSBzdWJcbiAgICAgICAgLy8gd2l0aCB0aGF0IGlkIGFscmVhZHkgZXhpc3RzLiB0aGlzIGlzIGltcG9ydGFudCBkdXJpbmdcbiAgICAgICAgLy8gcmVjb25uZWN0LlxuICAgICAgICByZXR1cm47XG5cbiAgICAgIC8vIFhYWCBJdCdkIGJlIG11Y2ggYmV0dGVyIGlmIHdlIGhhZCBnZW5lcmljIGhvb2tzIHdoZXJlIGFueSBwYWNrYWdlIGNhblxuICAgICAgLy8gaG9vayBpbnRvIHN1YnNjcmlwdGlvbiBoYW5kbGluZywgYnV0IGluIHRoZSBtZWFuIHdoaWxlIHdlIHNwZWNpYWwgY2FzZVxuICAgICAgLy8gZGRwLXJhdGUtbGltaXRlciBwYWNrYWdlLiBUaGlzIGlzIGFsc28gZG9uZSBmb3Igd2VhayByZXF1aXJlbWVudHMgdG9cbiAgICAgIC8vIGFkZCB0aGUgZGRwLXJhdGUtbGltaXRlciBwYWNrYWdlIGluIGNhc2Ugd2UgZG9uJ3QgaGF2ZSBBY2NvdW50cy4gQVxuICAgICAgLy8gdXNlciB0cnlpbmcgdG8gdXNlIHRoZSBkZHAtcmF0ZS1saW1pdGVyIG11c3QgZXhwbGljaXRseSByZXF1aXJlIGl0LlxuICAgICAgaWYgKFBhY2thZ2VbJ2RkcC1yYXRlLWxpbWl0ZXInXSkge1xuICAgICAgICB2YXIgRERQUmF0ZUxpbWl0ZXIgPSBQYWNrYWdlWydkZHAtcmF0ZS1saW1pdGVyJ10uRERQUmF0ZUxpbWl0ZXI7XG4gICAgICAgIHZhciByYXRlTGltaXRlcklucHV0ID0ge1xuICAgICAgICAgIHVzZXJJZDogc2VsZi51c2VySWQsXG4gICAgICAgICAgY2xpZW50QWRkcmVzczogc2VsZi5jb25uZWN0aW9uSGFuZGxlLmNsaWVudEFkZHJlc3MsXG4gICAgICAgICAgdHlwZTogXCJzdWJzY3JpcHRpb25cIixcbiAgICAgICAgICBuYW1lOiBtc2cubmFtZSxcbiAgICAgICAgICBjb25uZWN0aW9uSWQ6IHNlbGYuaWRcbiAgICAgICAgfTtcblxuICAgICAgICBERFBSYXRlTGltaXRlci5faW5jcmVtZW50KHJhdGVMaW1pdGVySW5wdXQpO1xuICAgICAgICB2YXIgcmF0ZUxpbWl0UmVzdWx0ID0gRERQUmF0ZUxpbWl0ZXIuX2NoZWNrKHJhdGVMaW1pdGVySW5wdXQpO1xuICAgICAgICBpZiAoIXJhdGVMaW1pdFJlc3VsdC5hbGxvd2VkKSB7XG4gICAgICAgICAgc2VsZi5zZW5kKHtcbiAgICAgICAgICAgIG1zZzogJ25vc3ViJywgaWQ6IG1zZy5pZCxcbiAgICAgICAgICAgIGVycm9yOiBuZXcgTWV0ZW9yLkVycm9yKFxuICAgICAgICAgICAgICAndG9vLW1hbnktcmVxdWVzdHMnLFxuICAgICAgICAgICAgICBERFBSYXRlTGltaXRlci5nZXRFcnJvck1lc3NhZ2UocmF0ZUxpbWl0UmVzdWx0KSxcbiAgICAgICAgICAgICAge3RpbWVUb1Jlc2V0OiByYXRlTGltaXRSZXN1bHQudGltZVRvUmVzZXR9KVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB2YXIgaGFuZGxlciA9IHNlbGYuc2VydmVyLnB1Ymxpc2hfaGFuZGxlcnNbbXNnLm5hbWVdO1xuXG4gICAgICBhd2FpdCBzZWxmLl9zdGFydFN1YnNjcmlwdGlvbihoYW5kbGVyLCBtc2cuaWQsIG1zZy5wYXJhbXMsIG1zZy5uYW1lKTtcblxuICAgICAgLy8gY2xlYW5pbmcgY2FjaGVkIHVuYmxvY2tcbiAgICAgIHNlbGYuY2FjaGVkVW5ibG9jayA9IG51bGw7XG4gICAgfSxcblxuICAgIHVuc3ViOiBmdW5jdGlvbiAobXNnKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgIHNlbGYuX3N0b3BTdWJzY3JpcHRpb24obXNnLmlkKTtcbiAgICB9LFxuXG4gICAgbWV0aG9kOiBhc3luYyBmdW5jdGlvbiAobXNnLCB1bmJsb2NrKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgIC8vIFJlamVjdCBtYWxmb3JtZWQgbWVzc2FnZXMuXG4gICAgICAvLyBGb3Igbm93LCB3ZSBzaWxlbnRseSBpZ25vcmUgdW5rbm93biBhdHRyaWJ1dGVzLFxuICAgICAgLy8gZm9yIGZvcndhcmRzIGNvbXBhdGliaWxpdHkuXG4gICAgICBpZiAodHlwZW9mIChtc2cuaWQpICE9PSBcInN0cmluZ1wiIHx8XG4gICAgICAgICAgdHlwZW9mIChtc2cubWV0aG9kKSAhPT0gXCJzdHJpbmdcIiB8fFxuICAgICAgICAgICgncGFyYW1zJyBpbiBtc2cgJiYgIShtc2cucGFyYW1zIGluc3RhbmNlb2YgQXJyYXkpKSB8fFxuICAgICAgICAgICgoJ3JhbmRvbVNlZWQnIGluIG1zZykgJiYgKHR5cGVvZiBtc2cucmFuZG9tU2VlZCAhPT0gXCJzdHJpbmdcIikpKSB7XG4gICAgICAgIHNlbGYuc2VuZEVycm9yKFwiTWFsZm9ybWVkIG1ldGhvZCBpbnZvY2F0aW9uXCIsIG1zZyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdmFyIHJhbmRvbVNlZWQgPSBtc2cucmFuZG9tU2VlZCB8fCBudWxsO1xuXG4gICAgICAvLyBTZXQgdXAgdG8gbWFyayB0aGUgbWV0aG9kIGFzIHNhdGlzZmllZCBvbmNlIGFsbCBvYnNlcnZlcnNcbiAgICAgIC8vIChhbmQgc3Vic2NyaXB0aW9ucykgaGF2ZSByZWFjdGVkIHRvIGFueSB3cml0ZXMgdGhhdCB3ZXJlXG4gICAgICAvLyBkb25lLlxuICAgICAgdmFyIGZlbmNlID0gbmV3IEREUFNlcnZlci5fV3JpdGVGZW5jZTtcbiAgICAgIGZlbmNlLm9uQWxsQ29tbWl0dGVkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gUmV0aXJlIHRoZSBmZW5jZSBzbyB0aGF0IGZ1dHVyZSB3cml0ZXMgYXJlIGFsbG93ZWQuXG4gICAgICAgIC8vIFRoaXMgbWVhbnMgdGhhdCBjYWxsYmFja3MgbGlrZSB0aW1lcnMgYXJlIGZyZWUgdG8gdXNlXG4gICAgICAgIC8vIHRoZSBmZW5jZSwgYW5kIGlmIHRoZXkgZmlyZSBiZWZvcmUgaXQncyBhcm1lZCAoZm9yXG4gICAgICAgIC8vIGV4YW1wbGUsIGJlY2F1c2UgdGhlIG1ldGhvZCB3YWl0cyBmb3IgdGhlbSkgdGhlaXJcbiAgICAgICAgLy8gd3JpdGVzIHdpbGwgYmUgaW5jbHVkZWQgaW4gdGhlIGZlbmNlLlxuICAgICAgICBmZW5jZS5yZXRpcmUoKTtcbiAgICAgICAgc2VsZi5zZW5kKHttc2c6ICd1cGRhdGVkJywgbWV0aG9kczogW21zZy5pZF19KTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBGaW5kIHRoZSBoYW5kbGVyXG4gICAgICB2YXIgaGFuZGxlciA9IHNlbGYuc2VydmVyLm1ldGhvZF9oYW5kbGVyc1ttc2cubWV0aG9kXTtcbiAgICAgIGlmICghaGFuZGxlcikge1xuICAgICAgICBzZWxmLnNlbmQoe1xuICAgICAgICAgIG1zZzogJ3Jlc3VsdCcsIGlkOiBtc2cuaWQsXG4gICAgICAgICAgZXJyb3I6IG5ldyBNZXRlb3IuRXJyb3IoNDA0LCBgTWV0aG9kICcke21zZy5tZXRob2R9JyBub3QgZm91bmRgKX0pO1xuICAgICAgICBhd2FpdCBmZW5jZS5hcm0oKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB2YXIgaW52b2NhdGlvbiA9IG5ldyBERFBDb21tb24uTWV0aG9kSW52b2NhdGlvbih7XG4gICAgICAgIG5hbWU6IG1zZy5tZXRob2QsXG4gICAgICAgIGlzU2ltdWxhdGlvbjogZmFsc2UsXG4gICAgICAgIHVzZXJJZDogc2VsZi51c2VySWQsXG4gICAgICAgIHNldFVzZXJJZCh1c2VySWQpIHtcbiAgICAgICAgICByZXR1cm4gc2VsZi5fc2V0VXNlcklkKHVzZXJJZCk7XG4gICAgICAgIH0sXG4gICAgICAgIHVuYmxvY2s6IHVuYmxvY2ssXG4gICAgICAgIGNvbm5lY3Rpb246IHNlbGYuY29ubmVjdGlvbkhhbmRsZSxcbiAgICAgICAgcmFuZG9tU2VlZDogcmFuZG9tU2VlZCxcbiAgICAgICAgZmVuY2UsXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgLy8gWFhYIEl0J2QgYmUgYmV0dGVyIGlmIHdlIGNvdWxkIGhvb2sgaW50byBtZXRob2QgaGFuZGxlcnMgYmV0dGVyIGJ1dFxuICAgICAgICAvLyBmb3Igbm93LCB3ZSBuZWVkIHRvIGNoZWNrIGlmIHRoZSBkZHAtcmF0ZS1saW1pdGVyIGV4aXN0cyBzaW5jZSB3ZVxuICAgICAgICAvLyBoYXZlIGEgd2VhayByZXF1aXJlbWVudCBmb3IgdGhlIGRkcC1yYXRlLWxpbWl0ZXIgcGFja2FnZSB0byBiZSBhZGRlZFxuICAgICAgICAvLyB0byBvdXIgYXBwbGljYXRpb24uXG4gICAgICAgIGlmIChQYWNrYWdlWydkZHAtcmF0ZS1saW1pdGVyJ10pIHtcbiAgICAgICAgICB2YXIgRERQUmF0ZUxpbWl0ZXIgPSBQYWNrYWdlWydkZHAtcmF0ZS1saW1pdGVyJ10uRERQUmF0ZUxpbWl0ZXI7XG4gICAgICAgICAgdmFyIHJhdGVMaW1pdGVySW5wdXQgPSB7XG4gICAgICAgICAgICB1c2VySWQ6IHNlbGYudXNlcklkLFxuICAgICAgICAgICAgY2xpZW50QWRkcmVzczogc2VsZi5jb25uZWN0aW9uSGFuZGxlLmNsaWVudEFkZHJlc3MsXG4gICAgICAgICAgICB0eXBlOiBcIm1ldGhvZFwiLFxuICAgICAgICAgICAgbmFtZTogbXNnLm1ldGhvZCxcbiAgICAgICAgICAgIGNvbm5lY3Rpb25JZDogc2VsZi5pZFxuICAgICAgICAgIH07XG4gICAgICAgICAgRERQUmF0ZUxpbWl0ZXIuX2luY3JlbWVudChyYXRlTGltaXRlcklucHV0KTtcbiAgICAgICAgICB2YXIgcmF0ZUxpbWl0UmVzdWx0ID0gRERQUmF0ZUxpbWl0ZXIuX2NoZWNrKHJhdGVMaW1pdGVySW5wdXQpXG4gICAgICAgICAgaWYgKCFyYXRlTGltaXRSZXN1bHQuYWxsb3dlZCkge1xuICAgICAgICAgICAgcmVqZWN0KG5ldyBNZXRlb3IuRXJyb3IoXG4gICAgICAgICAgICAgIFwidG9vLW1hbnktcmVxdWVzdHNcIixcbiAgICAgICAgICAgICAgRERQUmF0ZUxpbWl0ZXIuZ2V0RXJyb3JNZXNzYWdlKHJhdGVMaW1pdFJlc3VsdCksXG4gICAgICAgICAgICAgIHt0aW1lVG9SZXNldDogcmF0ZUxpbWl0UmVzdWx0LnRpbWVUb1Jlc2V0fVxuICAgICAgICAgICAgKSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmVzb2x2ZShERFBTZXJ2ZXIuX0N1cnJlbnRXcml0ZUZlbmNlLndpdGhWYWx1ZShcbiAgICAgICAgICBmZW5jZSxcbiAgICAgICAgICAoKSA9PiBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLndpdGhWYWx1ZShcbiAgICAgICAgICAgIGludm9jYXRpb24sXG4gICAgICAgICAgICAoKSA9PiBtYXliZUF1ZGl0QXJndW1lbnRDaGVja3MoXG4gICAgICAgICAgICAgIGhhbmRsZXIsIGludm9jYXRpb24sIG1zZy5wYXJhbXMsXG4gICAgICAgICAgICAgIFwiY2FsbCB0byAnXCIgKyBtc2cubWV0aG9kICsgXCInXCJcbiAgICAgICAgICAgIClcbiAgICAgICAgICApXG4gICAgICAgICkpO1xuICAgICAgfSk7XG5cbiAgICAgIGFzeW5jIGZ1bmN0aW9uIGZpbmlzaCgpIHtcbiAgICAgICAgYXdhaXQgZmVuY2UuYXJtKCk7XG4gICAgICAgIHVuYmxvY2soKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcGF5bG9hZCA9IHtcbiAgICAgICAgbXNnOiBcInJlc3VsdFwiLFxuICAgICAgICBpZDogbXNnLmlkXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHByb21pc2UudGhlbihhc3luYyByZXN1bHQgPT4ge1xuICAgICAgICBhd2FpdCBmaW5pc2goKTtcbiAgICAgICAgaWYgKHJlc3VsdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcGF5bG9hZC5yZXN1bHQgPSByZXN1bHQ7XG4gICAgICAgIH1cbiAgICAgICAgc2VsZi5zZW5kKHBheWxvYWQpO1xuICAgICAgfSwgYXN5bmMgKGV4Y2VwdGlvbikgPT4ge1xuICAgICAgICBhd2FpdCBmaW5pc2goKTtcbiAgICAgICAgcGF5bG9hZC5lcnJvciA9IHdyYXBJbnRlcm5hbEV4Y2VwdGlvbihcbiAgICAgICAgICBleGNlcHRpb24sXG4gICAgICAgICAgYHdoaWxlIGludm9raW5nIG1ldGhvZCAnJHttc2cubWV0aG9kfSdgXG4gICAgICAgICk7XG4gICAgICAgIHNlbGYuc2VuZChwYXlsb2FkKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcblxuICBfZWFjaFN1YjogZnVuY3Rpb24gKGYpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5fbmFtZWRTdWJzLmZvckVhY2goZik7XG4gICAgc2VsZi5fdW5pdmVyc2FsU3Vicy5mb3JFYWNoKGYpO1xuICB9LFxuXG4gIF9kaWZmQ29sbGVjdGlvblZpZXdzOiBmdW5jdGlvbiAoYmVmb3JlQ1ZzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIERpZmZTZXF1ZW5jZS5kaWZmTWFwcyhiZWZvcmVDVnMsIHNlbGYuY29sbGVjdGlvblZpZXdzLCB7XG4gICAgICBib3RoOiBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIGxlZnRWYWx1ZSwgcmlnaHRWYWx1ZSkge1xuICAgICAgICByaWdodFZhbHVlLmRpZmYobGVmdFZhbHVlKTtcbiAgICAgIH0sXG4gICAgICByaWdodE9ubHk6IGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSwgcmlnaHRWYWx1ZSkge1xuICAgICAgICByaWdodFZhbHVlLmRvY3VtZW50cy5mb3JFYWNoKGZ1bmN0aW9uIChkb2NWaWV3LCBpZCkge1xuICAgICAgICAgIHNlbGYuc2VuZEFkZGVkKGNvbGxlY3Rpb25OYW1lLCBpZCwgZG9jVmlldy5nZXRGaWVsZHMoKSk7XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICAgIGxlZnRPbmx5OiBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIGxlZnRWYWx1ZSkge1xuICAgICAgICBsZWZ0VmFsdWUuZG9jdW1lbnRzLmZvckVhY2goZnVuY3Rpb24gKGRvYywgaWQpIHtcbiAgICAgICAgICBzZWxmLnNlbmRSZW1vdmVkKGNvbGxlY3Rpb25OYW1lLCBpZCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuXG4gIC8vIFNldHMgdGhlIGN1cnJlbnQgdXNlciBpZCBpbiBhbGwgYXBwcm9wcmlhdGUgY29udGV4dHMgYW5kIHJlcnVuc1xuICAvLyBhbGwgc3Vic2NyaXB0aW9uc1xuICBhc3luYyBfc2V0VXNlcklkKHVzZXJJZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGlmICh1c2VySWQgIT09IG51bGwgJiYgdHlwZW9mIHVzZXJJZCAhPT0gXCJzdHJpbmdcIilcbiAgICAgIHRocm93IG5ldyBFcnJvcihcInNldFVzZXJJZCBtdXN0IGJlIGNhbGxlZCBvbiBzdHJpbmcgb3IgbnVsbCwgbm90IFwiICtcbiAgICAgICAgICAgICAgICAgICAgICB0eXBlb2YgdXNlcklkKTtcblxuICAgIC8vIFByZXZlbnQgbmV3bHktY3JlYXRlZCB1bml2ZXJzYWwgc3Vic2NyaXB0aW9ucyBmcm9tIGJlaW5nIGFkZGVkIHRvIG91clxuICAgIC8vIHNlc3Npb24uIFRoZXkgd2lsbCBiZSBmb3VuZCBiZWxvdyB3aGVuIHdlIGNhbGwgc3RhcnRVbml2ZXJzYWxTdWJzLlxuICAgIC8vXG4gICAgLy8gKFdlIGRvbid0IGhhdmUgdG8gd29ycnkgYWJvdXQgbmFtZWQgc3Vic2NyaXB0aW9ucywgYmVjYXVzZSB3ZSBvbmx5IGFkZFxuICAgIC8vIHRoZW0gd2hlbiB3ZSBwcm9jZXNzIGEgJ3N1YicgbWVzc2FnZS4gV2UgYXJlIGN1cnJlbnRseSBwcm9jZXNzaW5nIGFcbiAgICAvLyAnbWV0aG9kJyBtZXNzYWdlLCBhbmQgdGhlIG1ldGhvZCBkaWQgbm90IHVuYmxvY2ssIGJlY2F1c2UgaXQgaXMgaWxsZWdhbFxuICAgIC8vIHRvIGNhbGwgc2V0VXNlcklkIGFmdGVyIHVuYmxvY2suIFRodXMgd2UgY2Fubm90IGJlIGNvbmN1cnJlbnRseSBhZGRpbmcgYVxuICAgIC8vIG5ldyBuYW1lZCBzdWJzY3JpcHRpb24pLlxuICAgIHNlbGYuX2RvbnRTdGFydE5ld1VuaXZlcnNhbFN1YnMgPSB0cnVlO1xuXG4gICAgLy8gUHJldmVudCBjdXJyZW50IHN1YnMgZnJvbSB1cGRhdGluZyBvdXIgY29sbGVjdGlvblZpZXdzIGFuZCBjYWxsIHRoZWlyXG4gICAgLy8gc3RvcCBjYWxsYmFja3MuIFRoaXMgbWF5IHlpZWxkLlxuICAgIHNlbGYuX2VhY2hTdWIoZnVuY3Rpb24gKHN1Yikge1xuICAgICAgc3ViLl9kZWFjdGl2YXRlKCk7XG4gICAgfSk7XG5cbiAgICAvLyBBbGwgc3VicyBzaG91bGQgbm93IGJlIGRlYWN0aXZhdGVkLiBTdG9wIHNlbmRpbmcgbWVzc2FnZXMgdG8gdGhlIGNsaWVudCxcbiAgICAvLyBzYXZlIHRoZSBzdGF0ZSBvZiB0aGUgcHVibGlzaGVkIGNvbGxlY3Rpb25zLCByZXNldCB0byBhbiBlbXB0eSB2aWV3LCBhbmRcbiAgICAvLyB1cGRhdGUgdGhlIHVzZXJJZC5cbiAgICBzZWxmLl9pc1NlbmRpbmcgPSBmYWxzZTtcbiAgICB2YXIgYmVmb3JlQ1ZzID0gc2VsZi5jb2xsZWN0aW9uVmlld3M7XG4gICAgc2VsZi5jb2xsZWN0aW9uVmlld3MgPSBuZXcgTWFwKCk7XG4gICAgc2VsZi51c2VySWQgPSB1c2VySWQ7XG5cbiAgICAvLyBfc2V0VXNlcklkIGlzIG5vcm1hbGx5IGNhbGxlZCBmcm9tIGEgTWV0ZW9yIG1ldGhvZCB3aXRoXG4gICAgLy8gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbiBzZXQuIEJ1dCBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uIGlzIG5vdFxuICAgIC8vIGV4cGVjdGVkIHRvIGJlIHNldCBpbnNpZGUgYSBwdWJsaXNoIGZ1bmN0aW9uLCBzbyB3ZSB0ZW1wb3JhcnkgdW5zZXQgaXQuXG4gICAgLy8gSW5zaWRlIGEgcHVibGlzaCBmdW5jdGlvbiBERFAuX0N1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24gaXMgc2V0LlxuICAgIGF3YWl0IEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24ud2l0aFZhbHVlKHVuZGVmaW5lZCwgYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgLy8gU2F2ZSB0aGUgb2xkIG5hbWVkIHN1YnMsIGFuZCByZXNldCB0byBoYXZpbmcgbm8gc3Vic2NyaXB0aW9ucy5cbiAgICAgIHZhciBvbGROYW1lZFN1YnMgPSBzZWxmLl9uYW1lZFN1YnM7XG4gICAgICBzZWxmLl9uYW1lZFN1YnMgPSBuZXcgTWFwKCk7XG4gICAgICBzZWxmLl91bml2ZXJzYWxTdWJzID0gW107XG5cblxuXG4gICAgICBhd2FpdCBQcm9taXNlLmFsbChbLi4ub2xkTmFtZWRTdWJzXS5tYXAoYXN5bmMgKFtzdWJzY3JpcHRpb25JZCwgc3ViXSkgPT4ge1xuICAgICAgICBjb25zdCBuZXdTdWIgPSBzdWIuX3JlY3JlYXRlKCk7XG4gICAgICAgIHNlbGYuX25hbWVkU3Vicy5zZXQoc3Vic2NyaXB0aW9uSWQsIG5ld1N1Yik7XG4gICAgICAgIC8vIG5iOiBpZiB0aGUgaGFuZGxlciB0aHJvd3Mgb3IgY2FsbHMgdGhpcy5lcnJvcigpLCBpdCB3aWxsIGluIGZhY3RcbiAgICAgICAgLy8gaW1tZWRpYXRlbHkgc2VuZCBpdHMgJ25vc3ViJy4gVGhpcyBpcyBPSywgdGhvdWdoLlxuICAgICAgICBhd2FpdCBuZXdTdWIuX3J1bkhhbmRsZXIoKTtcbiAgICAgIH0pKTtcblxuICAgICAgLy8gQWxsb3cgbmV3bHktY3JlYXRlZCB1bml2ZXJzYWwgc3VicyB0byBiZSBzdGFydGVkIG9uIG91ciBjb25uZWN0aW9uIGluXG4gICAgICAvLyBwYXJhbGxlbCB3aXRoIHRoZSBvbmVzIHdlJ3JlIHNwaW5uaW5nIHVwIGhlcmUsIGFuZCBzcGluIHVwIHVuaXZlcnNhbFxuICAgICAgLy8gc3Vicy5cbiAgICAgIHNlbGYuX2RvbnRTdGFydE5ld1VuaXZlcnNhbFN1YnMgPSBmYWxzZTtcbiAgICAgIHNlbGYuc3RhcnRVbml2ZXJzYWxTdWJzKCk7XG4gICAgfSwgeyBuYW1lOiAnX3NldFVzZXJJZCcgfSk7XG5cbiAgICAvLyBTdGFydCBzZW5kaW5nIG1lc3NhZ2VzIGFnYWluLCBiZWdpbm5pbmcgd2l0aCB0aGUgZGlmZiBmcm9tIHRoZSBwcmV2aW91c1xuICAgIC8vIHN0YXRlIG9mIHRoZSB3b3JsZCB0byB0aGUgY3VycmVudCBzdGF0ZS4gTm8geWllbGRzIGFyZSBhbGxvd2VkIGR1cmluZ1xuICAgIC8vIHRoaXMgZGlmZiwgc28gdGhhdCBvdGhlciBjaGFuZ2VzIGNhbm5vdCBpbnRlcmxlYXZlLlxuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuX2lzU2VuZGluZyA9IHRydWU7XG4gICAgICBzZWxmLl9kaWZmQ29sbGVjdGlvblZpZXdzKGJlZm9yZUNWcyk7XG4gICAgICBpZiAoIWlzRW1wdHkoc2VsZi5fcGVuZGluZ1JlYWR5KSkge1xuICAgICAgICBzZWxmLnNlbmRSZWFkeShzZWxmLl9wZW5kaW5nUmVhZHkpO1xuICAgICAgICBzZWxmLl9wZW5kaW5nUmVhZHkgPSBbXTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcblxuICBfc3RhcnRTdWJzY3JpcHRpb246IGZ1bmN0aW9uIChoYW5kbGVyLCBzdWJJZCwgcGFyYW1zLCBuYW1lKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIHN1YiA9IG5ldyBTdWJzY3JpcHRpb24oXG4gICAgICBzZWxmLCBoYW5kbGVyLCBzdWJJZCwgcGFyYW1zLCBuYW1lKTtcblxuICAgIGxldCB1bmJsb2NrSGFuZGVyID0gc2VsZi5jYWNoZWRVbmJsb2NrO1xuICAgIC8vIF9zdGFydFN1YnNjcmlwdGlvbiBtYXkgY2FsbCBmcm9tIGEgbG90IHBsYWNlc1xuICAgIC8vIHNvIGNhY2hlZFVuYmxvY2sgbWlnaHQgYmUgbnVsbCBpbiBzb21lY2FzZXNcbiAgICAvLyBhc3NpZ24gdGhlIGNhY2hlZFVuYmxvY2tcbiAgICBzdWIudW5ibG9jayA9IHVuYmxvY2tIYW5kZXIgfHwgKCgpID0+IHt9KTtcblxuICAgIGlmIChzdWJJZClcbiAgICAgIHNlbGYuX25hbWVkU3Vicy5zZXQoc3ViSWQsIHN1Yik7XG4gICAgZWxzZVxuICAgICAgc2VsZi5fdW5pdmVyc2FsU3Vicy5wdXNoKHN1Yik7XG5cbiAgICByZXR1cm4gc3ViLl9ydW5IYW5kbGVyKCk7XG4gIH0sXG5cbiAgLy8gVGVhciBkb3duIHNwZWNpZmllZCBzdWJzY3JpcHRpb25cbiAgX3N0b3BTdWJzY3JpcHRpb246IGZ1bmN0aW9uIChzdWJJZCwgZXJyb3IpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgc3ViTmFtZSA9IG51bGw7XG4gICAgaWYgKHN1YklkKSB7XG4gICAgICB2YXIgbWF5YmVTdWIgPSBzZWxmLl9uYW1lZFN1YnMuZ2V0KHN1YklkKTtcbiAgICAgIGlmIChtYXliZVN1Yikge1xuICAgICAgICBzdWJOYW1lID0gbWF5YmVTdWIuX25hbWU7XG4gICAgICAgIG1heWJlU3ViLl9yZW1vdmVBbGxEb2N1bWVudHMoKTtcbiAgICAgICAgbWF5YmVTdWIuX2RlYWN0aXZhdGUoKTtcbiAgICAgICAgc2VsZi5fbmFtZWRTdWJzLmRlbGV0ZShzdWJJZCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHJlc3BvbnNlID0ge21zZzogJ25vc3ViJywgaWQ6IHN1YklkfTtcblxuICAgIGlmIChlcnJvcikge1xuICAgICAgcmVzcG9uc2UuZXJyb3IgPSB3cmFwSW50ZXJuYWxFeGNlcHRpb24oXG4gICAgICAgIGVycm9yLFxuICAgICAgICBzdWJOYW1lID8gKFwiZnJvbSBzdWIgXCIgKyBzdWJOYW1lICsgXCIgaWQgXCIgKyBzdWJJZClcbiAgICAgICAgICA6IChcImZyb20gc3ViIGlkIFwiICsgc3ViSWQpKTtcbiAgICB9XG5cbiAgICBzZWxmLnNlbmQocmVzcG9uc2UpO1xuICB9LFxuXG4gIC8vIFRlYXIgZG93biBhbGwgc3Vic2NyaXB0aW9ucy4gTm90ZSB0aGF0IHRoaXMgZG9lcyBOT1Qgc2VuZCByZW1vdmVkIG9yIG5vc3ViXG4gIC8vIG1lc3NhZ2VzLCBzaW5jZSB3ZSBhc3N1bWUgdGhlIGNsaWVudCBpcyBnb25lLlxuICBfZGVhY3RpdmF0ZUFsbFN1YnNjcmlwdGlvbnM6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBzZWxmLl9uYW1lZFN1YnMuZm9yRWFjaChmdW5jdGlvbiAoc3ViLCBpZCkge1xuICAgICAgc3ViLl9kZWFjdGl2YXRlKCk7XG4gICAgfSk7XG4gICAgc2VsZi5fbmFtZWRTdWJzID0gbmV3IE1hcCgpO1xuXG4gICAgc2VsZi5fdW5pdmVyc2FsU3Vicy5mb3JFYWNoKGZ1bmN0aW9uIChzdWIpIHtcbiAgICAgIHN1Yi5fZGVhY3RpdmF0ZSgpO1xuICAgIH0pO1xuICAgIHNlbGYuX3VuaXZlcnNhbFN1YnMgPSBbXTtcbiAgfSxcblxuICAvLyBEZXRlcm1pbmUgdGhlIHJlbW90ZSBjbGllbnQncyBJUCBhZGRyZXNzLCBiYXNlZCBvbiB0aGVcbiAgLy8gSFRUUF9GT1JXQVJERURfQ09VTlQgZW52aXJvbm1lbnQgdmFyaWFibGUgcmVwcmVzZW50aW5nIGhvdyBtYW55XG4gIC8vIHByb3hpZXMgdGhlIHNlcnZlciBpcyBiZWhpbmQuXG4gIF9jbGllbnRBZGRyZXNzOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gRm9yIHRoZSByZXBvcnRlZCBjbGllbnQgYWRkcmVzcyBmb3IgYSBjb25uZWN0aW9uIHRvIGJlIGNvcnJlY3QsXG4gICAgLy8gdGhlIGRldmVsb3BlciBtdXN0IHNldCB0aGUgSFRUUF9GT1JXQVJERURfQ09VTlQgZW52aXJvbm1lbnRcbiAgICAvLyB2YXJpYWJsZSB0byBhbiBpbnRlZ2VyIHJlcHJlc2VudGluZyB0aGUgbnVtYmVyIG9mIGhvcHMgdGhleVxuICAgIC8vIGV4cGVjdCBpbiB0aGUgYHgtZm9yd2FyZGVkLWZvcmAgaGVhZGVyLiBFLmcuLCBzZXQgdG8gXCIxXCIgaWYgdGhlXG4gICAgLy8gc2VydmVyIGlzIGJlaGluZCBvbmUgcHJveHkuXG4gICAgLy9cbiAgICAvLyBUaGlzIGNvdWxkIGJlIGNvbXB1dGVkIG9uY2UgYXQgc3RhcnR1cCBpbnN0ZWFkIG9mIGV2ZXJ5IHRpbWUuXG4gICAgdmFyIGh0dHBGb3J3YXJkZWRDb3VudCA9IHBhcnNlSW50KHByb2Nlc3MuZW52WydIVFRQX0ZPUldBUkRFRF9DT1VOVCddKSB8fCAwO1xuXG4gICAgaWYgKGh0dHBGb3J3YXJkZWRDb3VudCA9PT0gMClcbiAgICAgIHJldHVybiBzZWxmLnNvY2tldC5yZW1vdGVBZGRyZXNzO1xuXG4gICAgdmFyIGZvcndhcmRlZEZvciA9IHNlbGYuc29ja2V0LmhlYWRlcnNbXCJ4LWZvcndhcmRlZC1mb3JcIl07XG4gICAgaWYgKCFpc1N0cmluZyhmb3J3YXJkZWRGb3IpKVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgZm9yd2FyZGVkRm9yID0gZm9yd2FyZGVkRm9yLnRyaW0oKS5zcGxpdCgvXFxzKixcXHMqLyk7XG5cbiAgICAvLyBUeXBpY2FsbHkgdGhlIGZpcnN0IHZhbHVlIGluIHRoZSBgeC1mb3J3YXJkZWQtZm9yYCBoZWFkZXIgaXNcbiAgICAvLyB0aGUgb3JpZ2luYWwgSVAgYWRkcmVzcyBvZiB0aGUgY2xpZW50IGNvbm5lY3RpbmcgdG8gdGhlIGZpcnN0XG4gICAgLy8gcHJveHkuICBIb3dldmVyLCB0aGUgZW5kIHVzZXIgY2FuIGVhc2lseSBzcG9vZiB0aGUgaGVhZGVyLCBpblxuICAgIC8vIHdoaWNoIGNhc2UgdGhlIGZpcnN0IHZhbHVlKHMpIHdpbGwgYmUgdGhlIGZha2UgSVAgYWRkcmVzcyBmcm9tXG4gICAgLy8gdGhlIHVzZXIgcHJldGVuZGluZyB0byBiZSBhIHByb3h5IHJlcG9ydGluZyB0aGUgb3JpZ2luYWwgSVBcbiAgICAvLyBhZGRyZXNzIHZhbHVlLiAgQnkgY291bnRpbmcgSFRUUF9GT1JXQVJERURfQ09VTlQgYmFjayBmcm9tIHRoZVxuICAgIC8vIGVuZCBvZiB0aGUgbGlzdCwgd2UgZW5zdXJlIHRoYXQgd2UgZ2V0IHRoZSBJUCBhZGRyZXNzIGJlaW5nXG4gICAgLy8gcmVwb3J0ZWQgYnkgKm91ciogZmlyc3QgcHJveHkuXG5cbiAgICBpZiAoaHR0cEZvcndhcmRlZENvdW50IDwgMCB8fCBodHRwRm9yd2FyZGVkQ291bnQgPiBmb3J3YXJkZWRGb3IubGVuZ3RoKVxuICAgICAgcmV0dXJuIG51bGw7XG5cbiAgICByZXR1cm4gZm9yd2FyZGVkRm9yW2ZvcndhcmRlZEZvci5sZW5ndGggLSBodHRwRm9yd2FyZGVkQ291bnRdO1xuICB9XG59KTtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8qIFN1YnNjcmlwdGlvbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICovXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vLyBDdG9yIGZvciBhIHN1YiBoYW5kbGU6IHRoZSBpbnB1dCB0byBlYWNoIHB1Ymxpc2ggZnVuY3Rpb25cblxuLy8gSW5zdGFuY2UgbmFtZSBpcyB0aGlzIGJlY2F1c2UgaXQncyB1c3VhbGx5IHJlZmVycmVkIHRvIGFzIHRoaXMgaW5zaWRlIGFcbi8vIHB1Ymxpc2hcbi8qKlxuICogQHN1bW1hcnkgVGhlIHNlcnZlcidzIHNpZGUgb2YgYSBzdWJzY3JpcHRpb25cbiAqIEBjbGFzcyBTdWJzY3JpcHRpb25cbiAqIEBpbnN0YW5jZU5hbWUgdGhpc1xuICogQHNob3dJbnN0YW5jZU5hbWUgdHJ1ZVxuICovXG52YXIgU3Vic2NyaXB0aW9uID0gZnVuY3Rpb24gKFxuICAgIHNlc3Npb24sIGhhbmRsZXIsIHN1YnNjcmlwdGlvbklkLCBwYXJhbXMsIG5hbWUpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLl9zZXNzaW9uID0gc2Vzc2lvbjsgLy8gdHlwZSBpcyBTZXNzaW9uXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEFjY2VzcyBpbnNpZGUgdGhlIHB1Ymxpc2ggZnVuY3Rpb24uIFRoZSBpbmNvbWluZyBbY29ubmVjdGlvbl0oI21ldGVvcl9vbmNvbm5lY3Rpb24pIGZvciB0aGlzIHN1YnNjcmlwdGlvbi5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAbmFtZSAgY29ubmVjdGlvblxuICAgKiBAbWVtYmVyT2YgU3Vic2NyaXB0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKi9cbiAgc2VsZi5jb25uZWN0aW9uID0gc2Vzc2lvbi5jb25uZWN0aW9uSGFuZGxlOyAvLyBwdWJsaWMgQVBJIG9iamVjdFxuXG4gIHNlbGYuX2hhbmRsZXIgPSBoYW5kbGVyO1xuXG4gIC8vIE15IHN1YnNjcmlwdGlvbiBJRCAoZ2VuZXJhdGVkIGJ5IGNsaWVudCwgdW5kZWZpbmVkIGZvciB1bml2ZXJzYWwgc3VicykuXG4gIHNlbGYuX3N1YnNjcmlwdGlvbklkID0gc3Vic2NyaXB0aW9uSWQ7XG4gIC8vIFVuZGVmaW5lZCBmb3IgdW5pdmVyc2FsIHN1YnNcbiAgc2VsZi5fbmFtZSA9IG5hbWU7XG5cbiAgc2VsZi5fcGFyYW1zID0gcGFyYW1zIHx8IFtdO1xuXG4gIC8vIE9ubHkgbmFtZWQgc3Vic2NyaXB0aW9ucyBoYXZlIElEcywgYnV0IHdlIG5lZWQgc29tZSBzb3J0IG9mIHN0cmluZ1xuICAvLyBpbnRlcm5hbGx5IHRvIGtlZXAgdHJhY2sgb2YgYWxsIHN1YnNjcmlwdGlvbnMgaW5zaWRlXG4gIC8vIFNlc3Npb25Eb2N1bWVudFZpZXdzLiBXZSB1c2UgdGhpcyBzdWJzY3JpcHRpb25IYW5kbGUgZm9yIHRoYXQuXG4gIGlmIChzZWxmLl9zdWJzY3JpcHRpb25JZCkge1xuICAgIHNlbGYuX3N1YnNjcmlwdGlvbkhhbmRsZSA9ICdOJyArIHNlbGYuX3N1YnNjcmlwdGlvbklkO1xuICB9IGVsc2Uge1xuICAgIHNlbGYuX3N1YnNjcmlwdGlvbkhhbmRsZSA9ICdVJyArIFJhbmRvbS5pZCgpO1xuICB9XG5cbiAgLy8gSGFzIF9kZWFjdGl2YXRlIGJlZW4gY2FsbGVkP1xuICBzZWxmLl9kZWFjdGl2YXRlZCA9IGZhbHNlO1xuXG4gIC8vIFN0b3AgY2FsbGJhY2tzIHRvIGcvYyB0aGlzIHN1Yi4gIGNhbGxlZCB3LyB6ZXJvIGFyZ3VtZW50cy5cbiAgc2VsZi5fc3RvcENhbGxiYWNrcyA9IFtdO1xuXG4gIC8vIFRoZSBzZXQgb2YgKGNvbGxlY3Rpb24sIGRvY3VtZW50aWQpIHRoYXQgdGhpcyBzdWJzY3JpcHRpb24gaGFzXG4gIC8vIGFuIG9waW5pb24gYWJvdXQuXG4gIHNlbGYuX2RvY3VtZW50cyA9IG5ldyBNYXAoKTtcblxuICAvLyBSZW1lbWJlciBpZiB3ZSBhcmUgcmVhZHkuXG4gIHNlbGYuX3JlYWR5ID0gZmFsc2U7XG5cbiAgLy8gUGFydCBvZiB0aGUgcHVibGljIEFQSTogdGhlIHVzZXIgb2YgdGhpcyBzdWIuXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEFjY2VzcyBpbnNpZGUgdGhlIHB1Ymxpc2ggZnVuY3Rpb24uIFRoZSBpZCBvZiB0aGUgbG9nZ2VkLWluIHVzZXIsIG9yIGBudWxsYCBpZiBubyB1c2VyIGlzIGxvZ2dlZCBpbi5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAbWVtYmVyT2YgU3Vic2NyaXB0aW9uXG4gICAqIEBuYW1lICB1c2VySWRcbiAgICogQGluc3RhbmNlXG4gICAqL1xuICBzZWxmLnVzZXJJZCA9IHNlc3Npb24udXNlcklkO1xuXG4gIC8vIEZvciBub3csIHRoZSBpZCBmaWx0ZXIgaXMgZ29pbmcgdG8gZGVmYXVsdCB0b1xuICAvLyB0aGUgdG8vZnJvbSBERFAgbWV0aG9kcyBvbiBNb25nb0lELCB0b1xuICAvLyBzcGVjaWZpY2FsbHkgZGVhbCB3aXRoIG1vbmdvL21pbmltb25nbyBPYmplY3RJZHMuXG5cbiAgLy8gTGF0ZXIsIHlvdSB3aWxsIGJlIGFibGUgdG8gbWFrZSB0aGlzIGJlIFwicmF3XCJcbiAgLy8gaWYgeW91IHdhbnQgdG8gcHVibGlzaCBhIGNvbGxlY3Rpb24gdGhhdCB5b3Uga25vd1xuICAvLyBqdXN0IGhhcyBzdHJpbmdzIGZvciBrZXlzIGFuZCBubyBmdW5ueSBidXNpbmVzcywgdG9cbiAgLy8gYSBERFAgY29uc3VtZXIgdGhhdCBpc24ndCBtaW5pbW9uZ28uXG5cbiAgc2VsZi5faWRGaWx0ZXIgPSB7XG4gICAgaWRTdHJpbmdpZnk6IE1vbmdvSUQuaWRTdHJpbmdpZnksXG4gICAgaWRQYXJzZTogTW9uZ29JRC5pZFBhcnNlXG4gIH07XG5cbiAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgIFwibGl2ZWRhdGFcIiwgXCJzdWJzY3JpcHRpb25zXCIsIDEpO1xufTtcblxuT2JqZWN0LmFzc2lnbihTdWJzY3JpcHRpb24ucHJvdG90eXBlLCB7XG4gIF9ydW5IYW5kbGVyOiBhc3luYyBmdW5jdGlvbigpIHtcbiAgICAvLyBYWFggc2hvdWxkIHdlIHVuYmxvY2soKSBoZXJlPyBFaXRoZXIgYmVmb3JlIHJ1bm5pbmcgdGhlIHB1Ymxpc2hcbiAgICAvLyBmdW5jdGlvbiwgb3IgYmVmb3JlIHJ1bm5pbmcgX3B1Ymxpc2hDdXJzb3IuXG4gICAgLy9cbiAgICAvLyBSaWdodCBub3csIGVhY2ggcHVibGlzaCBmdW5jdGlvbiBibG9ja3MgYWxsIGZ1dHVyZSBwdWJsaXNoZXMgYW5kXG4gICAgLy8gbWV0aG9kcyB3YWl0aW5nIG9uIGRhdGEgZnJvbSBNb25nbyAob3Igd2hhdGV2ZXIgZWxzZSB0aGUgZnVuY3Rpb25cbiAgICAvLyBibG9ja3Mgb24pLiBUaGlzIHByb2JhYmx5IHNsb3dzIHBhZ2UgbG9hZCBpbiBjb21tb24gY2FzZXMuXG5cbiAgICBpZiAoIXRoaXMudW5ibG9jaykge1xuICAgICAgdGhpcy51bmJsb2NrID0gKCkgPT4ge307XG4gICAgfVxuXG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgbGV0IHJlc3VsdE9yVGhlbmFibGUgPSBudWxsO1xuICAgIHRyeSB7XG4gICAgICByZXN1bHRPclRoZW5hYmxlID0gRERQLl9DdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uLndpdGhWYWx1ZShcbiAgICAgICAgc2VsZixcbiAgICAgICAgKCkgPT5cbiAgICAgICAgICBtYXliZUF1ZGl0QXJndW1lbnRDaGVja3MoXG4gICAgICAgICAgICBzZWxmLl9oYW5kbGVyLFxuICAgICAgICAgICAgc2VsZixcbiAgICAgICAgICAgIEVKU09OLmNsb25lKHNlbGYuX3BhcmFtcyksXG4gICAgICAgICAgICAvLyBJdCdzIE9LIHRoYXQgdGhpcyB3b3VsZCBsb29rIHdlaXJkIGZvciB1bml2ZXJzYWwgc3Vic2NyaXB0aW9ucyxcbiAgICAgICAgICAgIC8vIGJlY2F1c2UgdGhleSBoYXZlIG5vIGFyZ3VtZW50cyBzbyB0aGVyZSBjYW4gbmV2ZXIgYmUgYW5cbiAgICAgICAgICAgIC8vIGF1ZGl0LWFyZ3VtZW50LWNoZWNrcyBmYWlsdXJlLlxuICAgICAgICAgICAgXCJwdWJsaXNoZXIgJ1wiICsgc2VsZi5fbmFtZSArIFwiJ1wiXG4gICAgICAgICAgKSxcbiAgICAgICAgeyBuYW1lOiBzZWxmLl9uYW1lIH1cbiAgICAgICk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgc2VsZi5lcnJvcihlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBEaWQgdGhlIGhhbmRsZXIgY2FsbCB0aGlzLmVycm9yIG9yIHRoaXMuc3RvcD9cbiAgICBpZiAoc2VsZi5faXNEZWFjdGl2YXRlZCgpKSByZXR1cm47XG5cbiAgICAvLyBCb3RoIGNvbnZlbnRpb25hbCBhbmQgYXN5bmMgcHVibGlzaCBoYW5kbGVyIGZ1bmN0aW9ucyBhcmUgc3VwcG9ydGVkLlxuICAgIC8vIElmIGFuIG9iamVjdCBpcyByZXR1cm5lZCB3aXRoIGEgdGhlbigpIGZ1bmN0aW9uLCBpdCBpcyBlaXRoZXIgYSBwcm9taXNlXG4gICAgLy8gb3IgdGhlbmFibGUgYW5kIHdpbGwgYmUgcmVzb2x2ZWQgYXN5bmNocm9ub3VzbHkuXG4gICAgY29uc3QgaXNUaGVuYWJsZSA9XG4gICAgICByZXN1bHRPclRoZW5hYmxlICYmIHR5cGVvZiByZXN1bHRPclRoZW5hYmxlLnRoZW4gPT09ICdmdW5jdGlvbic7XG4gICAgaWYgKGlzVGhlbmFibGUpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHNlbGYuX3B1Ymxpc2hIYW5kbGVyUmVzdWx0KGF3YWl0IHJlc3VsdE9yVGhlbmFibGUpO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHNlbGYuZXJyb3IoZSlcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgYXdhaXQgc2VsZi5fcHVibGlzaEhhbmRsZXJSZXN1bHQocmVzdWx0T3JUaGVuYWJsZSk7XG4gICAgfVxuICB9LFxuXG4gIGFzeW5jIF9wdWJsaXNoSGFuZGxlclJlc3VsdCAocmVzKSB7XG4gICAgLy8gU1BFQ0lBTCBDQVNFOiBJbnN0ZWFkIG9mIHdyaXRpbmcgdGhlaXIgb3duIGNhbGxiYWNrcyB0aGF0IGludm9rZVxuICAgIC8vIHRoaXMuYWRkZWQvY2hhbmdlZC9yZWFkeS9ldGMsIHRoZSB1c2VyIGNhbiBqdXN0IHJldHVybiBhIGNvbGxlY3Rpb25cbiAgICAvLyBjdXJzb3Igb3IgYXJyYXkgb2YgY3Vyc29ycyBmcm9tIHRoZSBwdWJsaXNoIGZ1bmN0aW9uOyB3ZSBjYWxsIHRoZWlyXG4gICAgLy8gX3B1Ymxpc2hDdXJzb3IgbWV0aG9kIHdoaWNoIHN0YXJ0cyBvYnNlcnZpbmcgdGhlIGN1cnNvciBhbmQgcHVibGlzaGVzIHRoZVxuICAgIC8vIHJlc3VsdHMuIE5vdGUgdGhhdCBfcHVibGlzaEN1cnNvciBkb2VzIE5PVCBjYWxsIHJlYWR5KCkuXG4gICAgLy9cbiAgICAvLyBYWFggVGhpcyB1c2VzIGFuIHVuZG9jdW1lbnRlZCBpbnRlcmZhY2Ugd2hpY2ggb25seSB0aGUgTW9uZ28gY3Vyc29yXG4gICAgLy8gaW50ZXJmYWNlIHB1Ymxpc2hlcy4gU2hvdWxkIHdlIG1ha2UgdGhpcyBpbnRlcmZhY2UgcHVibGljIGFuZCBlbmNvdXJhZ2VcbiAgICAvLyB1c2VycyB0byBpbXBsZW1lbnQgaXQgdGhlbXNlbHZlcz8gQXJndWFibHksIGl0J3MgdW5uZWNlc3Nhcnk7IHVzZXJzIGNhblxuICAgIC8vIGFscmVhZHkgd3JpdGUgdGhlaXIgb3duIGZ1bmN0aW9ucyBsaWtlXG4gICAgLy8gICB2YXIgcHVibGlzaE15UmVhY3RpdmVUaGluZ3kgPSBmdW5jdGlvbiAobmFtZSwgaGFuZGxlcikge1xuICAgIC8vICAgICBNZXRlb3IucHVibGlzaChuYW1lLCBmdW5jdGlvbiAoKSB7XG4gICAgLy8gICAgICAgdmFyIHJlYWN0aXZlVGhpbmd5ID0gaGFuZGxlcigpO1xuICAgIC8vICAgICAgIHJlYWN0aXZlVGhpbmd5LnB1Ymxpc2hNZSgpO1xuICAgIC8vICAgICB9KTtcbiAgICAvLyAgIH07XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGlzQ3Vyc29yID0gZnVuY3Rpb24gKGMpIHtcbiAgICAgIHJldHVybiBjICYmIGMuX3B1Ymxpc2hDdXJzb3I7XG4gICAgfTtcbiAgICBpZiAoaXNDdXJzb3IocmVzKSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgcmVzLl9wdWJsaXNoQ3Vyc29yKHNlbGYpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBzZWxmLmVycm9yKGUpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICAvLyBfcHVibGlzaEN1cnNvciBvbmx5IHJldHVybnMgYWZ0ZXIgdGhlIGluaXRpYWwgYWRkZWQgY2FsbGJhY2tzIGhhdmUgcnVuLlxuICAgICAgLy8gbWFyayBzdWJzY3JpcHRpb24gYXMgcmVhZHkuXG4gICAgICBzZWxmLnJlYWR5KCk7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHJlcykpIHtcbiAgICAgIC8vIENoZWNrIGFsbCB0aGUgZWxlbWVudHMgYXJlIGN1cnNvcnNcbiAgICAgIGlmICghIHJlcy5ldmVyeShpc0N1cnNvcikpIHtcbiAgICAgICAgc2VsZi5lcnJvcihuZXcgRXJyb3IoXCJQdWJsaXNoIGZ1bmN0aW9uIHJldHVybmVkIGFuIGFycmF5IG9mIG5vbi1DdXJzb3JzXCIpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgLy8gRmluZCBkdXBsaWNhdGUgY29sbGVjdGlvbiBuYW1lc1xuICAgICAgLy8gWFhYIHdlIHNob3VsZCBzdXBwb3J0IG92ZXJsYXBwaW5nIGN1cnNvcnMsIGJ1dCB0aGF0IHdvdWxkIHJlcXVpcmUgdGhlXG4gICAgICAvLyBtZXJnZSBib3ggdG8gYWxsb3cgb3ZlcmxhcCB3aXRoaW4gYSBzdWJzY3JpcHRpb25cbiAgICAgIHZhciBjb2xsZWN0aW9uTmFtZXMgPSB7fTtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gcmVzW2ldLl9nZXRDb2xsZWN0aW9uTmFtZSgpO1xuICAgICAgICBpZiAoY29sbGVjdGlvbk5hbWVzW2NvbGxlY3Rpb25OYW1lXSkge1xuICAgICAgICAgIHNlbGYuZXJyb3IobmV3IEVycm9yKFxuICAgICAgICAgICAgXCJQdWJsaXNoIGZ1bmN0aW9uIHJldHVybmVkIG11bHRpcGxlIGN1cnNvcnMgZm9yIGNvbGxlY3Rpb24gXCIgK1xuICAgICAgICAgICAgICBjb2xsZWN0aW9uTmFtZSkpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb2xsZWN0aW9uTmFtZXNbY29sbGVjdGlvbk5hbWVdID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwocmVzLm1hcChjdXIgPT4gY3VyLl9wdWJsaXNoQ3Vyc29yKHNlbGYpKSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHNlbGYuZXJyb3IoZSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHNlbGYucmVhZHkoKTtcbiAgICB9IGVsc2UgaWYgKHJlcykge1xuICAgICAgLy8gVHJ1dGh5IHZhbHVlcyBvdGhlciB0aGFuIGN1cnNvcnMgb3IgYXJyYXlzIGFyZSBwcm9iYWJseSBhXG4gICAgICAvLyB1c2VyIG1pc3Rha2UgKHBvc3NpYmxlIHJldHVybmluZyBhIE1vbmdvIGRvY3VtZW50IHZpYSwgc2F5LFxuICAgICAgLy8gYGNvbGwuZmluZE9uZSgpYCkuXG4gICAgICBzZWxmLmVycm9yKG5ldyBFcnJvcihcIlB1Ymxpc2ggZnVuY3Rpb24gY2FuIG9ubHkgcmV0dXJuIGEgQ3Vyc29yIG9yIFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICArIFwiYW4gYXJyYXkgb2YgQ3Vyc29yc1wiKSk7XG4gICAgfVxuICB9LFxuXG4gIC8vIFRoaXMgY2FsbHMgYWxsIHN0b3AgY2FsbGJhY2tzIGFuZCBwcmV2ZW50cyB0aGUgaGFuZGxlciBmcm9tIHVwZGF0aW5nIGFueVxuICAvLyBTZXNzaW9uQ29sbGVjdGlvblZpZXdzIGZ1cnRoZXIuIEl0J3MgdXNlZCB3aGVuIHRoZSB1c2VyIHVuc3Vic2NyaWJlcyBvclxuICAvLyBkaXNjb25uZWN0cywgYXMgd2VsbCBhcyBkdXJpbmcgc2V0VXNlcklkIHJlLXJ1bnMuIEl0IGRvZXMgKk5PVCogc2VuZFxuICAvLyByZW1vdmVkIG1lc3NhZ2VzIGZvciB0aGUgcHVibGlzaGVkIG9iamVjdHM7IGlmIHRoYXQgaXMgbmVjZXNzYXJ5LCBjYWxsXG4gIC8vIF9yZW1vdmVBbGxEb2N1bWVudHMgZmlyc3QuXG4gIF9kZWFjdGl2YXRlOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2RlYWN0aXZhdGVkKVxuICAgICAgcmV0dXJuO1xuICAgIHNlbGYuX2RlYWN0aXZhdGVkID0gdHJ1ZTtcbiAgICBzZWxmLl9jYWxsU3RvcENhbGxiYWNrcygpO1xuICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgIFwibGl2ZWRhdGFcIiwgXCJzdWJzY3JpcHRpb25zXCIsIC0xKTtcbiAgfSxcblxuICBfY2FsbFN0b3BDYWxsYmFja3M6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgLy8gVGVsbCBsaXN0ZW5lcnMsIHNvIHRoZXkgY2FuIGNsZWFuIHVwXG4gICAgdmFyIGNhbGxiYWNrcyA9IHNlbGYuX3N0b3BDYWxsYmFja3M7XG4gICAgc2VsZi5fc3RvcENhbGxiYWNrcyA9IFtdO1xuICAgIGNhbGxiYWNrcy5mb3JFYWNoKGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgY2FsbGJhY2soKTtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBTZW5kIHJlbW92ZSBtZXNzYWdlcyBmb3IgZXZlcnkgZG9jdW1lbnQuXG4gIF9yZW1vdmVBbGxEb2N1bWVudHM6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5fZG9jdW1lbnRzLmZvckVhY2goZnVuY3Rpb24gKGNvbGxlY3Rpb25Eb2NzLCBjb2xsZWN0aW9uTmFtZSkge1xuICAgICAgICBjb2xsZWN0aW9uRG9jcy5mb3JFYWNoKGZ1bmN0aW9uIChzdHJJZCkge1xuICAgICAgICAgIHNlbGYucmVtb3ZlZChjb2xsZWN0aW9uTmFtZSwgc2VsZi5faWRGaWx0ZXIuaWRQYXJzZShzdHJJZCkpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9LFxuXG4gIC8vIFJldHVybnMgYSBuZXcgU3Vic2NyaXB0aW9uIGZvciB0aGUgc2FtZSBzZXNzaW9uIHdpdGggdGhlIHNhbWVcbiAgLy8gaW5pdGlhbCBjcmVhdGlvbiBwYXJhbWV0ZXJzLiBUaGlzIGlzbid0IGEgY2xvbmU6IGl0IGRvZXNuJ3QgaGF2ZVxuICAvLyB0aGUgc2FtZSBfZG9jdW1lbnRzIGNhY2hlLCBzdG9wcGVkIHN0YXRlIG9yIGNhbGxiYWNrczsgbWF5IGhhdmUgYVxuICAvLyBkaWZmZXJlbnQgX3N1YnNjcmlwdGlvbkhhbmRsZSwgYW5kIGdldHMgaXRzIHVzZXJJZCBmcm9tIHRoZVxuICAvLyBzZXNzaW9uLCBub3QgZnJvbSB0aGlzIG9iamVjdC5cbiAgX3JlY3JlYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBuZXcgU3Vic2NyaXB0aW9uKFxuICAgICAgc2VsZi5fc2Vzc2lvbiwgc2VsZi5faGFuZGxlciwgc2VsZi5fc3Vic2NyaXB0aW9uSWQsIHNlbGYuX3BhcmFtcyxcbiAgICAgIHNlbGYuX25hbWUpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDYWxsIGluc2lkZSB0aGUgcHVibGlzaCBmdW5jdGlvbi4gIFN0b3BzIHRoaXMgY2xpZW50J3Mgc3Vic2NyaXB0aW9uLCB0cmlnZ2VyaW5nIGEgY2FsbCBvbiB0aGUgY2xpZW50IHRvIHRoZSBgb25TdG9wYCBjYWxsYmFjayBwYXNzZWQgdG8gW2BNZXRlb3Iuc3Vic2NyaWJlYF0oI21ldGVvcl9zdWJzY3JpYmUpLCBpZiBhbnkuIElmIGBlcnJvcmAgaXMgbm90IGEgW2BNZXRlb3IuRXJyb3JgXSgjbWV0ZW9yX2Vycm9yKSwgaXQgd2lsbCBiZSBbc2FuaXRpemVkXSgjbWV0ZW9yX2Vycm9yKS5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAcGFyYW0ge0Vycm9yfSBlcnJvciBUaGUgZXJyb3IgdG8gcGFzcyB0byB0aGUgY2xpZW50LlxuICAgKiBAaW5zdGFuY2VcbiAgICogQG1lbWJlck9mIFN1YnNjcmlwdGlvblxuICAgKi9cbiAgZXJyb3I6IGZ1bmN0aW9uIChlcnJvcikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5faXNEZWFjdGl2YXRlZCgpKVxuICAgICAgcmV0dXJuO1xuICAgIHNlbGYuX3Nlc3Npb24uX3N0b3BTdWJzY3JpcHRpb24oc2VsZi5fc3Vic2NyaXB0aW9uSWQsIGVycm9yKTtcbiAgfSxcblxuICAvLyBOb3RlIHRoYXQgd2hpbGUgb3VyIEREUCBjbGllbnQgd2lsbCBub3RpY2UgdGhhdCB5b3UndmUgY2FsbGVkIHN0b3AoKSBvbiB0aGVcbiAgLy8gc2VydmVyIChhbmQgY2xlYW4gdXAgaXRzIF9zdWJzY3JpcHRpb25zIHRhYmxlKSB3ZSBkb24ndCBhY3R1YWxseSBwcm92aWRlIGFcbiAgLy8gbWVjaGFuaXNtIGZvciBhbiBhcHAgdG8gbm90aWNlIHRoaXMgKHRoZSBzdWJzY3JpYmUgb25FcnJvciBjYWxsYmFjayBvbmx5XG4gIC8vIHRyaWdnZXJzIGlmIHRoZXJlIGlzIGFuIGVycm9yKS5cblxuICAvKipcbiAgICogQHN1bW1hcnkgQ2FsbCBpbnNpZGUgdGhlIHB1Ymxpc2ggZnVuY3Rpb24uICBTdG9wcyB0aGlzIGNsaWVudCdzIHN1YnNjcmlwdGlvbiBhbmQgaW52b2tlcyB0aGUgY2xpZW50J3MgYG9uU3RvcGAgY2FsbGJhY2sgd2l0aCBubyBlcnJvci5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAaW5zdGFuY2VcbiAgICogQG1lbWJlck9mIFN1YnNjcmlwdGlvblxuICAgKi9cbiAgc3RvcDogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5faXNEZWFjdGl2YXRlZCgpKVxuICAgICAgcmV0dXJuO1xuICAgIHNlbGYuX3Nlc3Npb24uX3N0b3BTdWJzY3JpcHRpb24oc2VsZi5fc3Vic2NyaXB0aW9uSWQpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDYWxsIGluc2lkZSB0aGUgcHVibGlzaCBmdW5jdGlvbi4gIFJlZ2lzdGVycyBhIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIHJ1biB3aGVuIHRoZSBzdWJzY3JpcHRpb24gaXMgc3RvcHBlZC5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAbWVtYmVyT2YgU3Vic2NyaXB0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBjYWxsYmFjayBmdW5jdGlvblxuICAgKi9cbiAgb25TdG9wOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgY2FsbGJhY2sgPSBNZXRlb3IuYmluZEVudmlyb25tZW50KGNhbGxiYWNrLCAnb25TdG9wIGNhbGxiYWNrJywgc2VsZik7XG4gICAgaWYgKHNlbGYuX2lzRGVhY3RpdmF0ZWQoKSlcbiAgICAgIGNhbGxiYWNrKCk7XG4gICAgZWxzZVxuICAgICAgc2VsZi5fc3RvcENhbGxiYWNrcy5wdXNoKGNhbGxiYWNrKTtcbiAgfSxcblxuICAvLyBUaGlzIHJldHVybnMgdHJ1ZSBpZiB0aGUgc3ViIGhhcyBiZWVuIGRlYWN0aXZhdGVkLCAqT1IqIGlmIHRoZSBzZXNzaW9uIHdhc1xuICAvLyBkZXN0cm95ZWQgYnV0IHRoZSBkZWZlcnJlZCBjYWxsIHRvIF9kZWFjdGl2YXRlQWxsU3Vic2NyaXB0aW9ucyBoYXNuJ3RcbiAgLy8gaGFwcGVuZWQgeWV0LlxuICBfaXNEZWFjdGl2YXRlZDogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gc2VsZi5fZGVhY3RpdmF0ZWQgfHwgc2VsZi5fc2Vzc2lvbi5pblF1ZXVlID09PSBudWxsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDYWxsIGluc2lkZSB0aGUgcHVibGlzaCBmdW5jdGlvbi4gIEluZm9ybXMgdGhlIHN1YnNjcmliZXIgdGhhdCBhIGRvY3VtZW50IGhhcyBiZWVuIGFkZGVkIHRvIHRoZSByZWNvcmQgc2V0LlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBtZW1iZXJPZiBTdWJzY3JpcHRpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBuYW1lIG9mIHRoZSBjb2xsZWN0aW9uIHRoYXQgY29udGFpbnMgdGhlIG5ldyBkb2N1bWVudC5cbiAgICogQHBhcmFtIHtTdHJpbmd9IGlkIFRoZSBuZXcgZG9jdW1lbnQncyBJRC5cbiAgICogQHBhcmFtIHtPYmplY3R9IGZpZWxkcyBUaGUgZmllbGRzIGluIHRoZSBuZXcgZG9jdW1lbnQuICBJZiBgX2lkYCBpcyBwcmVzZW50IGl0IGlzIGlnbm9yZWQuXG4gICAqL1xuICBhZGRlZCAoY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpIHtcbiAgICBpZiAodGhpcy5faXNEZWFjdGl2YXRlZCgpKVxuICAgICAgcmV0dXJuO1xuICAgIGlkID0gdGhpcy5faWRGaWx0ZXIuaWRTdHJpbmdpZnkoaWQpO1xuXG4gICAgaWYgKHRoaXMuX3Nlc3Npb24uc2VydmVyLmdldFB1YmxpY2F0aW9uU3RyYXRlZ3koY29sbGVjdGlvbk5hbWUpLmRvQWNjb3VudGluZ0ZvckNvbGxlY3Rpb24pIHtcbiAgICAgIGxldCBpZHMgPSB0aGlzLl9kb2N1bWVudHMuZ2V0KGNvbGxlY3Rpb25OYW1lKTtcbiAgICAgIGlmIChpZHMgPT0gbnVsbCkge1xuICAgICAgICBpZHMgPSBuZXcgU2V0KCk7XG4gICAgICAgIHRoaXMuX2RvY3VtZW50cy5zZXQoY29sbGVjdGlvbk5hbWUsIGlkcyk7XG4gICAgICB9XG4gICAgICBpZHMuYWRkKGlkKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zZXNzaW9uLmFkZGVkKHRoaXMuX3N1YnNjcmlwdGlvbkhhbmRsZSwgY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDYWxsIGluc2lkZSB0aGUgcHVibGlzaCBmdW5jdGlvbi4gIEluZm9ybXMgdGhlIHN1YnNjcmliZXIgdGhhdCBhIGRvY3VtZW50IGluIHRoZSByZWNvcmQgc2V0IGhhcyBiZWVuIG1vZGlmaWVkLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBtZW1iZXJPZiBTdWJzY3JpcHRpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBuYW1lIG9mIHRoZSBjb2xsZWN0aW9uIHRoYXQgY29udGFpbnMgdGhlIGNoYW5nZWQgZG9jdW1lbnQuXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBpZCBUaGUgY2hhbmdlZCBkb2N1bWVudCdzIElELlxuICAgKiBAcGFyYW0ge09iamVjdH0gZmllbGRzIFRoZSBmaWVsZHMgaW4gdGhlIGRvY3VtZW50IHRoYXQgaGF2ZSBjaGFuZ2VkLCB0b2dldGhlciB3aXRoIHRoZWlyIG5ldyB2YWx1ZXMuICBJZiBhIGZpZWxkIGlzIG5vdCBwcmVzZW50IGluIGBmaWVsZHNgIGl0IHdhcyBsZWZ0IHVuY2hhbmdlZDsgaWYgaXQgaXMgcHJlc2VudCBpbiBgZmllbGRzYCBhbmQgaGFzIGEgdmFsdWUgb2YgYHVuZGVmaW5lZGAgaXQgd2FzIHJlbW92ZWQgZnJvbSB0aGUgZG9jdW1lbnQuICBJZiBgX2lkYCBpcyBwcmVzZW50IGl0IGlzIGlnbm9yZWQuXG4gICAqL1xuICBjaGFuZ2VkIChjb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcykge1xuICAgIGlmICh0aGlzLl9pc0RlYWN0aXZhdGVkKCkpXG4gICAgICByZXR1cm47XG4gICAgaWQgPSB0aGlzLl9pZEZpbHRlci5pZFN0cmluZ2lmeShpZCk7XG4gICAgdGhpcy5fc2Vzc2lvbi5jaGFuZ2VkKHRoaXMuX3N1YnNjcmlwdGlvbkhhbmRsZSwgY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDYWxsIGluc2lkZSB0aGUgcHVibGlzaCBmdW5jdGlvbi4gIEluZm9ybXMgdGhlIHN1YnNjcmliZXIgdGhhdCBhIGRvY3VtZW50IGhhcyBiZWVuIHJlbW92ZWQgZnJvbSB0aGUgcmVjb3JkIHNldC5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAbWVtYmVyT2YgU3Vic2NyaXB0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gY29sbGVjdGlvbiBUaGUgbmFtZSBvZiB0aGUgY29sbGVjdGlvbiB0aGF0IHRoZSBkb2N1bWVudCBoYXMgYmVlbiByZW1vdmVkIGZyb20uXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBpZCBUaGUgSUQgb2YgdGhlIGRvY3VtZW50IHRoYXQgaGFzIGJlZW4gcmVtb3ZlZC5cbiAgICovXG4gIHJlbW92ZWQgKGNvbGxlY3Rpb25OYW1lLCBpZCkge1xuICAgIGlmICh0aGlzLl9pc0RlYWN0aXZhdGVkKCkpXG4gICAgICByZXR1cm47XG4gICAgaWQgPSB0aGlzLl9pZEZpbHRlci5pZFN0cmluZ2lmeShpZCk7XG5cbiAgICBpZiAodGhpcy5fc2Vzc2lvbi5zZXJ2ZXIuZ2V0UHVibGljYXRpb25TdHJhdGVneShjb2xsZWN0aW9uTmFtZSkuZG9BY2NvdW50aW5nRm9yQ29sbGVjdGlvbikge1xuICAgICAgLy8gV2UgZG9uJ3QgYm90aGVyIHRvIGRlbGV0ZSBzZXRzIG9mIHRoaW5ncyBpbiBhIGNvbGxlY3Rpb24gaWYgdGhlXG4gICAgICAvLyBjb2xsZWN0aW9uIGlzIGVtcHR5LiAgSXQgY291bGQgYnJlYWsgX3JlbW92ZUFsbERvY3VtZW50cy5cbiAgICAgIHRoaXMuX2RvY3VtZW50cy5nZXQoY29sbGVjdGlvbk5hbWUpLmRlbGV0ZShpZCk7XG4gICAgfVxuXG4gICAgdGhpcy5fc2Vzc2lvbi5yZW1vdmVkKHRoaXMuX3N1YnNjcmlwdGlvbkhhbmRsZSwgY29sbGVjdGlvbk5hbWUsIGlkKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgQ2FsbCBpbnNpZGUgdGhlIHB1Ymxpc2ggZnVuY3Rpb24uICBJbmZvcm1zIHRoZSBzdWJzY3JpYmVyIHRoYXQgYW4gaW5pdGlhbCwgY29tcGxldGUgc25hcHNob3Qgb2YgdGhlIHJlY29yZCBzZXQgaGFzIGJlZW4gc2VudC4gIFRoaXMgd2lsbCB0cmlnZ2VyIGEgY2FsbCBvbiB0aGUgY2xpZW50IHRvIHRoZSBgb25SZWFkeWAgY2FsbGJhY2sgcGFzc2VkIHRvICBbYE1ldGVvci5zdWJzY3JpYmVgXSgjbWV0ZW9yX3N1YnNjcmliZSksIGlmIGFueS5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAbWVtYmVyT2YgU3Vic2NyaXB0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKi9cbiAgcmVhZHk6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2lzRGVhY3RpdmF0ZWQoKSlcbiAgICAgIHJldHVybjtcbiAgICBpZiAoIXNlbGYuX3N1YnNjcmlwdGlvbklkKVxuICAgICAgcmV0dXJuOyAgLy8gVW5uZWNlc3NhcnkgYnV0IGlnbm9yZWQgZm9yIHVuaXZlcnNhbCBzdWJcbiAgICBpZiAoIXNlbGYuX3JlYWR5KSB7XG4gICAgICBzZWxmLl9zZXNzaW9uLnNlbmRSZWFkeShbc2VsZi5fc3Vic2NyaXB0aW9uSWRdKTtcbiAgICAgIHNlbGYuX3JlYWR5ID0gdHJ1ZTtcbiAgICB9XG4gIH1cbn0pO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuLyogU2VydmVyICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKi9cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblNlcnZlciA9IGZ1bmN0aW9uIChvcHRpb25zID0ge30pIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIC8vIFRoZSBkZWZhdWx0IGhlYXJ0YmVhdCBpbnRlcnZhbCBpcyAzMCBzZWNvbmRzIG9uIHRoZSBzZXJ2ZXIgYW5kIDM1XG4gIC8vIHNlY29uZHMgb24gdGhlIGNsaWVudC4gIFNpbmNlIHRoZSBjbGllbnQgZG9lc24ndCBuZWVkIHRvIHNlbmQgYVxuICAvLyBwaW5nIGFzIGxvbmcgYXMgaXQgaXMgcmVjZWl2aW5nIHBpbmdzLCB0aGlzIG1lYW5zIHRoYXQgcGluZ3NcbiAgLy8gbm9ybWFsbHkgZ28gZnJvbSB0aGUgc2VydmVyIHRvIHRoZSBjbGllbnQuXG4gIC8vXG4gIC8vIE5vdGU6IFRyb3Bvc3BoZXJlIGRlcGVuZHMgb24gdGhlIGFiaWxpdHkgdG8gbXV0YXRlXG4gIC8vIE1ldGVvci5zZXJ2ZXIub3B0aW9ucy5oZWFydGJlYXRUaW1lb3V0ISBUaGlzIGlzIGEgaGFjaywgYnV0IGl0J3MgbGlmZS5cbiAgc2VsZi5vcHRpb25zID0ge1xuICAgIGhlYXJ0YmVhdEludGVydmFsOiAxNTAwMCxcbiAgICBoZWFydGJlYXRUaW1lb3V0OiAxNTAwMCxcbiAgICAvLyBGb3IgdGVzdGluZywgYWxsb3cgcmVzcG9uZGluZyB0byBwaW5ncyB0byBiZSBkaXNhYmxlZC5cbiAgICByZXNwb25kVG9QaW5nczogdHJ1ZSxcbiAgICBkZWZhdWx0UHVibGljYXRpb25TdHJhdGVneTogcHVibGljYXRpb25TdHJhdGVnaWVzLlNFUlZFUl9NRVJHRSxcbiAgICAuLi5vcHRpb25zLFxuICB9O1xuXG4gIC8vIE1hcCBvZiBjYWxsYmFja3MgdG8gY2FsbCB3aGVuIGEgbmV3IGNvbm5lY3Rpb24gY29tZXMgaW4gdG8gdGhlXG4gIC8vIHNlcnZlciBhbmQgY29tcGxldGVzIEREUCB2ZXJzaW9uIG5lZ290aWF0aW9uLiBVc2UgYW4gb2JqZWN0IGluc3RlYWRcbiAgLy8gb2YgYW4gYXJyYXkgc28gd2UgY2FuIHNhZmVseSByZW1vdmUgb25lIGZyb20gdGhlIGxpc3Qgd2hpbGVcbiAgLy8gaXRlcmF0aW5nIG92ZXIgaXQuXG4gIHNlbGYub25Db25uZWN0aW9uSG9vayA9IG5ldyBIb29rKHtcbiAgICBkZWJ1Z1ByaW50RXhjZXB0aW9uczogXCJvbkNvbm5lY3Rpb24gY2FsbGJhY2tcIlxuICB9KTtcblxuICAvLyBNYXAgb2YgY2FsbGJhY2tzIHRvIGNhbGwgd2hlbiBhIG5ldyBtZXNzYWdlIGNvbWVzIGluLlxuICBzZWxmLm9uTWVzc2FnZUhvb2sgPSBuZXcgSG9vayh7XG4gICAgZGVidWdQcmludEV4Y2VwdGlvbnM6IFwib25NZXNzYWdlIGNhbGxiYWNrXCJcbiAgfSk7XG5cbiAgc2VsZi5wdWJsaXNoX2hhbmRsZXJzID0ge307XG4gIHNlbGYudW5pdmVyc2FsX3B1Ymxpc2hfaGFuZGxlcnMgPSBbXTtcblxuICBzZWxmLm1ldGhvZF9oYW5kbGVycyA9IHt9O1xuXG4gIHNlbGYuX3B1YmxpY2F0aW9uU3RyYXRlZ2llcyA9IHt9O1xuXG4gIHNlbGYuc2Vzc2lvbnMgPSBuZXcgTWFwKCk7IC8vIG1hcCBmcm9tIGlkIHRvIHNlc3Npb25cblxuICBzZWxmLnN0cmVhbV9zZXJ2ZXIgPSBuZXcgU3RyZWFtU2VydmVyKCk7XG5cbiAgc2VsZi5zdHJlYW1fc2VydmVyLnJlZ2lzdGVyKGZ1bmN0aW9uIChzb2NrZXQpIHtcbiAgICAvLyBzb2NrZXQgaW1wbGVtZW50cyB0aGUgU29ja0pTQ29ubmVjdGlvbiBpbnRlcmZhY2VcbiAgICBzb2NrZXQuX21ldGVvclNlc3Npb24gPSBudWxsO1xuXG4gICAgdmFyIHNlbmRFcnJvciA9IGZ1bmN0aW9uIChyZWFzb24sIG9mZmVuZGluZ01lc3NhZ2UpIHtcbiAgICAgIHZhciBtc2cgPSB7bXNnOiAnZXJyb3InLCByZWFzb246IHJlYXNvbn07XG4gICAgICBpZiAob2ZmZW5kaW5nTWVzc2FnZSlcbiAgICAgICAgbXNnLm9mZmVuZGluZ01lc3NhZ2UgPSBvZmZlbmRpbmdNZXNzYWdlO1xuICAgICAgc29ja2V0LnNlbmQoRERQQ29tbW9uLnN0cmluZ2lmeUREUChtc2cpKTtcbiAgICB9O1xuXG4gICAgc29ja2V0Lm9uKCdkYXRhJywgZnVuY3Rpb24gKHJhd19tc2cpIHtcbiAgICAgIGlmIChNZXRlb3IuX3ByaW50UmVjZWl2ZWRERFApIHtcbiAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhcIlJlY2VpdmVkIEREUFwiLCByYXdfbXNnKTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdmFyIG1zZyA9IEREUENvbW1vbi5wYXJzZUREUChyYXdfbXNnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgc2VuZEVycm9yKCdQYXJzZSBlcnJvcicpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAobXNnID09PSBudWxsIHx8ICFtc2cubXNnKSB7XG4gICAgICAgICAgc2VuZEVycm9yKCdCYWQgcmVxdWVzdCcsIG1zZyk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1zZy5tc2cgPT09ICdjb25uZWN0Jykge1xuICAgICAgICAgIGlmIChzb2NrZXQuX21ldGVvclNlc3Npb24pIHtcbiAgICAgICAgICAgIHNlbmRFcnJvcihcIkFscmVhZHkgY29ubmVjdGVkXCIsIG1zZyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgc2VsZi5faGFuZGxlQ29ubmVjdChzb2NrZXQsIG1zZyk7XG5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXNvY2tldC5fbWV0ZW9yU2Vzc2lvbikge1xuICAgICAgICAgIHNlbmRFcnJvcignTXVzdCBjb25uZWN0IGZpcnN0JywgbXNnKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgc29ja2V0Ll9tZXRlb3JTZXNzaW9uLnByb2Nlc3NNZXNzYWdlKG1zZyk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIFhYWCBwcmludCBzdGFjayBuaWNlbHlcbiAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhcIkludGVybmFsIGV4Y2VwdGlvbiB3aGlsZSBwcm9jZXNzaW5nIG1lc3NhZ2VcIiwgbXNnLCBlKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHNvY2tldC5vbignY2xvc2UnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoc29ja2V0Ll9tZXRlb3JTZXNzaW9uKSB7XG4gICAgICAgIHNvY2tldC5fbWV0ZW9yU2Vzc2lvbi5jbG9zZSgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbn07XG5cbk9iamVjdC5hc3NpZ24oU2VydmVyLnByb3RvdHlwZSwge1xuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBSZWdpc3RlciBhIGNhbGxiYWNrIHRvIGJlIGNhbGxlZCB3aGVuIGEgbmV3IEREUCBjb25uZWN0aW9uIGlzIG1hZGUgdG8gdGhlIHNlcnZlci5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdG8gY2FsbCB3aGVuIGEgbmV3IEREUCBjb25uZWN0aW9uIGlzIGVzdGFibGlzaGVkLlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICovXG4gIG9uQ29ubmVjdGlvbjogZnVuY3Rpb24gKGZuKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBzZWxmLm9uQ29ubmVjdGlvbkhvb2sucmVnaXN0ZXIoZm4pO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBTZXQgcHVibGljYXRpb24gc3RyYXRlZ3kgZm9yIHRoZSBnaXZlbiBwdWJsaWNhdGlvbi4gUHVibGljYXRpb25zIHN0cmF0ZWdpZXMgYXJlIGF2YWlsYWJsZSBmcm9tIGBERFBTZXJ2ZXIucHVibGljYXRpb25TdHJhdGVnaWVzYC4gWW91IGNhbGwgdGhpcyBtZXRob2QgZnJvbSBgTWV0ZW9yLnNlcnZlcmAsIGxpa2UgYE1ldGVvci5zZXJ2ZXIuc2V0UHVibGljYXRpb25TdHJhdGVneSgpYFxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBhbGlhcyBzZXRQdWJsaWNhdGlvblN0cmF0ZWd5XG4gICAqIEBwYXJhbSBwdWJsaWNhdGlvbk5hbWUge1N0cmluZ31cbiAgICogQHBhcmFtIHN0cmF0ZWd5IHt7dXNlQ29sbGVjdGlvblZpZXc6IGJvb2xlYW4sIGRvQWNjb3VudGluZ0ZvckNvbGxlY3Rpb246IGJvb2xlYW59fVxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yLnNlcnZlclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqL1xuICBzZXRQdWJsaWNhdGlvblN0cmF0ZWd5KHB1YmxpY2F0aW9uTmFtZSwgc3RyYXRlZ3kpIHtcbiAgICBpZiAoIU9iamVjdC52YWx1ZXMocHVibGljYXRpb25TdHJhdGVnaWVzKS5pbmNsdWRlcyhzdHJhdGVneSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBtZXJnZSBzdHJhdGVneTogJHtzdHJhdGVneX0gXG4gICAgICAgIGZvciBjb2xsZWN0aW9uICR7cHVibGljYXRpb25OYW1lfWApO1xuICAgIH1cbiAgICB0aGlzLl9wdWJsaWNhdGlvblN0cmF0ZWdpZXNbcHVibGljYXRpb25OYW1lXSA9IHN0cmF0ZWd5O1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBHZXRzIHRoZSBwdWJsaWNhdGlvbiBzdHJhdGVneSBmb3IgdGhlIHJlcXVlc3RlZCBwdWJsaWNhdGlvbi4gWW91IGNhbGwgdGhpcyBtZXRob2QgZnJvbSBgTWV0ZW9yLnNlcnZlcmAsIGxpa2UgYE1ldGVvci5zZXJ2ZXIuZ2V0UHVibGljYXRpb25TdHJhdGVneSgpYFxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBhbGlhcyBnZXRQdWJsaWNhdGlvblN0cmF0ZWd5XG4gICAqIEBwYXJhbSBwdWJsaWNhdGlvbk5hbWUge1N0cmluZ31cbiAgICogQG1lbWJlck9mIE1ldGVvci5zZXJ2ZXJcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAcmV0dXJuIHt7dXNlQ29sbGVjdGlvblZpZXc6IGJvb2xlYW4sIGRvQWNjb3VudGluZ0ZvckNvbGxlY3Rpb246IGJvb2xlYW59fVxuICAgKi9cbiAgZ2V0UHVibGljYXRpb25TdHJhdGVneShwdWJsaWNhdGlvbk5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5fcHVibGljYXRpb25TdHJhdGVnaWVzW3B1YmxpY2F0aW9uTmFtZV1cbiAgICAgIHx8IHRoaXMub3B0aW9ucy5kZWZhdWx0UHVibGljYXRpb25TdHJhdGVneTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgUmVnaXN0ZXIgYSBjYWxsYmFjayB0byBiZSBjYWxsZWQgd2hlbiBhIG5ldyBERFAgbWVzc2FnZSBpcyByZWNlaXZlZC5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdG8gY2FsbCB3aGVuIGEgbmV3IEREUCBtZXNzYWdlIGlzIHJlY2VpdmVkLlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICovXG4gIG9uTWVzc2FnZTogZnVuY3Rpb24gKGZuKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBzZWxmLm9uTWVzc2FnZUhvb2sucmVnaXN0ZXIoZm4pO1xuICB9LFxuXG4gIF9oYW5kbGVDb25uZWN0OiBmdW5jdGlvbiAoc29ja2V0LCBtc2cpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAvLyBUaGUgY29ubmVjdCBtZXNzYWdlIG11c3Qgc3BlY2lmeSBhIHZlcnNpb24gYW5kIGFuIGFycmF5IG9mIHN1cHBvcnRlZFxuICAgIC8vIHZlcnNpb25zLCBhbmQgaXQgbXVzdCBjbGFpbSB0byBzdXBwb3J0IHdoYXQgaXQgaXMgcHJvcG9zaW5nLlxuICAgIGlmICghKHR5cGVvZiAobXNnLnZlcnNpb24pID09PSAnc3RyaW5nJyAmJlxuICAgICAgICAgIEFycmF5LmlzQXJyYXkobXNnLnN1cHBvcnQpICYmXG4gICAgICAgICAgbXNnLnN1cHBvcnQuZXZlcnkoaXNTdHJpbmcpICYmXG4gICAgICAgICAgbXNnLnN1cHBvcnQuaW5jbHVkZXMobXNnLnZlcnNpb24pKSkge1xuICAgICAgc29ja2V0LnNlbmQoRERQQ29tbW9uLnN0cmluZ2lmeUREUCh7bXNnOiAnZmFpbGVkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVyc2lvbjogRERQQ29tbW9uLlNVUFBPUlRFRF9ERFBfVkVSU0lPTlNbMF19KSk7XG4gICAgICBzb2NrZXQuY2xvc2UoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBJbiB0aGUgZnV0dXJlLCBoYW5kbGUgc2Vzc2lvbiByZXN1bXB0aW9uOiBzb21ldGhpbmcgbGlrZTpcbiAgICAvLyAgc29ja2V0Ll9tZXRlb3JTZXNzaW9uID0gc2VsZi5zZXNzaW9uc1ttc2cuc2Vzc2lvbl1cbiAgICB2YXIgdmVyc2lvbiA9IGNhbGN1bGF0ZVZlcnNpb24obXNnLnN1cHBvcnQsIEREUENvbW1vbi5TVVBQT1JURURfRERQX1ZFUlNJT05TKTtcblxuICAgIGlmIChtc2cudmVyc2lvbiAhPT0gdmVyc2lvbikge1xuICAgICAgLy8gVGhlIGJlc3QgdmVyc2lvbiB0byB1c2UgKGFjY29yZGluZyB0byB0aGUgY2xpZW50J3Mgc3RhdGVkIHByZWZlcmVuY2VzKVxuICAgICAgLy8gaXMgbm90IHRoZSBvbmUgdGhlIGNsaWVudCBpcyB0cnlpbmcgdG8gdXNlLiBJbmZvcm0gdGhlbSBhYm91dCB0aGUgYmVzdFxuICAgICAgLy8gdmVyc2lvbiB0byB1c2UuXG4gICAgICBzb2NrZXQuc2VuZChERFBDb21tb24uc3RyaW5naWZ5RERQKHttc2c6ICdmYWlsZWQnLCB2ZXJzaW9uOiB2ZXJzaW9ufSkpO1xuICAgICAgc29ja2V0LmNsb3NlKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gWWF5LCB2ZXJzaW9uIG1hdGNoZXMhIENyZWF0ZSBhIG5ldyBzZXNzaW9uLlxuICAgIC8vIE5vdGU6IFRyb3Bvc3BoZXJlIGRlcGVuZHMgb24gdGhlIGFiaWxpdHkgdG8gbXV0YXRlXG4gICAgLy8gTWV0ZW9yLnNlcnZlci5vcHRpb25zLmhlYXJ0YmVhdFRpbWVvdXQhIFRoaXMgaXMgYSBoYWNrLCBidXQgaXQncyBsaWZlLlxuICAgIHNvY2tldC5fbWV0ZW9yU2Vzc2lvbiA9IG5ldyBTZXNzaW9uKHNlbGYsIHZlcnNpb24sIHNvY2tldCwgc2VsZi5vcHRpb25zKTtcbiAgICBzZWxmLnNlc3Npb25zLnNldChzb2NrZXQuX21ldGVvclNlc3Npb24uaWQsIHNvY2tldC5fbWV0ZW9yU2Vzc2lvbik7XG4gICAgc2VsZi5vbkNvbm5lY3Rpb25Ib29rLmVhY2goZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICBpZiAoc29ja2V0Ll9tZXRlb3JTZXNzaW9uKVxuICAgICAgICBjYWxsYmFjayhzb2NrZXQuX21ldGVvclNlc3Npb24uY29ubmVjdGlvbkhhbmRsZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbiAgfSxcbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgcHVibGlzaCBoYW5kbGVyIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfSBpZGVudGlmaWVyIGZvciBxdWVyeVxuICAgKiBAcGFyYW0gaGFuZGxlciB7RnVuY3Rpb259IHB1Ymxpc2ggaGFuZGxlclxuICAgKiBAcGFyYW0gb3B0aW9ucyB7T2JqZWN0fVxuICAgKlxuICAgKiBTZXJ2ZXIgd2lsbCBjYWxsIGhhbmRsZXIgZnVuY3Rpb24gb24gZWFjaCBuZXcgc3Vic2NyaXB0aW9uLFxuICAgKiBlaXRoZXIgd2hlbiByZWNlaXZpbmcgRERQIHN1YiBtZXNzYWdlIGZvciBhIG5hbWVkIHN1YnNjcmlwdGlvbiwgb3Igb25cbiAgICogRERQIGNvbm5lY3QgZm9yIGEgdW5pdmVyc2FsIHN1YnNjcmlwdGlvbi5cbiAgICpcbiAgICogSWYgbmFtZSBpcyBudWxsLCB0aGlzIHdpbGwgYmUgYSBzdWJzY3JpcHRpb24gdGhhdCBpc1xuICAgKiBhdXRvbWF0aWNhbGx5IGVzdGFibGlzaGVkIGFuZCBwZXJtYW5lbnRseSBvbiBmb3IgYWxsIGNvbm5lY3RlZFxuICAgKiBjbGllbnQsIGluc3RlYWQgb2YgYSBzdWJzY3JpcHRpb24gdGhhdCBjYW4gYmUgdHVybmVkIG9uIGFuZCBvZmZcbiAgICogd2l0aCBzdWJzY3JpYmUoKS5cbiAgICpcbiAgICogb3B0aW9ucyB0byBjb250YWluOlxuICAgKiAgLSAobW9zdGx5IGludGVybmFsKSBpc19hdXRvOiB0cnVlIGlmIGdlbmVyYXRlZCBhdXRvbWF0aWNhbGx5XG4gICAqICAgIGZyb20gYW4gYXV0b3B1Ymxpc2ggaG9vay4gdGhpcyBpcyBmb3IgY29zbWV0aWMgcHVycG9zZXMgb25seVxuICAgKiAgICAoaXQgbGV0cyB1cyBkZXRlcm1pbmUgd2hldGhlciB0byBwcmludCBhIHdhcm5pbmcgc3VnZ2VzdGluZ1xuICAgKiAgICB0aGF0IHlvdSB0dXJuIG9mZiBhdXRvcHVibGlzaCkuXG4gICAqL1xuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBQdWJsaXNoIGEgcmVjb3JkIHNldC5cbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSBuYW1lIElmIFN0cmluZywgbmFtZSBvZiB0aGUgcmVjb3JkIHNldC4gIElmIE9iamVjdCwgcHVibGljYXRpb25zIERpY3Rpb25hcnkgb2YgcHVibGlzaCBmdW5jdGlvbnMgYnkgbmFtZS4gIElmIGBudWxsYCwgdGhlIHNldCBoYXMgbm8gbmFtZSwgYW5kIHRoZSByZWNvcmQgc2V0IGlzIGF1dG9tYXRpY2FsbHkgc2VudCB0byBhbGwgY29ubmVjdGVkIGNsaWVudHMuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgRnVuY3Rpb24gY2FsbGVkIG9uIHRoZSBzZXJ2ZXIgZWFjaCB0aW1lIGEgY2xpZW50IHN1YnNjcmliZXMuICBJbnNpZGUgdGhlIGZ1bmN0aW9uLCBgdGhpc2AgaXMgdGhlIHB1Ymxpc2ggaGFuZGxlciBvYmplY3QsIGRlc2NyaWJlZCBiZWxvdy4gIElmIHRoZSBjbGllbnQgcGFzc2VkIGFyZ3VtZW50cyB0byBgc3Vic2NyaWJlYCwgdGhlIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aXRoIHRoZSBzYW1lIGFyZ3VtZW50cy5cbiAgICovXG4gIHB1Ymxpc2g6IGZ1bmN0aW9uIChuYW1lLCBoYW5kbGVyLCBvcHRpb25zKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKCFpc09iamVjdChuYW1lKSkge1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICAgIGlmIChuYW1lICYmIG5hbWUgaW4gc2VsZi5wdWJsaXNoX2hhbmRsZXJzKSB7XG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJJZ25vcmluZyBkdXBsaWNhdGUgcHVibGlzaCBuYW1lZCAnXCIgKyBuYW1lICsgXCInXCIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChQYWNrYWdlLmF1dG9wdWJsaXNoICYmICFvcHRpb25zLmlzX2F1dG8pIHtcbiAgICAgICAgLy8gVGhleSBoYXZlIGF1dG9wdWJsaXNoIG9uLCB5ZXQgdGhleSdyZSB0cnlpbmcgdG8gbWFudWFsbHlcbiAgICAgICAgLy8gcGljayBzdHVmZiB0byBwdWJsaXNoLiBUaGV5IHByb2JhYmx5IHNob3VsZCB0dXJuIG9mZlxuICAgICAgICAvLyBhdXRvcHVibGlzaC4gKFRoaXMgY2hlY2sgaXNuJ3QgcGVyZmVjdCAtLSBpZiB5b3UgY3JlYXRlIGFcbiAgICAgICAgLy8gcHVibGlzaCBiZWZvcmUgeW91IHR1cm4gb24gYXV0b3B1Ymxpc2gsIGl0IHdvbid0IGNhdGNoXG4gICAgICAgIC8vIGl0LCBidXQgdGhpcyB3aWxsIGRlZmluaXRlbHkgaGFuZGxlIHRoZSBzaW1wbGUgY2FzZSB3aGVyZVxuICAgICAgICAvLyB5b3UndmUgYWRkZWQgdGhlIGF1dG9wdWJsaXNoIHBhY2thZ2UgdG8geW91ciBhcHAsIGFuZCBhcmVcbiAgICAgICAgLy8gY2FsbGluZyBwdWJsaXNoIGZyb20geW91ciBhcHAgY29kZSkuXG4gICAgICAgIGlmICghc2VsZi53YXJuZWRfYWJvdXRfYXV0b3B1Ymxpc2gpIHtcbiAgICAgICAgICBzZWxmLndhcm5lZF9hYm91dF9hdXRvcHVibGlzaCA9IHRydWU7XG4gICAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhcbiAgICBcIioqIFlvdSd2ZSBzZXQgdXAgc29tZSBkYXRhIHN1YnNjcmlwdGlvbnMgd2l0aCBNZXRlb3IucHVibGlzaCgpLCBidXRcXG5cIiArXG4gICAgXCIqKiB5b3Ugc3RpbGwgaGF2ZSBhdXRvcHVibGlzaCB0dXJuZWQgb24uIEJlY2F1c2UgYXV0b3B1Ymxpc2ggaXMgc3RpbGxcXG5cIiArXG4gICAgXCIqKiBvbiwgeW91ciBNZXRlb3IucHVibGlzaCgpIGNhbGxzIHdvbid0IGhhdmUgbXVjaCBlZmZlY3QuIEFsbCBkYXRhXFxuXCIgK1xuICAgIFwiKiogd2lsbCBzdGlsbCBiZSBzZW50IHRvIGFsbCBjbGllbnRzLlxcblwiICtcbiAgICBcIioqXFxuXCIgK1xuICAgIFwiKiogVHVybiBvZmYgYXV0b3B1Ymxpc2ggYnkgcmVtb3ZpbmcgdGhlIGF1dG9wdWJsaXNoIHBhY2thZ2U6XFxuXCIgK1xuICAgIFwiKipcXG5cIiArXG4gICAgXCIqKiAgICQgbWV0ZW9yIHJlbW92ZSBhdXRvcHVibGlzaFxcblwiICtcbiAgICBcIioqXFxuXCIgK1xuICAgIFwiKiogLi4gYW5kIG1ha2Ugc3VyZSB5b3UgaGF2ZSBNZXRlb3IucHVibGlzaCgpIGFuZCBNZXRlb3Iuc3Vic2NyaWJlKCkgY2FsbHNcXG5cIiArXG4gICAgXCIqKiBmb3IgZWFjaCBjb2xsZWN0aW9uIHRoYXQgeW91IHdhbnQgY2xpZW50cyB0byBzZWUuXFxuXCIpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChuYW1lKVxuICAgICAgICBzZWxmLnB1Ymxpc2hfaGFuZGxlcnNbbmFtZV0gPSBoYW5kbGVyO1xuICAgICAgZWxzZSB7XG4gICAgICAgIHNlbGYudW5pdmVyc2FsX3B1Ymxpc2hfaGFuZGxlcnMucHVzaChoYW5kbGVyKTtcbiAgICAgICAgLy8gU3BpbiB1cCB0aGUgbmV3IHB1Ymxpc2hlciBvbiBhbnkgZXhpc3Rpbmcgc2Vzc2lvbiB0b28uIFJ1biBlYWNoXG4gICAgICAgIC8vIHNlc3Npb24ncyBzdWJzY3JpcHRpb24gaW4gYSBuZXcgRmliZXIsIHNvIHRoYXQgdGhlcmUncyBubyBjaGFuZ2UgZm9yXG4gICAgICAgIC8vIHNlbGYuc2Vzc2lvbnMgdG8gY2hhbmdlIHdoaWxlIHdlJ3JlIHJ1bm5pbmcgdGhpcyBsb29wLlxuICAgICAgICBzZWxmLnNlc3Npb25zLmZvckVhY2goZnVuY3Rpb24gKHNlc3Npb24pIHtcbiAgICAgICAgICBpZiAoIXNlc3Npb24uX2RvbnRTdGFydE5ld1VuaXZlcnNhbFN1YnMpIHtcbiAgICAgICAgICAgIHNlc3Npb24uX3N0YXJ0U3Vic2NyaXB0aW9uKGhhbmRsZXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2V7XG4gICAgICBPYmplY3QuZW50cmllcyhuYW1lKS5mb3JFYWNoKGZ1bmN0aW9uKFtrZXksIHZhbHVlXSkge1xuICAgICAgICBzZWxmLnB1Ymxpc2goa2V5LCB2YWx1ZSwge30pO1xuICAgICAgfSk7XG4gICAgfVxuICB9LFxuXG4gIF9yZW1vdmVTZXNzaW9uOiBmdW5jdGlvbiAoc2Vzc2lvbikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnNlc3Npb25zLmRlbGV0ZShzZXNzaW9uLmlkKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgVGVsbHMgaWYgdGhlIG1ldGhvZCBjYWxsIGNhbWUgZnJvbSBhIGNhbGwgb3IgYSBjYWxsQXN5bmMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQHJldHVybnMgYm9vbGVhblxuICAgKi9cbiAgaXNBc3luY0NhbGw6IGZ1bmN0aW9uKCl7XG4gICAgcmV0dXJuIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX2lzQ2FsbEFzeW5jTWV0aG9kUnVubmluZygpXG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IERlZmluZXMgZnVuY3Rpb25zIHRoYXQgY2FuIGJlIGludm9rZWQgb3ZlciB0aGUgbmV0d29yayBieSBjbGllbnRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtPYmplY3R9IG1ldGhvZHMgRGljdGlvbmFyeSB3aG9zZSBrZXlzIGFyZSBtZXRob2QgbmFtZXMgYW5kIHZhbHVlcyBhcmUgZnVuY3Rpb25zLlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICovXG4gIG1ldGhvZHM6IGZ1bmN0aW9uIChtZXRob2RzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE9iamVjdC5lbnRyaWVzKG1ldGhvZHMpLmZvckVhY2goZnVuY3Rpb24gKFtuYW1lLCBmdW5jXSkge1xuICAgICAgaWYgKHR5cGVvZiBmdW5jICE9PSAnZnVuY3Rpb24nKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNZXRob2QgJ1wiICsgbmFtZSArIFwiJyBtdXN0IGJlIGEgZnVuY3Rpb25cIik7XG4gICAgICBpZiAoc2VsZi5tZXRob2RfaGFuZGxlcnNbbmFtZV0pXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkEgbWV0aG9kIG5hbWVkICdcIiArIG5hbWUgKyBcIicgaXMgYWxyZWFkeSBkZWZpbmVkXCIpO1xuICAgICAgc2VsZi5tZXRob2RfaGFuZGxlcnNbbmFtZV0gPSBmdW5jO1xuICAgIH0pO1xuICB9LFxuXG4gIGNhbGw6IGZ1bmN0aW9uIChuYW1lLCAuLi5hcmdzKSB7XG4gICAgaWYgKGFyZ3MubGVuZ3RoICYmIHR5cGVvZiBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgLy8gSWYgaXQncyBhIGZ1bmN0aW9uLCB0aGUgbGFzdCBhcmd1bWVudCBpcyB0aGUgcmVzdWx0IGNhbGxiYWNrLCBub3RcbiAgICAgIC8vIGEgcGFyYW1ldGVyIHRvIHRoZSByZW1vdGUgbWV0aG9kLlxuICAgICAgdmFyIGNhbGxiYWNrID0gYXJncy5wb3AoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5hcHBseShuYW1lLCBhcmdzLCBjYWxsYmFjayk7XG4gIH0sXG5cbiAgLy8gQSB2ZXJzaW9uIG9mIHRoZSBjYWxsIG1ldGhvZCB0aGF0IGFsd2F5cyByZXR1cm5zIGEgUHJvbWlzZS5cbiAgY2FsbEFzeW5jOiBmdW5jdGlvbiAobmFtZSwgLi4uYXJncykge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBhcmdzWzBdPy5oYXNPd25Qcm9wZXJ0eSgncmV0dXJuU3R1YlZhbHVlJylcbiAgICAgID8gYXJncy5zaGlmdCgpXG4gICAgICA6IHt9O1xuICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldENhbGxBc3luY01ldGhvZFJ1bm5pbmcodHJ1ZSk7XG4gICAgY29uc3QgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIEREUC5fQ3VycmVudENhbGxBc3luY0ludm9jYXRpb24uX3NldCh7IG5hbWUsIGhhc0NhbGxBc3luY1BhcmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuYXBwbHlBc3luYyhuYW1lLCBhcmdzLCB7IGlzRnJvbUNhbGxBc3luYzogdHJ1ZSwgLi4ub3B0aW9ucyB9KVxuICAgICAgICAudGhlbihyZXNvbHZlKVxuICAgICAgICAuY2F0Y2gocmVqZWN0KVxuICAgICAgICAuZmluYWxseSgoKSA9PiB7XG4gICAgICAgICAgRERQLl9DdXJyZW50Q2FsbEFzeW5jSW52b2NhdGlvbi5fc2V0KCk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiBwcm9taXNlLmZpbmFsbHkoKCkgPT5cbiAgICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldENhbGxBc3luY01ldGhvZFJ1bm5pbmcoZmFsc2UpXG4gICAgKTtcbiAgfSxcblxuICBhcHBseTogZnVuY3Rpb24gKG5hbWUsIGFyZ3MsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgLy8gV2Ugd2VyZSBwYXNzZWQgMyBhcmd1bWVudHMuIFRoZXkgbWF5IGJlIGVpdGhlciAobmFtZSwgYXJncywgb3B0aW9ucylcbiAgICAvLyBvciAobmFtZSwgYXJncywgY2FsbGJhY2spXG4gICAgaWYgKCEgY2FsbGJhY2sgJiYgdHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgfVxuICAgIGNvbnN0IHByb21pc2UgPSB0aGlzLmFwcGx5QXN5bmMobmFtZSwgYXJncywgb3B0aW9ucyk7XG5cbiAgICAvLyBSZXR1cm4gdGhlIHJlc3VsdCBpbiB3aGljaGV2ZXIgd2F5IHRoZSBjYWxsZXIgYXNrZWQgZm9yIGl0LiBOb3RlIHRoYXQgd2VcbiAgICAvLyBkbyBOT1QgYmxvY2sgb24gdGhlIHdyaXRlIGZlbmNlIGluIGFuIGFuYWxvZ291cyB3YXkgdG8gaG93IHRoZSBjbGllbnRcbiAgICAvLyBibG9ja3Mgb24gdGhlIHJlbGV2YW50IGRhdGEgYmVpbmcgdmlzaWJsZSwgc28geW91IGFyZSBOT1QgZ3VhcmFudGVlZCB0aGF0XG4gICAgLy8gY3Vyc29yIG9ic2VydmUgY2FsbGJhY2tzIGhhdmUgZmlyZWQgd2hlbiB5b3VyIGNhbGxiYWNrIGlzIGludm9rZWQuIChXZVxuICAgIC8vIGNhbiBjaGFuZ2UgdGhpcyBpZiB0aGVyZSdzIGEgcmVhbCB1c2UgY2FzZSkuXG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICBwcm9taXNlLnRoZW4oXG4gICAgICAgIHJlc3VsdCA9PiBjYWxsYmFjayh1bmRlZmluZWQsIHJlc3VsdCksXG4gICAgICAgIGV4Y2VwdGlvbiA9PiBjYWxsYmFjayhleGNlcHRpb24pXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gQHBhcmFtIG9wdGlvbnMge09wdGlvbmFsIE9iamVjdH1cbiAgYXBwbHlBc3luYzogZnVuY3Rpb24gKG5hbWUsIGFyZ3MsIG9wdGlvbnMpIHtcbiAgICAvLyBSdW4gdGhlIGhhbmRsZXJcbiAgICB2YXIgaGFuZGxlciA9IHRoaXMubWV0aG9kX2hhbmRsZXJzW25hbWVdO1xuXG4gICAgaWYgKCEgaGFuZGxlcikge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KFxuICAgICAgICBuZXcgTWV0ZW9yLkVycm9yKDQwNCwgYE1ldGhvZCAnJHtuYW1lfScgbm90IGZvdW5kYClcbiAgICAgICk7XG4gICAgfVxuICAgIC8vIElmIHRoaXMgaXMgYSBtZXRob2QgY2FsbCBmcm9tIHdpdGhpbiBhbm90aGVyIG1ldGhvZCBvciBwdWJsaXNoIGZ1bmN0aW9uLFxuICAgIC8vIGdldCB0aGUgdXNlciBzdGF0ZSBmcm9tIHRoZSBvdXRlciBtZXRob2Qgb3IgcHVibGlzaCBmdW5jdGlvbiwgb3RoZXJ3aXNlXG4gICAgLy8gZG9uJ3QgYWxsb3cgc2V0VXNlcklkIHRvIGJlIGNhbGxlZFxuICAgIHZhciB1c2VySWQgPSBudWxsO1xuICAgIGxldCBzZXRVc2VySWQgPSAoKSA9PiB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBjYWxsIHNldFVzZXJJZCBvbiBhIHNlcnZlciBpbml0aWF0ZWQgbWV0aG9kIGNhbGxcIik7XG4gICAgfTtcbiAgICB2YXIgY29ubmVjdGlvbiA9IG51bGw7XG4gICAgdmFyIGN1cnJlbnRNZXRob2RJbnZvY2F0aW9uID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5nZXQoKTtcbiAgICB2YXIgY3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbiA9IEREUC5fQ3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbi5nZXQoKTtcbiAgICB2YXIgcmFuZG9tU2VlZCA9IG51bGw7XG5cbiAgICBpZiAoY3VycmVudE1ldGhvZEludm9jYXRpb24pIHtcbiAgICAgIHVzZXJJZCA9IGN1cnJlbnRNZXRob2RJbnZvY2F0aW9uLnVzZXJJZDtcbiAgICAgIHNldFVzZXJJZCA9ICh1c2VySWQpID0+IGN1cnJlbnRNZXRob2RJbnZvY2F0aW9uLnNldFVzZXJJZCh1c2VySWQpO1xuICAgICAgY29ubmVjdGlvbiA9IGN1cnJlbnRNZXRob2RJbnZvY2F0aW9uLmNvbm5lY3Rpb247XG4gICAgICByYW5kb21TZWVkID0gRERQQ29tbW9uLm1ha2VScGNTZWVkKGN1cnJlbnRNZXRob2RJbnZvY2F0aW9uLCBuYW1lKTtcbiAgICB9IGVsc2UgaWYgKGN1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24pIHtcbiAgICAgIHVzZXJJZCA9IGN1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24udXNlcklkO1xuICAgICAgc2V0VXNlcklkID0gKHVzZXJJZCkgPT4gY3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbi5fc2Vzc2lvbi5fc2V0VXNlcklkKHVzZXJJZCk7XG4gICAgICBjb25uZWN0aW9uID0gY3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbi5jb25uZWN0aW9uO1xuICAgIH1cblxuICAgIHZhciBpbnZvY2F0aW9uID0gbmV3IEREUENvbW1vbi5NZXRob2RJbnZvY2F0aW9uKHtcbiAgICAgIGlzU2ltdWxhdGlvbjogZmFsc2UsXG4gICAgICB1c2VySWQsXG4gICAgICBzZXRVc2VySWQsXG4gICAgICBjb25uZWN0aW9uLFxuICAgICAgcmFuZG9tU2VlZFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZXN1bHQ7XG4gICAgICB0cnkge1xuICAgICAgICByZXN1bHQgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLndpdGhWYWx1ZShpbnZvY2F0aW9uLCAoKSA9PlxuICAgICAgICAgIG1heWJlQXVkaXRBcmd1bWVudENoZWNrcyhcbiAgICAgICAgICAgIGhhbmRsZXIsXG4gICAgICAgICAgICBpbnZvY2F0aW9uLFxuICAgICAgICAgICAgRUpTT04uY2xvbmUoYXJncyksXG4gICAgICAgICAgICBcImludGVybmFsIGNhbGwgdG8gJ1wiICsgbmFtZSArIFwiJ1wiXG4gICAgICAgICAgKVxuICAgICAgICApO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gcmVqZWN0KGUpO1xuICAgICAgfVxuICAgICAgaWYgKCFNZXRlb3IuX2lzUHJvbWlzZShyZXN1bHQpKSB7XG4gICAgICAgIHJldHVybiByZXNvbHZlKHJlc3VsdCk7XG4gICAgICB9XG4gICAgICByZXN1bHQudGhlbihyID0+IHJlc29sdmUocikpLmNhdGNoKHJlamVjdCk7XG4gICAgfSkudGhlbihFSlNPTi5jbG9uZSk7XG4gIH0sXG5cbiAgX3VybEZvclNlc3Npb246IGZ1bmN0aW9uIChzZXNzaW9uSWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHNlc3Npb24gPSBzZWxmLnNlc3Npb25zLmdldChzZXNzaW9uSWQpO1xuICAgIGlmIChzZXNzaW9uKVxuICAgICAgcmV0dXJuIHNlc3Npb24uX3NvY2tldFVybDtcbiAgICBlbHNlXG4gICAgICByZXR1cm4gbnVsbDtcbiAgfVxufSk7XG5cbnZhciBjYWxjdWxhdGVWZXJzaW9uID0gZnVuY3Rpb24gKGNsaWVudFN1cHBvcnRlZFZlcnNpb25zLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VydmVyU3VwcG9ydGVkVmVyc2lvbnMpIHtcbiAgdmFyIGNvcnJlY3RWZXJzaW9uID0gY2xpZW50U3VwcG9ydGVkVmVyc2lvbnMuZmluZChmdW5jdGlvbiAodmVyc2lvbikge1xuICAgIHJldHVybiBzZXJ2ZXJTdXBwb3J0ZWRWZXJzaW9ucy5pbmNsdWRlcyh2ZXJzaW9uKTtcbiAgfSk7XG4gIGlmICghY29ycmVjdFZlcnNpb24pIHtcbiAgICBjb3JyZWN0VmVyc2lvbiA9IHNlcnZlclN1cHBvcnRlZFZlcnNpb25zWzBdO1xuICB9XG4gIHJldHVybiBjb3JyZWN0VmVyc2lvbjtcbn07XG5cbkREUFNlcnZlci5fY2FsY3VsYXRlVmVyc2lvbiA9IGNhbGN1bGF0ZVZlcnNpb247XG5cblxuLy8gXCJibGluZFwiIGV4Y2VwdGlvbnMgb3RoZXIgdGhhbiB0aG9zZSB0aGF0IHdlcmUgZGVsaWJlcmF0ZWx5IHRocm93biB0byBzaWduYWxcbi8vIGVycm9ycyB0byB0aGUgY2xpZW50XG52YXIgd3JhcEludGVybmFsRXhjZXB0aW9uID0gZnVuY3Rpb24gKGV4Y2VwdGlvbiwgY29udGV4dCkge1xuICBpZiAoIWV4Y2VwdGlvbikgcmV0dXJuIGV4Y2VwdGlvbjtcblxuICAvLyBUbyBhbGxvdyBwYWNrYWdlcyB0byB0aHJvdyBlcnJvcnMgaW50ZW5kZWQgZm9yIHRoZSBjbGllbnQgYnV0IG5vdCBoYXZlIHRvXG4gIC8vIGRlcGVuZCBvbiB0aGUgTWV0ZW9yLkVycm9yIGNsYXNzLCBgaXNDbGllbnRTYWZlYCBjYW4gYmUgc2V0IHRvIHRydWUgb24gYW55XG4gIC8vIGVycm9yIGJlZm9yZSBpdCBpcyB0aHJvd24uXG4gIGlmIChleGNlcHRpb24uaXNDbGllbnRTYWZlKSB7XG4gICAgaWYgKCEoZXhjZXB0aW9uIGluc3RhbmNlb2YgTWV0ZW9yLkVycm9yKSkge1xuICAgICAgY29uc3Qgb3JpZ2luYWxNZXNzYWdlID0gZXhjZXB0aW9uLm1lc3NhZ2U7XG4gICAgICBleGNlcHRpb24gPSBuZXcgTWV0ZW9yLkVycm9yKGV4Y2VwdGlvbi5lcnJvciwgZXhjZXB0aW9uLnJlYXNvbiwgZXhjZXB0aW9uLmRldGFpbHMpO1xuICAgICAgZXhjZXB0aW9uLm1lc3NhZ2UgPSBvcmlnaW5hbE1lc3NhZ2U7XG4gICAgfVxuICAgIHJldHVybiBleGNlcHRpb247XG4gIH1cblxuICAvLyBUZXN0cyBjYW4gc2V0IHRoZSAnX2V4cGVjdGVkQnlUZXN0JyBmbGFnIG9uIGFuIGV4Y2VwdGlvbiBzbyBpdCB3b24ndCBnbyB0b1xuICAvLyB0aGUgc2VydmVyIGxvZy5cbiAgaWYgKCFleGNlcHRpb24uX2V4cGVjdGVkQnlUZXN0KSB7XG4gICAgTWV0ZW9yLl9kZWJ1ZyhcIkV4Y2VwdGlvbiBcIiArIGNvbnRleHQsIGV4Y2VwdGlvbi5zdGFjayk7XG4gICAgaWYgKGV4Y2VwdGlvbi5zYW5pdGl6ZWRFcnJvcikge1xuICAgICAgTWV0ZW9yLl9kZWJ1ZyhcIlNhbml0aXplZCBhbmQgcmVwb3J0ZWQgdG8gdGhlIGNsaWVudCBhczpcIiwgZXhjZXB0aW9uLnNhbml0aXplZEVycm9yKTtcbiAgICAgIE1ldGVvci5fZGVidWcoKTtcbiAgICB9XG4gIH1cblxuICAvLyBEaWQgdGhlIGVycm9yIGNvbnRhaW4gbW9yZSBkZXRhaWxzIHRoYXQgY291bGQgaGF2ZSBiZWVuIHVzZWZ1bCBpZiBjYXVnaHQgaW5cbiAgLy8gc2VydmVyIGNvZGUgKG9yIGlmIHRocm93biBmcm9tIG5vbi1jbGllbnQtb3JpZ2luYXRlZCBjb2RlKSwgYnV0IGFsc29cbiAgLy8gcHJvdmlkZWQgYSBcInNhbml0aXplZFwiIHZlcnNpb24gd2l0aCBtb3JlIGNvbnRleHQgdGhhbiA1MDAgSW50ZXJuYWwgc2VydmVyIGVycm9yPyBVc2UgdGhhdC5cbiAgaWYgKGV4Y2VwdGlvbi5zYW5pdGl6ZWRFcnJvcikge1xuICAgIGlmIChleGNlcHRpb24uc2FuaXRpemVkRXJyb3IuaXNDbGllbnRTYWZlKVxuICAgICAgcmV0dXJuIGV4Y2VwdGlvbi5zYW5pdGl6ZWRFcnJvcjtcbiAgICBNZXRlb3IuX2RlYnVnKFwiRXhjZXB0aW9uIFwiICsgY29udGV4dCArIFwiIHByb3ZpZGVzIGEgc2FuaXRpemVkRXJyb3IgdGhhdCBcIiArXG4gICAgICAgICAgICAgICAgICBcImRvZXMgbm90IGhhdmUgaXNDbGllbnRTYWZlIHByb3BlcnR5IHNldDsgaWdub3JpbmdcIik7XG4gIH1cblxuICByZXR1cm4gbmV3IE1ldGVvci5FcnJvcig1MDAsIFwiSW50ZXJuYWwgc2VydmVyIGVycm9yXCIpO1xufTtcblxuXG4vLyBBdWRpdCBhcmd1bWVudCBjaGVja3MsIGlmIHRoZSBhdWRpdC1hcmd1bWVudC1jaGVja3MgcGFja2FnZSBleGlzdHMgKGl0IGlzIGFcbi8vIHdlYWsgZGVwZW5kZW5jeSBvZiB0aGlzIHBhY2thZ2UpLlxudmFyIG1heWJlQXVkaXRBcmd1bWVudENoZWNrcyA9IGZ1bmN0aW9uIChmLCBjb250ZXh0LCBhcmdzLCBkZXNjcmlwdGlvbikge1xuICBhcmdzID0gYXJncyB8fCBbXTtcbiAgaWYgKFBhY2thZ2VbJ2F1ZGl0LWFyZ3VtZW50LWNoZWNrcyddKSB7XG4gICAgcmV0dXJuIE1hdGNoLl9mYWlsSWZBcmd1bWVudHNBcmVOb3RBbGxDaGVja2VkKFxuICAgICAgZiwgY29udGV4dCwgYXJncywgZGVzY3JpcHRpb24pO1xuICB9XG4gIHJldHVybiBmLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xufTsiLCIvLyBBIHdyaXRlIGZlbmNlIGNvbGxlY3RzIGEgZ3JvdXAgb2Ygd3JpdGVzLCBhbmQgcHJvdmlkZXMgYSBjYWxsYmFja1xuLy8gd2hlbiBhbGwgb2YgdGhlIHdyaXRlcyBhcmUgZnVsbHkgY29tbWl0dGVkIGFuZCBwcm9wYWdhdGVkIChhbGxcbi8vIG9ic2VydmVycyBoYXZlIGJlZW4gbm90aWZpZWQgb2YgdGhlIHdyaXRlIGFuZCBhY2tub3dsZWRnZWQgaXQuKVxuLy9cbkREUFNlcnZlci5fV3JpdGVGZW5jZSA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5hcm1lZCA9IGZhbHNlO1xuICAgIHRoaXMuZmlyZWQgPSBmYWxzZTtcbiAgICB0aGlzLnJldGlyZWQgPSBmYWxzZTtcbiAgICB0aGlzLm91dHN0YW5kaW5nX3dyaXRlcyA9IDA7XG4gICAgdGhpcy5iZWZvcmVfZmlyZV9jYWxsYmFja3MgPSBbXTtcbiAgICB0aGlzLmNvbXBsZXRpb25fY2FsbGJhY2tzID0gW107XG4gIH1cblxuICAvLyBTdGFydCB0cmFja2luZyBhIHdyaXRlLCBhbmQgcmV0dXJuIGFuIG9iamVjdCB0byByZXByZXNlbnQgaXQuIFRoZVxuICAvLyBvYmplY3QgaGFzIGEgc2luZ2xlIG1ldGhvZCwgY29tbWl0dGVkKCkuIFRoaXMgbWV0aG9kIHNob3VsZCBiZVxuICAvLyBjYWxsZWQgd2hlbiB0aGUgd3JpdGUgaXMgZnVsbHkgY29tbWl0dGVkIGFuZCBwcm9wYWdhdGVkLiBZb3UgY2FuXG4gIC8vIGNvbnRpbnVlIHRvIGFkZCB3cml0ZXMgdG8gdGhlIFdyaXRlRmVuY2UgdXAgdW50aWwgaXQgaXMgdHJpZ2dlcmVkXG4gIC8vIChjYWxscyBpdHMgY2FsbGJhY2tzIGJlY2F1c2UgYWxsIHdyaXRlcyBoYXZlIGNvbW1pdHRlZC4pXG4gIGJlZ2luV3JpdGUoKSB7XG4gICAgaWYgKHRoaXMucmV0aXJlZClcbiAgICAgIHJldHVybiB7IGNvbW1pdHRlZDogZnVuY3Rpb24gKCkge30gfTtcblxuICAgIGlmICh0aGlzLmZpcmVkKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiZmVuY2UgaGFzIGFscmVhZHkgYWN0aXZhdGVkIC0tIHRvbyBsYXRlIHRvIGFkZCB3cml0ZXNcIik7XG5cbiAgICB0aGlzLm91dHN0YW5kaW5nX3dyaXRlcysrO1xuICAgIGxldCBjb21taXR0ZWQgPSBmYWxzZTtcbiAgICBjb25zdCBfY29tbWl0dGVkRm4gPSBhc3luYyAoKSA9PiB7XG4gICAgICBpZiAoY29tbWl0dGVkKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJjb21taXR0ZWQgY2FsbGVkIHR3aWNlIG9uIHRoZSBzYW1lIHdyaXRlXCIpO1xuICAgICAgY29tbWl0dGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMub3V0c3RhbmRpbmdfd3JpdGVzLS07XG4gICAgICBhd2FpdCB0aGlzLl9tYXliZUZpcmUoKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbW1pdHRlZDogX2NvbW1pdHRlZEZuLFxuICAgIH07XG4gIH1cblxuICAvLyBBcm0gdGhlIGZlbmNlLiBPbmNlIHRoZSBmZW5jZSBpcyBhcm1lZCwgYW5kIHRoZXJlIGFyZSBubyBtb3JlXG4gIC8vIHVuY29tbWl0dGVkIHdyaXRlcywgaXQgd2lsbCBhY3RpdmF0ZS5cbiAgYXJtKCkge1xuXG4gICAgaWYgKHRoaXMgPT09IEREUFNlcnZlci5fZ2V0Q3VycmVudEZlbmNlKCkpXG4gICAgICB0aHJvdyBFcnJvcihcIkNhbid0IGFybSB0aGUgY3VycmVudCBmZW5jZVwiKTtcbiAgICB0aGlzLmFybWVkID0gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcy5fbWF5YmVGaXJlKCk7XG4gIH1cblxuICAvLyBSZWdpc3RlciBhIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBvbmNlIGJlZm9yZSBmaXJpbmcgdGhlIGZlbmNlLlxuICAvLyBDYWxsYmFjayBmdW5jdGlvbiBjYW4gYWRkIG5ldyB3cml0ZXMgdG8gdGhlIGZlbmNlLCBpbiB3aGljaCBjYXNlXG4gIC8vIGl0IHdvbid0IGZpcmUgdW50aWwgdGhvc2Ugd3JpdGVzIGFyZSBkb25lIGFzIHdlbGwuXG4gIG9uQmVmb3JlRmlyZShmdW5jKSB7XG4gICAgaWYgKHRoaXMuZmlyZWQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJmZW5jZSBoYXMgYWxyZWFkeSBhY3RpdmF0ZWQgLS0gdG9vIGxhdGUgdG8gXCIgK1xuICAgICAgICAgIFwiYWRkIGEgY2FsbGJhY2tcIik7XG4gICAgdGhpcy5iZWZvcmVfZmlyZV9jYWxsYmFja3MucHVzaChmdW5jKTtcbiAgfVxuXG4gIC8vIFJlZ2lzdGVyIGEgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIHdoZW4gdGhlIGZlbmNlIGZpcmVzLlxuICBvbkFsbENvbW1pdHRlZChmdW5jKSB7XG4gICAgaWYgKHRoaXMuZmlyZWQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJmZW5jZSBoYXMgYWxyZWFkeSBhY3RpdmF0ZWQgLS0gdG9vIGxhdGUgdG8gXCIgK1xuICAgICAgICAgIFwiYWRkIGEgY2FsbGJhY2tcIik7XG4gICAgdGhpcy5jb21wbGV0aW9uX2NhbGxiYWNrcy5wdXNoKGZ1bmMpO1xuICB9XG5cbiAgYXN5bmMgX2FybUFuZFdhaXQoKSB7XG4gICAgbGV0IHJlc29sdmVyO1xuICAgIGNvbnN0IHJldHVyblZhbHVlID0gbmV3IFByb21pc2UociA9PiByZXNvbHZlciA9IHIpO1xuICAgIHRoaXMub25BbGxDb21taXR0ZWQocmVzb2x2ZXIpO1xuICAgIGF3YWl0IHRoaXMuYXJtKCk7XG5cbiAgICByZXR1cm4gcmV0dXJuVmFsdWU7XG4gIH1cbiAgLy8gQ29udmVuaWVuY2UgZnVuY3Rpb24uIEFybXMgdGhlIGZlbmNlLCB0aGVuIGJsb2NrcyB1bnRpbCBpdCBmaXJlcy5cbiAgYXN5bmMgYXJtQW5kV2FpdCgpIHtcbiAgICByZXR1cm4gdGhpcy5fYXJtQW5kV2FpdCgpO1xuICB9XG5cbiAgYXN5bmMgX21heWJlRmlyZSgpIHtcbiAgICBpZiAodGhpcy5maXJlZClcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIndyaXRlIGZlbmNlIGFscmVhZHkgYWN0aXZhdGVkP1wiKTtcbiAgICBpZiAodGhpcy5hcm1lZCAmJiAhdGhpcy5vdXRzdGFuZGluZ193cml0ZXMpIHtcbiAgICAgIGNvbnN0IGludm9rZUNhbGxiYWNrID0gYXN5bmMgKGZ1bmMpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCBmdW5jKHRoaXMpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBNZXRlb3IuX2RlYnVnKFwiZXhjZXB0aW9uIGluIHdyaXRlIGZlbmNlIGNhbGxiYWNrOlwiLCBlcnIpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICB0aGlzLm91dHN0YW5kaW5nX3dyaXRlcysrO1xuICAgICAgd2hpbGUgKHRoaXMuYmVmb3JlX2ZpcmVfY2FsbGJhY2tzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3QgY2IgPSB0aGlzLmJlZm9yZV9maXJlX2NhbGxiYWNrcy5zaGlmdCgpO1xuICAgICAgICBhd2FpdCBpbnZva2VDYWxsYmFjayhjYik7XG4gICAgICB9XG4gICAgICB0aGlzLm91dHN0YW5kaW5nX3dyaXRlcy0tO1xuXG4gICAgICBpZiAoIXRoaXMub3V0c3RhbmRpbmdfd3JpdGVzKSB7XG4gICAgICAgIHRoaXMuZmlyZWQgPSB0cnVlO1xuICAgICAgICBjb25zdCBjYWxsYmFja3MgPSB0aGlzLmNvbXBsZXRpb25fY2FsbGJhY2tzIHx8IFtdO1xuICAgICAgICB0aGlzLmNvbXBsZXRpb25fY2FsbGJhY2tzID0gW107XG4gICAgICAgIHdoaWxlIChjYWxsYmFja3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGNvbnN0IGNiID0gY2FsbGJhY2tzLnNoaWZ0KCk7XG4gICAgICAgICAgYXdhaXQgaW52b2tlQ2FsbGJhY2soY2IpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gRGVhY3RpdmF0ZSB0aGlzIGZlbmNlIHNvIHRoYXQgYWRkaW5nIG1vcmUgd3JpdGVzIGhhcyBubyBlZmZlY3QuXG4gIC8vIFRoZSBmZW5jZSBtdXN0IGhhdmUgYWxyZWFkeSBmaXJlZC5cbiAgcmV0aXJlKCkge1xuICAgIGlmICghdGhpcy5maXJlZClcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IHJldGlyZSBhIGZlbmNlIHRoYXQgaGFzbid0IGZpcmVkLlwiKTtcbiAgICB0aGlzLnJldGlyZWQgPSB0cnVlO1xuICB9XG59O1xuXG4vLyBUaGUgY3VycmVudCB3cml0ZSBmZW5jZS4gV2hlbiB0aGVyZSBpcyBhIGN1cnJlbnQgd3JpdGUgZmVuY2UsIGNvZGVcbi8vIHRoYXQgd3JpdGVzIHRvIGRhdGFiYXNlcyBzaG91bGQgcmVnaXN0ZXIgdGhlaXIgd3JpdGVzIHdpdGggaXQgdXNpbmdcbi8vIGJlZ2luV3JpdGUoKS5cbi8vXG5ERFBTZXJ2ZXIuX0N1cnJlbnRXcml0ZUZlbmNlID0gbmV3IE1ldGVvci5FbnZpcm9ubWVudFZhcmlhYmxlO1xuIiwiLy8gQSBcImNyb3NzYmFyXCIgaXMgYSBjbGFzcyB0aGF0IHByb3ZpZGVzIHN0cnVjdHVyZWQgbm90aWZpY2F0aW9uIHJlZ2lzdHJhdGlvbi5cbi8vIFNlZSBfbWF0Y2ggZm9yIHRoZSBkZWZpbml0aW9uIG9mIGhvdyBhIG5vdGlmaWNhdGlvbiBtYXRjaGVzIGEgdHJpZ2dlci5cbi8vIEFsbCBub3RpZmljYXRpb25zIGFuZCB0cmlnZ2VycyBtdXN0IGhhdmUgYSBzdHJpbmcga2V5IG5hbWVkICdjb2xsZWN0aW9uJy5cblxuRERQU2VydmVyLl9Dcm9zc2JhciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgc2VsZi5uZXh0SWQgPSAxO1xuICAvLyBtYXAgZnJvbSBjb2xsZWN0aW9uIG5hbWUgKHN0cmluZykgLT4gbGlzdGVuZXIgaWQgLT4gb2JqZWN0LiBlYWNoIG9iamVjdCBoYXNcbiAgLy8ga2V5cyAndHJpZ2dlcicsICdjYWxsYmFjaycuICBBcyBhIGhhY2ssIHRoZSBlbXB0eSBzdHJpbmcgbWVhbnMgXCJub1xuICAvLyBjb2xsZWN0aW9uXCIuXG4gIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uID0ge307XG4gIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uQ291bnQgPSB7fTtcbiAgc2VsZi5mYWN0UGFja2FnZSA9IG9wdGlvbnMuZmFjdFBhY2thZ2UgfHwgXCJsaXZlZGF0YVwiO1xuICBzZWxmLmZhY3ROYW1lID0gb3B0aW9ucy5mYWN0TmFtZSB8fCBudWxsO1xufTtcblxuT2JqZWN0LmFzc2lnbihERFBTZXJ2ZXIuX0Nyb3NzYmFyLnByb3RvdHlwZSwge1xuICAvLyBtc2cgaXMgYSB0cmlnZ2VyIG9yIGEgbm90aWZpY2F0aW9uXG4gIF9jb2xsZWN0aW9uRm9yTWVzc2FnZTogZnVuY3Rpb24gKG1zZykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoISgnY29sbGVjdGlvbicgaW4gbXNnKSkge1xuICAgICAgcmV0dXJuICcnO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mKG1zZy5jb2xsZWN0aW9uKSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGlmIChtc2cuY29sbGVjdGlvbiA9PT0gJycpXG4gICAgICAgIHRocm93IEVycm9yKFwiTWVzc2FnZSBoYXMgZW1wdHkgY29sbGVjdGlvbiFcIik7XG4gICAgICByZXR1cm4gbXNnLmNvbGxlY3Rpb247XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IEVycm9yKFwiTWVzc2FnZSBoYXMgbm9uLXN0cmluZyBjb2xsZWN0aW9uIVwiKTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gTGlzdGVuIGZvciBub3RpZmljYXRpb24gdGhhdCBtYXRjaCAndHJpZ2dlcicuIEEgbm90aWZpY2F0aW9uXG4gIC8vIG1hdGNoZXMgaWYgaXQgaGFzIHRoZSBrZXktdmFsdWUgcGFpcnMgaW4gdHJpZ2dlciBhcyBhXG4gIC8vIHN1YnNldC4gV2hlbiBhIG5vdGlmaWNhdGlvbiBtYXRjaGVzLCBjYWxsICdjYWxsYmFjaycsIHBhc3NpbmdcbiAgLy8gdGhlIGFjdHVhbCBub3RpZmljYXRpb24uXG4gIC8vXG4gIC8vIFJldHVybnMgYSBsaXN0ZW4gaGFuZGxlLCB3aGljaCBpcyBhbiBvYmplY3Qgd2l0aCBhIG1ldGhvZFxuICAvLyBzdG9wKCkuIENhbGwgc3RvcCgpIHRvIHN0b3AgbGlzdGVuaW5nLlxuICAvL1xuICAvLyBYWFggSXQgc2hvdWxkIGJlIGxlZ2FsIHRvIGNhbGwgZmlyZSgpIGZyb20gaW5zaWRlIGEgbGlzdGVuKClcbiAgLy8gY2FsbGJhY2s/XG4gIGxpc3RlbjogZnVuY3Rpb24gKHRyaWdnZXIsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBpZCA9IHNlbGYubmV4dElkKys7XG5cbiAgICB2YXIgY29sbGVjdGlvbiA9IHNlbGYuX2NvbGxlY3Rpb25Gb3JNZXNzYWdlKHRyaWdnZXIpO1xuICAgIHZhciByZWNvcmQgPSB7dHJpZ2dlcjogRUpTT04uY2xvbmUodHJpZ2dlciksIGNhbGxiYWNrOiBjYWxsYmFja307XG4gICAgaWYgKCEgKGNvbGxlY3Rpb24gaW4gc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb24pKSB7XG4gICAgICBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uXSA9IHt9O1xuICAgICAgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb25Db3VudFtjb2xsZWN0aW9uXSA9IDA7XG4gICAgfVxuICAgIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25dW2lkXSA9IHJlY29yZDtcbiAgICBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbkNvdW50W2NvbGxlY3Rpb25dKys7XG5cbiAgICBpZiAoc2VsZi5mYWN0TmFtZSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10pIHtcbiAgICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgICAgICBzZWxmLmZhY3RQYWNrYWdlLCBzZWxmLmZhY3ROYW1lLCAxKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgc3RvcDogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoc2VsZi5mYWN0TmFtZSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10pIHtcbiAgICAgICAgICBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgICAgICAgIHNlbGYuZmFjdFBhY2thZ2UsIHNlbGYuZmFjdE5hbWUsIC0xKTtcbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbl1baWRdO1xuICAgICAgICBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbkNvdW50W2NvbGxlY3Rpb25dLS07XG4gICAgICAgIGlmIChzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbkNvdW50W2NvbGxlY3Rpb25dID09PSAwKSB7XG4gICAgICAgICAgZGVsZXRlIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25dO1xuICAgICAgICAgIGRlbGV0ZSBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbkNvdW50W2NvbGxlY3Rpb25dO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcbiAgfSxcblxuICAvLyBGaXJlIHRoZSBwcm92aWRlZCAnbm90aWZpY2F0aW9uJyAoYW4gb2JqZWN0IHdob3NlIGF0dHJpYnV0ZVxuICAvLyB2YWx1ZXMgYXJlIGFsbCBKU09OLWNvbXBhdGliaWxlKSAtLSBpbmZvcm0gYWxsIG1hdGNoaW5nIGxpc3RlbmVyc1xuICAvLyAocmVnaXN0ZXJlZCB3aXRoIGxpc3RlbigpKS5cbiAgLy9cbiAgLy8gSWYgZmlyZSgpIGlzIGNhbGxlZCBpbnNpZGUgYSB3cml0ZSBmZW5jZSwgdGhlbiBlYWNoIG9mIHRoZVxuICAvLyBsaXN0ZW5lciBjYWxsYmFja3Mgd2lsbCBiZSBjYWxsZWQgaW5zaWRlIHRoZSB3cml0ZSBmZW5jZSBhcyB3ZWxsLlxuICAvL1xuICAvLyBUaGUgbGlzdGVuZXJzIG1heSBiZSBpbnZva2VkIGluIHBhcmFsbGVsLCByYXRoZXIgdGhhbiBzZXJpYWxseS5cbiAgZmlyZTogYXN5bmMgZnVuY3Rpb24gKG5vdGlmaWNhdGlvbikge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBjb2xsZWN0aW9uID0gc2VsZi5fY29sbGVjdGlvbkZvck1lc3NhZ2Uobm90aWZpY2F0aW9uKTtcblxuICAgIGlmICghKGNvbGxlY3Rpb24gaW4gc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb24pKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGxpc3RlbmVyc0ZvckNvbGxlY3Rpb24gPSBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uXTtcbiAgICB2YXIgY2FsbGJhY2tJZHMgPSBbXTtcbiAgICBPYmplY3QuZW50cmllcyhsaXN0ZW5lcnNGb3JDb2xsZWN0aW9uKS5mb3JFYWNoKGZ1bmN0aW9uIChbaWQsIGxdKSB7XG4gICAgICBpZiAoc2VsZi5fbWF0Y2hlcyhub3RpZmljYXRpb24sIGwudHJpZ2dlcikpIHtcbiAgICAgICAgY2FsbGJhY2tJZHMucHVzaChpZCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBMaXN0ZW5lciBjYWxsYmFja3MgY2FuIHlpZWxkLCBzbyB3ZSBuZWVkIHRvIGZpcnN0IGZpbmQgYWxsIHRoZSBvbmVzIHRoYXRcbiAgICAvLyBtYXRjaCBpbiBhIHNpbmdsZSBpdGVyYXRpb24gb3ZlciBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbiAod2hpY2ggY2FuJ3RcbiAgICAvLyBiZSBtdXRhdGVkIGR1cmluZyB0aGlzIGl0ZXJhdGlvbiksIGFuZCB0aGVuIGludm9rZSB0aGUgbWF0Y2hpbmdcbiAgICAvLyBjYWxsYmFja3MsIGNoZWNraW5nIGJlZm9yZSBlYWNoIGNhbGwgdG8gZW5zdXJlIHRoZXkgaGF2ZW4ndCBzdG9wcGVkLlxuICAgIC8vIE5vdGUgdGhhdCB3ZSBkb24ndCBoYXZlIHRvIGNoZWNrIHRoYXRcbiAgICAvLyBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uXSBzdGlsbCA9PT0gbGlzdGVuZXJzRm9yQ29sbGVjdGlvbixcbiAgICAvLyBiZWNhdXNlIHRoZSBvbmx5IHdheSB0aGF0IHN0b3BzIGJlaW5nIHRydWUgaXMgaWYgbGlzdGVuZXJzRm9yQ29sbGVjdGlvblxuICAgIC8vIGZpcnN0IGdldHMgcmVkdWNlZCBkb3duIHRvIHRoZSBlbXB0eSBvYmplY3QgKGFuZCB0aGVuIG5ldmVyIGdldHNcbiAgICAvLyBpbmNyZWFzZWQgYWdhaW4pLlxuICAgIGZvciAoY29uc3QgaWQgb2YgY2FsbGJhY2tJZHMpIHtcbiAgICAgIGlmIChpZCBpbiBsaXN0ZW5lcnNGb3JDb2xsZWN0aW9uKSB7XG4gICAgICAgIGF3YWl0IGxpc3RlbmVyc0ZvckNvbGxlY3Rpb25baWRdLmNhbGxiYWNrKG5vdGlmaWNhdGlvbik7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIC8vIEEgbm90aWZpY2F0aW9uIG1hdGNoZXMgYSB0cmlnZ2VyIGlmIGFsbCBrZXlzIHRoYXQgZXhpc3QgaW4gYm90aCBhcmUgZXF1YWwuXG4gIC8vXG4gIC8vIEV4YW1wbGVzOlxuICAvLyAgTjp7Y29sbGVjdGlvbjogXCJDXCJ9IG1hdGNoZXMgVDp7Y29sbGVjdGlvbjogXCJDXCJ9XG4gIC8vICAgIChhIG5vbi10YXJnZXRlZCB3cml0ZSB0byBhIGNvbGxlY3Rpb24gbWF0Y2hlcyBhXG4gIC8vICAgICBub24tdGFyZ2V0ZWQgcXVlcnkpXG4gIC8vICBOOntjb2xsZWN0aW9uOiBcIkNcIiwgaWQ6IFwiWFwifSBtYXRjaGVzIFQ6e2NvbGxlY3Rpb246IFwiQ1wifVxuICAvLyAgICAoYSB0YXJnZXRlZCB3cml0ZSB0byBhIGNvbGxlY3Rpb24gbWF0Y2hlcyBhIG5vbi10YXJnZXRlZCBxdWVyeSlcbiAgLy8gIE46e2NvbGxlY3Rpb246IFwiQ1wifSBtYXRjaGVzIFQ6e2NvbGxlY3Rpb246IFwiQ1wiLCBpZDogXCJYXCJ9XG4gIC8vICAgIChhIG5vbi10YXJnZXRlZCB3cml0ZSB0byBhIGNvbGxlY3Rpb24gbWF0Y2hlcyBhXG4gIC8vICAgICB0YXJnZXRlZCBxdWVyeSlcbiAgLy8gIE46e2NvbGxlY3Rpb246IFwiQ1wiLCBpZDogXCJYXCJ9IG1hdGNoZXMgVDp7Y29sbGVjdGlvbjogXCJDXCIsIGlkOiBcIlhcIn1cbiAgLy8gICAgKGEgdGFyZ2V0ZWQgd3JpdGUgdG8gYSBjb2xsZWN0aW9uIG1hdGNoZXMgYSB0YXJnZXRlZCBxdWVyeSB0YXJnZXRlZFxuICAvLyAgICAgYXQgdGhlIHNhbWUgZG9jdW1lbnQpXG4gIC8vICBOOntjb2xsZWN0aW9uOiBcIkNcIiwgaWQ6IFwiWFwifSBkb2VzIG5vdCBtYXRjaCBUOntjb2xsZWN0aW9uOiBcIkNcIiwgaWQ6IFwiWVwifVxuICAvLyAgICAoYSB0YXJnZXRlZCB3cml0ZSB0byBhIGNvbGxlY3Rpb24gZG9lcyBub3QgbWF0Y2ggYSB0YXJnZXRlZCBxdWVyeVxuICAvLyAgICAgdGFyZ2V0ZWQgYXQgYSBkaWZmZXJlbnQgZG9jdW1lbnQpXG4gIF9tYXRjaGVzOiBmdW5jdGlvbiAobm90aWZpY2F0aW9uLCB0cmlnZ2VyKSB7XG4gICAgLy8gTW9zdCBub3RpZmljYXRpb25zIHRoYXQgdXNlIHRoZSBjcm9zc2JhciBoYXZlIGEgc3RyaW5nIGBjb2xsZWN0aW9uYCBhbmRcbiAgICAvLyBtYXliZSBhbiBgaWRgIHRoYXQgaXMgYSBzdHJpbmcgb3IgT2JqZWN0SUQuIFdlJ3JlIGFscmVhZHkgZGl2aWRpbmcgdXBcbiAgICAvLyB0cmlnZ2VycyBieSBjb2xsZWN0aW9uLCBidXQgbGV0J3MgZmFzdC10cmFjayBcIm5vcGUsIGRpZmZlcmVudCBJRFwiIChhbmRcbiAgICAvLyBhdm9pZCB0aGUgb3Zlcmx5IGdlbmVyaWMgRUpTT04uZXF1YWxzKS4gVGhpcyBtYWtlcyBhIG5vdGljZWFibGVcbiAgICAvLyBwZXJmb3JtYW5jZSBkaWZmZXJlbmNlOyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3IvcHVsbC8zNjk3XG4gICAgaWYgKHR5cGVvZihub3RpZmljYXRpb24uaWQpID09PSAnc3RyaW5nJyAmJlxuICAgICAgICB0eXBlb2YodHJpZ2dlci5pZCkgPT09ICdzdHJpbmcnICYmXG4gICAgICAgIG5vdGlmaWNhdGlvbi5pZCAhPT0gdHJpZ2dlci5pZCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAobm90aWZpY2F0aW9uLmlkIGluc3RhbmNlb2YgTW9uZ29JRC5PYmplY3RJRCAmJlxuICAgICAgICB0cmlnZ2VyLmlkIGluc3RhbmNlb2YgTW9uZ29JRC5PYmplY3RJRCAmJlxuICAgICAgICAhIG5vdGlmaWNhdGlvbi5pZC5lcXVhbHModHJpZ2dlci5pZCkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gT2JqZWN0LmtleXModHJpZ2dlcikuZXZlcnkoZnVuY3Rpb24gKGtleSkge1xuICAgICAgcmV0dXJuICEoa2V5IGluIG5vdGlmaWNhdGlvbikgfHwgRUpTT04uZXF1YWxzKHRyaWdnZXJba2V5XSwgbm90aWZpY2F0aW9uW2tleV0pO1xuICAgICB9KTtcbiAgfVxufSk7XG5cbi8vIFRoZSBcImludmFsaWRhdGlvbiBjcm9zc2JhclwiIGlzIGEgc3BlY2lmaWMgaW5zdGFuY2UgdXNlZCBieSB0aGUgRERQIHNlcnZlciB0b1xuLy8gaW1wbGVtZW50IHdyaXRlIGZlbmNlIG5vdGlmaWNhdGlvbnMuIExpc3RlbmVyIGNhbGxiYWNrcyBvbiB0aGlzIGNyb3NzYmFyXG4vLyBzaG91bGQgY2FsbCBiZWdpbldyaXRlIG9uIHRoZSBjdXJyZW50IHdyaXRlIGZlbmNlIGJlZm9yZSB0aGV5IHJldHVybiwgaWYgdGhleVxuLy8gd2FudCB0byBkZWxheSB0aGUgd3JpdGUgZmVuY2UgZnJvbSBmaXJpbmcgKGllLCB0aGUgRERQIG1ldGhvZC1kYXRhLXVwZGF0ZWRcbi8vIG1lc3NhZ2UgZnJvbSBiZWluZyBzZW50KS5cbkREUFNlcnZlci5fSW52YWxpZGF0aW9uQ3Jvc3NiYXIgPSBuZXcgRERQU2VydmVyLl9Dcm9zc2Jhcih7XG4gIGZhY3ROYW1lOiBcImludmFsaWRhdGlvbi1jcm9zc2Jhci1saXN0ZW5lcnNcIlxufSk7IiwiaWYgKHByb2Nlc3MuZW52LkREUF9ERUZBVUxUX0NPTk5FQ1RJT05fVVJMKSB7XG4gIF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uRERQX0RFRkFVTFRfQ09OTkVDVElPTl9VUkwgPVxuICAgIHByb2Nlc3MuZW52LkREUF9ERUZBVUxUX0NPTk5FQ1RJT05fVVJMO1xufVxuXG5NZXRlb3Iuc2VydmVyID0gbmV3IFNlcnZlcigpO1xuXG5NZXRlb3IucmVmcmVzaCA9IGFzeW5jIGZ1bmN0aW9uIChub3RpZmljYXRpb24pIHtcbiAgYXdhaXQgRERQU2VydmVyLl9JbnZhbGlkYXRpb25Dcm9zc2Jhci5maXJlKG5vdGlmaWNhdGlvbik7XG59O1xuXG4vLyBQcm94eSB0aGUgcHVibGljIG1ldGhvZHMgb2YgTWV0ZW9yLnNlcnZlciBzbyB0aGV5IGNhblxuLy8gYmUgY2FsbGVkIGRpcmVjdGx5IG9uIE1ldGVvci5cblxuICBbXG4gICAgJ3B1Ymxpc2gnLFxuICAgICdpc0FzeW5jQ2FsbCcsXG4gICAgJ21ldGhvZHMnLFxuICAgICdjYWxsJyxcbiAgICAnY2FsbEFzeW5jJyxcbiAgICAnYXBwbHknLFxuICAgICdhcHBseUFzeW5jJyxcbiAgICAnb25Db25uZWN0aW9uJyxcbiAgICAnb25NZXNzYWdlJyxcbiAgXS5mb3JFYWNoKFxuICBmdW5jdGlvbihuYW1lKSB7XG4gICAgTWV0ZW9yW25hbWVdID0gTWV0ZW9yLnNlcnZlcltuYW1lXS5iaW5kKE1ldGVvci5zZXJ2ZXIpO1xuICB9XG4pO1xuIl19
