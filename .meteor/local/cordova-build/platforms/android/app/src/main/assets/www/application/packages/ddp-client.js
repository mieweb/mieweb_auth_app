//////////////////////////////////////////////////////////////////////////
//                                                                      //
// This is a generated file. You can view the original                  //
// source in your browser if your browser supports source maps.         //
// Source maps are supported by all recent versions of Chrome, Safari,  //
// and Firefox, and by Internet Explorer 11.                            //
//                                                                      //
//////////////////////////////////////////////////////////////////////////


Package["core-runtime"].queue("ddp-client",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var Retry = Package.retry.Retry;
var IdMap = Package['id-map'].IdMap;
var Hook = Package['callback-hook'].Hook;
var DDPCommon = Package['ddp-common'].DDPCommon;
var Reload = Package.reload.Reload;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var MongoID = Package['mongo-id'].MongoID;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package.modules.meteorBabelHelpers;
var Promise = Package.promise.Promise;
var Symbol = Package['ecmascript-runtime-client'].Symbol;
var Map = Package['ecmascript-runtime-client'].Map;
var Set = Package['ecmascript-runtime-client'].Set;

/* Package-scope variables */
var DDP;

var require = meteorInstall({"node_modules":{"meteor":{"ddp-client":{"client":{"client.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-client/client/client.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.link("../common/namespace.js", {
  DDP: "DDP"
}, 0);
module.link("../common/livedata_connection");
module.link("./client_convenience");
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"client_convenience.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-client/client/client_convenience.js                                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var DDP;
module.link("../common/namespace.js", {
  DDP: function (v) {
    DDP = v;
  }
}, 0);
var Meteor;
module.link("meteor/meteor", {
  Meteor: function (v) {
    Meteor = v;
  }
}, 1);
var loadAsyncStubHelpers;
module.link("./queueStubsHelpers", {
  loadAsyncStubHelpers: function (v) {
    loadAsyncStubHelpers = v;
  }
}, 2);
// Meteor.refresh can be called on the client (if you're in common code) but it
// only has an effect on the server.
Meteor.refresh = function () {};

// By default, try to connect back to the same endpoint as the page
// was served from.
//
// XXX We should be doing this a different way. Right now we don't
// include ROOT_URL_PATH_PREFIX when computing ddpUrl. (We don't
// include it on the server when computing
// DDP_DEFAULT_CONNECTION_URL, and we don't include it in our
// default, '/'.) We get by with this because DDP.connect then
// forces the URL passed to it to be interpreted relative to the
// app's deploy path, even if it is absolute. Instead, we should
// make DDP_DEFAULT_CONNECTION_URL, if set, include the path prefix;
// make the default ddpUrl be '' rather that '/'; and make
// _translateUrl in stream_client_common.js not force absolute paths
// to be treated like relative paths. See also
// stream_client_common.js #RationalizingRelativeDDPURLs
var runtimeConfig = typeof __meteor_runtime_config__ !== 'undefined' ? __meteor_runtime_config__ : Object.create(null);
var ddpUrl = runtimeConfig.DDP_DEFAULT_CONNECTION_URL || '/';
var retry = new Retry();
function onDDPVersionNegotiationFailure(description) {
  Meteor._debug(description);
  if (Package.reload) {
    var migrationData = Package.reload.Reload._migrationData('livedata') || Object.create(null);
    var failures = migrationData.DDPVersionNegotiationFailures || 0;
    ++failures;
    Package.reload.Reload._onMigrate('livedata', function () {
      return [true, {
        DDPVersionNegotiationFailures: failures
      }];
    });
    retry.retryLater(failures, function () {
      Package.reload.Reload._reload({
        immediateMigration: true
      });
    });
  }
}

// Makes sure to inject the stub async helpers before creating the connection
loadAsyncStubHelpers();
Meteor.connection = DDP.connect(ddpUrl, {
  onDDPVersionNegotiationFailure: onDDPVersionNegotiationFailure
});

// Proxy the public methods of Meteor.connection so they can
// be called directly on Meteor.
['subscribe', 'methods', 'isAsyncCall', 'call', 'callAsync', 'apply', 'applyAsync', 'status', 'reconnect', 'disconnect'].forEach(function (name) {
  Meteor[name] = Meteor.connection[name].bind(Meteor.connection);
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"queueStubsHelpers.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-client/client/queueStubsHelpers.js                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var _objectSpread;
module.link("@babel/runtime/helpers/objectSpread2", {
  default: function (v) {
    _objectSpread = v;
  }
}, 0);
module.export({
  loadAsyncStubHelpers: function () {
    return loadAsyncStubHelpers;
  }
});
var DDP;
module.link("../common/namespace.js", {
  DDP: function (v) {
    DDP = v;
  }
}, 0);
var Connection;
module.link("../common/livedata_connection", {
  Connection: function (v) {
    Connection = v;
  }
}, 1);
// https://forums.meteor.com/t/proposal-to-fix-issues-with-async-method-stubs/60826

var queueSize = 0;
var queue = Promise.resolve();
var loadAsyncStubHelpers = function () {
  function queueFunction(fn) {
    var promiseProps = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    queueSize += 1;
    var resolve;
    var reject;
    var promise = new Promise(function (_resolve, _reject) {
      resolve = _resolve;
      reject = _reject;
    });
    queue = queue.finally(function () {
      var _promise$stubPromise;
      fn(resolve, reject);
      return (_promise$stubPromise = promise.stubPromise) === null || _promise$stubPromise === void 0 ? void 0 : _promise$stubPromise.catch(function () {}); // silent uncaught promise
    });
    promise.catch(function () {}) // silent uncaught promise
    .finally(function () {
      queueSize -= 1;
      if (queueSize === 0) {
        Meteor.connection._maybeMigrate();
      }
    });
    promise.stubPromise = promiseProps.stubPromise;
    promise.serverPromise = promiseProps.serverPromise;
    return promise;
  }
  var oldReadyToMigrate = Connection.prototype._readyToMigrate;
  Connection.prototype._readyToMigrate = function () {
    if (queueSize > 0) {
      return false;
    }
    return oldReadyToMigrate.apply(this, arguments);
  };
  var currentMethodInvocation = null;

  /**
   * Meteor sets CurrentMethodInvocation to undefined for the reasons explained at
   * https://github.com/meteor/meteor/blob/c9e3551b9673a7ed607f18cb1128563ff49ca96f/packages/ddp-client/common/livedata_connection.js#L578-L605
   * The app code could call `.then` on a promise while the async stub is running,
   * causing the `then` callback to think it is inside the stub.
   *
   * With the queueing we are doing, this is no longer necessary. The point
   * of the queueing is to prevent app/package code from running while
   * the stub is running, so we don't need to worry about this.
   */

  var oldApplyAsync = Connection.prototype.applyAsync;
  Connection.prototype.applyAsync = function () {
    var _this = this;
    var args = arguments;
    var name = args[0];
    if (currentMethodInvocation) {
      DDP._CurrentMethodInvocation._set(currentMethodInvocation);
      currentMethodInvocation = null;
    }
    var enclosing = DDP._CurrentMethodInvocation.get();
    var alreadyInSimulation = enclosing === null || enclosing === void 0 ? void 0 : enclosing.isSimulation;
    var isFromCallAsync = enclosing === null || enclosing === void 0 ? void 0 : enclosing._isFromCallAsync;
    if (Meteor.connection._getIsSimulation({
      isFromCallAsync: isFromCallAsync,
      alreadyInSimulation: alreadyInSimulation
    })) {
      // In stub - call immediately
      return oldApplyAsync.apply(this, args);
    }
    var stubPromiseResolver;
    var serverPromiseResolver;
    var stubPromise = new Promise(function (r) {
      return stubPromiseResolver = r;
    });
    var serverPromise = new Promise(function (r) {
      return serverPromiseResolver = r;
    });
    return queueFunction(function (resolve, reject) {
      var finished = false;
      Meteor._setImmediate(function () {
        var applyAsyncPromise = oldApplyAsync.apply(_this, args);
        stubPromiseResolver(applyAsyncPromise.stubPromise);
        serverPromiseResolver(applyAsyncPromise.serverPromise);
        applyAsyncPromise.stubPromise.catch(function () {}) // silent uncaught promise
        .finally(function () {
          finished = true;
        });
        applyAsyncPromise.then(function (result) {
          resolve(result);
        }).catch(function (err) {
          reject(err);
        });
        serverPromise.catch(function () {}); // silent uncaught promise
      });
      Meteor._setImmediate(function () {
        if (!finished) {
          console.warn("Method stub (" + name + ") took too long and could cause unexpected problems. Learn more at https://v3-migration-docs.meteor.com/breaking-changes/call-x-callAsync.html#considerations-for-effective-use-of-meteor-callasync");
        }
      });
    }, {
      stubPromise: stubPromise,
      serverPromise: serverPromise
    });
  };
  var oldApply = Connection.prototype.apply;
  Connection.prototype.apply = function (name, args, options, callback) {
    var _this2 = this;
    if (this._stream._neverQueued) {
      return oldApply.apply(this, arguments);
    }

    // Apply runs the stub before synchronously returning.
    //
    // However, we want the server to run the methods in the original call order
    // so we have to queue sending the message to the server until any previous async
    // methods run.
    // This does mean the stubs run in a different order than the methods on the
    // server.

    if (!callback && typeof options === 'function') {
      callback = options;
      options = undefined;
    }
    var _oldApply$call = oldApply.call(this, name, args, _objectSpread(_objectSpread({}, options), {}, {
        _returnMethodInvoker: true
      }), callback),
      methodInvoker = _oldApply$call.methodInvoker,
      result = _oldApply$call.result;
    if (methodInvoker) {
      queueFunction(function (resolve) {
        _this2._addOutstandingMethod(methodInvoker, options);
        resolve();
      });
    }
    return result;
  };

  /**
   * Queue subscriptions in case they rely on previous method calls
   */
  var queueSend = false;
  var oldSubscribe = Connection.prototype.subscribe;
  Connection.prototype.subscribe = function () {
    if (this._stream._neverQueued) {
      return oldSubscribe.apply(this, arguments);
    }
    queueSend = true;
    try {
      return oldSubscribe.apply(this, arguments);
    } finally {
      queueSend = false;
    }
  };
  var oldSend = Connection.prototype._send;
  Connection.prototype._send = function (params, shouldQueue) {
    var _this3 = this;
    if (this._stream._neverQueued) {
      return oldSend.apply(this, arguments);
    }
    if (!queueSend && !shouldQueue) {
      return oldSend.call(this, params);
    }
    queueSend = false;
    queueFunction(function (resolve) {
      try {
        oldSend.call(_this3, params);
      } finally {
        resolve();
      }
    });
  };
  var _oldSendOutstandingMethodBlocksMessages = Connection.prototype._sendOutstandingMethodBlocksMessages;
  Connection.prototype._sendOutstandingMethodBlocksMessages = function () {
    var _arguments = arguments,
      _this4 = this;
    if (this._stream._neverQueued) {
      return _oldSendOutstandingMethodBlocksMessages.apply(this, arguments);
    }
    queueFunction(function (resolve) {
      try {
        _oldSendOutstandingMethodBlocksMessages.apply(_this4, _arguments);
      } finally {
        resolve();
      }
    });
  };
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"common":{"MethodInvoker.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-client/common/MethodInvoker.js                                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  "default": function () {
    return MethodInvoker;
  }
});
var MethodInvoker = /*#__PURE__*/function () {
  function MethodInvoker(options) {
    // Public (within this file) fields.
    this.methodId = options.methodId;
    this.sentMessage = false;
    this._callback = options.callback;
    this._connection = options.connection;
    this._message = options.message;
    this._onResultReceived = options.onResultReceived || function () {};
    this._wait = options.wait;
    this.noRetry = options.noRetry;
    this._methodResult = null;
    this._dataVisible = false;

    // Register with the connection.
    this._connection._methodInvokers[this.methodId] = this;
  }
  // Sends the method message to the server. May be called additional times if
  // we lose the connection and reconnect before receiving a result.
  var _proto = MethodInvoker.prototype;
  _proto.sendMessage = function () {
    function sendMessage() {
      // This function is called before sending a method (including resending on
      // reconnect). We should only (re)send methods where we don't already have a
      // result!
      if (this.gotResult()) throw new Error('sendingMethod is called on method with result');

      // If we're re-sending it, it doesn't matter if data was written the first
      // time.
      this._dataVisible = false;
      this.sentMessage = true;

      // If this is a wait method, make all data messages be buffered until it is
      // done.
      if (this._wait) this._connection._methodsBlockingQuiescence[this.methodId] = true;

      // Actually send the message.
      this._connection._send(this._message);
    }
    return sendMessage;
  }() // Invoke the callback, if we have both a result and know that all data has
  // been written to the local cache.
  ;
  _proto._maybeInvokeCallback = function () {
    function _maybeInvokeCallback() {
      if (this._methodResult && this._dataVisible) {
        // Call the callback. (This won't throw: the callback was wrapped with
        // bindEnvironment.)
        this._callback(this._methodResult[0], this._methodResult[1]);

        // Forget about this method.
        delete this._connection._methodInvokers[this.methodId];

        // Let the connection know that this method is finished, so it can try to
        // move on to the next block of methods.
        this._connection._outstandingMethodFinished();
      }
    }
    return _maybeInvokeCallback;
  }() // Call with the result of the method from the server. Only may be called
  // once; once it is called, you should not call sendMessage again.
  // If the user provided an onResultReceived callback, call it immediately.
  // Then invoke the main callback if data is also visible.
  ;
  _proto.receiveResult = function () {
    function receiveResult(err, result) {
      if (this.gotResult()) throw new Error('Methods should only receive results once');
      this._methodResult = [err, result];
      this._onResultReceived(err, result);
      this._maybeInvokeCallback();
    }
    return receiveResult;
  }() // Call this when all data written by the method is visible. This means that
  // the method has returns its "data is done" message *AND* all server
  // documents that are buffered at that time have been written to the local
  // cache. Invokes the main callback if the result has been received.
  ;
  _proto.dataVisible = function () {
    function dataVisible() {
      this._dataVisible = true;
      this._maybeInvokeCallback();
    }
    return dataVisible;
  }() // True if receiveResult has been called.
  ;
  _proto.gotResult = function () {
    function gotResult() {
      return !!this._methodResult;
    }
    return gotResult;
  }();
  return MethodInvoker;
}();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livedata_connection.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-client/common/livedata_connection.js                                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var _excluded = ["stubInvocation", "invocation"],
  _excluded2 = ["stubInvocation", "invocation"];
var _toConsumableArray;
module.link("@babel/runtime/helpers/toConsumableArray", {
  default: function (v) {
    _toConsumableArray = v;
  }
}, 0);
var _objectWithoutProperties;
module.link("@babel/runtime/helpers/objectWithoutProperties", {
  default: function (v) {
    _objectWithoutProperties = v;
  }
}, 1);
var _regeneratorRuntime;
module.link("@babel/runtime/regenerator", {
  default: function (v) {
    _regeneratorRuntime = v;
  }
}, 2);
var _slicedToArray;
module.link("@babel/runtime/helpers/slicedToArray", {
  default: function (v) {
    _slicedToArray = v;
  }
}, 3);
var _createForOfIteratorHelperLoose;
module.link("@babel/runtime/helpers/createForOfIteratorHelperLoose", {
  default: function (v) {
    _createForOfIteratorHelperLoose = v;
  }
}, 4);
var _typeof;
module.link("@babel/runtime/helpers/typeof", {
  default: function (v) {
    _typeof = v;
  }
}, 5);
var _objectSpread;
module.link("@babel/runtime/helpers/objectSpread2", {
  default: function (v) {
    _objectSpread = v;
  }
}, 6);
var _inheritsLoose;
module.link("@babel/runtime/helpers/inheritsLoose", {
  default: function (v) {
    _inheritsLoose = v;
  }
}, 7);
module.export({
  Connection: function () {
    return Connection;
  }
});
var Meteor;
module.link("meteor/meteor", {
  Meteor: function (v) {
    Meteor = v;
  }
}, 0);
var DDPCommon;
module.link("meteor/ddp-common", {
  DDPCommon: function (v) {
    DDPCommon = v;
  }
}, 1);
var Tracker;
module.link("meteor/tracker", {
  Tracker: function (v) {
    Tracker = v;
  }
}, 2);
var EJSON;
module.link("meteor/ejson", {
  EJSON: function (v) {
    EJSON = v;
  }
}, 3);
var Random;
module.link("meteor/random", {
  Random: function (v) {
    Random = v;
  }
}, 4);
var MongoID;
module.link("meteor/mongo-id", {
  MongoID: function (v) {
    MongoID = v;
  }
}, 5);
var DDP;
module.link("./namespace.js", {
  DDP: function (v) {
    DDP = v;
  }
}, 6);
var MethodInvoker;
module.link("./MethodInvoker.js", {
  "default": function (v) {
    MethodInvoker = v;
  }
}, 7);
var hasOwn, slice, keys, isEmpty, last;
module.link("meteor/ddp-common/utils.js", {
  hasOwn: function (v) {
    hasOwn = v;
  },
  slice: function (v) {
    slice = v;
  },
  keys: function (v) {
    keys = v;
  },
  isEmpty: function (v) {
    isEmpty = v;
  },
  last: function (v) {
    last = v;
  }
}, 8);
var MongoIDMap = /*#__PURE__*/function (_IdMap) {
  function MongoIDMap() {
    return _IdMap.call(this, MongoID.idStringify, MongoID.idParse) || this;
  }
  _inheritsLoose(MongoIDMap, _IdMap);
  return MongoIDMap;
}(IdMap); // @param url {String|Object} URL to Meteor app,
//   or an object as a test hook (see code)
// Options:
//   reloadWithOutstanding: is it OK to reload if there are outstanding methods?
//   headers: extra headers to send on the websockets connection, for
//     server-to-server DDP only
//   _sockjsOptions: Specifies options to pass through to the sockjs client
//   onDDPNegotiationVersionFailure: callback when version negotiation fails.
//
// XXX There should be a way to destroy a DDP connection, causing all
// outstanding method calls to fail.
//
// XXX Our current way of handling failure and reconnection is great
// for an app (where we want to tolerate being disconnected as an
// expect state, and keep trying forever to reconnect) but cumbersome
// for something like a command line tool that wants to make a
// connection, call a method, and print an error if connection
// fails. We should have better usability in the latter case (while
// still transparently reconnecting if it's just a transient failure
// or the server migrating us).
var Connection = /*#__PURE__*/function () {
  function Connection(url, options) {
    var self = this;
    this.options = options = _objectSpread({
      onConnected: function () {},
      onDDPVersionNegotiationFailure: function (description) {
        Meteor._debug(description);
      },
      heartbeatInterval: 17500,
      heartbeatTimeout: 15000,
      npmFayeOptions: Object.create(null),
      // These options are only for testing.
      reloadWithOutstanding: false,
      supportedDDPVersions: DDPCommon.SUPPORTED_DDP_VERSIONS,
      retry: true,
      respondToPings: true,
      // When updates are coming within this ms interval, batch them together.
      bufferedWritesInterval: 5,
      // Flush buffers immediately if writes are happening continuously for more than this many ms.
      bufferedWritesMaxAge: 500
    }, options);

    // If set, called when we reconnect, queuing method calls _before_ the
    // existing outstanding ones.
    // NOTE: This feature has been preserved for backwards compatibility. The
    // preferred method of setting a callback on reconnect is to use
    // DDP.onReconnect.
    self.onReconnect = null;

    // as a test hook, allow passing a stream instead of a url.
    if (_typeof(url) === 'object') {
      self._stream = url;
    } else {
      var ClientStream;
      module.link("meteor/socket-stream-client", {
        ClientStream: function (v) {
          ClientStream = v;
        }
      }, 9);
      self._stream = new ClientStream(url, {
        retry: options.retry,
        ConnectionError: DDP.ConnectionError,
        headers: options.headers,
        _sockjsOptions: options._sockjsOptions,
        // Used to keep some tests quiet, or for other cases in which
        // the right thing to do with connection errors is to silently
        // fail (e.g. sending package usage stats). At some point we
        // should have a real API for handling client-stream-level
        // errors.
        _dontPrintErrors: options._dontPrintErrors,
        connectTimeoutMs: options.connectTimeoutMs,
        npmFayeOptions: options.npmFayeOptions
      });
    }
    self._lastSessionId = null;
    self._versionSuggestion = null; // The last proposed DDP version.
    self._version = null; // The DDP version agreed on by client and server.
    self._stores = Object.create(null); // name -> object with methods
    self._methodHandlers = Object.create(null); // name -> func
    self._nextMethodId = 1;
    self._supportedDDPVersions = options.supportedDDPVersions;
    self._heartbeatInterval = options.heartbeatInterval;
    self._heartbeatTimeout = options.heartbeatTimeout;

    // Tracks methods which the user has tried to call but which have not yet
    // called their user callback (ie, they are waiting on their result or for all
    // of their writes to be written to the local cache). Map from method ID to
    // MethodInvoker object.
    self._methodInvokers = Object.create(null);

    // Tracks methods which the user has called but whose result messages have not
    // arrived yet.
    //
    // _outstandingMethodBlocks is an array of blocks of methods. Each block
    // represents a set of methods that can run at the same time. The first block
    // represents the methods which are currently in flight; subsequent blocks
    // must wait for previous blocks to be fully finished before they can be sent
    // to the server.
    //
    // Each block is an object with the following fields:
    // - methods: a list of MethodInvoker objects
    // - wait: a boolean; if true, this block had a single method invoked with
    //         the "wait" option
    //
    // There will never be adjacent blocks with wait=false, because the only thing
    // that makes methods need to be serialized is a wait method.
    //
    // Methods are removed from the first block when their "result" is
    // received. The entire first block is only removed when all of the in-flight
    // methods have received their results (so the "methods" list is empty) *AND*
    // all of the data written by those methods are visible in the local cache. So
    // it is possible for the first block's methods list to be empty, if we are
    // still waiting for some objects to quiesce.
    //
    // Example:
    //  _outstandingMethodBlocks = [
    //    {wait: false, methods: []},
    //    {wait: true, methods: [<MethodInvoker for 'login'>]},
    //    {wait: false, methods: [<MethodInvoker for 'foo'>,
    //                            <MethodInvoker for 'bar'>]}]
    // This means that there were some methods which were sent to the server and
    // which have returned their results, but some of the data written by
    // the methods may not be visible in the local cache. Once all that data is
    // visible, we will send a 'login' method. Once the login method has returned
    // and all the data is visible (including re-running subs if userId changes),
    // we will send the 'foo' and 'bar' methods in parallel.
    self._outstandingMethodBlocks = [];

    // method ID -> array of objects with keys 'collection' and 'id', listing
    // documents written by a given method's stub. keys are associated with
    // methods whose stub wrote at least one document, and whose data-done message
    // has not yet been received.
    self._documentsWrittenByStub = {};
    // collection -> IdMap of "server document" object. A "server document" has:
    // - "document": the version of the document according the
    //   server (ie, the snapshot before a stub wrote it, amended by any changes
    //   received from the server)
    //   It is undefined if we think the document does not exist
    // - "writtenByStubs": a set of method IDs whose stubs wrote to the document
    //   whose "data done" messages have not yet been processed
    self._serverDocuments = {};

    // Array of callbacks to be called after the next update of the local
    // cache. Used for:
    //  - Calling methodInvoker.dataVisible and sub ready callbacks after
    //    the relevant data is flushed.
    //  - Invoking the callbacks of "half-finished" methods after reconnect
    //    quiescence. Specifically, methods whose result was received over the old
    //    connection (so we don't re-send it) but whose data had not been made
    //    visible.
    self._afterUpdateCallbacks = [];

    // In two contexts, we buffer all incoming data messages and then process them
    // all at once in a single update:
    //   - During reconnect, we buffer all data messages until all subs that had
    //     been ready before reconnect are ready again, and all methods that are
    //     active have returned their "data done message"; then
    //   - During the execution of a "wait" method, we buffer all data messages
    //     until the wait method gets its "data done" message. (If the wait method
    //     occurs during reconnect, it doesn't get any special handling.)
    // all data messages are processed in one update.
    //
    // The following fields are used for this "quiescence" process.

    // This buffers the messages that aren't being processed yet.
    self._messagesBufferedUntilQuiescence = [];
    // Map from method ID -> true. Methods are removed from this when their
    // "data done" message is received, and we will not quiesce until it is
    // empty.
    self._methodsBlockingQuiescence = {};
    // map from sub ID -> true for subs that were ready (ie, called the sub
    // ready callback) before reconnect but haven't become ready again yet
    self._subsBeingRevived = {}; // map from sub._id -> true
    // if true, the next data update should reset all stores. (set during
    // reconnect.)
    self._resetStores = false;

    // name -> array of updates for (yet to be created) collections
    self._updatesForUnknownStores = {};
    // if we're blocking a migration, the retry func
    self._retryMigrate = null;
    self.__flushBufferedWrites = Meteor.bindEnvironment(self._flushBufferedWrites, 'flushing DDP buffered writes', self);
    // Collection name -> array of messages.
    self._bufferedWrites = {};
    // When current buffer of updates must be flushed at, in ms timestamp.
    self._bufferedWritesFlushAt = null;
    // Timeout handle for the next processing of all pending writes
    self._bufferedWritesFlushHandle = null;
    self._bufferedWritesInterval = options.bufferedWritesInterval;
    self._bufferedWritesMaxAge = options.bufferedWritesMaxAge;

    // metadata for subscriptions.  Map from sub ID to object with keys:
    //   - id
    //   - name
    //   - params
    //   - inactive (if true, will be cleaned up if not reused in re-run)
    //   - ready (has the 'ready' message been received?)
    //   - readyCallback (an optional callback to call when ready)
    //   - errorCallback (an optional callback to call if the sub terminates with
    //                    an error, XXX COMPAT WITH 1.0.3.1)
    //   - stopCallback (an optional callback to call when the sub terminates
    //     for any reason, with an error argument if an error triggered the stop)
    self._subscriptions = {};

    // Reactive userId.
    self._userId = null;
    self._userIdDeps = new Tracker.Dependency();

    // Block auto-reload while we're waiting for method responses.
    if (Meteor.isClient && Package.reload && !options.reloadWithOutstanding) {
      Package.reload.Reload._onMigrate(function (retry) {
        if (!self._readyToMigrate()) {
          self._retryMigrate = retry;
          return [false];
        } else {
          return [true];
        }
      });
    }
    var onDisconnect = function () {
      if (self._heartbeat) {
        self._heartbeat.stop();
        self._heartbeat = null;
      }
    };
    if (Meteor.isServer) {
      self._stream.on('message', Meteor.bindEnvironment(this.onMessage.bind(this), 'handling DDP message'));
      self._stream.on('reset', Meteor.bindEnvironment(this.onReset.bind(this), 'handling DDP reset'));
      self._stream.on('disconnect', Meteor.bindEnvironment(onDisconnect, 'handling DDP disconnect'));
    } else {
      self._stream.on('message', this.onMessage.bind(this));
      self._stream.on('reset', this.onReset.bind(this));
      self._stream.on('disconnect', onDisconnect);
    }
  }

  // 'name' is the name of the data on the wire that should go in the
  // store. 'wrappedStore' should be an object with methods beginUpdate, update,
  // endUpdate, saveOriginals, retrieveOriginals. see Collection for an example.
  var _proto = Connection.prototype;
  _proto.createStoreMethods = function () {
    function createStoreMethods(name, wrappedStore) {
      var self = this;
      if (name in self._stores) return false;

      // Wrap the input object in an object which makes any store method not
      // implemented by 'store' into a no-op.
      var store = Object.create(null);
      var keysOfStore = ['update', 'beginUpdate', 'endUpdate', 'saveOriginals', 'retrieveOriginals', 'getDoc', '_getCollection'];
      keysOfStore.forEach(function (method) {
        store[method] = function () {
          if (wrappedStore[method]) {
            return wrappedStore[method].apply(wrappedStore, arguments);
          }
        };
      });
      self._stores[name] = store;
      return store;
    }
    return createStoreMethods;
  }();
  _proto.registerStoreClient = function () {
    function registerStoreClient(name, wrappedStore) {
      var self = this;
      var store = self.createStoreMethods(name, wrappedStore);
      var queued = self._updatesForUnknownStores[name];
      if (Array.isArray(queued)) {
        store.beginUpdate(queued.length, false);
        queued.forEach(function (msg) {
          store.update(msg);
        });
        store.endUpdate();
        delete self._updatesForUnknownStores[name];
      }
      return true;
    }
    return registerStoreClient;
  }();
  _proto.registerStoreServer = function () {
    function registerStoreServer(name, wrappedStore) {
      var self, store, queued, _iterator, _step, msg;
      return _regeneratorRuntime.async(function () {
        function registerStoreServer$(_context) {
          while (1) switch (_context.prev = _context.next) {
            case 0:
              self = this;
              store = self.createStoreMethods(name, wrappedStore);
              queued = self._updatesForUnknownStores[name];
              if (!Array.isArray(queued)) {
                _context.next = 16;
                break;
              }
              _context.next = 6;
              return _regeneratorRuntime.awrap(store.beginUpdate(queued.length, false));
            case 6:
              _iterator = _createForOfIteratorHelperLoose(queued);
            case 7:
              if ((_step = _iterator()).done) {
                _context.next = 13;
                break;
              }
              msg = _step.value;
              _context.next = 11;
              return _regeneratorRuntime.awrap(store.update(msg));
            case 11:
              _context.next = 7;
              break;
            case 13:
              _context.next = 15;
              return _regeneratorRuntime.awrap(store.endUpdate());
            case 15:
              delete self._updatesForUnknownStores[name];
            case 16:
              return _context.abrupt("return", true);
            case 17:
            case "end":
              return _context.stop();
          }
        }
        return registerStoreServer$;
      }(), null, this, null, Promise);
    }
    return registerStoreServer;
  }()
  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.subscribe
   * @summary Subscribe to a record set.  Returns a handle that provides
   * `stop()` and `ready()` methods.
   * @locus Client
   * @param {String} name Name of the subscription.  Matches the name of the
   * server's `publish()` call.
   * @param {EJSONable} [arg1,arg2...] Optional arguments passed to publisher
   * function on server.
   * @param {Function|Object} [callbacks] Optional. May include `onStop`
   * and `onReady` callbacks. If there is an error, it is passed as an
   * argument to `onStop`. If a function is passed instead of an object, it
   * is interpreted as an `onReady` callback.
   */
  ;
  _proto.subscribe = function () {
    function subscribe(name /* .. [arguments] .. (callback|callbacks) */) {
      var self = this;
      var params = slice.call(arguments, 1);
      var callbacks = Object.create(null);
      if (params.length) {
        var lastParam = params[params.length - 1];
        if (typeof lastParam === 'function') {
          callbacks.onReady = params.pop();
        } else if (lastParam && [lastParam.onReady,
        // XXX COMPAT WITH 1.0.3.1 onError used to exist, but now we use
        // onStop with an error callback instead.
        lastParam.onError, lastParam.onStop].some(function (f) {
          return typeof f === "function";
        })) {
          callbacks = params.pop();
        }
      }

      // Is there an existing sub with the same name and param, run in an
      // invalidated Computation? This will happen if we are rerunning an
      // existing computation.
      //
      // For example, consider a rerun of:
      //
      //     Tracker.autorun(function () {
      //       Meteor.subscribe("foo", Session.get("foo"));
      //       Meteor.subscribe("bar", Session.get("bar"));
      //     });
      //
      // If "foo" has changed but "bar" has not, we will match the "bar"
      // subcribe to an existing inactive subscription in order to not
      // unsub and resub the subscription unnecessarily.
      //
      // We only look for one such sub; if there are N apparently-identical subs
      // being invalidated, we will require N matching subscribe calls to keep
      // them all active.
      var existing = Object.values(self._subscriptions).find(function (sub) {
        return sub.inactive && sub.name === name && EJSON.equals(sub.params, params);
      });
      var id;
      if (existing) {
        id = existing.id;
        existing.inactive = false; // reactivate

        if (callbacks.onReady) {
          // If the sub is not already ready, replace any ready callback with the
          // one provided now. (It's not really clear what users would expect for
          // an onReady callback inside an autorun; the semantics we provide is
          // that at the time the sub first becomes ready, we call the last
          // onReady callback provided, if any.)
          // If the sub is already ready, run the ready callback right away.
          // It seems that users would expect an onReady callback inside an
          // autorun to trigger once the sub first becomes ready and also
          // when re-subs happens.
          if (existing.ready) {
            callbacks.onReady();
          } else {
            existing.readyCallback = callbacks.onReady;
          }
        }

        // XXX COMPAT WITH 1.0.3.1 we used to have onError but now we call
        // onStop with an optional error argument
        if (callbacks.onError) {
          // Replace existing callback if any, so that errors aren't
          // double-reported.
          existing.errorCallback = callbacks.onError;
        }
        if (callbacks.onStop) {
          existing.stopCallback = callbacks.onStop;
        }
      } else {
        // New sub! Generate an id, save it locally, and send message.
        id = Random.id();
        self._subscriptions[id] = {
          id: id,
          name: name,
          params: EJSON.clone(params),
          inactive: false,
          ready: false,
          readyDeps: new Tracker.Dependency(),
          readyCallback: callbacks.onReady,
          // XXX COMPAT WITH 1.0.3.1 #errorCallback
          errorCallback: callbacks.onError,
          stopCallback: callbacks.onStop,
          connection: self,
          remove: function () {
            delete this.connection._subscriptions[this.id];
            this.ready && this.readyDeps.changed();
          },
          stop: function () {
            this.connection._sendQueued({
              msg: 'unsub',
              id: id
            });
            this.remove();
            if (callbacks.onStop) {
              callbacks.onStop();
            }
          }
        };
        self._send({
          msg: 'sub',
          id: id,
          name: name,
          params: params
        });
      }

      // return a handle to the application.
      var handle = {
        stop: function () {
          if (!hasOwn.call(self._subscriptions, id)) {
            return;
          }
          self._subscriptions[id].stop();
        },
        ready: function () {
          // return false if we've unsubscribed.
          if (!hasOwn.call(self._subscriptions, id)) {
            return false;
          }
          var record = self._subscriptions[id];
          record.readyDeps.depend();
          return record.ready;
        },
        subscriptionId: id
      };
      if (Tracker.active) {
        // We're in a reactive computation, so we'd like to unsubscribe when the
        // computation is invalidated... but not if the rerun just re-subscribes
        // to the same subscription!  When a rerun happens, we use onInvalidate
        // as a change to mark the subscription "inactive" so that it can
        // be reused from the rerun.  If it isn't reused, it's killed from
        // an afterFlush.
        Tracker.onInvalidate(function (c) {
          if (hasOwn.call(self._subscriptions, id)) {
            self._subscriptions[id].inactive = true;
          }
          Tracker.afterFlush(function () {
            if (hasOwn.call(self._subscriptions, id) && self._subscriptions[id].inactive) {
              handle.stop();
            }
          });
        });
      }
      return handle;
    }
    return subscribe;
  }()
  /**
   * @summary Tells if the method call came from a call or a callAsync.
   * @alias Meteor.isAsyncCall
   * @locus Anywhere
   * @memberOf Meteor
   * @importFromPackage meteor
   * @returns boolean
   */
  ;
  _proto.isAsyncCall = function () {
    function isAsyncCall() {
      return DDP._CurrentMethodInvocation._isCallAsyncMethodRunning();
    }
    return isAsyncCall;
  }();
  _proto.methods = function () {
    function methods(_methods) {
      var _this = this;
      Object.entries(_methods).forEach(function (_ref) {
        var _ref2 = _slicedToArray(_ref, 2),
          name = _ref2[0],
          func = _ref2[1];
        if (typeof func !== 'function') {
          throw new Error("Method '" + name + "' must be a function");
        }
        if (_this._methodHandlers[name]) {
          throw new Error("A method named '" + name + "' is already defined");
        }
        _this._methodHandlers[name] = func;
      });
    }
    return methods;
  }();
  _proto._getIsSimulation = function () {
    function _getIsSimulation(_ref3) {
      var isFromCallAsync = _ref3.isFromCallAsync,
        alreadyInSimulation = _ref3.alreadyInSimulation;
      if (!isFromCallAsync) {
        return alreadyInSimulation;
      }
      return alreadyInSimulation && DDP._CurrentMethodInvocation._isCallAsyncMethodRunning();
    }
    return _getIsSimulation;
  }()
  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.call
   * @summary Invokes a method with a sync stub, passing any number of arguments.
   * @locus Anywhere
   * @param {String} name Name of method to invoke
   * @param {EJSONable} [arg1,arg2...] Optional method arguments
   * @param {Function} [asyncCallback] Optional callback, which is called asynchronously with the error or result after the method is complete. If not provided, the method runs synchronously if possible (see below).
   */
  ;
  _proto.call = function () {
    function call(name /* .. [arguments] .. callback */) {
      // if it's a function, the last argument is the result callback,
      // not a parameter to the remote method.
      var args = slice.call(arguments, 1);
      var callback;
      if (args.length && typeof args[args.length - 1] === 'function') {
        callback = args.pop();
      }
      return this.apply(name, args, callback);
    }
    return call;
  }()
  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.callAsync
   * @summary Invokes a method with an async stub, passing any number of arguments.
   * @locus Anywhere
   * @param {String} name Name of method to invoke
   * @param {EJSONable} [arg1,arg2...] Optional method arguments
   * @returns {Promise}
   */
  ;
  _proto.callAsync = function () {
    function callAsync(name /* .. [arguments] .. */) {
      var args = slice.call(arguments, 1);
      if (args.length && typeof args[args.length - 1] === 'function') {
        throw new Error("Meteor.callAsync() does not accept a callback. You should 'await' the result, or use .then().");
      }
      return this.applyAsync(name, args, {
        returnServerResultPromise: true
      });
    }
    return callAsync;
  }()
  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.apply
   * @summary Invoke a method passing an array of arguments.
   * @locus Anywhere
   * @param {String} name Name of method to invoke
   * @param {EJSONable[]} args Method arguments
   * @param {Object} [options]
   * @param {Boolean} options.wait (Client only) If true, don't send this method until all previous method calls have completed, and don't send any subsequent method calls until this one is completed.
   * @param {Function} options.onResultReceived (Client only) This callback is invoked with the error or result of the method (just like `asyncCallback`) as soon as the error or result is available. The local cache may not yet reflect the writes performed by the method.
   * @param {Boolean} options.noRetry (Client only) if true, don't send this method again on reload, simply call the callback an error with the error code 'invocation-failed'.
   * @param {Boolean} options.throwStubExceptions (Client only) If true, exceptions thrown by method stubs will be thrown instead of logged, and the method will not be invoked on the server.
   * @param {Boolean} options.returnStubValue (Client only) If true then in cases where we would have otherwise discarded the stub's return value and returned undefined, instead we go ahead and return it. Specifically, this is any time other than when (a) we are already inside a stub or (b) we are in Node and no callback was provided. Currently we require this flag to be explicitly passed to reduce the likelihood that stub return values will be confused with server return values; we may improve this in future.
   * @param {Function} [asyncCallback] Optional callback; same semantics as in [`Meteor.call`](#meteor_call).
   */
  ;
  _proto.apply = function () {
    function apply(name, args, options, callback) {
      var _this$_stubCall = this._stubCall(name, EJSON.clone(args)),
        stubInvocation = _this$_stubCall.stubInvocation,
        invocation = _this$_stubCall.invocation,
        stubOptions = _objectWithoutProperties(_this$_stubCall, _excluded);
      if (stubOptions.hasStub) {
        if (!this._getIsSimulation({
          alreadyInSimulation: stubOptions.alreadyInSimulation,
          isFromCallAsync: stubOptions.isFromCallAsync
        })) {
          this._saveOriginals();
        }
        try {
          stubOptions.stubReturnValue = DDP._CurrentMethodInvocation.withValue(invocation, stubInvocation);
          if (Meteor._isPromise(stubOptions.stubReturnValue)) {
            Meteor._debug("Method " + name + ": Calling a method that has an async method stub with call/apply can lead to unexpected behaviors. Use callAsync/applyAsync instead.");
          }
        } catch (e) {
          stubOptions.exception = e;
        }
      }
      return this._apply(name, stubOptions, args, options, callback);
    }
    return apply;
  }()
  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.applyAsync
   * @summary Invoke a method passing an array of arguments.
   * @locus Anywhere
   * @param {String} name Name of method to invoke
   * @param {EJSONable[]} args Method arguments
   * @param {Object} [options]
   * @param {Boolean} options.wait (Client only) If true, don't send this method until all previous method calls have completed, and don't send any subsequent method calls until this one is completed.
   * @param {Function} options.onResultReceived (Client only) This callback is invoked with the error or result of the method (just like `asyncCallback`) as soon as the error or result is available. The local cache may not yet reflect the writes performed by the method.
   * @param {Boolean} options.noRetry (Client only) if true, don't send this method again on reload, simply call the callback an error with the error code 'invocation-failed'.
   * @param {Boolean} options.throwStubExceptions (Client only) If true, exceptions thrown by method stubs will be thrown instead of logged, and the method will not be invoked on the server.
   * @param {Boolean} options.returnStubValue (Client only) If true then in cases where we would have otherwise discarded the stub's return value and returned undefined, instead we go ahead and return it. Specifically, this is any time other than when (a) we are already inside a stub or (b) we are in Node and no callback was provided. Currently we require this flag to be explicitly passed to reduce the likelihood that stub return values will be confused with server return values; we may improve this in future.
   * @param {Boolean} options.returnServerResultPromise (Client only) If true, the promise returned by applyAsync will resolve to the server's return value, rather than the stub's return value. This is useful when you want to ensure that the server's return value is used, even if the stub returns a promise. The same behavior as `callAsync`.
   */
  ;
  _proto.applyAsync = function () {
    function applyAsync(name, args, options) {
      var callback = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
      var stubPromise = this._applyAsyncStubInvocation(name, args, options);
      var promise = this._applyAsync({
        name: name,
        args: args,
        options: options,
        callback: callback,
        stubPromise: stubPromise
      });
      if (Meteor.isClient) {
        // only return the stubReturnValue
        promise.stubPromise = stubPromise.then(function (o) {
          if (o.exception) {
            throw o.exception;
          }
          return o.stubReturnValue;
        });
        // this avoids attribute recursion
        promise.serverPromise = new Promise(function (resolve, reject) {
          return promise.then(resolve).catch(reject);
        });
      }
      return promise;
    }
    return applyAsync;
  }();
  _proto._applyAsyncStubInvocation = function () {
    function _applyAsyncStubInvocation(name, args, options) {
      var _this$_stubCall2, stubInvocation, invocation, stubOptions, currentContext;
      return _regeneratorRuntime.async(function () {
        function _applyAsyncStubInvocation$(_context2) {
          while (1) switch (_context2.prev = _context2.next) {
            case 0:
              _this$_stubCall2 = this._stubCall(name, EJSON.clone(args), options), stubInvocation = _this$_stubCall2.stubInvocation, invocation = _this$_stubCall2.invocation, stubOptions = _objectWithoutProperties(_this$_stubCall2, _excluded2);
              if (!stubOptions.hasStub) {
                _context2.next = 22;
                break;
              }
              if (!this._getIsSimulation({
                alreadyInSimulation: stubOptions.alreadyInSimulation,
                isFromCallAsync: stubOptions.isFromCallAsync
              })) {
                this._saveOriginals();
              }
              _context2.prev = 3;
              /*
               * The code below follows the same logic as the function withValues().
               *
               * But as the Meteor package is not compiled by ecmascript, it is unable to use newer syntax in the browser,
               * such as, the async/await.
               *
               * So, to keep supporting old browsers, like IE 11, we're creating the logic one level above.
               */
              currentContext = DDP._CurrentMethodInvocation._setNewContextAndGetCurrent(invocation);
              _context2.prev = 5;
              _context2.next = 8;
              return _regeneratorRuntime.awrap(stubInvocation());
            case 8:
              stubOptions.stubReturnValue = _context2.sent;
              _context2.next = 14;
              break;
            case 11:
              _context2.prev = 11;
              _context2.t0 = _context2["catch"](5);
              stubOptions.exception = _context2.t0;
            case 14:
              _context2.prev = 14;
              DDP._CurrentMethodInvocation._set(currentContext);
              return _context2.finish(14);
            case 17:
              _context2.next = 22;
              break;
            case 19:
              _context2.prev = 19;
              _context2.t1 = _context2["catch"](3);
              stubOptions.exception = _context2.t1;
            case 22:
              return _context2.abrupt("return", stubOptions);
            case 23:
            case "end":
              return _context2.stop();
          }
        }
        return _applyAsyncStubInvocation$;
      }(), null, this, [[3, 19], [5, 11, 14, 17]], Promise);
    }
    return _applyAsyncStubInvocation;
  }();
  _proto._applyAsync = function () {
    function _applyAsync(_ref4) {
      var name, args, options, callback, stubPromise, stubOptions;
      return _regeneratorRuntime.async(function () {
        function _applyAsync$(_context3) {
          while (1) switch (_context3.prev = _context3.next) {
            case 0:
              name = _ref4.name, args = _ref4.args, options = _ref4.options, callback = _ref4.callback, stubPromise = _ref4.stubPromise;
              _context3.next = 3;
              return _regeneratorRuntime.awrap(stubPromise);
            case 3:
              stubOptions = _context3.sent;
              return _context3.abrupt("return", this._apply(name, stubOptions, args, options, callback));
            case 5:
            case "end":
              return _context3.stop();
          }
        }
        return _applyAsync$;
      }(), null, this, null, Promise);
    }
    return _applyAsync;
  }();
  _proto._apply = function () {
    function _apply(name, stubCallValue, args, options, callback) {
      var self = this;

      // We were passed 3 arguments. They may be either (name, args, options)
      // or (name, args, callback)
      if (!callback && typeof options === 'function') {
        callback = options;
        options = Object.create(null);
      }
      options = options || Object.create(null);
      if (callback) {
        // XXX would it be better form to do the binding in stream.on,
        // or caller, instead of here?
        // XXX improve error message (and how we report it)
        callback = Meteor.bindEnvironment(callback, "delivering result of invoking '" + name + "'");
      }
      var hasStub = stubCallValue.hasStub,
        exception = stubCallValue.exception,
        stubReturnValue = stubCallValue.stubReturnValue,
        alreadyInSimulation = stubCallValue.alreadyInSimulation,
        randomSeed = stubCallValue.randomSeed;

      // Keep our args safe from mutation (eg if we don't send the message for a
      // while because of a wait method).
      args = EJSON.clone(args);
      // If we're in a simulation, stop and return the result we have,
      // rather than going on to do an RPC. If there was no stub,
      // we'll end up returning undefined.
      if (this._getIsSimulation({
        alreadyInSimulation: alreadyInSimulation,
        isFromCallAsync: stubCallValue.isFromCallAsync
      })) {
        var _result;
        if (callback) {
          callback(exception, stubReturnValue);
        } else {
          if (exception) throw exception;
          _result = stubReturnValue;
        }
        return options._returnMethodInvoker ? {
          result: _result
        } : _result;
      }

      // We only create the methodId here because we don't actually need one if
      // we're already in a simulation
      var methodId = '' + self._nextMethodId++;
      if (hasStub) {
        self._retrieveAndStoreOriginals(methodId);
      }

      // Generate the DDP message for the method call. Note that on the client,
      // it is important that the stub have finished before we send the RPC, so
      // that we know we have a complete list of which local documents the stub
      // wrote.
      var message = {
        msg: 'method',
        id: methodId,
        method: name,
        params: args
      };

      // If an exception occurred in a stub, and we're ignoring it
      // because we're doing an RPC and want to use what the server
      // returns instead, log it so the developer knows
      // (unless they explicitly ask to see the error).
      //
      // Tests can set the '_expectedByTest' flag on an exception so it won't
      // go to log.
      if (exception) {
        if (options.throwStubExceptions) {
          throw exception;
        } else if (!exception._expectedByTest) {
          Meteor._debug("Exception while simulating the effect of invoking '" + name + "'", exception);
        }
      }

      // At this point we're definitely doing an RPC, and we're going to
      // return the value of the RPC to the caller.

      // If the caller didn't give a callback, decide what to do.
      var promise;
      if (!callback) {
        if (Meteor.isClient && !options.returnServerResultPromise && (!options.isFromCallAsync || options.returnStubValue)) {
          callback = function (err) {
            err && Meteor._debug("Error invoking Method '" + name + "'", err);
          };
        } else {
          promise = new Promise(function (resolve, reject) {
            callback = function () {
              for (var _len = arguments.length, allArgs = new Array(_len), _key = 0; _key < _len; _key++) {
                allArgs[_key] = arguments[_key];
              }
              var args = Array.from(allArgs);
              var err = args.shift();
              if (err) {
                reject(err);
                return;
              }
              resolve.apply(void 0, args);
            };
          });
        }
      }

      // Send the randomSeed only if we used it
      if (randomSeed.value !== null) {
        message.randomSeed = randomSeed.value;
      }
      var methodInvoker = new MethodInvoker({
        methodId: methodId,
        callback: callback,
        connection: self,
        onResultReceived: options.onResultReceived,
        wait: !!options.wait,
        message: message,
        noRetry: !!options.noRetry
      });
      var result;
      if (promise) {
        result = options.returnStubValue ? promise.then(function () {
          return stubReturnValue;
        }) : promise;
      } else {
        result = options.returnStubValue ? stubReturnValue : undefined;
      }
      if (options._returnMethodInvoker) {
        return {
          methodInvoker: methodInvoker,
          result: result
        };
      }
      self._addOutstandingMethod(methodInvoker, options);
      return result;
    }
    return _apply;
  }();
  _proto._stubCall = function () {
    function _stubCall(name, args, options) {
      // Run the stub, if we have one. The stub is supposed to make some
      // temporary writes to the database to give the user a smooth experience
      // until the actual result of executing the method comes back from the
      // server (whereupon the temporary writes to the database will be reversed
      // during the beginUpdate/endUpdate process.)
      //
      // Normally, we ignore the return value of the stub (even if it is an
      // exception), in favor of the real return value from the server. The
      // exception is if the *caller* is a stub. In that case, we're not going
      // to do a RPC, so we use the return value of the stub as our return
      // value.
      var self = this;
      var enclosing = DDP._CurrentMethodInvocation.get();
      var stub = self._methodHandlers[name];
      var alreadyInSimulation = enclosing === null || enclosing === void 0 ? void 0 : enclosing.isSimulation;
      var isFromCallAsync = enclosing === null || enclosing === void 0 ? void 0 : enclosing._isFromCallAsync;
      var randomSeed = {
        value: null
      };
      var defaultReturn = {
        alreadyInSimulation: alreadyInSimulation,
        randomSeed: randomSeed,
        isFromCallAsync: isFromCallAsync
      };
      if (!stub) {
        return _objectSpread(_objectSpread({}, defaultReturn), {}, {
          hasStub: false
        });
      }

      // Lazily generate a randomSeed, only if it is requested by the stub.
      // The random streams only have utility if they're used on both the client
      // and the server; if the client doesn't generate any 'random' values
      // then we don't expect the server to generate any either.
      // Less commonly, the server may perform different actions from the client,
      // and may in fact generate values where the client did not, but we don't
      // have any client-side values to match, so even here we may as well just
      // use a random seed on the server.  In that case, we don't pass the
      // randomSeed to save bandwidth, and we don't even generate it to save a
      // bit of CPU and to avoid consuming entropy.

      var randomSeedGenerator = function () {
        if (randomSeed.value === null) {
          randomSeed.value = DDPCommon.makeRpcSeed(enclosing, name);
        }
        return randomSeed.value;
      };
      var setUserId = function (userId) {
        self.setUserId(userId);
      };
      var invocation = new DDPCommon.MethodInvocation({
        name: name,
        isSimulation: true,
        userId: self.userId(),
        isFromCallAsync: options === null || options === void 0 ? void 0 : options.isFromCallAsync,
        setUserId: setUserId,
        randomSeed: function () {
          return randomSeedGenerator();
        }
      });

      // Note that unlike in the corresponding server code, we never audit
      // that stubs check() their arguments.
      var stubInvocation = function () {
        if (Meteor.isServer) {
          // Because saveOriginals and retrieveOriginals aren't reentrant,
          // don't allow stubs to yield.
          return Meteor._noYieldsAllowed(function () {
            // re-clone, so that the stub can't affect our caller's values
            return stub.apply(invocation, EJSON.clone(args));
          });
        } else {
          return stub.apply(invocation, EJSON.clone(args));
        }
      };
      return _objectSpread(_objectSpread({}, defaultReturn), {}, {
        hasStub: true,
        stubInvocation: stubInvocation,
        invocation: invocation
      });
    }
    return _stubCall;
  }() // Before calling a method stub, prepare all stores to track changes and allow
  // _retrieveAndStoreOriginals to get the original versions of changed
  // documents.
  ;
  _proto._saveOriginals = function () {
    function _saveOriginals() {
      if (!this._waitingForQuiescence()) {
        this._flushBufferedWritesClient();
      }
      Object.values(this._stores).forEach(function (store) {
        store.saveOriginals();
      });
    }
    return _saveOriginals;
  }() // Retrieves the original versions of all documents modified by the stub for
  // method 'methodId' from all stores and saves them to _serverDocuments (keyed
  // by document) and _documentsWrittenByStub (keyed by method ID).
  ;
  _proto._retrieveAndStoreOriginals = function () {
    function _retrieveAndStoreOriginals(methodId) {
      var self = this;
      if (self._documentsWrittenByStub[methodId]) throw new Error('Duplicate methodId in _retrieveAndStoreOriginals');
      var docsWritten = [];
      Object.entries(self._stores).forEach(function (_ref5) {
        var _ref6 = _slicedToArray(_ref5, 2),
          collection = _ref6[0],
          store = _ref6[1];
        var originals = store.retrieveOriginals();
        // not all stores define retrieveOriginals
        if (!originals) return;
        originals.forEach(function (doc, id) {
          docsWritten.push({
            collection: collection,
            id: id
          });
          if (!hasOwn.call(self._serverDocuments, collection)) {
            self._serverDocuments[collection] = new MongoIDMap();
          }
          var serverDoc = self._serverDocuments[collection].setDefault(id, Object.create(null));
          if (serverDoc.writtenByStubs) {
            // We're not the first stub to write this doc. Just add our method ID
            // to the record.
            serverDoc.writtenByStubs[methodId] = true;
          } else {
            // First stub! Save the original value and our method ID.
            serverDoc.document = doc;
            serverDoc.flushCallbacks = [];
            serverDoc.writtenByStubs = Object.create(null);
            serverDoc.writtenByStubs[methodId] = true;
          }
        });
      });
      if (!isEmpty(docsWritten)) {
        self._documentsWrittenByStub[methodId] = docsWritten;
      }
    }
    return _retrieveAndStoreOriginals;
  }() // This is very much a private function we use to make the tests
  // take up fewer server resources after they complete.
  ;
  _proto._unsubscribeAll = function () {
    function _unsubscribeAll() {
      Object.values(this._subscriptions).forEach(function (sub) {
        // Avoid killing the autoupdate subscription so that developers
        // still get hot code pushes when writing tests.
        //
        // XXX it's a hack to encode knowledge about autoupdate here,
        // but it doesn't seem worth it yet to have a special API for
        // subscriptions to preserve after unit tests.
        if (sub.name !== 'meteor_autoupdate_clientVersions') {
          sub.stop();
        }
      });
    }
    return _unsubscribeAll;
  }() // Sends the DDP stringification of the given message object
  ;
  _proto._send = function () {
    function _send(obj) {
      this._stream.send(DDPCommon.stringifyDDP(obj));
    }
    return _send;
  }() // Always queues the call before sending the message
  // Used, for example, on subscription.[id].stop() to make sure a "sub" message is always called before an "unsub" message
  // https://github.com/meteor/meteor/issues/13212
  //
  // This is part of the actual fix for the rest check:
  // https://github.com/meteor/meteor/pull/13236
  ;
  _proto._sendQueued = function () {
    function _sendQueued(obj) {
      this._send(obj, true);
    }
    return _sendQueued;
  }() // We detected via DDP-level heartbeats that we've lost the
  // connection.  Unlike `disconnect` or `close`, a lost connection
  // will be automatically retried.
  ;
  _proto._lostConnection = function () {
    function _lostConnection(error) {
      this._stream._lostConnection(error);
    }
    return _lostConnection;
  }()
  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.status
   * @summary Get the current connection status. A reactive data source.
   * @locus Client
   */
  ;
  _proto.status = function () {
    function status() {
      var _this$_stream;
      return (_this$_stream = this._stream).status.apply(_this$_stream, arguments);
    }
    return status;
  }()
  /**
   * @summary Force an immediate reconnection attempt if the client is not connected to the server.
   This method does nothing if the client is already connected.
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.reconnect
   * @locus Client
   */
  ;
  _proto.reconnect = function () {
    function reconnect() {
      var _this$_stream2;
      return (_this$_stream2 = this._stream).reconnect.apply(_this$_stream2, arguments);
    }
    return reconnect;
  }()
  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.disconnect
   * @summary Disconnect the client from the server.
   * @locus Client
   */
  ;
  _proto.disconnect = function () {
    function disconnect() {
      var _this$_stream3;
      return (_this$_stream3 = this._stream).disconnect.apply(_this$_stream3, arguments);
    }
    return disconnect;
  }();
  _proto.close = function () {
    function close() {
      return this._stream.disconnect({
        _permanent: true
      });
    }
    return close;
  }() ///
  /// Reactive user system
  ///
  ;
  _proto.userId = function () {
    function userId() {
      if (this._userIdDeps) this._userIdDeps.depend();
      return this._userId;
    }
    return userId;
  }();
  _proto.setUserId = function () {
    function setUserId(userId) {
      // Avoid invalidating dependents if setUserId is called with current value.
      if (this._userId === userId) return;
      this._userId = userId;
      if (this._userIdDeps) this._userIdDeps.changed();
    }
    return setUserId;
  }() // Returns true if we are in a state after reconnect of waiting for subs to be
  // revived or early methods to finish their data, or we are waiting for a
  // "wait" method to finish.
  ;
  _proto._waitingForQuiescence = function () {
    function _waitingForQuiescence() {
      return !isEmpty(this._subsBeingRevived) || !isEmpty(this._methodsBlockingQuiescence);
    }
    return _waitingForQuiescence;
  }() // Returns true if any method whose message has been sent to the server has
  // not yet invoked its user callback.
  ;
  _proto._anyMethodsAreOutstanding = function () {
    function _anyMethodsAreOutstanding() {
      var invokers = this._methodInvokers;
      return Object.values(invokers).some(function (invoker) {
        return !!invoker.sentMessage;
      });
    }
    return _anyMethodsAreOutstanding;
  }();
  _proto._livedata_connected = function () {
    function _livedata_connected(msg) {
      var self, reconnectedToPreviousSession, invokers, _i, _Object$values, store;
      return _regeneratorRuntime.async(function () {
        function _livedata_connected$(_context4) {
          while (1) switch (_context4.prev = _context4.next) {
            case 0:
              self = this;
              if (self._version !== 'pre1' && self._heartbeatInterval !== 0) {
                self._heartbeat = new DDPCommon.Heartbeat({
                  heartbeatInterval: self._heartbeatInterval,
                  heartbeatTimeout: self._heartbeatTimeout,
                  onTimeout: function () {
                    self._lostConnection(new DDP.ConnectionError('DDP heartbeat timed out'));
                  },
                  sendPing: function () {
                    self._send({
                      msg: 'ping'
                    });
                  }
                });
                self._heartbeat.start();
              }

              // If this is a reconnect, we'll have to reset all stores.
              if (self._lastSessionId) self._resetStores = true;
              if (typeof msg.session === 'string') {
                reconnectedToPreviousSession = self._lastSessionId === msg.session;
                self._lastSessionId = msg.session;
              }
              if (!reconnectedToPreviousSession) {
                _context4.next = 6;
                break;
              }
              return _context4.abrupt("return");
            case 6:
              // Server doesn't have our data any more. Re-sync a new session.

              // Forget about messages we were buffering for unknown collections. They'll
              // be resent if still relevant.
              self._updatesForUnknownStores = Object.create(null);
              if (self._resetStores) {
                // Forget about the effects of stubs. We'll be resetting all collections
                // anyway.
                self._documentsWrittenByStub = Object.create(null);
                self._serverDocuments = Object.create(null);
              }

              // Clear _afterUpdateCallbacks.
              self._afterUpdateCallbacks = [];

              // Mark all named subscriptions which are ready (ie, we already called the
              // ready callback) as needing to be revived.
              // XXX We should also block reconnect quiescence until unnamed subscriptions
              //     (eg, autopublish) are done re-publishing to avoid flicker!
              self._subsBeingRevived = Object.create(null);
              Object.entries(self._subscriptions).forEach(function (_ref7) {
                var _ref8 = _slicedToArray(_ref7, 2),
                  id = _ref8[0],
                  sub = _ref8[1];
                if (sub.ready) {
                  self._subsBeingRevived[id] = true;
                }
              });

              // Arrange for "half-finished" methods to have their callbacks run, and
              // track methods that were sent on this connection so that we don't
              // quiesce until they are all done.
              //
              // Start by clearing _methodsBlockingQuiescence: methods sent before
              // reconnect don't matter, and any "wait" methods sent on the new connection
              // that we drop here will be restored by the loop below.
              self._methodsBlockingQuiescence = Object.create(null);
              if (self._resetStores) {
                invokers = self._methodInvokers;
                keys(invokers).forEach(function (id) {
                  var invoker = invokers[id];
                  if (invoker.gotResult()) {
                    // This method already got its result, but it didn't call its callback
                    // because its data didn't become visible. We did not resend the
                    // method RPC. We'll call its callback when we get a full quiesce,
                    // since that's as close as we'll get to "data must be visible".
                    self._afterUpdateCallbacks.push(function () {
                      return invoker.dataVisible.apply(invoker, arguments);
                    });
                  } else if (invoker.sentMessage) {
                    // This method has been sent on this connection (maybe as a resend
                    // from the last connection, maybe from onReconnect, maybe just very
                    // quickly before processing the connected message).
                    //
                    // We don't need to do anything special to ensure its callbacks get
                    // called, but we'll count it as a method which is preventing
                    // reconnect quiescence. (eg, it might be a login method that was run
                    // from onReconnect, and we don't want to see flicker by seeing a
                    // logged-out state.)
                    self._methodsBlockingQuiescence[invoker.methodId] = true;
                  }
                });
              }
              self._messagesBufferedUntilQuiescence = [];

              // If we're not waiting on any methods or subs, we can reset the stores and
              // call the callbacks immediately.
              if (self._waitingForQuiescence()) {
                _context4.next = 28;
                break;
              }
              if (!self._resetStores) {
                _context4.next = 27;
                break;
              }
              _i = 0, _Object$values = Object.values(self._stores);
            case 17:
              if (!(_i < _Object$values.length)) {
                _context4.next = 26;
                break;
              }
              store = _Object$values[_i];
              _context4.next = 21;
              return _regeneratorRuntime.awrap(store.beginUpdate(0, true));
            case 21:
              _context4.next = 23;
              return _regeneratorRuntime.awrap(store.endUpdate());
            case 23:
              _i++;
              _context4.next = 17;
              break;
            case 26:
              self._resetStores = false;
            case 27:
              self._runAfterUpdateCallbacks();
            case 28:
            case "end":
              return _context4.stop();
          }
        }
        return _livedata_connected$;
      }(), null, this, null, Promise);
    }
    return _livedata_connected;
  }();
  _proto._processOneDataMessage = function () {
    function _processOneDataMessage(msg, updates) {
      var messageType;
      return _regeneratorRuntime.async(function () {
        function _processOneDataMessage$(_context5) {
          while (1) switch (_context5.prev = _context5.next) {
            case 0:
              messageType = msg.msg; // msg is one of ['added', 'changed', 'removed', 'ready', 'updated']
              if (!(messageType === 'added')) {
                _context5.next = 6;
                break;
              }
              _context5.next = 4;
              return _regeneratorRuntime.awrap(this._process_added(msg, updates));
            case 4:
              _context5.next = 7;
              break;
            case 6:
              if (messageType === 'changed') {
                this._process_changed(msg, updates);
              } else if (messageType === 'removed') {
                this._process_removed(msg, updates);
              } else if (messageType === 'ready') {
                this._process_ready(msg, updates);
              } else if (messageType === 'updated') {
                this._process_updated(msg, updates);
              } else if (messageType === 'nosub') {
                // ignore this
              } else {
                Meteor._debug('discarding unknown livedata data message type', msg);
              }
            case 7:
            case "end":
              return _context5.stop();
          }
        }
        return _processOneDataMessage$;
      }(), null, this, null, Promise);
    }
    return _processOneDataMessage;
  }();
  _proto._livedata_data = function () {
    function _livedata_data(msg) {
      var self, bufferedMessages, _i2, _Object$values2, bufferedMessage, standardWrite;
      return _regeneratorRuntime.async(function () {
        function _livedata_data$(_context6) {
          while (1) switch (_context6.prev = _context6.next) {
            case 0:
              self = this;
              if (!self._waitingForQuiescence()) {
                _context6.next = 20;
                break;
              }
              self._messagesBufferedUntilQuiescence.push(msg);
              if (msg.msg === 'nosub') {
                delete self._subsBeingRevived[msg.id];
              }
              if (msg.subs) {
                msg.subs.forEach(function (subId) {
                  delete self._subsBeingRevived[subId];
                });
              }
              if (msg.methods) {
                msg.methods.forEach(function (methodId) {
                  delete self._methodsBlockingQuiescence[methodId];
                });
              }
              if (!self._waitingForQuiescence()) {
                _context6.next = 8;
                break;
              }
              return _context6.abrupt("return");
            case 8:
              // No methods or subs are blocking quiescence!
              // We'll now process and all of our buffered messages, reset all stores,
              // and apply them all at once.
              bufferedMessages = self._messagesBufferedUntilQuiescence;
              _i2 = 0, _Object$values2 = Object.values(bufferedMessages);
            case 10:
              if (!(_i2 < _Object$values2.length)) {
                _context6.next = 17;
                break;
              }
              bufferedMessage = _Object$values2[_i2];
              _context6.next = 14;
              return _regeneratorRuntime.awrap(self._processOneDataMessage(bufferedMessage, self._bufferedWrites));
            case 14:
              _i2++;
              _context6.next = 10;
              break;
            case 17:
              self._messagesBufferedUntilQuiescence = [];
              _context6.next = 22;
              break;
            case 20:
              _context6.next = 22;
              return _regeneratorRuntime.awrap(self._processOneDataMessage(msg, self._bufferedWrites));
            case 22:
              // Immediately flush writes when:
              //  1. Buffering is disabled. Or;
              //  2. any non-(added/changed/removed) message arrives.
              standardWrite = msg.msg === "added" || msg.msg === "changed" || msg.msg === "removed";
              if (!(self._bufferedWritesInterval === 0 || !standardWrite)) {
                _context6.next = 27;
                break;
              }
              _context6.next = 26;
              return _regeneratorRuntime.awrap(self._flushBufferedWrites());
            case 26:
              return _context6.abrupt("return");
            case 27:
              if (!(self._bufferedWritesFlushAt === null)) {
                _context6.next = 31;
                break;
              }
              self._bufferedWritesFlushAt = new Date().valueOf() + self._bufferedWritesMaxAge;
              _context6.next = 35;
              break;
            case 31:
              if (!(self._bufferedWritesFlushAt < new Date().valueOf())) {
                _context6.next = 35;
                break;
              }
              _context6.next = 34;
              return _regeneratorRuntime.awrap(self._flushBufferedWrites());
            case 34:
              return _context6.abrupt("return");
            case 35:
              if (self._bufferedWritesFlushHandle) {
                clearTimeout(self._bufferedWritesFlushHandle);
              }
              self._bufferedWritesFlushHandle = setTimeout(function () {
                // __flushBufferedWrites is a promise, so with this we can wait the promise to finish
                // before doing something
                self._liveDataWritesPromise = self.__flushBufferedWrites();
                if (Meteor._isPromise(self._liveDataWritesPromise)) {
                  self._liveDataWritesPromise.finally(function () {
                    return self._liveDataWritesPromise = undefined;
                  });
                }
              }, self._bufferedWritesInterval);
            case 37:
            case "end":
              return _context6.stop();
          }
        }
        return _livedata_data$;
      }(), null, this, null, Promise);
    }
    return _livedata_data;
  }();
  _proto._prepareBuffersToFlush = function () {
    function _prepareBuffersToFlush() {
      var self = this;
      if (self._bufferedWritesFlushHandle) {
        clearTimeout(self._bufferedWritesFlushHandle);
        self._bufferedWritesFlushHandle = null;
      }
      self._bufferedWritesFlushAt = null;
      // We need to clear the buffer before passing it to
      //  performWrites. As there's no guarantee that it
      //  will exit cleanly.
      var writes = self._bufferedWrites;
      self._bufferedWrites = Object.create(null);
      return writes;
    }
    return _prepareBuffersToFlush;
  }();
  _proto._flushBufferedWritesServer = function () {
    function _flushBufferedWritesServer() {
      var self, writes;
      return _regeneratorRuntime.async(function () {
        function _flushBufferedWritesServer$(_context7) {
          while (1) switch (_context7.prev = _context7.next) {
            case 0:
              self = this;
              writes = self._prepareBuffersToFlush();
              _context7.next = 4;
              return _regeneratorRuntime.awrap(self._performWritesServer(writes));
            case 4:
            case "end":
              return _context7.stop();
          }
        }
        return _flushBufferedWritesServer$;
      }(), null, this, null, Promise);
    }
    return _flushBufferedWritesServer;
  }();
  _proto._flushBufferedWritesClient = function () {
    function _flushBufferedWritesClient() {
      var self = this;
      var writes = self._prepareBuffersToFlush();
      self._performWritesClient(writes);
    }
    return _flushBufferedWritesClient;
  }();
  _proto._flushBufferedWrites = function () {
    function _flushBufferedWrites() {
      var self = this;
      return Meteor.isClient ? self._flushBufferedWritesClient() : self._flushBufferedWritesServer();
    }
    return _flushBufferedWrites;
  }();
  _proto._performWritesServer = function () {
    function _performWritesServer(updates) {
      var self, _i3, _Object$entries, _ref9, _ref10, storeName, store, _i4, _Object$entries2, _ref11, _ref12, _storeName, updateMessages, _store, _iterator2, _step2, updateMessage, _updates$_storeName, _updates, _i5, _Object$values3, _store2;
      return _regeneratorRuntime.async(function () {
        function _performWritesServer$(_context8) {
          while (1) switch (_context8.prev = _context8.next) {
            case 0:
              self = this;
              if (!(self._resetStores || !isEmpty(updates))) {
                _context8.next = 45;
                break;
              }
              _i3 = 0, _Object$entries = Object.entries(self._stores);
            case 3:
              if (!(_i3 < _Object$entries.length)) {
                _context8.next = 13;
                break;
              }
              _ref9 = _Object$entries[_i3];
              _ref10 = _slicedToArray(_ref9, 2);
              storeName = _ref10[0];
              store = _ref10[1];
              _context8.next = 10;
              return _regeneratorRuntime.awrap(store.beginUpdate(hasOwn.call(updates, storeName) ? updates[storeName].length : 0, self._resetStores));
            case 10:
              _i3++;
              _context8.next = 3;
              break;
            case 13:
              self._resetStores = false;
              _i4 = 0, _Object$entries2 = Object.entries(updates);
            case 15:
              if (!(_i4 < _Object$entries2.length)) {
                _context8.next = 37;
                break;
              }
              _ref11 = _Object$entries2[_i4];
              _ref12 = _slicedToArray(_ref11, 2);
              _storeName = _ref12[0];
              updateMessages = _ref12[1];
              _store = self._stores[_storeName];
              if (!_store) {
                _context8.next = 31;
                break;
              }
              _iterator2 = _createForOfIteratorHelperLoose(updateMessages);
            case 23:
              if ((_step2 = _iterator2()).done) {
                _context8.next = 29;
                break;
              }
              updateMessage = _step2.value;
              _context8.next = 27;
              return _regeneratorRuntime.awrap(_store.update(updateMessage));
            case 27:
              _context8.next = 23;
              break;
            case 29:
              _context8.next = 34;
              break;
            case 31:
              // Nobody's listening for this data. Queue it up until
              // someone wants it.
              // XXX memory use will grow without bound if you forget to
              // create a collection or just don't care about it... going
              // to have to do something about that.
              _updates = self._updatesForUnknownStores;
              if (!hasOwn.call(_updates, _storeName)) {
                _updates[_storeName] = [];
              }
              (_updates$_storeName = _updates[_storeName]).push.apply(_updates$_storeName, _toConsumableArray(updateMessages));
            case 34:
              _i4++;
              _context8.next = 15;
              break;
            case 37:
              _i5 = 0, _Object$values3 = Object.values(self._stores);
            case 38:
              if (!(_i5 < _Object$values3.length)) {
                _context8.next = 45;
                break;
              }
              _store2 = _Object$values3[_i5];
              _context8.next = 42;
              return _regeneratorRuntime.awrap(_store2.endUpdate());
            case 42:
              _i5++;
              _context8.next = 38;
              break;
            case 45:
              self._runAfterUpdateCallbacks();
            case 46:
            case "end":
              return _context8.stop();
          }
        }
        return _performWritesServer$;
      }(), null, this, null, Promise);
    }
    return _performWritesServer;
  }();
  _proto._performWritesClient = function () {
    function _performWritesClient(updates) {
      var self = this;
      if (self._resetStores || !isEmpty(updates)) {
        // Begin a transactional update of each store.

        for (var _i6 = 0, _Object$entries3 = Object.entries(self._stores); _i6 < _Object$entries3.length; _i6++) {
          var _ref13 = _Object$entries3[_i6];
          var _ref14 = _slicedToArray(_ref13, 2);
          var storeName = _ref14[0];
          var store = _ref14[1];
          store.beginUpdate(hasOwn.call(updates, storeName) ? updates[storeName].length : 0, self._resetStores);
        }
        self._resetStores = false;
        for (var _i7 = 0, _Object$entries4 = Object.entries(updates); _i7 < _Object$entries4.length; _i7++) {
          var _ref15 = _Object$entries4[_i7];
          var _ref16 = _slicedToArray(_ref15, 2);
          var _storeName2 = _ref16[0];
          var updateMessages = _ref16[1];
          {
            var _store3 = self._stores[_storeName2];
            if (_store3) {
              for (var _iterator3 = _createForOfIteratorHelperLoose(updateMessages), _step3; !(_step3 = _iterator3()).done;) {
                var updateMessage = _step3.value;
                _store3.update(updateMessage);
              }
            } else {
              var _updates2$_storeName;
              // Nobody's listening for this data. Queue it up until
              // someone wants it.
              // XXX memory use will grow without bound if you forget to
              // create a collection or just don't care about it... going
              // to have to do something about that.
              var _updates2 = self._updatesForUnknownStores;
              if (!hasOwn.call(_updates2, _storeName2)) {
                _updates2[_storeName2] = [];
              }
              (_updates2$_storeName = _updates2[_storeName2]).push.apply(_updates2$_storeName, _toConsumableArray(updateMessages));
            }
          }
        }
        // End update transaction.
        for (var _i8 = 0, _Object$values4 = Object.values(self._stores); _i8 < _Object$values4.length; _i8++) {
          var _store4 = _Object$values4[_i8];
          _store4.endUpdate();
        }
      }
      self._runAfterUpdateCallbacks();
    }
    return _performWritesClient;
  }() // Call any callbacks deferred with _runWhenAllServerDocsAreFlushed whose
  // relevant docs have been flushed, as well as dataVisible callbacks at
  // reconnect-quiescence time.
  ;
  _proto._runAfterUpdateCallbacks = function () {
    function _runAfterUpdateCallbacks() {
      var self = this;
      var callbacks = self._afterUpdateCallbacks;
      self._afterUpdateCallbacks = [];
      callbacks.forEach(function (c) {
        c();
      });
    }
    return _runAfterUpdateCallbacks;
  }();
  _proto._pushUpdate = function () {
    function _pushUpdate(updates, collection, msg) {
      if (!hasOwn.call(updates, collection)) {
        updates[collection] = [];
      }
      updates[collection].push(msg);
    }
    return _pushUpdate;
  }();
  _proto._getServerDoc = function () {
    function _getServerDoc(collection, id) {
      var self = this;
      if (!hasOwn.call(self._serverDocuments, collection)) {
        return null;
      }
      var serverDocsForCollection = self._serverDocuments[collection];
      return serverDocsForCollection.get(id) || null;
    }
    return _getServerDoc;
  }();
  _proto._process_added = function () {
    function _process_added(msg, updates) {
      var self, id, serverDoc, isExisting, currentDoc;
      return _regeneratorRuntime.async(function () {
        function _process_added$(_context9) {
          while (1) switch (_context9.prev = _context9.next) {
            case 0:
              self = this;
              id = MongoID.idParse(msg.id);
              serverDoc = self._getServerDoc(msg.collection, id);
              if (!serverDoc) {
                _context9.next = 19;
                break;
              }
              // Some outstanding stub wrote here.
              isExisting = serverDoc.document !== undefined;
              serverDoc.document = msg.fields || Object.create(null);
              serverDoc.document._id = id;
              if (!self._resetStores) {
                _context9.next = 15;
                break;
              }
              _context9.next = 10;
              return _regeneratorRuntime.awrap(self._stores[msg.collection].getDoc(msg.id));
            case 10:
              currentDoc = _context9.sent;
              if (currentDoc !== undefined) msg.fields = currentDoc;
              self._pushUpdate(updates, msg.collection, msg);
              _context9.next = 17;
              break;
            case 15:
              if (!isExisting) {
                _context9.next = 17;
                break;
              }
              throw new Error('Server sent add for existing id: ' + msg.id);
            case 17:
              _context9.next = 20;
              break;
            case 19:
              self._pushUpdate(updates, msg.collection, msg);
            case 20:
            case "end":
              return _context9.stop();
          }
        }
        return _process_added$;
      }(), null, this, null, Promise);
    }
    return _process_added;
  }();
  _proto._process_changed = function () {
    function _process_changed(msg, updates) {
      var self = this;
      var serverDoc = self._getServerDoc(msg.collection, MongoID.idParse(msg.id));
      if (serverDoc) {
        if (serverDoc.document === undefined) throw new Error('Server sent changed for nonexisting id: ' + msg.id);
        DiffSequence.applyChanges(serverDoc.document, msg.fields);
      } else {
        self._pushUpdate(updates, msg.collection, msg);
      }
    }
    return _process_changed;
  }();
  _proto._process_removed = function () {
    function _process_removed(msg, updates) {
      var self = this;
      var serverDoc = self._getServerDoc(msg.collection, MongoID.idParse(msg.id));
      if (serverDoc) {
        // Some outstanding stub wrote here.
        if (serverDoc.document === undefined) throw new Error('Server sent removed for nonexisting id:' + msg.id);
        serverDoc.document = undefined;
      } else {
        self._pushUpdate(updates, msg.collection, {
          msg: 'removed',
          collection: msg.collection,
          id: msg.id
        });
      }
    }
    return _process_removed;
  }();
  _proto._process_updated = function () {
    function _process_updated(msg, updates) {
      var self = this;
      // Process "method done" messages.

      msg.methods.forEach(function (methodId) {
        var docs = self._documentsWrittenByStub[methodId] || {};
        Object.values(docs).forEach(function (written) {
          var serverDoc = self._getServerDoc(written.collection, written.id);
          if (!serverDoc) {
            throw new Error('Lost serverDoc for ' + JSON.stringify(written));
          }
          if (!serverDoc.writtenByStubs[methodId]) {
            throw new Error('Doc ' + JSON.stringify(written) + ' not written by  method ' + methodId);
          }
          delete serverDoc.writtenByStubs[methodId];
          if (isEmpty(serverDoc.writtenByStubs)) {
            // All methods whose stubs wrote this method have completed! We can
            // now copy the saved document to the database (reverting the stub's
            // change if the server did not write to this object, or applying the
            // server's writes if it did).

            // This is a fake ddp 'replace' message.  It's just for talking
            // between livedata connections and minimongo.  (We have to stringify
            // the ID because it's supposed to look like a wire message.)
            self._pushUpdate(updates, written.collection, {
              msg: 'replace',
              id: MongoID.idStringify(written.id),
              replace: serverDoc.document
            });
            // Call all flush callbacks.

            serverDoc.flushCallbacks.forEach(function (c) {
              c();
            });

            // Delete this completed serverDocument. Don't bother to GC empty
            // IdMaps inside self._serverDocuments, since there probably aren't
            // many collections and they'll be written repeatedly.
            self._serverDocuments[written.collection].remove(written.id);
          }
        });
        delete self._documentsWrittenByStub[methodId];

        // We want to call the data-written callback, but we can't do so until all
        // currently buffered messages are flushed.
        var callbackInvoker = self._methodInvokers[methodId];
        if (!callbackInvoker) {
          throw new Error('No callback invoker for method ' + methodId);
        }
        self._runWhenAllServerDocsAreFlushed(function () {
          return callbackInvoker.dataVisible.apply(callbackInvoker, arguments);
        });
      });
    }
    return _process_updated;
  }();
  _proto._process_ready = function () {
    function _process_ready(msg, updates) {
      var self = this;
      // Process "sub ready" messages. "sub ready" messages don't take effect
      // until all current server documents have been flushed to the local
      // database. We can use a write fence to implement this.

      msg.subs.forEach(function (subId) {
        self._runWhenAllServerDocsAreFlushed(function () {
          var subRecord = self._subscriptions[subId];
          // Did we already unsubscribe?
          if (!subRecord) return;
          // Did we already receive a ready message? (Oops!)
          if (subRecord.ready) return;
          subRecord.ready = true;
          subRecord.readyCallback && subRecord.readyCallback();
          subRecord.readyDeps.changed();
        });
      });
    }
    return _process_ready;
  }() // Ensures that "f" will be called after all documents currently in
  // _serverDocuments have been written to the local cache. f will not be called
  // if the connection is lost before then!
  ;
  _proto._runWhenAllServerDocsAreFlushed = function () {
    function _runWhenAllServerDocsAreFlushed(f) {
      var self = this;
      var runFAfterUpdates = function () {
        self._afterUpdateCallbacks.push(f);
      };
      var unflushedServerDocCount = 0;
      var onServerDocFlush = function () {
        --unflushedServerDocCount;
        if (unflushedServerDocCount === 0) {
          // This was the last doc to flush! Arrange to run f after the updates
          // have been applied.
          runFAfterUpdates();
        }
      };
      Object.values(self._serverDocuments).forEach(function (serverDocuments) {
        serverDocuments.forEach(function (serverDoc) {
          var writtenByStubForAMethodWithSentMessage = keys(serverDoc.writtenByStubs).some(function (methodId) {
            var invoker = self._methodInvokers[methodId];
            return invoker && invoker.sentMessage;
          });
          if (writtenByStubForAMethodWithSentMessage) {
            ++unflushedServerDocCount;
            serverDoc.flushCallbacks.push(onServerDocFlush);
          }
        });
      });
      if (unflushedServerDocCount === 0) {
        // There aren't any buffered docs --- we can call f as soon as the current
        // round of updates is applied!
        runFAfterUpdates();
      }
    }
    return _runWhenAllServerDocsAreFlushed;
  }();
  _proto._livedata_nosub = function () {
    function _livedata_nosub(msg) {
      var self, errorCallback, stopCallback, meteorErrorFromMsg;
      return _regeneratorRuntime.async(function () {
        function _livedata_nosub$(_context10) {
          while (1) switch (_context10.prev = _context10.next) {
            case 0:
              self = this; // First pass it through _livedata_data, which only uses it to help get
              // towards quiescence.
              _context10.next = 3;
              return _regeneratorRuntime.awrap(self._livedata_data(msg));
            case 3:
              if (hasOwn.call(self._subscriptions, msg.id)) {
                _context10.next = 5;
                break;
              }
              return _context10.abrupt("return");
            case 5:
              // XXX COMPAT WITH 1.0.3.1 #errorCallback
              errorCallback = self._subscriptions[msg.id].errorCallback;
              stopCallback = self._subscriptions[msg.id].stopCallback;
              self._subscriptions[msg.id].remove();
              meteorErrorFromMsg = function (msgArg) {
                return msgArg && msgArg.error && new Meteor.Error(msgArg.error.error, msgArg.error.reason, msgArg.error.details);
              }; // XXX COMPAT WITH 1.0.3.1 #errorCallback
              if (errorCallback && msg.error) {
                errorCallback(meteorErrorFromMsg(msg));
              }
              if (stopCallback) {
                stopCallback(meteorErrorFromMsg(msg));
              }
            case 11:
            case "end":
              return _context10.stop();
          }
        }
        return _livedata_nosub$;
      }(), null, this, null, Promise);
    }
    return _livedata_nosub;
  }();
  _proto._livedata_result = function () {
    function _livedata_result(msg) {
      var self, currentMethodBlock, i, m;
      return _regeneratorRuntime.async(function () {
        function _livedata_result$(_context11) {
          while (1) switch (_context11.prev = _context11.next) {
            case 0:
              // id, result or error. error has error (code), reason, details
              self = this; // Lets make sure there are no buffered writes before returning result.
              if (isEmpty(self._bufferedWrites)) {
                _context11.next = 4;
                break;
              }
              _context11.next = 4;
              return _regeneratorRuntime.awrap(self._flushBufferedWrites());
            case 4:
              if (!isEmpty(self._outstandingMethodBlocks)) {
                _context11.next = 7;
                break;
              }
              Meteor._debug('Received method result but no methods outstanding');
              return _context11.abrupt("return");
            case 7:
              currentMethodBlock = self._outstandingMethodBlocks[0].methods;
              m = currentMethodBlock.find(function (method, idx) {
                var found = method.methodId === msg.id;
                if (found) i = idx;
                return found;
              });
              if (m) {
                _context11.next = 12;
                break;
              }
              Meteor._debug("Can't match method response to original method call", msg);
              return _context11.abrupt("return");
            case 12:
              // Remove from current method block. This may leave the block empty, but we
              // don't move on to the next block until the callback has been delivered, in
              // _outstandingMethodFinished.
              currentMethodBlock.splice(i, 1);
              if (hasOwn.call(msg, 'error')) {
                m.receiveResult(new Meteor.Error(msg.error.error, msg.error.reason, msg.error.details));
              } else {
                // msg.result may be undefined if the method didn't return a
                // value
                m.receiveResult(undefined, msg.result);
              }
            case 14:
            case "end":
              return _context11.stop();
          }
        }
        return _livedata_result$;
      }(), null, this, null, Promise);
    }
    return _livedata_result;
  }();
  _proto._addOutstandingMethod = function () {
    function _addOutstandingMethod(methodInvoker, options) {
      if (options !== null && options !== void 0 && options.wait) {
        // It's a wait method! Wait methods go in their own block.
        this._outstandingMethodBlocks.push({
          wait: true,
          methods: [methodInvoker]
        });
      } else {
        // Not a wait method. Start a new block if the previous block was a wait
        // block, and add it to the last block of methods.
        if (isEmpty(this._outstandingMethodBlocks) || last(this._outstandingMethodBlocks).wait) {
          this._outstandingMethodBlocks.push({
            wait: false,
            methods: []
          });
        }
        last(this._outstandingMethodBlocks).methods.push(methodInvoker);
      }

      // If we added it to the first block, send it out now.
      if (this._outstandingMethodBlocks.length === 1) {
        methodInvoker.sendMessage();
      }
    }
    return _addOutstandingMethod;
  }() // Called by MethodInvoker after a method's callback is invoked.  If this was
  // the last outstanding method in the current block, runs the next block. If
  // there are no more methods, consider accepting a hot code push.
  ;
  _proto._outstandingMethodFinished = function () {
    function _outstandingMethodFinished() {
      var self = this;
      if (self._anyMethodsAreOutstanding()) return;

      // No methods are outstanding. This should mean that the first block of
      // methods is empty. (Or it might not exist, if this was a method that
      // half-finished before disconnect/reconnect.)
      if (!isEmpty(self._outstandingMethodBlocks)) {
        var firstBlock = self._outstandingMethodBlocks.shift();
        if (!isEmpty(firstBlock.methods)) throw new Error('No methods outstanding but nonempty block: ' + JSON.stringify(firstBlock));

        // Send the outstanding methods now in the first block.
        if (!isEmpty(self._outstandingMethodBlocks)) self._sendOutstandingMethods();
      }

      // Maybe accept a hot code push.
      self._maybeMigrate();
    }
    return _outstandingMethodFinished;
  }() // Sends messages for all the methods in the first block in
  // _outstandingMethodBlocks.
  ;
  _proto._sendOutstandingMethods = function () {
    function _sendOutstandingMethods() {
      var self = this;
      if (isEmpty(self._outstandingMethodBlocks)) {
        return;
      }
      self._outstandingMethodBlocks[0].methods.forEach(function (m) {
        m.sendMessage();
      });
    }
    return _sendOutstandingMethods;
  }();
  _proto._livedata_error = function () {
    function _livedata_error(msg) {
      Meteor._debug('Received error from server: ', msg.reason);
      if (msg.offendingMessage) Meteor._debug('For: ', msg.offendingMessage);
    }
    return _livedata_error;
  }();
  _proto._sendOutstandingMethodBlocksMessages = function () {
    function _sendOutstandingMethodBlocksMessages(oldOutstandingMethodBlocks) {
      var _self$_outstandingMet;
      var self = this;
      if (isEmpty(oldOutstandingMethodBlocks)) return;

      // We have at least one block worth of old outstanding methods to try
      // again. First: did onReconnect actually send anything? If not, we just
      // restore all outstanding methods and run the first block.
      if (isEmpty(self._outstandingMethodBlocks)) {
        self._outstandingMethodBlocks = oldOutstandingMethodBlocks;
        self._sendOutstandingMethods();
        return;
      }

      // OK, there are blocks on both sides. Special case: merge the last block of
      // the reconnect methods with the first block of the original methods, if
      // neither of them are "wait" blocks.
      if (!last(self._outstandingMethodBlocks).wait && !oldOutstandingMethodBlocks[0].wait) {
        oldOutstandingMethodBlocks[0].methods.forEach(function (m) {
          last(self._outstandingMethodBlocks).methods.push(m);

          // If this "last block" is also the first block, send the message.
          if (self._outstandingMethodBlocks.length === 1) {
            m.sendMessage();
          }
        });
        oldOutstandingMethodBlocks.shift();
      }

      // Now add the rest of the original blocks on.
      (_self$_outstandingMet = self._outstandingMethodBlocks).push.apply(_self$_outstandingMet, _toConsumableArray(oldOutstandingMethodBlocks));
    }
    return _sendOutstandingMethodBlocksMessages;
  }();
  _proto._callOnReconnectAndSendAppropriateOutstandingMethods = function () {
    function _callOnReconnectAndSendAppropriateOutstandingMethods() {
      var self = this;
      var oldOutstandingMethodBlocks = self._outstandingMethodBlocks;
      self._outstandingMethodBlocks = [];
      self.onReconnect && self.onReconnect();
      DDP._reconnectHook.each(function (callback) {
        callback(self);
        return true;
      });
      self._sendOutstandingMethodBlocksMessages(oldOutstandingMethodBlocks);
    }
    return _callOnReconnectAndSendAppropriateOutstandingMethods;
  }() // We can accept a hot code push if there are no methods in flight.
  ;
  _proto._readyToMigrate = function () {
    function _readyToMigrate() {
      return isEmpty(this._methodInvokers);
    }
    return _readyToMigrate;
  }() // If we were blocking a migration, see if it's now possible to continue.
  // Call whenever the set of outstanding/blocked methods shrinks.
  ;
  _proto._maybeMigrate = function () {
    function _maybeMigrate() {
      var self = this;
      if (self._retryMigrate && self._readyToMigrate()) {
        self._retryMigrate();
        self._retryMigrate = null;
      }
    }
    return _maybeMigrate;
  }();
  _proto.onMessage = function () {
    function onMessage(raw_msg) {
      var msg, description;
      return _regeneratorRuntime.async(function () {
        function onMessage$(_context12) {
          while (1) switch (_context12.prev = _context12.next) {
            case 0:
              _context12.prev = 0;
              msg = DDPCommon.parseDDP(raw_msg);
              _context12.next = 8;
              break;
            case 4:
              _context12.prev = 4;
              _context12.t0 = _context12["catch"](0);
              Meteor._debug('Exception while parsing DDP', _context12.t0);
              return _context12.abrupt("return");
            case 8:
              // Any message counts as receiving a pong, as it demonstrates that
              // the server is still alive.
              if (this._heartbeat) {
                this._heartbeat.messageReceived();
              }
              if (!(msg === null || !msg.msg)) {
                _context12.next = 15;
                break;
              }
              if (!(!msg || !msg.testMessageOnConnect)) {
                _context12.next = 14;
                break;
              }
              if (!(Object.keys(msg).length === 1 && msg.server_id)) {
                _context12.next = 13;
                break;
              }
              return _context12.abrupt("return");
            case 13:
              Meteor._debug('discarding invalid livedata message', msg);
            case 14:
              return _context12.abrupt("return");
            case 15:
              if (!(msg.msg === 'connected')) {
                _context12.next = 22;
                break;
              }
              this._version = this._versionSuggestion;
              _context12.next = 19;
              return _regeneratorRuntime.awrap(this._livedata_connected(msg));
            case 19:
              this.options.onConnected();
              _context12.next = 49;
              break;
            case 22:
              if (!(msg.msg === 'failed')) {
                _context12.next = 26;
                break;
              }
              if (this._supportedDDPVersions.indexOf(msg.version) >= 0) {
                this._versionSuggestion = msg.version;
                this._stream.reconnect({
                  _force: true
                });
              } else {
                description = 'DDP version negotiation failed; server requested version ' + msg.version;
                this._stream.disconnect({
                  _permanent: true,
                  _error: description
                });
                this.options.onDDPVersionNegotiationFailure(description);
              }
              _context12.next = 49;
              break;
            case 26:
              if (!(msg.msg === 'ping' && this.options.respondToPings)) {
                _context12.next = 30;
                break;
              }
              this._send({
                msg: 'pong',
                id: msg.id
              });
              _context12.next = 49;
              break;
            case 30:
              if (!(msg.msg === 'pong')) {
                _context12.next = 33;
                break;
              }
              _context12.next = 49;
              break;
            case 33:
              if (!['added', 'changed', 'removed', 'ready', 'updated'].includes(msg.msg)) {
                _context12.next = 38;
                break;
              }
              _context12.next = 36;
              return _regeneratorRuntime.awrap(this._livedata_data(msg));
            case 36:
              _context12.next = 49;
              break;
            case 38:
              if (!(msg.msg === 'nosub')) {
                _context12.next = 43;
                break;
              }
              _context12.next = 41;
              return _regeneratorRuntime.awrap(this._livedata_nosub(msg));
            case 41:
              _context12.next = 49;
              break;
            case 43:
              if (!(msg.msg === 'result')) {
                _context12.next = 48;
                break;
              }
              _context12.next = 46;
              return _regeneratorRuntime.awrap(this._livedata_result(msg));
            case 46:
              _context12.next = 49;
              break;
            case 48:
              if (msg.msg === 'error') {
                this._livedata_error(msg);
              } else {
                Meteor._debug('discarding unknown livedata message type', msg);
              }
            case 49:
            case "end":
              return _context12.stop();
          }
        }
        return onMessage$;
      }(), null, this, [[0, 4]], Promise);
    }
    return onMessage;
  }();
  _proto.onReset = function () {
    function onReset() {
      var _this2 = this;
      // Send a connect message at the beginning of the stream.
      // NOTE: reset is called even on the first connection, so this is
      // the only place we send this message.
      var msg = {
        msg: 'connect'
      };
      if (this._lastSessionId) msg.session = this._lastSessionId;
      msg.version = this._versionSuggestion || this._supportedDDPVersions[0];
      this._versionSuggestion = msg.version;
      msg.support = this._supportedDDPVersions;
      this._send(msg);

      // Mark non-retry calls as failed. This has to be done early as getting these methods out of the
      // current block is pretty important to making sure that quiescence is properly calculated, as
      // well as possibly moving on to another useful block.

      // Only bother testing if there is an outstandingMethodBlock (there might not be, especially if
      // we are connecting for the first time.
      if (this._outstandingMethodBlocks.length > 0) {
        // If there is an outstanding method block, we only care about the first one as that is the
        // one that could have already sent messages with no response, that are not allowed to retry.
        var currentMethodBlock = this._outstandingMethodBlocks[0].methods;
        this._outstandingMethodBlocks[0].methods = currentMethodBlock.filter(function (methodInvoker) {
          // Methods with 'noRetry' option set are not allowed to re-send after
          // recovering dropped connection.
          if (methodInvoker.sentMessage && methodInvoker.noRetry) {
            // Make sure that the method is told that it failed.
            methodInvoker.receiveResult(new Meteor.Error('invocation-failed', 'Method invocation might have failed due to dropped connection. ' + 'Failing because `noRetry` option was passed to Meteor.apply.'));
          }

          // Only keep a method if it wasn't sent or it's allowed to retry.
          // This may leave the block empty, but we don't move on to the next
          // block until the callback has been delivered, in _outstandingMethodFinished.
          return !(methodInvoker.sentMessage && methodInvoker.noRetry);
        });
      }

      // Now, to minimize setup latency, go ahead and blast out all of
      // our pending methods ands subscriptions before we've even taken
      // the necessary RTT to know if we successfully reconnected. (1)
      // They're supposed to be idempotent, and where they are not,
      // they can block retry in apply; (2) even if we did reconnect,
      // we're not sure what messages might have gotten lost
      // (in either direction) since we were disconnected (TCP being
      // sloppy about that.)

      // If the current block of methods all got their results (but didn't all get
      // their data visible), discard the empty block now.
      if (this._outstandingMethodBlocks.length > 0 && this._outstandingMethodBlocks[0].methods.length === 0) {
        this._outstandingMethodBlocks.shift();
      }

      // Mark all messages as unsent, they have not yet been sent on this
      // connection.
      keys(this._methodInvokers).forEach(function (id) {
        _this2._methodInvokers[id].sentMessage = false;
      });

      // If an `onReconnect` handler is set, call it first. Go through
      // some hoops to ensure that methods that are called from within
      // `onReconnect` get executed _before_ ones that were originally
      // outstanding (since `onReconnect` is used to re-establish auth
      // certificates)
      this._callOnReconnectAndSendAppropriateOutstandingMethods();

      // add new subscriptions at the end. this way they take effect after
      // the handlers and we don't see flicker.
      Object.entries(this._subscriptions).forEach(function (_ref17) {
        var _ref18 = _slicedToArray(_ref17, 2),
          id = _ref18[0],
          sub = _ref18[1];
        _this2._sendQueued({
          msg: 'sub',
          id: id,
          name: sub.name,
          params: sub.params
        });
      });
    }
    return onReset;
  }();
  return Connection;
}();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"namespace.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-client/common/namespace.js                                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  DDP: function () {
    return DDP;
  }
});
var DDPCommon;
module.link("meteor/ddp-common", {
  DDPCommon: function (v) {
    DDPCommon = v;
  }
}, 0);
var Meteor;
module.link("meteor/meteor", {
  Meteor: function (v) {
    Meteor = v;
  }
}, 1);
var Connection;
module.link("./livedata_connection.js", {
  Connection: function (v) {
    Connection = v;
  }
}, 2);
// This array allows the `_allSubscriptionsReady` method below, which
// is used by the `spiderable` package, to keep track of whether all
// data is ready.
var allConnections = [];

/**
 * @namespace DDP
 * @summary Namespace for DDP-related methods/classes.
 */
var DDP = {};
// This is private but it's used in a few places. accounts-base uses
// it to get the current user. Meteor.setTimeout and friends clear
// it. We can probably find a better way to factor this.
DDP._CurrentMethodInvocation = new Meteor.EnvironmentVariable();
DDP._CurrentPublicationInvocation = new Meteor.EnvironmentVariable();

// XXX: Keep DDP._CurrentInvocation for backwards-compatibility.
DDP._CurrentInvocation = DDP._CurrentMethodInvocation;
DDP._CurrentCallAsyncInvocation = new Meteor.EnvironmentVariable();

// This is passed into a weird `makeErrorType` function that expects its thing
// to be a constructor
function connectionErrorConstructor(message) {
  this.message = message;
}
DDP.ConnectionError = Meteor.makeErrorType('DDP.ConnectionError', connectionErrorConstructor);
DDP.ForcedReconnectError = Meteor.makeErrorType('DDP.ForcedReconnectError', function () {});

// Returns the named sequence of pseudo-random values.
// The scope will be DDP._CurrentMethodInvocation.get(), so the stream will produce
// consistent values for method calls on the client and server.
DDP.randomStream = function (name) {
  var scope = DDP._CurrentMethodInvocation.get();
  return DDPCommon.RandomStream.get(scope, name);
};

// @param url {String} URL to Meteor app,
//     e.g.:
//     "subdomain.meteor.com",
//     "http://subdomain.meteor.com",
//     "/",
//     "ddp+sockjs://ddp--****-foo.meteor.com/sockjs"

/**
 * @summary Connect to the server of a different Meteor application to subscribe to its document sets and invoke its remote methods.
 * @locus Anywhere
 * @param {String} url The URL of another Meteor application.
 * @param {Object} [options]
 * @param {Boolean} options.reloadWithOutstanding is it OK to reload if there are outstanding methods?
 * @param {Object} options.headers extra headers to send on the websockets connection, for server-to-server DDP only
 * @param {Object} options._sockjsOptions Specifies options to pass through to the sockjs client
 * @param {Function} options.onDDPNegotiationVersionFailure callback when version negotiation fails.
 */
DDP.connect = function (url, options) {
  var ret = new Connection(url, options);
  allConnections.push(ret); // hack. see below.
  return ret;
};
DDP._reconnectHook = new Hook({
  bindEnvironment: false
});

/**
 * @summary Register a function to call as the first step of
 * reconnecting. This function can call methods which will be executed before
 * any other outstanding methods. For example, this can be used to re-establish
 * the appropriate authentication context on the connection.
 * @locus Anywhere
 * @param {Function} callback The function to call. It will be called with a
 * single argument, the [connection object](#ddp_connect) that is reconnecting.
 */
DDP.onReconnect = function (callback) {
  return DDP._reconnectHook.register(callback);
};

// Hack for `spiderable` package: a way to see if the page is done
// loading all the data it needs.
//
DDP._allSubscriptionsReady = function () {
  return allConnections.every(function (conn) {
    return Object.values(conn._subscriptions).every(function (sub) {
      return sub.ready;
    });
  });
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      DDP: DDP
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/ddp-client/client/client.js"
  ],
  mainModulePath: "/node_modules/meteor/ddp-client/client/client.js"
}});
