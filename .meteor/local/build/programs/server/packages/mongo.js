Package["core-runtime"].queue("mongo",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var NpmModuleMongodb = Package['npm-mongo'].NpmModuleMongodb;
var NpmModuleMongodbVersion = Package['npm-mongo'].NpmModuleMongodbVersion;
var AllowDeny = Package['allow-deny'].AllowDeny;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var LocalCollection = Package.minimongo.LocalCollection;
var Minimongo = Package.minimongo.Minimongo;
var DDP = Package['ddp-client'].DDP;
var DDPServer = Package['ddp-server'].DDPServer;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var MongoID = Package['mongo-id'].MongoID;
var check = Package.check.check;
var Match = Package.check.Match;
var ECMAScript = Package.ecmascript.ECMAScript;
var Log = Package.logging.Log;
var Decimal = Package['mongo-decimal'].Decimal;
var _ = Package.underscore._;
var MaxHeap = Package['binary-heap'].MaxHeap;
var MinHeap = Package['binary-heap'].MinHeap;
var MinMaxHeap = Package['binary-heap'].MinMaxHeap;
var Hook = Package['callback-hook'].Hook;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var MongoInternals, MongoConnection, callback, CursorDescription, Cursor, listenAll, forEachTrigger, OPLOG_COLLECTION, idForOp, OplogHandle, ObserveMultiplexer, options, ObserveHandle, PollingObserveDriver, OplogObserveDriver, Mongo, selector;

var require = meteorInstall({"node_modules":{"meteor":{"mongo":{"mongo_driver.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/mongo_driver.js                                                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module1, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectSpread;
    module1.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 0);
    let has;
    module1.link("lodash.has", {
      default(v) {
        has = v;
      }
    }, 0);
    let identity;
    module1.link("lodash.identity", {
      default(v) {
        identity = v;
      }
    }, 1);
    let clone;
    module1.link("lodash.clone", {
      default(v) {
        clone = v;
      }
    }, 2);
    let DocFetcher;
    module1.link("./doc_fetcher.js", {
      DocFetcher(v) {
        DocFetcher = v;
      }
    }, 3);
    let ASYNC_CURSOR_METHODS, CLIENT_ONLY_METHODS, getAsyncMethodName;
    module1.link("meteor/minimongo/constants", {
      ASYNC_CURSOR_METHODS(v) {
        ASYNC_CURSOR_METHODS = v;
      },
      CLIENT_ONLY_METHODS(v) {
        CLIENT_ONLY_METHODS = v;
      },
      getAsyncMethodName(v) {
        getAsyncMethodName = v;
      }
    }, 4);
    let Meteor;
    module1.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 5);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    /**
     * Provide a synchronous Collection API using fibers, backed by
     * MongoDB.  This is only for use on the server, and mostly identical
     * to the client API.
     *
     * NOTE: the public API methods must be run within a fiber. If you call
     * these outside of a fiber they will explode!
     */

    const path = require("path");
    const util = require("util");

    /** @type {import('mongodb')} */
    var MongoDB = NpmModuleMongodb;
    MongoInternals = {};
    MongoInternals.__packageName = 'mongo';
    MongoInternals.NpmModules = {
      mongodb: {
        version: NpmModuleMongodbVersion,
        module: MongoDB
      }
    };

    // Older version of what is now available via
    // MongoInternals.NpmModules.mongodb.module.  It was never documented, but
    // people do use it.
    // XXX COMPAT WITH 1.0.3.2
    MongoInternals.NpmModule = MongoDB;
    const FILE_ASSET_SUFFIX = 'Asset';
    const ASSETS_FOLDER = 'assets';
    const APP_FOLDER = 'app';

    // This is used to add or remove EJSON from the beginning of everything nested
    // inside an EJSON custom type. It should only be called on pure JSON!
    var replaceNames = function (filter, thing) {
      if (typeof thing === "object" && thing !== null) {
        if (Array.isArray(thing)) {
          return thing.map(replaceNames.bind(null, filter));
        }
        var ret = {};
        Object.entries(thing).forEach(function (_ref) {
          let [key, value] = _ref;
          ret[filter(key)] = replaceNames(filter, value);
        });
        return ret;
      }
      return thing;
    };

    // Ensure that EJSON.clone keeps a Timestamp as a Timestamp (instead of just
    // doing a structural clone).
    // XXX how ok is this? what if there are multiple copies of MongoDB loaded?
    MongoDB.Timestamp.prototype.clone = function () {
      // Timestamps should be immutable.
      return this;
    };
    var makeMongoLegal = function (name) {
      return "EJSON" + name;
    };
    var unmakeMongoLegal = function (name) {
      return name.substr(5);
    };
    var replaceMongoAtomWithMeteor = function (document) {
      if (document instanceof MongoDB.Binary) {
        // for backwards compatibility
        if (document.sub_type !== 0) {
          return document;
        }
        var buffer = document.value(true);
        return new Uint8Array(buffer);
      }
      if (document instanceof MongoDB.ObjectID) {
        return new Mongo.ObjectID(document.toHexString());
      }
      if (document instanceof MongoDB.Decimal128) {
        return Decimal(document.toString());
      }
      if (document["EJSON$type"] && document["EJSON$value"] && Object.keys(document).length === 2) {
        return EJSON.fromJSONValue(replaceNames(unmakeMongoLegal, document));
      }
      if (document instanceof MongoDB.Timestamp) {
        // For now, the Meteor representation of a Mongo timestamp type (not a date!
        // this is a weird internal thing used in the oplog!) is the same as the
        // Mongo representation. We need to do this explicitly or else we would do a
        // structural clone and lose the prototype.
        return document;
      }
      return undefined;
    };
    var replaceMeteorAtomWithMongo = function (document) {
      if (EJSON.isBinary(document)) {
        // This does more copies than we'd like, but is necessary because
        // MongoDB.BSON only looks like it takes a Uint8Array (and doesn't actually
        // serialize it correctly).
        return new MongoDB.Binary(Buffer.from(document));
      }
      if (document instanceof MongoDB.Binary) {
        return document;
      }
      if (document instanceof Mongo.ObjectID) {
        return new MongoDB.ObjectID(document.toHexString());
      }
      if (document instanceof MongoDB.Timestamp) {
        // For now, the Meteor representation of a Mongo timestamp type (not a date!
        // this is a weird internal thing used in the oplog!) is the same as the
        // Mongo representation. We need to do this explicitly or else we would do a
        // structural clone and lose the prototype.
        return document;
      }
      if (document instanceof Decimal) {
        return MongoDB.Decimal128.fromString(document.toString());
      }
      if (EJSON._isCustomType(document)) {
        return replaceNames(makeMongoLegal, EJSON.toJSONValue(document));
      }
      // It is not ordinarily possible to stick dollar-sign keys into mongo
      // so we don't bother checking for things that need escaping at this time.
      return undefined;
    };
    var replaceTypes = function (document, atomTransformer) {
      if (typeof document !== 'object' || document === null) return document;
      var replacedTopLevelAtom = atomTransformer(document);
      if (replacedTopLevelAtom !== undefined) return replacedTopLevelAtom;
      var ret = document;
      Object.entries(document).forEach(function (_ref2) {
        let [key, val] = _ref2;
        var valReplaced = replaceTypes(val, atomTransformer);
        if (val !== valReplaced) {
          // Lazy clone. Shallow copy.
          if (ret === document) ret = clone(document);
          ret[key] = valReplaced;
        }
      });
      return ret;
    };
    MongoConnection = function (url, options) {
      var _Meteor$settings, _Meteor$settings$pack, _Meteor$settings$pack2;
      var self = this;
      options = options || {};
      self._observeMultiplexers = {};
      self._onFailoverHook = new Hook();
      const userOptions = _objectSpread(_objectSpread({}, Mongo._connectionOptions || {}), ((_Meteor$settings = Meteor.settings) === null || _Meteor$settings === void 0 ? void 0 : (_Meteor$settings$pack = _Meteor$settings.packages) === null || _Meteor$settings$pack === void 0 ? void 0 : (_Meteor$settings$pack2 = _Meteor$settings$pack.mongo) === null || _Meteor$settings$pack2 === void 0 ? void 0 : _Meteor$settings$pack2.options) || {});
      var mongoOptions = Object.assign({
        ignoreUndefined: true
      }, userOptions);

      // Internally the oplog connections specify their own maxPoolSize
      // which we don't want to overwrite with any user defined value
      if (has(options, 'maxPoolSize')) {
        // If we just set this for "server", replSet will override it. If we just
        // set it for replSet, it will be ignored if we're not using a replSet.
        mongoOptions.maxPoolSize = options.maxPoolSize;
      }
      if (has(options, 'minPoolSize')) {
        mongoOptions.minPoolSize = options.minPoolSize;
      }

      // Transform options like "tlsCAFileAsset": "filename.pem" into
      // "tlsCAFile": "/<fullpath>/filename.pem"
      Object.entries(mongoOptions || {}).filter(_ref3 => {
        let [key] = _ref3;
        return key && key.endsWith(FILE_ASSET_SUFFIX);
      }).forEach(_ref4 => {
        let [key, value] = _ref4;
        const optionName = key.replace(FILE_ASSET_SUFFIX, '');
        mongoOptions[optionName] = path.join(Assets.getServerDir(), ASSETS_FOLDER, APP_FOLDER, value);
        delete mongoOptions[key];
      });
      self.db = null;
      self._oplogHandle = null;
      self._docFetcher = null;
      mongoOptions.driverInfo = {
        name: 'Meteor',
        version: Meteor.release
      };
      self.client = new MongoDB.MongoClient(url, mongoOptions);
      self.db = self.client.db();
      self.client.on('serverDescriptionChanged', Meteor.bindEnvironment(event => {
        // When the connection is no longer against the primary node, execute all
        // failover hooks. This is important for the driver as it has to re-pool the
        // query when it happens.
        if (event.previousDescription.type !== 'RSPrimary' && event.newDescription.type === 'RSPrimary') {
          self._onFailoverHook.each(callback => {
            callback();
            return true;
          });
        }
      }));
      if (options.oplogUrl && !Package['disable-oplog']) {
        self._oplogHandle = new OplogHandle(options.oplogUrl, self.db.databaseName);
        self._docFetcher = new DocFetcher(self);
      }
    };
    MongoConnection.prototype._close = async function () {
      var self = this;
      if (!self.db) throw Error("close called before Connection created?");

      // XXX probably untested
      var oplogHandle = self._oplogHandle;
      self._oplogHandle = null;
      if (oplogHandle) await oplogHandle.stop();

      // Use Future.wrap so that errors get thrown. This happens to
      // work even outside a fiber since the 'close' method is not
      // actually asynchronous.
      await self.client.close();
    };
    MongoConnection.prototype.close = function () {
      return this._close();
    };
    MongoConnection.prototype._setOplogHandle = function (oplogHandle) {
      this._oplogHandle = oplogHandle;
      return this;
    };

    // Returns the Mongo Collection object; may yield.
    MongoConnection.prototype.rawCollection = function (collectionName) {
      var self = this;
      if (!self.db) throw Error("rawCollection called before Connection created?");
      return self.db.collection(collectionName);
    };
    MongoConnection.prototype.createCappedCollectionAsync = async function (collectionName, byteSize, maxDocuments) {
      var self = this;
      if (!self.db) throw Error("createCappedCollectionAsync called before Connection created?");
      await self.db.createCollection(collectionName, {
        capped: true,
        size: byteSize,
        max: maxDocuments
      });
    };

    // This should be called synchronously with a write, to create a
    // transaction on the current write fence, if any. After we can read
    // the write, and after observers have been notified (or at least,
    // after the observer notifiers have added themselves to the write
    // fence), you should call 'committed()' on the object returned.
    MongoConnection.prototype._maybeBeginWrite = function () {
      const fence = DDPServer._getCurrentFence();
      if (fence) {
        return fence.beginWrite();
      } else {
        return {
          committed: function () {}
        };
      }
    };

    // Internal interface: adds a callback which is called when the Mongo primary
    // changes. Returns a stop handle.
    MongoConnection.prototype._onFailover = function (callback) {
      return this._onFailoverHook.register(callback);
    };

    //////////// Public API //////////

    // The write methods block until the database has confirmed the write (it may
    // not be replicated or stable on disk, but one server has confirmed it) if no
    // callback is provided. If a callback is provided, then they call the callback
    // when the write is confirmed. They return nothing on success, and raise an
    // exception on failure.
    //
    // After making a write (with insert, update, remove), observers are
    // notified asynchronously. If you want to receive a callback once all
    // of the observer notifications have landed for your write, do the
    // writes inside a write fence (set DDPServer._CurrentWriteFence to a new
    // _WriteFence, and then set a callback on the write fence.)
    //
    // Since our execution environment is single-threaded, this is
    // well-defined -- a write "has been made" if it's returned, and an
    // observer "has been notified" if its callback has returned.

    var writeCallback = function (write, refresh, callback) {
      return function (err, result) {
        if (!err) {
          // XXX We don't have to run this on error, right?
          try {
            refresh();
          } catch (refreshErr) {
            if (callback) {
              callback(refreshErr);
              return;
            } else {
              throw refreshErr;
            }
          }
        }
        write.committed();
        if (callback) {
          callback(err, result);
        } else if (err) {
          throw err;
        }
      };
    };
    var bindEnvironmentForWrite = function (callback) {
      return Meteor.bindEnvironment(callback, "Mongo write");
    };
    MongoConnection.prototype.insertAsync = async function (collection_name, document) {
      const self = this;
      if (collection_name === "___meteor_failure_test_collection") {
        const e = new Error("Failure test");
        e._expectedByTest = true;
        throw e;
      }
      if (!(LocalCollection._isPlainObject(document) && !EJSON._isCustomType(document))) {
        throw new Error("Only plain objects may be inserted into MongoDB");
      }
      var write = self._maybeBeginWrite();
      var refresh = async function () {
        await Meteor.refresh({
          collection: collection_name,
          id: document._id
        });
      };
      return self.rawCollection(collection_name).insertOne(replaceTypes(document, replaceMeteorAtomWithMongo), {
        safe: true
      }).then(async _ref5 => {
        let {
          insertedId
        } = _ref5;
        await refresh();
        await write.committed();
        return insertedId;
      }).catch(async e => {
        await write.committed();
        throw e;
      });
    };

    // Cause queries that may be affected by the selector to poll in this write
    // fence.
    MongoConnection.prototype._refresh = async function (collectionName, selector) {
      var refreshKey = {
        collection: collectionName
      };
      // If we know which documents we're removing, don't poll queries that are
      // specific to other documents. (Note that multiple notifications here should
      // not cause multiple polls, since all our listener is doing is enqueueing a
      // poll.)
      var specificIds = LocalCollection._idsMatchedBySelector(selector);
      if (specificIds) {
        for (const id of specificIds) {
          await Meteor.refresh(Object.assign({
            id: id
          }, refreshKey));
        }
        ;
      } else {
        await Meteor.refresh(refreshKey);
      }
    };
    MongoConnection.prototype.removeAsync = async function (collection_name, selector) {
      var self = this;
      if (collection_name === "___meteor_failure_test_collection") {
        var e = new Error("Failure test");
        e._expectedByTest = true;
        throw e;
      }
      var write = self._maybeBeginWrite();
      var refresh = async function () {
        await self._refresh(collection_name, selector);
      };
      return self.rawCollection(collection_name).deleteMany(replaceTypes(selector, replaceMeteorAtomWithMongo), {
        safe: true
      }).then(async _ref6 => {
        let {
          deletedCount
        } = _ref6;
        await refresh();
        await write.committed();
        return transformResult({
          result: {
            modifiedCount: deletedCount
          }
        }).numberAffected;
      }).catch(async err => {
        await write.committed();
        throw err;
      });
    };
    MongoConnection.prototype.dropCollectionAsync = async function (collectionName) {
      var self = this;
      var write = self._maybeBeginWrite();
      var refresh = function () {
        return Meteor.refresh({
          collection: collectionName,
          id: null,
          dropCollection: true
        });
      };
      return self.rawCollection(collectionName).drop().then(async result => {
        await refresh();
        await write.committed();
        return result;
      }).catch(async e => {
        await write.committed();
        throw e;
      });
    };

    // For testing only.  Slightly better than `c.rawDatabase().dropDatabase()`
    // because it lets the test's fence wait for it to be complete.
    MongoConnection.prototype.dropDatabaseAsync = async function () {
      var self = this;
      var write = self._maybeBeginWrite();
      var refresh = async function () {
        await Meteor.refresh({
          dropDatabase: true
        });
      };
      try {
        await self.db._dropDatabase();
        await refresh();
        await write.committed();
      } catch (e) {
        await write.committed();
        throw e;
      }
    };
    MongoConnection.prototype.updateAsync = async function (collection_name, selector, mod, options) {
      var self = this;
      if (collection_name === "___meteor_failure_test_collection") {
        var e = new Error("Failure test");
        e._expectedByTest = true;
        throw e;
      }

      // explicit safety check. null and undefined can crash the mongo
      // driver. Although the node driver and minimongo do 'support'
      // non-object modifier in that they don't crash, they are not
      // meaningful operations and do not do anything. Defensively throw an
      // error here.
      if (!mod || typeof mod !== 'object') {
        const error = new Error("Invalid modifier. Modifier must be an object.");
        throw error;
      }
      if (!(LocalCollection._isPlainObject(mod) && !EJSON._isCustomType(mod))) {
        const error = new Error("Only plain objects may be used as replacement" + " documents in MongoDB");
        throw error;
      }
      if (!options) options = {};
      var write = self._maybeBeginWrite();
      var refresh = async function () {
        await self._refresh(collection_name, selector);
      };
      var collection = self.rawCollection(collection_name);
      var mongoOpts = {
        safe: true
      };
      // Add support for filtered positional operator
      if (options.arrayFilters !== undefined) mongoOpts.arrayFilters = options.arrayFilters;
      // explictly enumerate options that minimongo supports
      if (options.upsert) mongoOpts.upsert = true;
      if (options.multi) mongoOpts.multi = true;
      // Lets you get a more more full result from MongoDB. Use with caution:
      // might not work with C.upsert (as opposed to C.update({upsert:true}) or
      // with simulated upsert.
      if (options.fullResult) mongoOpts.fullResult = true;
      var mongoSelector = replaceTypes(selector, replaceMeteorAtomWithMongo);
      var mongoMod = replaceTypes(mod, replaceMeteorAtomWithMongo);
      var isModify = LocalCollection._isModificationMod(mongoMod);
      if (options._forbidReplace && !isModify) {
        var err = new Error("Invalid modifier. Replacements are forbidden.");
        throw err;
      }

      // We've already run replaceTypes/replaceMeteorAtomWithMongo on
      // selector and mod.  We assume it doesn't matter, as far as
      // the behavior of modifiers is concerned, whether `_modify`
      // is run on EJSON or on mongo-converted EJSON.

      // Run this code up front so that it fails fast if someone uses
      // a Mongo update operator we don't support.
      let knownId;
      if (options.upsert) {
        try {
          let newDoc = LocalCollection._createUpsertDocument(selector, mod);
          knownId = newDoc._id;
        } catch (err) {
          throw err;
        }
      }
      if (options.upsert && !isModify && !knownId && options.insertedId && !(options.insertedId instanceof Mongo.ObjectID && options.generatedId)) {
        // In case of an upsert with a replacement, where there is no _id defined
        // in either the query or the replacement doc, mongo will generate an id itself.
        // Therefore we need this special strategy if we want to control the id ourselves.

        // We don't need to do this when:
        // - This is not a replacement, so we can add an _id to $setOnInsert
        // - The id is defined by query or mod we can just add it to the replacement doc
        // - The user did not specify any id preference and the id is a Mongo ObjectId,
        //     then we can just let Mongo generate the id
        return await simulateUpsertWithInsertedId(collection, mongoSelector, mongoMod, options).then(async result => {
          await refresh();
          await write.committed();
          if (result && !options._returnObject) {
            return result.numberAffected;
          } else {
            return result;
          }
        });
      } else {
        if (options.upsert && !knownId && options.insertedId && isModify) {
          if (!mongoMod.hasOwnProperty('$setOnInsert')) {
            mongoMod.$setOnInsert = {};
          }
          knownId = options.insertedId;
          Object.assign(mongoMod.$setOnInsert, replaceTypes({
            _id: options.insertedId
          }, replaceMeteorAtomWithMongo));
        }
        const strings = Object.keys(mongoMod).filter(key => !key.startsWith("$"));
        let updateMethod = strings.length > 0 ? 'replaceOne' : 'updateMany';
        updateMethod = updateMethod === 'updateMany' && !mongoOpts.multi ? 'updateOne' : updateMethod;
        return collection[updateMethod].bind(collection)(mongoSelector, mongoMod, mongoOpts).then(async result => {
          var meteorResult = transformResult({
            result
          });
          if (meteorResult && options._returnObject) {
            // If this was an upsertAsync() call, and we ended up
            // inserting a new doc and we know its id, then
            // return that id as well.
            if (options.upsert && meteorResult.insertedId) {
              if (knownId) {
                meteorResult.insertedId = knownId;
              } else if (meteorResult.insertedId instanceof MongoDB.ObjectID) {
                meteorResult.insertedId = new Mongo.ObjectID(meteorResult.insertedId.toHexString());
              }
            }
            await refresh();
            await write.committed();
            return meteorResult;
          } else {
            await refresh();
            await write.committed();
            return meteorResult.numberAffected;
          }
        }).catch(async err => {
          await write.committed();
          throw err;
        });
      }
    };
    var transformResult = function (driverResult) {
      var meteorResult = {
        numberAffected: 0
      };
      if (driverResult) {
        var mongoResult = driverResult.result;
        // On updates with upsert:true, the inserted values come as a list of
        // upserted values -- even with options.multi, when the upsert does insert,
        // it only inserts one element.
        if (mongoResult.upsertedCount) {
          meteorResult.numberAffected = mongoResult.upsertedCount;
          if (mongoResult.upsertedId) {
            meteorResult.insertedId = mongoResult.upsertedId;
          }
        } else {
          // n was used before Mongo 5.0, in Mongo 5.0 we are not receiving this n
          // field and so we are using modifiedCount instead
          meteorResult.numberAffected = mongoResult.n || mongoResult.matchedCount || mongoResult.modifiedCount;
        }
      }
      return meteorResult;
    };
    var NUM_OPTIMISTIC_TRIES = 3;

    // exposed for testing
    MongoConnection._isCannotChangeIdError = function (err) {
      // Mongo 3.2.* returns error as next Object:
      // {name: String, code: Number, errmsg: String}
      // Older Mongo returns:
      // {name: String, code: Number, err: String}
      var error = err.errmsg || err.err;

      // We don't use the error code here
      // because the error code we observed it producing (16837) appears to be
      // a far more generic error code based on examining the source.
      if (error.indexOf('The _id field cannot be changed') === 0 || error.indexOf("the (immutable) field '_id' was found to have been altered to _id") !== -1) {
        return true;
      }
      return false;
    };
    var simulateUpsertWithInsertedId = async function (collection, selector, mod, options) {
      // STRATEGY: First try doing an upsert with a generated ID.
      // If this throws an error about changing the ID on an existing document
      // then without affecting the database, we know we should probably try
      // an update without the generated ID. If it affected 0 documents,
      // then without affecting the database, we the document that first
      // gave the error is probably removed and we need to try an insert again
      // We go back to step one and repeat.
      // Like all "optimistic write" schemes, we rely on the fact that it's
      // unlikely our writes will continue to be interfered with under normal
      // circumstances (though sufficiently heavy contention with writers
      // disagreeing on the existence of an object will cause writes to fail
      // in theory).

      var insertedId = options.insertedId; // must exist
      var mongoOptsForUpdate = {
        safe: true,
        multi: options.multi
      };
      var mongoOptsForInsert = {
        safe: true,
        upsert: true
      };
      var replacementWithId = Object.assign(replaceTypes({
        _id: insertedId
      }, replaceMeteorAtomWithMongo), mod);
      var tries = NUM_OPTIMISTIC_TRIES;
      var doUpdate = async function () {
        tries--;
        if (!tries) {
          throw new Error("Upsert failed after " + NUM_OPTIMISTIC_TRIES + " tries.");
        } else {
          let method = collection.updateMany;
          if (!Object.keys(mod).some(key => key.startsWith("$"))) {
            method = collection.replaceOne.bind(collection);
          }
          return method(selector, mod, mongoOptsForUpdate).then(result => {
            if (result && (result.modifiedCount || result.upsertedCount)) {
              return {
                numberAffected: result.modifiedCount || result.upsertedCount,
                insertedId: result.upsertedId || undefined
              };
            } else {
              return doConditionalInsert();
            }
          });
        }
      };
      var doConditionalInsert = function () {
        return collection.replaceOne(selector, replacementWithId, mongoOptsForInsert).then(result => ({
          numberAffected: result.upsertedCount,
          insertedId: result.upsertedId
        })).catch(err => {
          if (MongoConnection._isCannotChangeIdError(err)) {
            return doUpdate();
          } else {
            throw err;
          }
        });
      };
      return doUpdate();
    };

    // XXX MongoConnection.upsertAsync() does not return the id of the inserted document
    // unless you set it explicitly in the selector or modifier (as a replacement
    // doc).
    MongoConnection.prototype.upsertAsync = async function (collectionName, selector, mod, options) {
      var self = this;
      if (typeof options === "function" && !callback) {
        callback = options;
        options = {};
      }
      return self.updateAsync(collectionName, selector, mod, Object.assign({}, options, {
        upsert: true,
        _returnObject: true
      }));
    };
    MongoConnection.prototype.find = function (collectionName, selector, options) {
      var self = this;
      if (arguments.length === 1) selector = {};
      return new Cursor(self, new CursorDescription(collectionName, selector, options));
    };
    MongoConnection.prototype.findOneAsync = async function (collection_name, selector, options) {
      var self = this;
      if (arguments.length === 1) {
        selector = {};
      }
      options = options || {};
      options.limit = 1;
      const results = await self.find(collection_name, selector, options).fetch();
      return results[0];
    };

    // We'll actually design an index API later. For now, we just pass through to
    // Mongo's, but make it synchronous.
    MongoConnection.prototype.createIndexAsync = async function (collectionName, index, options) {
      var self = this;

      // We expect this function to be called at startup, not from within a method,
      // so we don't interact with the write fence.
      var collection = self.rawCollection(collectionName);
      await collection.createIndex(index, options);
    };

    // just to be consistent with the other methods
    MongoConnection.prototype.createIndex = MongoConnection.prototype.createIndexAsync;
    MongoConnection.prototype.countDocuments = function (collectionName) {
      for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }
      args = args.map(arg => replaceTypes(arg, replaceMeteorAtomWithMongo));
      const collection = this.rawCollection(collectionName);
      return collection.countDocuments(...args);
    };
    MongoConnection.prototype.estimatedDocumentCount = function (collectionName) {
      for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        args[_key2 - 1] = arguments[_key2];
      }
      args = args.map(arg => replaceTypes(arg, replaceMeteorAtomWithMongo));
      const collection = this.rawCollection(collectionName);
      return collection.estimatedDocumentCount(...args);
    };
    MongoConnection.prototype.ensureIndexAsync = MongoConnection.prototype.createIndexAsync;
    MongoConnection.prototype.dropIndexAsync = async function (collectionName, index) {
      var self = this;

      // This function is only used by test code, not within a method, so we don't
      // interact with the write fence.
      var collection = self.rawCollection(collectionName);
      var indexName = await collection.dropIndex(index);
    };
    CLIENT_ONLY_METHODS.forEach(function (m) {
      MongoConnection.prototype[m] = function () {
        throw new Error("".concat(m, " +  is not available on the server. Please use ").concat(getAsyncMethodName(m), "() instead."));
      };
    });

    // CURSORS

    // There are several classes which relate to cursors:
    //
    // CursorDescription represents the arguments used to construct a cursor:
    // collectionName, selector, and (find) options.  Because it is used as a key
    // for cursor de-dup, everything in it should either be JSON-stringifiable or
    // not affect observeChanges output (eg, options.transform functions are not
    // stringifiable but do not affect observeChanges).
    //
    // SynchronousCursor is a wrapper around a MongoDB cursor
    // which includes fully-synchronous versions of forEach, etc.
    //
    // Cursor is the cursor object returned from find(), which implements the
    // documented Mongo.Collection cursor API.  It wraps a CursorDescription and a
    // SynchronousCursor (lazily: it doesn't contact Mongo until you call a method
    // like fetch or forEach on it).
    //
    // ObserveHandle is the "observe handle" returned from observeChanges. It has a
    // reference to an ObserveMultiplexer.
    //
    // ObserveMultiplexer allows multiple identical ObserveHandles to be driven by a
    // single observe driver.
    //
    // There are two "observe drivers" which drive ObserveMultiplexers:
    //   - PollingObserveDriver caches the results of a query and reruns it when
    //     necessary.
    //   - OplogObserveDriver follows the Mongo operation log to directly observe
    //     database changes.
    // Both implementations follow the same simple interface: when you create them,
    // they start sending observeChanges callbacks (and a ready() invocation) to
    // their ObserveMultiplexer, and you stop them by calling their stop() method.

    CursorDescription = function (collectionName, selector, options) {
      var self = this;
      self.collectionName = collectionName;
      self.selector = Mongo.Collection._rewriteSelector(selector);
      self.options = options || {};
    };
    Cursor = function (mongo, cursorDescription) {
      var self = this;
      self._mongo = mongo;
      self._cursorDescription = cursorDescription;
      self._synchronousCursor = null;
    };
    function setupSynchronousCursor(cursor, method) {
      // You can only observe a tailable cursor.
      if (cursor._cursorDescription.options.tailable) throw new Error('Cannot call ' + method + ' on a tailable cursor');
      if (!cursor._synchronousCursor) {
        cursor._synchronousCursor = cursor._mongo._createSynchronousCursor(cursor._cursorDescription, {
          // Make sure that the "cursor" argument to forEach/map callbacks is the
          // Cursor, not the SynchronousCursor.
          selfForIteration: cursor,
          useTransform: true
        });
      }
      return cursor._synchronousCursor;
    }
    Cursor.prototype.countAsync = async function () {
      const collection = this._mongo.rawCollection(this._cursorDescription.collectionName);
      return await collection.countDocuments(replaceTypes(this._cursorDescription.selector, replaceMeteorAtomWithMongo), replaceTypes(this._cursorDescription.options, replaceMeteorAtomWithMongo));
    };
    Cursor.prototype.count = function () {
      throw new Error("count() is not available on the server. Please use countAsync() instead.");
    };
    [...ASYNC_CURSOR_METHODS, Symbol.iterator, Symbol.asyncIterator].forEach(methodName => {
      // count is handled specially since we don't want to create a cursor.
      // it is still included in ASYNC_CURSOR_METHODS because we still want an async version of it to exist.
      if (methodName === 'count') {
        return;
      }
      Cursor.prototype[methodName] = function () {
        const cursor = setupSynchronousCursor(this, methodName);
        return cursor[methodName](...arguments);
      };

      // These methods are handled separately.
      if (methodName === Symbol.iterator || methodName === Symbol.asyncIterator) {
        return;
      }
      const methodNameAsync = getAsyncMethodName(methodName);
      Cursor.prototype[methodNameAsync] = function () {
        try {
          return Promise.resolve(this[methodName](...arguments));
        } catch (error) {
          return Promise.reject(error);
        }
      };
    });
    Cursor.prototype.getTransform = function () {
      return this._cursorDescription.options.transform;
    };

    // When you call Meteor.publish() with a function that returns a Cursor, we need
    // to transmute it into the equivalent subscription.  This is the function that
    // does that.
    Cursor.prototype._publishCursor = function (sub) {
      var self = this;
      var collection = self._cursorDescription.collectionName;
      return Mongo.Collection._publishCursor(self, sub, collection);
    };

    // Used to guarantee that publish functions return at most one cursor per
    // collection. Private, because we might later have cursors that include
    // documents from multiple collections somehow.
    Cursor.prototype._getCollectionName = function () {
      var self = this;
      return self._cursorDescription.collectionName;
    };
    Cursor.prototype.observe = function (callbacks) {
      var self = this;
      return LocalCollection._observeFromObserveChanges(self, callbacks);
    };
    Cursor.prototype.observeAsync = function (callbacks) {
      return new Promise(resolve => resolve(this.observe(callbacks)));
    };
    Cursor.prototype.observeChanges = function (callbacks) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var self = this;
      var methods = ['addedAt', 'added', 'changedAt', 'changed', 'removedAt', 'removed', 'movedTo'];
      var ordered = LocalCollection._observeChangesCallbacksAreOrdered(callbacks);
      let exceptionName = callbacks._fromObserve ? 'observe' : 'observeChanges';
      exceptionName += ' callback';
      methods.forEach(function (method) {
        if (callbacks[method] && typeof callbacks[method] == "function") {
          callbacks[method] = Meteor.bindEnvironment(callbacks[method], method + exceptionName);
        }
      });
      return self._mongo._observeChanges(self._cursorDescription, ordered, callbacks, options.nonMutatingCallbacks);
    };
    Cursor.prototype.observeChangesAsync = async function (callbacks) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      return this.observeChanges(callbacks, options);
    };
    MongoConnection.prototype._createSynchronousCursor = function (cursorDescription) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var self = this;
      const {
        selfForIteration,
        useTransform
      } = options;
      options = {
        selfForIteration,
        useTransform
      };
      var collection = self.rawCollection(cursorDescription.collectionName);
      var cursorOptions = cursorDescription.options;
      var mongoOptions = {
        sort: cursorOptions.sort,
        limit: cursorOptions.limit,
        skip: cursorOptions.skip,
        projection: cursorOptions.fields || cursorOptions.projection,
        readPreference: cursorOptions.readPreference
      };

      // Do we want a tailable cursor (which only works on capped collections)?
      if (cursorOptions.tailable) {
        mongoOptions.numberOfRetries = -1;
      }
      var dbCursor = collection.find(replaceTypes(cursorDescription.selector, replaceMeteorAtomWithMongo), mongoOptions);

      // Do we want a tailable cursor (which only works on capped collections)?
      if (cursorOptions.tailable) {
        // We want a tailable cursor...
        dbCursor.addCursorFlag("tailable", true);
        // ... and for the server to wait a bit if any getMore has no data (rather
        // than making us put the relevant sleeps in the client)...
        dbCursor.addCursorFlag("awaitData", true);

        // And if this is on the oplog collection and the cursor specifies a 'ts',
        // then set the undocumented oplog replay flag, which does a special scan to
        // find the first document (instead of creating an index on ts). This is a
        // very hard-coded Mongo flag which only works on the oplog collection and
        // only works with the ts field.
        if (cursorDescription.collectionName === OPLOG_COLLECTION && cursorDescription.selector.ts) {
          dbCursor.addCursorFlag("oplogReplay", true);
        }
      }
      if (typeof cursorOptions.maxTimeMs !== 'undefined') {
        dbCursor = dbCursor.maxTimeMS(cursorOptions.maxTimeMs);
      }
      if (typeof cursorOptions.hint !== 'undefined') {
        dbCursor = dbCursor.hint(cursorOptions.hint);
      }
      return new AsynchronousCursor(dbCursor, cursorDescription, options, collection);
    };

    /**
     * This is just a light wrapper for the cursor. The goal here is to ensure compatibility even if
     * there are breaking changes on the MongoDB driver.
     *
     * @constructor
     */
    class AsynchronousCursor {
      constructor(dbCursor, cursorDescription, options) {
        this._dbCursor = dbCursor;
        this._cursorDescription = cursorDescription;
        this._selfForIteration = options.selfForIteration || this;
        if (options.useTransform && cursorDescription.options.transform) {
          this._transform = LocalCollection.wrapTransform(cursorDescription.options.transform);
        } else {
          this._transform = null;
        }
        this._visitedIds = new LocalCollection._IdMap();
      }
      [Symbol.asyncIterator]() {
        var cursor = this;
        return {
          async next() {
            const value = await cursor._nextObjectPromise();
            return {
              done: !value,
              value
            };
          }
        };
      }

      // Returns a Promise for the next object from the underlying cursor (before
      // the Mongo->Meteor type replacement).
      async _rawNextObjectPromise() {
        try {
          return this._dbCursor.next();
        } catch (e) {
          console.error(e);
        }
      }

      // Returns a Promise for the next object from the cursor, skipping those whose
      // IDs we've already seen and replacing Mongo atoms with Meteor atoms.
      async _nextObjectPromise() {
        while (true) {
          var doc = await this._rawNextObjectPromise();
          if (!doc) return null;
          doc = replaceTypes(doc, replaceMongoAtomWithMeteor);
          if (!this._cursorDescription.options.tailable && _.has(doc, '_id')) {
            // Did Mongo give us duplicate documents in the same cursor? If so,
            // ignore this one. (Do this before the transform, since transform might
            // return some unrelated value.) We don't do this for tailable cursors,
            // because we want to maintain O(1) memory usage. And if there isn't _id
            // for some reason (maybe it's the oplog), then we don't do this either.
            // (Be careful to do this for falsey but existing _id, though.)
            if (this._visitedIds.has(doc._id)) continue;
            this._visitedIds.set(doc._id, true);
          }
          if (this._transform) doc = this._transform(doc);
          return doc;
        }
      }

      // Returns a promise which is resolved with the next object (like with
      // _nextObjectPromise) or rejected if the cursor doesn't return within
      // timeoutMS ms.
      _nextObjectPromiseWithTimeout(timeoutMS) {
        if (!timeoutMS) {
          return this._nextObjectPromise();
        }
        const nextObjectPromise = this._nextObjectPromise();
        const timeoutErr = new Error('Client-side timeout waiting for next object');
        const timeoutPromise = new Promise((resolve, reject) => {
          setTimeout(() => {
            reject(timeoutErr);
          }, timeoutMS);
        });
        return Promise.race([nextObjectPromise, timeoutPromise]).catch(err => {
          if (err === timeoutErr) {
            this.close();
          }
          throw err;
        });
      }
      async forEach(callback, thisArg) {
        // Get back to the beginning.
        this._rewind();
        let idx = 0;
        while (true) {
          const doc = await this._nextObjectPromise();
          if (!doc) return;
          await callback.call(thisArg, doc, idx++, this._selfForIteration);
        }
      }
      async map(callback, thisArg) {
        const results = [];
        await this.forEach(async (doc, index) => {
          results.push(await callback.call(thisArg, doc, index, this._selfForIteration));
        });
        return results;
      }
      _rewind() {
        // known to be synchronous
        this._dbCursor.rewind();
        this._visitedIds = new LocalCollection._IdMap();
      }

      // Mostly usable for tailable cursors.
      close() {
        this._dbCursor.close();
      }
      fetch() {
        return this.map(_.identity);
      }

      /**
       * FIXME: (node:34680) [MONGODB DRIVER] Warning: cursor.count is deprecated and will be
       *  removed in the next major version, please use `collection.estimatedDocumentCount` or
       *  `collection.countDocuments` instead.
       */
      count() {
        return this._dbCursor.count();
      }

      // This method is NOT wrapped in Cursor.
      async getRawObjects(ordered) {
        var self = this;
        if (ordered) {
          return self.fetch();
        } else {
          var results = new LocalCollection._IdMap();
          await self.forEach(function (doc) {
            results.set(doc._id, doc);
          });
          return results;
        }
      }
    }
    var SynchronousCursor = function (dbCursor, cursorDescription, options, collection) {
      var self = this;
      const {
        selfForIteration,
        useTransform
      } = options;
      options = {
        selfForIteration,
        useTransform
      };
      self._dbCursor = dbCursor;
      self._cursorDescription = cursorDescription;
      // The "self" argument passed to forEach/map callbacks. If we're wrapped
      // inside a user-visible Cursor, we want to provide the outer cursor!
      self._selfForIteration = options.selfForIteration || self;
      if (options.useTransform && cursorDescription.options.transform) {
        self._transform = LocalCollection.wrapTransform(cursorDescription.options.transform);
      } else {
        self._transform = null;
      }
      self._synchronousCount = Future.wrap(collection.countDocuments.bind(collection, replaceTypes(cursorDescription.selector, replaceMeteorAtomWithMongo), replaceTypes(cursorDescription.options, replaceMeteorAtomWithMongo)));
      self._visitedIds = new LocalCollection._IdMap();
    };
    Object.assign(SynchronousCursor.prototype, {
      // Returns a Promise for the next object from the underlying cursor (before
      // the Mongo->Meteor type replacement).
      _rawNextObjectPromise: function () {
        const self = this;
        return new Promise((resolve, reject) => {
          self._dbCursor.next((err, doc) => {
            if (err) {
              reject(err);
            } else {
              resolve(doc);
            }
          });
        });
      },
      // Returns a Promise for the next object from the cursor, skipping those whose
      // IDs we've already seen and replacing Mongo atoms with Meteor atoms.
      _nextObjectPromise: async function () {
        var self = this;
        while (true) {
          var doc = await self._rawNextObjectPromise();
          if (!doc) return null;
          doc = replaceTypes(doc, replaceMongoAtomWithMeteor);
          if (!self._cursorDescription.options.tailable && has(doc, '_id')) {
            // Did Mongo give us duplicate documents in the same cursor? If so,
            // ignore this one. (Do this before the transform, since transform might
            // return some unrelated value.) We don't do this for tailable cursors,
            // because we want to maintain O(1) memory usage. And if there isn't _id
            // for some reason (maybe it's the oplog), then we don't do this either.
            // (Be careful to do this for falsey but existing _id, though.)
            if (self._visitedIds.has(doc._id)) continue;
            self._visitedIds.set(doc._id, true);
          }
          if (self._transform) doc = self._transform(doc);
          return doc;
        }
      },
      // Returns a promise which is resolved with the next object (like with
      // _nextObjectPromise) or rejected if the cursor doesn't return within
      // timeoutMS ms.
      _nextObjectPromiseWithTimeout: function (timeoutMS) {
        const self = this;
        if (!timeoutMS) {
          return self._nextObjectPromise();
        }
        const nextObjectPromise = self._nextObjectPromise();
        const timeoutErr = new Error('Client-side timeout waiting for next object');
        const timeoutPromise = new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(timeoutErr);
          }, timeoutMS);
        });
        return Promise.race([nextObjectPromise, timeoutPromise]).catch(err => {
          if (err === timeoutErr) {
            self.close();
          }
          throw err;
        });
      },
      _nextObject: function () {
        var self = this;
        return self._nextObjectPromise().await();
      },
      forEach: function (callback, thisArg) {
        var self = this;
        const wrappedFn = Meteor.wrapFn(callback);

        // Get back to the beginning.
        self._rewind();

        // We implement the loop ourself instead of using self._dbCursor.each,
        // because "each" will call its callback outside of a fiber which makes it
        // much more complex to make this function synchronous.
        var index = 0;
        while (true) {
          var doc = self._nextObject();
          if (!doc) return;
          wrappedFn.call(thisArg, doc, index++, self._selfForIteration);
        }
      },
      // XXX Allow overlapping callback executions if callback yields.
      map: function (callback, thisArg) {
        var self = this;
        const wrappedFn = Meteor.wrapFn(callback);
        var res = [];
        self.forEach(function (doc, index) {
          res.push(wrappedFn.call(thisArg, doc, index, self._selfForIteration));
        });
        return res;
      },
      _rewind: function () {
        var self = this;

        // known to be synchronous
        self._dbCursor.rewind();
        self._visitedIds = new LocalCollection._IdMap();
      },
      // Mostly usable for tailable cursors.
      close: function () {
        var self = this;
        self._dbCursor.close();
      },
      fetch: function () {
        var self = this;
        return self.map(identity);
      },
      count: function () {
        var self = this;
        return self._synchronousCount().wait();
      },
      // This method is NOT wrapped in Cursor.
      getRawObjects: function (ordered) {
        var self = this;
        if (ordered) {
          return self.fetch();
        } else {
          var results = new LocalCollection._IdMap();
          self.forEach(function (doc) {
            results.set(doc._id, doc);
          });
          return results;
        }
      }
    });
    SynchronousCursor.prototype[Symbol.iterator] = function () {
      var self = this;

      // Get back to the beginning.
      self._rewind();
      return {
        next() {
          const doc = self._nextObject();
          return doc ? {
            value: doc
          } : {
            done: true
          };
        }
      };
    };
    SynchronousCursor.prototype[Symbol.asyncIterator] = function () {
      const syncResult = this[Symbol.iterator]();
      return {
        async next() {
          return Promise.resolve(syncResult.next());
        }
      };
    };

    // Tails the cursor described by cursorDescription, most likely on the
    // oplog. Calls docCallback with each document found. Ignores errors and just
    // restarts the tail on error.
    //
    // If timeoutMS is set, then if we don't get a new document every timeoutMS,
    // kill and restart the cursor. This is primarily a workaround for #8598.
    MongoConnection.prototype.tail = function (cursorDescription, docCallback, timeoutMS) {
      var self = this;
      if (!cursorDescription.options.tailable) throw new Error("Can only tail a tailable cursor");
      var cursor = self._createSynchronousCursor(cursorDescription);
      var stopped = false;
      var lastTS;
      Meteor.defer(async function loop() {
        var doc = null;
        while (true) {
          if (stopped) return;
          try {
            doc = await cursor._nextObjectPromiseWithTimeout(timeoutMS);
          } catch (err) {
            // There's no good way to figure out if this was actually an error from
            // Mongo, or just client-side (including our own timeout error). Ah
            // well. But either way, we need to retry the cursor (unless the failure
            // was because the observe got stopped).
            doc = null;
          }
          // Since we awaited a promise above, we need to check again to see if
          // we've been stopped before calling the callback.
          if (stopped) return;
          if (doc) {
            // If a tailable cursor contains a "ts" field, use it to recreate the
            // cursor on error. ("ts" is a standard that Mongo uses internally for
            // the oplog, and there's a special flag that lets you do binary search
            // on it instead of needing to use an index.)
            lastTS = doc.ts;
            docCallback(doc);
          } else {
            var newSelector = Object.assign({}, cursorDescription.selector);
            if (lastTS) {
              newSelector.ts = {
                $gt: lastTS
              };
            }
            cursor = self._createSynchronousCursor(new CursorDescription(cursorDescription.collectionName, newSelector, cursorDescription.options));
            // Mongo failover takes many seconds.  Retry in a bit.  (Without this
            // setTimeout, we peg the CPU at 100% and never notice the actual
            // failover.
            setTimeout(loop, 100);
            break;
          }
        }
      });
      return {
        stop: function () {
          stopped = true;
          cursor.close();
        }
      };
    };
    const oplogCollectionWarnings = [];
    Object.assign(MongoConnection.prototype, {
      _observeChanges: async function (cursorDescription, ordered, callbacks, nonMutatingCallbacks) {
        var _self$_oplogHandle;
        var self = this;
        const collectionName = cursorDescription.collectionName;
        if (cursorDescription.options.tailable) {
          return self._observeChangesTailable(cursorDescription, ordered, callbacks);
        }

        // You may not filter out _id when observing changes, because the id is a core
        // part of the observeChanges API.
        const fieldsOptions = cursorDescription.options.projection || cursorDescription.options.fields;
        if (fieldsOptions && (fieldsOptions._id === 0 || fieldsOptions._id === false)) {
          throw Error("You may not observe a cursor with {fields: {_id: 0}}");
        }
        var observeKey = EJSON.stringify(Object.assign({
          ordered: ordered
        }, cursorDescription));
        var multiplexer, observeDriver;
        var firstHandle = false;

        // Find a matching ObserveMultiplexer, or create a new one. This next block is
        // guaranteed to not yield (and it doesn't call anything that can observe a
        // new query), so no other calls to this function can interleave with it.
        if (has(self._observeMultiplexers, observeKey)) {
          multiplexer = self._observeMultiplexers[observeKey];
        } else {
          firstHandle = true;
          // Create a new ObserveMultiplexer.
          multiplexer = new ObserveMultiplexer({
            ordered: ordered,
            onStop: function () {
              delete self._observeMultiplexers[observeKey];
              return observeDriver.stop();
            }
          });
        }
        var observeHandle = new ObserveHandle(multiplexer, callbacks, nonMutatingCallbacks);
        const oplogOptions = (self === null || self === void 0 ? void 0 : (_self$_oplogHandle = self._oplogHandle) === null || _self$_oplogHandle === void 0 ? void 0 : _self$_oplogHandle._oplogOptions) || {};
        const {
          includeCollections,
          excludeCollections
        } = oplogOptions;
        if (firstHandle) {
          var matcher, sorter;
          var canUseOplog = [function () {
            // At a bare minimum, using the oplog requires us to have an oplog, to
            // want unordered callbacks, and to not want a callback on the polls
            // that won't happen.
            return self._oplogHandle && !ordered && !callbacks._testOnlyPollCallback;
          }, function () {
            // We also need to check, if the collection of this Cursor is actually being "watched" by the Oplog handle
            // if not, we have to fallback to long polling
            if (excludeCollections !== null && excludeCollections !== void 0 && excludeCollections.length && excludeCollections.includes(collectionName)) {
              if (!oplogCollectionWarnings.includes(collectionName)) {
                console.warn("Meteor.settings.packages.mongo.oplogExcludeCollections includes the collection ".concat(collectionName, " - your subscriptions will only use long polling!"));
                oplogCollectionWarnings.push(collectionName); // we only want to show the warnings once per collection!
              }
              return false;
            }
            if (includeCollections !== null && includeCollections !== void 0 && includeCollections.length && !includeCollections.includes(collectionName)) {
              if (!oplogCollectionWarnings.includes(collectionName)) {
                console.warn("Meteor.settings.packages.mongo.oplogIncludeCollections does not include the collection ".concat(collectionName, " - your subscriptions will only use long polling!"));
                oplogCollectionWarnings.push(collectionName); // we only want to show the warnings once per collection!
              }
              return false;
            }
            return true;
          }, function () {
            // We need to be able to compile the selector. Fall back to polling for
            // some newfangled $selector that minimongo doesn't support yet.
            try {
              matcher = new Minimongo.Matcher(cursorDescription.selector);
              return true;
            } catch (e) {
              // XXX make all compilation errors MinimongoError or something
              //     so that this doesn't ignore unrelated exceptions
              return false;
            }
          }, function () {
            // ... and the selector itself needs to support oplog.
            return OplogObserveDriver.cursorSupported(cursorDescription, matcher);
          }, function () {
            // And we need to be able to compile the sort, if any.  eg, can't be
            // {$natural: 1}.
            if (!cursorDescription.options.sort) return true;
            try {
              sorter = new Minimongo.Sorter(cursorDescription.options.sort);
              return true;
            } catch (e) {
              // XXX make all compilation errors MinimongoError or something
              //     so that this doesn't ignore unrelated exceptions
              return false;
            }
          }].every(f => f()); // invoke each function and check if all return true

          var driverClass = canUseOplog ? OplogObserveDriver : PollingObserveDriver;
          observeDriver = new driverClass({
            cursorDescription: cursorDescription,
            mongoHandle: self,
            multiplexer: multiplexer,
            ordered: ordered,
            matcher: matcher,
            // ignored by polling
            sorter: sorter,
            // ignored by polling
            _testOnlyPollCallback: callbacks._testOnlyPollCallback
          });
          if (observeDriver._init) {
            await observeDriver._init();
          }

          // This field is only set for use in tests.
          multiplexer._observeDriver = observeDriver;
        }
        self._observeMultiplexers[observeKey] = multiplexer;
        // Blocks until the initial adds have been sent.
        await multiplexer.addHandleAndSendInitialAdds(observeHandle);
        return observeHandle;
      }
    });

    // Listen for the invalidation messages that will trigger us to poll the
    // database for changes. If this selector specifies specific IDs, specify them
    // here, so that updates to different specific IDs don't cause us to poll.
    // listenCallback is the same kind of (notification, complete) callback passed
    // to InvalidationCrossbar.listen.

    listenAll = async function (cursorDescription, listenCallback) {
      const listeners = [];
      await forEachTrigger(cursorDescription, function (trigger) {
        listeners.push(DDPServer._InvalidationCrossbar.listen(trigger, listenCallback));
      });
      return {
        stop: function () {
          listeners.forEach(function (listener) {
            listener.stop();
          });
        }
      };
    };
    forEachTrigger = async function (cursorDescription, triggerCallback) {
      const key = {
        collection: cursorDescription.collectionName
      };
      const specificIds = LocalCollection._idsMatchedBySelector(cursorDescription.selector);
      if (specificIds) {
        for (const id of specificIds) {
          await triggerCallback(_.extend({
            id: id
          }, key));
        }
        await triggerCallback(_.extend({
          dropCollection: true,
          id: null
        }, key));
      } else {
        await triggerCallback(key);
      }
      // Everyone cares about the database being dropped.
      await triggerCallback({
        dropDatabase: true
      });
    };

    // observeChanges for tailable cursors on capped collections.
    //
    // Some differences from normal cursors:
    //   - Will never produce anything other than 'added' or 'addedBefore'. If you
    //     do update a document that has already been produced, this will not notice
    //     it.
    //   - If you disconnect and reconnect from Mongo, it will essentially restart
    //     the query, which will lead to duplicate results. This is pretty bad,
    //     but if you include a field called 'ts' which is inserted as
    //     new MongoInternals.MongoTimestamp(0, 0) (which is initialized to the
    //     current Mongo-style timestamp), we'll be able to find the place to
    //     restart properly. (This field is specifically understood by Mongo with an
    //     optimization which allows it to find the right place to start without
    //     an index on ts. It's how the oplog works.)
    //   - No callbacks are triggered synchronously with the call (there's no
    //     differentiation between "initial data" and "later changes"; everything
    //     that matches the query gets sent asynchronously).
    //   - De-duplication is not implemented.
    //   - Does not yet interact with the write fence. Probably, this should work by
    //     ignoring removes (which don't work on capped collections) and updates
    //     (which don't affect tailable cursors), and just keeping track of the ID
    //     of the inserted object, and closing the write fence once you get to that
    //     ID (or timestamp?).  This doesn't work well if the document doesn't match
    //     the query, though.  On the other hand, the write fence can close
    //     immediately if it does not match the query. So if we trust minimongo
    //     enough to accurately evaluate the query against the write fence, we
    //     should be able to do this...  Of course, minimongo doesn't even support
    //     Mongo Timestamps yet.
    MongoConnection.prototype._observeChangesTailable = function (cursorDescription, ordered, callbacks) {
      var self = this;

      // Tailable cursors only ever call added/addedBefore callbacks, so it's an
      // error if you didn't provide them.
      if (ordered && !callbacks.addedBefore || !ordered && !callbacks.added) {
        throw new Error("Can't observe an " + (ordered ? "ordered" : "unordered") + " tailable cursor without a " + (ordered ? "addedBefore" : "added") + " callback");
      }
      return self.tail(cursorDescription, function (doc) {
        var id = doc._id;
        delete doc._id;
        // The ts is an implementation detail. Hide it.
        delete doc.ts;
        if (ordered) {
          callbacks.addedBefore(id, doc, null);
        } else {
          callbacks.added(id, doc);
        }
      });
    };

    // XXX We probably need to find a better way to expose this. Right now
    // it's only used by tests, but in fact you need it in normal
    // operation to interact with capped collections.
    MongoInternals.MongoTimestamp = MongoDB.Timestamp;
    MongoInternals.Connection = MongoConnection;
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

},"oplog_tailing.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/oplog_tailing.js                                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let isEmpty;
    module.link("lodash.isempty", {
      default(v) {
        isEmpty = v;
      }
    }, 0);
    let has;
    module.link("lodash.has", {
      default(v) {
        has = v;
      }
    }, 1);
    let NpmModuleMongodb;
    module.link("meteor/npm-mongo", {
      NpmModuleMongodb(v) {
        NpmModuleMongodb = v;
      }
    }, 2);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const {
      Long
    } = NpmModuleMongodb;
    OPLOG_COLLECTION = 'oplog.rs';
    var TOO_FAR_BEHIND = process.env.METEOR_OPLOG_TOO_FAR_BEHIND || 2000;
    var TAIL_TIMEOUT = +process.env.METEOR_OPLOG_TAIL_TIMEOUT || 30000;
    idForOp = function (op) {
      if (op.op === 'd') return op.o._id;else if (op.op === 'i') return op.o._id;else if (op.op === 'u') return op.o2._id;else if (op.op === 'c') throw Error("Operator 'c' doesn't supply an object with id: " + EJSON.stringify(op));else throw Error("Unknown op: " + EJSON.stringify(op));
    };
    OplogHandle = function (oplogUrl, dbName) {
      var self = this;
      self._oplogUrl = oplogUrl;
      self._dbName = dbName;
      self._oplogLastEntryConnection = null;
      self._oplogTailConnection = null;
      self._oplogOptions = null;
      self._stopped = false;
      self._tailHandle = null;
      self._readyPromiseResolver = null;
      self._readyPromise = new Promise(r => self._readyPromiseResolver = r);
      self._crossbar = new DDPServer._Crossbar({
        factPackage: "mongo-livedata",
        factName: "oplog-watchers"
      });
      self._baseOplogSelector = {
        ns: new RegExp("^(?:" + [Meteor._escapeRegExp(self._dbName + "."), Meteor._escapeRegExp("admin.$cmd")].join("|") + ")"),
        $or: [{
          op: {
            $in: ['i', 'u', 'd']
          }
        },
        // drop collection
        {
          op: 'c',
          'o.drop': {
            $exists: true
          }
        }, {
          op: 'c',
          'o.dropDatabase': 1
        }, {
          op: 'c',
          'o.applyOps': {
            $exists: true
          }
        }]
      };

      // Data structures to support waitUntilCaughtUp(). Each oplog entry has a
      // MongoTimestamp object on it (which is not the same as a Date --- it's a
      // combination of time and an incrementing counter; see
      // http://docs.mongodb.org/manual/reference/bson-types/#timestamps).
      //
      // _catchingUpFutures is an array of {ts: MongoTimestamp, future: Future}
      // objects, sorted by ascending timestamp. _lastProcessedTS is the
      // MongoTimestamp of the last oplog entry we've processed.
      //
      // Each time we call waitUntilCaughtUp, we take a peek at the final oplog
      // entry in the db.  If we've already processed it (ie, it is not greater than
      // _lastProcessedTS), waitUntilCaughtUp immediately returns. Otherwise,
      // waitUntilCaughtUp makes a new Future and inserts it along with the final
      // timestamp entry that it read, into _catchingUpFutures. waitUntilCaughtUp
      // then waits on that future, which is resolved once _lastProcessedTS is
      // incremented to be past its timestamp by the worker fiber.
      //
      // XXX use a priority queue or something else that's faster than an array
      self._catchingUpResolvers = [];
      self._lastProcessedTS = null;
      self._onSkippedEntriesHook = new Hook({
        debugPrintExceptions: "onSkippedEntries callback"
      });
      self._entryQueue = new Meteor._DoubleEndedQueue();
      self._workerActive = false;
      self._startTrailingPromise = self._startTailing();
      //TODO[fibers] Why wait?
    };
    MongoInternals.OplogHandle = OplogHandle;
    Object.assign(OplogHandle.prototype, {
      stop: async function () {
        var self = this;
        if (self._stopped) return;
        self._stopped = true;
        if (self._tailHandle) await self._tailHandle.stop();
        // XXX should close connections too
      },
      _onOplogEntry: async function (trigger, callback) {
        var self = this;
        if (self._stopped) throw new Error("Called onOplogEntry on stopped handle!");

        // Calling onOplogEntry requires us to wait for the tailing to be ready.
        await self._readyPromise;
        var originalCallback = callback;
        callback = Meteor.bindEnvironment(function (notification) {
          originalCallback(notification);
        }, function (err) {
          Meteor._debug("Error in oplog callback", err);
        });
        var listenHandle = self._crossbar.listen(trigger, callback);
        return {
          stop: async function () {
            await listenHandle.stop();
          }
        };
      },
      onOplogEntry: function (trigger, callback) {
        return this._onOplogEntry(trigger, callback);
      },
      // Register a callback to be invoked any time we skip oplog entries (eg,
      // because we are too far behind).
      onSkippedEntries: function (callback) {
        var self = this;
        if (self._stopped) throw new Error("Called onSkippedEntries on stopped handle!");
        return self._onSkippedEntriesHook.register(callback);
      },
      async _waitUntilCaughtUp() {
        var self = this;
        if (self._stopped) throw new Error("Called waitUntilCaughtUp on stopped handle!");

        // Calling waitUntilCaughtUp requries us to wait for the oplog connection to
        // be ready.
        await self._readyPromise;
        var lastEntry;
        while (!self._stopped) {
          // We need to make the selector at least as restrictive as the actual
          // tailing selector (ie, we need to specify the DB name) or else we might
          // find a TS that won't show up in the actual tail stream.
          try {
            lastEntry = await self._oplogLastEntryConnection.findOneAsync(OPLOG_COLLECTION, self._baseOplogSelector, {
              projection: {
                ts: 1
              },
              sort: {
                $natural: -1
              }
            });
            break;
          } catch (e) {
            // During failover (eg) if we get an exception we should log and retry
            // instead of crashing.
            Meteor._debug("Got exception while reading last entry", e);
            await Meteor._sleepForMs(100);
          }
        }
        if (self._stopped) return;
        if (!lastEntry) {
          // Really, nothing in the oplog? Well, we've processed everything.
          return;
        }
        var ts = lastEntry.ts;
        if (!ts) throw Error("oplog entry without ts: " + EJSON.stringify(lastEntry));
        if (self._lastProcessedTS && ts.lessThanOrEqual(self._lastProcessedTS)) {
          // We've already caught up to here.
          return;
        }

        // Insert the future into our list. Almost always, this will be at the end,
        // but it's conceivable that if we fail over from one primary to another,
        // the oplog entries we see will go backwards.
        var insertAfter = self._catchingUpResolvers.length;
        while (insertAfter - 1 > 0 && self._catchingUpResolvers[insertAfter - 1].ts.greaterThan(ts)) {
          insertAfter--;
        }
        let promiseResolver = null;
        const promiseToAwait = new Promise(r => promiseResolver = r);
        self._catchingUpResolvers.splice(insertAfter, 0, {
          ts: ts,
          resolver: promiseResolver
        });
        await promiseToAwait;
      },
      // Calls `callback` once the oplog has been processed up to a point that is
      // roughly "now": specifically, once we've processed all ops that are
      // currently visible.
      // XXX become convinced that this is actually safe even if oplogConnection
      // is some kind of pool
      waitUntilCaughtUp: async function () {
        return this._waitUntilCaughtUp();
      },
      _startTailing: async function () {
        var _Meteor$settings, _Meteor$settings$pack, _Meteor$settings$pack2, _Meteor$settings2, _Meteor$settings2$pac, _Meteor$settings2$pac2;
        var self = this;
        // First, make sure that we're talking to the local database.
        var mongodbUri = Npm.require('mongodb-uri');
        if (mongodbUri.parse(self._oplogUrl).database !== 'local') {
          throw Error("$MONGO_OPLOG_URL must be set to the 'local' database of " + "a Mongo replica set");
        }

        // We make two separate connections to Mongo. The Node Mongo driver
        // implements a naive round-robin connection pool: each "connection" is a
        // pool of several (5 by default) TCP connections, and each request is
        // rotated through the pools. Tailable cursor queries block on the server
        // until there is some data to return (or until a few seconds have
        // passed). So if the connection pool used for tailing cursors is the same
        // pool used for other queries, the other queries will be delayed by seconds
        // 1/5 of the time.
        //
        // The tail connection will only ever be running a single tail command, so
        // it only needs to make one underlying TCP connection.
        self._oplogTailConnection = new MongoConnection(self._oplogUrl, {
          maxPoolSize: 1,
          minPoolSize: 1
        });
        // XXX better docs, but: it's to get monotonic results
        // XXX is it safe to say "if there's an in flight query, just use its
        //     results"? I don't think so but should consider that
        self._oplogLastEntryConnection = new MongoConnection(self._oplogUrl, {
          maxPoolSize: 1,
          minPoolSize: 1
        });

        // Now, make sure that there actually is a repl set here. If not, oplog
        // tailing won't ever find anything!
        // More on the isMasterDoc
        // https://docs.mongodb.com/manual/reference/command/isMaster/
        const isMasterDoc = await new Promise(function (resolve, reject) {
          self._oplogLastEntryConnection.db.admin().command({
            ismaster: 1
          }, function (err, result) {
            if (err) reject(err);else resolve(result);
          });
        });
        if (!(isMasterDoc && isMasterDoc.setName)) {
          throw Error("$MONGO_OPLOG_URL must be set to the 'local' database of " + "a Mongo replica set");
        }

        // Find the last oplog entry.
        var lastOplogEntry = await self._oplogLastEntryConnection.findOneAsync(OPLOG_COLLECTION, {}, {
          sort: {
            $natural: -1
          },
          projection: {
            ts: 1
          }
        });
        var oplogSelector = Object.assign({}, self._baseOplogSelector);
        if (lastOplogEntry) {
          // Start after the last entry that currently exists.
          oplogSelector.ts = {
            $gt: lastOplogEntry.ts
          };
          // If there are any calls to callWhenProcessedLatest before any other
          // oplog entries show up, allow callWhenProcessedLatest to call its
          // callback immediately.
          self._lastProcessedTS = lastOplogEntry.ts;
        }

        // These 2 settings allow you to either only watch certain collections (oplogIncludeCollections), or exclude some collections you don't want to watch for oplog updates (oplogExcludeCollections)
        // Usage:
        // settings.json = {
        //   "packages": {
        //     "mongo": {
        //       "oplogExcludeCollections": ["products", "prices"] // This would exclude both collections "products" and "prices" from any oplog tailing. 
        //                                                            Beware! This means, that no subscriptions on these 2 collections will update anymore!
        //     }
        //   }
        // }
        const includeCollections = (_Meteor$settings = Meteor.settings) === null || _Meteor$settings === void 0 ? void 0 : (_Meteor$settings$pack = _Meteor$settings.packages) === null || _Meteor$settings$pack === void 0 ? void 0 : (_Meteor$settings$pack2 = _Meteor$settings$pack.mongo) === null || _Meteor$settings$pack2 === void 0 ? void 0 : _Meteor$settings$pack2.oplogIncludeCollections;
        const excludeCollections = (_Meteor$settings2 = Meteor.settings) === null || _Meteor$settings2 === void 0 ? void 0 : (_Meteor$settings2$pac = _Meteor$settings2.packages) === null || _Meteor$settings2$pac === void 0 ? void 0 : (_Meteor$settings2$pac2 = _Meteor$settings2$pac.mongo) === null || _Meteor$settings2$pac2 === void 0 ? void 0 : _Meteor$settings2$pac2.oplogExcludeCollections;
        if (includeCollections !== null && includeCollections !== void 0 && includeCollections.length && excludeCollections !== null && excludeCollections !== void 0 && excludeCollections.length) {
          throw new Error("Can't use both mongo oplog settings oplogIncludeCollections and oplogExcludeCollections at the same time.");
        }
        if (excludeCollections !== null && excludeCollections !== void 0 && excludeCollections.length) {
          oplogSelector.ns = {
            $regex: oplogSelector.ns,
            $nin: excludeCollections.map(collName => "".concat(self._dbName, ".").concat(collName))
          };
          self._oplogOptions = {
            excludeCollections
          };
        } else if (includeCollections !== null && includeCollections !== void 0 && includeCollections.length) {
          oplogSelector = {
            $and: [{
              $or: [{
                ns: /^admin\.\$cmd/
              }, {
                ns: {
                  $in: includeCollections.map(collName => "".concat(self._dbName, ".").concat(collName))
                }
              }]
            }, {
              $or: oplogSelector.$or
            },
            // the initial $or to select only certain operations (op)
            {
              ts: oplogSelector.ts
            }]
          };
          self._oplogOptions = {
            includeCollections
          };
        }
        var cursorDescription = new CursorDescription(OPLOG_COLLECTION, oplogSelector, {
          tailable: true
        });

        // Start tailing the oplog.
        //
        // We restart the low-level oplog query every 30 seconds if we didn't get a
        // doc. This is a workaround for #8598: the Node Mongo driver has at least
        // one bug that can lead to query callbacks never getting called (even with
        // an error) when leadership failover occur.
        self._tailHandle = self._oplogTailConnection.tail(cursorDescription, function (doc) {
          self._entryQueue.push(doc);
          self._maybeStartWorker();
        }, TAIL_TIMEOUT);
        self._readyPromiseResolver();
      },
      _maybeStartWorker: function () {
        var self = this;
        if (self._workerActive) return;
        self._workerActive = true;
        Meteor.defer(async function () {
          // May be called recursively in case of transactions.
          async function handleDoc(doc) {
            if (doc.ns === "admin.$cmd") {
              if (doc.o.applyOps) {
                // This was a successful transaction, so we need to apply the
                // operations that were involved.
                let nextTimestamp = doc.ts;
                for (const op of doc.o.applyOps) {
                  // See https://github.com/meteor/meteor/issues/10420.
                  if (!op.ts) {
                    op.ts = nextTimestamp;
                    nextTimestamp = nextTimestamp.add(Long.ONE);
                  }
                  await handleDoc(op);
                }
                return;
              }
              throw new Error("Unknown command " + EJSON.stringify(doc));
            }
            const trigger = {
              dropCollection: false,
              dropDatabase: false,
              op: doc
            };
            if (typeof doc.ns === "string" && doc.ns.startsWith(self._dbName + ".")) {
              trigger.collection = doc.ns.slice(self._dbName.length + 1);
            }

            // Is it a special command and the collection name is hidden
            // somewhere in operator?
            if (trigger.collection === "$cmd") {
              if (doc.o.dropDatabase) {
                delete trigger.collection;
                trigger.dropDatabase = true;
              } else if (has(doc.o, "drop")) {
                trigger.collection = doc.o.drop;
                trigger.dropCollection = true;
                trigger.id = null;
              } else if ("create" in doc.o && "idIndex" in doc.o) {
                // A collection got implicitly created within a transaction. There's
                // no need to do anything about it.
              } else {
                throw Error("Unknown command " + EJSON.stringify(doc));
              }
            } else {
              // All other ops have an id.
              trigger.id = idForOp(doc);
            }
            await self._crossbar.fire(trigger);
          }
          try {
            while (!self._stopped && !self._entryQueue.isEmpty()) {
              // Are we too far behind? Just tell our observers that they need to
              // repoll, and drop our queue.
              if (self._entryQueue.length > TOO_FAR_BEHIND) {
                var lastEntry = self._entryQueue.pop();
                self._entryQueue.clear();
                self._onSkippedEntriesHook.each(function (callback) {
                  callback();
                  return true;
                });

                // Free any waitUntilCaughtUp() calls that were waiting for us to
                // pass something that we just skipped.
                self._setLastProcessedTS(lastEntry.ts);
                continue;
              }
              const doc = self._entryQueue.shift();

              // Fire trigger(s) for this doc.
              await handleDoc(doc);

              // Now that we've processed this operation, process pending
              // sequencers.
              if (doc.ts) {
                self._setLastProcessedTS(doc.ts);
              } else {
                throw Error("oplog entry without ts: " + EJSON.stringify(doc));
              }
            }
          } finally {
            self._workerActive = false;
          }
        });
      },
      _setLastProcessedTS: function (ts) {
        var self = this;
        self._lastProcessedTS = ts;
        while (!isEmpty(self._catchingUpResolvers) && self._catchingUpResolvers[0].ts.lessThanOrEqual(self._lastProcessedTS)) {
          var sequencer = self._catchingUpResolvers.shift();
          sequencer.resolver();
        }
      },
      //Methods used on tests to dinamically change TOO_FAR_BEHIND
      _defineTooFarBehind: function (value) {
        TOO_FAR_BEHIND = value;
      },
      _resetTooFarBehind: function () {
        TOO_FAR_BEHIND = process.env.METEOR_OPLOG_TOO_FAR_BEHIND || 2000;
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

},"observe_multiplex.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/observe_multiplex.js                                                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectWithoutProperties;
    module.link("@babel/runtime/helpers/objectWithoutProperties", {
      default(v) {
        _objectWithoutProperties = v;
      }
    }, 0);
    const _excluded = ["_id"];
    let has;
    module.link("lodash.has", {
      default(v) {
        has = v;
      }
    }, 0);
    let isEmpty;
    module.link("lodash.isempty", {
      default(v) {
        isEmpty = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    let nextObserveHandleId = 1;
    ObserveMultiplexer = class {
      constructor() {
        let {
          ordered,
          onStop = () => {}
        } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        if (ordered === undefined) throw Error("must specify ordered");
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-multiplexers", 1);
        this._ordered = ordered;
        this._onStop = onStop;
        this._queue = new Meteor._AsynchronousQueue();
        this._handles = {};
        this._resolver = null;
        this._readyPromise = new Promise(r => this._resolver = r).then(() => this._isReady = true);
        this._cache = new LocalCollection._CachingChangeObserver({
          ordered
        });
        // Number of addHandleAndSendInitialAdds tasks scheduled but not yet
        // running. removeHandle uses this to know if it's time to call the onStop
        // callback.
        this._addHandleTasksScheduledButNotPerformed = 0;
        const self = this;
        this.callbackNames().forEach(callbackName => {
          this[callbackName] = function /* ... */
          () {
            self._applyCallback(callbackName, _.toArray(arguments));
          };
        });
      }
      addHandleAndSendInitialAdds(handle) {
        return this._addHandleAndSendInitialAdds(handle);
      }
      async _addHandleAndSendInitialAdds(handle) {
        ++this._addHandleTasksScheduledButNotPerformed;
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-handles", 1);
        const self = this;
        await this._queue.runTask(async function () {
          self._handles[handle._id] = handle;
          // Send out whatever adds we have so far (whether the
          // multiplexer is ready).
          await self._sendAdds(handle);
          --self._addHandleTasksScheduledButNotPerformed;
        });
        await this._readyPromise;
      }

      // Remove an observe handle. If it was the last observe handle, call the
      // onStop callback; you cannot add any more observe handles after this.
      //
      // This is not synchronized with polls and handle additions: this means that
      // you can safely call it from within an observe callback, but it also means
      // that we have to be careful when we iterate over _handles.
      async removeHandle(id) {
        // This should not be possible: you can only call removeHandle by having
        // access to the ObserveHandle, which isn't returned to user code until the
        // multiplex is ready.
        if (!this._ready()) throw new Error("Can't remove handles until the multiplex is ready");
        delete this._handles[id];
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-handles", -1);
        if (isEmpty(this._handles) && this._addHandleTasksScheduledButNotPerformed === 0) {
          await this._stop();
        }
      }
      async _stop(options) {
        options = options || {};

        // It shouldn't be possible for us to stop when all our handles still
        // haven't been returned from observeChanges!
        if (!this._ready() && !options.fromQueryError) throw Error("surprising _stop: not ready");

        // Call stop callback (which kills the underlying process which sends us
        // callbacks and removes us from the connection's dictionary).
        await this._onStop();
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-multiplexers", -1);

        // Cause future addHandleAndSendInitialAdds calls to throw (but the onStop
        // callback should make our connection forget about us).
        this._handles = null;
      }

      // Allows all addHandleAndSendInitialAdds calls to return, once all preceding
      // adds have been processed. Does not block.
      async ready() {
        const self = this;
        this._queue.queueTask(function () {
          if (self._ready()) throw Error("can't make ObserveMultiplex ready twice!");
          if (!self._resolver) {
            throw new Error("Missing resolver");
          }
          self._resolver();
          self._isReady = true;
        });
      }

      // If trying to execute the query results in an error, call this. This is
      // intended for permanent errors, not transient network errors that could be
      // fixed. It should only be called before ready(), because if you called ready
      // that meant that you managed to run the query once. It will stop this
      // ObserveMultiplex and cause addHandleAndSendInitialAdds calls (and thus
      // observeChanges calls) to throw the error.
      async queryError(err) {
        var self = this;
        await this._queue.runTask(function () {
          if (self._ready()) throw Error("can't claim query has an error after it worked!");
          self._stop({
            fromQueryError: true
          });
          throw err;
        });
      }

      // Calls "cb" once the effects of all "ready", "addHandleAndSendInitialAdds"
      // and observe callbacks which came before this call have been propagated to
      // all handles. "ready" must have already been called on this multiplexer.
      async onFlush(cb) {
        var self = this;
        await this._queue.queueTask(async function () {
          if (!self._ready()) throw Error("only call onFlush on a multiplexer that will be ready");
          await cb();
        });
      }
      callbackNames() {
        if (this._ordered) return ["addedBefore", "changed", "movedBefore", "removed"];else return ["added", "changed", "removed"];
      }
      _ready() {
        return !!this._isReady;
      }
      _applyCallback(callbackName, args) {
        const self = this;
        this._queue.queueTask(async function () {
          // If we stopped in the meantime, do nothing.
          if (!self._handles) return;

          // First, apply the change to the cache.
          await self._cache.applyChange[callbackName].apply(null, args);
          // If we haven't finished the initial adds, then we should only be getting
          // adds.
          if (!self._ready() && callbackName !== 'added' && callbackName !== 'addedBefore') {
            throw new Error("Got " + callbackName + " during initial adds");
          }

          // Now multiplex the callbacks out to all observe handles. It's OK if
          // these calls yield; since we're inside a task, no other use of our queue
          // can continue until these are done. (But we do have to be careful to not
          // use a handle that got removed, because removeHandle does not use the
          // queue; thus, we iterate over an array of keys that we control.)
          for (const handleId of Object.keys(self._handles)) {
            var handle = self._handles && self._handles[handleId];
            if (!handle) return;
            var callback = handle['_' + callbackName];
            // clone arguments so that callbacks can mutate their arguments

            callback && (await callback.apply(null, handle.nonMutatingCallbacks ? args : EJSON.clone(args)));
          }
        });
      }

      // Sends initial adds to a handle. It should only be called from within a task
      // (the task that is processing the addHandleAndSendInitialAdds call). It
      // synchronously invokes the handle's added or addedBefore; there's no need to
      // flush the queue afterwards to ensure that the callbacks get out.
      async _sendAdds(handle) {
        var add = this._ordered ? handle._addedBefore : handle._added;
        if (!add) return;
        // note: docs may be an _IdMap or an OrderedDict
        await this._cache.docs.forEachAsync(async (doc, id) => {
          if (!has(this._handles, handle._id)) throw Error("handle got removed before sending initial adds!");
          const _ref = handle.nonMutatingCallbacks ? doc : EJSON.clone(doc),
            {
              _id
            } = _ref,
            fields = _objectWithoutProperties(_ref, _excluded);
          if (this._ordered) await add(id, fields, null); // we're going in order, so add at end
          else await add(id, fields);
        });
      }
    };

    // When the callbacks do not mutate the arguments, we can skip a lot of data clones
    ObserveHandle = class {
      constructor(multiplexer, callbacks) {
        let nonMutatingCallbacks = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
        this._multiplexer = multiplexer;
        multiplexer.callbackNames().forEach(name => {
          if (callbacks[name]) {
            this['_' + name] = callbacks[name];
          } else if (name === "addedBefore" && callbacks.added) {
            // Special case: if you specify "added" and "movedBefore", you get an
            // ordered observe where for some reason you don't get ordering data on
            // the adds.  I dunno, we wrote tests for it, there must have been a
            // reason.
            this._addedBefore = async function (id, fields, before) {
              await callbacks.added(id, fields);
            };
          }
        });
        this._stopped = false;
        this._id = nextObserveHandleId++;
        this.nonMutatingCallbacks = nonMutatingCallbacks;
      }
      async stop() {
        if (this._stopped) return;
        this._stopped = true;
        await this._multiplexer.removeHandle(this._id);
      }
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

},"doc_fetcher.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/doc_fetcher.js                                                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  DocFetcher: () => DocFetcher
});
class DocFetcher {
  constructor(mongoConnection) {
    this._mongoConnection = mongoConnection;
    // Map from op -> [callback]
    this._callbacksForOp = new Map();
  }

  // Fetches document "id" from collectionName, returning it or null if not
  // found.
  //
  // If you make multiple calls to fetch() with the same op reference,
  // DocFetcher may assume that they all return the same document. (It does
  // not check to see if collectionName/id match.)
  //
  // You may assume that callback is never called synchronously (and in fact
  // OplogObserveDriver does so).
  async fetch(collectionName, id, op, callback) {
    const self = this;
    check(collectionName, String);
    check(op, Object);

    // If there's already an in-progress fetch for this cache key, yield until
    // it's done and return whatever it returns.
    if (self._callbacksForOp.has(op)) {
      self._callbacksForOp.get(op).push(callback);
      return;
    }
    const callbacks = [callback];
    self._callbacksForOp.set(op, callbacks);
    try {
      var doc = (await self._mongoConnection.findOneAsync(collectionName, {
        _id: id
      })) || null;
      // Return doc to all relevant callbacks. Note that this array can
      // continue to grow during callback excecution.
      while (callbacks.length > 0) {
        // Clone the document so that the various calls to fetch don't return
        // objects that are intertwingled with each other. Clone before
        // popping the future, so that if clone throws, the error gets passed
        // to the next callback.
        callbacks.pop()(null, EJSON.clone(doc));
      }
    } catch (e) {
      while (callbacks.length > 0) {
        callbacks.pop()(e);
      }
    } finally {
      // XXX consider keeping the doc around for a period of time before
      // removing from the cache
      self._callbacksForOp.delete(op);
    }
  }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"polling_observe_driver.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/polling_observe_driver.js                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let throttle;
    module.link("lodash.throttle", {
      default(v) {
        throttle = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    var POLLING_THROTTLE_MS = +process.env.METEOR_POLLING_THROTTLE_MS || 50;
    var POLLING_INTERVAL_MS = +process.env.METEOR_POLLING_INTERVAL_MS || 10 * 1000;
    PollingObserveDriver = function (options) {
      const self = this;
      self._options = options;
      self._cursorDescription = options.cursorDescription;
      self._mongoHandle = options.mongoHandle;
      self._ordered = options.ordered;
      self._multiplexer = options.multiplexer;
      self._stopCallbacks = [];
      self._stopped = false;
      self._cursor = self._mongoHandle._createSynchronousCursor(self._cursorDescription);

      // previous results snapshot.  on each poll cycle, diffs against
      // results drives the callbacks.
      self._results = null;

      // The number of _pollMongo calls that have been added to self._taskQueue but
      // have not started running. Used to make sure we never schedule more than one
      // _pollMongo (other than possibly the one that is currently running). It's
      // also used by _suspendPolling to pretend there's a poll scheduled. Usually,
      // it's either 0 (for "no polls scheduled other than maybe one currently
      // running") or 1 (for "a poll scheduled that isn't running yet"), but it can
      // also be 2 if incremented by _suspendPolling.
      self._pollsScheduledButNotStarted = 0;
      self._pendingWrites = []; // people to notify when polling completes

      // Make sure to create a separately throttled function for each
      // PollingObserveDriver object.
      self._ensurePollIsScheduled = throttle(self._unthrottledEnsurePollIsScheduled, self._cursorDescription.options.pollingThrottleMs || POLLING_THROTTLE_MS /* ms */);

      // XXX figure out if we still need a queue
      self._taskQueue = new Meteor._AsynchronousQueue();
    };
    _.extend(PollingObserveDriver.prototype, {
      _init: async function () {
        const self = this;
        const options = self._options;
        const listenersHandle = await listenAll(self._cursorDescription, function (notification) {
          // When someone does a transaction that might affect us, schedule a poll
          // of the database. If that transaction happens inside of a write fence,
          // block the fence until we've polled and notified observers.
          const fence = DDPServer._getCurrentFence();
          if (fence) self._pendingWrites.push(fence.beginWrite());
          // Ensure a poll is scheduled... but if we already know that one is,
          // don't hit the throttled _ensurePollIsScheduled function (which might
          // lead to us calling it unnecessarily in <pollingThrottleMs> ms).
          if (self._pollsScheduledButNotStarted === 0) self._ensurePollIsScheduled();
        });
        self._stopCallbacks.push(async function () {
          await listenersHandle.stop();
        });

        // every once and a while, poll even if we don't think we're dirty, for
        // eventual consistency with database writes from outside the Meteor
        // universe.
        //
        // For testing, there's an undocumented callback argument to observeChanges
        // which disables time-based polling and gets called at the beginning of each
        // poll.
        if (options._testOnlyPollCallback) {
          self._testOnlyPollCallback = options._testOnlyPollCallback;
        } else {
          const pollingInterval = self._cursorDescription.options.pollingIntervalMs || self._cursorDescription.options._pollingInterval ||
          // COMPAT with 1.2
          POLLING_INTERVAL_MS;
          const intervalHandle = Meteor.setInterval(self._ensurePollIsScheduled.bind(self), pollingInterval);
          self._stopCallbacks.push(function () {
            Meteor.clearInterval(intervalHandle);
          });
        }

        // Make sure we actually poll soon!
        await this._unthrottledEnsurePollIsScheduled();
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-drivers-polling", 1);
      },
      // This is always called through _.throttle (except once at startup).
      _unthrottledEnsurePollIsScheduled: async function () {
        var self = this;
        if (self._pollsScheduledButNotStarted > 0) return;
        ++self._pollsScheduledButNotStarted;
        await self._taskQueue.runTask(async function () {
          await self._pollMongo();
        });
      },
      // test-only interface for controlling polling.
      //
      // _suspendPolling blocks until any currently running and scheduled polls are
      // done, and prevents any further polls from being scheduled. (new
      // ObserveHandles can be added and receive their initial added callbacks,
      // though.)
      //
      // _resumePolling immediately polls, and allows further polls to occur.
      _suspendPolling: function () {
        var self = this;
        // Pretend that there's another poll scheduled (which will prevent
        // _ensurePollIsScheduled from queueing any more polls).
        ++self._pollsScheduledButNotStarted;
        // Now block until all currently running or scheduled polls are done.
        self._taskQueue.runTask(function () {});

        // Confirm that there is only one "poll" (the fake one we're pretending to
        // have) scheduled.
        if (self._pollsScheduledButNotStarted !== 1) throw new Error("_pollsScheduledButNotStarted is " + self._pollsScheduledButNotStarted);
      },
      _resumePolling: async function () {
        var self = this;
        // We should be in the same state as in the end of _suspendPolling.
        if (self._pollsScheduledButNotStarted !== 1) throw new Error("_pollsScheduledButNotStarted is " + self._pollsScheduledButNotStarted);
        // Run a poll synchronously (which will counteract the
        // ++_pollsScheduledButNotStarted from _suspendPolling).
        await self._taskQueue.runTask(async function () {
          await self._pollMongo();
        });
      },
      async _pollMongo() {
        var self = this;
        --self._pollsScheduledButNotStarted;
        if (self._stopped) return;
        var first = false;
        var newResults;
        var oldResults = self._results;
        if (!oldResults) {
          first = true;
          // XXX maybe use OrderedDict instead?
          oldResults = self._ordered ? [] : new LocalCollection._IdMap();
        }
        self._testOnlyPollCallback && self._testOnlyPollCallback();

        // Save the list of pending writes which this round will commit.
        var writesForCycle = self._pendingWrites;
        self._pendingWrites = [];

        // Get the new query results. (This yields.)
        try {
          newResults = await self._cursor.getRawObjects(self._ordered);
        } catch (e) {
          if (first && typeof e.code === 'number') {
            // This is an error document sent to us by mongod, not a connection
            // error generated by the client. And we've never seen this query work
            // successfully. Probably it's a bad selector or something, so we should
            // NOT retry. Instead, we should halt the observe (which ends up calling
            // `stop` on us).
            await self._multiplexer.queryError(new Error("Exception while polling query " + JSON.stringify(self._cursorDescription) + ": " + e.message));
          }

          // getRawObjects can throw if we're having trouble talking to the
          // database.  That's fine --- we will repoll later anyway. But we should
          // make sure not to lose track of this cycle's writes.
          // (It also can throw if there's just something invalid about this query;
          // unfortunately the ObserveDriver API doesn't provide a good way to
          // "cancel" the observe from the inside in this case.
          Array.prototype.push.apply(self._pendingWrites, writesForCycle);
          Meteor._debug("Exception while polling query " + JSON.stringify(self._cursorDescription), e);
          return;
        }

        // Run diffs.
        if (!self._stopped) {
          LocalCollection._diffQueryChanges(self._ordered, oldResults, newResults, self._multiplexer);
        }

        // Signals the multiplexer to allow all observeChanges calls that share this
        // multiplexer to return. (This happens asynchronously, via the
        // multiplexer's queue.)
        if (first) self._multiplexer.ready();

        // Replace self._results atomically.  (This assignment is what makes `first`
        // stay through on the next cycle, so we've waited until after we've
        // committed to ready-ing the multiplexer.)
        self._results = newResults;

        // Once the ObserveMultiplexer has processed everything we've done in this
        // round, mark all the writes which existed before this call as
        // commmitted. (If new writes have shown up in the meantime, there'll
        // already be another _pollMongo task scheduled.)
        await self._multiplexer.onFlush(async function () {
          for (const w of writesForCycle) {
            await w.committed();
          }
        });
      },
      stop: function () {
        var self = this;
        self._stopped = true;
        const stopCallbacksCaller = async function (c) {
          await c();
        };
        self._stopCallbacks.forEach(stopCallbacksCaller);
        // Release any write fences that are waiting on us.
        self._pendingWrites.forEach(async function (w) {
          await w.committed();
        });
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-drivers-polling", -1);
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

},"oplog_observe_driver.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/oplog_observe_driver.js                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _asyncIterator;
    module.link("@babel/runtime/helpers/asyncIterator", {
      default(v) {
        _asyncIterator = v;
      }
    }, 0);
    let has;
    module.link("lodash.has", {
      default(v) {
        has = v;
      }
    }, 0);
    let isEmpty;
    module.link("lodash.isempty", {
      default(v) {
        isEmpty = v;
      }
    }, 1);
    let oplogV2V1Converter;
    module.link("./oplog_v2_converter", {
      oplogV2V1Converter(v) {
        oplogV2V1Converter = v;
      }
    }, 2);
    let check, Match;
    module.link("meteor/check", {
      check(v) {
        check = v;
      },
      Match(v) {
        Match = v;
      }
    }, 3);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    var PHASE = {
      QUERYING: "QUERYING",
      FETCHING: "FETCHING",
      STEADY: "STEADY"
    };

    // Exception thrown by _needToPollQuery which unrolls the stack up to the
    // enclosing call to finishIfNeedToPollQuery.
    var SwitchedToQuery = function () {};
    var finishIfNeedToPollQuery = function (f) {
      return function () {
        try {
          f.apply(this, arguments);
        } catch (e) {
          if (!(e instanceof SwitchedToQuery)) throw e;
        }
      };
    };
    var currentId = 0;

    // OplogObserveDriver is an alternative to PollingObserveDriver which follows
    // the Mongo operation log instead of just re-polling the query. It obeys the
    // same simple interface: constructing it starts sending observeChanges
    // callbacks (and a ready() invocation) to the ObserveMultiplexer, and you stop
    // it by calling the stop() method.
    OplogObserveDriver = function (options) {
      const self = this;
      self._usesOplog = true; // tests look at this

      self._id = currentId;
      currentId++;
      self._cursorDescription = options.cursorDescription;
      self._mongoHandle = options.mongoHandle;
      self._multiplexer = options.multiplexer;
      if (options.ordered) {
        throw Error("OplogObserveDriver only supports unordered observeChanges");
      }
      const sorter = options.sorter;
      // We don't support $near and other geo-queries so it's OK to initialize the
      // comparator only once in the constructor.
      const comparator = sorter && sorter.getComparator();
      if (options.cursorDescription.options.limit) {
        // There are several properties ordered driver implements:
        // - _limit is a positive number
        // - _comparator is a function-comparator by which the query is ordered
        // - _unpublishedBuffer is non-null Min/Max Heap,
        //                      the empty buffer in STEADY phase implies that the
        //                      everything that matches the queries selector fits
        //                      into published set.
        // - _published - Max Heap (also implements IdMap methods)

        const heapOptions = {
          IdMap: LocalCollection._IdMap
        };
        self._limit = self._cursorDescription.options.limit;
        self._comparator = comparator;
        self._sorter = sorter;
        self._unpublishedBuffer = new MinMaxHeap(comparator, heapOptions);
        // We need something that can find Max value in addition to IdMap interface
        self._published = new MaxHeap(comparator, heapOptions);
      } else {
        self._limit = 0;
        self._comparator = null;
        self._sorter = null;
        self._unpublishedBuffer = null;
        self._published = new LocalCollection._IdMap();
      }

      // Indicates if it is safe to insert a new document at the end of the buffer
      // for this query. i.e. it is known that there are no documents matching the
      // selector those are not in published or buffer.
      self._safeAppendToBuffer = false;
      self._stopped = false;
      self._stopHandles = [];
      self._addStopHandles = function (newStopHandles) {
        const expectedPattern = Match.ObjectIncluding({
          stop: Function
        });
        // Single item or array
        check(newStopHandles, Match.OneOf([expectedPattern], expectedPattern));
        self._stopHandles.push(newStopHandles);
      };
      Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-drivers-oplog", 1);
      self._registerPhaseChange(PHASE.QUERYING);
      self._matcher = options.matcher;
      // we are now using projection, not fields in the cursor description even if you pass {fields}
      // in the cursor construction
      const projection = self._cursorDescription.options.fields || self._cursorDescription.options.projection || {};
      self._projectionFn = LocalCollection._compileProjection(projection);
      // Projection function, result of combining important fields for selector and
      // existing fields projection
      self._sharedProjection = self._matcher.combineIntoProjection(projection);
      if (sorter) self._sharedProjection = sorter.combineIntoProjection(self._sharedProjection);
      self._sharedProjectionFn = LocalCollection._compileProjection(self._sharedProjection);
      self._needToFetch = new LocalCollection._IdMap();
      self._currentlyFetching = null;
      self._fetchGeneration = 0;
      self._requeryWhenDoneThisQuery = false;
      self._writesToCommitWhenWeReachSteady = [];
    };
    _.extend(OplogObserveDriver.prototype, {
      _init: async function () {
        const self = this;

        // If the oplog handle tells us that it skipped some entries (because it got
        // behind, say), re-poll.
        self._addStopHandles(self._mongoHandle._oplogHandle.onSkippedEntries(finishIfNeedToPollQuery(function () {
          return self._needToPollQuery();
        })));
        await forEachTrigger(self._cursorDescription, async function (trigger) {
          self._addStopHandles(await self._mongoHandle._oplogHandle.onOplogEntry(trigger, function (notification) {
            finishIfNeedToPollQuery(function () {
              const op = notification.op;
              if (notification.dropCollection || notification.dropDatabase) {
                // Note: this call is not allowed to block on anything (especially
                // on waiting for oplog entries to catch up) because that will block
                // onOplogEntry!
                return self._needToPollQuery();
              } else {
                // All other operators should be handled depending on phase
                if (self._phase === PHASE.QUERYING) {
                  return self._handleOplogEntryQuerying(op);
                } else {
                  return self._handleOplogEntrySteadyOrFetching(op);
                }
              }
            })();
          }));
        });

        // XXX ordering w.r.t. everything else?
        self._addStopHandles(await listenAll(self._cursorDescription, function () {
          // If we're not in a pre-fire write fence, we don't have to do anything.
          const fence = DDPServer._getCurrentFence();
          if (!fence || fence.fired) return;
          if (fence._oplogObserveDrivers) {
            fence._oplogObserveDrivers[self._id] = self;
            return;
          }
          fence._oplogObserveDrivers = {};
          fence._oplogObserveDrivers[self._id] = self;
          fence.onBeforeFire(async function () {
            const drivers = fence._oplogObserveDrivers;
            delete fence._oplogObserveDrivers;

            // This fence cannot fire until we've caught up to "this point" in the
            // oplog, and all observers made it back to the steady state.
            await self._mongoHandle._oplogHandle.waitUntilCaughtUp();
            for (const driver of Object.values(drivers)) {
              if (driver._stopped) continue;
              const write = await fence.beginWrite();
              if (driver._phase === PHASE.STEADY) {
                // Make sure that all of the callbacks have made it through the
                // multiplexer and been delivered to ObserveHandles before committing
                // writes.
                await driver._multiplexer.onFlush(write.committed);
              } else {
                driver._writesToCommitWhenWeReachSteady.push(write);
              }
            }
          });
        }));

        // When Mongo fails over, we need to repoll the query, in case we processed an
        // oplog entry that got rolled back.
        self._addStopHandles(self._mongoHandle._onFailover(finishIfNeedToPollQuery(function () {
          return self._needToPollQuery();
        })));

        // Give _observeChanges a chance to add the new ObserveHandle to our
        // multiplexer, so that the added calls get streamed.
        return self._runInitialQuery();
      },
      _addPublished: function (id, doc) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          var fields = Object.assign({}, doc);
          delete fields._id;
          self._published.set(id, self._sharedProjectionFn(doc));
          self._multiplexer.added(id, self._projectionFn(fields));

          // After adding this document, the published set might be overflowed
          // (exceeding capacity specified by limit). If so, push the maximum
          // element to the buffer, we might want to save it in memory to reduce the
          // amount of Mongo lookups in the future.
          if (self._limit && self._published.size() > self._limit) {
            // XXX in theory the size of published is no more than limit+1
            if (self._published.size() !== self._limit + 1) {
              throw new Error("After adding to published, " + (self._published.size() - self._limit) + " documents are overflowing the set");
            }
            var overflowingDocId = self._published.maxElementId();
            var overflowingDoc = self._published.get(overflowingDocId);
            if (EJSON.equals(overflowingDocId, id)) {
              throw new Error("The document just added is overflowing the published set");
            }
            self._published.remove(overflowingDocId);
            self._multiplexer.removed(overflowingDocId);
            self._addBuffered(overflowingDocId, overflowingDoc);
          }
        });
      },
      _removePublished: function (id) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._published.remove(id);
          self._multiplexer.removed(id);
          if (!self._limit || self._published.size() === self._limit) return;
          if (self._published.size() > self._limit) throw Error("self._published got too big");

          // OK, we are publishing less than the limit. Maybe we should look in the
          // buffer to find the next element past what we were publishing before.

          if (!self._unpublishedBuffer.empty()) {
            // There's something in the buffer; move the first thing in it to
            // _published.
            var newDocId = self._unpublishedBuffer.minElementId();
            var newDoc = self._unpublishedBuffer.get(newDocId);
            self._removeBuffered(newDocId);
            self._addPublished(newDocId, newDoc);
            return;
          }

          // There's nothing in the buffer.  This could mean one of a few things.

          // (a) We could be in the middle of re-running the query (specifically, we
          // could be in _publishNewResults). In that case, _unpublishedBuffer is
          // empty because we clear it at the beginning of _publishNewResults. In
          // this case, our caller already knows the entire answer to the query and
          // we don't need to do anything fancy here.  Just return.
          if (self._phase === PHASE.QUERYING) return;

          // (b) We're pretty confident that the union of _published and
          // _unpublishedBuffer contain all documents that match selector. Because
          // _unpublishedBuffer is empty, that means we're confident that _published
          // contains all documents that match selector. So we have nothing to do.
          if (self._safeAppendToBuffer) return;

          // (c) Maybe there are other documents out there that should be in our
          // buffer. But in that case, when we emptied _unpublishedBuffer in
          // _removeBuffered, we should have called _needToPollQuery, which will
          // either put something in _unpublishedBuffer or set _safeAppendToBuffer
          // (or both), and it will put us in QUERYING for that whole time. So in
          // fact, we shouldn't be able to get here.

          throw new Error("Buffer inexplicably empty");
        });
      },
      _changePublished: function (id, oldDoc, newDoc) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._published.set(id, self._sharedProjectionFn(newDoc));
          var projectedNew = self._projectionFn(newDoc);
          var projectedOld = self._projectionFn(oldDoc);
          var changed = DiffSequence.makeChangedFields(projectedNew, projectedOld);
          if (!isEmpty(changed)) self._multiplexer.changed(id, changed);
        });
      },
      _addBuffered: function (id, doc) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._unpublishedBuffer.set(id, self._sharedProjectionFn(doc));

          // If something is overflowing the buffer, we just remove it from cache
          if (self._unpublishedBuffer.size() > self._limit) {
            var maxBufferedId = self._unpublishedBuffer.maxElementId();
            self._unpublishedBuffer.remove(maxBufferedId);

            // Since something matching is removed from cache (both published set and
            // buffer), set flag to false
            self._safeAppendToBuffer = false;
          }
        });
      },
      // Is called either to remove the doc completely from matching set or to move
      // it to the published set later.
      _removeBuffered: function (id) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._unpublishedBuffer.remove(id);
          // To keep the contract "buffer is never empty in STEADY phase unless the
          // everything matching fits into published" true, we poll everything as
          // soon as we see the buffer becoming empty.
          if (!self._unpublishedBuffer.size() && !self._safeAppendToBuffer) self._needToPollQuery();
        });
      },
      // Called when a document has joined the "Matching" results set.
      // Takes responsibility of keeping _unpublishedBuffer in sync with _published
      // and the effect of limit enforced.
      _addMatching: function (doc) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          var id = doc._id;
          if (self._published.has(id)) throw Error("tried to add something already published " + id);
          if (self._limit && self._unpublishedBuffer.has(id)) throw Error("tried to add something already existed in buffer " + id);
          var limit = self._limit;
          var comparator = self._comparator;
          var maxPublished = limit && self._published.size() > 0 ? self._published.get(self._published.maxElementId()) : null;
          var maxBuffered = limit && self._unpublishedBuffer.size() > 0 ? self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId()) : null;
          // The query is unlimited or didn't publish enough documents yet or the
          // new document would fit into published set pushing the maximum element
          // out, then we need to publish the doc.
          var toPublish = !limit || self._published.size() < limit || comparator(doc, maxPublished) < 0;

          // Otherwise we might need to buffer it (only in case of limited query).
          // Buffering is allowed if the buffer is not filled up yet and all
          // matching docs are either in the published set or in the buffer.
          var canAppendToBuffer = !toPublish && self._safeAppendToBuffer && self._unpublishedBuffer.size() < limit;

          // Or if it is small enough to be safely inserted to the middle or the
          // beginning of the buffer.
          var canInsertIntoBuffer = !toPublish && maxBuffered && comparator(doc, maxBuffered) <= 0;
          var toBuffer = canAppendToBuffer || canInsertIntoBuffer;
          if (toPublish) {
            self._addPublished(id, doc);
          } else if (toBuffer) {
            self._addBuffered(id, doc);
          } else {
            // dropping it and not saving to the cache
            self._safeAppendToBuffer = false;
          }
        });
      },
      // Called when a document leaves the "Matching" results set.
      // Takes responsibility of keeping _unpublishedBuffer in sync with _published
      // and the effect of limit enforced.
      _removeMatching: function (id) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          if (!self._published.has(id) && !self._limit) throw Error("tried to remove something matching but not cached " + id);
          if (self._published.has(id)) {
            self._removePublished(id);
          } else if (self._unpublishedBuffer.has(id)) {
            self._removeBuffered(id);
          }
        });
      },
      _handleDoc: function (id, newDoc) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          var matchesNow = newDoc && self._matcher.documentMatches(newDoc).result;
          var publishedBefore = self._published.has(id);
          var bufferedBefore = self._limit && self._unpublishedBuffer.has(id);
          var cachedBefore = publishedBefore || bufferedBefore;
          if (matchesNow && !cachedBefore) {
            self._addMatching(newDoc);
          } else if (cachedBefore && !matchesNow) {
            self._removeMatching(id);
          } else if (cachedBefore && matchesNow) {
            var oldDoc = self._published.get(id);
            var comparator = self._comparator;
            var minBuffered = self._limit && self._unpublishedBuffer.size() && self._unpublishedBuffer.get(self._unpublishedBuffer.minElementId());
            var maxBuffered;
            if (publishedBefore) {
              // Unlimited case where the document stays in published once it
              // matches or the case when we don't have enough matching docs to
              // publish or the changed but matching doc will stay in published
              // anyways.
              //
              // XXX: We rely on the emptiness of buffer. Be sure to maintain the
              // fact that buffer can't be empty if there are matching documents not
              // published. Notably, we don't want to schedule repoll and continue
              // relying on this property.
              var staysInPublished = !self._limit || self._unpublishedBuffer.size() === 0 || comparator(newDoc, minBuffered) <= 0;
              if (staysInPublished) {
                self._changePublished(id, oldDoc, newDoc);
              } else {
                // after the change doc doesn't stay in the published, remove it
                self._removePublished(id);
                // but it can move into buffered now, check it
                maxBuffered = self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId());
                var toBuffer = self._safeAppendToBuffer || maxBuffered && comparator(newDoc, maxBuffered) <= 0;
                if (toBuffer) {
                  self._addBuffered(id, newDoc);
                } else {
                  // Throw away from both published set and buffer
                  self._safeAppendToBuffer = false;
                }
              }
            } else if (bufferedBefore) {
              oldDoc = self._unpublishedBuffer.get(id);
              // remove the old version manually instead of using _removeBuffered so
              // we don't trigger the querying immediately.  if we end this block
              // with the buffer empty, we will need to trigger the query poll
              // manually too.
              self._unpublishedBuffer.remove(id);
              var maxPublished = self._published.get(self._published.maxElementId());
              maxBuffered = self._unpublishedBuffer.size() && self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId());

              // the buffered doc was updated, it could move to published
              var toPublish = comparator(newDoc, maxPublished) < 0;

              // or stays in buffer even after the change
              var staysInBuffer = !toPublish && self._safeAppendToBuffer || !toPublish && maxBuffered && comparator(newDoc, maxBuffered) <= 0;
              if (toPublish) {
                self._addPublished(id, newDoc);
              } else if (staysInBuffer) {
                // stays in buffer but changes
                self._unpublishedBuffer.set(id, newDoc);
              } else {
                // Throw away from both published set and buffer
                self._safeAppendToBuffer = false;
                // Normally this check would have been done in _removeBuffered but
                // we didn't use it, so we need to do it ourself now.
                if (!self._unpublishedBuffer.size()) {
                  self._needToPollQuery();
                }
              }
            } else {
              throw new Error("cachedBefore implies either of publishedBefore or bufferedBefore is true.");
            }
          }
        });
      },
      _fetchModifiedDocuments: function () {
        var self = this;
        self._registerPhaseChange(PHASE.FETCHING);
        // Defer, because nothing called from the oplog entry handler may yield,
        // but fetch() yields.
        Meteor.defer(finishIfNeedToPollQuery(async function () {
          while (!self._stopped && !self._needToFetch.empty()) {
            if (self._phase === PHASE.QUERYING) {
              // While fetching, we decided to go into QUERYING mode, and then we
              // saw another oplog entry, so _needToFetch is not empty. But we
              // shouldn't fetch these documents until AFTER the query is done.
              break;
            }

            // Being in steady phase here would be surprising.
            if (self._phase !== PHASE.FETCHING) throw new Error("phase in fetchModifiedDocuments: " + self._phase);
            self._currentlyFetching = self._needToFetch;
            var thisGeneration = ++self._fetchGeneration;
            self._needToFetch = new LocalCollection._IdMap();
            var waiting = 0;
            let promiseResolver = null;
            const awaitablePromise = new Promise(r => promiseResolver = r);
            // This loop is safe, because _currentlyFetching will not be updated
            // during this loop (in fact, it is never mutated).
            await self._currentlyFetching.forEachAsync(async function (op, id) {
              waiting++;
              await self._mongoHandle._docFetcher.fetch(self._cursorDescription.collectionName, id, op, finishIfNeedToPollQuery(function (err, doc) {
                if (err) {
                  Meteor._debug('Got exception while fetching documents', err);
                  // If we get an error from the fetcher (eg, trouble
                  // connecting to Mongo), let's just abandon the fetch phase
                  // altogether and fall back to polling. It's not like we're
                  // getting live updates anyway.
                  if (self._phase !== PHASE.QUERYING) {
                    self._needToPollQuery();
                  }
                  waiting--;
                  // Because fetch() never calls its callback synchronously,
                  // this is safe (ie, we won't call fut.return() before the
                  // forEach is done).
                  if (waiting === 0) promiseResolver();
                  return;
                }
                try {
                  if (!self._stopped && self._phase === PHASE.FETCHING && self._fetchGeneration === thisGeneration) {
                    // We re-check the generation in case we've had an explicit
                    // _pollQuery call (eg, in another fiber) which should
                    // effectively cancel this round of fetches.  (_pollQuery
                    // increments the generation.)

                    self._handleDoc(id, doc);
                  }
                } finally {
                  waiting--;
                  // Because fetch() never calls its callback synchronously,
                  // this is safe (ie, we won't call fut.return() before the
                  // forEach is done).
                  if (waiting === 0) promiseResolver();
                }
              }));
            });
            await awaitablePromise;
            // Exit now if we've had a _pollQuery call (here or in another fiber).
            if (self._phase === PHASE.QUERYING) return;
            self._currentlyFetching = null;
          }
          // We're done fetching, so we can be steady, unless we've had a
          // _pollQuery call (here or in another fiber).
          if (self._phase !== PHASE.QUERYING) await self._beSteady();
        }));
      },
      _beSteady: async function () {
        var self = this;
        self._registerPhaseChange(PHASE.STEADY);
        var writes = self._writesToCommitWhenWeReachSteady || [];
        self._writesToCommitWhenWeReachSteady = [];
        await self._multiplexer.onFlush(async function () {
          try {
            for (const w of writes) {
              await w.committed();
            }
          } catch (e) {
            console.error("_beSteady error", {
              writes
            }, e);
          }
        });
      },
      _handleOplogEntryQuerying: function (op) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._needToFetch.set(idForOp(op), op);
        });
      },
      _handleOplogEntrySteadyOrFetching: function (op) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          var id = idForOp(op);
          // If we're already fetching this one, or about to, we can't optimize;
          // make sure that we fetch it again if necessary.

          if (self._phase === PHASE.FETCHING && (self._currentlyFetching && self._currentlyFetching.has(id) || self._needToFetch.has(id))) {
            self._needToFetch.set(id, op);
            return;
          }
          if (op.op === 'd') {
            if (self._published.has(id) || self._limit && self._unpublishedBuffer.has(id)) self._removeMatching(id);
          } else if (op.op === 'i') {
            if (self._published.has(id)) throw new Error("insert found for already-existing ID in published");
            if (self._unpublishedBuffer && self._unpublishedBuffer.has(id)) throw new Error("insert found for already-existing ID in buffer");

            // XXX what if selector yields?  for now it can't but later it could
            // have $where
            if (self._matcher.documentMatches(op.o).result) self._addMatching(op.o);
          } else if (op.op === 'u') {
            // we are mapping the new oplog format on mongo 5
            // to what we know better, $set
            op.o = oplogV2V1Converter(op.o);
            // Is this a modifier ($set/$unset, which may require us to poll the
            // database to figure out if the whole document matches the selector) or
            // a replacement (in which case we can just directly re-evaluate the
            // selector)?
            // oplog format has changed on mongodb 5, we have to support both now
            // diff is the format in Mongo 5+ (oplog v2)
            var isReplace = !has(op.o, '$set') && !has(op.o, 'diff') && !has(op.o, '$unset');
            // If this modifier modifies something inside an EJSON custom type (ie,
            // anything with EJSON$), then we can't try to use
            // LocalCollection._modify, since that just mutates the EJSON encoding,
            // not the actual object.
            var canDirectlyModifyDoc = !isReplace && modifierCanBeDirectlyApplied(op.o);
            var publishedBefore = self._published.has(id);
            var bufferedBefore = self._limit && self._unpublishedBuffer.has(id);
            if (isReplace) {
              self._handleDoc(id, Object.assign({
                _id: id
              }, op.o));
            } else if ((publishedBefore || bufferedBefore) && canDirectlyModifyDoc) {
              // Oh great, we actually know what the document is, so we can apply
              // this directly.
              var newDoc = self._published.has(id) ? self._published.get(id) : self._unpublishedBuffer.get(id);
              newDoc = EJSON.clone(newDoc);
              newDoc._id = id;
              try {
                LocalCollection._modify(newDoc, op.o);
              } catch (e) {
                if (e.name !== "MinimongoError") throw e;
                // We didn't understand the modifier.  Re-fetch.
                self._needToFetch.set(id, op);
                if (self._phase === PHASE.STEADY) {
                  self._fetchModifiedDocuments();
                }
                return;
              }
              self._handleDoc(id, self._sharedProjectionFn(newDoc));
            } else if (!canDirectlyModifyDoc || self._matcher.canBecomeTrueByModifier(op.o) || self._sorter && self._sorter.affectedByModifier(op.o)) {
              self._needToFetch.set(id, op);
              if (self._phase === PHASE.STEADY) self._fetchModifiedDocuments();
            }
          } else {
            throw Error("XXX SURPRISING OPERATION: " + op);
          }
        });
      },
      async _runInitialQueryAsync() {
        var self = this;
        if (self._stopped) throw new Error("oplog stopped surprisingly early");
        await self._runQuery({
          initial: true
        }); // yields

        if (self._stopped) return; // can happen on queryError

        // Allow observeChanges calls to return. (After this, it's possible for
        // stop() to be called.)
        await self._multiplexer.ready();
        await self._doneQuerying(); // yields
      },
      // Yields!
      _runInitialQuery: function () {
        return this._runInitialQueryAsync();
      },
      // In various circumstances, we may just want to stop processing the oplog and
      // re-run the initial query, just as if we were a PollingObserveDriver.
      //
      // This function may not block, because it is called from an oplog entry
      // handler.
      //
      // XXX We should call this when we detect that we've been in FETCHING for "too
      // long".
      //
      // XXX We should call this when we detect Mongo failover (since that might
      // mean that some of the oplog entries we have processed have been rolled
      // back). The Node Mongo driver is in the middle of a bunch of huge
      // refactorings, including the way that it notifies you when primary
      // changes. Will put off implementing this until driver 1.4 is out.
      _pollQuery: function () {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          if (self._stopped) return;

          // Yay, we get to forget about all the things we thought we had to fetch.
          self._needToFetch = new LocalCollection._IdMap();
          self._currentlyFetching = null;
          ++self._fetchGeneration; // ignore any in-flight fetches
          self._registerPhaseChange(PHASE.QUERYING);

          // Defer so that we don't yield.  We don't need finishIfNeedToPollQuery
          // here because SwitchedToQuery is not thrown in QUERYING mode.
          Meteor.defer(async function () {
            await self._runQuery();
            await self._doneQuerying();
          });
        });
      },
      // Yields!
      async _runQueryAsync(options) {
        var self = this;
        options = options || {};
        var newResults, newBuffer;

        // This while loop is just to retry failures.
        while (true) {
          // If we've been stopped, we don't have to run anything any more.
          if (self._stopped) return;
          newResults = new LocalCollection._IdMap();
          newBuffer = new LocalCollection._IdMap();

          // Query 2x documents as the half excluded from the original query will go
          // into unpublished buffer to reduce additional Mongo lookups in cases
          // when documents are removed from the published set and need a
          // replacement.
          // XXX needs more thought on non-zero skip
          // XXX 2 is a "magic number" meaning there is an extra chunk of docs for
          // buffer if such is needed.
          var cursor = self._cursorForQuery({
            limit: self._limit * 2
          });
          try {
            await cursor.forEach(function (doc, i) {
              // yields
              if (!self._limit || i < self._limit) {
                newResults.set(doc._id, doc);
              } else {
                newBuffer.set(doc._id, doc);
              }
            });
            break;
          } catch (e) {
            if (options.initial && typeof e.code === 'number') {
              // This is an error document sent to us by mongod, not a connection
              // error generated by the client. And we've never seen this query work
              // successfully. Probably it's a bad selector or something, so we
              // should NOT retry. Instead, we should halt the observe (which ends
              // up calling `stop` on us).
              await self._multiplexer.queryError(e);
              return;
            }

            // During failover (eg) if we get an exception we should log and retry
            // instead of crashing.
            Meteor._debug("Got exception while polling query", e);
            await Meteor._sleepForMs(100);
          }
        }
        if (self._stopped) return;
        self._publishNewResults(newResults, newBuffer);
      },
      // Yields!
      _runQuery: function (options) {
        return this._runQueryAsync(options);
      },
      // Transitions to QUERYING and runs another query, or (if already in QUERYING)
      // ensures that we will query again later.
      //
      // This function may not block, because it is called from an oplog entry
      // handler. However, if we were not already in the QUERYING phase, it throws
      // an exception that is caught by the closest surrounding
      // finishIfNeedToPollQuery call; this ensures that we don't continue running
      // close that was designed for another phase inside PHASE.QUERYING.
      //
      // (It's also necessary whenever logic in this file yields to check that other
      // phases haven't put us into QUERYING mode, though; eg,
      // _fetchModifiedDocuments does this.)
      _needToPollQuery: function () {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          if (self._stopped) return;

          // If we're not already in the middle of a query, we can query now
          // (possibly pausing FETCHING).
          if (self._phase !== PHASE.QUERYING) {
            self._pollQuery();
            throw new SwitchedToQuery();
          }

          // We're currently in QUERYING. Set a flag to ensure that we run another
          // query when we're done.
          self._requeryWhenDoneThisQuery = true;
        });
      },
      // Yields!
      _doneQuerying: async function () {
        var self = this;
        if (self._stopped) return;
        await self._mongoHandle._oplogHandle.waitUntilCaughtUp();
        if (self._stopped) return;
        if (self._phase !== PHASE.QUERYING) throw Error("Phase unexpectedly " + self._phase);
        if (self._requeryWhenDoneThisQuery) {
          self._requeryWhenDoneThisQuery = false;
          self._pollQuery();
        } else if (self._needToFetch.empty()) {
          await self._beSteady();
        } else {
          self._fetchModifiedDocuments();
        }
      },
      _cursorForQuery: function (optionsOverwrite) {
        var self = this;
        return Meteor._noYieldsAllowed(function () {
          // The query we run is almost the same as the cursor we are observing,
          // with a few changes. We need to read all the fields that are relevant to
          // the selector, not just the fields we are going to publish (that's the
          // "shared" projection). And we don't want to apply any transform in the
          // cursor, because observeChanges shouldn't use the transform.
          var options = Object.assign({}, self._cursorDescription.options);

          // Allow the caller to modify the options. Useful to specify different
          // skip and limit values.
          Object.assign(options, optionsOverwrite);
          options.fields = self._sharedProjection;
          delete options.transform;
          // We are NOT deep cloning fields or selector here, which should be OK.
          var description = new CursorDescription(self._cursorDescription.collectionName, self._cursorDescription.selector, options);
          return new Cursor(self._mongoHandle, description);
        });
      },
      // Replace self._published with newResults (both are IdMaps), invoking observe
      // callbacks on the multiplexer.
      // Replace self._unpublishedBuffer with newBuffer.
      //
      // XXX This is very similar to LocalCollection._diffQueryUnorderedChanges. We
      // should really: (a) Unify IdMap and OrderedDict into Unordered/OrderedDict
      // (b) Rewrite diff.js to use these classes instead of arrays and objects.
      _publishNewResults: function (newResults, newBuffer) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          // If the query is limited and there is a buffer, shut down so it doesn't
          // stay in a way.
          if (self._limit) {
            self._unpublishedBuffer.clear();
          }

          // First remove anything that's gone. Be careful not to modify
          // self._published while iterating over it.
          var idsToRemove = [];
          self._published.forEach(function (doc, id) {
            if (!newResults.has(id)) idsToRemove.push(id);
          });
          idsToRemove.forEach(function (id) {
            self._removePublished(id);
          });

          // Now do adds and changes.
          // If self has a buffer and limit, the new fetched result will be
          // limited correctly as the query has sort specifier.
          newResults.forEach(function (doc, id) {
            self._handleDoc(id, doc);
          });

          // Sanity-check that everything we tried to put into _published ended up
          // there.
          // XXX if this is slow, remove it later
          if (self._published.size() !== newResults.size()) {
            Meteor._debug('The Mongo server and the Meteor query disagree on how ' + 'many documents match your query. Cursor description: ', self._cursorDescription);
          }
          self._published.forEach(function (doc, id) {
            if (!newResults.has(id)) throw Error("_published has a doc that newResults doesn't; " + id);
          });

          // Finally, replace the buffer
          newBuffer.forEach(function (doc, id) {
            self._addBuffered(id, doc);
          });
          self._safeAppendToBuffer = newBuffer.size() < self._limit;
        });
      },
      // This stop function is invoked from the onStop of the ObserveMultiplexer, so
      // it shouldn't actually be possible to call it until the multiplexer is
      // ready.
      //
      // It's important to check self._stopped after every call in this file that
      // can yield!
      _stop: async function () {
        var self = this;
        if (self._stopped) return;
        self._stopped = true;

        // Note: we *don't* use multiplexer.onFlush here because this stop
        // callback is actually invoked by the multiplexer itself when it has
        // determined that there are no handles left. So nothing is actually going
        // to get flushed (and it's probably not valid to call methods on the
        // dying multiplexer).
        for (const w of self._writesToCommitWhenWeReachSteady) {
          await w.committed();
        }
        self._writesToCommitWhenWeReachSteady = null;

        // Proactively drop references to potentially big things.
        self._published = null;
        self._unpublishedBuffer = null;
        self._needToFetch = null;
        self._currentlyFetching = null;
        self._oplogEntryHandle = null;
        self._listenersHandle = null;
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-drivers-oplog", -1);
        var _iteratorAbruptCompletion = false;
        var _didIteratorError = false;
        var _iteratorError;
        try {
          for (var _iterator = _asyncIterator(self._stopHandles), _step; _iteratorAbruptCompletion = !(_step = await _iterator.next()).done; _iteratorAbruptCompletion = false) {
            const handle = _step.value;
            {
              await handle.stop();
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (_iteratorAbruptCompletion && _iterator.return != null) {
              await _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      },
      stop: async function () {
        const self = this;
        return await self._stop();
      },
      _registerPhaseChange: function (phase) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          var now = new Date();
          if (self._phase) {
            var timeDiff = now - self._phaseStartTime;
            Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "time-spent-in-" + self._phase + "-phase", timeDiff);
          }
          self._phase = phase;
          self._phaseStartTime = now;
        });
      }
    });

    // Does our oplog tailing code support this cursor? For now, we are being very
    // conservative and allowing only simple queries with simple options.
    // (This is a "static method".)
    OplogObserveDriver.cursorSupported = function (cursorDescription, matcher) {
      // First, check the options.
      var options = cursorDescription.options;

      // Did the user say no explicitly?
      // underscored version of the option is COMPAT with 1.2
      if (options.disableOplog || options._disableOplog) return false;

      // skip is not supported: to support it we would need to keep track of all
      // "skipped" documents or at least their ids.
      // limit w/o a sort specifier is not supported: current implementation needs a
      // deterministic way to order documents.
      if (options.skip || options.limit && !options.sort) return false;

      // If a fields projection option is given check if it is supported by
      // minimongo (some operators are not supported).
      const fields = options.fields || options.projection;
      if (fields) {
        try {
          LocalCollection._checkSupportedProjection(fields);
        } catch (e) {
          if (e.name === "MinimongoError") {
            return false;
          } else {
            throw e;
          }
        }
      }

      // We don't allow the following selectors:
      //   - $where (not confident that we provide the same JS environment
      //             as Mongo, and can yield!)
      //   - $near (has "interesting" properties in MongoDB, like the possibility
      //            of returning an ID multiple times, though even polling maybe
      //            have a bug there)
      //           XXX: once we support it, we would need to think more on how we
      //           initialize the comparators when we create the driver.
      return !matcher.hasWhere() && !matcher.hasGeoQuery();
    };
    var modifierCanBeDirectlyApplied = function (modifier) {
      return Object.entries(modifier).every(function (_ref) {
        let [operation, fields] = _ref;
        return Object.entries(fields).every(function (_ref2) {
          let [field, value] = _ref2;
          return !/EJSON\$/.test(field);
        });
      });
    };
    MongoInternals.OplogObserveDriver = OplogObserveDriver;
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

},"oplog_v2_converter.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/oplog_v2_converter.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  oplogV2V1Converter: () => oplogV2V1Converter
});
// Converter of the new MongoDB Oplog format (>=5.0) to the one that Meteor
// handles well, i.e., `$set` and `$unset`. The new format is completely new,
// and looks as follows:
//
//   { $v: 2, diff: Diff }
//
// where `Diff` is a recursive structure:
//
//   {
//     // Nested updates (sometimes also represented with an s-field).
//     // Example: `{ $set: { 'foo.bar': 1 } }`.
//     i: { <key>: <value>, ... },
//
//     // Top-level updates.
//     // Example: `{ $set: { foo: { bar: 1 } } }`.
//     u: { <key>: <value>, ... },
//
//     // Unsets.
//     // Example: `{ $unset: { foo: '' } }`.
//     d: { <key>: false, ... },
//
//     // Array operations.
//     // Example: `{ $push: { foo: 'bar' } }`.
//     s<key>: { a: true, u<index>: <value>, ... },
//     ...
//
//     // Nested operations (sometimes also represented in the `i` field).
//     // Example: `{ $set: { 'foo.bar': 1 } }`.
//     s<key>: Diff,
//     ...
//   }
//
// (all fields are optional).

function join(prefix, key) {
  return prefix ? "".concat(prefix, ".").concat(key) : key;
}
const arrayOperatorKeyRegex = /^(a|[su]\d+)$/;
function isArrayOperatorKey(field) {
  return arrayOperatorKeyRegex.test(field);
}
function isArrayOperator(operator) {
  return operator.a === true && Object.keys(operator).every(isArrayOperatorKey);
}
function flattenObjectInto(target, source, prefix) {
  if (Array.isArray(source) || typeof source !== 'object' || source === null || source instanceof Mongo.ObjectID) {
    target[prefix] = source;
  } else {
    const entries = Object.entries(source);
    if (entries.length) {
      entries.forEach(_ref => {
        let [key, value] = _ref;
        flattenObjectInto(target, value, join(prefix, key));
      });
    } else {
      target[prefix] = source;
    }
  }
}
const logDebugMessages = !!process.env.OPLOG_CONVERTER_DEBUG;
function convertOplogDiff(oplogEntry, diff, prefix) {
  if (logDebugMessages) {
    console.log("convertOplogDiff(".concat(JSON.stringify(oplogEntry), ", ").concat(JSON.stringify(diff), ", ").concat(JSON.stringify(prefix), ")"));
  }
  Object.entries(diff).forEach(_ref2 => {
    let [diffKey, value] = _ref2;
    if (diffKey === 'd') {
      var _oplogEntry$$unset;
      // Handle `$unset`s.
      (_oplogEntry$$unset = oplogEntry.$unset) !== null && _oplogEntry$$unset !== void 0 ? _oplogEntry$$unset : oplogEntry.$unset = {};
      Object.keys(value).forEach(key => {
        oplogEntry.$unset[join(prefix, key)] = true;
      });
    } else if (diffKey === 'i') {
      var _oplogEntry$$set;
      // Handle (potentially) nested `$set`s.
      (_oplogEntry$$set = oplogEntry.$set) !== null && _oplogEntry$$set !== void 0 ? _oplogEntry$$set : oplogEntry.$set = {};
      flattenObjectInto(oplogEntry.$set, value, prefix);
    } else if (diffKey === 'u') {
      var _oplogEntry$$set2;
      // Handle flat `$set`s.
      (_oplogEntry$$set2 = oplogEntry.$set) !== null && _oplogEntry$$set2 !== void 0 ? _oplogEntry$$set2 : oplogEntry.$set = {};
      Object.entries(value).forEach(_ref3 => {
        let [key, value] = _ref3;
        oplogEntry.$set[join(prefix, key)] = value;
      });
    } else {
      // Handle s-fields.
      const key = diffKey.slice(1);
      if (isArrayOperator(value)) {
        // Array operator.
        Object.entries(value).forEach(_ref4 => {
          let [position, value] = _ref4;
          if (position === 'a') {
            return;
          }
          const positionKey = join(join(prefix, key), position.slice(1));
          if (position[0] === 's') {
            convertOplogDiff(oplogEntry, value, positionKey);
          } else if (value === null) {
            var _oplogEntry$$unset2;
            (_oplogEntry$$unset2 = oplogEntry.$unset) !== null && _oplogEntry$$unset2 !== void 0 ? _oplogEntry$$unset2 : oplogEntry.$unset = {};
            oplogEntry.$unset[positionKey] = true;
          } else {
            var _oplogEntry$$set3;
            (_oplogEntry$$set3 = oplogEntry.$set) !== null && _oplogEntry$$set3 !== void 0 ? _oplogEntry$$set3 : oplogEntry.$set = {};
            oplogEntry.$set[positionKey] = value;
          }
        });
      } else if (key) {
        // Nested object.
        convertOplogDiff(oplogEntry, value, join(prefix, key));
      }
    }
  });
}
function oplogV2V1Converter(oplogEntry) {
  // Pass-through v1 and (probably) invalid entries.
  if (oplogEntry.$v !== 2 || !oplogEntry.diff) {
    return oplogEntry;
  }
  const convertedOplogEntry = {
    $v: 2
  };
  convertOplogDiff(convertedOplogEntry, oplogEntry.diff, '');
  return convertedOplogEntry;
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"local_collection_driver.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/local_collection_driver.js                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  LocalCollectionDriver: () => LocalCollectionDriver
});
const LocalCollectionDriver = new class LocalCollectionDriver {
  constructor() {
    this.noConnCollections = Object.create(null);
  }
  open(name, conn) {
    if (!name) {
      return new LocalCollection();
    }
    if (!conn) {
      return ensureCollection(name, this.noConnCollections);
    }
    if (!conn._mongo_livedata_collections) {
      conn._mongo_livedata_collections = Object.create(null);
    }

    // XXX is there a way to keep track of a connection's collections without
    // dangling it off the connection object?
    return ensureCollection(name, conn._mongo_livedata_collections);
  }
}();
function ensureCollection(name, collections) {
  return name in collections ? collections[name] : collections[name] = new LocalCollection(name);
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"remote_collection_driver.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/remote_collection_driver.js                                                                          //
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
    let ASYNC_COLLECTION_METHODS, getAsyncMethodName, CLIENT_ONLY_METHODS;
    module.link("meteor/minimongo/constants", {
      ASYNC_COLLECTION_METHODS(v) {
        ASYNC_COLLECTION_METHODS = v;
      },
      getAsyncMethodName(v) {
        getAsyncMethodName = v;
      },
      CLIENT_ONLY_METHODS(v) {
        CLIENT_ONLY_METHODS = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    MongoInternals.RemoteCollectionDriver = function (mongo_url, options) {
      var self = this;
      self.mongo = new MongoConnection(mongo_url, options);
    };
    const REMOTE_COLLECTION_METHODS = ['createCappedCollectionAsync', 'dropIndexAsync', 'ensureIndexAsync', 'createIndexAsync', 'countDocuments', 'dropCollectionAsync', 'estimatedDocumentCount', 'find', 'findOneAsync', 'insertAsync', 'rawCollection', 'removeAsync', 'updateAsync', 'upsertAsync'];
    Object.assign(MongoInternals.RemoteCollectionDriver.prototype, {
      open: function (name) {
        var self = this;
        var ret = {};
        REMOTE_COLLECTION_METHODS.forEach(function (m) {
          ret[m] = self.mongo[m].bind(self.mongo, name);
          if (!ASYNC_COLLECTION_METHODS.includes(m)) return;
          const asyncMethodName = getAsyncMethodName(m);
          ret[asyncMethodName] = function () {
            try {
              return Promise.resolve(ret[m](...arguments));
            } catch (error) {
              return Promise.reject(error);
            }
          };
        });
        CLIENT_ONLY_METHODS.forEach(function (m) {
          ret[m] = _.bind(self.mongo[m], self.mongo, name);
          ret[m] = function () {
            throw new Error("".concat(m, " +  is not available on the server. Please use ").concat(getAsyncMethodName(m), "() instead."));
          };
        });
        return ret;
      }
    });

    // Create the singleton RemoteCollectionDriver only on demand, so we
    // only require Mongo configuration if it's actually used (eg, not if
    // you're only trying to receive data from a remote DDP server.)
    MongoInternals.defaultRemoteCollectionDriver = once(function () {
      var connectionOptions = {};
      var mongoUrl = process.env.MONGO_URL;
      if (process.env.MONGO_OPLOG_URL) {
        connectionOptions.oplogUrl = process.env.MONGO_OPLOG_URL;
      }
      if (!mongoUrl) throw new Error("MONGO_URL must be set in environment");
      const driver = new MongoInternals.RemoteCollectionDriver(mongoUrl, connectionOptions);
      // As many deployment tools, including Meteor Up, send requests to the app in
      // order to confirm that the deployment finished successfully, it's required
      // to know about a database connection problem before the app starts. Doing so
      // in a `Meteor.startup` is fine, as the `WebApp` handles requests only after
      // all are finished.
      Meteor.startup(async () => {
        await driver.mongo.client.connect();
      });
      return driver;
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

},"collection.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/collection.js                                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module1, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectSpread;
    module1.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 0);
    let ASYNC_COLLECTION_METHODS, getAsyncMethodName;
    module1.link("meteor/minimongo/constants", {
      ASYNC_COLLECTION_METHODS(v) {
        ASYNC_COLLECTION_METHODS = v;
      },
      getAsyncMethodName(v) {
        getAsyncMethodName = v;
      }
    }, 0);
    let normalizeProjection;
    module1.link("./mongo_utils", {
      normalizeProjection(v) {
        normalizeProjection = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    /**
     * @summary Namespace for MongoDB-related items
     * @namespace
     */
    Mongo = {};

    /**
     * @summary Constructor for a Collection
     * @locus Anywhere
     * @instancename collection
     * @class
     * @param {String} name The name of the collection.  If null, creates an unmanaged (unsynchronized) local collection.
     * @param {Object} [options]
     * @param {Object} options.connection The server connection that will manage this collection. Uses the default connection if not specified.  Pass the return value of calling [`DDP.connect`](#DDP-connect) to specify a different server. Pass `null` to specify no connection. Unmanaged (`name` is null) collections cannot specify a connection.
     * @param {String} options.idGeneration The method of generating the `_id` fields of new documents in this collection.  Possible values:
    
     - **`'STRING'`**: random strings
     - **`'MONGO'`**:  random [`Mongo.ObjectID`](#mongo_object_id) values
    
    The default id generation technique is `'STRING'`.
     * @param {Function} options.transform An optional transformation function. Documents will be passed through this function before being returned from `fetch` or `findOneAsync`, and before being passed to callbacks of `observe`, `map`, `forEach`, `allow`, and `deny`. Transforms are *not* applied for the callbacks of `observeChanges` or to cursors returned from publish functions.
     * @param {Boolean} options.defineMutationMethods Set to `false` to skip setting up the mutation methods that enable insert/update/remove from client code. Default `true`.
     */
    Mongo.Collection = function Collection(name, options) {
      if (!name && name !== null) {
        Meteor._debug('Warning: creating anonymous collection. It will not be ' + 'saved or synchronized over the network. (Pass null for ' + 'the collection name to turn off this warning.)');
        name = null;
      }
      if (name !== null && typeof name !== 'string') {
        throw new Error('First argument to new Mongo.Collection must be a string or null');
      }
      if (options && options.methods) {
        // Backwards compatibility hack with original signature (which passed
        // "connection" directly instead of in options. (Connections must have a "methods"
        // method.)
        // XXX remove before 1.0
        options = {
          connection: options
        };
      }
      // Backwards compatibility: "connection" used to be called "manager".
      if (options && options.manager && !options.connection) {
        options.connection = options.manager;
      }
      options = _objectSpread({
        connection: undefined,
        idGeneration: 'STRING',
        transform: null,
        _driver: undefined,
        _preventAutopublish: false
      }, options);
      switch (options.idGeneration) {
        case 'MONGO':
          this._makeNewID = function () {
            var src = name ? DDP.randomStream('/collection/' + name) : Random.insecure;
            return new Mongo.ObjectID(src.hexString(24));
          };
          break;
        case 'STRING':
        default:
          this._makeNewID = function () {
            var src = name ? DDP.randomStream('/collection/' + name) : Random.insecure;
            return src.id();
          };
          break;
      }
      this._transform = LocalCollection.wrapTransform(options.transform);
      this.resolverType = options.resolverType;
      if (!name || options.connection === null)
        // note: nameless collections never have a connection
        this._connection = null;else if (options.connection) this._connection = options.connection;else if (Meteor.isClient) this._connection = Meteor.connection;else this._connection = Meteor.server;
      if (!options._driver) {
        // XXX This check assumes that webapp is loaded so that Meteor.server !==
        // null. We should fully support the case of "want to use a Mongo-backed
        // collection from Node code without webapp", but we don't yet.
        // #MeteorServerNull
        if (name && this._connection === Meteor.server && typeof MongoInternals !== 'undefined' && MongoInternals.defaultRemoteCollectionDriver) {
          options._driver = MongoInternals.defaultRemoteCollectionDriver();
        } else {
          const {
            LocalCollectionDriver
          } = require('./local_collection_driver.js');
          options._driver = LocalCollectionDriver;
        }
      }
      this._collection = options._driver.open(name, this._connection);
      this._name = name;
      this._driver = options._driver;

      // TODO[fibers]: _maybeSetUpReplication is now async. Let's watch how not waiting for this function to finish
      // will affect everything
      this._settingUpReplicationPromise = this._maybeSetUpReplication(name, options);

      // XXX don't define these until allow or deny is actually used for this
      // collection. Could be hard if the security rules are only defined on the
      // server.
      if (options.defineMutationMethods !== false) {
        try {
          this._defineMutationMethods({
            useExisting: options._suppressSameNameError === true
          });
        } catch (error) {
          // Throw a more understandable error on the server for same collection name
          if (error.message === "A method named '/".concat(name, "/insertAsync' is already defined")) throw new Error("There is already a collection named \"".concat(name, "\""));
          throw error;
        }
      }

      // autopublish
      if (Package.autopublish && !options._preventAutopublish && this._connection && this._connection.publish) {
        this._connection.publish(null, () => this.find(), {
          is_auto: true
        });
      }
      Mongo._collections.set(this._name, this);
    };
    Object.assign(Mongo.Collection.prototype, {
      async _maybeSetUpReplication(name) {
        var _registerStoreResult, _registerStoreResult$;
        const self = this;
        if (!(self._connection && self._connection.registerStoreClient && self._connection.registerStoreServer)) {
          return;
        }
        const wrappedStoreCommon = {
          // Called around method stub invocations to capture the original versions
          // of modified documents.
          saveOriginals() {
            self._collection.saveOriginals();
          },
          retrieveOriginals() {
            return self._collection.retrieveOriginals();
          },
          // To be able to get back to the collection from the store.
          _getCollection() {
            return self;
          }
        };
        const wrappedStoreClient = _objectSpread({
          // Called at the beginning of a batch of updates. batchSize is the number
          // of update calls to expect.
          //
          // XXX This interface is pretty janky. reset probably ought to go back to
          // being its own function, and callers shouldn't have to calculate
          // batchSize. The optimization of not calling pause/remove should be
          // delayed until later: the first call to update() should buffer its
          // message, and then we can either directly apply it at endUpdate time if
          // it was the only update, or do pauseObservers/apply/apply at the next
          // update() if there's another one.
          async beginUpdate(batchSize, reset) {
            // pause observers so users don't see flicker when updating several
            // objects at once (including the post-reconnect reset-and-reapply
            // stage), and so that a re-sorting of a query can take advantage of the
            // full _diffQuery moved calculation instead of applying change one at a
            // time.
            if (batchSize > 1 || reset) self._collection.pauseObservers();
            if (reset) await self._collection.remove({});
          },
          // Apply an update.
          // XXX better specify this interface (not in terms of a wire message)?
          update(msg) {
            var mongoId = MongoID.idParse(msg.id);
            var doc = self._collection._docs.get(mongoId);

            //When the server's mergebox is disabled for a collection, the client must gracefully handle it when:
            // *We receive an added message for a document that is already there. Instead, it will be changed
            // *We reeive a change message for a document that is not there. Instead, it will be added
            // *We receive a removed messsage for a document that is not there. Instead, noting wil happen.

            //Code is derived from client-side code originally in peerlibrary:control-mergebox
            //https://github.com/peerlibrary/meteor-control-mergebox/blob/master/client.coffee

            //For more information, refer to discussion "Initial support for publication strategies in livedata server":
            //https://github.com/meteor/meteor/pull/11151
            if (Meteor.isClient) {
              if (msg.msg === 'added' && doc) {
                msg.msg = 'changed';
              } else if (msg.msg === 'removed' && !doc) {
                return;
              } else if (msg.msg === 'changed' && !doc) {
                msg.msg = 'added';
                const _ref = msg.fields;
                for (let field in _ref) {
                  const value = _ref[field];
                  if (value === void 0) {
                    delete msg.fields[field];
                  }
                }
              }
            }
            // Is this a "replace the whole doc" message coming from the quiescence
            // of method writes to an object? (Note that 'undefined' is a valid
            // value meaning "remove it".)
            if (msg.msg === 'replace') {
              var replace = msg.replace;
              if (!replace) {
                if (doc) self._collection.remove(mongoId);
              } else if (!doc) {
                self._collection.insert(replace);
              } else {
                // XXX check that replace has no $ ops
                self._collection.update(mongoId, replace);
              }
              return;
            } else if (msg.msg === 'added') {
              if (doc) {
                throw new Error('Expected not to find a document already present for an add');
              }
              self._collection.insert(_objectSpread({
                _id: mongoId
              }, msg.fields));
            } else if (msg.msg === 'removed') {
              if (!doc) throw new Error('Expected to find a document already present for removed');
              self._collection.remove(mongoId);
            } else if (msg.msg === 'changed') {
              if (!doc) throw new Error('Expected to find a document to change');
              const keys = Object.keys(msg.fields);
              if (keys.length > 0) {
                var modifier = {};
                keys.forEach(key => {
                  const value = msg.fields[key];
                  if (EJSON.equals(doc[key], value)) {
                    return;
                  }
                  if (typeof value === 'undefined') {
                    if (!modifier.$unset) {
                      modifier.$unset = {};
                    }
                    modifier.$unset[key] = 1;
                  } else {
                    if (!modifier.$set) {
                      modifier.$set = {};
                    }
                    modifier.$set[key] = value;
                  }
                });
                if (Object.keys(modifier).length > 0) {
                  self._collection.update(mongoId, modifier);
                }
              }
            } else {
              throw new Error("I don't know how to deal with this message");
            }
          },
          // Called at the end of a batch of updates.livedata_connection.js:1287
          endUpdate() {
            self._collection.resumeObserversClient();
          },
          // Used to preserve current versions of documents across a store reset.
          getDoc(id) {
            return self.findOne(id);
          }
        }, wrappedStoreCommon);
        const wrappedStoreServer = _objectSpread({
          async beginUpdate(batchSize, reset) {
            if (batchSize > 1 || reset) self._collection.pauseObservers();
            if (reset) await self._collection.removeAsync({});
          },
          async update(msg) {
            var mongoId = MongoID.idParse(msg.id);
            var doc = self._collection._docs.get(mongoId);

            // Is this a "replace the whole doc" message coming from the quiescence
            // of method writes to an object? (Note that 'undefined' is a valid
            // value meaning "remove it".)
            if (msg.msg === 'replace') {
              var replace = msg.replace;
              if (!replace) {
                if (doc) await self._collection.removeAsync(mongoId);
              } else if (!doc) {
                await self._collection.insertAsync(replace);
              } else {
                // XXX check that replace has no $ ops
                await self._collection.updateAsync(mongoId, replace);
              }
              return;
            } else if (msg.msg === 'added') {
              if (doc) {
                throw new Error('Expected not to find a document already present for an add');
              }
              await self._collection.insertAsync(_objectSpread({
                _id: mongoId
              }, msg.fields));
            } else if (msg.msg === 'removed') {
              if (!doc) throw new Error('Expected to find a document already present for removed');
              await self._collection.removeAsync(mongoId);
            } else if (msg.msg === 'changed') {
              if (!doc) throw new Error('Expected to find a document to change');
              const keys = Object.keys(msg.fields);
              if (keys.length > 0) {
                var modifier = {};
                keys.forEach(key => {
                  const value = msg.fields[key];
                  if (EJSON.equals(doc[key], value)) {
                    return;
                  }
                  if (typeof value === 'undefined') {
                    if (!modifier.$unset) {
                      modifier.$unset = {};
                    }
                    modifier.$unset[key] = 1;
                  } else {
                    if (!modifier.$set) {
                      modifier.$set = {};
                    }
                    modifier.$set[key] = value;
                  }
                });
                if (Object.keys(modifier).length > 0) {
                  await self._collection.updateAsync(mongoId, modifier);
                }
              }
            } else {
              throw new Error("I don't know how to deal with this message");
            }
          },
          // Called at the end of a batch of updates.
          async endUpdate() {
            await self._collection.resumeObserversServer();
          },
          // Used to preserve current versions of documents across a store reset.
          async getDoc(id) {
            return self.findOneAsync(id);
          }
        }, wrappedStoreCommon);

        // OK, we're going to be a slave, replicating some remote
        // database, except possibly with some temporary divergence while
        // we have unacknowledged RPC's.
        let registerStoreResult;
        if (Meteor.isClient) {
          registerStoreResult = self._connection.registerStoreClient(name, wrappedStoreClient);
        } else {
          registerStoreResult = self._connection.registerStoreServer(name, wrappedStoreServer);
        }
        const message = "There is already a collection named \"".concat(name, "\"");
        const logWarn = () => {
          console.warn ? console.warn(message) : console.log(message);
        };
        if (!registerStoreResult) {
          return logWarn();
        }
        return (_registerStoreResult = registerStoreResult) === null || _registerStoreResult === void 0 ? void 0 : (_registerStoreResult$ = _registerStoreResult.then) === null || _registerStoreResult$ === void 0 ? void 0 : _registerStoreResult$.call(_registerStoreResult, ok => {
          if (!ok) {
            logWarn();
          }
        });
      },
      ///
      /// Main collection API
      ///
      /**
       * @summary Gets the number of documents matching the filter. For a fast count of the total documents in a collection see `estimatedDocumentCount`.
       * @locus Anywhere
       * @method countDocuments
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} [selector] A query describing the documents to count
       * @param {Object} [options] All options are listed in [MongoDB documentation](https://mongodb.github.io/node-mongodb-native/4.11/interfaces/CountDocumentsOptions.html). Please note that not all of them are available on the client.
       * @returns {Promise<number>}
       */
      countDocuments() {
        return this._collection.countDocuments(...arguments);
      },
      /**
       * @summary Gets an estimate of the count of documents in a collection using collection metadata. For an exact count of the documents in a collection see `countDocuments`.
       * @locus Anywhere
       * @method estimatedDocumentCount
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} [options] All options are listed in [MongoDB documentation](https://mongodb.github.io/node-mongodb-native/4.11/interfaces/EstimatedDocumentCountOptions.html). Please note that not all of them are available on the client.
       * @returns {Promise<number>}
       */
      estimatedDocumentCount() {
        return this._collection.estimatedDocumentCount(...arguments);
      },
      _getFindSelector(args) {
        if (args.length == 0) return {};else return args[0];
      },
      _getFindOptions(args) {
        const [, options] = args || [];
        const newOptions = normalizeProjection(options);
        var self = this;
        if (args.length < 2) {
          return {
            transform: self._transform
          };
        } else {
          check(newOptions, Match.Optional(Match.ObjectIncluding({
            projection: Match.Optional(Match.OneOf(Object, undefined)),
            sort: Match.Optional(Match.OneOf(Object, Array, Function, undefined)),
            limit: Match.Optional(Match.OneOf(Number, undefined)),
            skip: Match.Optional(Match.OneOf(Number, undefined))
          })));
          return _objectSpread({
            transform: self._transform
          }, newOptions);
        }
      },
      /**
       * @summary Find the documents in a collection that match the selector.
       * @locus Anywhere
       * @method find
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} [selector] A query describing the documents to find
       * @param {Object} [options]
       * @param {MongoSortSpecifier} options.sort Sort order (default: natural order)
       * @param {Number} options.skip Number of results to skip at the beginning
       * @param {Number} options.limit Maximum number of results to return
       * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
       * @param {Boolean} options.reactive (Client only) Default `true`; pass `false` to disable reactivity
       * @param {Function} options.transform Overrides `transform` on the  [`Collection`](#collections) for this cursor.  Pass `null` to disable transformation.
       * @param {Boolean} options.disableOplog (Server only) Pass true to disable oplog-tailing on this query. This affects the way server processes calls to `observe` on this query. Disabling the oplog can be useful when working with data that updates in large batches.
       * @param {Number} options.pollingIntervalMs (Server only) When oplog is disabled (through the use of `disableOplog` or when otherwise not available), the frequency (in milliseconds) of how often to poll this query when observing on the server. Defaults to 10000ms (10 seconds).
       * @param {Number} options.pollingThrottleMs (Server only) When oplog is disabled (through the use of `disableOplog` or when otherwise not available), the minimum time (in milliseconds) to allow between re-polling when observing on the server. Increasing this will save CPU and mongo load at the expense of slower updates to users. Decreasing this is not recommended. Defaults to 50ms.
       * @param {Number} options.maxTimeMs (Server only) If set, instructs MongoDB to set a time limit for this cursor's operations. If the operation reaches the specified time limit (in milliseconds) without the having been completed, an exception will be thrown. Useful to prevent an (accidental or malicious) unoptimized query from causing a full collection scan that would disrupt other database users, at the expense of needing to handle the resulting error.
       * @param {String|Object} options.hint (Server only) Overrides MongoDB's default index selection and query optimization process. Specify an index to force its use, either by its name or index specification. You can also specify `{ $natural : 1 }` to force a forwards collection scan, or `{ $natural : -1 }` for a reverse collection scan. Setting this is only recommended for advanced users.
       * @param {String} options.readPreference (Server only) Specifies a custom MongoDB [`readPreference`](https://docs.mongodb.com/manual/core/read-preference) for this particular cursor. Possible values are `primary`, `primaryPreferred`, `secondary`, `secondaryPreferred` and `nearest`.
       * @returns {Mongo.Cursor}
       */
      find() {
        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }
        // Collection.find() (return all docs) behaves differently
        // from Collection.find(undefined) (return 0 docs).  so be
        // careful about the length of arguments.
        return this._collection.find(this._getFindSelector(args), this._getFindOptions(args));
      },
      /**
       * @summary Finds the first document that matches the selector, as ordered by sort and skip options. Returns `undefined` if no matching document is found.
       * @locus Anywhere
       * @method findOneAsync
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} [selector] A query describing the documents to find
       * @param {Object} [options]
       * @param {MongoSortSpecifier} options.sort Sort order (default: natural order)
       * @param {Number} options.skip Number of results to skip at the beginning
       * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
       * @param {Boolean} options.reactive (Client only) Default true; pass false to disable reactivity
       * @param {Function} options.transform Overrides `transform` on the [`Collection`](#collections) for this cursor.  Pass `null` to disable transformation.
       * @param {String} options.readPreference (Server only) Specifies a custom MongoDB [`readPreference`](https://docs.mongodb.com/manual/core/read-preference) for fetching the document. Possible values are `primary`, `primaryPreferred`, `secondary`, `secondaryPreferred` and `nearest`.
       * @returns {Object}
       */
      findOneAsync() {
        for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
          args[_key2] = arguments[_key2];
        }
        return this._collection.findOneAsync(this._getFindSelector(args), this._getFindOptions(args));
      },
      /**
       * @summary Finds the first document that matches the selector, as ordered by sort and skip options. Returns `undefined` if no matching document is found.
       * @locus Anywhere
       * @method findOne
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} [selector] A query describing the documents to find
       * @param {Object} [options]
       * @param {MongoSortSpecifier} options.sort Sort order (default: natural order)
       * @param {Number} options.skip Number of results to skip at the beginning
       * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
       * @param {Boolean} options.reactive (Client only) Default true; pass false to disable reactivity
       * @param {Function} options.transform Overrides `transform` on the [`Collection`](#collections) for this cursor.  Pass `null` to disable transformation.
       * @param {String} options.readPreference (Server only) Specifies a custom MongoDB [`readPreference`](https://docs.mongodb.com/manual/core/read-preference) for fetching the document. Possible values are `primary`, `primaryPreferred`, `secondary`, `secondaryPreferred` and `nearest`.
       * @returns {Object}
       */
      findOne() {
        for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
          args[_key3] = arguments[_key3];
        }
        return this._collection.findOne(this._getFindSelector(args), this._getFindOptions(args));
      }
    });
    Object.assign(Mongo.Collection, {
      async _publishCursor(cursor, sub, collection) {
        var observeHandle = await cursor.observeChanges({
          added: function (id, fields) {
            sub.added(collection, id, fields);
          },
          changed: function (id, fields) {
            sub.changed(collection, id, fields);
          },
          removed: function (id) {
            sub.removed(collection, id);
          }
        },
        // Publications don't mutate the documents
        // This is tested by the `livedata - publish callbacks clone` test
        {
          nonMutatingCallbacks: true
        });

        // We don't call sub.ready() here: it gets called in livedata_server, after
        // possibly calling _publishCursor on multiple returned cursors.

        // register stop callback (expects lambda w/ no args).
        sub.onStop(async function () {
          return await observeHandle.stop();
        });

        // return the observeHandle in case it needs to be stopped early
        return observeHandle;
      },
      // protect against dangerous selectors.  falsey and {_id: falsey} are both
      // likely programmer error, and not what you want, particularly for destructive
      // operations. If a falsey _id is sent in, a new string _id will be
      // generated and returned; if a fallbackId is provided, it will be returned
      // instead.
      _rewriteSelector(selector) {
        let {
          fallbackId
        } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        // shorthand -- scalars match _id
        if (LocalCollection._selectorIsId(selector)) selector = {
          _id: selector
        };
        if (Array.isArray(selector)) {
          // This is consistent with the Mongo console itself; if we don't do this
          // check passing an empty array ends up selecting all items
          throw new Error("Mongo selector can't be an array.");
        }
        if (!selector || '_id' in selector && !selector._id) {
          // can't match anything
          return {
            _id: fallbackId || Random.id()
          };
        }
        return selector;
      }
    });
    Object.assign(Mongo.Collection.prototype, {
      // 'insert' immediately returns the inserted document's new _id.
      // The others return values immediately if you are in a stub, an in-memory
      // unmanaged collection, or a mongo-backed collection and you don't pass a
      // callback. 'update' and 'remove' return the number of affected
      // documents. 'upsert' returns an object with keys 'numberAffected' and, if an
      // insert happened, 'insertedId'.
      //
      // Otherwise, the semantics are exactly like other methods: they take
      // a callback as an optional last argument; if no callback is
      // provided, they block until the operation is complete, and throw an
      // exception if it fails; if a callback is provided, then they don't
      // necessarily block, and they call the callback when they finish with error and
      // result arguments.  (The insert method provides the document ID as its result;
      // update and remove provide the number of affected docs as the result; upsert
      // provides an object with numberAffected and maybe insertedId.)
      //
      // On the client, blocking is impossible, so if a callback
      // isn't provided, they just return immediately and any error
      // information is lost.
      //
      // There's one more tweak. On the client, if you don't provide a
      // callback, then if there is an error, a message will be logged with
      // Meteor._debug.
      //
      // The intent (though this is actually determined by the underlying
      // drivers) is that the operations should be done synchronously, not
      // generating their result until the database has acknowledged
      // them. In the future maybe we should provide a flag to turn this
      // off.

      _insert(doc, callback) {
        // Make sure we were passed a document to insert
        if (!doc) {
          throw new Error('insert requires an argument');
        }

        // Make a shallow clone of the document, preserving its prototype.
        doc = Object.create(Object.getPrototypeOf(doc), Object.getOwnPropertyDescriptors(doc));
        if ('_id' in doc) {
          if (!doc._id || !(typeof doc._id === 'string' || doc._id instanceof Mongo.ObjectID)) {
            throw new Error('Meteor requires document _id fields to be non-empty strings or ObjectIDs');
          }
        } else {
          let generateId = true;

          // Don't generate the id if we're the client and the 'outermost' call
          // This optimization saves us passing both the randomSeed and the id
          // Passing both is redundant.
          if (this._isRemoteCollection()) {
            const enclosing = DDP._CurrentMethodInvocation.get();
            if (!enclosing) {
              generateId = false;
            }
          }
          if (generateId) {
            doc._id = this._makeNewID();
          }
        }

        // On inserts, always return the id that we generated; on all other
        // operations, just return the result from the collection.
        var chooseReturnValueFromCollectionResult = function (result) {
          if (Meteor._isPromise(result)) return result;
          if (doc._id) {
            return doc._id;
          }

          // XXX what is this for??
          // It's some iteraction between the callback to _callMutatorMethod and
          // the return value conversion
          doc._id = result;
          return result;
        };
        const wrappedCallback = wrapCallback(callback, chooseReturnValueFromCollectionResult);
        if (this._isRemoteCollection()) {
          const result = this._callMutatorMethod('insert', [doc], wrappedCallback);
          return chooseReturnValueFromCollectionResult(result);
        }

        // it's my collection.  descend into the collection object
        // and propagate any exception.
        try {
          // If the user provided a callback and the collection implements this
          // operation asynchronously, then queryRet will be undefined, and the
          // result will be returned through the callback instead.
          let result;
          if (!!wrappedCallback) {
            this._collection.insert(doc, wrappedCallback);
          } else {
            // If we don't have the callback, we assume the user is using the promise.
            // We can't just pass this._collection.insert to the promisify because it would lose the context.
            result = this._collection.insert(doc);
          }
          return chooseReturnValueFromCollectionResult(result);
        } catch (e) {
          if (callback) {
            callback(e);
            return null;
          }
          throw e;
        }
      },
      /**
       * @summary Insert a document in the collection.  Returns its unique _id.
       * @locus Anywhere
       * @method  insert
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} doc The document to insert. May not yet have an _id attribute, in which case Meteor will generate one for you.
       * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the _id as the second.
       */
      insert(doc, callback) {
        return this._insert(doc, callback);
      },
      _insertAsync(doc) {
        let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        // Make sure we were passed a document to insert
        if (!doc) {
          throw new Error('insert requires an argument');
        }

        // Make a shallow clone of the document, preserving its prototype.
        doc = Object.create(Object.getPrototypeOf(doc), Object.getOwnPropertyDescriptors(doc));
        if ('_id' in doc) {
          if (!doc._id || !(typeof doc._id === 'string' || doc._id instanceof Mongo.ObjectID)) {
            throw new Error('Meteor requires document _id fields to be non-empty strings or ObjectIDs');
          }
        } else {
          let generateId = true;

          // Don't generate the id if we're the client and the 'outermost' call
          // This optimization saves us passing both the randomSeed and the id
          // Passing both is redundant.
          if (this._isRemoteCollection()) {
            const enclosing = DDP._CurrentMethodInvocation.get();
            if (!enclosing) {
              generateId = false;
            }
          }
          if (generateId) {
            doc._id = this._makeNewID();
          }
        }

        // On inserts, always return the id that we generated; on all other
        // operations, just return the result from the collection.
        var chooseReturnValueFromCollectionResult = function (result) {
          if (Meteor._isPromise(result)) return result;
          if (doc._id) {
            return doc._id;
          }

          // XXX what is this for??
          // It's some iteraction between the callback to _callMutatorMethod and
          // the return value conversion
          doc._id = result;
          return result;
        };
        if (this._isRemoteCollection()) {
          const promise = this._callMutatorMethodAsync('insertAsync', [doc], options);
          promise.then(chooseReturnValueFromCollectionResult);
          promise.stubPromise = promise.stubPromise.then(chooseReturnValueFromCollectionResult);
          promise.serverPromise = promise.serverPromise.then(chooseReturnValueFromCollectionResult);
          return promise;
        }

        // it's my collection.  descend into the collection object
        // and propagate any exception.
        return this._collection.insertAsync(doc).then(chooseReturnValueFromCollectionResult);
      },
      /**
       * @summary Insert a document in the collection.  Returns a promise that will return the document's unique _id when solved.
       * @locus Anywhere
       * @method  insert
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} doc The document to insert. May not yet have an _id attribute, in which case Meteor will generate one for you.
       */
      insertAsync(doc, options) {
        return this._insertAsync(doc, options);
      },
      /**
       * @summary Modify one or more documents in the collection. Returns the number of matched documents.
       * @locus Anywhere
       * @method update
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to modify
       * @param {MongoModifier} modifier Specifies how to modify the documents
       * @param {Object} [options]
       * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
       * @param {Boolean} options.upsert True to insert a document if no matching documents are found.
       * @param {Array} options.arrayFilters Optional. Used in combination with MongoDB [filtered positional operator](https://docs.mongodb.com/manual/reference/operator/update/positional-filtered/) to specify which elements to modify in an array field.
       */
      updateAsync(selector, modifier) {
        // We've already popped off the callback, so we are left with an array
        // of one or zero items
        const options = _objectSpread({}, (arguments.length <= 2 ? undefined : arguments[2]) || null);
        let insertedId;
        if (options && options.upsert) {
          // set `insertedId` if absent.  `insertedId` is a Meteor extension.
          if (options.insertedId) {
            if (!(typeof options.insertedId === 'string' || options.insertedId instanceof Mongo.ObjectID)) throw new Error('insertedId must be string or ObjectID');
            insertedId = options.insertedId;
          } else if (!selector || !selector._id) {
            insertedId = this._makeNewID();
            options.generatedId = true;
            options.insertedId = insertedId;
          }
        }
        selector = Mongo.Collection._rewriteSelector(selector, {
          fallbackId: insertedId
        });
        if (this._isRemoteCollection()) {
          const args = [selector, modifier, options];
          return this._callMutatorMethodAsync('updateAsync', args, options);
        }

        // it's my collection.  descend into the collection object
        // and propagate any exception.
        // If the user provided a callback and the collection implements this
        // operation asynchronously, then queryRet will be undefined, and the
        // result will be returned through the callback instead.

        return this._collection.updateAsync(selector, modifier, options);
      },
      /**
       * @summary Asynchronously modifies one or more documents in the collection. Returns the number of matched documents.
       * @locus Anywhere
       * @method update
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to modify
       * @param {MongoModifier} modifier Specifies how to modify the documents
       * @param {Object} [options]
       * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
       * @param {Boolean} options.upsert True to insert a document if no matching documents are found.
       * @param {Array} options.arrayFilters Optional. Used in combination with MongoDB [filtered positional operator](https://docs.mongodb.com/manual/reference/operator/update/positional-filtered/) to specify which elements to modify in an array field.
       * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the number of affected documents as the second.
       */
      update(selector, modifier) {
        for (var _len4 = arguments.length, optionsAndCallback = new Array(_len4 > 2 ? _len4 - 2 : 0), _key4 = 2; _key4 < _len4; _key4++) {
          optionsAndCallback[_key4 - 2] = arguments[_key4];
        }
        const callback = popCallbackFromArgs(optionsAndCallback);

        // We've already popped off the callback, so we are left with an array
        // of one or zero items
        const options = _objectSpread({}, optionsAndCallback[0] || null);
        let insertedId;
        if (options && options.upsert) {
          // set `insertedId` if absent.  `insertedId` is a Meteor extension.
          if (options.insertedId) {
            if (!(typeof options.insertedId === 'string' || options.insertedId instanceof Mongo.ObjectID)) throw new Error('insertedId must be string or ObjectID');
            insertedId = options.insertedId;
          } else if (!selector || !selector._id) {
            insertedId = this._makeNewID();
            options.generatedId = true;
            options.insertedId = insertedId;
          }
        }
        selector = Mongo.Collection._rewriteSelector(selector, {
          fallbackId: insertedId
        });
        const wrappedCallback = wrapCallback(callback);
        if (this._isRemoteCollection()) {
          const args = [selector, modifier, options];
          return this._callMutatorMethod('update', args, callback);
        }

        // it's my collection.  descend into the collection object
        // and propagate any exception.
        // If the user provided a callback and the collection implements this
        // operation asynchronously, then queryRet will be undefined, and the
        // result will be returned through the callback instead.
        //console.log({callback, options, selector, modifier, coll: this._collection});
        try {
          // If the user provided a callback and the collection implements this
          // operation asynchronously, then queryRet will be undefined, and the
          // result will be returned through the callback instead.
          return this._collection.update(selector, modifier, options, wrappedCallback);
        } catch (e) {
          if (callback) {
            callback(e);
            return null;
          }
          throw e;
        }
      },
      /**
       * @summary Asynchronously removes documents from the collection.
       * @locus Anywhere
       * @method remove
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to remove
       */
      removeAsync(selector) {
        let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        selector = Mongo.Collection._rewriteSelector(selector);
        if (this._isRemoteCollection()) {
          return this._callMutatorMethodAsync('removeAsync', [selector], options);
        }

        // it's my collection.  descend into the collection1 object
        // and propagate any exception.
        return this._collection.removeAsync(selector);
      },
      /**
       * @summary Remove documents from the collection
       * @locus Anywhere
       * @method remove
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to remove
       * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the number of affected documents as the second.
       */
      remove(selector, callback) {
        selector = Mongo.Collection._rewriteSelector(selector);
        if (this._isRemoteCollection()) {
          return this._callMutatorMethod('remove', [selector], callback);
        }

        // it's my collection.  descend into the collection1 object
        // and propagate any exception.
        return this._collection.remove(selector);
      },
      // Determine if this collection is simply a minimongo representation of a real
      // database on another server
      _isRemoteCollection() {
        // XXX see #MeteorServerNull
        return this._connection && this._connection !== Meteor.server;
      },
      /**
       * @summary Asynchronously modifies one or more documents in the collection, or insert one if no matching documents were found. Returns an object with keys `numberAffected` (the number of documents modified)  and `insertedId` (the unique _id of the document that was inserted, if any).
       * @locus Anywhere
       * @method upsert
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to modify
       * @param {MongoModifier} modifier Specifies how to modify the documents
       * @param {Object} [options]
       * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
       */
      async upsertAsync(selector, modifier, options) {
        return this.updateAsync(selector, modifier, _objectSpread(_objectSpread({}, options), {}, {
          _returnObject: true,
          upsert: true
        }));
      },
      /**
       * @summary Asynchronously modifies one or more documents in the collection, or insert one if no matching documents were found. Returns an object with keys `numberAffected` (the number of documents modified)  and `insertedId` (the unique _id of the document that was inserted, if any).
       * @locus Anywhere
       * @method upsert
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to modify
       * @param {MongoModifier} modifier Specifies how to modify the documents
       * @param {Object} [options]
       * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
       * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the number of affected documents as the second.
       */
      upsert(selector, modifier, options, callback) {
        if (!callback && typeof options === 'function') {
          callback = options;
          options = {};
        }
        return this.update(selector, modifier, _objectSpread(_objectSpread({}, options), {}, {
          _returnObject: true,
          upsert: true
        }));
      },
      // We'll actually design an index API later. For now, we just pass through to
      // Mongo's, but make it synchronous.
      /**
       * @summary Asynchronously creates the specified index on the collection.
       * @locus server
       * @method ensureIndexAsync
       * @deprecated in 3.0
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} index A document that contains the field and value pairs where the field is the index key and the value describes the type of index for that field. For an ascending index on a field, specify a value of `1`; for descending index, specify a value of `-1`. Use `text` for text indexes.
       * @param {Object} [options] All options are listed in [MongoDB documentation](https://docs.mongodb.com/manual/reference/method/db.collection.createIndex/#options)
       * @param {String} options.name Name of the index
       * @param {Boolean} options.unique Define that the index values must be unique, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-unique/)
       * @param {Boolean} options.sparse Define that the index is sparse, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-sparse/)
       */
      async ensureIndexAsync(index, options) {
        var self = this;
        if (!self._collection.ensureIndexAsync || !self._collection.createIndexAsync) throw new Error('Can only call createIndexAsync on server collections');
        if (self._collection.createIndexAsync) {
          await self._collection.createIndexAsync(index, options);
        } else {
          let Log;
          module1.link("meteor/logging", {
            Log(v) {
              Log = v;
            }
          }, 2);
          Log.debug("ensureIndexAsync has been deprecated, please use the new 'createIndexAsync' instead".concat(options !== null && options !== void 0 && options.name ? ", index name: ".concat(options.name) : ", index: ".concat(JSON.stringify(index))));
          await self._collection.ensureIndexAsync(index, options);
        }
      },
      /**
       * @summary Asynchronously creates the specified index on the collection.
       * @locus server
       * @method createIndexAsync
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} index A document that contains the field and value pairs where the field is the index key and the value describes the type of index for that field. For an ascending index on a field, specify a value of `1`; for descending index, specify a value of `-1`. Use `text` for text indexes.
       * @param {Object} [options] All options are listed in [MongoDB documentation](https://docs.mongodb.com/manual/reference/method/db.collection.createIndex/#options)
       * @param {String} options.name Name of the index
       * @param {Boolean} options.unique Define that the index values must be unique, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-unique/)
       * @param {Boolean} options.sparse Define that the index is sparse, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-sparse/)
       */
      async createIndexAsync(index, options) {
        var self = this;
        if (!self._collection.createIndexAsync) throw new Error('Can only call createIndexAsync on server collections');
        try {
          await self._collection.createIndexAsync(index, options);
        } catch (e) {
          var _Meteor$settings, _Meteor$settings$pack, _Meteor$settings$pack2;
          if (e.message.includes('An equivalent index already exists with the same name but different options.') && (_Meteor$settings = Meteor.settings) !== null && _Meteor$settings !== void 0 && (_Meteor$settings$pack = _Meteor$settings.packages) !== null && _Meteor$settings$pack !== void 0 && (_Meteor$settings$pack2 = _Meteor$settings$pack.mongo) !== null && _Meteor$settings$pack2 !== void 0 && _Meteor$settings$pack2.reCreateIndexOnOptionMismatch) {
            let Log;
            module1.link("meteor/logging", {
              Log(v) {
                Log = v;
              }
            }, 3);
            Log.info("Re-creating index ".concat(index, " for ").concat(self._name, " due to options mismatch."));
            await self._collection.dropIndexAsync(index);
            await self._collection.createIndexAsync(index, options);
          } else {
            console.error(e);
            throw new Meteor.Error("An error occurred when creating an index for collection \"".concat(self._name, ": ").concat(e.message));
          }
        }
      },
      /**
       * @summary Asynchronously creates the specified index on the collection.
       * @locus server
       * @method createIndex
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} index A document that contains the field and value pairs where the field is the index key and the value describes the type of index for that field. For an ascending index on a field, specify a value of `1`; for descending index, specify a value of `-1`. Use `text` for text indexes.
       * @param {Object} [options] All options are listed in [MongoDB documentation](https://docs.mongodb.com/manual/reference/method/db.collection.createIndex/#options)
       * @param {String} options.name Name of the index
       * @param {Boolean} options.unique Define that the index values must be unique, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-unique/)
       * @param {Boolean} options.sparse Define that the index is sparse, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-sparse/)
       */
      createIndex(index, options) {
        return this.createIndexAsync(index, options);
      },
      async dropIndexAsync(index) {
        var self = this;
        if (!self._collection.dropIndexAsync) throw new Error('Can only call dropIndexAsync on server collections');
        await self._collection.dropIndexAsync(index);
      },
      async dropCollectionAsync() {
        var self = this;
        if (!self._collection.dropCollectionAsync) throw new Error('Can only call dropCollectionAsync on server collections');
        await self._collection.dropCollectionAsync();
      },
      async createCappedCollectionAsync(byteSize, maxDocuments) {
        var self = this;
        if (!(await self._collection.createCappedCollectionAsync)) throw new Error('Can only call createCappedCollectionAsync on server collections');
        await self._collection.createCappedCollectionAsync(byteSize, maxDocuments);
      },
      /**
       * @summary Returns the [`Collection`](http://mongodb.github.io/node-mongodb-native/3.0/api/Collection.html) object corresponding to this collection from the [npm `mongodb` driver module](https://www.npmjs.com/package/mongodb) which is wrapped by `Mongo.Collection`.
       * @locus Server
       * @memberof Mongo.Collection
       * @instance
       */
      rawCollection() {
        var self = this;
        if (!self._collection.rawCollection) {
          throw new Error('Can only call rawCollection on server collections');
        }
        return self._collection.rawCollection();
      },
      /**
       * @summary Returns the [`Db`](http://mongodb.github.io/node-mongodb-native/3.0/api/Db.html) object corresponding to this collection's database connection from the [npm `mongodb` driver module](https://www.npmjs.com/package/mongodb) which is wrapped by `Mongo.Collection`.
       * @locus Server
       * @memberof Mongo.Collection
       * @instance
       */
      rawDatabase() {
        var self = this;
        if (!(self._driver.mongo && self._driver.mongo.db)) {
          throw new Error('Can only call rawDatabase on server collections');
        }
        return self._driver.mongo.db;
      }
    });
    Object.assign(Mongo, {
      /**
       * @summary Retrieve a Meteor collection instance by name. Only collections defined with [`new Mongo.Collection(...)`](#collections) are available with this method. For plain MongoDB collections, you'll want to look at [`rawDatabase()`](#Mongo-Collection-rawDatabase).
       * @locus Anywhere
       * @memberof Mongo
       * @static
       * @param {string} name Name of your collection as it was defined with `new Mongo.Collection()`.
       * @returns {Mongo.Collection | undefined}
       */
      getCollection(name) {
        return this._collections.get(name);
      },
      /**
       * @summary A record of all defined Mongo.Collection instances, indexed by collection name.
       * @type {Map<string, Mongo.Collection>}
       * @memberof Mongo
       * @protected
       */
      _collections: new Map()
    });

    // Convert the callback to not return a result if there is an error
    function wrapCallback(callback, convertResult) {
      return callback && function (error, result) {
        if (error) {
          callback(error);
        } else if (typeof convertResult === 'function') {
          callback(error, convertResult(result));
        } else {
          callback(error, result);
        }
      };
    }

    /**
     * @summary Create a Mongo-style `ObjectID`.  If you don't specify a `hexString`, the `ObjectID` will be generated randomly (not using MongoDB's ID construction rules).
     * @locus Anywhere
     * @class
     * @param {String} [hexString] Optional.  The 24-character hexadecimal contents of the ObjectID to create
     */
    Mongo.ObjectID = MongoID.ObjectID;

    /**
     * @summary To create a cursor, use find. To access the documents in a cursor, use forEach, map, or fetch.
     * @class
     * @instanceName cursor
     */
    Mongo.Cursor = LocalCollection.Cursor;

    /**
     * @deprecated in 0.9.1
     */
    Mongo.Collection.Cursor = Mongo.Cursor;

    /**
     * @deprecated in 0.9.1
     */
    Mongo.Collection.ObjectID = Mongo.ObjectID;

    /**
     * @deprecated in 0.9.1
     */
    Meteor.Collection = Mongo.Collection;

    // Allow deny stuff is now in the allow-deny package
    Object.assign(Mongo.Collection.prototype, AllowDeny.CollectionPrototype);
    function popCallbackFromArgs(args) {
      // Pull off any callback (or perhaps a 'callback' variable that was passed
      // in undefined, like how 'upsert' does it).
      if (args.length && (args[args.length - 1] === undefined || args[args.length - 1] instanceof Function)) {
        return args.pop();
      }
    }
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

},"connection_options.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/connection_options.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/**
 * @summary Allows for user specified connection options
 * @example http://mongodb.github.io/node-mongodb-native/3.0/reference/connecting/connection-settings/
 * @locus Server
 * @param {Object} options User specified Mongo connection options
 */
Mongo.setConnectionOptions = function setConnectionOptions(options) {
  check(options, Object);
  Mongo._connectionOptions = options;
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"mongo_utils.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/mongo_utils.js                                                                                       //
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
    let _objectWithoutProperties;
    module.link("@babel/runtime/helpers/objectWithoutProperties", {
      default(v) {
        _objectWithoutProperties = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const _excluded = ["fields", "projection"];
    module.export({
      normalizeProjection: () => normalizeProjection
    });
    const normalizeProjection = options => {
      // transform fields key in projection
      const _ref = options || {},
        {
          fields,
          projection
        } = _ref,
        otherOptions = _objectWithoutProperties(_ref, _excluded);
      // TODO: enable this comment when deprecating the fields option
      // Log.debug(`fields option has been deprecated, please use the new 'projection' instead`)

      return _objectSpread(_objectSpread({}, otherOptions), projection || fields ? {
        projection: fields || projection
      } : {});
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

},"node_modules":{"lodash.has":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/lodash.has/package.json                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.has",
  "version": "4.5.2"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/lodash.has/index.js                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.identity":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/lodash.identity/package.json                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.identity",
  "version": "3.0.0"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/lodash.identity/index.js                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.clone":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/lodash.clone/package.json                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.clone",
  "version": "4.5.0"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/lodash.clone/index.js                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.isempty":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/lodash.isempty/package.json                                                  //
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
// node_modules/meteor/mongo/node_modules/lodash.isempty/index.js                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.throttle":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/lodash.throttle/package.json                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.throttle",
  "version": "4.1.1"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/lodash.throttle/index.js                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.once":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/lodash.once/package.json                                                     //
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
// node_modules/meteor/mongo/node_modules/lodash.once/index.js                                                         //
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
      MongoInternals: MongoInternals,
      Mongo: Mongo,
      ObserveMultiplexer: ObserveMultiplexer
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/mongo/mongo_driver.js",
    "/node_modules/meteor/mongo/oplog_tailing.js",
    "/node_modules/meteor/mongo/observe_multiplex.js",
    "/node_modules/meteor/mongo/doc_fetcher.js",
    "/node_modules/meteor/mongo/polling_observe_driver.js",
    "/node_modules/meteor/mongo/oplog_observe_driver.js",
    "/node_modules/meteor/mongo/oplog_v2_converter.js",
    "/node_modules/meteor/mongo/local_collection_driver.js",
    "/node_modules/meteor/mongo/remote_collection_driver.js",
    "/node_modules/meteor/mongo/collection.js",
    "/node_modules/meteor/mongo/connection_options.js"
  ]
}});

//# sourceURL=meteor://💻app/packages/mongo.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28vbW9uZ29fZHJpdmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9vcGxvZ190YWlsaW5nLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9vYnNlcnZlX211bHRpcGxleC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28vZG9jX2ZldGNoZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL3BvbGxpbmdfb2JzZXJ2ZV9kcml2ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL29wbG9nX29ic2VydmVfZHJpdmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9vcGxvZ192Ml9jb252ZXJ0ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL2xvY2FsX2NvbGxlY3Rpb25fZHJpdmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9yZW1vdGVfY29sbGVjdGlvbl9kcml2ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL2NvbGxlY3Rpb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL2Nvbm5lY3Rpb25fb3B0aW9ucy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28vbW9uZ29fdXRpbHMuanMiXSwibmFtZXMiOlsiX29iamVjdFNwcmVhZCIsIm1vZHVsZTEiLCJsaW5rIiwiZGVmYXVsdCIsInYiLCJoYXMiLCJpZGVudGl0eSIsImNsb25lIiwiRG9jRmV0Y2hlciIsIkFTWU5DX0NVUlNPUl9NRVRIT0RTIiwiQ0xJRU5UX09OTFlfTUVUSE9EUyIsImdldEFzeW5jTWV0aG9kTmFtZSIsIk1ldGVvciIsIl9fcmVpZnlXYWl0Rm9yRGVwc19fIiwicGF0aCIsInJlcXVpcmUiLCJ1dGlsIiwiTW9uZ29EQiIsIk5wbU1vZHVsZU1vbmdvZGIiLCJNb25nb0ludGVybmFscyIsIl9fcGFja2FnZU5hbWUiLCJOcG1Nb2R1bGVzIiwibW9uZ29kYiIsInZlcnNpb24iLCJOcG1Nb2R1bGVNb25nb2RiVmVyc2lvbiIsIm1vZHVsZSIsIk5wbU1vZHVsZSIsIkZJTEVfQVNTRVRfU1VGRklYIiwiQVNTRVRTX0ZPTERFUiIsIkFQUF9GT0xERVIiLCJyZXBsYWNlTmFtZXMiLCJmaWx0ZXIiLCJ0aGluZyIsIkFycmF5IiwiaXNBcnJheSIsIm1hcCIsImJpbmQiLCJyZXQiLCJPYmplY3QiLCJlbnRyaWVzIiwiZm9yRWFjaCIsIl9yZWYiLCJrZXkiLCJ2YWx1ZSIsIlRpbWVzdGFtcCIsInByb3RvdHlwZSIsIm1ha2VNb25nb0xlZ2FsIiwibmFtZSIsInVubWFrZU1vbmdvTGVnYWwiLCJzdWJzdHIiLCJyZXBsYWNlTW9uZ29BdG9tV2l0aE1ldGVvciIsImRvY3VtZW50IiwiQmluYXJ5Iiwic3ViX3R5cGUiLCJidWZmZXIiLCJVaW50OEFycmF5IiwiT2JqZWN0SUQiLCJNb25nbyIsInRvSGV4U3RyaW5nIiwiRGVjaW1hbDEyOCIsIkRlY2ltYWwiLCJ0b1N0cmluZyIsImtleXMiLCJsZW5ndGgiLCJFSlNPTiIsImZyb21KU09OVmFsdWUiLCJ1bmRlZmluZWQiLCJyZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbyIsImlzQmluYXJ5IiwiQnVmZmVyIiwiZnJvbSIsImZyb21TdHJpbmciLCJfaXNDdXN0b21UeXBlIiwidG9KU09OVmFsdWUiLCJyZXBsYWNlVHlwZXMiLCJhdG9tVHJhbnNmb3JtZXIiLCJyZXBsYWNlZFRvcExldmVsQXRvbSIsIl9yZWYyIiwidmFsIiwidmFsUmVwbGFjZWQiLCJNb25nb0Nvbm5lY3Rpb24iLCJ1cmwiLCJvcHRpb25zIiwiX01ldGVvciRzZXR0aW5ncyIsIl9NZXRlb3Ikc2V0dGluZ3MkcGFjayIsIl9NZXRlb3Ikc2V0dGluZ3MkcGFjazIiLCJzZWxmIiwiX29ic2VydmVNdWx0aXBsZXhlcnMiLCJfb25GYWlsb3Zlckhvb2siLCJIb29rIiwidXNlck9wdGlvbnMiLCJfY29ubmVjdGlvbk9wdGlvbnMiLCJzZXR0aW5ncyIsInBhY2thZ2VzIiwibW9uZ28iLCJtb25nb09wdGlvbnMiLCJhc3NpZ24iLCJpZ25vcmVVbmRlZmluZWQiLCJtYXhQb29sU2l6ZSIsIm1pblBvb2xTaXplIiwiX3JlZjMiLCJlbmRzV2l0aCIsIl9yZWY0Iiwib3B0aW9uTmFtZSIsInJlcGxhY2UiLCJqb2luIiwiQXNzZXRzIiwiZ2V0U2VydmVyRGlyIiwiZGIiLCJfb3Bsb2dIYW5kbGUiLCJfZG9jRmV0Y2hlciIsImRyaXZlckluZm8iLCJyZWxlYXNlIiwiY2xpZW50IiwiTW9uZ29DbGllbnQiLCJvbiIsImJpbmRFbnZpcm9ubWVudCIsImV2ZW50IiwicHJldmlvdXNEZXNjcmlwdGlvbiIsInR5cGUiLCJuZXdEZXNjcmlwdGlvbiIsImVhY2giLCJjYWxsYmFjayIsIm9wbG9nVXJsIiwiUGFja2FnZSIsIk9wbG9nSGFuZGxlIiwiZGF0YWJhc2VOYW1lIiwiX2Nsb3NlIiwiRXJyb3IiLCJvcGxvZ0hhbmRsZSIsInN0b3AiLCJjbG9zZSIsIl9zZXRPcGxvZ0hhbmRsZSIsInJhd0NvbGxlY3Rpb24iLCJjb2xsZWN0aW9uTmFtZSIsImNvbGxlY3Rpb24iLCJjcmVhdGVDYXBwZWRDb2xsZWN0aW9uQXN5bmMiLCJieXRlU2l6ZSIsIm1heERvY3VtZW50cyIsImNyZWF0ZUNvbGxlY3Rpb24iLCJjYXBwZWQiLCJzaXplIiwibWF4IiwiX21heWJlQmVnaW5Xcml0ZSIsImZlbmNlIiwiRERQU2VydmVyIiwiX2dldEN1cnJlbnRGZW5jZSIsImJlZ2luV3JpdGUiLCJjb21taXR0ZWQiLCJfb25GYWlsb3ZlciIsInJlZ2lzdGVyIiwid3JpdGVDYWxsYmFjayIsIndyaXRlIiwicmVmcmVzaCIsImVyciIsInJlc3VsdCIsInJlZnJlc2hFcnIiLCJiaW5kRW52aXJvbm1lbnRGb3JXcml0ZSIsImluc2VydEFzeW5jIiwiY29sbGVjdGlvbl9uYW1lIiwiZSIsIl9leHBlY3RlZEJ5VGVzdCIsIkxvY2FsQ29sbGVjdGlvbiIsIl9pc1BsYWluT2JqZWN0IiwiaWQiLCJfaWQiLCJpbnNlcnRPbmUiLCJzYWZlIiwidGhlbiIsIl9yZWY1IiwiaW5zZXJ0ZWRJZCIsImNhdGNoIiwiX3JlZnJlc2giLCJzZWxlY3RvciIsInJlZnJlc2hLZXkiLCJzcGVjaWZpY0lkcyIsIl9pZHNNYXRjaGVkQnlTZWxlY3RvciIsInJlbW92ZUFzeW5jIiwiZGVsZXRlTWFueSIsIl9yZWY2IiwiZGVsZXRlZENvdW50IiwidHJhbnNmb3JtUmVzdWx0IiwibW9kaWZpZWRDb3VudCIsIm51bWJlckFmZmVjdGVkIiwiZHJvcENvbGxlY3Rpb25Bc3luYyIsImRyb3BDb2xsZWN0aW9uIiwiZHJvcCIsImRyb3BEYXRhYmFzZUFzeW5jIiwiZHJvcERhdGFiYXNlIiwiX2Ryb3BEYXRhYmFzZSIsInVwZGF0ZUFzeW5jIiwibW9kIiwiZXJyb3IiLCJtb25nb09wdHMiLCJhcnJheUZpbHRlcnMiLCJ1cHNlcnQiLCJtdWx0aSIsImZ1bGxSZXN1bHQiLCJtb25nb1NlbGVjdG9yIiwibW9uZ29Nb2QiLCJpc01vZGlmeSIsIl9pc01vZGlmaWNhdGlvbk1vZCIsIl9mb3JiaWRSZXBsYWNlIiwia25vd25JZCIsIm5ld0RvYyIsIl9jcmVhdGVVcHNlcnREb2N1bWVudCIsImdlbmVyYXRlZElkIiwic2ltdWxhdGVVcHNlcnRXaXRoSW5zZXJ0ZWRJZCIsIl9yZXR1cm5PYmplY3QiLCJoYXNPd25Qcm9wZXJ0eSIsIiRzZXRPbkluc2VydCIsInN0cmluZ3MiLCJzdGFydHNXaXRoIiwidXBkYXRlTWV0aG9kIiwibWV0ZW9yUmVzdWx0IiwiZHJpdmVyUmVzdWx0IiwibW9uZ29SZXN1bHQiLCJ1cHNlcnRlZENvdW50IiwidXBzZXJ0ZWRJZCIsIm4iLCJtYXRjaGVkQ291bnQiLCJOVU1fT1BUSU1JU1RJQ19UUklFUyIsIl9pc0Nhbm5vdENoYW5nZUlkRXJyb3IiLCJlcnJtc2ciLCJpbmRleE9mIiwibW9uZ29PcHRzRm9yVXBkYXRlIiwibW9uZ29PcHRzRm9ySW5zZXJ0IiwicmVwbGFjZW1lbnRXaXRoSWQiLCJ0cmllcyIsImRvVXBkYXRlIiwibWV0aG9kIiwidXBkYXRlTWFueSIsInNvbWUiLCJyZXBsYWNlT25lIiwiZG9Db25kaXRpb25hbEluc2VydCIsInVwc2VydEFzeW5jIiwiZmluZCIsImFyZ3VtZW50cyIsIkN1cnNvciIsIkN1cnNvckRlc2NyaXB0aW9uIiwiZmluZE9uZUFzeW5jIiwibGltaXQiLCJyZXN1bHRzIiwiZmV0Y2giLCJjcmVhdGVJbmRleEFzeW5jIiwiaW5kZXgiLCJjcmVhdGVJbmRleCIsImNvdW50RG9jdW1lbnRzIiwiX2xlbiIsImFyZ3MiLCJfa2V5IiwiYXJnIiwiZXN0aW1hdGVkRG9jdW1lbnRDb3VudCIsIl9sZW4yIiwiX2tleTIiLCJlbnN1cmVJbmRleEFzeW5jIiwiZHJvcEluZGV4QXN5bmMiLCJpbmRleE5hbWUiLCJkcm9wSW5kZXgiLCJtIiwiY29uY2F0IiwiQ29sbGVjdGlvbiIsIl9yZXdyaXRlU2VsZWN0b3IiLCJjdXJzb3JEZXNjcmlwdGlvbiIsIl9tb25nbyIsIl9jdXJzb3JEZXNjcmlwdGlvbiIsIl9zeW5jaHJvbm91c0N1cnNvciIsInNldHVwU3luY2hyb25vdXNDdXJzb3IiLCJjdXJzb3IiLCJ0YWlsYWJsZSIsIl9jcmVhdGVTeW5jaHJvbm91c0N1cnNvciIsInNlbGZGb3JJdGVyYXRpb24iLCJ1c2VUcmFuc2Zvcm0iLCJjb3VudEFzeW5jIiwiY291bnQiLCJTeW1ib2wiLCJpdGVyYXRvciIsImFzeW5jSXRlcmF0b3IiLCJtZXRob2ROYW1lIiwibWV0aG9kTmFtZUFzeW5jIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJnZXRUcmFuc2Zvcm0iLCJ0cmFuc2Zvcm0iLCJfcHVibGlzaEN1cnNvciIsInN1YiIsIl9nZXRDb2xsZWN0aW9uTmFtZSIsIm9ic2VydmUiLCJjYWxsYmFja3MiLCJfb2JzZXJ2ZUZyb21PYnNlcnZlQ2hhbmdlcyIsIm9ic2VydmVBc3luYyIsIm9ic2VydmVDaGFuZ2VzIiwibWV0aG9kcyIsIm9yZGVyZWQiLCJfb2JzZXJ2ZUNoYW5nZXNDYWxsYmFja3NBcmVPcmRlcmVkIiwiZXhjZXB0aW9uTmFtZSIsIl9mcm9tT2JzZXJ2ZSIsIl9vYnNlcnZlQ2hhbmdlcyIsIm5vbk11dGF0aW5nQ2FsbGJhY2tzIiwib2JzZXJ2ZUNoYW5nZXNBc3luYyIsImN1cnNvck9wdGlvbnMiLCJzb3J0Iiwic2tpcCIsInByb2plY3Rpb24iLCJmaWVsZHMiLCJyZWFkUHJlZmVyZW5jZSIsIm51bWJlck9mUmV0cmllcyIsImRiQ3Vyc29yIiwiYWRkQ3Vyc29yRmxhZyIsIk9QTE9HX0NPTExFQ1RJT04iLCJ0cyIsIm1heFRpbWVNcyIsIm1heFRpbWVNUyIsImhpbnQiLCJBc3luY2hyb25vdXNDdXJzb3IiLCJjb25zdHJ1Y3RvciIsIl9kYkN1cnNvciIsIl9zZWxmRm9ySXRlcmF0aW9uIiwiX3RyYW5zZm9ybSIsIndyYXBUcmFuc2Zvcm0iLCJfdmlzaXRlZElkcyIsIl9JZE1hcCIsIm5leHQiLCJfbmV4dE9iamVjdFByb21pc2UiLCJkb25lIiwiX3Jhd05leHRPYmplY3RQcm9taXNlIiwiY29uc29sZSIsImRvYyIsIl8iLCJzZXQiLCJfbmV4dE9iamVjdFByb21pc2VXaXRoVGltZW91dCIsInRpbWVvdXRNUyIsIm5leHRPYmplY3RQcm9taXNlIiwidGltZW91dEVyciIsInRpbWVvdXRQcm9taXNlIiwic2V0VGltZW91dCIsInJhY2UiLCJ0aGlzQXJnIiwiX3Jld2luZCIsImlkeCIsImNhbGwiLCJwdXNoIiwicmV3aW5kIiwiZ2V0UmF3T2JqZWN0cyIsIlN5bmNocm9ub3VzQ3Vyc29yIiwiX3N5bmNocm9ub3VzQ291bnQiLCJGdXR1cmUiLCJ3cmFwIiwidGltZXIiLCJfbmV4dE9iamVjdCIsImF3YWl0Iiwid3JhcHBlZEZuIiwid3JhcEZuIiwicmVzIiwid2FpdCIsInN5bmNSZXN1bHQiLCJ0YWlsIiwiZG9jQ2FsbGJhY2siLCJzdG9wcGVkIiwibGFzdFRTIiwiZGVmZXIiLCJsb29wIiwibmV3U2VsZWN0b3IiLCIkZ3QiLCJvcGxvZ0NvbGxlY3Rpb25XYXJuaW5ncyIsIl9zZWxmJF9vcGxvZ0hhbmRsZSIsIl9vYnNlcnZlQ2hhbmdlc1RhaWxhYmxlIiwiZmllbGRzT3B0aW9ucyIsIm9ic2VydmVLZXkiLCJzdHJpbmdpZnkiLCJtdWx0aXBsZXhlciIsIm9ic2VydmVEcml2ZXIiLCJmaXJzdEhhbmRsZSIsIk9ic2VydmVNdWx0aXBsZXhlciIsIm9uU3RvcCIsIm9ic2VydmVIYW5kbGUiLCJPYnNlcnZlSGFuZGxlIiwib3Bsb2dPcHRpb25zIiwiX29wbG9nT3B0aW9ucyIsImluY2x1ZGVDb2xsZWN0aW9ucyIsImV4Y2x1ZGVDb2xsZWN0aW9ucyIsIm1hdGNoZXIiLCJzb3J0ZXIiLCJjYW5Vc2VPcGxvZyIsIl90ZXN0T25seVBvbGxDYWxsYmFjayIsImluY2x1ZGVzIiwid2FybiIsIk1pbmltb25nbyIsIk1hdGNoZXIiLCJPcGxvZ09ic2VydmVEcml2ZXIiLCJjdXJzb3JTdXBwb3J0ZWQiLCJTb3J0ZXIiLCJldmVyeSIsImYiLCJkcml2ZXJDbGFzcyIsIlBvbGxpbmdPYnNlcnZlRHJpdmVyIiwibW9uZ29IYW5kbGUiLCJfaW5pdCIsIl9vYnNlcnZlRHJpdmVyIiwiYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzIiwibGlzdGVuQWxsIiwibGlzdGVuQ2FsbGJhY2siLCJsaXN0ZW5lcnMiLCJmb3JFYWNoVHJpZ2dlciIsInRyaWdnZXIiLCJfSW52YWxpZGF0aW9uQ3Jvc3NiYXIiLCJsaXN0ZW4iLCJsaXN0ZW5lciIsInRyaWdnZXJDYWxsYmFjayIsImV4dGVuZCIsImFkZGVkQmVmb3JlIiwiYWRkZWQiLCJNb25nb1RpbWVzdGFtcCIsIkNvbm5lY3Rpb24iLCJfX3JlaWZ5X2FzeW5jX3Jlc3VsdF9fIiwiX3JlaWZ5RXJyb3IiLCJhc3luYyIsImlzRW1wdHkiLCJMb25nIiwiVE9PX0ZBUl9CRUhJTkQiLCJwcm9jZXNzIiwiZW52IiwiTUVURU9SX09QTE9HX1RPT19GQVJfQkVISU5EIiwiVEFJTF9USU1FT1VUIiwiTUVURU9SX09QTE9HX1RBSUxfVElNRU9VVCIsImlkRm9yT3AiLCJvcCIsIm8iLCJvMiIsImRiTmFtZSIsIl9vcGxvZ1VybCIsIl9kYk5hbWUiLCJfb3Bsb2dMYXN0RW50cnlDb25uZWN0aW9uIiwiX29wbG9nVGFpbENvbm5lY3Rpb24iLCJfc3RvcHBlZCIsIl90YWlsSGFuZGxlIiwiX3JlYWR5UHJvbWlzZVJlc29sdmVyIiwiX3JlYWR5UHJvbWlzZSIsInIiLCJfY3Jvc3NiYXIiLCJfQ3Jvc3NiYXIiLCJmYWN0UGFja2FnZSIsImZhY3ROYW1lIiwiX2Jhc2VPcGxvZ1NlbGVjdG9yIiwibnMiLCJSZWdFeHAiLCJfZXNjYXBlUmVnRXhwIiwiJG9yIiwiJGluIiwiJGV4aXN0cyIsIl9jYXRjaGluZ1VwUmVzb2x2ZXJzIiwiX2xhc3RQcm9jZXNzZWRUUyIsIl9vblNraXBwZWRFbnRyaWVzSG9vayIsImRlYnVnUHJpbnRFeGNlcHRpb25zIiwiX2VudHJ5UXVldWUiLCJfRG91YmxlRW5kZWRRdWV1ZSIsIl93b3JrZXJBY3RpdmUiLCJfc3RhcnRUcmFpbGluZ1Byb21pc2UiLCJfc3RhcnRUYWlsaW5nIiwiX29uT3Bsb2dFbnRyeSIsIm9yaWdpbmFsQ2FsbGJhY2siLCJub3RpZmljYXRpb24iLCJfZGVidWciLCJsaXN0ZW5IYW5kbGUiLCJvbk9wbG9nRW50cnkiLCJvblNraXBwZWRFbnRyaWVzIiwiX3dhaXRVbnRpbENhdWdodFVwIiwibGFzdEVudHJ5IiwiJG5hdHVyYWwiLCJfc2xlZXBGb3JNcyIsImxlc3NUaGFuT3JFcXVhbCIsImluc2VydEFmdGVyIiwiZ3JlYXRlclRoYW4iLCJwcm9taXNlUmVzb2x2ZXIiLCJwcm9taXNlVG9Bd2FpdCIsInNwbGljZSIsInJlc29sdmVyIiwid2FpdFVudGlsQ2F1Z2h0VXAiLCJfTWV0ZW9yJHNldHRpbmdzMiIsIl9NZXRlb3Ikc2V0dGluZ3MyJHBhYyIsIl9NZXRlb3Ikc2V0dGluZ3MyJHBhYzIiLCJtb25nb2RiVXJpIiwiTnBtIiwicGFyc2UiLCJkYXRhYmFzZSIsImlzTWFzdGVyRG9jIiwiYWRtaW4iLCJjb21tYW5kIiwiaXNtYXN0ZXIiLCJzZXROYW1lIiwibGFzdE9wbG9nRW50cnkiLCJvcGxvZ1NlbGVjdG9yIiwib3Bsb2dJbmNsdWRlQ29sbGVjdGlvbnMiLCJvcGxvZ0V4Y2x1ZGVDb2xsZWN0aW9ucyIsIiRyZWdleCIsIiRuaW4iLCJjb2xsTmFtZSIsIiRhbmQiLCJfbWF5YmVTdGFydFdvcmtlciIsImhhbmRsZURvYyIsImFwcGx5T3BzIiwibmV4dFRpbWVzdGFtcCIsImFkZCIsIk9ORSIsInNsaWNlIiwiZmlyZSIsInBvcCIsImNsZWFyIiwiX3NldExhc3RQcm9jZXNzZWRUUyIsInNoaWZ0Iiwic2VxdWVuY2VyIiwiX2RlZmluZVRvb0ZhckJlaGluZCIsIl9yZXNldFRvb0ZhckJlaGluZCIsIl9vYmplY3RXaXRob3V0UHJvcGVydGllcyIsIl9leGNsdWRlZCIsIm5leHRPYnNlcnZlSGFuZGxlSWQiLCJGYWN0cyIsImluY3JlbWVudFNlcnZlckZhY3QiLCJfb3JkZXJlZCIsIl9vblN0b3AiLCJfcXVldWUiLCJfQXN5bmNocm9ub3VzUXVldWUiLCJfaGFuZGxlcyIsIl9yZXNvbHZlciIsIl9pc1JlYWR5IiwiX2NhY2hlIiwiX0NhY2hpbmdDaGFuZ2VPYnNlcnZlciIsIl9hZGRIYW5kbGVUYXNrc1NjaGVkdWxlZEJ1dE5vdFBlcmZvcm1lZCIsImNhbGxiYWNrTmFtZXMiLCJjYWxsYmFja05hbWUiLCJfYXBwbHlDYWxsYmFjayIsInRvQXJyYXkiLCJoYW5kbGUiLCJfYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzIiwicnVuVGFzayIsIl9zZW5kQWRkcyIsInJlbW92ZUhhbmRsZSIsIl9yZWFkeSIsIl9zdG9wIiwiZnJvbVF1ZXJ5RXJyb3IiLCJyZWFkeSIsInF1ZXVlVGFzayIsInF1ZXJ5RXJyb3IiLCJvbkZsdXNoIiwiY2IiLCJhcHBseUNoYW5nZSIsImFwcGx5IiwiaGFuZGxlSWQiLCJfYWRkZWRCZWZvcmUiLCJfYWRkZWQiLCJkb2NzIiwiZm9yRWFjaEFzeW5jIiwiX211bHRpcGxleGVyIiwiYmVmb3JlIiwiZXhwb3J0IiwibW9uZ29Db25uZWN0aW9uIiwiX21vbmdvQ29ubmVjdGlvbiIsIl9jYWxsYmFja3NGb3JPcCIsIk1hcCIsImNoZWNrIiwiU3RyaW5nIiwiZ2V0IiwiZGVsZXRlIiwidGhyb3R0bGUiLCJQT0xMSU5HX1RIUk9UVExFX01TIiwiTUVURU9SX1BPTExJTkdfVEhST1RUTEVfTVMiLCJQT0xMSU5HX0lOVEVSVkFMX01TIiwiTUVURU9SX1BPTExJTkdfSU5URVJWQUxfTVMiLCJfb3B0aW9ucyIsIl9tb25nb0hhbmRsZSIsIl9zdG9wQ2FsbGJhY2tzIiwiX2N1cnNvciIsIl9yZXN1bHRzIiwiX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZCIsIl9wZW5kaW5nV3JpdGVzIiwiX2Vuc3VyZVBvbGxJc1NjaGVkdWxlZCIsIl91bnRocm90dGxlZEVuc3VyZVBvbGxJc1NjaGVkdWxlZCIsInBvbGxpbmdUaHJvdHRsZU1zIiwiX3Rhc2tRdWV1ZSIsImxpc3RlbmVyc0hhbmRsZSIsInBvbGxpbmdJbnRlcnZhbCIsInBvbGxpbmdJbnRlcnZhbE1zIiwiX3BvbGxpbmdJbnRlcnZhbCIsImludGVydmFsSGFuZGxlIiwic2V0SW50ZXJ2YWwiLCJjbGVhckludGVydmFsIiwiX3BvbGxNb25nbyIsIl9zdXNwZW5kUG9sbGluZyIsIl9yZXN1bWVQb2xsaW5nIiwiZmlyc3QiLCJuZXdSZXN1bHRzIiwib2xkUmVzdWx0cyIsIndyaXRlc0ZvckN5Y2xlIiwiY29kZSIsIkpTT04iLCJtZXNzYWdlIiwiX2RpZmZRdWVyeUNoYW5nZXMiLCJ3Iiwic3RvcENhbGxiYWNrc0NhbGxlciIsImMiLCJfYXN5bmNJdGVyYXRvciIsIm9wbG9nVjJWMUNvbnZlcnRlciIsIk1hdGNoIiwiUEhBU0UiLCJRVUVSWUlORyIsIkZFVENISU5HIiwiU1RFQURZIiwiU3dpdGNoZWRUb1F1ZXJ5IiwiZmluaXNoSWZOZWVkVG9Qb2xsUXVlcnkiLCJjdXJyZW50SWQiLCJfdXNlc09wbG9nIiwiY29tcGFyYXRvciIsImdldENvbXBhcmF0b3IiLCJoZWFwT3B0aW9ucyIsIklkTWFwIiwiX2xpbWl0IiwiX2NvbXBhcmF0b3IiLCJfc29ydGVyIiwiX3VucHVibGlzaGVkQnVmZmVyIiwiTWluTWF4SGVhcCIsIl9wdWJsaXNoZWQiLCJNYXhIZWFwIiwiX3NhZmVBcHBlbmRUb0J1ZmZlciIsIl9zdG9wSGFuZGxlcyIsIl9hZGRTdG9wSGFuZGxlcyIsIm5ld1N0b3BIYW5kbGVzIiwiZXhwZWN0ZWRQYXR0ZXJuIiwiT2JqZWN0SW5jbHVkaW5nIiwiRnVuY3Rpb24iLCJPbmVPZiIsIl9yZWdpc3RlclBoYXNlQ2hhbmdlIiwiX21hdGNoZXIiLCJfcHJvamVjdGlvbkZuIiwiX2NvbXBpbGVQcm9qZWN0aW9uIiwiX3NoYXJlZFByb2plY3Rpb24iLCJjb21iaW5lSW50b1Byb2plY3Rpb24iLCJfc2hhcmVkUHJvamVjdGlvbkZuIiwiX25lZWRUb0ZldGNoIiwiX2N1cnJlbnRseUZldGNoaW5nIiwiX2ZldGNoR2VuZXJhdGlvbiIsIl9yZXF1ZXJ5V2hlbkRvbmVUaGlzUXVlcnkiLCJfd3JpdGVzVG9Db21taXRXaGVuV2VSZWFjaFN0ZWFkeSIsIl9uZWVkVG9Qb2xsUXVlcnkiLCJfcGhhc2UiLCJfaGFuZGxlT3Bsb2dFbnRyeVF1ZXJ5aW5nIiwiX2hhbmRsZU9wbG9nRW50cnlTdGVhZHlPckZldGNoaW5nIiwiZmlyZWQiLCJfb3Bsb2dPYnNlcnZlRHJpdmVycyIsIm9uQmVmb3JlRmlyZSIsImRyaXZlcnMiLCJkcml2ZXIiLCJ2YWx1ZXMiLCJfcnVuSW5pdGlhbFF1ZXJ5IiwiX2FkZFB1Ymxpc2hlZCIsIl9ub1lpZWxkc0FsbG93ZWQiLCJvdmVyZmxvd2luZ0RvY0lkIiwibWF4RWxlbWVudElkIiwib3ZlcmZsb3dpbmdEb2MiLCJlcXVhbHMiLCJyZW1vdmUiLCJyZW1vdmVkIiwiX2FkZEJ1ZmZlcmVkIiwiX3JlbW92ZVB1Ymxpc2hlZCIsImVtcHR5IiwibmV3RG9jSWQiLCJtaW5FbGVtZW50SWQiLCJfcmVtb3ZlQnVmZmVyZWQiLCJfY2hhbmdlUHVibGlzaGVkIiwib2xkRG9jIiwicHJvamVjdGVkTmV3IiwicHJvamVjdGVkT2xkIiwiY2hhbmdlZCIsIkRpZmZTZXF1ZW5jZSIsIm1ha2VDaGFuZ2VkRmllbGRzIiwibWF4QnVmZmVyZWRJZCIsIl9hZGRNYXRjaGluZyIsIm1heFB1Ymxpc2hlZCIsIm1heEJ1ZmZlcmVkIiwidG9QdWJsaXNoIiwiY2FuQXBwZW5kVG9CdWZmZXIiLCJjYW5JbnNlcnRJbnRvQnVmZmVyIiwidG9CdWZmZXIiLCJfcmVtb3ZlTWF0Y2hpbmciLCJfaGFuZGxlRG9jIiwibWF0Y2hlc05vdyIsImRvY3VtZW50TWF0Y2hlcyIsInB1Ymxpc2hlZEJlZm9yZSIsImJ1ZmZlcmVkQmVmb3JlIiwiY2FjaGVkQmVmb3JlIiwibWluQnVmZmVyZWQiLCJzdGF5c0luUHVibGlzaGVkIiwic3RheXNJbkJ1ZmZlciIsIl9mZXRjaE1vZGlmaWVkRG9jdW1lbnRzIiwidGhpc0dlbmVyYXRpb24iLCJ3YWl0aW5nIiwiYXdhaXRhYmxlUHJvbWlzZSIsIl9iZVN0ZWFkeSIsIndyaXRlcyIsImlzUmVwbGFjZSIsImNhbkRpcmVjdGx5TW9kaWZ5RG9jIiwibW9kaWZpZXJDYW5CZURpcmVjdGx5QXBwbGllZCIsIl9tb2RpZnkiLCJjYW5CZWNvbWVUcnVlQnlNb2RpZmllciIsImFmZmVjdGVkQnlNb2RpZmllciIsIl9ydW5Jbml0aWFsUXVlcnlBc3luYyIsIl9ydW5RdWVyeSIsImluaXRpYWwiLCJfZG9uZVF1ZXJ5aW5nIiwiX3BvbGxRdWVyeSIsIl9ydW5RdWVyeUFzeW5jIiwibmV3QnVmZmVyIiwiX2N1cnNvckZvclF1ZXJ5IiwiaSIsIl9wdWJsaXNoTmV3UmVzdWx0cyIsIm9wdGlvbnNPdmVyd3JpdGUiLCJkZXNjcmlwdGlvbiIsImlkc1RvUmVtb3ZlIiwiX29wbG9nRW50cnlIYW5kbGUiLCJfbGlzdGVuZXJzSGFuZGxlIiwiX2l0ZXJhdG9yQWJydXB0Q29tcGxldGlvbiIsIl9kaWRJdGVyYXRvckVycm9yIiwiX2l0ZXJhdG9yRXJyb3IiLCJfaXRlcmF0b3IiLCJfc3RlcCIsInJldHVybiIsInBoYXNlIiwibm93IiwiRGF0ZSIsInRpbWVEaWZmIiwiX3BoYXNlU3RhcnRUaW1lIiwiZGlzYWJsZU9wbG9nIiwiX2Rpc2FibGVPcGxvZyIsIl9jaGVja1N1cHBvcnRlZFByb2plY3Rpb24iLCJoYXNXaGVyZSIsImhhc0dlb1F1ZXJ5IiwibW9kaWZpZXIiLCJvcGVyYXRpb24iLCJmaWVsZCIsInRlc3QiLCJwcmVmaXgiLCJhcnJheU9wZXJhdG9yS2V5UmVnZXgiLCJpc0FycmF5T3BlcmF0b3JLZXkiLCJpc0FycmF5T3BlcmF0b3IiLCJvcGVyYXRvciIsImEiLCJmbGF0dGVuT2JqZWN0SW50byIsInRhcmdldCIsInNvdXJjZSIsImxvZ0RlYnVnTWVzc2FnZXMiLCJPUExPR19DT05WRVJURVJfREVCVUciLCJjb252ZXJ0T3Bsb2dEaWZmIiwib3Bsb2dFbnRyeSIsImRpZmYiLCJsb2ciLCJkaWZmS2V5IiwiX29wbG9nRW50cnkkJHVuc2V0IiwiJHVuc2V0IiwiX29wbG9nRW50cnkkJHNldCIsIiRzZXQiLCJfb3Bsb2dFbnRyeSQkc2V0MiIsInBvc2l0aW9uIiwicG9zaXRpb25LZXkiLCJfb3Bsb2dFbnRyeSQkdW5zZXQyIiwiX29wbG9nRW50cnkkJHNldDMiLCIkdiIsImNvbnZlcnRlZE9wbG9nRW50cnkiLCJMb2NhbENvbGxlY3Rpb25Ecml2ZXIiLCJub0Nvbm5Db2xsZWN0aW9ucyIsImNyZWF0ZSIsIm9wZW4iLCJjb25uIiwiZW5zdXJlQ29sbGVjdGlvbiIsIl9tb25nb19saXZlZGF0YV9jb2xsZWN0aW9ucyIsImNvbGxlY3Rpb25zIiwib25jZSIsIkFTWU5DX0NPTExFQ1RJT05fTUVUSE9EUyIsIlJlbW90ZUNvbGxlY3Rpb25Ecml2ZXIiLCJtb25nb191cmwiLCJSRU1PVEVfQ09MTEVDVElPTl9NRVRIT0RTIiwiYXN5bmNNZXRob2ROYW1lIiwiZGVmYXVsdFJlbW90ZUNvbGxlY3Rpb25Ecml2ZXIiLCJjb25uZWN0aW9uT3B0aW9ucyIsIm1vbmdvVXJsIiwiTU9OR09fVVJMIiwiTU9OR09fT1BMT0dfVVJMIiwic3RhcnR1cCIsImNvbm5lY3QiLCJub3JtYWxpemVQcm9qZWN0aW9uIiwiY29ubmVjdGlvbiIsIm1hbmFnZXIiLCJpZEdlbmVyYXRpb24iLCJfZHJpdmVyIiwiX3ByZXZlbnRBdXRvcHVibGlzaCIsIl9tYWtlTmV3SUQiLCJzcmMiLCJERFAiLCJyYW5kb21TdHJlYW0iLCJSYW5kb20iLCJpbnNlY3VyZSIsImhleFN0cmluZyIsInJlc29sdmVyVHlwZSIsIl9jb25uZWN0aW9uIiwiaXNDbGllbnQiLCJzZXJ2ZXIiLCJfY29sbGVjdGlvbiIsIl9uYW1lIiwiX3NldHRpbmdVcFJlcGxpY2F0aW9uUHJvbWlzZSIsIl9tYXliZVNldFVwUmVwbGljYXRpb24iLCJkZWZpbmVNdXRhdGlvbk1ldGhvZHMiLCJfZGVmaW5lTXV0YXRpb25NZXRob2RzIiwidXNlRXhpc3RpbmciLCJfc3VwcHJlc3NTYW1lTmFtZUVycm9yIiwiYXV0b3B1Ymxpc2giLCJwdWJsaXNoIiwiaXNfYXV0byIsIl9jb2xsZWN0aW9ucyIsIl9yZWdpc3RlclN0b3JlUmVzdWx0IiwiX3JlZ2lzdGVyU3RvcmVSZXN1bHQkIiwicmVnaXN0ZXJTdG9yZUNsaWVudCIsInJlZ2lzdGVyU3RvcmVTZXJ2ZXIiLCJ3cmFwcGVkU3RvcmVDb21tb24iLCJzYXZlT3JpZ2luYWxzIiwicmV0cmlldmVPcmlnaW5hbHMiLCJfZ2V0Q29sbGVjdGlvbiIsIndyYXBwZWRTdG9yZUNsaWVudCIsImJlZ2luVXBkYXRlIiwiYmF0Y2hTaXplIiwicmVzZXQiLCJwYXVzZU9ic2VydmVycyIsInVwZGF0ZSIsIm1zZyIsIm1vbmdvSWQiLCJNb25nb0lEIiwiaWRQYXJzZSIsIl9kb2NzIiwiaW5zZXJ0IiwiZW5kVXBkYXRlIiwicmVzdW1lT2JzZXJ2ZXJzQ2xpZW50IiwiZ2V0RG9jIiwiZmluZE9uZSIsIndyYXBwZWRTdG9yZVNlcnZlciIsInJlc3VtZU9ic2VydmVyc1NlcnZlciIsInJlZ2lzdGVyU3RvcmVSZXN1bHQiLCJsb2dXYXJuIiwib2siLCJfZ2V0RmluZFNlbGVjdG9yIiwiX2dldEZpbmRPcHRpb25zIiwibmV3T3B0aW9ucyIsIk9wdGlvbmFsIiwiTnVtYmVyIiwiX2xlbjMiLCJfa2V5MyIsImZhbGxiYWNrSWQiLCJfc2VsZWN0b3JJc0lkIiwiX2luc2VydCIsImdldFByb3RvdHlwZU9mIiwiZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycyIsImdlbmVyYXRlSWQiLCJfaXNSZW1vdGVDb2xsZWN0aW9uIiwiZW5jbG9zaW5nIiwiX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uIiwiY2hvb3NlUmV0dXJuVmFsdWVGcm9tQ29sbGVjdGlvblJlc3VsdCIsIl9pc1Byb21pc2UiLCJ3cmFwcGVkQ2FsbGJhY2siLCJ3cmFwQ2FsbGJhY2siLCJfY2FsbE11dGF0b3JNZXRob2QiLCJfaW5zZXJ0QXN5bmMiLCJwcm9taXNlIiwiX2NhbGxNdXRhdG9yTWV0aG9kQXN5bmMiLCJzdHViUHJvbWlzZSIsInNlcnZlclByb21pc2UiLCJfbGVuNCIsIm9wdGlvbnNBbmRDYWxsYmFjayIsIl9rZXk0IiwicG9wQ2FsbGJhY2tGcm9tQXJncyIsIkxvZyIsImRlYnVnIiwicmVDcmVhdGVJbmRleE9uT3B0aW9uTWlzbWF0Y2giLCJpbmZvIiwicmF3RGF0YWJhc2UiLCJnZXRDb2xsZWN0aW9uIiwiY29udmVydFJlc3VsdCIsIkFsbG93RGVueSIsIkNvbGxlY3Rpb25Qcm90b3R5cGUiLCJzZXRDb25uZWN0aW9uT3B0aW9ucyIsIm90aGVyT3B0aW9ucyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBQUEsSUFBSUEsYUFBYTtJQUFDQyxPQUFPLENBQUNDLElBQUksQ0FBQyxzQ0FBc0MsRUFBQztNQUFDQyxPQUFPQSxDQUFDQyxDQUFDLEVBQUM7UUFBQ0osYUFBYSxHQUFDSSxDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQXRH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LElBQUEsRUFBQTBkLFNBQUE7TUFDM0M7TUFDQTs7TUFFQSxPQUFBbmdCLGFBQUEsQ0FBQUEsYUFBQSxLQUNLczNCLFlBQVksR0FDWHRrQixVQUFVLElBQUlDLE1BQU0sR0FBRztRQUFFRCxVQUFVLEVBQUVDLE1BQU0sSUFBSUQ7TUFBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRXhFLENBQUM7SUFBQytHLHNCQUFBO0VBQUEsU0FBQUMsV0FBQTtJQUFBLE9BQUFELHNCQUFBLENBQUFDLFdBQUE7RUFBQTtFQUFBRCxzQkFBQTtBQUFBO0VBQUF6VSxJQUFBO0VBQUEyVSxLQUFBO0FBQUEsRyIsImZpbGUiOiIvcGFja2FnZXMvbW9uZ28uanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgaGFzIGZyb20gJ2xvZGFzaC5oYXMnO1xuaW1wb3J0IGlkZW50aXR5IGZyb20gJ2xvZGFzaC5pZGVudGl0eSc7XG5pbXBvcnQgY2xvbmUgZnJvbSAnbG9kYXNoLmNsb25lJztcblxuLyoqXG4gKiBQcm92aWRlIGEgc3luY2hyb25vdXMgQ29sbGVjdGlvbiBBUEkgdXNpbmcgZmliZXJzLCBiYWNrZWQgYnlcbiAqIE1vbmdvREIuICBUaGlzIGlzIG9ubHkgZm9yIHVzZSBvbiB0aGUgc2VydmVyLCBhbmQgbW9zdGx5IGlkZW50aWNhbFxuICogdG8gdGhlIGNsaWVudCBBUEkuXG4gKlxuICogTk9URTogdGhlIHB1YmxpYyBBUEkgbWV0aG9kcyBtdXN0IGJlIHJ1biB3aXRoaW4gYSBmaWJlci4gSWYgeW91IGNhbGxcbiAqIHRoZXNlIG91dHNpZGUgb2YgYSBmaWJlciB0aGV5IHdpbGwgZXhwbG9kZSFcbiAqL1xuXG5jb25zdCBwYXRoID0gcmVxdWlyZShcInBhdGhcIik7XG5jb25zdCB1dGlsID0gcmVxdWlyZShcInV0aWxcIik7XG5cbi8qKiBAdHlwZSB7aW1wb3J0KCdtb25nb2RiJyl9ICovXG52YXIgTW9uZ29EQiA9IE5wbU1vZHVsZU1vbmdvZGI7XG5pbXBvcnQgeyBEb2NGZXRjaGVyIH0gZnJvbSBcIi4vZG9jX2ZldGNoZXIuanNcIjtcbmltcG9ydCB7XG4gIEFTWU5DX0NVUlNPUl9NRVRIT0RTLFxuICBDTElFTlRfT05MWV9NRVRIT0RTLFxuICBnZXRBc3luY01ldGhvZE5hbWVcbn0gZnJvbSBcIm1ldGVvci9taW5pbW9uZ28vY29uc3RhbnRzXCI7XG5pbXBvcnQgeyBNZXRlb3IgfSBmcm9tIFwibWV0ZW9yL21ldGVvclwiO1xuXG5Nb25nb0ludGVybmFscyA9IHt9O1xuXG5Nb25nb0ludGVybmFscy5fX3BhY2thZ2VOYW1lID0gJ21vbmdvJztcblxuTW9uZ29JbnRlcm5hbHMuTnBtTW9kdWxlcyA9IHtcbiAgbW9uZ29kYjoge1xuICAgIHZlcnNpb246IE5wbU1vZHVsZU1vbmdvZGJWZXJzaW9uLFxuICAgIG1vZHVsZTogTW9uZ29EQlxuICB9XG59O1xuXG4vLyBPbGRlciB2ZXJzaW9uIG9mIHdoYXQgaXMgbm93IGF2YWlsYWJsZSB2aWFcbi8vIE1vbmdvSW50ZXJuYWxzLk5wbU1vZHVsZXMubW9uZ29kYi5tb2R1bGUuICBJdCB3YXMgbmV2ZXIgZG9jdW1lbnRlZCwgYnV0XG4vLyBwZW9wbGUgZG8gdXNlIGl0LlxuLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjJcbk1vbmdvSW50ZXJuYWxzLk5wbU1vZHVsZSA9IE1vbmdvREI7XG5cbmNvbnN0IEZJTEVfQVNTRVRfU1VGRklYID0gJ0Fzc2V0JztcbmNvbnN0IEFTU0VUU19GT0xERVIgPSAnYXNzZXRzJztcbmNvbnN0IEFQUF9GT0xERVIgPSAnYXBwJztcblxuLy8gVGhpcyBpcyB1c2VkIHRvIGFkZCBvciByZW1vdmUgRUpTT04gZnJvbSB0aGUgYmVnaW5uaW5nIG9mIGV2ZXJ5dGhpbmcgbmVzdGVkXG4vLyBpbnNpZGUgYW4gRUpTT04gY3VzdG9tIHR5cGUuIEl0IHNob3VsZCBvbmx5IGJlIGNhbGxlZCBvbiBwdXJlIEpTT04hXG52YXIgcmVwbGFjZU5hbWVzID0gZnVuY3Rpb24gKGZpbHRlciwgdGhpbmcpIHtcbiAgaWYgKHR5cGVvZiB0aGluZyA9PT0gXCJvYmplY3RcIiAmJiB0aGluZyAhPT0gbnVsbCkge1xuICAgIGlmIChBcnJheS5pc0FycmF5KHRoaW5nKSkge1xuICAgICAgcmV0dXJuIHRoaW5nLm1hcChyZXBsYWNlTmFtZXMuYmluZChudWxsLCBmaWx0ZXIpKTtcbiAgICB9XG4gICAgdmFyIHJldCA9IHt9O1xuICAgIE9iamVjdC5lbnRyaWVzKHRoaW5nKS5mb3JFYWNoKGZ1bmN0aW9uIChba2V5LCB2YWx1ZV0pIHtcbiAgICAgIHJldFtmaWx0ZXIoa2V5KV0gPSByZXBsYWNlTmFtZXMoZmlsdGVyLCB2YWx1ZSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuICByZXR1cm4gdGhpbmc7XG59O1xuXG4vLyBFbnN1cmUgdGhhdCBFSlNPTi5jbG9uZSBrZWVwcyBhIFRpbWVzdGFtcCBhcyBhIFRpbWVzdGFtcCAoaW5zdGVhZCBvZiBqdXN0XG4vLyBkb2luZyBhIHN0cnVjdHVyYWwgY2xvbmUpLlxuLy8gWFhYIGhvdyBvayBpcyB0aGlzPyB3aGF0IGlmIHRoZXJlIGFyZSBtdWx0aXBsZSBjb3BpZXMgb2YgTW9uZ29EQiBsb2FkZWQ/XG5Nb25nb0RCLlRpbWVzdGFtcC5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbiAoKSB7XG4gIC8vIFRpbWVzdGFtcHMgc2hvdWxkIGJlIGltbXV0YWJsZS5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG52YXIgbWFrZU1vbmdvTGVnYWwgPSBmdW5jdGlvbiAobmFtZSkgeyByZXR1cm4gXCJFSlNPTlwiICsgbmFtZTsgfTtcbnZhciB1bm1ha2VNb25nb0xlZ2FsID0gZnVuY3Rpb24gKG5hbWUpIHsgcmV0dXJuIG5hbWUuc3Vic3RyKDUpOyB9O1xuXG52YXIgcmVwbGFjZU1vbmdvQXRvbVdpdGhNZXRlb3IgPSBmdW5jdGlvbiAoZG9jdW1lbnQpIHtcbiAgaWYgKGRvY3VtZW50IGluc3RhbmNlb2YgTW9uZ29EQi5CaW5hcnkpIHtcbiAgICAvLyBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHlcbiAgICBpZiAoZG9jdW1lbnQuc3ViX3R5cGUgIT09IDApIHtcbiAgICAgIHJldHVybiBkb2N1bWVudDtcbiAgICB9XG4gICAgdmFyIGJ1ZmZlciA9IGRvY3VtZW50LnZhbHVlKHRydWUpO1xuICAgIHJldHVybiBuZXcgVWludDhBcnJheShidWZmZXIpO1xuICB9XG4gIGlmIChkb2N1bWVudCBpbnN0YW5jZW9mIE1vbmdvREIuT2JqZWN0SUQpIHtcbiAgICByZXR1cm4gbmV3IE1vbmdvLk9iamVjdElEKGRvY3VtZW50LnRvSGV4U3RyaW5nKCkpO1xuICB9XG4gIGlmIChkb2N1bWVudCBpbnN0YW5jZW9mIE1vbmdvREIuRGVjaW1hbDEyOCkge1xuICAgIHJldHVybiBEZWNpbWFsKGRvY3VtZW50LnRvU3RyaW5nKCkpO1xuICB9XG4gIGlmIChkb2N1bWVudFtcIkVKU09OJHR5cGVcIl0gJiYgZG9jdW1lbnRbXCJFSlNPTiR2YWx1ZVwiXSAmJiBPYmplY3Qua2V5cyhkb2N1bWVudCkubGVuZ3RoID09PSAyKSB7XG4gICAgcmV0dXJuIEVKU09OLmZyb21KU09OVmFsdWUocmVwbGFjZU5hbWVzKHVubWFrZU1vbmdvTGVnYWwsIGRvY3VtZW50KSk7XG4gIH1cbiAgaWYgKGRvY3VtZW50IGluc3RhbmNlb2YgTW9uZ29EQi5UaW1lc3RhbXApIHtcbiAgICAvLyBGb3Igbm93LCB0aGUgTWV0ZW9yIHJlcHJlc2VudGF0aW9uIG9mIGEgTW9uZ28gdGltZXN0YW1wIHR5cGUgKG5vdCBhIGRhdGUhXG4gICAgLy8gdGhpcyBpcyBhIHdlaXJkIGludGVybmFsIHRoaW5nIHVzZWQgaW4gdGhlIG9wbG9nISkgaXMgdGhlIHNhbWUgYXMgdGhlXG4gICAgLy8gTW9uZ28gcmVwcmVzZW50YXRpb24uIFdlIG5lZWQgdG8gZG8gdGhpcyBleHBsaWNpdGx5IG9yIGVsc2Ugd2Ugd291bGQgZG8gYVxuICAgIC8vIHN0cnVjdHVyYWwgY2xvbmUgYW5kIGxvc2UgdGhlIHByb3RvdHlwZS5cbiAgICByZXR1cm4gZG9jdW1lbnQ7XG4gIH1cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn07XG5cbnZhciByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbyA9IGZ1bmN0aW9uIChkb2N1bWVudCkge1xuICBpZiAoRUpTT04uaXNCaW5hcnkoZG9jdW1lbnQpKSB7XG4gICAgLy8gVGhpcyBkb2VzIG1vcmUgY29waWVzIHRoYW4gd2UnZCBsaWtlLCBidXQgaXMgbmVjZXNzYXJ5IGJlY2F1c2VcbiAgICAvLyBNb25nb0RCLkJTT04gb25seSBsb29rcyBsaWtlIGl0IHRha2VzIGEgVWludDhBcnJheSAoYW5kIGRvZXNuJ3QgYWN0dWFsbHlcbiAgICAvLyBzZXJpYWxpemUgaXQgY29ycmVjdGx5KS5cbiAgICByZXR1cm4gbmV3IE1vbmdvREIuQmluYXJ5KEJ1ZmZlci5mcm9tKGRvY3VtZW50KSk7XG4gIH1cbiAgaWYgKGRvY3VtZW50IGluc3RhbmNlb2YgTW9uZ29EQi5CaW5hcnkpIHtcbiAgICAgcmV0dXJuIGRvY3VtZW50O1xuICB9XG4gIGlmIChkb2N1bWVudCBpbnN0YW5jZW9mIE1vbmdvLk9iamVjdElEKSB7XG4gICAgcmV0dXJuIG5ldyBNb25nb0RCLk9iamVjdElEKGRvY3VtZW50LnRvSGV4U3RyaW5nKCkpO1xuICB9XG4gIGlmIChkb2N1bWVudCBpbnN0YW5jZW9mIE1vbmdvREIuVGltZXN0YW1wKSB7XG4gICAgLy8gRm9yIG5vdywgdGhlIE1ldGVvciByZXByZXNlbnRhdGlvbiBvZiBhIE1vbmdvIHRpbWVzdGFtcCB0eXBlIChub3QgYSBkYXRlIVxuICAgIC8vIHRoaXMgaXMgYSB3ZWlyZCBpbnRlcm5hbCB0aGluZyB1c2VkIGluIHRoZSBvcGxvZyEpIGlzIHRoZSBzYW1lIGFzIHRoZVxuICAgIC8vIE1vbmdvIHJlcHJlc2VudGF0aW9uLiBXZSBuZWVkIHRvIGRvIHRoaXMgZXhwbGljaXRseSBvciBlbHNlIHdlIHdvdWxkIGRvIGFcbiAgICAvLyBzdHJ1Y3R1cmFsIGNsb25lIGFuZCBsb3NlIHRoZSBwcm90b3R5cGUuXG4gICAgcmV0dXJuIGRvY3VtZW50O1xuICB9XG4gIGlmIChkb2N1bWVudCBpbnN0YW5jZW9mIERlY2ltYWwpIHtcbiAgICByZXR1cm4gTW9uZ29EQi5EZWNpbWFsMTI4LmZyb21TdHJpbmcoZG9jdW1lbnQudG9TdHJpbmcoKSk7XG4gIH1cbiAgaWYgKEVKU09OLl9pc0N1c3RvbVR5cGUoZG9jdW1lbnQpKSB7XG4gICAgcmV0dXJuIHJlcGxhY2VOYW1lcyhtYWtlTW9uZ29MZWdhbCwgRUpTT04udG9KU09OVmFsdWUoZG9jdW1lbnQpKTtcbiAgfVxuICAvLyBJdCBpcyBub3Qgb3JkaW5hcmlseSBwb3NzaWJsZSB0byBzdGljayBkb2xsYXItc2lnbiBrZXlzIGludG8gbW9uZ29cbiAgLy8gc28gd2UgZG9uJ3QgYm90aGVyIGNoZWNraW5nIGZvciB0aGluZ3MgdGhhdCBuZWVkIGVzY2FwaW5nIGF0IHRoaXMgdGltZS5cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn07XG5cbnZhciByZXBsYWNlVHlwZXMgPSBmdW5jdGlvbiAoZG9jdW1lbnQsIGF0b21UcmFuc2Zvcm1lcikge1xuICBpZiAodHlwZW9mIGRvY3VtZW50ICE9PSAnb2JqZWN0JyB8fCBkb2N1bWVudCA9PT0gbnVsbClcbiAgICByZXR1cm4gZG9jdW1lbnQ7XG5cbiAgdmFyIHJlcGxhY2VkVG9wTGV2ZWxBdG9tID0gYXRvbVRyYW5zZm9ybWVyKGRvY3VtZW50KTtcbiAgaWYgKHJlcGxhY2VkVG9wTGV2ZWxBdG9tICE9PSB1bmRlZmluZWQpXG4gICAgcmV0dXJuIHJlcGxhY2VkVG9wTGV2ZWxBdG9tO1xuXG4gIHZhciByZXQgPSBkb2N1bWVudDtcbiAgT2JqZWN0LmVudHJpZXMoZG9jdW1lbnQpLmZvckVhY2goZnVuY3Rpb24gKFtrZXksIHZhbF0pIHtcbiAgICB2YXIgdmFsUmVwbGFjZWQgPSByZXBsYWNlVHlwZXModmFsLCBhdG9tVHJhbnNmb3JtZXIpO1xuICAgIGlmICh2YWwgIT09IHZhbFJlcGxhY2VkKSB7XG4gICAgICAvLyBMYXp5IGNsb25lLiBTaGFsbG93IGNvcHkuXG4gICAgICBpZiAocmV0ID09PSBkb2N1bWVudClcbiAgICAgICAgcmV0ID0gY2xvbmUoZG9jdW1lbnQpO1xuICAgICAgcmV0W2tleV0gPSB2YWxSZXBsYWNlZDtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gcmV0O1xufTtcblxuXG5Nb25nb0Nvbm5lY3Rpb24gPSBmdW5jdGlvbiAodXJsLCBvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIHNlbGYuX29ic2VydmVNdWx0aXBsZXhlcnMgPSB7fTtcbiAgc2VsZi5fb25GYWlsb3Zlckhvb2sgPSBuZXcgSG9vaztcblxuICBjb25zdCB1c2VyT3B0aW9ucyA9IHtcbiAgICAuLi4oTW9uZ28uX2Nvbm5lY3Rpb25PcHRpb25zIHx8IHt9KSxcbiAgICAuLi4oTWV0ZW9yLnNldHRpbmdzPy5wYWNrYWdlcz8ubW9uZ28/Lm9wdGlvbnMgfHwge30pXG4gIH07XG5cbiAgdmFyIG1vbmdvT3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe1xuICAgIGlnbm9yZVVuZGVmaW5lZDogdHJ1ZSxcbiAgfSwgdXNlck9wdGlvbnMpO1xuXG5cblxuICAvLyBJbnRlcm5hbGx5IHRoZSBvcGxvZyBjb25uZWN0aW9ucyBzcGVjaWZ5IHRoZWlyIG93biBtYXhQb29sU2l6ZVxuICAvLyB3aGljaCB3ZSBkb24ndCB3YW50IHRvIG92ZXJ3cml0ZSB3aXRoIGFueSB1c2VyIGRlZmluZWQgdmFsdWVcbiAgaWYgKGhhcyhvcHRpb25zLCAnbWF4UG9vbFNpemUnKSkge1xuICAgIC8vIElmIHdlIGp1c3Qgc2V0IHRoaXMgZm9yIFwic2VydmVyXCIsIHJlcGxTZXQgd2lsbCBvdmVycmlkZSBpdC4gSWYgd2UganVzdFxuICAgIC8vIHNldCBpdCBmb3IgcmVwbFNldCwgaXQgd2lsbCBiZSBpZ25vcmVkIGlmIHdlJ3JlIG5vdCB1c2luZyBhIHJlcGxTZXQuXG4gICAgbW9uZ29PcHRpb25zLm1heFBvb2xTaXplID0gb3B0aW9ucy5tYXhQb29sU2l6ZTtcbiAgfVxuICBpZiAoaGFzKG9wdGlvbnMsICdtaW5Qb29sU2l6ZScpKSB7XG4gICAgbW9uZ29PcHRpb25zLm1pblBvb2xTaXplID0gb3B0aW9ucy5taW5Qb29sU2l6ZTtcbiAgfVxuXG4gIC8vIFRyYW5zZm9ybSBvcHRpb25zIGxpa2UgXCJ0bHNDQUZpbGVBc3NldFwiOiBcImZpbGVuYW1lLnBlbVwiIGludG9cbiAgLy8gXCJ0bHNDQUZpbGVcIjogXCIvPGZ1bGxwYXRoPi9maWxlbmFtZS5wZW1cIlxuICBPYmplY3QuZW50cmllcyhtb25nb09wdGlvbnMgfHwge30pXG4gICAgLmZpbHRlcigoW2tleV0pID0+IGtleSAmJiBrZXkuZW5kc1dpdGgoRklMRV9BU1NFVF9TVUZGSVgpKVxuICAgIC5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbk5hbWUgPSBrZXkucmVwbGFjZShGSUxFX0FTU0VUX1NVRkZJWCwgJycpO1xuICAgICAgbW9uZ29PcHRpb25zW29wdGlvbk5hbWVdID0gcGF0aC5qb2luKEFzc2V0cy5nZXRTZXJ2ZXJEaXIoKSxcbiAgICAgICAgQVNTRVRTX0ZPTERFUiwgQVBQX0ZPTERFUiwgdmFsdWUpO1xuICAgICAgZGVsZXRlIG1vbmdvT3B0aW9uc1trZXldO1xuICAgIH0pO1xuXG4gIHNlbGYuZGIgPSBudWxsO1xuICBzZWxmLl9vcGxvZ0hhbmRsZSA9IG51bGw7XG4gIHNlbGYuX2RvY0ZldGNoZXIgPSBudWxsO1xuXG4gIG1vbmdvT3B0aW9ucy5kcml2ZXJJbmZvID0ge1xuICAgIG5hbWU6ICdNZXRlb3InLFxuICAgIHZlcnNpb246IE1ldGVvci5yZWxlYXNlXG4gIH1cbiAgXG4gIHNlbGYuY2xpZW50ID0gbmV3IE1vbmdvREIuTW9uZ29DbGllbnQodXJsLCBtb25nb09wdGlvbnMpO1xuICBzZWxmLmRiID0gc2VsZi5jbGllbnQuZGIoKTtcblxuICBzZWxmLmNsaWVudC5vbignc2VydmVyRGVzY3JpcHRpb25DaGFuZ2VkJywgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChldmVudCA9PiB7XG4gICAgLy8gV2hlbiB0aGUgY29ubmVjdGlvbiBpcyBubyBsb25nZXIgYWdhaW5zdCB0aGUgcHJpbWFyeSBub2RlLCBleGVjdXRlIGFsbFxuICAgIC8vIGZhaWxvdmVyIGhvb2tzLiBUaGlzIGlzIGltcG9ydGFudCBmb3IgdGhlIGRyaXZlciBhcyBpdCBoYXMgdG8gcmUtcG9vbCB0aGVcbiAgICAvLyBxdWVyeSB3aGVuIGl0IGhhcHBlbnMuXG4gICAgaWYgKFxuICAgICAgZXZlbnQucHJldmlvdXNEZXNjcmlwdGlvbi50eXBlICE9PSAnUlNQcmltYXJ5JyAmJlxuICAgICAgZXZlbnQubmV3RGVzY3JpcHRpb24udHlwZSA9PT0gJ1JTUHJpbWFyeSdcbiAgICApIHtcbiAgICAgIHNlbGYuX29uRmFpbG92ZXJIb29rLmVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSkpO1xuXG4gIGlmIChvcHRpb25zLm9wbG9nVXJsICYmICEgUGFja2FnZVsnZGlzYWJsZS1vcGxvZyddKSB7XG4gICAgc2VsZi5fb3Bsb2dIYW5kbGUgPSBuZXcgT3Bsb2dIYW5kbGUob3B0aW9ucy5vcGxvZ1VybCwgc2VsZi5kYi5kYXRhYmFzZU5hbWUpO1xuICAgIHNlbGYuX2RvY0ZldGNoZXIgPSBuZXcgRG9jRmV0Y2hlcihzZWxmKTtcbiAgfVxuXG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLl9jbG9zZSA9IGFzeW5jIGZ1bmN0aW9uKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgaWYgKCEgc2VsZi5kYilcbiAgICB0aHJvdyBFcnJvcihcImNsb3NlIGNhbGxlZCBiZWZvcmUgQ29ubmVjdGlvbiBjcmVhdGVkP1wiKTtcblxuICAvLyBYWFggcHJvYmFibHkgdW50ZXN0ZWRcbiAgdmFyIG9wbG9nSGFuZGxlID0gc2VsZi5fb3Bsb2dIYW5kbGU7XG4gIHNlbGYuX29wbG9nSGFuZGxlID0gbnVsbDtcbiAgaWYgKG9wbG9nSGFuZGxlKVxuICAgIGF3YWl0IG9wbG9nSGFuZGxlLnN0b3AoKTtcblxuICAvLyBVc2UgRnV0dXJlLndyYXAgc28gdGhhdCBlcnJvcnMgZ2V0IHRocm93bi4gVGhpcyBoYXBwZW5zIHRvXG4gIC8vIHdvcmsgZXZlbiBvdXRzaWRlIGEgZmliZXIgc2luY2UgdGhlICdjbG9zZScgbWV0aG9kIGlzIG5vdFxuICAvLyBhY3R1YWxseSBhc3luY2hyb25vdXMuXG4gIGF3YWl0IHNlbGYuY2xpZW50LmNsb3NlKCk7XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5fY2xvc2UoKTtcbn07XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuX3NldE9wbG9nSGFuZGxlID0gZnVuY3Rpb24ob3Bsb2dIYW5kbGUpIHtcbiAgdGhpcy5fb3Bsb2dIYW5kbGUgPSBvcGxvZ0hhbmRsZTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBSZXR1cm5zIHRoZSBNb25nbyBDb2xsZWN0aW9uIG9iamVjdDsgbWF5IHlpZWxkLlxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5yYXdDb2xsZWN0aW9uID0gZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICBpZiAoISBzZWxmLmRiKVxuICAgIHRocm93IEVycm9yKFwicmF3Q29sbGVjdGlvbiBjYWxsZWQgYmVmb3JlIENvbm5lY3Rpb24gY3JlYXRlZD9cIik7XG5cbiAgcmV0dXJuIHNlbGYuZGIuY29sbGVjdGlvbihjb2xsZWN0aW9uTmFtZSk7XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmNyZWF0ZUNhcHBlZENvbGxlY3Rpb25Bc3luYyA9IGFzeW5jIGZ1bmN0aW9uIChcbiAgICBjb2xsZWN0aW9uTmFtZSwgYnl0ZVNpemUsIG1heERvY3VtZW50cykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgaWYgKCEgc2VsZi5kYilcbiAgICB0aHJvdyBFcnJvcihcImNyZWF0ZUNhcHBlZENvbGxlY3Rpb25Bc3luYyBjYWxsZWQgYmVmb3JlIENvbm5lY3Rpb24gY3JlYXRlZD9cIik7XG5cblxuICBhd2FpdCBzZWxmLmRiLmNyZWF0ZUNvbGxlY3Rpb24oY29sbGVjdGlvbk5hbWUsXG4gICAgeyBjYXBwZWQ6IHRydWUsIHNpemU6IGJ5dGVTaXplLCBtYXg6IG1heERvY3VtZW50cyB9KTtcbn07XG5cbi8vIFRoaXMgc2hvdWxkIGJlIGNhbGxlZCBzeW5jaHJvbm91c2x5IHdpdGggYSB3cml0ZSwgdG8gY3JlYXRlIGFcbi8vIHRyYW5zYWN0aW9uIG9uIHRoZSBjdXJyZW50IHdyaXRlIGZlbmNlLCBpZiBhbnkuIEFmdGVyIHdlIGNhbiByZWFkXG4vLyB0aGUgd3JpdGUsIGFuZCBhZnRlciBvYnNlcnZlcnMgaGF2ZSBiZWVuIG5vdGlmaWVkIChvciBhdCBsZWFzdCxcbi8vIGFmdGVyIHRoZSBvYnNlcnZlciBub3RpZmllcnMgaGF2ZSBhZGRlZCB0aGVtc2VsdmVzIHRvIHRoZSB3cml0ZVxuLy8gZmVuY2UpLCB5b3Ugc2hvdWxkIGNhbGwgJ2NvbW1pdHRlZCgpJyBvbiB0aGUgb2JqZWN0IHJldHVybmVkLlxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5fbWF5YmVCZWdpbldyaXRlID0gZnVuY3Rpb24gKCkge1xuICBjb25zdCBmZW5jZSA9IEREUFNlcnZlci5fZ2V0Q3VycmVudEZlbmNlKCk7XG4gIGlmIChmZW5jZSkge1xuICAgIHJldHVybiBmZW5jZS5iZWdpbldyaXRlKCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHtjb21taXR0ZWQ6IGZ1bmN0aW9uICgpIHt9fTtcbiAgfVxufTtcblxuLy8gSW50ZXJuYWwgaW50ZXJmYWNlOiBhZGRzIGEgY2FsbGJhY2sgd2hpY2ggaXMgY2FsbGVkIHdoZW4gdGhlIE1vbmdvIHByaW1hcnlcbi8vIGNoYW5nZXMuIFJldHVybnMgYSBzdG9wIGhhbmRsZS5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuX29uRmFpbG92ZXIgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgcmV0dXJuIHRoaXMuX29uRmFpbG92ZXJIb29rLnJlZ2lzdGVyKGNhbGxiYWNrKTtcbn07XG5cblxuLy8vLy8vLy8vLy8vIFB1YmxpYyBBUEkgLy8vLy8vLy8vL1xuXG4vLyBUaGUgd3JpdGUgbWV0aG9kcyBibG9jayB1bnRpbCB0aGUgZGF0YWJhc2UgaGFzIGNvbmZpcm1lZCB0aGUgd3JpdGUgKGl0IG1heVxuLy8gbm90IGJlIHJlcGxpY2F0ZWQgb3Igc3RhYmxlIG9uIGRpc2ssIGJ1dCBvbmUgc2VydmVyIGhhcyBjb25maXJtZWQgaXQpIGlmIG5vXG4vLyBjYWxsYmFjayBpcyBwcm92aWRlZC4gSWYgYSBjYWxsYmFjayBpcyBwcm92aWRlZCwgdGhlbiB0aGV5IGNhbGwgdGhlIGNhbGxiYWNrXG4vLyB3aGVuIHRoZSB3cml0ZSBpcyBjb25maXJtZWQuIFRoZXkgcmV0dXJuIG5vdGhpbmcgb24gc3VjY2VzcywgYW5kIHJhaXNlIGFuXG4vLyBleGNlcHRpb24gb24gZmFpbHVyZS5cbi8vXG4vLyBBZnRlciBtYWtpbmcgYSB3cml0ZSAod2l0aCBpbnNlcnQsIHVwZGF0ZSwgcmVtb3ZlKSwgb2JzZXJ2ZXJzIGFyZVxuLy8gbm90aWZpZWQgYXN5bmNocm9ub3VzbHkuIElmIHlvdSB3YW50IHRvIHJlY2VpdmUgYSBjYWxsYmFjayBvbmNlIGFsbFxuLy8gb2YgdGhlIG9ic2VydmVyIG5vdGlmaWNhdGlvbnMgaGF2ZSBsYW5kZWQgZm9yIHlvdXIgd3JpdGUsIGRvIHRoZVxuLy8gd3JpdGVzIGluc2lkZSBhIHdyaXRlIGZlbmNlIChzZXQgRERQU2VydmVyLl9DdXJyZW50V3JpdGVGZW5jZSB0byBhIG5ld1xuLy8gX1dyaXRlRmVuY2UsIGFuZCB0aGVuIHNldCBhIGNhbGxiYWNrIG9uIHRoZSB3cml0ZSBmZW5jZS4pXG4vL1xuLy8gU2luY2Ugb3VyIGV4ZWN1dGlvbiBlbnZpcm9ubWVudCBpcyBzaW5nbGUtdGhyZWFkZWQsIHRoaXMgaXNcbi8vIHdlbGwtZGVmaW5lZCAtLSBhIHdyaXRlIFwiaGFzIGJlZW4gbWFkZVwiIGlmIGl0J3MgcmV0dXJuZWQsIGFuZCBhblxuLy8gb2JzZXJ2ZXIgXCJoYXMgYmVlbiBub3RpZmllZFwiIGlmIGl0cyBjYWxsYmFjayBoYXMgcmV0dXJuZWQuXG5cbnZhciB3cml0ZUNhbGxiYWNrID0gZnVuY3Rpb24gKHdyaXRlLCByZWZyZXNoLCBjYWxsYmFjaykge1xuICByZXR1cm4gZnVuY3Rpb24gKGVyciwgcmVzdWx0KSB7XG4gICAgaWYgKCEgZXJyKSB7XG4gICAgICAvLyBYWFggV2UgZG9uJ3QgaGF2ZSB0byBydW4gdGhpcyBvbiBlcnJvciwgcmlnaHQ/XG4gICAgICB0cnkge1xuICAgICAgICByZWZyZXNoKCk7XG4gICAgICB9IGNhdGNoIChyZWZyZXNoRXJyKSB7XG4gICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgIGNhbGxiYWNrKHJlZnJlc2hFcnIpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyByZWZyZXNoRXJyO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHdyaXRlLmNvbW1pdHRlZCgpO1xuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgY2FsbGJhY2soZXJyLCByZXN1bHQpO1xuICAgIH0gZWxzZSBpZiAoZXJyKSB7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICB9O1xufTtcblxudmFyIGJpbmRFbnZpcm9ubWVudEZvcldyaXRlID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIHJldHVybiBNZXRlb3IuYmluZEVudmlyb25tZW50KGNhbGxiYWNrLCBcIk1vbmdvIHdyaXRlXCIpO1xufTtcblxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5pbnNlcnRBc3luYyA9IGFzeW5jIGZ1bmN0aW9uIChjb2xsZWN0aW9uX25hbWUsIGRvY3VtZW50KSB7XG4gIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gIGlmIChjb2xsZWN0aW9uX25hbWUgPT09IFwiX19fbWV0ZW9yX2ZhaWx1cmVfdGVzdF9jb2xsZWN0aW9uXCIpIHtcbiAgICBjb25zdCBlID0gbmV3IEVycm9yKFwiRmFpbHVyZSB0ZXN0XCIpO1xuICAgIGUuX2V4cGVjdGVkQnlUZXN0ID0gdHJ1ZTtcbiAgICB0aHJvdyBlO1xuICB9XG5cbiAgaWYgKCEoTG9jYWxDb2xsZWN0aW9uLl9pc1BsYWluT2JqZWN0KGRvY3VtZW50KSAmJlxuICAgICAgICAhRUpTT04uX2lzQ3VzdG9tVHlwZShkb2N1bWVudCkpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiT25seSBwbGFpbiBvYmplY3RzIG1heSBiZSBpbnNlcnRlZCBpbnRvIE1vbmdvREJcIik7XG4gIH1cblxuICB2YXIgd3JpdGUgPSBzZWxmLl9tYXliZUJlZ2luV3JpdGUoKTtcbiAgdmFyIHJlZnJlc2ggPSBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgYXdhaXQgTWV0ZW9yLnJlZnJlc2goe2NvbGxlY3Rpb246IGNvbGxlY3Rpb25fbmFtZSwgaWQ6IGRvY3VtZW50Ll9pZCB9KTtcbiAgfTtcbiAgcmV0dXJuIHNlbGYucmF3Q29sbGVjdGlvbihjb2xsZWN0aW9uX25hbWUpLmluc2VydE9uZShcbiAgICByZXBsYWNlVHlwZXMoZG9jdW1lbnQsIHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvKSxcbiAgICB7XG4gICAgICBzYWZlOiB0cnVlLFxuICAgIH1cbiAgKS50aGVuKGFzeW5jICh7aW5zZXJ0ZWRJZH0pID0+IHtcbiAgICBhd2FpdCByZWZyZXNoKCk7XG4gICAgYXdhaXQgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgcmV0dXJuIGluc2VydGVkSWQ7XG4gIH0pLmNhdGNoKGFzeW5jIGUgPT4ge1xuICAgIGF3YWl0IHdyaXRlLmNvbW1pdHRlZCgpO1xuICAgIHRocm93IGU7XG4gIH0pO1xufTtcblxuXG4vLyBDYXVzZSBxdWVyaWVzIHRoYXQgbWF5IGJlIGFmZmVjdGVkIGJ5IHRoZSBzZWxlY3RvciB0byBwb2xsIGluIHRoaXMgd3JpdGVcbi8vIGZlbmNlLlxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5fcmVmcmVzaCA9IGFzeW5jIGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSwgc2VsZWN0b3IpIHtcbiAgdmFyIHJlZnJlc2hLZXkgPSB7Y29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWV9O1xuICAvLyBJZiB3ZSBrbm93IHdoaWNoIGRvY3VtZW50cyB3ZSdyZSByZW1vdmluZywgZG9uJ3QgcG9sbCBxdWVyaWVzIHRoYXQgYXJlXG4gIC8vIHNwZWNpZmljIHRvIG90aGVyIGRvY3VtZW50cy4gKE5vdGUgdGhhdCBtdWx0aXBsZSBub3RpZmljYXRpb25zIGhlcmUgc2hvdWxkXG4gIC8vIG5vdCBjYXVzZSBtdWx0aXBsZSBwb2xscywgc2luY2UgYWxsIG91ciBsaXN0ZW5lciBpcyBkb2luZyBpcyBlbnF1ZXVlaW5nIGFcbiAgLy8gcG9sbC4pXG4gIHZhciBzcGVjaWZpY0lkcyA9IExvY2FsQ29sbGVjdGlvbi5faWRzTWF0Y2hlZEJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuICBpZiAoc3BlY2lmaWNJZHMpIHtcbiAgICBmb3IgKGNvbnN0IGlkIG9mIHNwZWNpZmljSWRzKSB7XG4gICAgICBhd2FpdCBNZXRlb3IucmVmcmVzaChPYmplY3QuYXNzaWduKHtpZDogaWR9LCByZWZyZXNoS2V5KSk7XG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICBhd2FpdCBNZXRlb3IucmVmcmVzaChyZWZyZXNoS2V5KTtcbiAgfVxufTtcblxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5yZW1vdmVBc3luYyA9IGFzeW5jIGZ1bmN0aW9uIChjb2xsZWN0aW9uX25hbWUsIHNlbGVjdG9yKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICBpZiAoY29sbGVjdGlvbl9uYW1lID09PSBcIl9fX21ldGVvcl9mYWlsdXJlX3Rlc3RfY29sbGVjdGlvblwiKSB7XG4gICAgdmFyIGUgPSBuZXcgRXJyb3IoXCJGYWlsdXJlIHRlc3RcIik7XG4gICAgZS5fZXhwZWN0ZWRCeVRlc3QgPSB0cnVlO1xuICAgIHRocm93IGU7XG4gIH1cblxuICB2YXIgd3JpdGUgPSBzZWxmLl9tYXliZUJlZ2luV3JpdGUoKTtcbiAgdmFyIHJlZnJlc2ggPSBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgYXdhaXQgc2VsZi5fcmVmcmVzaChjb2xsZWN0aW9uX25hbWUsIHNlbGVjdG9yKTtcbiAgfTtcblxuICByZXR1cm4gc2VsZi5yYXdDb2xsZWN0aW9uKGNvbGxlY3Rpb25fbmFtZSlcbiAgICAuZGVsZXRlTWFueShyZXBsYWNlVHlwZXMoc2VsZWN0b3IsIHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvKSwge1xuICAgICAgc2FmZTogdHJ1ZSxcbiAgICB9KVxuICAgIC50aGVuKGFzeW5jICh7IGRlbGV0ZWRDb3VudCB9KSA9PiB7XG4gICAgICBhd2FpdCByZWZyZXNoKCk7XG4gICAgICBhd2FpdCB3cml0ZS5jb21taXR0ZWQoKTtcbiAgICAgIHJldHVybiB0cmFuc2Zvcm1SZXN1bHQoeyByZXN1bHQgOiB7bW9kaWZpZWRDb3VudCA6IGRlbGV0ZWRDb3VudH0gfSkubnVtYmVyQWZmZWN0ZWQ7XG4gICAgfSkuY2F0Y2goYXN5bmMgKGVycikgPT4ge1xuICAgICAgICBhd2FpdCB3cml0ZS5jb21taXR0ZWQoKTtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgIH0pO1xufTtcblxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5kcm9wQ29sbGVjdGlvbkFzeW5jID0gYXN5bmMgZnVuY3Rpb24oY29sbGVjdGlvbk5hbWUpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG5cbiAgdmFyIHdyaXRlID0gc2VsZi5fbWF5YmVCZWdpbldyaXRlKCk7XG4gIHZhciByZWZyZXNoID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIE1ldGVvci5yZWZyZXNoKHtcbiAgICAgIGNvbGxlY3Rpb246IGNvbGxlY3Rpb25OYW1lLFxuICAgICAgaWQ6IG51bGwsXG4gICAgICBkcm9wQ29sbGVjdGlvbjogdHJ1ZSxcbiAgICB9KTtcbiAgfTtcblxuICByZXR1cm4gc2VsZlxuICAgIC5yYXdDb2xsZWN0aW9uKGNvbGxlY3Rpb25OYW1lKVxuICAgIC5kcm9wKClcbiAgICAudGhlbihhc3luYyByZXN1bHQgPT4ge1xuICAgICAgYXdhaXQgcmVmcmVzaCgpO1xuICAgICAgYXdhaXQgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0pXG4gICAgLmNhdGNoKGFzeW5jIGUgPT4ge1xuICAgICAgYXdhaXQgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgICB0aHJvdyBlO1xuICAgIH0pO1xufTtcblxuLy8gRm9yIHRlc3Rpbmcgb25seS4gIFNsaWdodGx5IGJldHRlciB0aGFuIGBjLnJhd0RhdGFiYXNlKCkuZHJvcERhdGFiYXNlKClgXG4vLyBiZWNhdXNlIGl0IGxldHMgdGhlIHRlc3QncyBmZW5jZSB3YWl0IGZvciBpdCB0byBiZSBjb21wbGV0ZS5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuZHJvcERhdGFiYXNlQXN5bmMgPSBhc3luYyBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICB2YXIgd3JpdGUgPSBzZWxmLl9tYXliZUJlZ2luV3JpdGUoKTtcbiAgdmFyIHJlZnJlc2ggPSBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgYXdhaXQgTWV0ZW9yLnJlZnJlc2goeyBkcm9wRGF0YWJhc2U6IHRydWUgfSk7XG4gIH07XG5cbiAgdHJ5IHtcbiAgICBhd2FpdCBzZWxmLmRiLl9kcm9wRGF0YWJhc2UoKTtcbiAgICBhd2FpdCByZWZyZXNoKCk7XG4gICAgYXdhaXQgd3JpdGUuY29tbWl0dGVkKCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBhd2FpdCB3cml0ZS5jb21taXR0ZWQoKTtcbiAgICB0aHJvdyBlO1xuICB9XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLnVwZGF0ZUFzeW5jID0gYXN5bmMgZnVuY3Rpb24gKGNvbGxlY3Rpb25fbmFtZSwgc2VsZWN0b3IsIG1vZCwgb3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgaWYgKGNvbGxlY3Rpb25fbmFtZSA9PT0gXCJfX19tZXRlb3JfZmFpbHVyZV90ZXN0X2NvbGxlY3Rpb25cIikge1xuICAgIHZhciBlID0gbmV3IEVycm9yKFwiRmFpbHVyZSB0ZXN0XCIpO1xuICAgIGUuX2V4cGVjdGVkQnlUZXN0ID0gdHJ1ZTtcbiAgICB0aHJvdyBlO1xuICB9XG5cbiAgLy8gZXhwbGljaXQgc2FmZXR5IGNoZWNrLiBudWxsIGFuZCB1bmRlZmluZWQgY2FuIGNyYXNoIHRoZSBtb25nb1xuICAvLyBkcml2ZXIuIEFsdGhvdWdoIHRoZSBub2RlIGRyaXZlciBhbmQgbWluaW1vbmdvIGRvICdzdXBwb3J0J1xuICAvLyBub24tb2JqZWN0IG1vZGlmaWVyIGluIHRoYXQgdGhleSBkb24ndCBjcmFzaCwgdGhleSBhcmUgbm90XG4gIC8vIG1lYW5pbmdmdWwgb3BlcmF0aW9ucyBhbmQgZG8gbm90IGRvIGFueXRoaW5nLiBEZWZlbnNpdmVseSB0aHJvdyBhblxuICAvLyBlcnJvciBoZXJlLlxuICBpZiAoIW1vZCB8fCB0eXBlb2YgbW9kICE9PSAnb2JqZWN0Jykge1xuICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKFwiSW52YWxpZCBtb2RpZmllci4gTW9kaWZpZXIgbXVzdCBiZSBhbiBvYmplY3QuXCIpO1xuXG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cblxuICBpZiAoIShMb2NhbENvbGxlY3Rpb24uX2lzUGxhaW5PYmplY3QobW9kKSAmJiAhRUpTT04uX2lzQ3VzdG9tVHlwZShtb2QpKSkge1xuICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKFxuICAgICAgICBcIk9ubHkgcGxhaW4gb2JqZWN0cyBtYXkgYmUgdXNlZCBhcyByZXBsYWNlbWVudFwiICtcbiAgICAgICAgXCIgZG9jdW1lbnRzIGluIE1vbmdvREJcIik7XG5cbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxuXG4gIGlmICghb3B0aW9ucykgb3B0aW9ucyA9IHt9O1xuXG4gIHZhciB3cml0ZSA9IHNlbGYuX21heWJlQmVnaW5Xcml0ZSgpO1xuICB2YXIgcmVmcmVzaCA9IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICBhd2FpdCBzZWxmLl9yZWZyZXNoKGNvbGxlY3Rpb25fbmFtZSwgc2VsZWN0b3IpO1xuICB9O1xuXG4gIHZhciBjb2xsZWN0aW9uID0gc2VsZi5yYXdDb2xsZWN0aW9uKGNvbGxlY3Rpb25fbmFtZSk7XG4gIHZhciBtb25nb09wdHMgPSB7c2FmZTogdHJ1ZX07XG4gIC8vIEFkZCBzdXBwb3J0IGZvciBmaWx0ZXJlZCBwb3NpdGlvbmFsIG9wZXJhdG9yXG4gIGlmIChvcHRpb25zLmFycmF5RmlsdGVycyAhPT0gdW5kZWZpbmVkKSBtb25nb09wdHMuYXJyYXlGaWx0ZXJzID0gb3B0aW9ucy5hcnJheUZpbHRlcnM7XG4gIC8vIGV4cGxpY3RseSBlbnVtZXJhdGUgb3B0aW9ucyB0aGF0IG1pbmltb25nbyBzdXBwb3J0c1xuICBpZiAob3B0aW9ucy51cHNlcnQpIG1vbmdvT3B0cy51cHNlcnQgPSB0cnVlO1xuICBpZiAob3B0aW9ucy5tdWx0aSkgbW9uZ29PcHRzLm11bHRpID0gdHJ1ZTtcbiAgLy8gTGV0cyB5b3UgZ2V0IGEgbW9yZSBtb3JlIGZ1bGwgcmVzdWx0IGZyb20gTW9uZ29EQi4gVXNlIHdpdGggY2F1dGlvbjpcbiAgLy8gbWlnaHQgbm90IHdvcmsgd2l0aCBDLnVwc2VydCAoYXMgb3Bwb3NlZCB0byBDLnVwZGF0ZSh7dXBzZXJ0OnRydWV9KSBvclxuICAvLyB3aXRoIHNpbXVsYXRlZCB1cHNlcnQuXG4gIGlmIChvcHRpb25zLmZ1bGxSZXN1bHQpIG1vbmdvT3B0cy5mdWxsUmVzdWx0ID0gdHJ1ZTtcblxuICB2YXIgbW9uZ29TZWxlY3RvciA9IHJlcGxhY2VUeXBlcyhzZWxlY3RvciwgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28pO1xuICB2YXIgbW9uZ29Nb2QgPSByZXBsYWNlVHlwZXMobW9kLCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbyk7XG5cbiAgdmFyIGlzTW9kaWZ5ID0gTG9jYWxDb2xsZWN0aW9uLl9pc01vZGlmaWNhdGlvbk1vZChtb25nb01vZCk7XG5cbiAgaWYgKG9wdGlvbnMuX2ZvcmJpZFJlcGxhY2UgJiYgIWlzTW9kaWZ5KSB7XG4gICAgdmFyIGVyciA9IG5ldyBFcnJvcihcIkludmFsaWQgbW9kaWZpZXIuIFJlcGxhY2VtZW50cyBhcmUgZm9yYmlkZGVuLlwiKTtcbiAgICB0aHJvdyBlcnI7XG4gIH1cblxuICAvLyBXZSd2ZSBhbHJlYWR5IHJ1biByZXBsYWNlVHlwZXMvcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28gb25cbiAgLy8gc2VsZWN0b3IgYW5kIG1vZC4gIFdlIGFzc3VtZSBpdCBkb2Vzbid0IG1hdHRlciwgYXMgZmFyIGFzXG4gIC8vIHRoZSBiZWhhdmlvciBvZiBtb2RpZmllcnMgaXMgY29uY2VybmVkLCB3aGV0aGVyIGBfbW9kaWZ5YFxuICAvLyBpcyBydW4gb24gRUpTT04gb3Igb24gbW9uZ28tY29udmVydGVkIEVKU09OLlxuXG4gIC8vIFJ1biB0aGlzIGNvZGUgdXAgZnJvbnQgc28gdGhhdCBpdCBmYWlscyBmYXN0IGlmIHNvbWVvbmUgdXNlc1xuICAvLyBhIE1vbmdvIHVwZGF0ZSBvcGVyYXRvciB3ZSBkb24ndCBzdXBwb3J0LlxuICBsZXQga25vd25JZDtcbiAgaWYgKG9wdGlvbnMudXBzZXJ0KSB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBuZXdEb2MgPSBMb2NhbENvbGxlY3Rpb24uX2NyZWF0ZVVwc2VydERvY3VtZW50KHNlbGVjdG9yLCBtb2QpO1xuICAgICAga25vd25JZCA9IG5ld0RvYy5faWQ7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICB9XG4gIGlmIChvcHRpb25zLnVwc2VydCAmJlxuICAgICAgISBpc01vZGlmeSAmJlxuICAgICAgISBrbm93bklkICYmXG4gICAgICBvcHRpb25zLmluc2VydGVkSWQgJiZcbiAgICAgICEgKG9wdGlvbnMuaW5zZXJ0ZWRJZCBpbnN0YW5jZW9mIE1vbmdvLk9iamVjdElEICYmXG4gICAgICAgICBvcHRpb25zLmdlbmVyYXRlZElkKSkge1xuICAgIC8vIEluIGNhc2Ugb2YgYW4gdXBzZXJ0IHdpdGggYSByZXBsYWNlbWVudCwgd2hlcmUgdGhlcmUgaXMgbm8gX2lkIGRlZmluZWRcbiAgICAvLyBpbiBlaXRoZXIgdGhlIHF1ZXJ5IG9yIHRoZSByZXBsYWNlbWVudCBkb2MsIG1vbmdvIHdpbGwgZ2VuZXJhdGUgYW4gaWQgaXRzZWxmLlxuICAgIC8vIFRoZXJlZm9yZSB3ZSBuZWVkIHRoaXMgc3BlY2lhbCBzdHJhdGVneSBpZiB3ZSB3YW50IHRvIGNvbnRyb2wgdGhlIGlkIG91cnNlbHZlcy5cblxuICAgIC8vIFdlIGRvbid0IG5lZWQgdG8gZG8gdGhpcyB3aGVuOlxuICAgIC8vIC0gVGhpcyBpcyBub3QgYSByZXBsYWNlbWVudCwgc28gd2UgY2FuIGFkZCBhbiBfaWQgdG8gJHNldE9uSW5zZXJ0XG4gICAgLy8gLSBUaGUgaWQgaXMgZGVmaW5lZCBieSBxdWVyeSBvciBtb2Qgd2UgY2FuIGp1c3QgYWRkIGl0IHRvIHRoZSByZXBsYWNlbWVudCBkb2NcbiAgICAvLyAtIFRoZSB1c2VyIGRpZCBub3Qgc3BlY2lmeSBhbnkgaWQgcHJlZmVyZW5jZSBhbmQgdGhlIGlkIGlzIGEgTW9uZ28gT2JqZWN0SWQsXG4gICAgLy8gICAgIHRoZW4gd2UgY2FuIGp1c3QgbGV0IE1vbmdvIGdlbmVyYXRlIHRoZSBpZFxuICAgIHJldHVybiBhd2FpdCBzaW11bGF0ZVVwc2VydFdpdGhJbnNlcnRlZElkKGNvbGxlY3Rpb24sIG1vbmdvU2VsZWN0b3IsIG1vbmdvTW9kLCBvcHRpb25zKVxuICAgICAgICAudGhlbihhc3luYyByZXN1bHQgPT4ge1xuICAgICAgICAgIGF3YWl0IHJlZnJlc2goKTtcbiAgICAgICAgICBhd2FpdCB3cml0ZS5jb21taXR0ZWQoKTtcbiAgICAgICAgICBpZiAocmVzdWx0ICYmICEgb3B0aW9ucy5fcmV0dXJuT2JqZWN0KSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0Lm51bWJlckFmZmVjdGVkO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgaWYgKG9wdGlvbnMudXBzZXJ0ICYmICFrbm93bklkICYmIG9wdGlvbnMuaW5zZXJ0ZWRJZCAmJiBpc01vZGlmeSkge1xuICAgICAgaWYgKCFtb25nb01vZC5oYXNPd25Qcm9wZXJ0eSgnJHNldE9uSW5zZXJ0JykpIHtcbiAgICAgICAgbW9uZ29Nb2QuJHNldE9uSW5zZXJ0ID0ge307XG4gICAgICB9XG4gICAgICBrbm93bklkID0gb3B0aW9ucy5pbnNlcnRlZElkO1xuICAgICAgT2JqZWN0LmFzc2lnbihtb25nb01vZC4kc2V0T25JbnNlcnQsIHJlcGxhY2VUeXBlcyh7X2lkOiBvcHRpb25zLmluc2VydGVkSWR9LCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbykpO1xuICAgIH1cblxuICAgIGNvbnN0IHN0cmluZ3MgPSBPYmplY3Qua2V5cyhtb25nb01vZCkuZmlsdGVyKChrZXkpID0+ICFrZXkuc3RhcnRzV2l0aChcIiRcIikpO1xuICAgIGxldCB1cGRhdGVNZXRob2QgPSBzdHJpbmdzLmxlbmd0aCA+IDAgPyAncmVwbGFjZU9uZScgOiAndXBkYXRlTWFueSc7XG4gICAgdXBkYXRlTWV0aG9kID1cbiAgICAgICAgdXBkYXRlTWV0aG9kID09PSAndXBkYXRlTWFueScgJiYgIW1vbmdvT3B0cy5tdWx0aVxuICAgICAgICAgICAgPyAndXBkYXRlT25lJ1xuICAgICAgICAgICAgOiB1cGRhdGVNZXRob2Q7XG4gICAgcmV0dXJuIGNvbGxlY3Rpb25bdXBkYXRlTWV0aG9kXVxuICAgICAgICAuYmluZChjb2xsZWN0aW9uKShtb25nb1NlbGVjdG9yLCBtb25nb01vZCwgbW9uZ29PcHRzKVxuICAgICAgICAudGhlbihhc3luYyByZXN1bHQgPT4ge1xuICAgICAgICAgIHZhciBtZXRlb3JSZXN1bHQgPSB0cmFuc2Zvcm1SZXN1bHQoe3Jlc3VsdH0pO1xuICAgICAgICAgIGlmIChtZXRlb3JSZXN1bHQgJiYgb3B0aW9ucy5fcmV0dXJuT2JqZWN0KSB7XG4gICAgICAgICAgICAvLyBJZiB0aGlzIHdhcyBhbiB1cHNlcnRBc3luYygpIGNhbGwsIGFuZCB3ZSBlbmRlZCB1cFxuICAgICAgICAgICAgLy8gaW5zZXJ0aW5nIGEgbmV3IGRvYyBhbmQgd2Uga25vdyBpdHMgaWQsIHRoZW5cbiAgICAgICAgICAgIC8vIHJldHVybiB0aGF0IGlkIGFzIHdlbGwuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy51cHNlcnQgJiYgbWV0ZW9yUmVzdWx0Lmluc2VydGVkSWQpIHtcbiAgICAgICAgICAgICAgaWYgKGtub3duSWQpIHtcbiAgICAgICAgICAgICAgICBtZXRlb3JSZXN1bHQuaW5zZXJ0ZWRJZCA9IGtub3duSWQ7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAobWV0ZW9yUmVzdWx0Lmluc2VydGVkSWQgaW5zdGFuY2VvZiBNb25nb0RCLk9iamVjdElEKSB7XG4gICAgICAgICAgICAgICAgbWV0ZW9yUmVzdWx0Lmluc2VydGVkSWQgPSBuZXcgTW9uZ28uT2JqZWN0SUQobWV0ZW9yUmVzdWx0Lmluc2VydGVkSWQudG9IZXhTdHJpbmcoKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGF3YWl0IHJlZnJlc2goKTtcbiAgICAgICAgICAgIGF3YWl0IHdyaXRlLmNvbW1pdHRlZCgpO1xuICAgICAgICAgICAgcmV0dXJuIG1ldGVvclJlc3VsdDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXdhaXQgcmVmcmVzaCgpO1xuICAgICAgICAgICAgYXdhaXQgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgICAgICAgICByZXR1cm4gbWV0ZW9yUmVzdWx0Lm51bWJlckFmZmVjdGVkO1xuICAgICAgICAgIH1cbiAgICAgICAgfSkuY2F0Y2goYXN5bmMgKGVycikgPT4ge1xuICAgICAgICAgIGF3YWl0IHdyaXRlLmNvbW1pdHRlZCgpO1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfSk7XG4gIH1cbn07XG5cbnZhciB0cmFuc2Zvcm1SZXN1bHQgPSBmdW5jdGlvbiAoZHJpdmVyUmVzdWx0KSB7XG4gIHZhciBtZXRlb3JSZXN1bHQgPSB7IG51bWJlckFmZmVjdGVkOiAwIH07XG4gIGlmIChkcml2ZXJSZXN1bHQpIHtcbiAgICB2YXIgbW9uZ29SZXN1bHQgPSBkcml2ZXJSZXN1bHQucmVzdWx0O1xuICAgIC8vIE9uIHVwZGF0ZXMgd2l0aCB1cHNlcnQ6dHJ1ZSwgdGhlIGluc2VydGVkIHZhbHVlcyBjb21lIGFzIGEgbGlzdCBvZlxuICAgIC8vIHVwc2VydGVkIHZhbHVlcyAtLSBldmVuIHdpdGggb3B0aW9ucy5tdWx0aSwgd2hlbiB0aGUgdXBzZXJ0IGRvZXMgaW5zZXJ0LFxuICAgIC8vIGl0IG9ubHkgaW5zZXJ0cyBvbmUgZWxlbWVudC5cbiAgICBpZiAobW9uZ29SZXN1bHQudXBzZXJ0ZWRDb3VudCkge1xuICAgICAgbWV0ZW9yUmVzdWx0Lm51bWJlckFmZmVjdGVkID0gbW9uZ29SZXN1bHQudXBzZXJ0ZWRDb3VudDtcblxuICAgICAgaWYgKG1vbmdvUmVzdWx0LnVwc2VydGVkSWQpIHtcbiAgICAgICAgbWV0ZW9yUmVzdWx0Lmluc2VydGVkSWQgPSBtb25nb1Jlc3VsdC51cHNlcnRlZElkO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBuIHdhcyB1c2VkIGJlZm9yZSBNb25nbyA1LjAsIGluIE1vbmdvIDUuMCB3ZSBhcmUgbm90IHJlY2VpdmluZyB0aGlzIG5cbiAgICAgIC8vIGZpZWxkIGFuZCBzbyB3ZSBhcmUgdXNpbmcgbW9kaWZpZWRDb3VudCBpbnN0ZWFkXG4gICAgICBtZXRlb3JSZXN1bHQubnVtYmVyQWZmZWN0ZWQgPSBtb25nb1Jlc3VsdC5uIHx8IG1vbmdvUmVzdWx0Lm1hdGNoZWRDb3VudCB8fCBtb25nb1Jlc3VsdC5tb2RpZmllZENvdW50O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtZXRlb3JSZXN1bHQ7XG59O1xuXG5cbnZhciBOVU1fT1BUSU1JU1RJQ19UUklFUyA9IDM7XG5cbi8vIGV4cG9zZWQgZm9yIHRlc3Rpbmdcbk1vbmdvQ29ubmVjdGlvbi5faXNDYW5ub3RDaGFuZ2VJZEVycm9yID0gZnVuY3Rpb24gKGVycikge1xuXG4gIC8vIE1vbmdvIDMuMi4qIHJldHVybnMgZXJyb3IgYXMgbmV4dCBPYmplY3Q6XG4gIC8vIHtuYW1lOiBTdHJpbmcsIGNvZGU6IE51bWJlciwgZXJybXNnOiBTdHJpbmd9XG4gIC8vIE9sZGVyIE1vbmdvIHJldHVybnM6XG4gIC8vIHtuYW1lOiBTdHJpbmcsIGNvZGU6IE51bWJlciwgZXJyOiBTdHJpbmd9XG4gIHZhciBlcnJvciA9IGVyci5lcnJtc2cgfHwgZXJyLmVycjtcblxuICAvLyBXZSBkb24ndCB1c2UgdGhlIGVycm9yIGNvZGUgaGVyZVxuICAvLyBiZWNhdXNlIHRoZSBlcnJvciBjb2RlIHdlIG9ic2VydmVkIGl0IHByb2R1Y2luZyAoMTY4MzcpIGFwcGVhcnMgdG8gYmVcbiAgLy8gYSBmYXIgbW9yZSBnZW5lcmljIGVycm9yIGNvZGUgYmFzZWQgb24gZXhhbWluaW5nIHRoZSBzb3VyY2UuXG4gIGlmIChlcnJvci5pbmRleE9mKCdUaGUgX2lkIGZpZWxkIGNhbm5vdCBiZSBjaGFuZ2VkJykgPT09IDBcbiAgICB8fCBlcnJvci5pbmRleE9mKFwidGhlIChpbW11dGFibGUpIGZpZWxkICdfaWQnIHdhcyBmb3VuZCB0byBoYXZlIGJlZW4gYWx0ZXJlZCB0byBfaWRcIikgIT09IC0xKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59O1xuXG52YXIgc2ltdWxhdGVVcHNlcnRXaXRoSW5zZXJ0ZWRJZCA9IGFzeW5jIGZ1bmN0aW9uIChjb2xsZWN0aW9uLCBzZWxlY3RvciwgbW9kLCBvcHRpb25zKSB7XG4gIC8vIFNUUkFURUdZOiBGaXJzdCB0cnkgZG9pbmcgYW4gdXBzZXJ0IHdpdGggYSBnZW5lcmF0ZWQgSUQuXG4gIC8vIElmIHRoaXMgdGhyb3dzIGFuIGVycm9yIGFib3V0IGNoYW5naW5nIHRoZSBJRCBvbiBhbiBleGlzdGluZyBkb2N1bWVudFxuICAvLyB0aGVuIHdpdGhvdXQgYWZmZWN0aW5nIHRoZSBkYXRhYmFzZSwgd2Uga25vdyB3ZSBzaG91bGQgcHJvYmFibHkgdHJ5XG4gIC8vIGFuIHVwZGF0ZSB3aXRob3V0IHRoZSBnZW5lcmF0ZWQgSUQuIElmIGl0IGFmZmVjdGVkIDAgZG9jdW1lbnRzLFxuICAvLyB0aGVuIHdpdGhvdXQgYWZmZWN0aW5nIHRoZSBkYXRhYmFzZSwgd2UgdGhlIGRvY3VtZW50IHRoYXQgZmlyc3RcbiAgLy8gZ2F2ZSB0aGUgZXJyb3IgaXMgcHJvYmFibHkgcmVtb3ZlZCBhbmQgd2UgbmVlZCB0byB0cnkgYW4gaW5zZXJ0IGFnYWluXG4gIC8vIFdlIGdvIGJhY2sgdG8gc3RlcCBvbmUgYW5kIHJlcGVhdC5cbiAgLy8gTGlrZSBhbGwgXCJvcHRpbWlzdGljIHdyaXRlXCIgc2NoZW1lcywgd2UgcmVseSBvbiB0aGUgZmFjdCB0aGF0IGl0J3NcbiAgLy8gdW5saWtlbHkgb3VyIHdyaXRlcyB3aWxsIGNvbnRpbnVlIHRvIGJlIGludGVyZmVyZWQgd2l0aCB1bmRlciBub3JtYWxcbiAgLy8gY2lyY3Vtc3RhbmNlcyAodGhvdWdoIHN1ZmZpY2llbnRseSBoZWF2eSBjb250ZW50aW9uIHdpdGggd3JpdGVyc1xuICAvLyBkaXNhZ3JlZWluZyBvbiB0aGUgZXhpc3RlbmNlIG9mIGFuIG9iamVjdCB3aWxsIGNhdXNlIHdyaXRlcyB0byBmYWlsXG4gIC8vIGluIHRoZW9yeSkuXG5cbiAgdmFyIGluc2VydGVkSWQgPSBvcHRpb25zLmluc2VydGVkSWQ7IC8vIG11c3QgZXhpc3RcbiAgdmFyIG1vbmdvT3B0c0ZvclVwZGF0ZSA9IHtcbiAgICBzYWZlOiB0cnVlLFxuICAgIG11bHRpOiBvcHRpb25zLm11bHRpXG4gIH07XG4gIHZhciBtb25nb09wdHNGb3JJbnNlcnQgPSB7XG4gICAgc2FmZTogdHJ1ZSxcbiAgICB1cHNlcnQ6IHRydWVcbiAgfTtcblxuICB2YXIgcmVwbGFjZW1lbnRXaXRoSWQgPSBPYmplY3QuYXNzaWduKFxuICAgIHJlcGxhY2VUeXBlcyh7X2lkOiBpbnNlcnRlZElkfSwgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28pLFxuICAgIG1vZCk7XG5cbiAgdmFyIHRyaWVzID0gTlVNX09QVElNSVNUSUNfVFJJRVM7XG5cbiAgdmFyIGRvVXBkYXRlID0gYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgIHRyaWVzLS07XG4gICAgaWYgKCEgdHJpZXMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlVwc2VydCBmYWlsZWQgYWZ0ZXIgXCIgKyBOVU1fT1BUSU1JU1RJQ19UUklFUyArIFwiIHRyaWVzLlwiKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IG1ldGhvZCA9IGNvbGxlY3Rpb24udXBkYXRlTWFueTtcbiAgICAgIGlmKCFPYmplY3Qua2V5cyhtb2QpLnNvbWUoa2V5ID0+IGtleS5zdGFydHNXaXRoKFwiJFwiKSkpe1xuICAgICAgICBtZXRob2QgPSBjb2xsZWN0aW9uLnJlcGxhY2VPbmUuYmluZChjb2xsZWN0aW9uKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtZXRob2QoXG4gICAgICAgIHNlbGVjdG9yLFxuICAgICAgICBtb2QsXG4gICAgICAgIG1vbmdvT3B0c0ZvclVwZGF0ZSkudGhlbihyZXN1bHQgPT4ge1xuICAgICAgICBpZiAocmVzdWx0ICYmIChyZXN1bHQubW9kaWZpZWRDb3VudCB8fCByZXN1bHQudXBzZXJ0ZWRDb3VudCkpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbnVtYmVyQWZmZWN0ZWQ6IHJlc3VsdC5tb2RpZmllZENvdW50IHx8IHJlc3VsdC51cHNlcnRlZENvdW50LFxuICAgICAgICAgICAgaW5zZXJ0ZWRJZDogcmVzdWx0LnVwc2VydGVkSWQgfHwgdW5kZWZpbmVkLFxuICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGRvQ29uZGl0aW9uYWxJbnNlcnQoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9O1xuXG4gIHZhciBkb0NvbmRpdGlvbmFsSW5zZXJ0ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGNvbGxlY3Rpb24ucmVwbGFjZU9uZShzZWxlY3RvciwgcmVwbGFjZW1lbnRXaXRoSWQsIG1vbmdvT3B0c0Zvckluc2VydClcbiAgICAgICAgLnRoZW4ocmVzdWx0ID0+ICh7XG4gICAgICAgICAgICBudW1iZXJBZmZlY3RlZDogcmVzdWx0LnVwc2VydGVkQ291bnQsXG4gICAgICAgICAgICBpbnNlcnRlZElkOiByZXN1bHQudXBzZXJ0ZWRJZCxcbiAgICAgICAgICB9KSkuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgaWYgKE1vbmdvQ29ubmVjdGlvbi5faXNDYW5ub3RDaGFuZ2VJZEVycm9yKGVycikpIHtcbiAgICAgICAgICByZXR1cm4gZG9VcGRhdGUoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gIH07XG4gIHJldHVybiBkb1VwZGF0ZSgpO1xufTtcblxuXG4vLyBYWFggTW9uZ29Db25uZWN0aW9uLnVwc2VydEFzeW5jKCkgZG9lcyBub3QgcmV0dXJuIHRoZSBpZCBvZiB0aGUgaW5zZXJ0ZWQgZG9jdW1lbnRcbi8vIHVubGVzcyB5b3Ugc2V0IGl0IGV4cGxpY2l0bHkgaW4gdGhlIHNlbGVjdG9yIG9yIG1vZGlmaWVyIChhcyBhIHJlcGxhY2VtZW50XG4vLyBkb2MpLlxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS51cHNlcnRBc3luYyA9IGFzeW5jIGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSwgc2VsZWN0b3IsIG1vZCwgb3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cblxuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gXCJmdW5jdGlvblwiICYmICEgY2FsbGJhY2spIHtcbiAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gICAgb3B0aW9ucyA9IHt9O1xuICB9XG5cbiAgcmV0dXJuIHNlbGYudXBkYXRlQXN5bmMoY29sbGVjdGlvbk5hbWUsIHNlbGVjdG9yLCBtb2QsXG4gICAgICAgICAgICAgICAgICAgICBPYmplY3QuYXNzaWduKHt9LCBvcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgICAgICAgIHVwc2VydDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgX3JldHVybk9iamVjdDogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAgfSkpO1xufTtcblxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5maW5kID0gZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lLCBzZWxlY3Rvciwgb3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpXG4gICAgc2VsZWN0b3IgPSB7fTtcblxuICByZXR1cm4gbmV3IEN1cnNvcihcbiAgICBzZWxmLCBuZXcgQ3Vyc29yRGVzY3JpcHRpb24oY29sbGVjdGlvbk5hbWUsIHNlbGVjdG9yLCBvcHRpb25zKSk7XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmZpbmRPbmVBc3luYyA9IGFzeW5jIGZ1bmN0aW9uIChjb2xsZWN0aW9uX25hbWUsIHNlbGVjdG9yLCBvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICBzZWxlY3RvciA9IHt9O1xuICB9XG5cbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIG9wdGlvbnMubGltaXQgPSAxO1xuXG4gIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBzZWxmLmZpbmQoY29sbGVjdGlvbl9uYW1lLCBzZWxlY3Rvciwgb3B0aW9ucykuZmV0Y2goKTtcblxuICByZXR1cm4gcmVzdWx0c1swXTtcbn07XG5cbi8vIFdlJ2xsIGFjdHVhbGx5IGRlc2lnbiBhbiBpbmRleCBBUEkgbGF0ZXIuIEZvciBub3csIHdlIGp1c3QgcGFzcyB0aHJvdWdoIHRvXG4vLyBNb25nbydzLCBidXQgbWFrZSBpdCBzeW5jaHJvbm91cy5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuY3JlYXRlSW5kZXhBc3luYyA9IGFzeW5jIGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSwgaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICAvLyBXZSBleHBlY3QgdGhpcyBmdW5jdGlvbiB0byBiZSBjYWxsZWQgYXQgc3RhcnR1cCwgbm90IGZyb20gd2l0aGluIGEgbWV0aG9kLFxuICAvLyBzbyB3ZSBkb24ndCBpbnRlcmFjdCB3aXRoIHRoZSB3cml0ZSBmZW5jZS5cbiAgdmFyIGNvbGxlY3Rpb24gPSBzZWxmLnJhd0NvbGxlY3Rpb24oY29sbGVjdGlvbk5hbWUpO1xuICBhd2FpdCBjb2xsZWN0aW9uLmNyZWF0ZUluZGV4KGluZGV4LCBvcHRpb25zKTtcbn07XG5cbi8vIGp1c3QgdG8gYmUgY29uc2lzdGVudCB3aXRoIHRoZSBvdGhlciBtZXRob2RzXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmNyZWF0ZUluZGV4ID1cbiAgTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5jcmVhdGVJbmRleEFzeW5jO1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmNvdW50RG9jdW1lbnRzID0gZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lLCAuLi5hcmdzKSB7XG4gIGFyZ3MgPSBhcmdzLm1hcChhcmcgPT4gcmVwbGFjZVR5cGVzKGFyZywgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28pKTtcbiAgY29uc3QgY29sbGVjdGlvbiA9IHRoaXMucmF3Q29sbGVjdGlvbihjb2xsZWN0aW9uTmFtZSk7XG4gIHJldHVybiBjb2xsZWN0aW9uLmNvdW50RG9jdW1lbnRzKC4uLmFyZ3MpO1xufTtcblxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5lc3RpbWF0ZWREb2N1bWVudENvdW50ID0gZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lLCAuLi5hcmdzKSB7XG4gIGFyZ3MgPSBhcmdzLm1hcChhcmcgPT4gcmVwbGFjZVR5cGVzKGFyZywgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28pKTtcbiAgY29uc3QgY29sbGVjdGlvbiA9IHRoaXMucmF3Q29sbGVjdGlvbihjb2xsZWN0aW9uTmFtZSk7XG4gIHJldHVybiBjb2xsZWN0aW9uLmVzdGltYXRlZERvY3VtZW50Q291bnQoLi4uYXJncyk7XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmVuc3VyZUluZGV4QXN5bmMgPSBNb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmNyZWF0ZUluZGV4QXN5bmM7XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuZHJvcEluZGV4QXN5bmMgPSBhc3luYyBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIGluZGV4KSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuXG4gIC8vIFRoaXMgZnVuY3Rpb24gaXMgb25seSB1c2VkIGJ5IHRlc3QgY29kZSwgbm90IHdpdGhpbiBhIG1ldGhvZCwgc28gd2UgZG9uJ3RcbiAgLy8gaW50ZXJhY3Qgd2l0aCB0aGUgd3JpdGUgZmVuY2UuXG4gIHZhciBjb2xsZWN0aW9uID0gc2VsZi5yYXdDb2xsZWN0aW9uKGNvbGxlY3Rpb25OYW1lKTtcbiAgdmFyIGluZGV4TmFtZSA9ICBhd2FpdCBjb2xsZWN0aW9uLmRyb3BJbmRleChpbmRleCk7XG59O1xuXG5cbkNMSUVOVF9PTkxZX01FVEhPRFMuZm9yRWFjaChmdW5jdGlvbiAobSkge1xuICBNb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlW21dID0gZnVuY3Rpb24gKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGAke219ICsgIGlzIG5vdCBhdmFpbGFibGUgb24gdGhlIHNlcnZlci4gUGxlYXNlIHVzZSAke2dldEFzeW5jTWV0aG9kTmFtZShcbiAgICAgICAgbVxuICAgICAgKX0oKSBpbnN0ZWFkLmBcbiAgICApO1xuICB9O1xufSk7XG5cbi8vIENVUlNPUlNcblxuLy8gVGhlcmUgYXJlIHNldmVyYWwgY2xhc3NlcyB3aGljaCByZWxhdGUgdG8gY3Vyc29yczpcbi8vXG4vLyBDdXJzb3JEZXNjcmlwdGlvbiByZXByZXNlbnRzIHRoZSBhcmd1bWVudHMgdXNlZCB0byBjb25zdHJ1Y3QgYSBjdXJzb3I6XG4vLyBjb2xsZWN0aW9uTmFtZSwgc2VsZWN0b3IsIGFuZCAoZmluZCkgb3B0aW9ucy4gIEJlY2F1c2UgaXQgaXMgdXNlZCBhcyBhIGtleVxuLy8gZm9yIGN1cnNvciBkZS1kdXAsIGV2ZXJ5dGhpbmcgaW4gaXQgc2hvdWxkIGVpdGhlciBiZSBKU09OLXN0cmluZ2lmaWFibGUgb3Jcbi8vIG5vdCBhZmZlY3Qgb2JzZXJ2ZUNoYW5nZXMgb3V0cHV0IChlZywgb3B0aW9ucy50cmFuc2Zvcm0gZnVuY3Rpb25zIGFyZSBub3Rcbi8vIHN0cmluZ2lmaWFibGUgYnV0IGRvIG5vdCBhZmZlY3Qgb2JzZXJ2ZUNoYW5nZXMpLlxuLy9cbi8vIFN5bmNocm9ub3VzQ3Vyc29yIGlzIGEgd3JhcHBlciBhcm91bmQgYSBNb25nb0RCIGN1cnNvclxuLy8gd2hpY2ggaW5jbHVkZXMgZnVsbHktc3luY2hyb25vdXMgdmVyc2lvbnMgb2YgZm9yRWFjaCwgZXRjLlxuLy9cbi8vIEN1cnNvciBpcyB0aGUgY3Vyc29yIG9iamVjdCByZXR1cm5lZCBmcm9tIGZpbmQoKSwgd2hpY2ggaW1wbGVtZW50cyB0aGVcbi8vIGRvY3VtZW50ZWQgTW9uZ28uQ29sbGVjdGlvbiBjdXJzb3IgQVBJLiAgSXQgd3JhcHMgYSBDdXJzb3JEZXNjcmlwdGlvbiBhbmQgYVxuLy8gU3luY2hyb25vdXNDdXJzb3IgKGxhemlseTogaXQgZG9lc24ndCBjb250YWN0IE1vbmdvIHVudGlsIHlvdSBjYWxsIGEgbWV0aG9kXG4vLyBsaWtlIGZldGNoIG9yIGZvckVhY2ggb24gaXQpLlxuLy9cbi8vIE9ic2VydmVIYW5kbGUgaXMgdGhlIFwib2JzZXJ2ZSBoYW5kbGVcIiByZXR1cm5lZCBmcm9tIG9ic2VydmVDaGFuZ2VzLiBJdCBoYXMgYVxuLy8gcmVmZXJlbmNlIHRvIGFuIE9ic2VydmVNdWx0aXBsZXhlci5cbi8vXG4vLyBPYnNlcnZlTXVsdGlwbGV4ZXIgYWxsb3dzIG11bHRpcGxlIGlkZW50aWNhbCBPYnNlcnZlSGFuZGxlcyB0byBiZSBkcml2ZW4gYnkgYVxuLy8gc2luZ2xlIG9ic2VydmUgZHJpdmVyLlxuLy9cbi8vIFRoZXJlIGFyZSB0d28gXCJvYnNlcnZlIGRyaXZlcnNcIiB3aGljaCBkcml2ZSBPYnNlcnZlTXVsdGlwbGV4ZXJzOlxuLy8gICAtIFBvbGxpbmdPYnNlcnZlRHJpdmVyIGNhY2hlcyB0aGUgcmVzdWx0cyBvZiBhIHF1ZXJ5IGFuZCByZXJ1bnMgaXQgd2hlblxuLy8gICAgIG5lY2Vzc2FyeS5cbi8vICAgLSBPcGxvZ09ic2VydmVEcml2ZXIgZm9sbG93cyB0aGUgTW9uZ28gb3BlcmF0aW9uIGxvZyB0byBkaXJlY3RseSBvYnNlcnZlXG4vLyAgICAgZGF0YWJhc2UgY2hhbmdlcy5cbi8vIEJvdGggaW1wbGVtZW50YXRpb25zIGZvbGxvdyB0aGUgc2FtZSBzaW1wbGUgaW50ZXJmYWNlOiB3aGVuIHlvdSBjcmVhdGUgdGhlbSxcbi8vIHRoZXkgc3RhcnQgc2VuZGluZyBvYnNlcnZlQ2hhbmdlcyBjYWxsYmFja3MgKGFuZCBhIHJlYWR5KCkgaW52b2NhdGlvbikgdG9cbi8vIHRoZWlyIE9ic2VydmVNdWx0aXBsZXhlciwgYW5kIHlvdSBzdG9wIHRoZW0gYnkgY2FsbGluZyB0aGVpciBzdG9wKCkgbWV0aG9kLlxuXG5DdXJzb3JEZXNjcmlwdGlvbiA9IGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSwgc2VsZWN0b3IsIG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLmNvbGxlY3Rpb25OYW1lID0gY29sbGVjdGlvbk5hbWU7XG4gIHNlbGYuc2VsZWN0b3IgPSBNb25nby5Db2xsZWN0aW9uLl9yZXdyaXRlU2VsZWN0b3Ioc2VsZWN0b3IpO1xuICBzZWxmLm9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xufTtcblxuQ3Vyc29yID0gZnVuY3Rpb24gKG1vbmdvLCBjdXJzb3JEZXNjcmlwdGlvbikge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgc2VsZi5fbW9uZ28gPSBtb25nbztcbiAgc2VsZi5fY3Vyc29yRGVzY3JpcHRpb24gPSBjdXJzb3JEZXNjcmlwdGlvbjtcbiAgc2VsZi5fc3luY2hyb25vdXNDdXJzb3IgPSBudWxsO1xufTtcblxuZnVuY3Rpb24gc2V0dXBTeW5jaHJvbm91c0N1cnNvcihjdXJzb3IsIG1ldGhvZCkge1xuICAvLyBZb3UgY2FuIG9ubHkgb2JzZXJ2ZSBhIHRhaWxhYmxlIGN1cnNvci5cbiAgaWYgKGN1cnNvci5fY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucy50YWlsYWJsZSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBjYWxsICcgKyBtZXRob2QgKyAnIG9uIGEgdGFpbGFibGUgY3Vyc29yJyk7XG5cbiAgaWYgKCFjdXJzb3IuX3N5bmNocm9ub3VzQ3Vyc29yKSB7XG4gICAgY3Vyc29yLl9zeW5jaHJvbm91c0N1cnNvciA9IGN1cnNvci5fbW9uZ28uX2NyZWF0ZVN5bmNocm9ub3VzQ3Vyc29yKFxuICAgICAgY3Vyc29yLl9jdXJzb3JEZXNjcmlwdGlvbixcbiAgICAgIHtcbiAgICAgICAgLy8gTWFrZSBzdXJlIHRoYXQgdGhlIFwiY3Vyc29yXCIgYXJndW1lbnQgdG8gZm9yRWFjaC9tYXAgY2FsbGJhY2tzIGlzIHRoZVxuICAgICAgICAvLyBDdXJzb3IsIG5vdCB0aGUgU3luY2hyb25vdXNDdXJzb3IuXG4gICAgICAgIHNlbGZGb3JJdGVyYXRpb246IGN1cnNvcixcbiAgICAgICAgdXNlVHJhbnNmb3JtOiB0cnVlLFxuICAgICAgfVxuICAgICk7XG4gIH1cblxuICByZXR1cm4gY3Vyc29yLl9zeW5jaHJvbm91c0N1cnNvcjtcbn1cblxuXG5DdXJzb3IucHJvdG90eXBlLmNvdW50QXN5bmMgPSBhc3luYyBmdW5jdGlvbiAoKSB7XG4gIGNvbnN0IGNvbGxlY3Rpb24gPSB0aGlzLl9tb25nby5yYXdDb2xsZWN0aW9uKHRoaXMuX2N1cnNvckRlc2NyaXB0aW9uLmNvbGxlY3Rpb25OYW1lKTtcbiAgcmV0dXJuIGF3YWl0IGNvbGxlY3Rpb24uY291bnREb2N1bWVudHMoXG4gICAgcmVwbGFjZVR5cGVzKHRoaXMuX2N1cnNvckRlc2NyaXB0aW9uLnNlbGVjdG9yLCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbyksXG4gICAgcmVwbGFjZVR5cGVzKHRoaXMuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMsIHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvKSxcbiAgKTtcbn07XG5cbkN1cnNvci5wcm90b3R5cGUuY291bnQgPSBmdW5jdGlvbiAoKSB7XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICBcImNvdW50KCkgaXMgbm90IGF2YWlsYWJsZSBvbiB0aGUgc2VydmVyLiBQbGVhc2UgdXNlIGNvdW50QXN5bmMoKSBpbnN0ZWFkLlwiXG4gICk7XG59O1xuXG5bLi4uQVNZTkNfQ1VSU09SX01FVEhPRFMsIFN5bWJvbC5pdGVyYXRvciwgU3ltYm9sLmFzeW5jSXRlcmF0b3JdLmZvckVhY2gobWV0aG9kTmFtZSA9PiB7XG4gIC8vIGNvdW50IGlzIGhhbmRsZWQgc3BlY2lhbGx5IHNpbmNlIHdlIGRvbid0IHdhbnQgdG8gY3JlYXRlIGEgY3Vyc29yLlxuICAvLyBpdCBpcyBzdGlsbCBpbmNsdWRlZCBpbiBBU1lOQ19DVVJTT1JfTUVUSE9EUyBiZWNhdXNlIHdlIHN0aWxsIHdhbnQgYW4gYXN5bmMgdmVyc2lvbiBvZiBpdCB0byBleGlzdC5cbiAgaWYgKG1ldGhvZE5hbWUgPT09ICdjb3VudCcpIHtcbiAgICByZXR1cm5cbiAgfVxuICBDdXJzb3IucHJvdG90eXBlW21ldGhvZE5hbWVdID0gZnVuY3Rpb24gKC4uLmFyZ3MpIHtcbiAgICBjb25zdCBjdXJzb3IgPSBzZXR1cFN5bmNocm9ub3VzQ3Vyc29yKHRoaXMsIG1ldGhvZE5hbWUpO1xuICAgIHJldHVybiBjdXJzb3JbbWV0aG9kTmFtZV0oLi4uYXJncyk7XG4gIH07XG5cbiAgLy8gVGhlc2UgbWV0aG9kcyBhcmUgaGFuZGxlZCBzZXBhcmF0ZWx5LlxuICBpZiAobWV0aG9kTmFtZSA9PT0gU3ltYm9sLml0ZXJhdG9yIHx8IG1ldGhvZE5hbWUgPT09IFN5bWJvbC5hc3luY0l0ZXJhdG9yKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgbWV0aG9kTmFtZUFzeW5jID0gZ2V0QXN5bmNNZXRob2ROYW1lKG1ldGhvZE5hbWUpO1xuICBDdXJzb3IucHJvdG90eXBlW21ldGhvZE5hbWVBc3luY10gPSBmdW5jdGlvbiAoLi4uYXJncykge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXNbbWV0aG9kTmFtZV0oLi4uYXJncykpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgIH1cbiAgfTtcbn0pO1xuXG5DdXJzb3IucHJvdG90eXBlLmdldFRyYW5zZm9ybSA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMudHJhbnNmb3JtO1xufTtcblxuLy8gV2hlbiB5b3UgY2FsbCBNZXRlb3IucHVibGlzaCgpIHdpdGggYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgYSBDdXJzb3IsIHdlIG5lZWRcbi8vIHRvIHRyYW5zbXV0ZSBpdCBpbnRvIHRoZSBlcXVpdmFsZW50IHN1YnNjcmlwdGlvbi4gIFRoaXMgaXMgdGhlIGZ1bmN0aW9uIHRoYXRcbi8vIGRvZXMgdGhhdC5cbkN1cnNvci5wcm90b3R5cGUuX3B1Ymxpc2hDdXJzb3IgPSBmdW5jdGlvbiAoc3ViKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGNvbGxlY3Rpb24gPSBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5jb2xsZWN0aW9uTmFtZTtcbiAgcmV0dXJuIE1vbmdvLkNvbGxlY3Rpb24uX3B1Ymxpc2hDdXJzb3Ioc2VsZiwgc3ViLCBjb2xsZWN0aW9uKTtcbn07XG5cbi8vIFVzZWQgdG8gZ3VhcmFudGVlIHRoYXQgcHVibGlzaCBmdW5jdGlvbnMgcmV0dXJuIGF0IG1vc3Qgb25lIGN1cnNvciBwZXJcbi8vIGNvbGxlY3Rpb24uIFByaXZhdGUsIGJlY2F1c2Ugd2UgbWlnaHQgbGF0ZXIgaGF2ZSBjdXJzb3JzIHRoYXQgaW5jbHVkZVxuLy8gZG9jdW1lbnRzIGZyb20gbXVsdGlwbGUgY29sbGVjdGlvbnMgc29tZWhvdy5cbkN1cnNvci5wcm90b3R5cGUuX2dldENvbGxlY3Rpb25OYW1lID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHJldHVybiBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5jb2xsZWN0aW9uTmFtZTtcbn07XG5cbkN1cnNvci5wcm90b3R5cGUub2JzZXJ2ZSA9IGZ1bmN0aW9uIChjYWxsYmFja3MpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICByZXR1cm4gTG9jYWxDb2xsZWN0aW9uLl9vYnNlcnZlRnJvbU9ic2VydmVDaGFuZ2VzKHNlbGYsIGNhbGxiYWNrcyk7XG59O1xuXG5DdXJzb3IucHJvdG90eXBlLm9ic2VydmVBc3luYyA9IGZ1bmN0aW9uIChjYWxsYmFja3MpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4gcmVzb2x2ZSh0aGlzLm9ic2VydmUoY2FsbGJhY2tzKSkpO1xufTtcblxuQ3Vyc29yLnByb3RvdHlwZS5vYnNlcnZlQ2hhbmdlcyA9IGZ1bmN0aW9uIChjYWxsYmFja3MsIG9wdGlvbnMgPSB7fSkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBtZXRob2RzID0gW1xuICAgICdhZGRlZEF0JyxcbiAgICAnYWRkZWQnLFxuICAgICdjaGFuZ2VkQXQnLFxuICAgICdjaGFuZ2VkJyxcbiAgICAncmVtb3ZlZEF0JyxcbiAgICAncmVtb3ZlZCcsXG4gICAgJ21vdmVkVG8nXG4gIF07XG4gIHZhciBvcmRlcmVkID0gTG9jYWxDb2xsZWN0aW9uLl9vYnNlcnZlQ2hhbmdlc0NhbGxiYWNrc0FyZU9yZGVyZWQoY2FsbGJhY2tzKTtcblxuICBsZXQgZXhjZXB0aW9uTmFtZSA9IGNhbGxiYWNrcy5fZnJvbU9ic2VydmUgPyAnb2JzZXJ2ZScgOiAnb2JzZXJ2ZUNoYW5nZXMnO1xuICBleGNlcHRpb25OYW1lICs9ICcgY2FsbGJhY2snO1xuICBtZXRob2RzLmZvckVhY2goZnVuY3Rpb24gKG1ldGhvZCkge1xuICAgIGlmIChjYWxsYmFja3NbbWV0aG9kXSAmJiB0eXBlb2YgY2FsbGJhY2tzW21ldGhvZF0gPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBjYWxsYmFja3NbbWV0aG9kXSA9IE1ldGVvci5iaW5kRW52aXJvbm1lbnQoY2FsbGJhY2tzW21ldGhvZF0sIG1ldGhvZCArIGV4Y2VwdGlvbk5hbWUpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHNlbGYuX21vbmdvLl9vYnNlcnZlQ2hhbmdlcyhcbiAgICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbiwgb3JkZXJlZCwgY2FsbGJhY2tzLCBvcHRpb25zLm5vbk11dGF0aW5nQ2FsbGJhY2tzKTtcbn07XG5cbkN1cnNvci5wcm90b3R5cGUub2JzZXJ2ZUNoYW5nZXNBc3luYyA9IGFzeW5jIGZ1bmN0aW9uIChjYWxsYmFja3MsIG9wdGlvbnMgPSB7fSkge1xuICByZXR1cm4gdGhpcy5vYnNlcnZlQ2hhbmdlcyhjYWxsYmFja3MsIG9wdGlvbnMpO1xufTtcblxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5fY3JlYXRlU3luY2hyb25vdXNDdXJzb3IgPSBmdW5jdGlvbihcbiAgICBjdXJzb3JEZXNjcmlwdGlvbiwgb3B0aW9ucyA9IHt9KSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgY29uc3QgeyBzZWxmRm9ySXRlcmF0aW9uLCB1c2VUcmFuc2Zvcm0gfSA9IG9wdGlvbnM7IFxuICBvcHRpb25zID0geyBzZWxmRm9ySXRlcmF0aW9uLCB1c2VUcmFuc2Zvcm0gfTtcblxuICB2YXIgY29sbGVjdGlvbiA9IHNlbGYucmF3Q29sbGVjdGlvbihjdXJzb3JEZXNjcmlwdGlvbi5jb2xsZWN0aW9uTmFtZSk7XG4gIHZhciBjdXJzb3JPcHRpb25zID0gY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucztcbiAgdmFyIG1vbmdvT3B0aW9ucyA9IHtcbiAgICBzb3J0OiBjdXJzb3JPcHRpb25zLnNvcnQsXG4gICAgbGltaXQ6IGN1cnNvck9wdGlvbnMubGltaXQsXG4gICAgc2tpcDogY3Vyc29yT3B0aW9ucy5za2lwLFxuICAgIHByb2plY3Rpb246IGN1cnNvck9wdGlvbnMuZmllbGRzIHx8IGN1cnNvck9wdGlvbnMucHJvamVjdGlvbixcbiAgICByZWFkUHJlZmVyZW5jZTogY3Vyc29yT3B0aW9ucy5yZWFkUHJlZmVyZW5jZSxcbiAgfTtcblxuICAvLyBEbyB3ZSB3YW50IGEgdGFpbGFibGUgY3Vyc29yICh3aGljaCBvbmx5IHdvcmtzIG9uIGNhcHBlZCBjb2xsZWN0aW9ucyk/XG4gIGlmIChjdXJzb3JPcHRpb25zLnRhaWxhYmxlKSB7XG4gICAgbW9uZ29PcHRpb25zLm51bWJlck9mUmV0cmllcyA9IC0xO1xuICB9XG5cbiAgdmFyIGRiQ3Vyc29yID0gY29sbGVjdGlvbi5maW5kKFxuICAgIHJlcGxhY2VUeXBlcyhjdXJzb3JEZXNjcmlwdGlvbi5zZWxlY3RvciwgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28pLFxuICAgIG1vbmdvT3B0aW9ucyk7XG5cbiAgLy8gRG8gd2Ugd2FudCBhIHRhaWxhYmxlIGN1cnNvciAod2hpY2ggb25seSB3b3JrcyBvbiBjYXBwZWQgY29sbGVjdGlvbnMpP1xuICBpZiAoY3Vyc29yT3B0aW9ucy50YWlsYWJsZSkge1xuICAgIC8vIFdlIHdhbnQgYSB0YWlsYWJsZSBjdXJzb3IuLi5cbiAgICBkYkN1cnNvci5hZGRDdXJzb3JGbGFnKFwidGFpbGFibGVcIiwgdHJ1ZSlcbiAgICAvLyAuLi4gYW5kIGZvciB0aGUgc2VydmVyIHRvIHdhaXQgYSBiaXQgaWYgYW55IGdldE1vcmUgaGFzIG5vIGRhdGEgKHJhdGhlclxuICAgIC8vIHRoYW4gbWFraW5nIHVzIHB1dCB0aGUgcmVsZXZhbnQgc2xlZXBzIGluIHRoZSBjbGllbnQpLi4uXG4gICAgZGJDdXJzb3IuYWRkQ3Vyc29yRmxhZyhcImF3YWl0RGF0YVwiLCB0cnVlKVxuXG4gICAgLy8gQW5kIGlmIHRoaXMgaXMgb24gdGhlIG9wbG9nIGNvbGxlY3Rpb24gYW5kIHRoZSBjdXJzb3Igc3BlY2lmaWVzIGEgJ3RzJyxcbiAgICAvLyB0aGVuIHNldCB0aGUgdW5kb2N1bWVudGVkIG9wbG9nIHJlcGxheSBmbGFnLCB3aGljaCBkb2VzIGEgc3BlY2lhbCBzY2FuIHRvXG4gICAgLy8gZmluZCB0aGUgZmlyc3QgZG9jdW1lbnQgKGluc3RlYWQgb2YgY3JlYXRpbmcgYW4gaW5kZXggb24gdHMpLiBUaGlzIGlzIGFcbiAgICAvLyB2ZXJ5IGhhcmQtY29kZWQgTW9uZ28gZmxhZyB3aGljaCBvbmx5IHdvcmtzIG9uIHRoZSBvcGxvZyBjb2xsZWN0aW9uIGFuZFxuICAgIC8vIG9ubHkgd29ya3Mgd2l0aCB0aGUgdHMgZmllbGQuXG4gICAgaWYgKGN1cnNvckRlc2NyaXB0aW9uLmNvbGxlY3Rpb25OYW1lID09PSBPUExPR19DT0xMRUNUSU9OICYmXG4gICAgICAgIGN1cnNvckRlc2NyaXB0aW9uLnNlbGVjdG9yLnRzKSB7XG4gICAgICBkYkN1cnNvci5hZGRDdXJzb3JGbGFnKFwib3Bsb2dSZXBsYXlcIiwgdHJ1ZSlcbiAgICB9XG4gIH1cblxuICBpZiAodHlwZW9mIGN1cnNvck9wdGlvbnMubWF4VGltZU1zICE9PSAndW5kZWZpbmVkJykge1xuICAgIGRiQ3Vyc29yID0gZGJDdXJzb3IubWF4VGltZU1TKGN1cnNvck9wdGlvbnMubWF4VGltZU1zKTtcbiAgfVxuICBpZiAodHlwZW9mIGN1cnNvck9wdGlvbnMuaGludCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBkYkN1cnNvciA9IGRiQ3Vyc29yLmhpbnQoY3Vyc29yT3B0aW9ucy5oaW50KTtcbiAgfVxuXG4gIHJldHVybiBuZXcgQXN5bmNocm9ub3VzQ3Vyc29yKGRiQ3Vyc29yLCBjdXJzb3JEZXNjcmlwdGlvbiwgb3B0aW9ucywgY29sbGVjdGlvbik7XG59O1xuXG4vKipcbiAqIFRoaXMgaXMganVzdCBhIGxpZ2h0IHdyYXBwZXIgZm9yIHRoZSBjdXJzb3IuIFRoZSBnb2FsIGhlcmUgaXMgdG8gZW5zdXJlIGNvbXBhdGliaWxpdHkgZXZlbiBpZlxuICogdGhlcmUgYXJlIGJyZWFraW5nIGNoYW5nZXMgb24gdGhlIE1vbmdvREIgZHJpdmVyLlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5jbGFzcyBBc3luY2hyb25vdXNDdXJzb3Ige1xuICBjb25zdHJ1Y3RvcihkYkN1cnNvciwgY3Vyc29yRGVzY3JpcHRpb24sIG9wdGlvbnMpIHtcbiAgICB0aGlzLl9kYkN1cnNvciA9IGRiQ3Vyc29yO1xuICAgIHRoaXMuX2N1cnNvckRlc2NyaXB0aW9uID0gY3Vyc29yRGVzY3JpcHRpb247XG5cbiAgICB0aGlzLl9zZWxmRm9ySXRlcmF0aW9uID0gb3B0aW9ucy5zZWxmRm9ySXRlcmF0aW9uIHx8IHRoaXM7XG4gICAgaWYgKG9wdGlvbnMudXNlVHJhbnNmb3JtICYmIGN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMudHJhbnNmb3JtKSB7XG4gICAgICB0aGlzLl90cmFuc2Zvcm0gPSBMb2NhbENvbGxlY3Rpb24ud3JhcFRyYW5zZm9ybShcbiAgICAgICAgICBjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnRyYW5zZm9ybSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3RyYW5zZm9ybSA9IG51bGw7XG4gICAgfVxuXG4gICAgdGhpcy5fdmlzaXRlZElkcyA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuICB9XG5cbiAgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICB2YXIgY3Vyc29yID0gdGhpcztcbiAgICByZXR1cm4ge1xuICAgICAgYXN5bmMgbmV4dCgpIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCBjdXJzb3IuX25leHRPYmplY3RQcm9taXNlKCk7XG4gICAgICAgIHJldHVybiB7IGRvbmU6ICF2YWx1ZSwgdmFsdWUgfTtcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIC8vIFJldHVybnMgYSBQcm9taXNlIGZvciB0aGUgbmV4dCBvYmplY3QgZnJvbSB0aGUgdW5kZXJseWluZyBjdXJzb3IgKGJlZm9yZVxuICAvLyB0aGUgTW9uZ28tPk1ldGVvciB0eXBlIHJlcGxhY2VtZW50KS5cbiAgYXN5bmMgX3Jhd05leHRPYmplY3RQcm9taXNlKCkge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gdGhpcy5fZGJDdXJzb3IubmV4dCgpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgfVxuICB9XG5cbiAgLy8gUmV0dXJucyBhIFByb21pc2UgZm9yIHRoZSBuZXh0IG9iamVjdCBmcm9tIHRoZSBjdXJzb3IsIHNraXBwaW5nIHRob3NlIHdob3NlXG4gIC8vIElEcyB3ZSd2ZSBhbHJlYWR5IHNlZW4gYW5kIHJlcGxhY2luZyBNb25nbyBhdG9tcyB3aXRoIE1ldGVvciBhdG9tcy5cbiAgYXN5bmMgX25leHRPYmplY3RQcm9taXNlICgpIHtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgdmFyIGRvYyA9IGF3YWl0IHRoaXMuX3Jhd05leHRPYmplY3RQcm9taXNlKCk7XG5cbiAgICAgIGlmICghZG9jKSByZXR1cm4gbnVsbDtcbiAgICAgIGRvYyA9IHJlcGxhY2VUeXBlcyhkb2MsIHJlcGxhY2VNb25nb0F0b21XaXRoTWV0ZW9yKTtcblxuICAgICAgaWYgKCF0aGlzLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnRhaWxhYmxlICYmIF8uaGFzKGRvYywgJ19pZCcpKSB7XG4gICAgICAgIC8vIERpZCBNb25nbyBnaXZlIHVzIGR1cGxpY2F0ZSBkb2N1bWVudHMgaW4gdGhlIHNhbWUgY3Vyc29yPyBJZiBzbyxcbiAgICAgICAgLy8gaWdub3JlIHRoaXMgb25lLiAoRG8gdGhpcyBiZWZvcmUgdGhlIHRyYW5zZm9ybSwgc2luY2UgdHJhbnNmb3JtIG1pZ2h0XG4gICAgICAgIC8vIHJldHVybiBzb21lIHVucmVsYXRlZCB2YWx1ZS4pIFdlIGRvbid0IGRvIHRoaXMgZm9yIHRhaWxhYmxlIGN1cnNvcnMsXG4gICAgICAgIC8vIGJlY2F1c2Ugd2Ugd2FudCB0byBtYWludGFpbiBPKDEpIG1lbW9yeSB1c2FnZS4gQW5kIGlmIHRoZXJlIGlzbid0IF9pZFxuICAgICAgICAvLyBmb3Igc29tZSByZWFzb24gKG1heWJlIGl0J3MgdGhlIG9wbG9nKSwgdGhlbiB3ZSBkb24ndCBkbyB0aGlzIGVpdGhlci5cbiAgICAgICAgLy8gKEJlIGNhcmVmdWwgdG8gZG8gdGhpcyBmb3IgZmFsc2V5IGJ1dCBleGlzdGluZyBfaWQsIHRob3VnaC4pXG4gICAgICAgIGlmICh0aGlzLl92aXNpdGVkSWRzLmhhcyhkb2MuX2lkKSkgY29udGludWU7XG4gICAgICAgIHRoaXMuX3Zpc2l0ZWRJZHMuc2V0KGRvYy5faWQsIHRydWUpO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fdHJhbnNmb3JtKVxuICAgICAgICBkb2MgPSB0aGlzLl90cmFuc2Zvcm0oZG9jKTtcblxuICAgICAgcmV0dXJuIGRvYztcbiAgICB9XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgcHJvbWlzZSB3aGljaCBpcyByZXNvbHZlZCB3aXRoIHRoZSBuZXh0IG9iamVjdCAobGlrZSB3aXRoXG4gIC8vIF9uZXh0T2JqZWN0UHJvbWlzZSkgb3IgcmVqZWN0ZWQgaWYgdGhlIGN1cnNvciBkb2Vzbid0IHJldHVybiB3aXRoaW5cbiAgLy8gdGltZW91dE1TIG1zLlxuICBfbmV4dE9iamVjdFByb21pc2VXaXRoVGltZW91dCh0aW1lb3V0TVMpIHtcbiAgICBpZiAoIXRpbWVvdXRNUykge1xuICAgICAgcmV0dXJuIHRoaXMuX25leHRPYmplY3RQcm9taXNlKCk7XG4gICAgfVxuICAgIGNvbnN0IG5leHRPYmplY3RQcm9taXNlID0gdGhpcy5fbmV4dE9iamVjdFByb21pc2UoKTtcbiAgICBjb25zdCB0aW1lb3V0RXJyID0gbmV3IEVycm9yKCdDbGllbnQtc2lkZSB0aW1lb3V0IHdhaXRpbmcgZm9yIG5leHQgb2JqZWN0Jyk7XG4gICAgY29uc3QgdGltZW91dFByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgcmVqZWN0KHRpbWVvdXRFcnIpO1xuICAgICAgfSwgdGltZW91dE1TKTtcbiAgICB9KTtcbiAgICByZXR1cm4gUHJvbWlzZS5yYWNlKFtuZXh0T2JqZWN0UHJvbWlzZSwgdGltZW91dFByb21pc2VdKVxuICAgICAgICAuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgIGlmIChlcnIgPT09IHRpbWVvdXRFcnIpIHtcbiAgICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIGZvckVhY2goY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICAvLyBHZXQgYmFjayB0byB0aGUgYmVnaW5uaW5nLlxuICAgIHRoaXMuX3Jld2luZCgpO1xuXG4gICAgbGV0IGlkeCA9IDA7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IGRvYyA9IGF3YWl0IHRoaXMuX25leHRPYmplY3RQcm9taXNlKCk7XG4gICAgICBpZiAoIWRvYykgcmV0dXJuO1xuICAgICAgYXdhaXQgY2FsbGJhY2suY2FsbCh0aGlzQXJnLCBkb2MsIGlkeCsrLCB0aGlzLl9zZWxmRm9ySXRlcmF0aW9uKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBtYXAoY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICBjb25zdCByZXN1bHRzID0gW107XG4gICAgYXdhaXQgdGhpcy5mb3JFYWNoKGFzeW5jIChkb2MsIGluZGV4KSA9PiB7XG4gICAgICByZXN1bHRzLnB1c2goYXdhaXQgY2FsbGJhY2suY2FsbCh0aGlzQXJnLCBkb2MsIGluZGV4LCB0aGlzLl9zZWxmRm9ySXRlcmF0aW9uKSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfVxuXG4gIF9yZXdpbmQoKSB7XG4gICAgLy8ga25vd24gdG8gYmUgc3luY2hyb25vdXNcbiAgICB0aGlzLl9kYkN1cnNvci5yZXdpbmQoKTtcblxuICAgIHRoaXMuX3Zpc2l0ZWRJZHMgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcbiAgfVxuXG4gIC8vIE1vc3RseSB1c2FibGUgZm9yIHRhaWxhYmxlIGN1cnNvcnMuXG4gIGNsb3NlKCkge1xuICAgIHRoaXMuX2RiQ3Vyc29yLmNsb3NlKCk7XG4gIH1cblxuICBmZXRjaCgpIHtcbiAgICByZXR1cm4gdGhpcy5tYXAoXy5pZGVudGl0eSk7XG4gIH1cblxuICAvKipcbiAgICogRklYTUU6IChub2RlOjM0NjgwKSBbTU9OR09EQiBEUklWRVJdIFdhcm5pbmc6IGN1cnNvci5jb3VudCBpcyBkZXByZWNhdGVkIGFuZCB3aWxsIGJlXG4gICAqICByZW1vdmVkIGluIHRoZSBuZXh0IG1ham9yIHZlcnNpb24sIHBsZWFzZSB1c2UgYGNvbGxlY3Rpb24uZXN0aW1hdGVkRG9jdW1lbnRDb3VudGAgb3JcbiAgICogIGBjb2xsZWN0aW9uLmNvdW50RG9jdW1lbnRzYCBpbnN0ZWFkLlxuICAgKi9cbiAgY291bnQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2RiQ3Vyc29yLmNvdW50KCk7XG4gIH1cblxuICAvLyBUaGlzIG1ldGhvZCBpcyBOT1Qgd3JhcHBlZCBpbiBDdXJzb3IuXG4gIGFzeW5jIGdldFJhd09iamVjdHMob3JkZXJlZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAob3JkZXJlZCkge1xuICAgICAgcmV0dXJuIHNlbGYuZmV0Y2goKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHJlc3VsdHMgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcbiAgICAgIGF3YWl0IHNlbGYuZm9yRWFjaChmdW5jdGlvbiAoZG9jKSB7XG4gICAgICAgIHJlc3VsdHMuc2V0KGRvYy5faWQsIGRvYyk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cbiAgfVxufVxuXG52YXIgU3luY2hyb25vdXNDdXJzb3IgPSBmdW5jdGlvbiAoZGJDdXJzb3IsIGN1cnNvckRlc2NyaXB0aW9uLCBvcHRpb25zLCBjb2xsZWN0aW9uKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgY29uc3QgeyBzZWxmRm9ySXRlcmF0aW9uLCB1c2VUcmFuc2Zvcm0gfSA9IG9wdGlvbnM7IFxuICBvcHRpb25zID0geyBzZWxmRm9ySXRlcmF0aW9uLCB1c2VUcmFuc2Zvcm0gfTtcblxuICBzZWxmLl9kYkN1cnNvciA9IGRiQ3Vyc29yO1xuICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbiA9IGN1cnNvckRlc2NyaXB0aW9uO1xuICAvLyBUaGUgXCJzZWxmXCIgYXJndW1lbnQgcGFzc2VkIHRvIGZvckVhY2gvbWFwIGNhbGxiYWNrcy4gSWYgd2UncmUgd3JhcHBlZFxuICAvLyBpbnNpZGUgYSB1c2VyLXZpc2libGUgQ3Vyc29yLCB3ZSB3YW50IHRvIHByb3ZpZGUgdGhlIG91dGVyIGN1cnNvciFcbiAgc2VsZi5fc2VsZkZvckl0ZXJhdGlvbiA9IG9wdGlvbnMuc2VsZkZvckl0ZXJhdGlvbiB8fCBzZWxmO1xuICBpZiAob3B0aW9ucy51c2VUcmFuc2Zvcm0gJiYgY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucy50cmFuc2Zvcm0pIHtcbiAgICBzZWxmLl90cmFuc2Zvcm0gPSBMb2NhbENvbGxlY3Rpb24ud3JhcFRyYW5zZm9ybShcbiAgICAgIGN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMudHJhbnNmb3JtKTtcbiAgfSBlbHNlIHtcbiAgICBzZWxmLl90cmFuc2Zvcm0gPSBudWxsO1xuICB9XG5cbiAgc2VsZi5fc3luY2hyb25vdXNDb3VudCA9IEZ1dHVyZS53cmFwKFxuICAgIGNvbGxlY3Rpb24uY291bnREb2N1bWVudHMuYmluZChcbiAgICAgIGNvbGxlY3Rpb24sXG4gICAgICByZXBsYWNlVHlwZXMoY3Vyc29yRGVzY3JpcHRpb24uc2VsZWN0b3IsIHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvKSxcbiAgICAgIHJlcGxhY2VUeXBlcyhjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbyksXG4gICAgKVxuICApO1xuICBzZWxmLl92aXNpdGVkSWRzID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG59O1xuXG5PYmplY3QuYXNzaWduKFN5bmNocm9ub3VzQ3Vyc29yLnByb3RvdHlwZSwge1xuICAvLyBSZXR1cm5zIGEgUHJvbWlzZSBmb3IgdGhlIG5leHQgb2JqZWN0IGZyb20gdGhlIHVuZGVybHlpbmcgY3Vyc29yIChiZWZvcmVcbiAgLy8gdGhlIE1vbmdvLT5NZXRlb3IgdHlwZSByZXBsYWNlbWVudCkuXG4gIF9yYXdOZXh0T2JqZWN0UHJvbWlzZTogZnVuY3Rpb24gKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBzZWxmLl9kYkN1cnNvci5uZXh0KChlcnIsIGRvYykgPT4ge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzb2x2ZShkb2MpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBSZXR1cm5zIGEgUHJvbWlzZSBmb3IgdGhlIG5leHQgb2JqZWN0IGZyb20gdGhlIGN1cnNvciwgc2tpcHBpbmcgdGhvc2Ugd2hvc2VcbiAgLy8gSURzIHdlJ3ZlIGFscmVhZHkgc2VlbiBhbmQgcmVwbGFjaW5nIE1vbmdvIGF0b21zIHdpdGggTWV0ZW9yIGF0b21zLlxuICBfbmV4dE9iamVjdFByb21pc2U6IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgdmFyIGRvYyA9IGF3YWl0IHNlbGYuX3Jhd05leHRPYmplY3RQcm9taXNlKCk7XG5cbiAgICAgIGlmICghZG9jKSByZXR1cm4gbnVsbDtcbiAgICAgIGRvYyA9IHJlcGxhY2VUeXBlcyhkb2MsIHJlcGxhY2VNb25nb0F0b21XaXRoTWV0ZW9yKTtcblxuICAgICAgaWYgKCFzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnRhaWxhYmxlICYmIGhhcyhkb2MsICdfaWQnKSkge1xuICAgICAgICAvLyBEaWQgTW9uZ28gZ2l2ZSB1cyBkdXBsaWNhdGUgZG9jdW1lbnRzIGluIHRoZSBzYW1lIGN1cnNvcj8gSWYgc28sXG4gICAgICAgIC8vIGlnbm9yZSB0aGlzIG9uZS4gKERvIHRoaXMgYmVmb3JlIHRoZSB0cmFuc2Zvcm0sIHNpbmNlIHRyYW5zZm9ybSBtaWdodFxuICAgICAgICAvLyByZXR1cm4gc29tZSB1bnJlbGF0ZWQgdmFsdWUuKSBXZSBkb24ndCBkbyB0aGlzIGZvciB0YWlsYWJsZSBjdXJzb3JzLFxuICAgICAgICAvLyBiZWNhdXNlIHdlIHdhbnQgdG8gbWFpbnRhaW4gTygxKSBtZW1vcnkgdXNhZ2UuIEFuZCBpZiB0aGVyZSBpc24ndCBfaWRcbiAgICAgICAgLy8gZm9yIHNvbWUgcmVhc29uIChtYXliZSBpdCdzIHRoZSBvcGxvZyksIHRoZW4gd2UgZG9uJ3QgZG8gdGhpcyBlaXRoZXIuXG4gICAgICAgIC8vIChCZSBjYXJlZnVsIHRvIGRvIHRoaXMgZm9yIGZhbHNleSBidXQgZXhpc3RpbmcgX2lkLCB0aG91Z2guKVxuICAgICAgICBpZiAoc2VsZi5fdmlzaXRlZElkcy5oYXMoZG9jLl9pZCkpIGNvbnRpbnVlO1xuICAgICAgICBzZWxmLl92aXNpdGVkSWRzLnNldChkb2MuX2lkLCB0cnVlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHNlbGYuX3RyYW5zZm9ybSlcbiAgICAgICAgZG9jID0gc2VsZi5fdHJhbnNmb3JtKGRvYyk7XG5cbiAgICAgIHJldHVybiBkb2M7XG4gICAgfVxuICB9LFxuXG4gIC8vIFJldHVybnMgYSBwcm9taXNlIHdoaWNoIGlzIHJlc29sdmVkIHdpdGggdGhlIG5leHQgb2JqZWN0IChsaWtlIHdpdGhcbiAgLy8gX25leHRPYmplY3RQcm9taXNlKSBvciByZWplY3RlZCBpZiB0aGUgY3Vyc29yIGRvZXNuJ3QgcmV0dXJuIHdpdGhpblxuICAvLyB0aW1lb3V0TVMgbXMuXG4gIF9uZXh0T2JqZWN0UHJvbWlzZVdpdGhUaW1lb3V0OiBmdW5jdGlvbiAodGltZW91dE1TKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCF0aW1lb3V0TVMpIHtcbiAgICAgIHJldHVybiBzZWxmLl9uZXh0T2JqZWN0UHJvbWlzZSgpO1xuICAgIH1cbiAgICBjb25zdCBuZXh0T2JqZWN0UHJvbWlzZSA9IHNlbGYuX25leHRPYmplY3RQcm9taXNlKCk7XG4gICAgY29uc3QgdGltZW91dEVyciA9IG5ldyBFcnJvcignQ2xpZW50LXNpZGUgdGltZW91dCB3YWl0aW5nIGZvciBuZXh0IG9iamVjdCcpO1xuICAgIGNvbnN0IHRpbWVvdXRQcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgcmVqZWN0KHRpbWVvdXRFcnIpO1xuICAgICAgfSwgdGltZW91dE1TKTtcbiAgICB9KTtcbiAgICByZXR1cm4gUHJvbWlzZS5yYWNlKFtuZXh0T2JqZWN0UHJvbWlzZSwgdGltZW91dFByb21pc2VdKVxuICAgICAgLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgaWYgKGVyciA9PT0gdGltZW91dEVycikge1xuICAgICAgICAgIHNlbGYuY2xvc2UoKTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9KTtcbiAgfSxcblxuICBfbmV4dE9iamVjdDogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gc2VsZi5fbmV4dE9iamVjdFByb21pc2UoKS5hd2FpdCgpO1xuICB9LFxuXG4gIGZvckVhY2g6IGZ1bmN0aW9uIChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBjb25zdCB3cmFwcGVkRm4gPSBNZXRlb3Iud3JhcEZuKGNhbGxiYWNrKTtcblxuICAgIC8vIEdldCBiYWNrIHRvIHRoZSBiZWdpbm5pbmcuXG4gICAgc2VsZi5fcmV3aW5kKCk7XG5cbiAgICAvLyBXZSBpbXBsZW1lbnQgdGhlIGxvb3Agb3Vyc2VsZiBpbnN0ZWFkIG9mIHVzaW5nIHNlbGYuX2RiQ3Vyc29yLmVhY2gsXG4gICAgLy8gYmVjYXVzZSBcImVhY2hcIiB3aWxsIGNhbGwgaXRzIGNhbGxiYWNrIG91dHNpZGUgb2YgYSBmaWJlciB3aGljaCBtYWtlcyBpdFxuICAgIC8vIG11Y2ggbW9yZSBjb21wbGV4IHRvIG1ha2UgdGhpcyBmdW5jdGlvbiBzeW5jaHJvbm91cy5cbiAgICB2YXIgaW5kZXggPSAwO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICB2YXIgZG9jID0gc2VsZi5fbmV4dE9iamVjdCgpO1xuICAgICAgaWYgKCFkb2MpIHJldHVybjtcbiAgICAgIHdyYXBwZWRGbi5jYWxsKHRoaXNBcmcsIGRvYywgaW5kZXgrKywgc2VsZi5fc2VsZkZvckl0ZXJhdGlvbik7XG4gICAgfVxuICB9LFxuXG4gIC8vIFhYWCBBbGxvdyBvdmVybGFwcGluZyBjYWxsYmFjayBleGVjdXRpb25zIGlmIGNhbGxiYWNrIHlpZWxkcy5cbiAgbWFwOiBmdW5jdGlvbiAoY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgY29uc3Qgd3JhcHBlZEZuID0gTWV0ZW9yLndyYXBGbihjYWxsYmFjayk7XG4gICAgdmFyIHJlcyA9IFtdO1xuICAgIHNlbGYuZm9yRWFjaChmdW5jdGlvbiAoZG9jLCBpbmRleCkge1xuICAgICAgcmVzLnB1c2god3JhcHBlZEZuLmNhbGwodGhpc0FyZywgZG9jLCBpbmRleCwgc2VsZi5fc2VsZkZvckl0ZXJhdGlvbikpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXM7XG4gIH0sXG5cbiAgX3Jld2luZDogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIC8vIGtub3duIHRvIGJlIHN5bmNocm9ub3VzXG4gICAgc2VsZi5fZGJDdXJzb3IucmV3aW5kKCk7XG5cbiAgICBzZWxmLl92aXNpdGVkSWRzID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gIH0sXG5cbiAgLy8gTW9zdGx5IHVzYWJsZSBmb3IgdGFpbGFibGUgY3Vyc29ycy5cbiAgY2xvc2U6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBzZWxmLl9kYkN1cnNvci5jbG9zZSgpO1xuICB9LFxuXG4gIGZldGNoOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBzZWxmLm1hcChpZGVudGl0eSk7XG4gIH0sXG5cbiAgY291bnQ6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcmV0dXJuIHNlbGYuX3N5bmNocm9ub3VzQ291bnQoKS53YWl0KCk7XG4gIH0sXG5cbiAgLy8gVGhpcyBtZXRob2QgaXMgTk9UIHdyYXBwZWQgaW4gQ3Vyc29yLlxuICBnZXRSYXdPYmplY3RzOiBmdW5jdGlvbiAob3JkZXJlZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAob3JkZXJlZCkge1xuICAgICAgcmV0dXJuIHNlbGYuZmV0Y2goKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHJlc3VsdHMgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcbiAgICAgIHNlbGYuZm9yRWFjaChmdW5jdGlvbiAoZG9jKSB7XG4gICAgICAgIHJlc3VsdHMuc2V0KGRvYy5faWQsIGRvYyk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cbiAgfVxufSk7XG5cblN5bmNocm9ub3VzQ3Vyc29yLnByb3RvdHlwZVtTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgLy8gR2V0IGJhY2sgdG8gdGhlIGJlZ2lubmluZy5cbiAgc2VsZi5fcmV3aW5kKCk7XG5cbiAgcmV0dXJuIHtcbiAgICBuZXh0KCkge1xuICAgICAgY29uc3QgZG9jID0gc2VsZi5fbmV4dE9iamVjdCgpO1xuICAgICAgcmV0dXJuIGRvYyA/IHtcbiAgICAgICAgdmFsdWU6IGRvY1xuICAgICAgfSA6IHtcbiAgICAgICAgZG9uZTogdHJ1ZVxuICAgICAgfTtcbiAgICB9XG4gIH07XG59O1xuXG5TeW5jaHJvbm91c0N1cnNvci5wcm90b3R5cGVbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID0gZnVuY3Rpb24gKCkge1xuICBjb25zdCBzeW5jUmVzdWx0ID0gdGhpc1tTeW1ib2wuaXRlcmF0b3JdKCk7XG4gIHJldHVybiB7XG4gICAgYXN5bmMgbmV4dCgpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoc3luY1Jlc3VsdC5uZXh0KCkpO1xuICAgIH1cbiAgfTtcbn1cblxuLy8gVGFpbHMgdGhlIGN1cnNvciBkZXNjcmliZWQgYnkgY3Vyc29yRGVzY3JpcHRpb24sIG1vc3QgbGlrZWx5IG9uIHRoZVxuLy8gb3Bsb2cuIENhbGxzIGRvY0NhbGxiYWNrIHdpdGggZWFjaCBkb2N1bWVudCBmb3VuZC4gSWdub3JlcyBlcnJvcnMgYW5kIGp1c3Rcbi8vIHJlc3RhcnRzIHRoZSB0YWlsIG9uIGVycm9yLlxuLy9cbi8vIElmIHRpbWVvdXRNUyBpcyBzZXQsIHRoZW4gaWYgd2UgZG9uJ3QgZ2V0IGEgbmV3IGRvY3VtZW50IGV2ZXJ5IHRpbWVvdXRNUyxcbi8vIGtpbGwgYW5kIHJlc3RhcnQgdGhlIGN1cnNvci4gVGhpcyBpcyBwcmltYXJpbHkgYSB3b3JrYXJvdW5kIGZvciAjODU5OC5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUudGFpbCA9IGZ1bmN0aW9uIChjdXJzb3JEZXNjcmlwdGlvbiwgZG9jQ2FsbGJhY2ssIHRpbWVvdXRNUykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIGlmICghY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucy50YWlsYWJsZSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4gb25seSB0YWlsIGEgdGFpbGFibGUgY3Vyc29yXCIpO1xuXG4gIHZhciBjdXJzb3IgPSBzZWxmLl9jcmVhdGVTeW5jaHJvbm91c0N1cnNvcihjdXJzb3JEZXNjcmlwdGlvbik7XG5cbiAgdmFyIHN0b3BwZWQgPSBmYWxzZTtcbiAgdmFyIGxhc3RUUztcblxuICBNZXRlb3IuZGVmZXIoYXN5bmMgZnVuY3Rpb24gbG9vcCgpIHtcbiAgICB2YXIgZG9jID0gbnVsbDtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgaWYgKHN0b3BwZWQpXG4gICAgICAgIHJldHVybjtcbiAgICAgIHRyeSB7XG4gICAgICAgIGRvYyA9IGF3YWl0IGN1cnNvci5fbmV4dE9iamVjdFByb21pc2VXaXRoVGltZW91dCh0aW1lb3V0TVMpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIC8vIFRoZXJlJ3Mgbm8gZ29vZCB3YXkgdG8gZmlndXJlIG91dCBpZiB0aGlzIHdhcyBhY3R1YWxseSBhbiBlcnJvciBmcm9tXG4gICAgICAgIC8vIE1vbmdvLCBvciBqdXN0IGNsaWVudC1zaWRlIChpbmNsdWRpbmcgb3VyIG93biB0aW1lb3V0IGVycm9yKS4gQWhcbiAgICAgICAgLy8gd2VsbC4gQnV0IGVpdGhlciB3YXksIHdlIG5lZWQgdG8gcmV0cnkgdGhlIGN1cnNvciAodW5sZXNzIHRoZSBmYWlsdXJlXG4gICAgICAgIC8vIHdhcyBiZWNhdXNlIHRoZSBvYnNlcnZlIGdvdCBzdG9wcGVkKS5cbiAgICAgICAgZG9jID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIC8vIFNpbmNlIHdlIGF3YWl0ZWQgYSBwcm9taXNlIGFib3ZlLCB3ZSBuZWVkIHRvIGNoZWNrIGFnYWluIHRvIHNlZSBpZlxuICAgICAgLy8gd2UndmUgYmVlbiBzdG9wcGVkIGJlZm9yZSBjYWxsaW5nIHRoZSBjYWxsYmFjay5cbiAgICAgIGlmIChzdG9wcGVkKVxuICAgICAgICByZXR1cm47XG4gICAgICBpZiAoZG9jKSB7XG4gICAgICAgIC8vIElmIGEgdGFpbGFibGUgY3Vyc29yIGNvbnRhaW5zIGEgXCJ0c1wiIGZpZWxkLCB1c2UgaXQgdG8gcmVjcmVhdGUgdGhlXG4gICAgICAgIC8vIGN1cnNvciBvbiBlcnJvci4gKFwidHNcIiBpcyBhIHN0YW5kYXJkIHRoYXQgTW9uZ28gdXNlcyBpbnRlcm5hbGx5IGZvclxuICAgICAgICAvLyB0aGUgb3Bsb2csIGFuZCB0aGVyZSdzIGEgc3BlY2lhbCBmbGFnIHRoYXQgbGV0cyB5b3UgZG8gYmluYXJ5IHNlYXJjaFxuICAgICAgICAvLyBvbiBpdCBpbnN0ZWFkIG9mIG5lZWRpbmcgdG8gdXNlIGFuIGluZGV4LilcbiAgICAgICAgbGFzdFRTID0gZG9jLnRzO1xuICAgICAgICBkb2NDYWxsYmFjayhkb2MpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIG5ld1NlbGVjdG9yID0gT2JqZWN0LmFzc2lnbih7fSwgY3Vyc29yRGVzY3JpcHRpb24uc2VsZWN0b3IpO1xuICAgICAgICBpZiAobGFzdFRTKSB7XG4gICAgICAgICAgbmV3U2VsZWN0b3IudHMgPSB7JGd0OiBsYXN0VFN9O1xuICAgICAgICB9XG4gICAgICAgIGN1cnNvciA9IHNlbGYuX2NyZWF0ZVN5bmNocm9ub3VzQ3Vyc29yKG5ldyBDdXJzb3JEZXNjcmlwdGlvbihcbiAgICAgICAgICBjdXJzb3JEZXNjcmlwdGlvbi5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICBuZXdTZWxlY3RvcixcbiAgICAgICAgICBjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zKSk7XG4gICAgICAgIC8vIE1vbmdvIGZhaWxvdmVyIHRha2VzIG1hbnkgc2Vjb25kcy4gIFJldHJ5IGluIGEgYml0LiAgKFdpdGhvdXQgdGhpc1xuICAgICAgICAvLyBzZXRUaW1lb3V0LCB3ZSBwZWcgdGhlIENQVSBhdCAxMDAlIGFuZCBuZXZlciBub3RpY2UgdGhlIGFjdHVhbFxuICAgICAgICAvLyBmYWlsb3Zlci5cbiAgICAgICAgc2V0VGltZW91dChsb29wLCAxMDApO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgc3RvcDogZnVuY3Rpb24gKCkge1xuICAgICAgc3RvcHBlZCA9IHRydWU7XG4gICAgICBjdXJzb3IuY2xvc2UoKTtcbiAgICB9XG4gIH07XG59O1xuXG5jb25zdCBvcGxvZ0NvbGxlY3Rpb25XYXJuaW5ncyA9IFtdO1xuXG5PYmplY3QuYXNzaWduKE1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUsIHtcbiAgX29ic2VydmVDaGFuZ2VzOiBhc3luYyBmdW5jdGlvbiAoXG4gICAgICBjdXJzb3JEZXNjcmlwdGlvbiwgb3JkZXJlZCwgY2FsbGJhY2tzLCBub25NdXRhdGluZ0NhbGxiYWNrcykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBjb25zdCBjb2xsZWN0aW9uTmFtZSA9IGN1cnNvckRlc2NyaXB0aW9uLmNvbGxlY3Rpb25OYW1lO1xuXG4gICAgaWYgKGN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMudGFpbGFibGUpIHtcbiAgICAgIHJldHVybiBzZWxmLl9vYnNlcnZlQ2hhbmdlc1RhaWxhYmxlKGN1cnNvckRlc2NyaXB0aW9uLCBvcmRlcmVkLCBjYWxsYmFja3MpO1xuICAgIH1cblxuICAgIC8vIFlvdSBtYXkgbm90IGZpbHRlciBvdXQgX2lkIHdoZW4gb2JzZXJ2aW5nIGNoYW5nZXMsIGJlY2F1c2UgdGhlIGlkIGlzIGEgY29yZVxuICAgIC8vIHBhcnQgb2YgdGhlIG9ic2VydmVDaGFuZ2VzIEFQSS5cbiAgICBjb25zdCBmaWVsZHNPcHRpb25zID0gY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucy5wcm9qZWN0aW9uIHx8IGN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMuZmllbGRzO1xuICAgIGlmIChmaWVsZHNPcHRpb25zICYmXG4gICAgICAgIChmaWVsZHNPcHRpb25zLl9pZCA9PT0gMCB8fFxuICAgICAgICAgICAgZmllbGRzT3B0aW9ucy5faWQgPT09IGZhbHNlKSkge1xuICAgICAgdGhyb3cgRXJyb3IoXCJZb3UgbWF5IG5vdCBvYnNlcnZlIGEgY3Vyc29yIHdpdGgge2ZpZWxkczoge19pZDogMH19XCIpO1xuICAgIH1cblxuICB2YXIgb2JzZXJ2ZUtleSA9IEVKU09OLnN0cmluZ2lmeShcbiAgICBPYmplY3QuYXNzaWduKHtvcmRlcmVkOiBvcmRlcmVkfSwgY3Vyc29yRGVzY3JpcHRpb24pKTtcblxuICAgIHZhciBtdWx0aXBsZXhlciwgb2JzZXJ2ZURyaXZlcjtcbiAgICB2YXIgZmlyc3RIYW5kbGUgPSBmYWxzZTtcblxuICAgIC8vIEZpbmQgYSBtYXRjaGluZyBPYnNlcnZlTXVsdGlwbGV4ZXIsIG9yIGNyZWF0ZSBhIG5ldyBvbmUuIFRoaXMgbmV4dCBibG9jayBpc1xuICAgIC8vIGd1YXJhbnRlZWQgdG8gbm90IHlpZWxkIChhbmQgaXQgZG9lc24ndCBjYWxsIGFueXRoaW5nIHRoYXQgY2FuIG9ic2VydmUgYVxuICAgIC8vIG5ldyBxdWVyeSksIHNvIG5vIG90aGVyIGNhbGxzIHRvIHRoaXMgZnVuY3Rpb24gY2FuIGludGVybGVhdmUgd2l0aCBpdC5cbiAgICBpZiAoaGFzKHNlbGYuX29ic2VydmVNdWx0aXBsZXhlcnMsIG9ic2VydmVLZXkpKSB7XG4gICAgICBtdWx0aXBsZXhlciA9IHNlbGYuX29ic2VydmVNdWx0aXBsZXhlcnNbb2JzZXJ2ZUtleV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGZpcnN0SGFuZGxlID0gdHJ1ZTtcbiAgICAgIC8vIENyZWF0ZSBhIG5ldyBPYnNlcnZlTXVsdGlwbGV4ZXIuXG4gICAgICBtdWx0aXBsZXhlciA9IG5ldyBPYnNlcnZlTXVsdGlwbGV4ZXIoe1xuICAgICAgICBvcmRlcmVkOiBvcmRlcmVkLFxuICAgICAgICBvblN0b3A6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBkZWxldGUgc2VsZi5fb2JzZXJ2ZU11bHRpcGxleGVyc1tvYnNlcnZlS2V5XTtcbiAgICAgICAgICByZXR1cm4gb2JzZXJ2ZURyaXZlci5zdG9wKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHZhciBvYnNlcnZlSGFuZGxlID0gbmV3IE9ic2VydmVIYW5kbGUobXVsdGlwbGV4ZXIsXG4gICAgICAgIGNhbGxiYWNrcyxcbiAgICAgICAgbm9uTXV0YXRpbmdDYWxsYmFja3MsXG4gICAgKTtcblxuICAgIGNvbnN0IG9wbG9nT3B0aW9ucyA9IHNlbGY/Ll9vcGxvZ0hhbmRsZT8uX29wbG9nT3B0aW9ucyB8fCB7fTtcbiAgY29uc3QgeyBpbmNsdWRlQ29sbGVjdGlvbnMsIGV4Y2x1ZGVDb2xsZWN0aW9ucyB9ID0gb3Bsb2dPcHRpb25zO1xuICBpZiAoZmlyc3RIYW5kbGUpIHtcbiAgICAgIHZhciBtYXRjaGVyLCBzb3J0ZXI7XG4gICAgdmFyIGNhblVzZU9wbG9nID0gW1xuICAgICAgICBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgLy8gQXQgYSBiYXJlIG1pbmltdW0sIHVzaW5nIHRoZSBvcGxvZyByZXF1aXJlcyB1cyB0byBoYXZlIGFuIG9wbG9nLCB0b1xuICAgICAgICAgIC8vIHdhbnQgdW5vcmRlcmVkIGNhbGxiYWNrcywgYW5kIHRvIG5vdCB3YW50IGEgY2FsbGJhY2sgb24gdGhlIHBvbGxzXG4gICAgICAgICAgLy8gdGhhdCB3b24ndCBoYXBwZW4uXG4gICAgICAgICAgcmV0dXJuIHNlbGYuX29wbG9nSGFuZGxlICYmICFvcmRlcmVkICYmXG4gICAgICAgICAgICAhY2FsbGJhY2tzLl90ZXN0T25seVBvbGxDYWxsYmFjaztcbiAgfSxcbiAgICAgIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gV2UgYWxzbyBuZWVkIHRvIGNoZWNrLCBpZiB0aGUgY29sbGVjdGlvbiBvZiB0aGlzIEN1cnNvciBpcyBhY3R1YWxseSBiZWluZyBcIndhdGNoZWRcIiBieSB0aGUgT3Bsb2cgaGFuZGxlXG4gICAgICAgIC8vIGlmIG5vdCwgd2UgaGF2ZSB0byBmYWxsYmFjayB0byBsb25nIHBvbGxpbmdcbiAgICAgICAgaWYgKGV4Y2x1ZGVDb2xsZWN0aW9ucz8ubGVuZ3RoICYmIGV4Y2x1ZGVDb2xsZWN0aW9ucy5pbmNsdWRlcyhjb2xsZWN0aW9uTmFtZSkpIHtcbiAgICAgICAgICBpZiAoIW9wbG9nQ29sbGVjdGlvbldhcm5pbmdzLmluY2x1ZGVzKGNvbGxlY3Rpb25OYW1lKSkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBNZXRlb3Iuc2V0dGluZ3MucGFja2FnZXMubW9uZ28ub3Bsb2dFeGNsdWRlQ29sbGVjdGlvbnMgaW5jbHVkZXMgdGhlIGNvbGxlY3Rpb24gJHtjb2xsZWN0aW9uTmFtZX0gLSB5b3VyIHN1YnNjcmlwdGlvbnMgd2lsbCBvbmx5IHVzZSBsb25nIHBvbGxpbmchYCk7XG4gICAgICAgICAgICBvcGxvZ0NvbGxlY3Rpb25XYXJuaW5ncy5wdXNoKGNvbGxlY3Rpb25OYW1lKTsgLy8gd2Ugb25seSB3YW50IHRvIHNob3cgdGhlIHdhcm5pbmdzIG9uY2UgcGVyIGNvbGxlY3Rpb24hXG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaW5jbHVkZUNvbGxlY3Rpb25zPy5sZW5ndGggJiYgIWluY2x1ZGVDb2xsZWN0aW9ucy5pbmNsdWRlcyhjb2xsZWN0aW9uTmFtZSkpIHtcbiAgICAgICAgICBpZiAoIW9wbG9nQ29sbGVjdGlvbldhcm5pbmdzLmluY2x1ZGVzKGNvbGxlY3Rpb25OYW1lKSkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBNZXRlb3Iuc2V0dGluZ3MucGFja2FnZXMubW9uZ28ub3Bsb2dJbmNsdWRlQ29sbGVjdGlvbnMgZG9lcyBub3QgaW5jbHVkZSB0aGUgY29sbGVjdGlvbiAke2NvbGxlY3Rpb25OYW1lfSAtIHlvdXIgc3Vic2NyaXB0aW9ucyB3aWxsIG9ubHkgdXNlIGxvbmcgcG9sbGluZyFgKTtcbiAgICAgICAgICAgIG9wbG9nQ29sbGVjdGlvbldhcm5pbmdzLnB1c2goY29sbGVjdGlvbk5hbWUpOyAvLyB3ZSBvbmx5IHdhbnQgdG8gc2hvdyB0aGUgd2FybmluZ3Mgb25jZSBwZXIgY29sbGVjdGlvbiFcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSxcbiAgICAgIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gV2UgbmVlZCB0byBiZSBhYmxlIHRvIGNvbXBpbGUgdGhlIHNlbGVjdG9yLiBGYWxsIGJhY2sgdG8gcG9sbGluZyBmb3JcbiAgICAgICAgLy8gc29tZSBuZXdmYW5nbGVkICRzZWxlY3RvciB0aGF0IG1pbmltb25nbyBkb2Vzbid0IHN1cHBvcnQgeWV0LlxuICAgICAgICB0cnkge1xuICAgICAgICAgIG1hdGNoZXIgPSBuZXcgTWluaW1vbmdvLk1hdGNoZXIoY3Vyc29yRGVzY3JpcHRpb24uc2VsZWN0b3IpO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgLy8gWFhYIG1ha2UgYWxsIGNvbXBpbGF0aW9uIGVycm9ycyBNaW5pbW9uZ29FcnJvciBvciBzb21ldGhpbmdcbiAgICAgICAgICAvLyAgICAgc28gdGhhdCB0aGlzIGRvZXNuJ3QgaWdub3JlIHVucmVsYXRlZCBleGNlcHRpb25zXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyAuLi4gYW5kIHRoZSBzZWxlY3RvciBpdHNlbGYgbmVlZHMgdG8gc3VwcG9ydCBvcGxvZy5cbiAgICAgICAgcmV0dXJuIE9wbG9nT2JzZXJ2ZURyaXZlci5jdXJzb3JTdXBwb3J0ZWQoY3Vyc29yRGVzY3JpcHRpb24sIG1hdGNoZXIpO1xuICAgICAgfSxcbiAgICAgIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gQW5kIHdlIG5lZWQgdG8gYmUgYWJsZSB0byBjb21waWxlIHRoZSBzb3J0LCBpZiBhbnkuICBlZywgY2FuJ3QgYmVcbiAgICAgICAgLy8geyRuYXR1cmFsOiAxfS5cbiAgICAgICAgaWYgKCFjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnNvcnQpXG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgc29ydGVyID0gbmV3IE1pbmltb25nby5Tb3J0ZXIoY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucy5zb3J0KTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIC8vIFhYWCBtYWtlIGFsbCBjb21waWxhdGlvbiBlcnJvcnMgTWluaW1vbmdvRXJyb3Igb3Igc29tZXRoaW5nXG4gICAgICAgICAgLy8gICAgIHNvIHRoYXQgdGhpcyBkb2Vzbid0IGlnbm9yZSB1bnJlbGF0ZWQgZXhjZXB0aW9uc1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIF0uZXZlcnkoZiA9PiBmKCkpOyAgLy8gaW52b2tlIGVhY2ggZnVuY3Rpb24gYW5kIGNoZWNrIGlmIGFsbCByZXR1cm4gdHJ1ZVxuXG4gICAgdmFyIGRyaXZlckNsYXNzID0gY2FuVXNlT3Bsb2cgPyBPcGxvZ09ic2VydmVEcml2ZXIgOiBQb2xsaW5nT2JzZXJ2ZURyaXZlcjtcbiAgICBvYnNlcnZlRHJpdmVyID0gbmV3IGRyaXZlckNsYXNzKHtcbiAgICAgIGN1cnNvckRlc2NyaXB0aW9uOiBjdXJzb3JEZXNjcmlwdGlvbixcbiAgICAgIG1vbmdvSGFuZGxlOiBzZWxmLFxuICAgICAgbXVsdGlwbGV4ZXI6IG11bHRpcGxleGVyLFxuICAgICAgb3JkZXJlZDogb3JkZXJlZCxcbiAgICAgIG1hdGNoZXI6IG1hdGNoZXIsICAvLyBpZ25vcmVkIGJ5IHBvbGxpbmdcbiAgICAgIHNvcnRlcjogc29ydGVyLCAgLy8gaWdub3JlZCBieSBwb2xsaW5nXG4gICAgICBfdGVzdE9ubHlQb2xsQ2FsbGJhY2s6IGNhbGxiYWNrcy5fdGVzdE9ubHlQb2xsQ2FsbGJhY2tcbn0pO1xuXG4gICAgaWYgKG9ic2VydmVEcml2ZXIuX2luaXQpIHtcbiAgICAgIGF3YWl0IG9ic2VydmVEcml2ZXIuX2luaXQoKTtcbiAgICB9XG5cbiAgICAvLyBUaGlzIGZpZWxkIGlzIG9ubHkgc2V0IGZvciB1c2UgaW4gdGVzdHMuXG4gICAgbXVsdGlwbGV4ZXIuX29ic2VydmVEcml2ZXIgPSBvYnNlcnZlRHJpdmVyO1xuICB9XG4gIHNlbGYuX29ic2VydmVNdWx0aXBsZXhlcnNbb2JzZXJ2ZUtleV0gPSBtdWx0aXBsZXhlcjtcbiAgLy8gQmxvY2tzIHVudGlsIHRoZSBpbml0aWFsIGFkZHMgaGF2ZSBiZWVuIHNlbnQuXG4gIGF3YWl0IG11bHRpcGxleGVyLmFkZEhhbmRsZUFuZFNlbmRJbml0aWFsQWRkcyhvYnNlcnZlSGFuZGxlKTtcblxuICByZXR1cm4gb2JzZXJ2ZUhhbmRsZTtcbn0sXG5cbn0pO1xuXG5cbi8vIExpc3RlbiBmb3IgdGhlIGludmFsaWRhdGlvbiBtZXNzYWdlcyB0aGF0IHdpbGwgdHJpZ2dlciB1cyB0byBwb2xsIHRoZVxuLy8gZGF0YWJhc2UgZm9yIGNoYW5nZXMuIElmIHRoaXMgc2VsZWN0b3Igc3BlY2lmaWVzIHNwZWNpZmljIElEcywgc3BlY2lmeSB0aGVtXG4vLyBoZXJlLCBzbyB0aGF0IHVwZGF0ZXMgdG8gZGlmZmVyZW50IHNwZWNpZmljIElEcyBkb24ndCBjYXVzZSB1cyB0byBwb2xsLlxuLy8gbGlzdGVuQ2FsbGJhY2sgaXMgdGhlIHNhbWUga2luZCBvZiAobm90aWZpY2F0aW9uLCBjb21wbGV0ZSkgY2FsbGJhY2sgcGFzc2VkXG4vLyB0byBJbnZhbGlkYXRpb25Dcm9zc2Jhci5saXN0ZW4uXG5cbmxpc3RlbkFsbCA9IGFzeW5jIGZ1bmN0aW9uIChjdXJzb3JEZXNjcmlwdGlvbiwgbGlzdGVuQ2FsbGJhY2spIHtcbiAgY29uc3QgbGlzdGVuZXJzID0gW107XG4gIGF3YWl0IGZvckVhY2hUcmlnZ2VyKGN1cnNvckRlc2NyaXB0aW9uLCBmdW5jdGlvbiAodHJpZ2dlcikge1xuICAgIGxpc3RlbmVycy5wdXNoKEREUFNlcnZlci5fSW52YWxpZGF0aW9uQ3Jvc3NiYXIubGlzdGVuKFxuICAgICAgdHJpZ2dlciwgbGlzdGVuQ2FsbGJhY2spKTtcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBzdG9wOiBmdW5jdGlvbiAoKSB7XG4gICAgICBsaXN0ZW5lcnMuZm9yRWFjaChmdW5jdGlvbiAobGlzdGVuZXIpIHtcbiAgICAgICAgbGlzdGVuZXIuc3RvcCgpO1xuICAgICAgfSk7XG4gICAgfVxuICB9O1xufTtcblxuZm9yRWFjaFRyaWdnZXIgPSBhc3luYyBmdW5jdGlvbiAoY3Vyc29yRGVzY3JpcHRpb24sIHRyaWdnZXJDYWxsYmFjaykge1xuICBjb25zdCBrZXkgPSB7Y29sbGVjdGlvbjogY3Vyc29yRGVzY3JpcHRpb24uY29sbGVjdGlvbk5hbWV9O1xuICBjb25zdCBzcGVjaWZpY0lkcyA9IExvY2FsQ29sbGVjdGlvbi5faWRzTWF0Y2hlZEJ5U2VsZWN0b3IoXG4gICAgY3Vyc29yRGVzY3JpcHRpb24uc2VsZWN0b3IpO1xuICBpZiAoc3BlY2lmaWNJZHMpIHtcbiAgICBmb3IgKGNvbnN0IGlkIG9mIHNwZWNpZmljSWRzKSB7XG4gICAgICBhd2FpdCB0cmlnZ2VyQ2FsbGJhY2soXy5leHRlbmQoe2lkOiBpZH0sIGtleSkpO1xuICAgIH1cbiAgICBhd2FpdCB0cmlnZ2VyQ2FsbGJhY2soXy5leHRlbmQoe2Ryb3BDb2xsZWN0aW9uOiB0cnVlLCBpZDogbnVsbH0sIGtleSkpO1xuICB9IGVsc2Uge1xuICAgIGF3YWl0IHRyaWdnZXJDYWxsYmFjayhrZXkpO1xuICB9XG4gIC8vIEV2ZXJ5b25lIGNhcmVzIGFib3V0IHRoZSBkYXRhYmFzZSBiZWluZyBkcm9wcGVkLlxuICBhd2FpdCB0cmlnZ2VyQ2FsbGJhY2soeyBkcm9wRGF0YWJhc2U6IHRydWUgfSk7XG59O1xuXG4vLyBvYnNlcnZlQ2hhbmdlcyBmb3IgdGFpbGFibGUgY3Vyc29ycyBvbiBjYXBwZWQgY29sbGVjdGlvbnMuXG4vL1xuLy8gU29tZSBkaWZmZXJlbmNlcyBmcm9tIG5vcm1hbCBjdXJzb3JzOlxuLy8gICAtIFdpbGwgbmV2ZXIgcHJvZHVjZSBhbnl0aGluZyBvdGhlciB0aGFuICdhZGRlZCcgb3IgJ2FkZGVkQmVmb3JlJy4gSWYgeW91XG4vLyAgICAgZG8gdXBkYXRlIGEgZG9jdW1lbnQgdGhhdCBoYXMgYWxyZWFkeSBiZWVuIHByb2R1Y2VkLCB0aGlzIHdpbGwgbm90IG5vdGljZVxuLy8gICAgIGl0LlxuLy8gICAtIElmIHlvdSBkaXNjb25uZWN0IGFuZCByZWNvbm5lY3QgZnJvbSBNb25nbywgaXQgd2lsbCBlc3NlbnRpYWxseSByZXN0YXJ0XG4vLyAgICAgdGhlIHF1ZXJ5LCB3aGljaCB3aWxsIGxlYWQgdG8gZHVwbGljYXRlIHJlc3VsdHMuIFRoaXMgaXMgcHJldHR5IGJhZCxcbi8vICAgICBidXQgaWYgeW91IGluY2x1ZGUgYSBmaWVsZCBjYWxsZWQgJ3RzJyB3aGljaCBpcyBpbnNlcnRlZCBhc1xuLy8gICAgIG5ldyBNb25nb0ludGVybmFscy5Nb25nb1RpbWVzdGFtcCgwLCAwKSAod2hpY2ggaXMgaW5pdGlhbGl6ZWQgdG8gdGhlXG4vLyAgICAgY3VycmVudCBNb25nby1zdHlsZSB0aW1lc3RhbXApLCB3ZSdsbCBiZSBhYmxlIHRvIGZpbmQgdGhlIHBsYWNlIHRvXG4vLyAgICAgcmVzdGFydCBwcm9wZXJseS4gKFRoaXMgZmllbGQgaXMgc3BlY2lmaWNhbGx5IHVuZGVyc3Rvb2QgYnkgTW9uZ28gd2l0aCBhblxuLy8gICAgIG9wdGltaXphdGlvbiB3aGljaCBhbGxvd3MgaXQgdG8gZmluZCB0aGUgcmlnaHQgcGxhY2UgdG8gc3RhcnQgd2l0aG91dFxuLy8gICAgIGFuIGluZGV4IG9uIHRzLiBJdCdzIGhvdyB0aGUgb3Bsb2cgd29ya3MuKVxuLy8gICAtIE5vIGNhbGxiYWNrcyBhcmUgdHJpZ2dlcmVkIHN5bmNocm9ub3VzbHkgd2l0aCB0aGUgY2FsbCAodGhlcmUncyBub1xuLy8gICAgIGRpZmZlcmVudGlhdGlvbiBiZXR3ZWVuIFwiaW5pdGlhbCBkYXRhXCIgYW5kIFwibGF0ZXIgY2hhbmdlc1wiOyBldmVyeXRoaW5nXG4vLyAgICAgdGhhdCBtYXRjaGVzIHRoZSBxdWVyeSBnZXRzIHNlbnQgYXN5bmNocm9ub3VzbHkpLlxuLy8gICAtIERlLWR1cGxpY2F0aW9uIGlzIG5vdCBpbXBsZW1lbnRlZC5cbi8vICAgLSBEb2VzIG5vdCB5ZXQgaW50ZXJhY3Qgd2l0aCB0aGUgd3JpdGUgZmVuY2UuIFByb2JhYmx5LCB0aGlzIHNob3VsZCB3b3JrIGJ5XG4vLyAgICAgaWdub3JpbmcgcmVtb3ZlcyAod2hpY2ggZG9uJ3Qgd29yayBvbiBjYXBwZWQgY29sbGVjdGlvbnMpIGFuZCB1cGRhdGVzXG4vLyAgICAgKHdoaWNoIGRvbid0IGFmZmVjdCB0YWlsYWJsZSBjdXJzb3JzKSwgYW5kIGp1c3Qga2VlcGluZyB0cmFjayBvZiB0aGUgSURcbi8vICAgICBvZiB0aGUgaW5zZXJ0ZWQgb2JqZWN0LCBhbmQgY2xvc2luZyB0aGUgd3JpdGUgZmVuY2Ugb25jZSB5b3UgZ2V0IHRvIHRoYXRcbi8vICAgICBJRCAob3IgdGltZXN0YW1wPykuICBUaGlzIGRvZXNuJ3Qgd29yayB3ZWxsIGlmIHRoZSBkb2N1bWVudCBkb2Vzbid0IG1hdGNoXG4vLyAgICAgdGhlIHF1ZXJ5LCB0aG91Z2guICBPbiB0aGUgb3RoZXIgaGFuZCwgdGhlIHdyaXRlIGZlbmNlIGNhbiBjbG9zZVxuLy8gICAgIGltbWVkaWF0ZWx5IGlmIGl0IGRvZXMgbm90IG1hdGNoIHRoZSBxdWVyeS4gU28gaWYgd2UgdHJ1c3QgbWluaW1vbmdvXG4vLyAgICAgZW5vdWdoIHRvIGFjY3VyYXRlbHkgZXZhbHVhdGUgdGhlIHF1ZXJ5IGFnYWluc3QgdGhlIHdyaXRlIGZlbmNlLCB3ZVxuLy8gICAgIHNob3VsZCBiZSBhYmxlIHRvIGRvIHRoaXMuLi4gIE9mIGNvdXJzZSwgbWluaW1vbmdvIGRvZXNuJ3QgZXZlbiBzdXBwb3J0XG4vLyAgICAgTW9uZ28gVGltZXN0YW1wcyB5ZXQuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLl9vYnNlcnZlQ2hhbmdlc1RhaWxhYmxlID0gZnVuY3Rpb24gKFxuICAgIGN1cnNvckRlc2NyaXB0aW9uLCBvcmRlcmVkLCBjYWxsYmFja3MpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIC8vIFRhaWxhYmxlIGN1cnNvcnMgb25seSBldmVyIGNhbGwgYWRkZWQvYWRkZWRCZWZvcmUgY2FsbGJhY2tzLCBzbyBpdCdzIGFuXG4gIC8vIGVycm9yIGlmIHlvdSBkaWRuJ3QgcHJvdmlkZSB0aGVtLlxuICBpZiAoKG9yZGVyZWQgJiYgIWNhbGxiYWNrcy5hZGRlZEJlZm9yZSkgfHxcbiAgICAgICghb3JkZXJlZCAmJiAhY2FsbGJhY2tzLmFkZGVkKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IG9ic2VydmUgYW4gXCIgKyAob3JkZXJlZCA/IFwib3JkZXJlZFwiIDogXCJ1bm9yZGVyZWRcIilcbiAgICAgICAgICAgICAgICAgICAgKyBcIiB0YWlsYWJsZSBjdXJzb3Igd2l0aG91dCBhIFwiXG4gICAgICAgICAgICAgICAgICAgICsgKG9yZGVyZWQgPyBcImFkZGVkQmVmb3JlXCIgOiBcImFkZGVkXCIpICsgXCIgY2FsbGJhY2tcIik7XG4gIH1cblxuICByZXR1cm4gc2VsZi50YWlsKGN1cnNvckRlc2NyaXB0aW9uLCBmdW5jdGlvbiAoZG9jKSB7XG4gICAgdmFyIGlkID0gZG9jLl9pZDtcbiAgICBkZWxldGUgZG9jLl9pZDtcbiAgICAvLyBUaGUgdHMgaXMgYW4gaW1wbGVtZW50YXRpb24gZGV0YWlsLiBIaWRlIGl0LlxuICAgIGRlbGV0ZSBkb2MudHM7XG4gICAgaWYgKG9yZGVyZWQpIHtcbiAgICAgIGNhbGxiYWNrcy5hZGRlZEJlZm9yZShpZCwgZG9jLCBudWxsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2FsbGJhY2tzLmFkZGVkKGlkLCBkb2MpO1xuICAgIH1cbiAgfSk7XG59O1xuXG4vLyBYWFggV2UgcHJvYmFibHkgbmVlZCB0byBmaW5kIGEgYmV0dGVyIHdheSB0byBleHBvc2UgdGhpcy4gUmlnaHQgbm93XG4vLyBpdCdzIG9ubHkgdXNlZCBieSB0ZXN0cywgYnV0IGluIGZhY3QgeW91IG5lZWQgaXQgaW4gbm9ybWFsXG4vLyBvcGVyYXRpb24gdG8gaW50ZXJhY3Qgd2l0aCBjYXBwZWQgY29sbGVjdGlvbnMuXG5Nb25nb0ludGVybmFscy5Nb25nb1RpbWVzdGFtcCA9IE1vbmdvREIuVGltZXN0YW1wO1xuXG5Nb25nb0ludGVybmFscy5Db25uZWN0aW9uID0gTW9uZ29Db25uZWN0aW9uOyIsImltcG9ydCBpc0VtcHR5IGZyb20gJ2xvZGFzaC5pc2VtcHR5JztcbmltcG9ydCBoYXMgZnJvbSAnbG9kYXNoLmhhcyc7XG5cbmltcG9ydCB7IE5wbU1vZHVsZU1vbmdvZGIgfSBmcm9tIFwibWV0ZW9yL25wbS1tb25nb1wiO1xuY29uc3QgeyBMb25nIH0gPSBOcG1Nb2R1bGVNb25nb2RiO1xuXG5PUExPR19DT0xMRUNUSU9OID0gJ29wbG9nLnJzJztcblxudmFyIFRPT19GQVJfQkVISU5EID0gcHJvY2Vzcy5lbnYuTUVURU9SX09QTE9HX1RPT19GQVJfQkVISU5EIHx8IDIwMDA7XG52YXIgVEFJTF9USU1FT1VUID0gK3Byb2Nlc3MuZW52Lk1FVEVPUl9PUExPR19UQUlMX1RJTUVPVVQgfHwgMzAwMDA7XG5cbmlkRm9yT3AgPSBmdW5jdGlvbiAob3ApIHtcbiAgaWYgKG9wLm9wID09PSAnZCcpXG4gICAgcmV0dXJuIG9wLm8uX2lkO1xuICBlbHNlIGlmIChvcC5vcCA9PT0gJ2knKVxuICAgIHJldHVybiBvcC5vLl9pZDtcbiAgZWxzZSBpZiAob3Aub3AgPT09ICd1JylcbiAgICByZXR1cm4gb3AubzIuX2lkO1xuICBlbHNlIGlmIChvcC5vcCA9PT0gJ2MnKVxuICAgIHRocm93IEVycm9yKFwiT3BlcmF0b3IgJ2MnIGRvZXNuJ3Qgc3VwcGx5IGFuIG9iamVjdCB3aXRoIGlkOiBcIiArXG4gICAgICAgICAgICAgICAgRUpTT04uc3RyaW5naWZ5KG9wKSk7XG4gIGVsc2VcbiAgICB0aHJvdyBFcnJvcihcIlVua25vd24gb3A6IFwiICsgRUpTT04uc3RyaW5naWZ5KG9wKSk7XG59O1xuXG5PcGxvZ0hhbmRsZSA9IGZ1bmN0aW9uIChvcGxvZ1VybCwgZGJOYW1lKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2VsZi5fb3Bsb2dVcmwgPSBvcGxvZ1VybDtcbiAgc2VsZi5fZGJOYW1lID0gZGJOYW1lO1xuXG4gIHNlbGYuX29wbG9nTGFzdEVudHJ5Q29ubmVjdGlvbiA9IG51bGw7XG4gIHNlbGYuX29wbG9nVGFpbENvbm5lY3Rpb24gPSBudWxsO1xuICBzZWxmLl9vcGxvZ09wdGlvbnMgPSBudWxsO1xuICBzZWxmLl9zdG9wcGVkID0gZmFsc2U7XG4gIHNlbGYuX3RhaWxIYW5kbGUgPSBudWxsO1xuICBzZWxmLl9yZWFkeVByb21pc2VSZXNvbHZlciA9IG51bGw7XG4gIHNlbGYuX3JlYWR5UHJvbWlzZSA9IG5ldyBQcm9taXNlKHIgPT4gc2VsZi5fcmVhZHlQcm9taXNlUmVzb2x2ZXIgPSByKTtcbiAgc2VsZi5fY3Jvc3NiYXIgPSBuZXcgRERQU2VydmVyLl9Dcm9zc2Jhcih7XG4gICAgZmFjdFBhY2thZ2U6IFwibW9uZ28tbGl2ZWRhdGFcIiwgZmFjdE5hbWU6IFwib3Bsb2ctd2F0Y2hlcnNcIlxuICB9KTtcbiAgc2VsZi5fYmFzZU9wbG9nU2VsZWN0b3IgPSB7XG4gICAgbnM6IG5ldyBSZWdFeHAoXCJeKD86XCIgKyBbXG4gICAgICBNZXRlb3IuX2VzY2FwZVJlZ0V4cChzZWxmLl9kYk5hbWUgKyBcIi5cIiksXG4gICAgICBNZXRlb3IuX2VzY2FwZVJlZ0V4cChcImFkbWluLiRjbWRcIiksXG4gICAgXS5qb2luKFwifFwiKSArIFwiKVwiKSxcblxuICAgICRvcjogW1xuICAgICAgeyBvcDogeyAkaW46IFsnaScsICd1JywgJ2QnXSB9IH0sXG4gICAgICAvLyBkcm9wIGNvbGxlY3Rpb25cbiAgICAgIHsgb3A6ICdjJywgJ28uZHJvcCc6IHsgJGV4aXN0czogdHJ1ZSB9IH0sXG4gICAgICB7IG9wOiAnYycsICdvLmRyb3BEYXRhYmFzZSc6IDEgfSxcbiAgICAgIHsgb3A6ICdjJywgJ28uYXBwbHlPcHMnOiB7ICRleGlzdHM6IHRydWUgfSB9LFxuICAgIF1cbiAgfTtcblxuICAvLyBEYXRhIHN0cnVjdHVyZXMgdG8gc3VwcG9ydCB3YWl0VW50aWxDYXVnaHRVcCgpLiBFYWNoIG9wbG9nIGVudHJ5IGhhcyBhXG4gIC8vIE1vbmdvVGltZXN0YW1wIG9iamVjdCBvbiBpdCAod2hpY2ggaXMgbm90IHRoZSBzYW1lIGFzIGEgRGF0ZSAtLS0gaXQncyBhXG4gIC8vIGNvbWJpbmF0aW9uIG9mIHRpbWUgYW5kIGFuIGluY3JlbWVudGluZyBjb3VudGVyOyBzZWVcbiAgLy8gaHR0cDovL2RvY3MubW9uZ29kYi5vcmcvbWFudWFsL3JlZmVyZW5jZS9ic29uLXR5cGVzLyN0aW1lc3RhbXBzKS5cbiAgLy9cbiAgLy8gX2NhdGNoaW5nVXBGdXR1cmVzIGlzIGFuIGFycmF5IG9mIHt0czogTW9uZ29UaW1lc3RhbXAsIGZ1dHVyZTogRnV0dXJlfVxuICAvLyBvYmplY3RzLCBzb3J0ZWQgYnkgYXNjZW5kaW5nIHRpbWVzdGFtcC4gX2xhc3RQcm9jZXNzZWRUUyBpcyB0aGVcbiAgLy8gTW9uZ29UaW1lc3RhbXAgb2YgdGhlIGxhc3Qgb3Bsb2cgZW50cnkgd2UndmUgcHJvY2Vzc2VkLlxuICAvL1xuICAvLyBFYWNoIHRpbWUgd2UgY2FsbCB3YWl0VW50aWxDYXVnaHRVcCwgd2UgdGFrZSBhIHBlZWsgYXQgdGhlIGZpbmFsIG9wbG9nXG4gIC8vIGVudHJ5IGluIHRoZSBkYi4gIElmIHdlJ3ZlIGFscmVhZHkgcHJvY2Vzc2VkIGl0IChpZSwgaXQgaXMgbm90IGdyZWF0ZXIgdGhhblxuICAvLyBfbGFzdFByb2Nlc3NlZFRTKSwgd2FpdFVudGlsQ2F1Z2h0VXAgaW1tZWRpYXRlbHkgcmV0dXJucy4gT3RoZXJ3aXNlLFxuICAvLyB3YWl0VW50aWxDYXVnaHRVcCBtYWtlcyBhIG5ldyBGdXR1cmUgYW5kIGluc2VydHMgaXQgYWxvbmcgd2l0aCB0aGUgZmluYWxcbiAgLy8gdGltZXN0YW1wIGVudHJ5IHRoYXQgaXQgcmVhZCwgaW50byBfY2F0Y2hpbmdVcEZ1dHVyZXMuIHdhaXRVbnRpbENhdWdodFVwXG4gIC8vIHRoZW4gd2FpdHMgb24gdGhhdCBmdXR1cmUsIHdoaWNoIGlzIHJlc29sdmVkIG9uY2UgX2xhc3RQcm9jZXNzZWRUUyBpc1xuICAvLyBpbmNyZW1lbnRlZCB0byBiZSBwYXN0IGl0cyB0aW1lc3RhbXAgYnkgdGhlIHdvcmtlciBmaWJlci5cbiAgLy9cbiAgLy8gWFhYIHVzZSBhIHByaW9yaXR5IHF1ZXVlIG9yIHNvbWV0aGluZyBlbHNlIHRoYXQncyBmYXN0ZXIgdGhhbiBhbiBhcnJheVxuICBzZWxmLl9jYXRjaGluZ1VwUmVzb2x2ZXJzID0gW107XG4gIHNlbGYuX2xhc3RQcm9jZXNzZWRUUyA9IG51bGw7XG5cbiAgc2VsZi5fb25Ta2lwcGVkRW50cmllc0hvb2sgPSBuZXcgSG9vayh7XG4gICAgZGVidWdQcmludEV4Y2VwdGlvbnM6IFwib25Ta2lwcGVkRW50cmllcyBjYWxsYmFja1wiXG4gIH0pO1xuXG4gIHNlbGYuX2VudHJ5UXVldWUgPSBuZXcgTWV0ZW9yLl9Eb3VibGVFbmRlZFF1ZXVlKCk7XG4gIHNlbGYuX3dvcmtlckFjdGl2ZSA9IGZhbHNlO1xuXG4gIHNlbGYuX3N0YXJ0VHJhaWxpbmdQcm9taXNlID0gc2VsZi5fc3RhcnRUYWlsaW5nKCk7XG4gIC8vVE9ET1tmaWJlcnNdIFdoeSB3YWl0P1xufTtcblxuTW9uZ29JbnRlcm5hbHMuT3Bsb2dIYW5kbGUgPSBPcGxvZ0hhbmRsZTtcblxuT2JqZWN0LmFzc2lnbihPcGxvZ0hhbmRsZS5wcm90b3R5cGUsIHtcbiAgc3RvcDogYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5fc3RvcHBlZClcbiAgICAgIHJldHVybjtcbiAgICBzZWxmLl9zdG9wcGVkID0gdHJ1ZTtcbiAgICBpZiAoc2VsZi5fdGFpbEhhbmRsZSlcbiAgICAgIGF3YWl0IHNlbGYuX3RhaWxIYW5kbGUuc3RvcCgpO1xuICAgIC8vIFhYWCBzaG91bGQgY2xvc2UgY29ubmVjdGlvbnMgdG9vXG4gIH0sXG4gIF9vbk9wbG9nRW50cnk6IGFzeW5jIGZ1bmN0aW9uKHRyaWdnZXIsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FsbGVkIG9uT3Bsb2dFbnRyeSBvbiBzdG9wcGVkIGhhbmRsZSFcIik7XG5cbiAgICAvLyBDYWxsaW5nIG9uT3Bsb2dFbnRyeSByZXF1aXJlcyB1cyB0byB3YWl0IGZvciB0aGUgdGFpbGluZyB0byBiZSByZWFkeS5cbiAgICBhd2FpdCBzZWxmLl9yZWFkeVByb21pc2U7XG5cbiAgICB2YXIgb3JpZ2luYWxDYWxsYmFjayA9IGNhbGxiYWNrO1xuICAgIGNhbGxiYWNrID0gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChmdW5jdGlvbiAobm90aWZpY2F0aW9uKSB7XG4gICAgICBvcmlnaW5hbENhbGxiYWNrKG5vdGlmaWNhdGlvbik7XG4gICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgTWV0ZW9yLl9kZWJ1ZyhcIkVycm9yIGluIG9wbG9nIGNhbGxiYWNrXCIsIGVycik7XG4gICAgfSk7XG4gICAgdmFyIGxpc3RlbkhhbmRsZSA9IHNlbGYuX2Nyb3NzYmFyLmxpc3Rlbih0cmlnZ2VyLCBjYWxsYmFjayk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN0b3A6IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgYXdhaXQgbGlzdGVuSGFuZGxlLnN0b3AoKTtcbiAgICAgIH1cbiAgICB9O1xuICB9LFxuICBvbk9wbG9nRW50cnk6IGZ1bmN0aW9uICh0cmlnZ2VyLCBjYWxsYmFjaykge1xuICAgIHJldHVybiB0aGlzLl9vbk9wbG9nRW50cnkodHJpZ2dlciwgY2FsbGJhY2spO1xuICB9LFxuICAvLyBSZWdpc3RlciBhIGNhbGxiYWNrIHRvIGJlIGludm9rZWQgYW55IHRpbWUgd2Ugc2tpcCBvcGxvZyBlbnRyaWVzIChlZyxcbiAgLy8gYmVjYXVzZSB3ZSBhcmUgdG9vIGZhciBiZWhpbmQpLlxuICBvblNraXBwZWRFbnRyaWVzOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYWxsZWQgb25Ta2lwcGVkRW50cmllcyBvbiBzdG9wcGVkIGhhbmRsZSFcIik7XG4gICAgcmV0dXJuIHNlbGYuX29uU2tpcHBlZEVudHJpZXNIb29rLnJlZ2lzdGVyKGNhbGxiYWNrKTtcbiAgfSxcblxuICBhc3luYyBfd2FpdFVudGlsQ2F1Z2h0VXAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FsbGVkIHdhaXRVbnRpbENhdWdodFVwIG9uIHN0b3BwZWQgaGFuZGxlIVwiKTtcblxuICAgIC8vIENhbGxpbmcgd2FpdFVudGlsQ2F1Z2h0VXAgcmVxdXJpZXMgdXMgdG8gd2FpdCBmb3IgdGhlIG9wbG9nIGNvbm5lY3Rpb24gdG9cbiAgICAvLyBiZSByZWFkeS5cbiAgICBhd2FpdCBzZWxmLl9yZWFkeVByb21pc2U7XG4gICAgdmFyIGxhc3RFbnRyeTtcblxuICAgIHdoaWxlICghc2VsZi5fc3RvcHBlZCkge1xuICAgICAgLy8gV2UgbmVlZCB0byBtYWtlIHRoZSBzZWxlY3RvciBhdCBsZWFzdCBhcyByZXN0cmljdGl2ZSBhcyB0aGUgYWN0dWFsXG4gICAgICAvLyB0YWlsaW5nIHNlbGVjdG9yIChpZSwgd2UgbmVlZCB0byBzcGVjaWZ5IHRoZSBEQiBuYW1lKSBvciBlbHNlIHdlIG1pZ2h0XG4gICAgICAvLyBmaW5kIGEgVFMgdGhhdCB3b24ndCBzaG93IHVwIGluIHRoZSBhY3R1YWwgdGFpbCBzdHJlYW0uXG4gICAgICB0cnkge1xuICAgICAgICBsYXN0RW50cnkgPSBhd2FpdCBzZWxmLl9vcGxvZ0xhc3RFbnRyeUNvbm5lY3Rpb24uZmluZE9uZUFzeW5jKFxuICAgICAgICAgIE9QTE9HX0NPTExFQ1RJT04sXG4gICAgICAgICAgc2VsZi5fYmFzZU9wbG9nU2VsZWN0b3IsXG4gICAgICAgICAgeyBwcm9qZWN0aW9uOiB7IHRzOiAxIH0sIHNvcnQ6IHsgJG5hdHVyYWw6IC0xIH0gfVxuICAgICAgICApO1xuICAgICAgICBicmVhaztcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gRHVyaW5nIGZhaWxvdmVyIChlZykgaWYgd2UgZ2V0IGFuIGV4Y2VwdGlvbiB3ZSBzaG91bGQgbG9nIGFuZCByZXRyeVxuICAgICAgICAvLyBpbnN0ZWFkIG9mIGNyYXNoaW5nLlxuICAgICAgICBNZXRlb3IuX2RlYnVnKFwiR290IGV4Y2VwdGlvbiB3aGlsZSByZWFkaW5nIGxhc3QgZW50cnlcIiwgZSk7XG4gICAgICAgIGF3YWl0IE1ldGVvci5fc2xlZXBGb3JNcygxMDApO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgcmV0dXJuO1xuXG4gICAgaWYgKCFsYXN0RW50cnkpIHtcbiAgICAgIC8vIFJlYWxseSwgbm90aGluZyBpbiB0aGUgb3Bsb2c/IFdlbGwsIHdlJ3ZlIHByb2Nlc3NlZCBldmVyeXRoaW5nLlxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciB0cyA9IGxhc3RFbnRyeS50cztcbiAgICBpZiAoIXRzKVxuICAgICAgdGhyb3cgRXJyb3IoXCJvcGxvZyBlbnRyeSB3aXRob3V0IHRzOiBcIiArIEVKU09OLnN0cmluZ2lmeShsYXN0RW50cnkpKTtcblxuICAgIGlmIChzZWxmLl9sYXN0UHJvY2Vzc2VkVFMgJiYgdHMubGVzc1RoYW5PckVxdWFsKHNlbGYuX2xhc3RQcm9jZXNzZWRUUykpIHtcbiAgICAgIC8vIFdlJ3ZlIGFscmVhZHkgY2F1Z2h0IHVwIHRvIGhlcmUuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG5cbiAgICAvLyBJbnNlcnQgdGhlIGZ1dHVyZSBpbnRvIG91ciBsaXN0LiBBbG1vc3QgYWx3YXlzLCB0aGlzIHdpbGwgYmUgYXQgdGhlIGVuZCxcbiAgICAvLyBidXQgaXQncyBjb25jZWl2YWJsZSB0aGF0IGlmIHdlIGZhaWwgb3ZlciBmcm9tIG9uZSBwcmltYXJ5IHRvIGFub3RoZXIsXG4gICAgLy8gdGhlIG9wbG9nIGVudHJpZXMgd2Ugc2VlIHdpbGwgZ28gYmFja3dhcmRzLlxuICAgIHZhciBpbnNlcnRBZnRlciA9IHNlbGYuX2NhdGNoaW5nVXBSZXNvbHZlcnMubGVuZ3RoO1xuICAgIHdoaWxlIChpbnNlcnRBZnRlciAtIDEgPiAwICYmIHNlbGYuX2NhdGNoaW5nVXBSZXNvbHZlcnNbaW5zZXJ0QWZ0ZXIgLSAxXS50cy5ncmVhdGVyVGhhbih0cykpIHtcbiAgICAgIGluc2VydEFmdGVyLS07XG4gICAgfVxuICAgIGxldCBwcm9taXNlUmVzb2x2ZXIgPSBudWxsO1xuICAgIGNvbnN0IHByb21pc2VUb0F3YWl0ID0gbmV3IFByb21pc2UociA9PiBwcm9taXNlUmVzb2x2ZXIgPSByKTtcbiAgICBzZWxmLl9jYXRjaGluZ1VwUmVzb2x2ZXJzLnNwbGljZShpbnNlcnRBZnRlciwgMCwge3RzOiB0cywgcmVzb2x2ZXI6IHByb21pc2VSZXNvbHZlcn0pO1xuICAgIGF3YWl0IHByb21pc2VUb0F3YWl0O1xuICB9LFxuXG4gIC8vIENhbGxzIGBjYWxsYmFja2Agb25jZSB0aGUgb3Bsb2cgaGFzIGJlZW4gcHJvY2Vzc2VkIHVwIHRvIGEgcG9pbnQgdGhhdCBpc1xuICAvLyByb3VnaGx5IFwibm93XCI6IHNwZWNpZmljYWxseSwgb25jZSB3ZSd2ZSBwcm9jZXNzZWQgYWxsIG9wcyB0aGF0IGFyZVxuICAvLyBjdXJyZW50bHkgdmlzaWJsZS5cbiAgLy8gWFhYIGJlY29tZSBjb252aW5jZWQgdGhhdCB0aGlzIGlzIGFjdHVhbGx5IHNhZmUgZXZlbiBpZiBvcGxvZ0Nvbm5lY3Rpb25cbiAgLy8gaXMgc29tZSBraW5kIG9mIHBvb2xcbiAgd2FpdFVudGlsQ2F1Z2h0VXA6IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5fd2FpdFVudGlsQ2F1Z2h0VXAoKTtcbiAgfSxcblxuICBfc3RhcnRUYWlsaW5nOiBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIC8vIEZpcnN0LCBtYWtlIHN1cmUgdGhhdCB3ZSdyZSB0YWxraW5nIHRvIHRoZSBsb2NhbCBkYXRhYmFzZS5cbiAgICB2YXIgbW9uZ29kYlVyaSA9IE5wbS5yZXF1aXJlKCdtb25nb2RiLXVyaScpO1xuICAgIGlmIChtb25nb2RiVXJpLnBhcnNlKHNlbGYuX29wbG9nVXJsKS5kYXRhYmFzZSAhPT0gJ2xvY2FsJykge1xuICAgICAgdGhyb3cgRXJyb3IoXCIkTU9OR09fT1BMT0dfVVJMIG11c3QgYmUgc2V0IHRvIHRoZSAnbG9jYWwnIGRhdGFiYXNlIG9mIFwiICtcbiAgICAgICAgICBcImEgTW9uZ28gcmVwbGljYSBzZXRcIik7XG4gICAgfVxuXG4gICAgLy8gV2UgbWFrZSB0d28gc2VwYXJhdGUgY29ubmVjdGlvbnMgdG8gTW9uZ28uIFRoZSBOb2RlIE1vbmdvIGRyaXZlclxuICAgIC8vIGltcGxlbWVudHMgYSBuYWl2ZSByb3VuZC1yb2JpbiBjb25uZWN0aW9uIHBvb2w6IGVhY2ggXCJjb25uZWN0aW9uXCIgaXMgYVxuICAgIC8vIHBvb2wgb2Ygc2V2ZXJhbCAoNSBieSBkZWZhdWx0KSBUQ1AgY29ubmVjdGlvbnMsIGFuZCBlYWNoIHJlcXVlc3QgaXNcbiAgICAvLyByb3RhdGVkIHRocm91Z2ggdGhlIHBvb2xzLiBUYWlsYWJsZSBjdXJzb3IgcXVlcmllcyBibG9jayBvbiB0aGUgc2VydmVyXG4gICAgLy8gdW50aWwgdGhlcmUgaXMgc29tZSBkYXRhIHRvIHJldHVybiAob3IgdW50aWwgYSBmZXcgc2Vjb25kcyBoYXZlXG4gICAgLy8gcGFzc2VkKS4gU28gaWYgdGhlIGNvbm5lY3Rpb24gcG9vbCB1c2VkIGZvciB0YWlsaW5nIGN1cnNvcnMgaXMgdGhlIHNhbWVcbiAgICAvLyBwb29sIHVzZWQgZm9yIG90aGVyIHF1ZXJpZXMsIHRoZSBvdGhlciBxdWVyaWVzIHdpbGwgYmUgZGVsYXllZCBieSBzZWNvbmRzXG4gICAgLy8gMS81IG9mIHRoZSB0aW1lLlxuICAgIC8vXG4gICAgLy8gVGhlIHRhaWwgY29ubmVjdGlvbiB3aWxsIG9ubHkgZXZlciBiZSBydW5uaW5nIGEgc2luZ2xlIHRhaWwgY29tbWFuZCwgc29cbiAgICAvLyBpdCBvbmx5IG5lZWRzIHRvIG1ha2Ugb25lIHVuZGVybHlpbmcgVENQIGNvbm5lY3Rpb24uXG4gICAgc2VsZi5fb3Bsb2dUYWlsQ29ubmVjdGlvbiA9IG5ldyBNb25nb0Nvbm5lY3Rpb24oXG4gICAgICAgIHNlbGYuX29wbG9nVXJsLCB7bWF4UG9vbFNpemU6IDEsIG1pblBvb2xTaXplOiAxfSk7XG4gICAgLy8gWFhYIGJldHRlciBkb2NzLCBidXQ6IGl0J3MgdG8gZ2V0IG1vbm90b25pYyByZXN1bHRzXG4gICAgLy8gWFhYIGlzIGl0IHNhZmUgdG8gc2F5IFwiaWYgdGhlcmUncyBhbiBpbiBmbGlnaHQgcXVlcnksIGp1c3QgdXNlIGl0c1xuICAgIC8vICAgICByZXN1bHRzXCI/IEkgZG9uJ3QgdGhpbmsgc28gYnV0IHNob3VsZCBjb25zaWRlciB0aGF0XG4gICAgc2VsZi5fb3Bsb2dMYXN0RW50cnlDb25uZWN0aW9uID0gbmV3IE1vbmdvQ29ubmVjdGlvbihcbiAgICAgICAgc2VsZi5fb3Bsb2dVcmwsIHttYXhQb29sU2l6ZTogMSwgbWluUG9vbFNpemU6IDF9KTtcblxuXG4gICAgLy8gTm93LCBtYWtlIHN1cmUgdGhhdCB0aGVyZSBhY3R1YWxseSBpcyBhIHJlcGwgc2V0IGhlcmUuIElmIG5vdCwgb3Bsb2dcbiAgICAvLyB0YWlsaW5nIHdvbid0IGV2ZXIgZmluZCBhbnl0aGluZyFcbiAgICAvLyBNb3JlIG9uIHRoZSBpc01hc3RlckRvY1xuICAgIC8vIGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL2NvbW1hbmQvaXNNYXN0ZXIvXG4gICAgY29uc3QgaXNNYXN0ZXJEb2MgPSBhd2FpdCBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICBzZWxmLl9vcGxvZ0xhc3RFbnRyeUNvbm5lY3Rpb24uZGJcbiAgICAgICAgLmFkbWluKClcbiAgICAgICAgLmNvbW1hbmQoeyBpc21hc3RlcjogMSB9LCBmdW5jdGlvbiAoZXJyLCByZXN1bHQpIHtcbiAgICAgICAgICBpZiAoZXJyKSByZWplY3QoZXJyKTtcbiAgICAgICAgICBlbHNlIHJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBpZiAoIShpc01hc3RlckRvYyAmJiBpc01hc3RlckRvYy5zZXROYW1lKSkge1xuICAgICAgdGhyb3cgRXJyb3IoXCIkTU9OR09fT1BMT0dfVVJMIG11c3QgYmUgc2V0IHRvIHRoZSAnbG9jYWwnIGRhdGFiYXNlIG9mIFwiICtcbiAgICAgICAgICBcImEgTW9uZ28gcmVwbGljYSBzZXRcIik7XG4gICAgfVxuXG4gICAgLy8gRmluZCB0aGUgbGFzdCBvcGxvZyBlbnRyeS5cbiAgICB2YXIgbGFzdE9wbG9nRW50cnkgPSBhd2FpdCBzZWxmLl9vcGxvZ0xhc3RFbnRyeUNvbm5lY3Rpb24uZmluZE9uZUFzeW5jKFxuICAgICAgT1BMT0dfQ09MTEVDVElPTixcbiAgICAgIHt9LFxuICAgICAgeyBzb3J0OiB7ICRuYXR1cmFsOiAtMSB9LCBwcm9qZWN0aW9uOiB7IHRzOiAxIH0gfVxuICAgICk7XG5cbiAgICB2YXIgb3Bsb2dTZWxlY3RvciA9IE9iamVjdC5hc3NpZ24oe30sIHNlbGYuX2Jhc2VPcGxvZ1NlbGVjdG9yKTtcbiAgICBpZiAobGFzdE9wbG9nRW50cnkpIHtcbiAgICAgIC8vIFN0YXJ0IGFmdGVyIHRoZSBsYXN0IGVudHJ5IHRoYXQgY3VycmVudGx5IGV4aXN0cy5cbiAgICAgIG9wbG9nU2VsZWN0b3IudHMgPSB7JGd0OiBsYXN0T3Bsb2dFbnRyeS50c307XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgYW55IGNhbGxzIHRvIGNhbGxXaGVuUHJvY2Vzc2VkTGF0ZXN0IGJlZm9yZSBhbnkgb3RoZXJcbiAgICAgIC8vIG9wbG9nIGVudHJpZXMgc2hvdyB1cCwgYWxsb3cgY2FsbFdoZW5Qcm9jZXNzZWRMYXRlc3QgdG8gY2FsbCBpdHNcbiAgICAgIC8vIGNhbGxiYWNrIGltbWVkaWF0ZWx5LlxuICAgICAgc2VsZi5fbGFzdFByb2Nlc3NlZFRTID0gbGFzdE9wbG9nRW50cnkudHM7XG4gICAgfVxuXG4gICAgLy8gVGhlc2UgMiBzZXR0aW5ncyBhbGxvdyB5b3UgdG8gZWl0aGVyIG9ubHkgd2F0Y2ggY2VydGFpbiBjb2xsZWN0aW9ucyAob3Bsb2dJbmNsdWRlQ29sbGVjdGlvbnMpLCBvciBleGNsdWRlIHNvbWUgY29sbGVjdGlvbnMgeW91IGRvbid0IHdhbnQgdG8gd2F0Y2ggZm9yIG9wbG9nIHVwZGF0ZXMgKG9wbG9nRXhjbHVkZUNvbGxlY3Rpb25zKVxuICAgIC8vIFVzYWdlOlxuICAgIC8vIHNldHRpbmdzLmpzb24gPSB7XG4gICAgLy8gICBcInBhY2thZ2VzXCI6IHtcbiAgICAvLyAgICAgXCJtb25nb1wiOiB7XG4gICAgLy8gICAgICAgXCJvcGxvZ0V4Y2x1ZGVDb2xsZWN0aW9uc1wiOiBbXCJwcm9kdWN0c1wiLCBcInByaWNlc1wiXSAvLyBUaGlzIHdvdWxkIGV4Y2x1ZGUgYm90aCBjb2xsZWN0aW9ucyBcInByb2R1Y3RzXCIgYW5kIFwicHJpY2VzXCIgZnJvbSBhbnkgb3Bsb2cgdGFpbGluZy4gXG4gICAgLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBCZXdhcmUhIFRoaXMgbWVhbnMsIHRoYXQgbm8gc3Vic2NyaXB0aW9ucyBvbiB0aGVzZSAyIGNvbGxlY3Rpb25zIHdpbGwgdXBkYXRlIGFueW1vcmUhXG4gICAgLy8gICAgIH1cbiAgICAvLyAgIH1cbiAgICAvLyB9XG4gICAgY29uc3QgaW5jbHVkZUNvbGxlY3Rpb25zID0gTWV0ZW9yLnNldHRpbmdzPy5wYWNrYWdlcz8ubW9uZ28/Lm9wbG9nSW5jbHVkZUNvbGxlY3Rpb25zO1xuICAgIGNvbnN0IGV4Y2x1ZGVDb2xsZWN0aW9ucyA9IE1ldGVvci5zZXR0aW5ncz8ucGFja2FnZXM/Lm1vbmdvPy5vcGxvZ0V4Y2x1ZGVDb2xsZWN0aW9ucztcbiAgICBpZiAoaW5jbHVkZUNvbGxlY3Rpb25zPy5sZW5ndGggJiYgZXhjbHVkZUNvbGxlY3Rpb25zPy5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IHVzZSBib3RoIG1vbmdvIG9wbG9nIHNldHRpbmdzIG9wbG9nSW5jbHVkZUNvbGxlY3Rpb25zIGFuZCBvcGxvZ0V4Y2x1ZGVDb2xsZWN0aW9ucyBhdCB0aGUgc2FtZSB0aW1lLlwiKTtcbiAgICB9XG4gICAgaWYgKGV4Y2x1ZGVDb2xsZWN0aW9ucz8ubGVuZ3RoKSB7XG4gICAgICBvcGxvZ1NlbGVjdG9yLm5zID0ge1xuICAgICAgICAkcmVnZXg6IG9wbG9nU2VsZWN0b3IubnMsXG4gICAgICAgICRuaW46IGV4Y2x1ZGVDb2xsZWN0aW9ucy5tYXAoKGNvbGxOYW1lKSA9PiBgJHtzZWxmLl9kYk5hbWV9LiR7Y29sbE5hbWV9YClcbiAgICAgIH1cbiAgICAgIHNlbGYuX29wbG9nT3B0aW9ucyA9IHsgZXhjbHVkZUNvbGxlY3Rpb25zIH07XG4gICAgfVxuICAgIGVsc2UgaWYgKGluY2x1ZGVDb2xsZWN0aW9ucz8ubGVuZ3RoKSB7XG4gICAgICBvcGxvZ1NlbGVjdG9yID0geyAkYW5kOiBbXG4gICAgICAgIHsgJG9yOiBbXG4gICAgICAgICAgeyBuczogL15hZG1pblxcLlxcJGNtZC8gfSxcbiAgICAgICAgICB7IG5zOiB7ICRpbjogaW5jbHVkZUNvbGxlY3Rpb25zLm1hcCgoY29sbE5hbWUpID0+IGAke3NlbGYuX2RiTmFtZX0uJHtjb2xsTmFtZX1gKSB9IH1cbiAgICAgICAgXSB9LFxuICAgICAgICB7ICRvcjogb3Bsb2dTZWxlY3Rvci4kb3IgfSwgLy8gdGhlIGluaXRpYWwgJG9yIHRvIHNlbGVjdCBvbmx5IGNlcnRhaW4gb3BlcmF0aW9ucyAob3ApXG4gICAgICAgIHsgdHM6IG9wbG9nU2VsZWN0b3IudHMgfVxuICAgICAgXSB9O1xuICAgICAgc2VsZi5fb3Bsb2dPcHRpb25zID0geyBpbmNsdWRlQ29sbGVjdGlvbnMgfTtcbiAgICB9XG5cbiAgICB2YXIgY3Vyc29yRGVzY3JpcHRpb24gPSBuZXcgQ3Vyc29yRGVzY3JpcHRpb24oXG4gICAgICAgIE9QTE9HX0NPTExFQ1RJT04sIG9wbG9nU2VsZWN0b3IsIHt0YWlsYWJsZTogdHJ1ZX0pO1xuXG4gICAgLy8gU3RhcnQgdGFpbGluZyB0aGUgb3Bsb2cuXG4gICAgLy9cbiAgICAvLyBXZSByZXN0YXJ0IHRoZSBsb3ctbGV2ZWwgb3Bsb2cgcXVlcnkgZXZlcnkgMzAgc2Vjb25kcyBpZiB3ZSBkaWRuJ3QgZ2V0IGFcbiAgICAvLyBkb2MuIFRoaXMgaXMgYSB3b3JrYXJvdW5kIGZvciAjODU5ODogdGhlIE5vZGUgTW9uZ28gZHJpdmVyIGhhcyBhdCBsZWFzdFxuICAgIC8vIG9uZSBidWcgdGhhdCBjYW4gbGVhZCB0byBxdWVyeSBjYWxsYmFja3MgbmV2ZXIgZ2V0dGluZyBjYWxsZWQgKGV2ZW4gd2l0aFxuICAgIC8vIGFuIGVycm9yKSB3aGVuIGxlYWRlcnNoaXAgZmFpbG92ZXIgb2NjdXIuXG4gICAgc2VsZi5fdGFpbEhhbmRsZSA9IHNlbGYuX29wbG9nVGFpbENvbm5lY3Rpb24udGFpbChcbiAgICAgICAgY3Vyc29yRGVzY3JpcHRpb24sXG4gICAgICAgIGZ1bmN0aW9uIChkb2MpIHtcbiAgICAgICAgICBzZWxmLl9lbnRyeVF1ZXVlLnB1c2goZG9jKTtcbiAgICAgICAgICBzZWxmLl9tYXliZVN0YXJ0V29ya2VyKCk7XG4gICAgICAgIH0sXG4gICAgICAgIFRBSUxfVElNRU9VVFxuICAgICk7XG5cbiAgICBzZWxmLl9yZWFkeVByb21pc2VSZXNvbHZlcigpO1xuICB9LFxuXG4gIF9tYXliZVN0YXJ0V29ya2VyOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl93b3JrZXJBY3RpdmUpIHJldHVybjtcbiAgICBzZWxmLl93b3JrZXJBY3RpdmUgPSB0cnVlO1xuXG4gICAgTWV0ZW9yLmRlZmVyKGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgIC8vIE1heSBiZSBjYWxsZWQgcmVjdXJzaXZlbHkgaW4gY2FzZSBvZiB0cmFuc2FjdGlvbnMuXG4gICAgICBhc3luYyBmdW5jdGlvbiBoYW5kbGVEb2MoZG9jKSB7XG4gICAgICAgIGlmIChkb2MubnMgPT09IFwiYWRtaW4uJGNtZFwiKSB7XG4gICAgICAgICAgaWYgKGRvYy5vLmFwcGx5T3BzKSB7XG4gICAgICAgICAgICAvLyBUaGlzIHdhcyBhIHN1Y2Nlc3NmdWwgdHJhbnNhY3Rpb24sIHNvIHdlIG5lZWQgdG8gYXBwbHkgdGhlXG4gICAgICAgICAgICAvLyBvcGVyYXRpb25zIHRoYXQgd2VyZSBpbnZvbHZlZC5cbiAgICAgICAgICAgIGxldCBuZXh0VGltZXN0YW1wID0gZG9jLnRzO1xuICAgICAgICAgICAgZm9yIChjb25zdCBvcCBvZiBkb2Muby5hcHBseU9wcykge1xuICAgICAgICAgICAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3IvaXNzdWVzLzEwNDIwLlxuICAgICAgICAgICAgICBpZiAoIW9wLnRzKSB7XG4gICAgICAgICAgICAgICAgb3AudHMgPSBuZXh0VGltZXN0YW1wO1xuICAgICAgICAgICAgICAgIG5leHRUaW1lc3RhbXAgPSBuZXh0VGltZXN0YW1wLmFkZChMb25nLk9ORSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYXdhaXQgaGFuZGxlRG9jKG9wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5rbm93biBjb21tYW5kIFwiICsgRUpTT04uc3RyaW5naWZ5KGRvYykpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdHJpZ2dlciA9IHtcbiAgICAgICAgICBkcm9wQ29sbGVjdGlvbjogZmFsc2UsXG4gICAgICAgICAgZHJvcERhdGFiYXNlOiBmYWxzZSxcbiAgICAgICAgICBvcDogZG9jLFxuICAgICAgICB9O1xuXG4gICAgICAgIGlmICh0eXBlb2YgZG9jLm5zID09PSBcInN0cmluZ1wiICYmXG4gICAgICAgICAgICBkb2MubnMuc3RhcnRzV2l0aChzZWxmLl9kYk5hbWUgKyBcIi5cIikpIHtcbiAgICAgICAgICB0cmlnZ2VyLmNvbGxlY3Rpb24gPSBkb2MubnMuc2xpY2Uoc2VsZi5fZGJOYW1lLmxlbmd0aCArIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSXMgaXQgYSBzcGVjaWFsIGNvbW1hbmQgYW5kIHRoZSBjb2xsZWN0aW9uIG5hbWUgaXMgaGlkZGVuXG4gICAgICAgIC8vIHNvbWV3aGVyZSBpbiBvcGVyYXRvcj9cbiAgICAgICAgaWYgKHRyaWdnZXIuY29sbGVjdGlvbiA9PT0gXCIkY21kXCIpIHtcbiAgICAgICAgICBpZiAoZG9jLm8uZHJvcERhdGFiYXNlKSB7XG4gICAgICAgICAgICBkZWxldGUgdHJpZ2dlci5jb2xsZWN0aW9uO1xuICAgICAgICAgICAgdHJpZ2dlci5kcm9wRGF0YWJhc2UgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSBpZiAoaGFzKGRvYy5vLCBcImRyb3BcIikpIHtcbiAgICAgICAgICAgIHRyaWdnZXIuY29sbGVjdGlvbiA9IGRvYy5vLmRyb3A7XG4gICAgICAgICAgICB0cmlnZ2VyLmRyb3BDb2xsZWN0aW9uID0gdHJ1ZTtcbiAgICAgICAgICAgIHRyaWdnZXIuaWQgPSBudWxsO1xuICAgICAgICAgIH0gZWxzZSBpZiAoXCJjcmVhdGVcIiBpbiBkb2MubyAmJiBcImlkSW5kZXhcIiBpbiBkb2Mubykge1xuICAgICAgICAgICAgLy8gQSBjb2xsZWN0aW9uIGdvdCBpbXBsaWNpdGx5IGNyZWF0ZWQgd2l0aGluIGEgdHJhbnNhY3Rpb24uIFRoZXJlJ3NcbiAgICAgICAgICAgIC8vIG5vIG5lZWQgdG8gZG8gYW55dGhpbmcgYWJvdXQgaXQuXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKFwiVW5rbm93biBjb21tYW5kIFwiICsgRUpTT04uc3RyaW5naWZ5KGRvYykpO1xuICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEFsbCBvdGhlciBvcHMgaGF2ZSBhbiBpZC5cbiAgICAgICAgICB0cmlnZ2VyLmlkID0gaWRGb3JPcChkb2MpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgc2VsZi5fY3Jvc3NiYXIuZmlyZSh0cmlnZ2VyKTtcbiAgICAgIH1cblxuICAgICAgdHJ5IHtcbiAgICAgICAgd2hpbGUgKCEgc2VsZi5fc3RvcHBlZCAmJlxuICAgICAgICAgICAgICAgISBzZWxmLl9lbnRyeVF1ZXVlLmlzRW1wdHkoKSkge1xuICAgICAgICAgIC8vIEFyZSB3ZSB0b28gZmFyIGJlaGluZD8gSnVzdCB0ZWxsIG91ciBvYnNlcnZlcnMgdGhhdCB0aGV5IG5lZWQgdG9cbiAgICAgICAgICAvLyByZXBvbGwsIGFuZCBkcm9wIG91ciBxdWV1ZS5cbiAgICAgICAgICBpZiAoc2VsZi5fZW50cnlRdWV1ZS5sZW5ndGggPiBUT09fRkFSX0JFSElORCkge1xuICAgICAgICAgICAgdmFyIGxhc3RFbnRyeSA9IHNlbGYuX2VudHJ5UXVldWUucG9wKCk7XG4gICAgICAgICAgICBzZWxmLl9lbnRyeVF1ZXVlLmNsZWFyKCk7XG5cbiAgICAgICAgICAgIHNlbGYuX29uU2tpcHBlZEVudHJpZXNIb29rLmVhY2goZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIEZyZWUgYW55IHdhaXRVbnRpbENhdWdodFVwKCkgY2FsbHMgdGhhdCB3ZXJlIHdhaXRpbmcgZm9yIHVzIHRvXG4gICAgICAgICAgICAvLyBwYXNzIHNvbWV0aGluZyB0aGF0IHdlIGp1c3Qgc2tpcHBlZC5cbiAgICAgICAgICAgIHNlbGYuX3NldExhc3RQcm9jZXNzZWRUUyhsYXN0RW50cnkudHMpO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgZG9jID0gc2VsZi5fZW50cnlRdWV1ZS5zaGlmdCgpO1xuXG4gICAgICAgICAgLy8gRmlyZSB0cmlnZ2VyKHMpIGZvciB0aGlzIGRvYy5cbiAgICAgICAgICBhd2FpdCBoYW5kbGVEb2MoZG9jKTtcblxuICAgICAgICAgIC8vIE5vdyB0aGF0IHdlJ3ZlIHByb2Nlc3NlZCB0aGlzIG9wZXJhdGlvbiwgcHJvY2VzcyBwZW5kaW5nXG4gICAgICAgICAgLy8gc2VxdWVuY2Vycy5cbiAgICAgICAgICBpZiAoZG9jLnRzKSB7XG4gICAgICAgICAgICBzZWxmLl9zZXRMYXN0UHJvY2Vzc2VkVFMoZG9jLnRzKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoXCJvcGxvZyBlbnRyeSB3aXRob3V0IHRzOiBcIiArIEVKU09OLnN0cmluZ2lmeShkb2MpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHNlbGYuX3dvcmtlckFjdGl2ZSA9IGZhbHNlO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuXG4gIF9zZXRMYXN0UHJvY2Vzc2VkVFM6IGZ1bmN0aW9uICh0cykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLl9sYXN0UHJvY2Vzc2VkVFMgPSB0cztcbiAgICB3aGlsZSAoIWlzRW1wdHkoc2VsZi5fY2F0Y2hpbmdVcFJlc29sdmVycykgJiYgc2VsZi5fY2F0Y2hpbmdVcFJlc29sdmVyc1swXS50cy5sZXNzVGhhbk9yRXF1YWwoc2VsZi5fbGFzdFByb2Nlc3NlZFRTKSkge1xuICAgICAgdmFyIHNlcXVlbmNlciA9IHNlbGYuX2NhdGNoaW5nVXBSZXNvbHZlcnMuc2hpZnQoKTtcbiAgICAgIHNlcXVlbmNlci5yZXNvbHZlcigpO1xuICAgIH1cbiAgfSxcblxuICAvL01ldGhvZHMgdXNlZCBvbiB0ZXN0cyB0byBkaW5hbWljYWxseSBjaGFuZ2UgVE9PX0ZBUl9CRUhJTkRcbiAgX2RlZmluZVRvb0ZhckJlaGluZDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICBUT09fRkFSX0JFSElORCA9IHZhbHVlO1xuICB9LFxuICBfcmVzZXRUb29GYXJCZWhpbmQ6IGZ1bmN0aW9uKCkge1xuICAgIFRPT19GQVJfQkVISU5EID0gcHJvY2Vzcy5lbnYuTUVURU9SX09QTE9HX1RPT19GQVJfQkVISU5EIHx8IDIwMDA7XG4gIH1cbn0pOyIsImltcG9ydCBoYXMgZnJvbSAnbG9kYXNoLmhhcyc7IFxuaW1wb3J0IGlzRW1wdHkgZnJvbSAnbG9kYXNoLmlzZW1wdHknO1xuXG5sZXQgbmV4dE9ic2VydmVIYW5kbGVJZCA9IDE7XG5cbk9ic2VydmVNdWx0aXBsZXhlciA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IoeyBvcmRlcmVkLCBvblN0b3AgPSAoKSA9PiB7fSB9ID0ge30pIHtcbiAgICBpZiAob3JkZXJlZCA9PT0gdW5kZWZpbmVkKSB0aHJvdyBFcnJvcihcIm11c3Qgc3BlY2lmeSBvcmRlcmVkXCIpO1xuXG4gICAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgICAgICBcIm1vbmdvLWxpdmVkYXRhXCIsIFwib2JzZXJ2ZS1tdWx0aXBsZXhlcnNcIiwgMSk7XG5cbiAgICB0aGlzLl9vcmRlcmVkID0gb3JkZXJlZDtcbiAgICB0aGlzLl9vblN0b3AgPSBvblN0b3A7XG4gICAgdGhpcy5fcXVldWUgPSBuZXcgTWV0ZW9yLl9Bc3luY2hyb25vdXNRdWV1ZSgpO1xuICAgIHRoaXMuX2hhbmRsZXMgPSB7fTtcbiAgICB0aGlzLl9yZXNvbHZlciA9IG51bGw7XG4gICAgdGhpcy5fcmVhZHlQcm9taXNlID0gbmV3IFByb21pc2UociA9PiB0aGlzLl9yZXNvbHZlciA9IHIpLnRoZW4oKCkgPT4gdGhpcy5faXNSZWFkeSA9IHRydWUpO1xuICAgIHRoaXMuX2NhY2hlID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fQ2FjaGluZ0NoYW5nZU9ic2VydmVyKHtcbiAgICAgIG9yZGVyZWR9KTtcbiAgICAvLyBOdW1iZXIgb2YgYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzIHRhc2tzIHNjaGVkdWxlZCBidXQgbm90IHlldFxuICAgIC8vIHJ1bm5pbmcuIHJlbW92ZUhhbmRsZSB1c2VzIHRoaXMgdG8ga25vdyBpZiBpdCdzIHRpbWUgdG8gY2FsbCB0aGUgb25TdG9wXG4gICAgLy8gY2FsbGJhY2suXG4gICAgdGhpcy5fYWRkSGFuZGxlVGFza3NTY2hlZHVsZWRCdXROb3RQZXJmb3JtZWQgPSAwO1xuXG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5jYWxsYmFja05hbWVzKCkuZm9yRWFjaChjYWxsYmFja05hbWUgPT4ge1xuICAgICAgdGhpc1tjYWxsYmFja05hbWVdID0gZnVuY3Rpb24oLyogLi4uICovKSB7XG4gICAgICAgIHNlbGYuX2FwcGx5Q2FsbGJhY2soY2FsbGJhY2tOYW1lLCBfLnRvQXJyYXkoYXJndW1lbnRzKSk7XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzKGhhbmRsZSkge1xuICAgIHJldHVybiB0aGlzLl9hZGRIYW5kbGVBbmRTZW5kSW5pdGlhbEFkZHMoaGFuZGxlKTtcbiAgfVxuXG4gIGFzeW5jIF9hZGRIYW5kbGVBbmRTZW5kSW5pdGlhbEFkZHMoaGFuZGxlKSB7XG4gICAgKyt0aGlzLl9hZGRIYW5kbGVUYXNrc1NjaGVkdWxlZEJ1dE5vdFBlcmZvcm1lZDtcblxuICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgICAgXCJtb25nby1saXZlZGF0YVwiLCBcIm9ic2VydmUtaGFuZGxlc1wiLCAxKTtcblxuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGF3YWl0IHRoaXMuX3F1ZXVlLnJ1blRhc2soYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5faGFuZGxlc1toYW5kbGUuX2lkXSA9IGhhbmRsZTtcbiAgICAgIC8vIFNlbmQgb3V0IHdoYXRldmVyIGFkZHMgd2UgaGF2ZSBzbyBmYXIgKHdoZXRoZXIgdGhlXG4gICAgICAvLyBtdWx0aXBsZXhlciBpcyByZWFkeSkuXG4gICAgICBhd2FpdCBzZWxmLl9zZW5kQWRkcyhoYW5kbGUpO1xuICAgICAgLS1zZWxmLl9hZGRIYW5kbGVUYXNrc1NjaGVkdWxlZEJ1dE5vdFBlcmZvcm1lZDtcbiAgICB9KTtcbiAgICBhd2FpdCB0aGlzLl9yZWFkeVByb21pc2U7XG4gIH1cblxuICAvLyBSZW1vdmUgYW4gb2JzZXJ2ZSBoYW5kbGUuIElmIGl0IHdhcyB0aGUgbGFzdCBvYnNlcnZlIGhhbmRsZSwgY2FsbCB0aGVcbiAgLy8gb25TdG9wIGNhbGxiYWNrOyB5b3UgY2Fubm90IGFkZCBhbnkgbW9yZSBvYnNlcnZlIGhhbmRsZXMgYWZ0ZXIgdGhpcy5cbiAgLy9cbiAgLy8gVGhpcyBpcyBub3Qgc3luY2hyb25pemVkIHdpdGggcG9sbHMgYW5kIGhhbmRsZSBhZGRpdGlvbnM6IHRoaXMgbWVhbnMgdGhhdFxuICAvLyB5b3UgY2FuIHNhZmVseSBjYWxsIGl0IGZyb20gd2l0aGluIGFuIG9ic2VydmUgY2FsbGJhY2ssIGJ1dCBpdCBhbHNvIG1lYW5zXG4gIC8vIHRoYXQgd2UgaGF2ZSB0byBiZSBjYXJlZnVsIHdoZW4gd2UgaXRlcmF0ZSBvdmVyIF9oYW5kbGVzLlxuICBhc3luYyByZW1vdmVIYW5kbGUoaWQpIHtcbiAgICAvLyBUaGlzIHNob3VsZCBub3QgYmUgcG9zc2libGU6IHlvdSBjYW4gb25seSBjYWxsIHJlbW92ZUhhbmRsZSBieSBoYXZpbmdcbiAgICAvLyBhY2Nlc3MgdG8gdGhlIE9ic2VydmVIYW5kbGUsIHdoaWNoIGlzbid0IHJldHVybmVkIHRvIHVzZXIgY29kZSB1bnRpbCB0aGVcbiAgICAvLyBtdWx0aXBsZXggaXMgcmVhZHkuXG4gICAgaWYgKCF0aGlzLl9yZWFkeSgpKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgcmVtb3ZlIGhhbmRsZXMgdW50aWwgdGhlIG11bHRpcGxleCBpcyByZWFkeVwiKTtcblxuICAgIGRlbGV0ZSB0aGlzLl9oYW5kbGVzW2lkXTtcblxuICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgICAgXCJtb25nby1saXZlZGF0YVwiLCBcIm9ic2VydmUtaGFuZGxlc1wiLCAtMSk7XG5cbiAgICBpZiAoaXNFbXB0eSh0aGlzLl9oYW5kbGVzKSAmJlxuICAgICAgICB0aGlzLl9hZGRIYW5kbGVUYXNrc1NjaGVkdWxlZEJ1dE5vdFBlcmZvcm1lZCA9PT0gMCkge1xuICAgICAgYXdhaXQgdGhpcy5fc3RvcCgpO1xuICAgIH1cbiAgfVxuICBhc3luYyBfc3RvcChvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICAvLyBJdCBzaG91bGRuJ3QgYmUgcG9zc2libGUgZm9yIHVzIHRvIHN0b3Agd2hlbiBhbGwgb3VyIGhhbmRsZXMgc3RpbGxcbiAgICAvLyBoYXZlbid0IGJlZW4gcmV0dXJuZWQgZnJvbSBvYnNlcnZlQ2hhbmdlcyFcbiAgICBpZiAoISB0aGlzLl9yZWFkeSgpICYmICEgb3B0aW9ucy5mcm9tUXVlcnlFcnJvcilcbiAgICAgIHRocm93IEVycm9yKFwic3VycHJpc2luZyBfc3RvcDogbm90IHJlYWR5XCIpO1xuXG4gICAgLy8gQ2FsbCBzdG9wIGNhbGxiYWNrICh3aGljaCBraWxscyB0aGUgdW5kZXJseWluZyBwcm9jZXNzIHdoaWNoIHNlbmRzIHVzXG4gICAgLy8gY2FsbGJhY2tzIGFuZCByZW1vdmVzIHVzIGZyb20gdGhlIGNvbm5lY3Rpb24ncyBkaWN0aW9uYXJ5KS5cbiAgICBhd2FpdCB0aGlzLl9vblN0b3AoKTtcbiAgICBQYWNrYWdlWydmYWN0cy1iYXNlJ10gJiYgUGFja2FnZVsnZmFjdHMtYmFzZSddLkZhY3RzLmluY3JlbWVudFNlcnZlckZhY3QoXG4gICAgICAgIFwibW9uZ28tbGl2ZWRhdGFcIiwgXCJvYnNlcnZlLW11bHRpcGxleGVyc1wiLCAtMSk7XG5cbiAgICAvLyBDYXVzZSBmdXR1cmUgYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzIGNhbGxzIHRvIHRocm93IChidXQgdGhlIG9uU3RvcFxuICAgIC8vIGNhbGxiYWNrIHNob3VsZCBtYWtlIG91ciBjb25uZWN0aW9uIGZvcmdldCBhYm91dCB1cykuXG4gICAgdGhpcy5faGFuZGxlcyA9IG51bGw7XG4gIH1cblxuICAvLyBBbGxvd3MgYWxsIGFkZEhhbmRsZUFuZFNlbmRJbml0aWFsQWRkcyBjYWxscyB0byByZXR1cm4sIG9uY2UgYWxsIHByZWNlZGluZ1xuICAvLyBhZGRzIGhhdmUgYmVlbiBwcm9jZXNzZWQuIERvZXMgbm90IGJsb2NrLlxuICBhc3luYyByZWFkeSgpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICB0aGlzLl9xdWV1ZS5xdWV1ZVRhc2soZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKHNlbGYuX3JlYWR5KCkpXG4gICAgICAgIHRocm93IEVycm9yKFwiY2FuJ3QgbWFrZSBPYnNlcnZlTXVsdGlwbGV4IHJlYWR5IHR3aWNlIVwiKTtcblxuICAgICAgaWYgKCFzZWxmLl9yZXNvbHZlcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNaXNzaW5nIHJlc29sdmVyXCIpO1xuICAgICAgfVxuXG4gICAgICBzZWxmLl9yZXNvbHZlcigpO1xuICAgICAgc2VsZi5faXNSZWFkeSA9IHRydWU7XG4gICAgfSk7XG4gIH1cblxuICAvLyBJZiB0cnlpbmcgdG8gZXhlY3V0ZSB0aGUgcXVlcnkgcmVzdWx0cyBpbiBhbiBlcnJvciwgY2FsbCB0aGlzLiBUaGlzIGlzXG4gIC8vIGludGVuZGVkIGZvciBwZXJtYW5lbnQgZXJyb3JzLCBub3QgdHJhbnNpZW50IG5ldHdvcmsgZXJyb3JzIHRoYXQgY291bGQgYmVcbiAgLy8gZml4ZWQuIEl0IHNob3VsZCBvbmx5IGJlIGNhbGxlZCBiZWZvcmUgcmVhZHkoKSwgYmVjYXVzZSBpZiB5b3UgY2FsbGVkIHJlYWR5XG4gIC8vIHRoYXQgbWVhbnQgdGhhdCB5b3UgbWFuYWdlZCB0byBydW4gdGhlIHF1ZXJ5IG9uY2UuIEl0IHdpbGwgc3RvcCB0aGlzXG4gIC8vIE9ic2VydmVNdWx0aXBsZXggYW5kIGNhdXNlIGFkZEhhbmRsZUFuZFNlbmRJbml0aWFsQWRkcyBjYWxscyAoYW5kIHRodXNcbiAgLy8gb2JzZXJ2ZUNoYW5nZXMgY2FsbHMpIHRvIHRocm93IHRoZSBlcnJvci5cbiAgYXN5bmMgcXVlcnlFcnJvcihlcnIpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgYXdhaXQgdGhpcy5fcXVldWUucnVuVGFzayhmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoc2VsZi5fcmVhZHkoKSlcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJjYW4ndCBjbGFpbSBxdWVyeSBoYXMgYW4gZXJyb3IgYWZ0ZXIgaXQgd29ya2VkIVwiKTtcbiAgICAgIHNlbGYuX3N0b3Aoe2Zyb21RdWVyeUVycm9yOiB0cnVlfSk7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfSk7XG4gIH1cblxuICAvLyBDYWxscyBcImNiXCIgb25jZSB0aGUgZWZmZWN0cyBvZiBhbGwgXCJyZWFkeVwiLCBcImFkZEhhbmRsZUFuZFNlbmRJbml0aWFsQWRkc1wiXG4gIC8vIGFuZCBvYnNlcnZlIGNhbGxiYWNrcyB3aGljaCBjYW1lIGJlZm9yZSB0aGlzIGNhbGwgaGF2ZSBiZWVuIHByb3BhZ2F0ZWQgdG9cbiAgLy8gYWxsIGhhbmRsZXMuIFwicmVhZHlcIiBtdXN0IGhhdmUgYWxyZWFkeSBiZWVuIGNhbGxlZCBvbiB0aGlzIG11bHRpcGxleGVyLlxuICBhc3luYyBvbkZsdXNoKGNiKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGF3YWl0IHRoaXMuX3F1ZXVlLnF1ZXVlVGFzayhhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoIXNlbGYuX3JlYWR5KCkpXG4gICAgICAgIHRocm93IEVycm9yKFwib25seSBjYWxsIG9uRmx1c2ggb24gYSBtdWx0aXBsZXhlciB0aGF0IHdpbGwgYmUgcmVhZHlcIik7XG4gICAgICBhd2FpdCBjYigpO1xuICAgIH0pO1xuICB9XG4gIGNhbGxiYWNrTmFtZXMoKSB7XG4gICAgaWYgKHRoaXMuX29yZGVyZWQpXG4gICAgICByZXR1cm4gW1wiYWRkZWRCZWZvcmVcIiwgXCJjaGFuZ2VkXCIsIFwibW92ZWRCZWZvcmVcIiwgXCJyZW1vdmVkXCJdO1xuICAgIGVsc2VcbiAgICAgIHJldHVybiBbXCJhZGRlZFwiLCBcImNoYW5nZWRcIiwgXCJyZW1vdmVkXCJdO1xuICB9XG4gIF9yZWFkeSgpIHtcbiAgICByZXR1cm4gISF0aGlzLl9pc1JlYWR5O1xuICB9XG4gIF9hcHBseUNhbGxiYWNrKGNhbGxiYWNrTmFtZSwgYXJncykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuX3F1ZXVlLnF1ZXVlVGFzayhhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAvLyBJZiB3ZSBzdG9wcGVkIGluIHRoZSBtZWFudGltZSwgZG8gbm90aGluZy5cbiAgICAgIGlmICghc2VsZi5faGFuZGxlcylcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICAvLyBGaXJzdCwgYXBwbHkgdGhlIGNoYW5nZSB0byB0aGUgY2FjaGUuXG4gICAgICBhd2FpdCBzZWxmLl9jYWNoZS5hcHBseUNoYW5nZVtjYWxsYmFja05hbWVdLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgICAgLy8gSWYgd2UgaGF2ZW4ndCBmaW5pc2hlZCB0aGUgaW5pdGlhbCBhZGRzLCB0aGVuIHdlIHNob3VsZCBvbmx5IGJlIGdldHRpbmdcbiAgICAgIC8vIGFkZHMuXG4gICAgICBpZiAoIXNlbGYuX3JlYWR5KCkgJiZcbiAgICAgICAgICAoY2FsbGJhY2tOYW1lICE9PSAnYWRkZWQnICYmIGNhbGxiYWNrTmFtZSAhPT0gJ2FkZGVkQmVmb3JlJykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiR290IFwiICsgY2FsbGJhY2tOYW1lICsgXCIgZHVyaW5nIGluaXRpYWwgYWRkc1wiKTtcbiAgICAgIH1cblxuICAgICAgLy8gTm93IG11bHRpcGxleCB0aGUgY2FsbGJhY2tzIG91dCB0byBhbGwgb2JzZXJ2ZSBoYW5kbGVzLiBJdCdzIE9LIGlmXG4gICAgICAvLyB0aGVzZSBjYWxscyB5aWVsZDsgc2luY2Ugd2UncmUgaW5zaWRlIGEgdGFzaywgbm8gb3RoZXIgdXNlIG9mIG91ciBxdWV1ZVxuICAgICAgLy8gY2FuIGNvbnRpbnVlIHVudGlsIHRoZXNlIGFyZSBkb25lLiAoQnV0IHdlIGRvIGhhdmUgdG8gYmUgY2FyZWZ1bCB0byBub3RcbiAgICAgIC8vIHVzZSBhIGhhbmRsZSB0aGF0IGdvdCByZW1vdmVkLCBiZWNhdXNlIHJlbW92ZUhhbmRsZSBkb2VzIG5vdCB1c2UgdGhlXG4gICAgICAvLyBxdWV1ZTsgdGh1cywgd2UgaXRlcmF0ZSBvdmVyIGFuIGFycmF5IG9mIGtleXMgdGhhdCB3ZSBjb250cm9sLilcbiAgICAgIGZvciAoY29uc3QgaGFuZGxlSWQgb2YgT2JqZWN0LmtleXMoc2VsZi5faGFuZGxlcykpIHtcbiAgICAgICAgdmFyIGhhbmRsZSA9IHNlbGYuX2hhbmRsZXMgJiYgc2VsZi5faGFuZGxlc1toYW5kbGVJZF07XG4gICAgICAgIGlmICghaGFuZGxlKSByZXR1cm47XG4gICAgICAgIHZhciBjYWxsYmFjayA9IGhhbmRsZVsnXycgKyBjYWxsYmFja05hbWVdO1xuICAgICAgICAvLyBjbG9uZSBhcmd1bWVudHMgc28gdGhhdCBjYWxsYmFja3MgY2FuIG11dGF0ZSB0aGVpciBhcmd1bWVudHNcblxuICAgICAgICBjYWxsYmFjayAmJlxuICAgICAgICAgIChhd2FpdCBjYWxsYmFjay5hcHBseShcbiAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICBoYW5kbGUubm9uTXV0YXRpbmdDYWxsYmFja3MgPyBhcmdzIDogRUpTT04uY2xvbmUoYXJncylcbiAgICAgICAgICApKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8vIFNlbmRzIGluaXRpYWwgYWRkcyB0byBhIGhhbmRsZS4gSXQgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGZyb20gd2l0aGluIGEgdGFza1xuICAvLyAodGhlIHRhc2sgdGhhdCBpcyBwcm9jZXNzaW5nIHRoZSBhZGRIYW5kbGVBbmRTZW5kSW5pdGlhbEFkZHMgY2FsbCkuIEl0XG4gIC8vIHN5bmNocm9ub3VzbHkgaW52b2tlcyB0aGUgaGFuZGxlJ3MgYWRkZWQgb3IgYWRkZWRCZWZvcmU7IHRoZXJlJ3Mgbm8gbmVlZCB0b1xuICAvLyBmbHVzaCB0aGUgcXVldWUgYWZ0ZXJ3YXJkcyB0byBlbnN1cmUgdGhhdCB0aGUgY2FsbGJhY2tzIGdldCBvdXQuXG4gIGFzeW5jIF9zZW5kQWRkcyhoYW5kbGUpIHtcbiAgICB2YXIgYWRkID0gdGhpcy5fb3JkZXJlZCA/IGhhbmRsZS5fYWRkZWRCZWZvcmUgOiBoYW5kbGUuX2FkZGVkO1xuICAgIGlmICghYWRkKVxuICAgICAgcmV0dXJuO1xuICAgIC8vIG5vdGU6IGRvY3MgbWF5IGJlIGFuIF9JZE1hcCBvciBhbiBPcmRlcmVkRGljdFxuICAgIGF3YWl0IHRoaXMuX2NhY2hlLmRvY3MuZm9yRWFjaEFzeW5jKGFzeW5jIChkb2MsIGlkKSA9PiB7XG4gICAgICBpZiAoIWhhcyh0aGlzLl9oYW5kbGVzLCBoYW5kbGUuX2lkKSlcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJoYW5kbGUgZ290IHJlbW92ZWQgYmVmb3JlIHNlbmRpbmcgaW5pdGlhbCBhZGRzIVwiKTtcbiAgICAgIGNvbnN0IHsgX2lkLCAuLi5maWVsZHMgfSA9IGhhbmRsZS5ub25NdXRhdGluZ0NhbGxiYWNrcyA/IGRvY1xuICAgICAgICAgIDogRUpTT04uY2xvbmUoZG9jKTtcbiAgICAgIGlmICh0aGlzLl9vcmRlcmVkKVxuICAgICAgICBhd2FpdCBhZGQoaWQsIGZpZWxkcywgbnVsbCk7IC8vIHdlJ3JlIGdvaW5nIGluIG9yZGVyLCBzbyBhZGQgYXQgZW5kXG4gICAgICBlbHNlXG4gICAgICAgIGF3YWl0IGFkZChpZCwgZmllbGRzKTtcbiAgICB9KTtcbiAgfVxufTtcblxuLy8gV2hlbiB0aGUgY2FsbGJhY2tzIGRvIG5vdCBtdXRhdGUgdGhlIGFyZ3VtZW50cywgd2UgY2FuIHNraXAgYSBsb3Qgb2YgZGF0YSBjbG9uZXNcbk9ic2VydmVIYW5kbGUgPSBjbGFzcyB7XG4gIGNvbnN0cnVjdG9yKG11bHRpcGxleGVyLCBjYWxsYmFja3MsIG5vbk11dGF0aW5nQ2FsbGJhY2tzID0gZmFsc2UpIHtcbiAgICB0aGlzLl9tdWx0aXBsZXhlciA9IG11bHRpcGxleGVyO1xuICAgIG11bHRpcGxleGVyLmNhbGxiYWNrTmFtZXMoKS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgICBpZiAoY2FsbGJhY2tzW25hbWVdKSB7XG4gICAgICAgIHRoaXNbJ18nICsgbmFtZV0gPSBjYWxsYmFja3NbbmFtZV07XG4gICAgICB9IGVsc2UgaWYgKG5hbWUgPT09IFwiYWRkZWRCZWZvcmVcIiAmJiBjYWxsYmFja3MuYWRkZWQpIHtcbiAgICAgICAgLy8gU3BlY2lhbCBjYXNlOiBpZiB5b3Ugc3BlY2lmeSBcImFkZGVkXCIgYW5kIFwibW92ZWRCZWZvcmVcIiwgeW91IGdldCBhblxuICAgICAgICAvLyBvcmRlcmVkIG9ic2VydmUgd2hlcmUgZm9yIHNvbWUgcmVhc29uIHlvdSBkb24ndCBnZXQgb3JkZXJpbmcgZGF0YSBvblxuICAgICAgICAvLyB0aGUgYWRkcy4gIEkgZHVubm8sIHdlIHdyb3RlIHRlc3RzIGZvciBpdCwgdGhlcmUgbXVzdCBoYXZlIGJlZW4gYVxuICAgICAgICAvLyByZWFzb24uXG4gICAgICAgIHRoaXMuX2FkZGVkQmVmb3JlID0gYXN5bmMgZnVuY3Rpb24gKGlkLCBmaWVsZHMsIGJlZm9yZSkge1xuICAgICAgICAgIGF3YWl0IGNhbGxiYWNrcy5hZGRlZChpZCwgZmllbGRzKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLl9zdG9wcGVkID0gZmFsc2U7XG4gICAgdGhpcy5faWQgPSBuZXh0T2JzZXJ2ZUhhbmRsZUlkKys7XG4gICAgdGhpcy5ub25NdXRhdGluZ0NhbGxiYWNrcyA9IG5vbk11dGF0aW5nQ2FsbGJhY2tzO1xuICB9XG5cbiAgYXN5bmMgc3RvcCgpIHtcbiAgICBpZiAodGhpcy5fc3RvcHBlZCkgcmV0dXJuO1xuICAgIHRoaXMuX3N0b3BwZWQgPSB0cnVlO1xuICAgIGF3YWl0IHRoaXMuX211bHRpcGxleGVyLnJlbW92ZUhhbmRsZSh0aGlzLl9pZCk7XG4gIH1cbn07IiwiZXhwb3J0IGNsYXNzIERvY0ZldGNoZXIge1xuICBjb25zdHJ1Y3Rvcihtb25nb0Nvbm5lY3Rpb24pIHtcbiAgICB0aGlzLl9tb25nb0Nvbm5lY3Rpb24gPSBtb25nb0Nvbm5lY3Rpb247XG4gICAgLy8gTWFwIGZyb20gb3AgLT4gW2NhbGxiYWNrXVxuICAgIHRoaXMuX2NhbGxiYWNrc0Zvck9wID0gbmV3IE1hcCgpO1xuICB9XG5cbiAgLy8gRmV0Y2hlcyBkb2N1bWVudCBcImlkXCIgZnJvbSBjb2xsZWN0aW9uTmFtZSwgcmV0dXJuaW5nIGl0IG9yIG51bGwgaWYgbm90XG4gIC8vIGZvdW5kLlxuICAvL1xuICAvLyBJZiB5b3UgbWFrZSBtdWx0aXBsZSBjYWxscyB0byBmZXRjaCgpIHdpdGggdGhlIHNhbWUgb3AgcmVmZXJlbmNlLFxuICAvLyBEb2NGZXRjaGVyIG1heSBhc3N1bWUgdGhhdCB0aGV5IGFsbCByZXR1cm4gdGhlIHNhbWUgZG9jdW1lbnQuIChJdCBkb2VzXG4gIC8vIG5vdCBjaGVjayB0byBzZWUgaWYgY29sbGVjdGlvbk5hbWUvaWQgbWF0Y2guKVxuICAvL1xuICAvLyBZb3UgbWF5IGFzc3VtZSB0aGF0IGNhbGxiYWNrIGlzIG5ldmVyIGNhbGxlZCBzeW5jaHJvbm91c2x5IChhbmQgaW4gZmFjdFxuICAvLyBPcGxvZ09ic2VydmVEcml2ZXIgZG9lcyBzbykuXG4gIGFzeW5jIGZldGNoKGNvbGxlY3Rpb25OYW1lLCBpZCwgb3AsIGNhbGxiYWNrKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBcbiAgICBjaGVjayhjb2xsZWN0aW9uTmFtZSwgU3RyaW5nKTtcbiAgICBjaGVjayhvcCwgT2JqZWN0KTtcblxuXG4gICAgLy8gSWYgdGhlcmUncyBhbHJlYWR5IGFuIGluLXByb2dyZXNzIGZldGNoIGZvciB0aGlzIGNhY2hlIGtleSwgeWllbGQgdW50aWxcbiAgICAvLyBpdCdzIGRvbmUgYW5kIHJldHVybiB3aGF0ZXZlciBpdCByZXR1cm5zLlxuICAgIGlmIChzZWxmLl9jYWxsYmFja3NGb3JPcC5oYXMob3ApKSB7XG4gICAgICBzZWxmLl9jYWxsYmFja3NGb3JPcC5nZXQob3ApLnB1c2goY2FsbGJhY2spO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGNhbGxiYWNrcyA9IFtjYWxsYmFja107XG4gICAgc2VsZi5fY2FsbGJhY2tzRm9yT3Auc2V0KG9wLCBjYWxsYmFja3MpO1xuXG4gICAgdHJ5IHtcbiAgICAgIHZhciBkb2MgPVxuICAgICAgICAoYXdhaXQgc2VsZi5fbW9uZ29Db25uZWN0aW9uLmZpbmRPbmVBc3luYyhjb2xsZWN0aW9uTmFtZSwge1xuICAgICAgICAgIF9pZDogaWQsXG4gICAgICAgIH0pKSB8fCBudWxsO1xuICAgICAgLy8gUmV0dXJuIGRvYyB0byBhbGwgcmVsZXZhbnQgY2FsbGJhY2tzLiBOb3RlIHRoYXQgdGhpcyBhcnJheSBjYW5cbiAgICAgIC8vIGNvbnRpbnVlIHRvIGdyb3cgZHVyaW5nIGNhbGxiYWNrIGV4Y2VjdXRpb24uXG4gICAgICB3aGlsZSAoY2FsbGJhY2tzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgLy8gQ2xvbmUgdGhlIGRvY3VtZW50IHNvIHRoYXQgdGhlIHZhcmlvdXMgY2FsbHMgdG8gZmV0Y2ggZG9uJ3QgcmV0dXJuXG4gICAgICAgIC8vIG9iamVjdHMgdGhhdCBhcmUgaW50ZXJ0d2luZ2xlZCB3aXRoIGVhY2ggb3RoZXIuIENsb25lIGJlZm9yZVxuICAgICAgICAvLyBwb3BwaW5nIHRoZSBmdXR1cmUsIHNvIHRoYXQgaWYgY2xvbmUgdGhyb3dzLCB0aGUgZXJyb3IgZ2V0cyBwYXNzZWRcbiAgICAgICAgLy8gdG8gdGhlIG5leHQgY2FsbGJhY2suXG4gICAgICAgIGNhbGxiYWNrcy5wb3AoKShudWxsLCBFSlNPTi5jbG9uZShkb2MpKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB3aGlsZSAoY2FsbGJhY2tzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY2FsbGJhY2tzLnBvcCgpKGUpO1xuICAgICAgfVxuICAgIH0gZmluYWxseSB7XG4gICAgICAvLyBYWFggY29uc2lkZXIga2VlcGluZyB0aGUgZG9jIGFyb3VuZCBmb3IgYSBwZXJpb2Qgb2YgdGltZSBiZWZvcmVcbiAgICAgIC8vIHJlbW92aW5nIGZyb20gdGhlIGNhY2hlXG4gICAgICBzZWxmLl9jYWxsYmFja3NGb3JPcC5kZWxldGUob3ApO1xuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0IHRocm90dGxlIGZyb20gJ2xvZGFzaC50aHJvdHRsZSc7XG5cbnZhciBQT0xMSU5HX1RIUk9UVExFX01TID0gK3Byb2Nlc3MuZW52Lk1FVEVPUl9QT0xMSU5HX1RIUk9UVExFX01TIHx8IDUwO1xudmFyIFBPTExJTkdfSU5URVJWQUxfTVMgPSArcHJvY2Vzcy5lbnYuTUVURU9SX1BPTExJTkdfSU5URVJWQUxfTVMgfHwgMTAgKiAxMDAwO1xuXG5Qb2xsaW5nT2JzZXJ2ZURyaXZlciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIGNvbnN0IHNlbGYgPSB0aGlzO1xuICBzZWxmLl9vcHRpb25zID0gb3B0aW9ucztcblxuICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbiA9IG9wdGlvbnMuY3Vyc29yRGVzY3JpcHRpb247XG4gIHNlbGYuX21vbmdvSGFuZGxlID0gb3B0aW9ucy5tb25nb0hhbmRsZTtcbiAgc2VsZi5fb3JkZXJlZCA9IG9wdGlvbnMub3JkZXJlZDtcbiAgc2VsZi5fbXVsdGlwbGV4ZXIgPSBvcHRpb25zLm11bHRpcGxleGVyO1xuICBzZWxmLl9zdG9wQ2FsbGJhY2tzID0gW107XG4gIHNlbGYuX3N0b3BwZWQgPSBmYWxzZTtcblxuICBzZWxmLl9jdXJzb3IgPSBzZWxmLl9tb25nb0hhbmRsZS5fY3JlYXRlU3luY2hyb25vdXNDdXJzb3IoXG4gICAgc2VsZi5fY3Vyc29yRGVzY3JpcHRpb24pO1xuXG4gIC8vIHByZXZpb3VzIHJlc3VsdHMgc25hcHNob3QuICBvbiBlYWNoIHBvbGwgY3ljbGUsIGRpZmZzIGFnYWluc3RcbiAgLy8gcmVzdWx0cyBkcml2ZXMgdGhlIGNhbGxiYWNrcy5cbiAgc2VsZi5fcmVzdWx0cyA9IG51bGw7XG5cbiAgLy8gVGhlIG51bWJlciBvZiBfcG9sbE1vbmdvIGNhbGxzIHRoYXQgaGF2ZSBiZWVuIGFkZGVkIHRvIHNlbGYuX3Rhc2tRdWV1ZSBidXRcbiAgLy8gaGF2ZSBub3Qgc3RhcnRlZCBydW5uaW5nLiBVc2VkIHRvIG1ha2Ugc3VyZSB3ZSBuZXZlciBzY2hlZHVsZSBtb3JlIHRoYW4gb25lXG4gIC8vIF9wb2xsTW9uZ28gKG90aGVyIHRoYW4gcG9zc2libHkgdGhlIG9uZSB0aGF0IGlzIGN1cnJlbnRseSBydW5uaW5nKS4gSXQnc1xuICAvLyBhbHNvIHVzZWQgYnkgX3N1c3BlbmRQb2xsaW5nIHRvIHByZXRlbmQgdGhlcmUncyBhIHBvbGwgc2NoZWR1bGVkLiBVc3VhbGx5LFxuICAvLyBpdCdzIGVpdGhlciAwIChmb3IgXCJubyBwb2xscyBzY2hlZHVsZWQgb3RoZXIgdGhhbiBtYXliZSBvbmUgY3VycmVudGx5XG4gIC8vIHJ1bm5pbmdcIikgb3IgMSAoZm9yIFwiYSBwb2xsIHNjaGVkdWxlZCB0aGF0IGlzbid0IHJ1bm5pbmcgeWV0XCIpLCBidXQgaXQgY2FuXG4gIC8vIGFsc28gYmUgMiBpZiBpbmNyZW1lbnRlZCBieSBfc3VzcGVuZFBvbGxpbmcuXG4gIHNlbGYuX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZCA9IDA7XG4gIHNlbGYuX3BlbmRpbmdXcml0ZXMgPSBbXTsgLy8gcGVvcGxlIHRvIG5vdGlmeSB3aGVuIHBvbGxpbmcgY29tcGxldGVzXG5cbiAgLy8gTWFrZSBzdXJlIHRvIGNyZWF0ZSBhIHNlcGFyYXRlbHkgdGhyb3R0bGVkIGZ1bmN0aW9uIGZvciBlYWNoXG4gIC8vIFBvbGxpbmdPYnNlcnZlRHJpdmVyIG9iamVjdC5cbiAgc2VsZi5fZW5zdXJlUG9sbElzU2NoZWR1bGVkID0gdGhyb3R0bGUoXG4gICAgc2VsZi5fdW50aHJvdHRsZWRFbnN1cmVQb2xsSXNTY2hlZHVsZWQsXG4gICAgc2VsZi5fY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucy5wb2xsaW5nVGhyb3R0bGVNcyB8fCBQT0xMSU5HX1RIUk9UVExFX01TIC8qIG1zICovKTtcblxuICAvLyBYWFggZmlndXJlIG91dCBpZiB3ZSBzdGlsbCBuZWVkIGEgcXVldWVcbiAgc2VsZi5fdGFza1F1ZXVlID0gbmV3IE1ldGVvci5fQXN5bmNocm9ub3VzUXVldWUoKTtcblxuICBcbn07XG5cbl8uZXh0ZW5kKFBvbGxpbmdPYnNlcnZlRHJpdmVyLnByb3RvdHlwZSwge1xuICBfaW5pdDogYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBzZWxmLl9vcHRpb25zO1xuICAgIGNvbnN0IGxpc3RlbmVyc0hhbmRsZSA9IGF3YWl0IGxpc3RlbkFsbChcbiAgICAgIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLCBmdW5jdGlvbiAobm90aWZpY2F0aW9uKSB7XG4gICAgICAgIC8vIFdoZW4gc29tZW9uZSBkb2VzIGEgdHJhbnNhY3Rpb24gdGhhdCBtaWdodCBhZmZlY3QgdXMsIHNjaGVkdWxlIGEgcG9sbFxuICAgICAgICAvLyBvZiB0aGUgZGF0YWJhc2UuIElmIHRoYXQgdHJhbnNhY3Rpb24gaGFwcGVucyBpbnNpZGUgb2YgYSB3cml0ZSBmZW5jZSxcbiAgICAgICAgLy8gYmxvY2sgdGhlIGZlbmNlIHVudGlsIHdlJ3ZlIHBvbGxlZCBhbmQgbm90aWZpZWQgb2JzZXJ2ZXJzLlxuICAgICAgICBjb25zdCBmZW5jZSA9IEREUFNlcnZlci5fZ2V0Q3VycmVudEZlbmNlKCk7XG4gICAgICAgIGlmIChmZW5jZSlcbiAgICAgICAgICBzZWxmLl9wZW5kaW5nV3JpdGVzLnB1c2goZmVuY2UuYmVnaW5Xcml0ZSgpKTtcbiAgICAgICAgLy8gRW5zdXJlIGEgcG9sbCBpcyBzY2hlZHVsZWQuLi4gYnV0IGlmIHdlIGFscmVhZHkga25vdyB0aGF0IG9uZSBpcyxcbiAgICAgICAgLy8gZG9uJ3QgaGl0IHRoZSB0aHJvdHRsZWQgX2Vuc3VyZVBvbGxJc1NjaGVkdWxlZCBmdW5jdGlvbiAod2hpY2ggbWlnaHRcbiAgICAgICAgLy8gbGVhZCB0byB1cyBjYWxsaW5nIGl0IHVubmVjZXNzYXJpbHkgaW4gPHBvbGxpbmdUaHJvdHRsZU1zPiBtcykuXG4gICAgICAgIGlmIChzZWxmLl9wb2xsc1NjaGVkdWxlZEJ1dE5vdFN0YXJ0ZWQgPT09IDApXG4gICAgICAgICAgc2VsZi5fZW5zdXJlUG9sbElzU2NoZWR1bGVkKCk7XG4gICAgICB9XG4gICAgKTtcbiAgICBzZWxmLl9zdG9wQ2FsbGJhY2tzLnB1c2goYXN5bmMgZnVuY3Rpb24gKCkgeyBhd2FpdCBsaXN0ZW5lcnNIYW5kbGUuc3RvcCgpOyB9KTtcbiAgXG4gICAgLy8gZXZlcnkgb25jZSBhbmQgYSB3aGlsZSwgcG9sbCBldmVuIGlmIHdlIGRvbid0IHRoaW5rIHdlJ3JlIGRpcnR5LCBmb3JcbiAgICAvLyBldmVudHVhbCBjb25zaXN0ZW5jeSB3aXRoIGRhdGFiYXNlIHdyaXRlcyBmcm9tIG91dHNpZGUgdGhlIE1ldGVvclxuICAgIC8vIHVuaXZlcnNlLlxuICAgIC8vXG4gICAgLy8gRm9yIHRlc3RpbmcsIHRoZXJlJ3MgYW4gdW5kb2N1bWVudGVkIGNhbGxiYWNrIGFyZ3VtZW50IHRvIG9ic2VydmVDaGFuZ2VzXG4gICAgLy8gd2hpY2ggZGlzYWJsZXMgdGltZS1iYXNlZCBwb2xsaW5nIGFuZCBnZXRzIGNhbGxlZCBhdCB0aGUgYmVnaW5uaW5nIG9mIGVhY2hcbiAgICAvLyBwb2xsLlxuICAgIGlmIChvcHRpb25zLl90ZXN0T25seVBvbGxDYWxsYmFjaykge1xuICAgICAgc2VsZi5fdGVzdE9ubHlQb2xsQ2FsbGJhY2sgPSBvcHRpb25zLl90ZXN0T25seVBvbGxDYWxsYmFjaztcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgcG9sbGluZ0ludGVydmFsID1cbiAgICAgICAgICAgIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMucG9sbGluZ0ludGVydmFsTXMgfHxcbiAgICAgICAgICAgIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMuX3BvbGxpbmdJbnRlcnZhbCB8fCAvLyBDT01QQVQgd2l0aCAxLjJcbiAgICAgICAgICAgIFBPTExJTkdfSU5URVJWQUxfTVM7XG4gICAgICBjb25zdCBpbnRlcnZhbEhhbmRsZSA9IE1ldGVvci5zZXRJbnRlcnZhbChcbiAgICAgICAgc2VsZi5fZW5zdXJlUG9sbElzU2NoZWR1bGVkLmJpbmQoc2VsZiksIHBvbGxpbmdJbnRlcnZhbCk7XG4gICAgICBzZWxmLl9zdG9wQ2FsbGJhY2tzLnB1c2goZnVuY3Rpb24gKCkge1xuICAgICAgICBNZXRlb3IuY2xlYXJJbnRlcnZhbChpbnRlcnZhbEhhbmRsZSk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8gTWFrZSBzdXJlIHdlIGFjdHVhbGx5IHBvbGwgc29vbiFcbiAgICBhd2FpdCB0aGlzLl91bnRocm90dGxlZEVuc3VyZVBvbGxJc1NjaGVkdWxlZCgpO1xuXG4gICAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgICAgXCJtb25nby1saXZlZGF0YVwiLCBcIm9ic2VydmUtZHJpdmVycy1wb2xsaW5nXCIsIDEpO1xufSxcbi8vIFRoaXMgaXMgYWx3YXlzIGNhbGxlZCB0aHJvdWdoIF8udGhyb3R0bGUgKGV4Y2VwdCBvbmNlIGF0IHN0YXJ0dXApLlxuX3VudGhyb3R0bGVkRW5zdXJlUG9sbElzU2NoZWR1bGVkOiBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9wb2xsc1NjaGVkdWxlZEJ1dE5vdFN0YXJ0ZWQgPiAwKVxuICAgICAgcmV0dXJuO1xuICAgICsrc2VsZi5fcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkO1xuICAgIGF3YWl0IHNlbGYuX3Rhc2tRdWV1ZS5ydW5UYXNrKGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgIGF3YWl0IHNlbGYuX3BvbGxNb25nbygpO1xuICAgIH0pO1xuICB9LFxuXG4gIC8vIHRlc3Qtb25seSBpbnRlcmZhY2UgZm9yIGNvbnRyb2xsaW5nIHBvbGxpbmcuXG4gIC8vXG4gIC8vIF9zdXNwZW5kUG9sbGluZyBibG9ja3MgdW50aWwgYW55IGN1cnJlbnRseSBydW5uaW5nIGFuZCBzY2hlZHVsZWQgcG9sbHMgYXJlXG4gIC8vIGRvbmUsIGFuZCBwcmV2ZW50cyBhbnkgZnVydGhlciBwb2xscyBmcm9tIGJlaW5nIHNjaGVkdWxlZC4gKG5ld1xuICAvLyBPYnNlcnZlSGFuZGxlcyBjYW4gYmUgYWRkZWQgYW5kIHJlY2VpdmUgdGhlaXIgaW5pdGlhbCBhZGRlZCBjYWxsYmFja3MsXG4gIC8vIHRob3VnaC4pXG4gIC8vXG4gIC8vIF9yZXN1bWVQb2xsaW5nIGltbWVkaWF0ZWx5IHBvbGxzLCBhbmQgYWxsb3dzIGZ1cnRoZXIgcG9sbHMgdG8gb2NjdXIuXG4gIF9zdXNwZW5kUG9sbGluZzogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIC8vIFByZXRlbmQgdGhhdCB0aGVyZSdzIGFub3RoZXIgcG9sbCBzY2hlZHVsZWQgKHdoaWNoIHdpbGwgcHJldmVudFxuICAgIC8vIF9lbnN1cmVQb2xsSXNTY2hlZHVsZWQgZnJvbSBxdWV1ZWluZyBhbnkgbW9yZSBwb2xscykuXG4gICAgKytzZWxmLl9wb2xsc1NjaGVkdWxlZEJ1dE5vdFN0YXJ0ZWQ7XG4gICAgLy8gTm93IGJsb2NrIHVudGlsIGFsbCBjdXJyZW50bHkgcnVubmluZyBvciBzY2hlZHVsZWQgcG9sbHMgYXJlIGRvbmUuXG4gICAgc2VsZi5fdGFza1F1ZXVlLnJ1blRhc2soZnVuY3Rpb24oKSB7fSk7XG5cbiAgICAvLyBDb25maXJtIHRoYXQgdGhlcmUgaXMgb25seSBvbmUgXCJwb2xsXCIgKHRoZSBmYWtlIG9uZSB3ZSdyZSBwcmV0ZW5kaW5nIHRvXG4gICAgLy8gaGF2ZSkgc2NoZWR1bGVkLlxuICAgIGlmIChzZWxmLl9wb2xsc1NjaGVkdWxlZEJ1dE5vdFN0YXJ0ZWQgIT09IDEpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJfcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkIGlzIFwiICtcbiAgICAgICAgICAgICAgICAgICAgICBzZWxmLl9wb2xsc1NjaGVkdWxlZEJ1dE5vdFN0YXJ0ZWQpO1xuICB9LFxuICBfcmVzdW1lUG9sbGluZzogYXN5bmMgZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIC8vIFdlIHNob3VsZCBiZSBpbiB0aGUgc2FtZSBzdGF0ZSBhcyBpbiB0aGUgZW5kIG9mIF9zdXNwZW5kUG9sbGluZy5cbiAgICBpZiAoc2VsZi5fcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkICE9PSAxKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZCBpcyBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgc2VsZi5fcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkKTtcbiAgICAvLyBSdW4gYSBwb2xsIHN5bmNocm9ub3VzbHkgKHdoaWNoIHdpbGwgY291bnRlcmFjdCB0aGVcbiAgICAvLyArK19wb2xsc1NjaGVkdWxlZEJ1dE5vdFN0YXJ0ZWQgZnJvbSBfc3VzcGVuZFBvbGxpbmcpLlxuICAgIGF3YWl0IHNlbGYuX3Rhc2tRdWV1ZS5ydW5UYXNrKGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgIGF3YWl0IHNlbGYuX3BvbGxNb25nbygpO1xuICAgIH0pO1xuICB9LFxuXG4gIGFzeW5jIF9wb2xsTW9uZ28oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIC0tc2VsZi5fcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkO1xuXG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICByZXR1cm47XG5cbiAgICB2YXIgZmlyc3QgPSBmYWxzZTtcbiAgICB2YXIgbmV3UmVzdWx0cztcbiAgICB2YXIgb2xkUmVzdWx0cyA9IHNlbGYuX3Jlc3VsdHM7XG4gICAgaWYgKCFvbGRSZXN1bHRzKSB7XG4gICAgICBmaXJzdCA9IHRydWU7XG4gICAgICAvLyBYWFggbWF5YmUgdXNlIE9yZGVyZWREaWN0IGluc3RlYWQ/XG4gICAgICBvbGRSZXN1bHRzID0gc2VsZi5fb3JkZXJlZCA/IFtdIDogbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gICAgfVxuXG4gICAgc2VsZi5fdGVzdE9ubHlQb2xsQ2FsbGJhY2sgJiYgc2VsZi5fdGVzdE9ubHlQb2xsQ2FsbGJhY2soKTtcblxuICAgIC8vIFNhdmUgdGhlIGxpc3Qgb2YgcGVuZGluZyB3cml0ZXMgd2hpY2ggdGhpcyByb3VuZCB3aWxsIGNvbW1pdC5cbiAgICB2YXIgd3JpdGVzRm9yQ3ljbGUgPSBzZWxmLl9wZW5kaW5nV3JpdGVzO1xuICAgIHNlbGYuX3BlbmRpbmdXcml0ZXMgPSBbXTtcblxuICAgIC8vIEdldCB0aGUgbmV3IHF1ZXJ5IHJlc3VsdHMuIChUaGlzIHlpZWxkcy4pXG4gICAgdHJ5IHtcbiAgICAgIG5ld1Jlc3VsdHMgPSBhd2FpdCBzZWxmLl9jdXJzb3IuZ2V0UmF3T2JqZWN0cyhzZWxmLl9vcmRlcmVkKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZmlyc3QgJiYgdHlwZW9mKGUuY29kZSkgPT09ICdudW1iZXInKSB7XG4gICAgICAgIC8vIFRoaXMgaXMgYW4gZXJyb3IgZG9jdW1lbnQgc2VudCB0byB1cyBieSBtb25nb2QsIG5vdCBhIGNvbm5lY3Rpb25cbiAgICAgICAgLy8gZXJyb3IgZ2VuZXJhdGVkIGJ5IHRoZSBjbGllbnQuIEFuZCB3ZSd2ZSBuZXZlciBzZWVuIHRoaXMgcXVlcnkgd29ya1xuICAgICAgICAvLyBzdWNjZXNzZnVsbHkuIFByb2JhYmx5IGl0J3MgYSBiYWQgc2VsZWN0b3Igb3Igc29tZXRoaW5nLCBzbyB3ZSBzaG91bGRcbiAgICAgICAgLy8gTk9UIHJldHJ5LiBJbnN0ZWFkLCB3ZSBzaG91bGQgaGFsdCB0aGUgb2JzZXJ2ZSAod2hpY2ggZW5kcyB1cCBjYWxsaW5nXG4gICAgICAgIC8vIGBzdG9wYCBvbiB1cykuXG4gICAgICAgIGF3YWl0IHNlbGYuX211bHRpcGxleGVyLnF1ZXJ5RXJyb3IoXG4gICAgICAgICAgICBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgXCJFeGNlcHRpb24gd2hpbGUgcG9sbGluZyBxdWVyeSBcIiArXG4gICAgICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoc2VsZi5fY3Vyc29yRGVzY3JpcHRpb24pICsgXCI6IFwiICsgZS5tZXNzYWdlKSk7XG4gICAgICB9XG5cbiAgICAgIC8vIGdldFJhd09iamVjdHMgY2FuIHRocm93IGlmIHdlJ3JlIGhhdmluZyB0cm91YmxlIHRhbGtpbmcgdG8gdGhlXG4gICAgICAvLyBkYXRhYmFzZS4gIFRoYXQncyBmaW5lIC0tLSB3ZSB3aWxsIHJlcG9sbCBsYXRlciBhbnl3YXkuIEJ1dCB3ZSBzaG91bGRcbiAgICAgIC8vIG1ha2Ugc3VyZSBub3QgdG8gbG9zZSB0cmFjayBvZiB0aGlzIGN5Y2xlJ3Mgd3JpdGVzLlxuICAgICAgLy8gKEl0IGFsc28gY2FuIHRocm93IGlmIHRoZXJlJ3MganVzdCBzb21ldGhpbmcgaW52YWxpZCBhYm91dCB0aGlzIHF1ZXJ5O1xuICAgICAgLy8gdW5mb3J0dW5hdGVseSB0aGUgT2JzZXJ2ZURyaXZlciBBUEkgZG9lc24ndCBwcm92aWRlIGEgZ29vZCB3YXkgdG9cbiAgICAgIC8vIFwiY2FuY2VsXCIgdGhlIG9ic2VydmUgZnJvbSB0aGUgaW5zaWRlIGluIHRoaXMgY2FzZS5cbiAgICAgIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KHNlbGYuX3BlbmRpbmdXcml0ZXMsIHdyaXRlc0ZvckN5Y2xlKTtcbiAgICAgIE1ldGVvci5fZGVidWcoXCJFeGNlcHRpb24gd2hpbGUgcG9sbGluZyBxdWVyeSBcIiArXG4gICAgICAgICAgSlNPTi5zdHJpbmdpZnkoc2VsZi5fY3Vyc29yRGVzY3JpcHRpb24pLCBlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBSdW4gZGlmZnMuXG4gICAgaWYgKCFzZWxmLl9zdG9wcGVkKSB7XG4gICAgICBMb2NhbENvbGxlY3Rpb24uX2RpZmZRdWVyeUNoYW5nZXMoXG4gICAgICAgICAgc2VsZi5fb3JkZXJlZCwgb2xkUmVzdWx0cywgbmV3UmVzdWx0cywgc2VsZi5fbXVsdGlwbGV4ZXIpO1xuICAgIH1cblxuICAgIC8vIFNpZ25hbHMgdGhlIG11bHRpcGxleGVyIHRvIGFsbG93IGFsbCBvYnNlcnZlQ2hhbmdlcyBjYWxscyB0aGF0IHNoYXJlIHRoaXNcbiAgICAvLyBtdWx0aXBsZXhlciB0byByZXR1cm4uIChUaGlzIGhhcHBlbnMgYXN5bmNocm9ub3VzbHksIHZpYSB0aGVcbiAgICAvLyBtdWx0aXBsZXhlcidzIHF1ZXVlLilcbiAgICBpZiAoZmlyc3QpXG4gICAgICBzZWxmLl9tdWx0aXBsZXhlci5yZWFkeSgpO1xuXG4gICAgLy8gUmVwbGFjZSBzZWxmLl9yZXN1bHRzIGF0b21pY2FsbHkuICAoVGhpcyBhc3NpZ25tZW50IGlzIHdoYXQgbWFrZXMgYGZpcnN0YFxuICAgIC8vIHN0YXkgdGhyb3VnaCBvbiB0aGUgbmV4dCBjeWNsZSwgc28gd2UndmUgd2FpdGVkIHVudGlsIGFmdGVyIHdlJ3ZlXG4gICAgLy8gY29tbWl0dGVkIHRvIHJlYWR5LWluZyB0aGUgbXVsdGlwbGV4ZXIuKVxuICAgIHNlbGYuX3Jlc3VsdHMgPSBuZXdSZXN1bHRzO1xuXG4gICAgLy8gT25jZSB0aGUgT2JzZXJ2ZU11bHRpcGxleGVyIGhhcyBwcm9jZXNzZWQgZXZlcnl0aGluZyB3ZSd2ZSBkb25lIGluIHRoaXNcbiAgICAvLyByb3VuZCwgbWFyayBhbGwgdGhlIHdyaXRlcyB3aGljaCBleGlzdGVkIGJlZm9yZSB0aGlzIGNhbGwgYXNcbiAgICAvLyBjb21tbWl0dGVkLiAoSWYgbmV3IHdyaXRlcyBoYXZlIHNob3duIHVwIGluIHRoZSBtZWFudGltZSwgdGhlcmUnbGxcbiAgICAvLyBhbHJlYWR5IGJlIGFub3RoZXIgX3BvbGxNb25nbyB0YXNrIHNjaGVkdWxlZC4pXG4gICAgYXdhaXQgc2VsZi5fbXVsdGlwbGV4ZXIub25GbHVzaChhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICBmb3IgKGNvbnN0IHcgb2Ygd3JpdGVzRm9yQ3ljbGUpIHtcbiAgICAgICAgYXdhaXQgdy5jb21taXR0ZWQoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcblxuICBzdG9wOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuX3N0b3BwZWQgPSB0cnVlO1xuICAgIGNvbnN0IHN0b3BDYWxsYmFja3NDYWxsZXIgPSBhc3luYyBmdW5jdGlvbihjKSB7XG4gICAgICBhd2FpdCBjKCk7XG4gICAgfTtcblxuICAgIHNlbGYuX3N0b3BDYWxsYmFja3MuZm9yRWFjaChzdG9wQ2FsbGJhY2tzQ2FsbGVyKTtcbiAgICAvLyBSZWxlYXNlIGFueSB3cml0ZSBmZW5jZXMgdGhhdCBhcmUgd2FpdGluZyBvbiB1cy5cbiAgICBzZWxmLl9wZW5kaW5nV3JpdGVzLmZvckVhY2goYXN5bmMgZnVuY3Rpb24gKHcpIHtcbiAgICAgIGF3YWl0IHcuY29tbWl0dGVkKCk7XG4gICAgfSk7XG4gICAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgICAgXCJtb25nby1saXZlZGF0YVwiLCBcIm9ic2VydmUtZHJpdmVycy1wb2xsaW5nXCIsIC0xKTtcbiAgfVxufSk7IiwiaW1wb3J0IGhhcyBmcm9tICdsb2Rhc2guaGFzJztcbmltcG9ydCBpc0VtcHR5IGZyb20gJ2xvZGFzaC5pc2VtcHR5JztcbmltcG9ydCB7IG9wbG9nVjJWMUNvbnZlcnRlciB9IGZyb20gXCIuL29wbG9nX3YyX2NvbnZlcnRlclwiO1xuaW1wb3J0IHsgY2hlY2ssIE1hdGNoIH0gZnJvbSAnbWV0ZW9yL2NoZWNrJztcblxudmFyIFBIQVNFID0ge1xuICBRVUVSWUlORzogXCJRVUVSWUlOR1wiLFxuICBGRVRDSElORzogXCJGRVRDSElOR1wiLFxuICBTVEVBRFk6IFwiU1RFQURZXCJcbn07XG5cbi8vIEV4Y2VwdGlvbiB0aHJvd24gYnkgX25lZWRUb1BvbGxRdWVyeSB3aGljaCB1bnJvbGxzIHRoZSBzdGFjayB1cCB0byB0aGVcbi8vIGVuY2xvc2luZyBjYWxsIHRvIGZpbmlzaElmTmVlZFRvUG9sbFF1ZXJ5LlxudmFyIFN3aXRjaGVkVG9RdWVyeSA9IGZ1bmN0aW9uICgpIHt9O1xudmFyIGZpbmlzaElmTmVlZFRvUG9sbFF1ZXJ5ID0gZnVuY3Rpb24gKGYpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICB0cnkge1xuICAgICAgZi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmICghKGUgaW5zdGFuY2VvZiBTd2l0Y2hlZFRvUXVlcnkpKVxuICAgICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfTtcbn07XG5cbnZhciBjdXJyZW50SWQgPSAwO1xuXG4vLyBPcGxvZ09ic2VydmVEcml2ZXIgaXMgYW4gYWx0ZXJuYXRpdmUgdG8gUG9sbGluZ09ic2VydmVEcml2ZXIgd2hpY2ggZm9sbG93c1xuLy8gdGhlIE1vbmdvIG9wZXJhdGlvbiBsb2cgaW5zdGVhZCBvZiBqdXN0IHJlLXBvbGxpbmcgdGhlIHF1ZXJ5LiBJdCBvYmV5cyB0aGVcbi8vIHNhbWUgc2ltcGxlIGludGVyZmFjZTogY29uc3RydWN0aW5nIGl0IHN0YXJ0cyBzZW5kaW5nIG9ic2VydmVDaGFuZ2VzXG4vLyBjYWxsYmFja3MgKGFuZCBhIHJlYWR5KCkgaW52b2NhdGlvbikgdG8gdGhlIE9ic2VydmVNdWx0aXBsZXhlciwgYW5kIHlvdSBzdG9wXG4vLyBpdCBieSBjYWxsaW5nIHRoZSBzdG9wKCkgbWV0aG9kLlxuT3Bsb2dPYnNlcnZlRHJpdmVyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gIHNlbGYuX3VzZXNPcGxvZyA9IHRydWU7ICAvLyB0ZXN0cyBsb29rIGF0IHRoaXNcblxuICBzZWxmLl9pZCA9IGN1cnJlbnRJZDtcbiAgY3VycmVudElkKys7XG5cbiAgc2VsZi5fY3Vyc29yRGVzY3JpcHRpb24gPSBvcHRpb25zLmN1cnNvckRlc2NyaXB0aW9uO1xuICBzZWxmLl9tb25nb0hhbmRsZSA9IG9wdGlvbnMubW9uZ29IYW5kbGU7XG4gIHNlbGYuX211bHRpcGxleGVyID0gb3B0aW9ucy5tdWx0aXBsZXhlcjtcblxuICBpZiAob3B0aW9ucy5vcmRlcmVkKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJPcGxvZ09ic2VydmVEcml2ZXIgb25seSBzdXBwb3J0cyB1bm9yZGVyZWQgb2JzZXJ2ZUNoYW5nZXNcIik7XG4gIH1cblxuICBjb25zdCBzb3J0ZXIgPSBvcHRpb25zLnNvcnRlcjtcbiAgLy8gV2UgZG9uJ3Qgc3VwcG9ydCAkbmVhciBhbmQgb3RoZXIgZ2VvLXF1ZXJpZXMgc28gaXQncyBPSyB0byBpbml0aWFsaXplIHRoZVxuICAvLyBjb21wYXJhdG9yIG9ubHkgb25jZSBpbiB0aGUgY29uc3RydWN0b3IuXG4gIGNvbnN0IGNvbXBhcmF0b3IgPSBzb3J0ZXIgJiYgc29ydGVyLmdldENvbXBhcmF0b3IoKTtcblxuICBpZiAob3B0aW9ucy5jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLmxpbWl0KSB7XG4gICAgLy8gVGhlcmUgYXJlIHNldmVyYWwgcHJvcGVydGllcyBvcmRlcmVkIGRyaXZlciBpbXBsZW1lbnRzOlxuICAgIC8vIC0gX2xpbWl0IGlzIGEgcG9zaXRpdmUgbnVtYmVyXG4gICAgLy8gLSBfY29tcGFyYXRvciBpcyBhIGZ1bmN0aW9uLWNvbXBhcmF0b3IgYnkgd2hpY2ggdGhlIHF1ZXJ5IGlzIG9yZGVyZWRcbiAgICAvLyAtIF91bnB1Ymxpc2hlZEJ1ZmZlciBpcyBub24tbnVsbCBNaW4vTWF4IEhlYXAsXG4gICAgLy8gICAgICAgICAgICAgICAgICAgICAgdGhlIGVtcHR5IGJ1ZmZlciBpbiBTVEVBRFkgcGhhc2UgaW1wbGllcyB0aGF0IHRoZVxuICAgIC8vICAgICAgICAgICAgICAgICAgICAgIGV2ZXJ5dGhpbmcgdGhhdCBtYXRjaGVzIHRoZSBxdWVyaWVzIHNlbGVjdG9yIGZpdHNcbiAgICAvLyAgICAgICAgICAgICAgICAgICAgICBpbnRvIHB1Ymxpc2hlZCBzZXQuXG4gICAgLy8gLSBfcHVibGlzaGVkIC0gTWF4IEhlYXAgKGFsc28gaW1wbGVtZW50cyBJZE1hcCBtZXRob2RzKVxuXG4gICAgY29uc3QgaGVhcE9wdGlvbnMgPSB7IElkTWFwOiBMb2NhbENvbGxlY3Rpb24uX0lkTWFwIH07XG4gICAgc2VsZi5fbGltaXQgPSBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLmxpbWl0O1xuICAgIHNlbGYuX2NvbXBhcmF0b3IgPSBjb21wYXJhdG9yO1xuICAgIHNlbGYuX3NvcnRlciA9IHNvcnRlcjtcbiAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlciA9IG5ldyBNaW5NYXhIZWFwKGNvbXBhcmF0b3IsIGhlYXBPcHRpb25zKTtcbiAgICAvLyBXZSBuZWVkIHNvbWV0aGluZyB0aGF0IGNhbiBmaW5kIE1heCB2YWx1ZSBpbiBhZGRpdGlvbiB0byBJZE1hcCBpbnRlcmZhY2VcbiAgICBzZWxmLl9wdWJsaXNoZWQgPSBuZXcgTWF4SGVhcChjb21wYXJhdG9yLCBoZWFwT3B0aW9ucyk7XG4gIH0gZWxzZSB7XG4gICAgc2VsZi5fbGltaXQgPSAwO1xuICAgIHNlbGYuX2NvbXBhcmF0b3IgPSBudWxsO1xuICAgIHNlbGYuX3NvcnRlciA9IG51bGw7XG4gICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIgPSBudWxsO1xuICAgIHNlbGYuX3B1Ymxpc2hlZCA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuICB9XG5cbiAgLy8gSW5kaWNhdGVzIGlmIGl0IGlzIHNhZmUgdG8gaW5zZXJ0IGEgbmV3IGRvY3VtZW50IGF0IHRoZSBlbmQgb2YgdGhlIGJ1ZmZlclxuICAvLyBmb3IgdGhpcyBxdWVyeS4gaS5lLiBpdCBpcyBrbm93biB0aGF0IHRoZXJlIGFyZSBubyBkb2N1bWVudHMgbWF0Y2hpbmcgdGhlXG4gIC8vIHNlbGVjdG9yIHRob3NlIGFyZSBub3QgaW4gcHVibGlzaGVkIG9yIGJ1ZmZlci5cbiAgc2VsZi5fc2FmZUFwcGVuZFRvQnVmZmVyID0gZmFsc2U7XG5cbiAgc2VsZi5fc3RvcHBlZCA9IGZhbHNlO1xuICBzZWxmLl9zdG9wSGFuZGxlcyA9IFtdO1xuICBzZWxmLl9hZGRTdG9wSGFuZGxlcyA9IGZ1bmN0aW9uIChuZXdTdG9wSGFuZGxlcykge1xuICAgIGNvbnN0IGV4cGVjdGVkUGF0dGVybiA9IE1hdGNoLk9iamVjdEluY2x1ZGluZyh7IHN0b3A6IEZ1bmN0aW9uIH0pO1xuICAgIC8vIFNpbmdsZSBpdGVtIG9yIGFycmF5XG4gICAgY2hlY2sobmV3U3RvcEhhbmRsZXMsIE1hdGNoLk9uZU9mKFtleHBlY3RlZFBhdHRlcm5dLCBleHBlY3RlZFBhdHRlcm4pKTtcbiAgICBzZWxmLl9zdG9wSGFuZGxlcy5wdXNoKG5ld1N0b3BIYW5kbGVzKTtcbiAgfVxuXG4gIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICBcIm1vbmdvLWxpdmVkYXRhXCIsIFwib2JzZXJ2ZS1kcml2ZXJzLW9wbG9nXCIsIDEpO1xuXG4gIHNlbGYuX3JlZ2lzdGVyUGhhc2VDaGFuZ2UoUEhBU0UuUVVFUllJTkcpO1xuXG4gIHNlbGYuX21hdGNoZXIgPSBvcHRpb25zLm1hdGNoZXI7XG4gIC8vIHdlIGFyZSBub3cgdXNpbmcgcHJvamVjdGlvbiwgbm90IGZpZWxkcyBpbiB0aGUgY3Vyc29yIGRlc2NyaXB0aW9uIGV2ZW4gaWYgeW91IHBhc3Mge2ZpZWxkc31cbiAgLy8gaW4gdGhlIGN1cnNvciBjb25zdHJ1Y3Rpb25cbiAgY29uc3QgcHJvamVjdGlvbiA9IHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMuZmllbGRzIHx8IHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMucHJvamVjdGlvbiB8fCB7fTtcbiAgc2VsZi5fcHJvamVjdGlvbkZuID0gTG9jYWxDb2xsZWN0aW9uLl9jb21waWxlUHJvamVjdGlvbihwcm9qZWN0aW9uKTtcbiAgLy8gUHJvamVjdGlvbiBmdW5jdGlvbiwgcmVzdWx0IG9mIGNvbWJpbmluZyBpbXBvcnRhbnQgZmllbGRzIGZvciBzZWxlY3RvciBhbmRcbiAgLy8gZXhpc3RpbmcgZmllbGRzIHByb2plY3Rpb25cbiAgc2VsZi5fc2hhcmVkUHJvamVjdGlvbiA9IHNlbGYuX21hdGNoZXIuY29tYmluZUludG9Qcm9qZWN0aW9uKHByb2plY3Rpb24pO1xuICBpZiAoc29ydGVyKVxuICAgIHNlbGYuX3NoYXJlZFByb2plY3Rpb24gPSBzb3J0ZXIuY29tYmluZUludG9Qcm9qZWN0aW9uKHNlbGYuX3NoYXJlZFByb2plY3Rpb24pO1xuICBzZWxmLl9zaGFyZWRQcm9qZWN0aW9uRm4gPSBMb2NhbENvbGxlY3Rpb24uX2NvbXBpbGVQcm9qZWN0aW9uKFxuICAgIHNlbGYuX3NoYXJlZFByb2plY3Rpb24pO1xuXG4gIHNlbGYuX25lZWRUb0ZldGNoID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gIHNlbGYuX2N1cnJlbnRseUZldGNoaW5nID0gbnVsbDtcbiAgc2VsZi5fZmV0Y2hHZW5lcmF0aW9uID0gMDtcblxuICBzZWxmLl9yZXF1ZXJ5V2hlbkRvbmVUaGlzUXVlcnkgPSBmYWxzZTtcbiAgc2VsZi5fd3JpdGVzVG9Db21taXRXaGVuV2VSZWFjaFN0ZWFkeSA9IFtdO1xuXG5cblxuIH07XG5cbl8uZXh0ZW5kKE9wbG9nT2JzZXJ2ZURyaXZlci5wcm90b3R5cGUsIHtcbiAgX2luaXQ6IGFzeW5jIGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gSWYgdGhlIG9wbG9nIGhhbmRsZSB0ZWxscyB1cyB0aGF0IGl0IHNraXBwZWQgc29tZSBlbnRyaWVzIChiZWNhdXNlIGl0IGdvdFxuICAgIC8vIGJlaGluZCwgc2F5KSwgcmUtcG9sbC5cbiAgICBzZWxmLl9hZGRTdG9wSGFuZGxlcyhzZWxmLl9tb25nb0hhbmRsZS5fb3Bsb2dIYW5kbGUub25Ta2lwcGVkRW50cmllcyhcbiAgICAgIGZpbmlzaElmTmVlZFRvUG9sbFF1ZXJ5KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYuX25lZWRUb1BvbGxRdWVyeSgpO1xuICAgICAgfSlcbiAgICApKTtcbiAgICBcbiAgICBhd2FpdCBmb3JFYWNoVHJpZ2dlcihzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbiwgYXN5bmMgZnVuY3Rpb24gKHRyaWdnZXIpIHtcbiAgICAgIHNlbGYuX2FkZFN0b3BIYW5kbGVzKGF3YWl0IHNlbGYuX21vbmdvSGFuZGxlLl9vcGxvZ0hhbmRsZS5vbk9wbG9nRW50cnkoXG4gICAgICAgIHRyaWdnZXIsIGZ1bmN0aW9uIChub3RpZmljYXRpb24pIHtcbiAgICAgICAgICBmaW5pc2hJZk5lZWRUb1BvbGxRdWVyeShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBjb25zdCBvcCA9IG5vdGlmaWNhdGlvbi5vcDtcbiAgICAgICAgICAgIGlmIChub3RpZmljYXRpb24uZHJvcENvbGxlY3Rpb24gfHwgbm90aWZpY2F0aW9uLmRyb3BEYXRhYmFzZSkge1xuICAgICAgICAgICAgICAvLyBOb3RlOiB0aGlzIGNhbGwgaXMgbm90IGFsbG93ZWQgdG8gYmxvY2sgb24gYW55dGhpbmcgKGVzcGVjaWFsbHlcbiAgICAgICAgICAgICAgLy8gb24gd2FpdGluZyBmb3Igb3Bsb2cgZW50cmllcyB0byBjYXRjaCB1cCkgYmVjYXVzZSB0aGF0IHdpbGwgYmxvY2tcbiAgICAgICAgICAgICAgLy8gb25PcGxvZ0VudHJ5IVxuICAgICAgICAgICAgICByZXR1cm4gc2VsZi5fbmVlZFRvUG9sbFF1ZXJ5KCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBBbGwgb3RoZXIgb3BlcmF0b3JzIHNob3VsZCBiZSBoYW5kbGVkIGRlcGVuZGluZyBvbiBwaGFzZVxuICAgICAgICAgICAgICBpZiAoc2VsZi5fcGhhc2UgPT09IFBIQVNFLlFVRVJZSU5HKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuX2hhbmRsZU9wbG9nRW50cnlRdWVyeWluZyhvcCk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuX2hhbmRsZU9wbG9nRW50cnlTdGVhZHlPckZldGNoaW5nKG9wKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pKCk7XG4gICAgICAgIH1cbiAgICAgICkpO1xuICAgIH0pO1xuICBcbiAgICAvLyBYWFggb3JkZXJpbmcgdy5yLnQuIGV2ZXJ5dGhpbmcgZWxzZT9cbiAgICBzZWxmLl9hZGRTdG9wSGFuZGxlcyhhd2FpdCBsaXN0ZW5BbGwoXG4gICAgICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbiwgZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBJZiB3ZSdyZSBub3QgaW4gYSBwcmUtZmlyZSB3cml0ZSBmZW5jZSwgd2UgZG9uJ3QgaGF2ZSB0byBkbyBhbnl0aGluZy5cbiAgICAgICAgY29uc3QgZmVuY2UgPSBERFBTZXJ2ZXIuX2dldEN1cnJlbnRGZW5jZSgpO1xuICAgICAgICBpZiAoIWZlbmNlIHx8IGZlbmNlLmZpcmVkKVxuICAgICAgICAgIHJldHVybjtcbiAgXG4gICAgICAgIGlmIChmZW5jZS5fb3Bsb2dPYnNlcnZlRHJpdmVycykge1xuICAgICAgICAgIGZlbmNlLl9vcGxvZ09ic2VydmVEcml2ZXJzW3NlbGYuX2lkXSA9IHNlbGY7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gIFxuICAgICAgICBmZW5jZS5fb3Bsb2dPYnNlcnZlRHJpdmVycyA9IHt9O1xuICAgICAgICBmZW5jZS5fb3Bsb2dPYnNlcnZlRHJpdmVyc1tzZWxmLl9pZF0gPSBzZWxmO1xuICBcbiAgICAgICAgZmVuY2Uub25CZWZvcmVGaXJlKGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBjb25zdCBkcml2ZXJzID0gZmVuY2UuX29wbG9nT2JzZXJ2ZURyaXZlcnM7XG4gICAgICAgICAgZGVsZXRlIGZlbmNlLl9vcGxvZ09ic2VydmVEcml2ZXJzO1xuICBcbiAgICAgICAgICAvLyBUaGlzIGZlbmNlIGNhbm5vdCBmaXJlIHVudGlsIHdlJ3ZlIGNhdWdodCB1cCB0byBcInRoaXMgcG9pbnRcIiBpbiB0aGVcbiAgICAgICAgICAvLyBvcGxvZywgYW5kIGFsbCBvYnNlcnZlcnMgbWFkZSBpdCBiYWNrIHRvIHRoZSBzdGVhZHkgc3RhdGUuXG4gICAgICAgICAgYXdhaXQgc2VsZi5fbW9uZ29IYW5kbGUuX29wbG9nSGFuZGxlLndhaXRVbnRpbENhdWdodFVwKCk7XG4gIFxuICAgICAgICAgIGZvciAoY29uc3QgZHJpdmVyIG9mIE9iamVjdC52YWx1ZXMoZHJpdmVycykpIHtcbiAgICAgICAgICAgIGlmIChkcml2ZXIuX3N0b3BwZWQpXG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICBcbiAgICAgICAgICAgIGNvbnN0IHdyaXRlID0gYXdhaXQgZmVuY2UuYmVnaW5Xcml0ZSgpO1xuICAgICAgICAgICAgaWYgKGRyaXZlci5fcGhhc2UgPT09IFBIQVNFLlNURUFEWSkge1xuICAgICAgICAgICAgICAvLyBNYWtlIHN1cmUgdGhhdCBhbGwgb2YgdGhlIGNhbGxiYWNrcyBoYXZlIG1hZGUgaXQgdGhyb3VnaCB0aGVcbiAgICAgICAgICAgICAgLy8gbXVsdGlwbGV4ZXIgYW5kIGJlZW4gZGVsaXZlcmVkIHRvIE9ic2VydmVIYW5kbGVzIGJlZm9yZSBjb21taXR0aW5nXG4gICAgICAgICAgICAgIC8vIHdyaXRlcy5cbiAgICAgICAgICAgICAgYXdhaXQgZHJpdmVyLl9tdWx0aXBsZXhlci5vbkZsdXNoKHdyaXRlLmNvbW1pdHRlZCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBkcml2ZXIuX3dyaXRlc1RvQ29tbWl0V2hlbldlUmVhY2hTdGVhZHkucHVzaCh3cml0ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICApKTtcbiAgXG4gICAgLy8gV2hlbiBNb25nbyBmYWlscyBvdmVyLCB3ZSBuZWVkIHRvIHJlcG9sbCB0aGUgcXVlcnksIGluIGNhc2Ugd2UgcHJvY2Vzc2VkIGFuXG4gICAgLy8gb3Bsb2cgZW50cnkgdGhhdCBnb3Qgcm9sbGVkIGJhY2suXG4gICAgc2VsZi5fYWRkU3RvcEhhbmRsZXMoc2VsZi5fbW9uZ29IYW5kbGUuX29uRmFpbG92ZXIoZmluaXNoSWZOZWVkVG9Qb2xsUXVlcnkoXG4gICAgICBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBzZWxmLl9uZWVkVG9Qb2xsUXVlcnkoKTtcbiAgICAgIH0pKSk7XG4gIFxuICAgIC8vIEdpdmUgX29ic2VydmVDaGFuZ2VzIGEgY2hhbmNlIHRvIGFkZCB0aGUgbmV3IE9ic2VydmVIYW5kbGUgdG8gb3VyXG4gICAgLy8gbXVsdGlwbGV4ZXIsIHNvIHRoYXQgdGhlIGFkZGVkIGNhbGxzIGdldCBzdHJlYW1lZC5cbiAgICByZXR1cm4gc2VsZi5fcnVuSW5pdGlhbFF1ZXJ5KCk7XG4gIH0sXG4gIF9hZGRQdWJsaXNoZWQ6IGZ1bmN0aW9uIChpZCwgZG9jKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBmaWVsZHMgPSBPYmplY3QuYXNzaWduKHt9LCBkb2MpO1xuICAgICAgZGVsZXRlIGZpZWxkcy5faWQ7XG4gICAgICBzZWxmLl9wdWJsaXNoZWQuc2V0KGlkLCBzZWxmLl9zaGFyZWRQcm9qZWN0aW9uRm4oZG9jKSk7XG4gICAgICBzZWxmLl9tdWx0aXBsZXhlci5hZGRlZChpZCwgc2VsZi5fcHJvamVjdGlvbkZuKGZpZWxkcykpO1xuXG4gICAgICAvLyBBZnRlciBhZGRpbmcgdGhpcyBkb2N1bWVudCwgdGhlIHB1Ymxpc2hlZCBzZXQgbWlnaHQgYmUgb3ZlcmZsb3dlZFxuICAgICAgLy8gKGV4Y2VlZGluZyBjYXBhY2l0eSBzcGVjaWZpZWQgYnkgbGltaXQpLiBJZiBzbywgcHVzaCB0aGUgbWF4aW11bVxuICAgICAgLy8gZWxlbWVudCB0byB0aGUgYnVmZmVyLCB3ZSBtaWdodCB3YW50IHRvIHNhdmUgaXQgaW4gbWVtb3J5IHRvIHJlZHVjZSB0aGVcbiAgICAgIC8vIGFtb3VudCBvZiBNb25nbyBsb29rdXBzIGluIHRoZSBmdXR1cmUuXG4gICAgICBpZiAoc2VsZi5fbGltaXQgJiYgc2VsZi5fcHVibGlzaGVkLnNpemUoKSA+IHNlbGYuX2xpbWl0KSB7XG4gICAgICAgIC8vIFhYWCBpbiB0aGVvcnkgdGhlIHNpemUgb2YgcHVibGlzaGVkIGlzIG5vIG1vcmUgdGhhbiBsaW1pdCsxXG4gICAgICAgIGlmIChzZWxmLl9wdWJsaXNoZWQuc2l6ZSgpICE9PSBzZWxmLl9saW1pdCArIDEpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJBZnRlciBhZGRpbmcgdG8gcHVibGlzaGVkLCBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICAgIChzZWxmLl9wdWJsaXNoZWQuc2l6ZSgpIC0gc2VsZi5fbGltaXQpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXCIgZG9jdW1lbnRzIGFyZSBvdmVyZmxvd2luZyB0aGUgc2V0XCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG92ZXJmbG93aW5nRG9jSWQgPSBzZWxmLl9wdWJsaXNoZWQubWF4RWxlbWVudElkKCk7XG4gICAgICAgIHZhciBvdmVyZmxvd2luZ0RvYyA9IHNlbGYuX3B1Ymxpc2hlZC5nZXQob3ZlcmZsb3dpbmdEb2NJZCk7XG5cbiAgICAgICAgaWYgKEVKU09OLmVxdWFscyhvdmVyZmxvd2luZ0RvY0lkLCBpZCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgZG9jdW1lbnQganVzdCBhZGRlZCBpcyBvdmVyZmxvd2luZyB0aGUgcHVibGlzaGVkIHNldFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNlbGYuX3B1Ymxpc2hlZC5yZW1vdmUob3ZlcmZsb3dpbmdEb2NJZCk7XG4gICAgICAgIHNlbGYuX211bHRpcGxleGVyLnJlbW92ZWQob3ZlcmZsb3dpbmdEb2NJZCk7XG4gICAgICAgIHNlbGYuX2FkZEJ1ZmZlcmVkKG92ZXJmbG93aW5nRG9jSWQsIG92ZXJmbG93aW5nRG9jKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcbiAgX3JlbW92ZVB1Ymxpc2hlZDogZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuX3B1Ymxpc2hlZC5yZW1vdmUoaWQpO1xuICAgICAgc2VsZi5fbXVsdGlwbGV4ZXIucmVtb3ZlZChpZCk7XG4gICAgICBpZiAoISBzZWxmLl9saW1pdCB8fCBzZWxmLl9wdWJsaXNoZWQuc2l6ZSgpID09PSBzZWxmLl9saW1pdClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBpZiAoc2VsZi5fcHVibGlzaGVkLnNpemUoKSA+IHNlbGYuX2xpbWl0KVxuICAgICAgICB0aHJvdyBFcnJvcihcInNlbGYuX3B1Ymxpc2hlZCBnb3QgdG9vIGJpZ1wiKTtcblxuICAgICAgLy8gT0ssIHdlIGFyZSBwdWJsaXNoaW5nIGxlc3MgdGhhbiB0aGUgbGltaXQuIE1heWJlIHdlIHNob3VsZCBsb29rIGluIHRoZVxuICAgICAgLy8gYnVmZmVyIHRvIGZpbmQgdGhlIG5leHQgZWxlbWVudCBwYXN0IHdoYXQgd2Ugd2VyZSBwdWJsaXNoaW5nIGJlZm9yZS5cblxuICAgICAgaWYgKCFzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5lbXB0eSgpKSB7XG4gICAgICAgIC8vIFRoZXJlJ3Mgc29tZXRoaW5nIGluIHRoZSBidWZmZXI7IG1vdmUgdGhlIGZpcnN0IHRoaW5nIGluIGl0IHRvXG4gICAgICAgIC8vIF9wdWJsaXNoZWQuXG4gICAgICAgIHZhciBuZXdEb2NJZCA9IHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLm1pbkVsZW1lbnRJZCgpO1xuICAgICAgICB2YXIgbmV3RG9jID0gc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuZ2V0KG5ld0RvY0lkKTtcbiAgICAgICAgc2VsZi5fcmVtb3ZlQnVmZmVyZWQobmV3RG9jSWQpO1xuICAgICAgICBzZWxmLl9hZGRQdWJsaXNoZWQobmV3RG9jSWQsIG5ld0RvYyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gVGhlcmUncyBub3RoaW5nIGluIHRoZSBidWZmZXIuICBUaGlzIGNvdWxkIG1lYW4gb25lIG9mIGEgZmV3IHRoaW5ncy5cblxuICAgICAgLy8gKGEpIFdlIGNvdWxkIGJlIGluIHRoZSBtaWRkbGUgb2YgcmUtcnVubmluZyB0aGUgcXVlcnkgKHNwZWNpZmljYWxseSwgd2VcbiAgICAgIC8vIGNvdWxkIGJlIGluIF9wdWJsaXNoTmV3UmVzdWx0cykuIEluIHRoYXQgY2FzZSwgX3VucHVibGlzaGVkQnVmZmVyIGlzXG4gICAgICAvLyBlbXB0eSBiZWNhdXNlIHdlIGNsZWFyIGl0IGF0IHRoZSBiZWdpbm5pbmcgb2YgX3B1Ymxpc2hOZXdSZXN1bHRzLiBJblxuICAgICAgLy8gdGhpcyBjYXNlLCBvdXIgY2FsbGVyIGFscmVhZHkga25vd3MgdGhlIGVudGlyZSBhbnN3ZXIgdG8gdGhlIHF1ZXJ5IGFuZFxuICAgICAgLy8gd2UgZG9uJ3QgbmVlZCB0byBkbyBhbnl0aGluZyBmYW5jeSBoZXJlLiAgSnVzdCByZXR1cm4uXG4gICAgICBpZiAoc2VsZi5fcGhhc2UgPT09IFBIQVNFLlFVRVJZSU5HKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIC8vIChiKSBXZSdyZSBwcmV0dHkgY29uZmlkZW50IHRoYXQgdGhlIHVuaW9uIG9mIF9wdWJsaXNoZWQgYW5kXG4gICAgICAvLyBfdW5wdWJsaXNoZWRCdWZmZXIgY29udGFpbiBhbGwgZG9jdW1lbnRzIHRoYXQgbWF0Y2ggc2VsZWN0b3IuIEJlY2F1c2VcbiAgICAgIC8vIF91bnB1Ymxpc2hlZEJ1ZmZlciBpcyBlbXB0eSwgdGhhdCBtZWFucyB3ZSdyZSBjb25maWRlbnQgdGhhdCBfcHVibGlzaGVkXG4gICAgICAvLyBjb250YWlucyBhbGwgZG9jdW1lbnRzIHRoYXQgbWF0Y2ggc2VsZWN0b3IuIFNvIHdlIGhhdmUgbm90aGluZyB0byBkby5cbiAgICAgIGlmIChzZWxmLl9zYWZlQXBwZW5kVG9CdWZmZXIpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgLy8gKGMpIE1heWJlIHRoZXJlIGFyZSBvdGhlciBkb2N1bWVudHMgb3V0IHRoZXJlIHRoYXQgc2hvdWxkIGJlIGluIG91clxuICAgICAgLy8gYnVmZmVyLiBCdXQgaW4gdGhhdCBjYXNlLCB3aGVuIHdlIGVtcHRpZWQgX3VucHVibGlzaGVkQnVmZmVyIGluXG4gICAgICAvLyBfcmVtb3ZlQnVmZmVyZWQsIHdlIHNob3VsZCBoYXZlIGNhbGxlZCBfbmVlZFRvUG9sbFF1ZXJ5LCB3aGljaCB3aWxsXG4gICAgICAvLyBlaXRoZXIgcHV0IHNvbWV0aGluZyBpbiBfdW5wdWJsaXNoZWRCdWZmZXIgb3Igc2V0IF9zYWZlQXBwZW5kVG9CdWZmZXJcbiAgICAgIC8vIChvciBib3RoKSwgYW5kIGl0IHdpbGwgcHV0IHVzIGluIFFVRVJZSU5HIGZvciB0aGF0IHdob2xlIHRpbWUuIFNvIGluXG4gICAgICAvLyBmYWN0LCB3ZSBzaG91bGRuJ3QgYmUgYWJsZSB0byBnZXQgaGVyZS5cblxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQnVmZmVyIGluZXhwbGljYWJseSBlbXB0eVwiKTtcbiAgICB9KTtcbiAgfSxcbiAgX2NoYW5nZVB1Ymxpc2hlZDogZnVuY3Rpb24gKGlkLCBvbGREb2MsIG5ld0RvYykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLl9wdWJsaXNoZWQuc2V0KGlkLCBzZWxmLl9zaGFyZWRQcm9qZWN0aW9uRm4obmV3RG9jKSk7XG4gICAgICB2YXIgcHJvamVjdGVkTmV3ID0gc2VsZi5fcHJvamVjdGlvbkZuKG5ld0RvYyk7XG4gICAgICB2YXIgcHJvamVjdGVkT2xkID0gc2VsZi5fcHJvamVjdGlvbkZuKG9sZERvYyk7XG4gICAgICB2YXIgY2hhbmdlZCA9IERpZmZTZXF1ZW5jZS5tYWtlQ2hhbmdlZEZpZWxkcyhcbiAgICAgICAgcHJvamVjdGVkTmV3LCBwcm9qZWN0ZWRPbGQpO1xuICAgICAgaWYgKCFpc0VtcHR5KGNoYW5nZWQpKVxuICAgICAgICBzZWxmLl9tdWx0aXBsZXhlci5jaGFuZ2VkKGlkLCBjaGFuZ2VkKTtcbiAgICB9KTtcbiAgfSxcbiAgX2FkZEJ1ZmZlcmVkOiBmdW5jdGlvbiAoaWQsIGRvYykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5zZXQoaWQsIHNlbGYuX3NoYXJlZFByb2plY3Rpb25Gbihkb2MpKTtcblxuICAgICAgLy8gSWYgc29tZXRoaW5nIGlzIG92ZXJmbG93aW5nIHRoZSBidWZmZXIsIHdlIGp1c3QgcmVtb3ZlIGl0IGZyb20gY2FjaGVcbiAgICAgIGlmIChzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5zaXplKCkgPiBzZWxmLl9saW1pdCkge1xuICAgICAgICB2YXIgbWF4QnVmZmVyZWRJZCA9IHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLm1heEVsZW1lbnRJZCgpO1xuXG4gICAgICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLnJlbW92ZShtYXhCdWZmZXJlZElkKTtcblxuICAgICAgICAvLyBTaW5jZSBzb21ldGhpbmcgbWF0Y2hpbmcgaXMgcmVtb3ZlZCBmcm9tIGNhY2hlIChib3RoIHB1Ymxpc2hlZCBzZXQgYW5kXG4gICAgICAgIC8vIGJ1ZmZlciksIHNldCBmbGFnIHRvIGZhbHNlXG4gICAgICAgIHNlbGYuX3NhZmVBcHBlbmRUb0J1ZmZlciA9IGZhbHNlO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICAvLyBJcyBjYWxsZWQgZWl0aGVyIHRvIHJlbW92ZSB0aGUgZG9jIGNvbXBsZXRlbHkgZnJvbSBtYXRjaGluZyBzZXQgb3IgdG8gbW92ZVxuICAvLyBpdCB0byB0aGUgcHVibGlzaGVkIHNldCBsYXRlci5cbiAgX3JlbW92ZUJ1ZmZlcmVkOiBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIucmVtb3ZlKGlkKTtcbiAgICAgIC8vIFRvIGtlZXAgdGhlIGNvbnRyYWN0IFwiYnVmZmVyIGlzIG5ldmVyIGVtcHR5IGluIFNURUFEWSBwaGFzZSB1bmxlc3MgdGhlXG4gICAgICAvLyBldmVyeXRoaW5nIG1hdGNoaW5nIGZpdHMgaW50byBwdWJsaXNoZWRcIiB0cnVlLCB3ZSBwb2xsIGV2ZXJ5dGhpbmcgYXNcbiAgICAgIC8vIHNvb24gYXMgd2Ugc2VlIHRoZSBidWZmZXIgYmVjb21pbmcgZW1wdHkuXG4gICAgICBpZiAoISBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5zaXplKCkgJiYgISBzZWxmLl9zYWZlQXBwZW5kVG9CdWZmZXIpXG4gICAgICAgIHNlbGYuX25lZWRUb1BvbGxRdWVyeSgpO1xuICAgIH0pO1xuICB9LFxuICAvLyBDYWxsZWQgd2hlbiBhIGRvY3VtZW50IGhhcyBqb2luZWQgdGhlIFwiTWF0Y2hpbmdcIiByZXN1bHRzIHNldC5cbiAgLy8gVGFrZXMgcmVzcG9uc2liaWxpdHkgb2Yga2VlcGluZyBfdW5wdWJsaXNoZWRCdWZmZXIgaW4gc3luYyB3aXRoIF9wdWJsaXNoZWRcbiAgLy8gYW5kIHRoZSBlZmZlY3Qgb2YgbGltaXQgZW5mb3JjZWQuXG4gIF9hZGRNYXRjaGluZzogZnVuY3Rpb24gKGRvYykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgaWQgPSBkb2MuX2lkO1xuICAgICAgaWYgKHNlbGYuX3B1Ymxpc2hlZC5oYXMoaWQpKVxuICAgICAgICB0aHJvdyBFcnJvcihcInRyaWVkIHRvIGFkZCBzb21ldGhpbmcgYWxyZWFkeSBwdWJsaXNoZWQgXCIgKyBpZCk7XG4gICAgICBpZiAoc2VsZi5fbGltaXQgJiYgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuaGFzKGlkKSlcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJ0cmllZCB0byBhZGQgc29tZXRoaW5nIGFscmVhZHkgZXhpc3RlZCBpbiBidWZmZXIgXCIgKyBpZCk7XG5cbiAgICAgIHZhciBsaW1pdCA9IHNlbGYuX2xpbWl0O1xuICAgICAgdmFyIGNvbXBhcmF0b3IgPSBzZWxmLl9jb21wYXJhdG9yO1xuICAgICAgdmFyIG1heFB1Ymxpc2hlZCA9IChsaW1pdCAmJiBzZWxmLl9wdWJsaXNoZWQuc2l6ZSgpID4gMCkgP1xuICAgICAgICBzZWxmLl9wdWJsaXNoZWQuZ2V0KHNlbGYuX3B1Ymxpc2hlZC5tYXhFbGVtZW50SWQoKSkgOiBudWxsO1xuICAgICAgdmFyIG1heEJ1ZmZlcmVkID0gKGxpbWl0ICYmIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLnNpemUoKSA+IDApXG4gICAgICAgID8gc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuZ2V0KHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLm1heEVsZW1lbnRJZCgpKVxuICAgICAgICA6IG51bGw7XG4gICAgICAvLyBUaGUgcXVlcnkgaXMgdW5saW1pdGVkIG9yIGRpZG4ndCBwdWJsaXNoIGVub3VnaCBkb2N1bWVudHMgeWV0IG9yIHRoZVxuICAgICAgLy8gbmV3IGRvY3VtZW50IHdvdWxkIGZpdCBpbnRvIHB1Ymxpc2hlZCBzZXQgcHVzaGluZyB0aGUgbWF4aW11bSBlbGVtZW50XG4gICAgICAvLyBvdXQsIHRoZW4gd2UgbmVlZCB0byBwdWJsaXNoIHRoZSBkb2MuXG4gICAgICB2YXIgdG9QdWJsaXNoID0gISBsaW1pdCB8fCBzZWxmLl9wdWJsaXNoZWQuc2l6ZSgpIDwgbGltaXQgfHxcbiAgICAgICAgY29tcGFyYXRvcihkb2MsIG1heFB1Ymxpc2hlZCkgPCAwO1xuXG4gICAgICAvLyBPdGhlcndpc2Ugd2UgbWlnaHQgbmVlZCB0byBidWZmZXIgaXQgKG9ubHkgaW4gY2FzZSBvZiBsaW1pdGVkIHF1ZXJ5KS5cbiAgICAgIC8vIEJ1ZmZlcmluZyBpcyBhbGxvd2VkIGlmIHRoZSBidWZmZXIgaXMgbm90IGZpbGxlZCB1cCB5ZXQgYW5kIGFsbFxuICAgICAgLy8gbWF0Y2hpbmcgZG9jcyBhcmUgZWl0aGVyIGluIHRoZSBwdWJsaXNoZWQgc2V0IG9yIGluIHRoZSBidWZmZXIuXG4gICAgICB2YXIgY2FuQXBwZW5kVG9CdWZmZXIgPSAhdG9QdWJsaXNoICYmIHNlbGYuX3NhZmVBcHBlbmRUb0J1ZmZlciAmJlxuICAgICAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5zaXplKCkgPCBsaW1pdDtcblxuICAgICAgLy8gT3IgaWYgaXQgaXMgc21hbGwgZW5vdWdoIHRvIGJlIHNhZmVseSBpbnNlcnRlZCB0byB0aGUgbWlkZGxlIG9yIHRoZVxuICAgICAgLy8gYmVnaW5uaW5nIG9mIHRoZSBidWZmZXIuXG4gICAgICB2YXIgY2FuSW5zZXJ0SW50b0J1ZmZlciA9ICF0b1B1Ymxpc2ggJiYgbWF4QnVmZmVyZWQgJiZcbiAgICAgICAgY29tcGFyYXRvcihkb2MsIG1heEJ1ZmZlcmVkKSA8PSAwO1xuXG4gICAgICB2YXIgdG9CdWZmZXIgPSBjYW5BcHBlbmRUb0J1ZmZlciB8fCBjYW5JbnNlcnRJbnRvQnVmZmVyO1xuXG4gICAgICBpZiAodG9QdWJsaXNoKSB7XG4gICAgICAgIHNlbGYuX2FkZFB1Ymxpc2hlZChpZCwgZG9jKTtcbiAgICAgIH0gZWxzZSBpZiAodG9CdWZmZXIpIHtcbiAgICAgICAgc2VsZi5fYWRkQnVmZmVyZWQoaWQsIGRvYyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBkcm9wcGluZyBpdCBhbmQgbm90IHNhdmluZyB0byB0aGUgY2FjaGVcbiAgICAgICAgc2VsZi5fc2FmZUFwcGVuZFRvQnVmZmVyID0gZmFsc2U7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG4gIC8vIENhbGxlZCB3aGVuIGEgZG9jdW1lbnQgbGVhdmVzIHRoZSBcIk1hdGNoaW5nXCIgcmVzdWx0cyBzZXQuXG4gIC8vIFRha2VzIHJlc3BvbnNpYmlsaXR5IG9mIGtlZXBpbmcgX3VucHVibGlzaGVkQnVmZmVyIGluIHN5bmMgd2l0aCBfcHVibGlzaGVkXG4gIC8vIGFuZCB0aGUgZWZmZWN0IG9mIGxpbWl0IGVuZm9yY2VkLlxuICBfcmVtb3ZlTWF0Y2hpbmc6IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoISBzZWxmLl9wdWJsaXNoZWQuaGFzKGlkKSAmJiAhIHNlbGYuX2xpbWl0KVxuICAgICAgICB0aHJvdyBFcnJvcihcInRyaWVkIHRvIHJlbW92ZSBzb21ldGhpbmcgbWF0Y2hpbmcgYnV0IG5vdCBjYWNoZWQgXCIgKyBpZCk7XG5cbiAgICAgIGlmIChzZWxmLl9wdWJsaXNoZWQuaGFzKGlkKSkge1xuICAgICAgICBzZWxmLl9yZW1vdmVQdWJsaXNoZWQoaWQpO1xuICAgICAgfSBlbHNlIGlmIChzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5oYXMoaWQpKSB7XG4gICAgICAgIHNlbGYuX3JlbW92ZUJ1ZmZlcmVkKGlkKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcbiAgX2hhbmRsZURvYzogZnVuY3Rpb24gKGlkLCBuZXdEb2MpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIG1hdGNoZXNOb3cgPSBuZXdEb2MgJiYgc2VsZi5fbWF0Y2hlci5kb2N1bWVudE1hdGNoZXMobmV3RG9jKS5yZXN1bHQ7XG5cbiAgICAgIHZhciBwdWJsaXNoZWRCZWZvcmUgPSBzZWxmLl9wdWJsaXNoZWQuaGFzKGlkKTtcbiAgICAgIHZhciBidWZmZXJlZEJlZm9yZSA9IHNlbGYuX2xpbWl0ICYmIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLmhhcyhpZCk7XG4gICAgICB2YXIgY2FjaGVkQmVmb3JlID0gcHVibGlzaGVkQmVmb3JlIHx8IGJ1ZmZlcmVkQmVmb3JlO1xuXG4gICAgICBpZiAobWF0Y2hlc05vdyAmJiAhY2FjaGVkQmVmb3JlKSB7XG4gICAgICAgIHNlbGYuX2FkZE1hdGNoaW5nKG5ld0RvYyk7XG4gICAgICB9IGVsc2UgaWYgKGNhY2hlZEJlZm9yZSAmJiAhbWF0Y2hlc05vdykge1xuICAgICAgICBzZWxmLl9yZW1vdmVNYXRjaGluZyhpZCk7XG4gICAgICB9IGVsc2UgaWYgKGNhY2hlZEJlZm9yZSAmJiBtYXRjaGVzTm93KSB7XG4gICAgICAgIHZhciBvbGREb2MgPSBzZWxmLl9wdWJsaXNoZWQuZ2V0KGlkKTtcbiAgICAgICAgdmFyIGNvbXBhcmF0b3IgPSBzZWxmLl9jb21wYXJhdG9yO1xuICAgICAgICB2YXIgbWluQnVmZmVyZWQgPSBzZWxmLl9saW1pdCAmJiBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5zaXplKCkgJiZcbiAgICAgICAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5nZXQoc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIubWluRWxlbWVudElkKCkpO1xuICAgICAgICB2YXIgbWF4QnVmZmVyZWQ7XG5cbiAgICAgICAgaWYgKHB1Ymxpc2hlZEJlZm9yZSkge1xuICAgICAgICAgIC8vIFVubGltaXRlZCBjYXNlIHdoZXJlIHRoZSBkb2N1bWVudCBzdGF5cyBpbiBwdWJsaXNoZWQgb25jZSBpdFxuICAgICAgICAgIC8vIG1hdGNoZXMgb3IgdGhlIGNhc2Ugd2hlbiB3ZSBkb24ndCBoYXZlIGVub3VnaCBtYXRjaGluZyBkb2NzIHRvXG4gICAgICAgICAgLy8gcHVibGlzaCBvciB0aGUgY2hhbmdlZCBidXQgbWF0Y2hpbmcgZG9jIHdpbGwgc3RheSBpbiBwdWJsaXNoZWRcbiAgICAgICAgICAvLyBhbnl3YXlzLlxuICAgICAgICAgIC8vXG4gICAgICAgICAgLy8gWFhYOiBXZSByZWx5IG9uIHRoZSBlbXB0aW5lc3Mgb2YgYnVmZmVyLiBCZSBzdXJlIHRvIG1haW50YWluIHRoZVxuICAgICAgICAgIC8vIGZhY3QgdGhhdCBidWZmZXIgY2FuJ3QgYmUgZW1wdHkgaWYgdGhlcmUgYXJlIG1hdGNoaW5nIGRvY3VtZW50cyBub3RcbiAgICAgICAgICAvLyBwdWJsaXNoZWQuIE5vdGFibHksIHdlIGRvbid0IHdhbnQgdG8gc2NoZWR1bGUgcmVwb2xsIGFuZCBjb250aW51ZVxuICAgICAgICAgIC8vIHJlbHlpbmcgb24gdGhpcyBwcm9wZXJ0eS5cbiAgICAgICAgICB2YXIgc3RheXNJblB1Ymxpc2hlZCA9ICEgc2VsZi5fbGltaXQgfHxcbiAgICAgICAgICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLnNpemUoKSA9PT0gMCB8fFxuICAgICAgICAgICAgY29tcGFyYXRvcihuZXdEb2MsIG1pbkJ1ZmZlcmVkKSA8PSAwO1xuXG4gICAgICAgICAgaWYgKHN0YXlzSW5QdWJsaXNoZWQpIHtcbiAgICAgICAgICAgIHNlbGYuX2NoYW5nZVB1Ymxpc2hlZChpZCwgb2xkRG9jLCBuZXdEb2MpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBhZnRlciB0aGUgY2hhbmdlIGRvYyBkb2Vzbid0IHN0YXkgaW4gdGhlIHB1Ymxpc2hlZCwgcmVtb3ZlIGl0XG4gICAgICAgICAgICBzZWxmLl9yZW1vdmVQdWJsaXNoZWQoaWQpO1xuICAgICAgICAgICAgLy8gYnV0IGl0IGNhbiBtb3ZlIGludG8gYnVmZmVyZWQgbm93LCBjaGVjayBpdFxuICAgICAgICAgICAgbWF4QnVmZmVyZWQgPSBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5nZXQoXG4gICAgICAgICAgICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLm1heEVsZW1lbnRJZCgpKTtcblxuICAgICAgICAgICAgdmFyIHRvQnVmZmVyID0gc2VsZi5fc2FmZUFwcGVuZFRvQnVmZmVyIHx8XG4gICAgICAgICAgICAgICAgICAobWF4QnVmZmVyZWQgJiYgY29tcGFyYXRvcihuZXdEb2MsIG1heEJ1ZmZlcmVkKSA8PSAwKTtcblxuICAgICAgICAgICAgaWYgKHRvQnVmZmVyKSB7XG4gICAgICAgICAgICAgIHNlbGYuX2FkZEJ1ZmZlcmVkKGlkLCBuZXdEb2MpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gVGhyb3cgYXdheSBmcm9tIGJvdGggcHVibGlzaGVkIHNldCBhbmQgYnVmZmVyXG4gICAgICAgICAgICAgIHNlbGYuX3NhZmVBcHBlbmRUb0J1ZmZlciA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChidWZmZXJlZEJlZm9yZSkge1xuICAgICAgICAgIG9sZERvYyA9IHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLmdldChpZCk7XG4gICAgICAgICAgLy8gcmVtb3ZlIHRoZSBvbGQgdmVyc2lvbiBtYW51YWxseSBpbnN0ZWFkIG9mIHVzaW5nIF9yZW1vdmVCdWZmZXJlZCBzb1xuICAgICAgICAgIC8vIHdlIGRvbid0IHRyaWdnZXIgdGhlIHF1ZXJ5aW5nIGltbWVkaWF0ZWx5LiAgaWYgd2UgZW5kIHRoaXMgYmxvY2tcbiAgICAgICAgICAvLyB3aXRoIHRoZSBidWZmZXIgZW1wdHksIHdlIHdpbGwgbmVlZCB0byB0cmlnZ2VyIHRoZSBxdWVyeSBwb2xsXG4gICAgICAgICAgLy8gbWFudWFsbHkgdG9vLlxuICAgICAgICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLnJlbW92ZShpZCk7XG5cbiAgICAgICAgICB2YXIgbWF4UHVibGlzaGVkID0gc2VsZi5fcHVibGlzaGVkLmdldChcbiAgICAgICAgICAgIHNlbGYuX3B1Ymxpc2hlZC5tYXhFbGVtZW50SWQoKSk7XG4gICAgICAgICAgbWF4QnVmZmVyZWQgPSBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5zaXplKCkgJiZcbiAgICAgICAgICAgICAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5nZXQoXG4gICAgICAgICAgICAgICAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5tYXhFbGVtZW50SWQoKSk7XG5cbiAgICAgICAgICAvLyB0aGUgYnVmZmVyZWQgZG9jIHdhcyB1cGRhdGVkLCBpdCBjb3VsZCBtb3ZlIHRvIHB1Ymxpc2hlZFxuICAgICAgICAgIHZhciB0b1B1Ymxpc2ggPSBjb21wYXJhdG9yKG5ld0RvYywgbWF4UHVibGlzaGVkKSA8IDA7XG5cbiAgICAgICAgICAvLyBvciBzdGF5cyBpbiBidWZmZXIgZXZlbiBhZnRlciB0aGUgY2hhbmdlXG4gICAgICAgICAgdmFyIHN0YXlzSW5CdWZmZXIgPSAoISB0b1B1Ymxpc2ggJiYgc2VsZi5fc2FmZUFwcGVuZFRvQnVmZmVyKSB8fFxuICAgICAgICAgICAgICAgICghdG9QdWJsaXNoICYmIG1heEJ1ZmZlcmVkICYmXG4gICAgICAgICAgICAgICAgIGNvbXBhcmF0b3IobmV3RG9jLCBtYXhCdWZmZXJlZCkgPD0gMCk7XG5cbiAgICAgICAgICBpZiAodG9QdWJsaXNoKSB7XG4gICAgICAgICAgICBzZWxmLl9hZGRQdWJsaXNoZWQoaWQsIG5ld0RvYyk7XG4gICAgICAgICAgfSBlbHNlIGlmIChzdGF5c0luQnVmZmVyKSB7XG4gICAgICAgICAgICAvLyBzdGF5cyBpbiBidWZmZXIgYnV0IGNoYW5nZXNcbiAgICAgICAgICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLnNldChpZCwgbmV3RG9jKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVGhyb3cgYXdheSBmcm9tIGJvdGggcHVibGlzaGVkIHNldCBhbmQgYnVmZmVyXG4gICAgICAgICAgICBzZWxmLl9zYWZlQXBwZW5kVG9CdWZmZXIgPSBmYWxzZTtcbiAgICAgICAgICAgIC8vIE5vcm1hbGx5IHRoaXMgY2hlY2sgd291bGQgaGF2ZSBiZWVuIGRvbmUgaW4gX3JlbW92ZUJ1ZmZlcmVkIGJ1dFxuICAgICAgICAgICAgLy8gd2UgZGlkbid0IHVzZSBpdCwgc28gd2UgbmVlZCB0byBkbyBpdCBvdXJzZWxmIG5vdy5cbiAgICAgICAgICAgIGlmICghIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLnNpemUoKSkge1xuICAgICAgICAgICAgICBzZWxmLl9uZWVkVG9Qb2xsUXVlcnkoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiY2FjaGVkQmVmb3JlIGltcGxpZXMgZWl0aGVyIG9mIHB1Ymxpc2hlZEJlZm9yZSBvciBidWZmZXJlZEJlZm9yZSBpcyB0cnVlLlwiKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICBfZmV0Y2hNb2RpZmllZERvY3VtZW50czogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLl9yZWdpc3RlclBoYXNlQ2hhbmdlKFBIQVNFLkZFVENISU5HKTtcbiAgICAvLyBEZWZlciwgYmVjYXVzZSBub3RoaW5nIGNhbGxlZCBmcm9tIHRoZSBvcGxvZyBlbnRyeSBoYW5kbGVyIG1heSB5aWVsZCxcbiAgICAvLyBidXQgZmV0Y2goKSB5aWVsZHMuXG4gICAgTWV0ZW9yLmRlZmVyKGZpbmlzaElmTmVlZFRvUG9sbFF1ZXJ5KGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgIHdoaWxlICghc2VsZi5fc3RvcHBlZCAmJiAhc2VsZi5fbmVlZFRvRmV0Y2guZW1wdHkoKSkge1xuICAgICAgICBpZiAoc2VsZi5fcGhhc2UgPT09IFBIQVNFLlFVRVJZSU5HKSB7XG4gICAgICAgICAgLy8gV2hpbGUgZmV0Y2hpbmcsIHdlIGRlY2lkZWQgdG8gZ28gaW50byBRVUVSWUlORyBtb2RlLCBhbmQgdGhlbiB3ZVxuICAgICAgICAgIC8vIHNhdyBhbm90aGVyIG9wbG9nIGVudHJ5LCBzbyBfbmVlZFRvRmV0Y2ggaXMgbm90IGVtcHR5LiBCdXQgd2VcbiAgICAgICAgICAvLyBzaG91bGRuJ3QgZmV0Y2ggdGhlc2UgZG9jdW1lbnRzIHVudGlsIEFGVEVSIHRoZSBxdWVyeSBpcyBkb25lLlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQmVpbmcgaW4gc3RlYWR5IHBoYXNlIGhlcmUgd291bGQgYmUgc3VycHJpc2luZy5cbiAgICAgICAgaWYgKHNlbGYuX3BoYXNlICE9PSBQSEFTRS5GRVRDSElORylcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJwaGFzZSBpbiBmZXRjaE1vZGlmaWVkRG9jdW1lbnRzOiBcIiArIHNlbGYuX3BoYXNlKTtcblxuICAgICAgICBzZWxmLl9jdXJyZW50bHlGZXRjaGluZyA9IHNlbGYuX25lZWRUb0ZldGNoO1xuICAgICAgICB2YXIgdGhpc0dlbmVyYXRpb24gPSArK3NlbGYuX2ZldGNoR2VuZXJhdGlvbjtcbiAgICAgICAgc2VsZi5fbmVlZFRvRmV0Y2ggPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcbiAgICAgICAgdmFyIHdhaXRpbmcgPSAwO1xuXG4gICAgICAgIGxldCBwcm9taXNlUmVzb2x2ZXIgPSBudWxsO1xuICAgICAgICBjb25zdCBhd2FpdGFibGVQcm9taXNlID0gbmV3IFByb21pc2UociA9PiBwcm9taXNlUmVzb2x2ZXIgPSByKTtcbiAgICAgICAgLy8gVGhpcyBsb29wIGlzIHNhZmUsIGJlY2F1c2UgX2N1cnJlbnRseUZldGNoaW5nIHdpbGwgbm90IGJlIHVwZGF0ZWRcbiAgICAgICAgLy8gZHVyaW5nIHRoaXMgbG9vcCAoaW4gZmFjdCwgaXQgaXMgbmV2ZXIgbXV0YXRlZCkuXG4gICAgICAgIGF3YWl0IHNlbGYuX2N1cnJlbnRseUZldGNoaW5nLmZvckVhY2hBc3luYyhhc3luYyBmdW5jdGlvbiAob3AsIGlkKSB7XG4gICAgICAgICAgd2FpdGluZysrO1xuICAgICAgICAgIGF3YWl0IHNlbGYuX21vbmdvSGFuZGxlLl9kb2NGZXRjaGVyLmZldGNoKFxuICAgICAgICAgICAgc2VsZi5fY3Vyc29yRGVzY3JpcHRpb24uY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICBpZCxcbiAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgZmluaXNoSWZOZWVkVG9Qb2xsUXVlcnkoZnVuY3Rpb24oZXJyLCBkb2MpIHtcbiAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIE1ldGVvci5fZGVidWcoJ0dvdCBleGNlcHRpb24gd2hpbGUgZmV0Y2hpbmcgZG9jdW1lbnRzJywgZXJyKTtcbiAgICAgICAgICAgICAgICAvLyBJZiB3ZSBnZXQgYW4gZXJyb3IgZnJvbSB0aGUgZmV0Y2hlciAoZWcsIHRyb3VibGVcbiAgICAgICAgICAgICAgICAvLyBjb25uZWN0aW5nIHRvIE1vbmdvKSwgbGV0J3MganVzdCBhYmFuZG9uIHRoZSBmZXRjaCBwaGFzZVxuICAgICAgICAgICAgICAgIC8vIGFsdG9nZXRoZXIgYW5kIGZhbGwgYmFjayB0byBwb2xsaW5nLiBJdCdzIG5vdCBsaWtlIHdlJ3JlXG4gICAgICAgICAgICAgICAgLy8gZ2V0dGluZyBsaXZlIHVwZGF0ZXMgYW55d2F5LlxuICAgICAgICAgICAgICAgIGlmIChzZWxmLl9waGFzZSAhPT0gUEhBU0UuUVVFUllJTkcpIHtcbiAgICAgICAgICAgICAgICAgIHNlbGYuX25lZWRUb1BvbGxRdWVyeSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB3YWl0aW5nLS07XG4gICAgICAgICAgICAgICAgLy8gQmVjYXVzZSBmZXRjaCgpIG5ldmVyIGNhbGxzIGl0cyBjYWxsYmFjayBzeW5jaHJvbm91c2x5LFxuICAgICAgICAgICAgICAgIC8vIHRoaXMgaXMgc2FmZSAoaWUsIHdlIHdvbid0IGNhbGwgZnV0LnJldHVybigpIGJlZm9yZSB0aGVcbiAgICAgICAgICAgICAgICAvLyBmb3JFYWNoIGlzIGRvbmUpLlxuICAgICAgICAgICAgICAgIGlmICh3YWl0aW5nID09PSAwKSBwcm9taXNlUmVzb2x2ZXIoKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICFzZWxmLl9zdG9wcGVkICYmXG4gICAgICAgICAgICAgICAgICBzZWxmLl9waGFzZSA9PT0gUEhBU0UuRkVUQ0hJTkcgJiZcbiAgICAgICAgICAgICAgICAgIHNlbGYuX2ZldGNoR2VuZXJhdGlvbiA9PT0gdGhpc0dlbmVyYXRpb25cbiAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgIC8vIFdlIHJlLWNoZWNrIHRoZSBnZW5lcmF0aW9uIGluIGNhc2Ugd2UndmUgaGFkIGFuIGV4cGxpY2l0XG4gICAgICAgICAgICAgICAgICAvLyBfcG9sbFF1ZXJ5IGNhbGwgKGVnLCBpbiBhbm90aGVyIGZpYmVyKSB3aGljaCBzaG91bGRcbiAgICAgICAgICAgICAgICAgIC8vIGVmZmVjdGl2ZWx5IGNhbmNlbCB0aGlzIHJvdW5kIG9mIGZldGNoZXMuICAoX3BvbGxRdWVyeVxuICAgICAgICAgICAgICAgICAgLy8gaW5jcmVtZW50cyB0aGUgZ2VuZXJhdGlvbi4pXG5cbiAgICAgICAgICAgICAgICAgIHNlbGYuX2hhbmRsZURvYyhpZCwgZG9jKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICAgICAgd2FpdGluZy0tO1xuICAgICAgICAgICAgICAgIC8vIEJlY2F1c2UgZmV0Y2goKSBuZXZlciBjYWxscyBpdHMgY2FsbGJhY2sgc3luY2hyb25vdXNseSxcbiAgICAgICAgICAgICAgICAvLyB0aGlzIGlzIHNhZmUgKGllLCB3ZSB3b24ndCBjYWxsIGZ1dC5yZXR1cm4oKSBiZWZvcmUgdGhlXG4gICAgICAgICAgICAgICAgLy8gZm9yRWFjaCBpcyBkb25lKS5cbiAgICAgICAgICAgICAgICBpZiAod2FpdGluZyA9PT0gMCkgcHJvbWlzZVJlc29sdmVyKCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGF3YWl0IGF3YWl0YWJsZVByb21pc2U7XG4gICAgICAgIC8vIEV4aXQgbm93IGlmIHdlJ3ZlIGhhZCBhIF9wb2xsUXVlcnkgY2FsbCAoaGVyZSBvciBpbiBhbm90aGVyIGZpYmVyKS5cbiAgICAgICAgaWYgKHNlbGYuX3BoYXNlID09PSBQSEFTRS5RVUVSWUlORylcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIHNlbGYuX2N1cnJlbnRseUZldGNoaW5nID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIC8vIFdlJ3JlIGRvbmUgZmV0Y2hpbmcsIHNvIHdlIGNhbiBiZSBzdGVhZHksIHVubGVzcyB3ZSd2ZSBoYWQgYVxuICAgICAgLy8gX3BvbGxRdWVyeSBjYWxsIChoZXJlIG9yIGluIGFub3RoZXIgZmliZXIpLlxuICAgICAgaWYgKHNlbGYuX3BoYXNlICE9PSBQSEFTRS5RVUVSWUlORylcbiAgICAgICAgYXdhaXQgc2VsZi5fYmVTdGVhZHkoKTtcbiAgICB9KSk7XG4gIH0sXG4gIF9iZVN0ZWFkeTogYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLl9yZWdpc3RlclBoYXNlQ2hhbmdlKFBIQVNFLlNURUFEWSk7XG4gICAgdmFyIHdyaXRlcyA9IHNlbGYuX3dyaXRlc1RvQ29tbWl0V2hlbldlUmVhY2hTdGVhZHkgfHwgW107XG4gICAgc2VsZi5fd3JpdGVzVG9Db21taXRXaGVuV2VSZWFjaFN0ZWFkeSA9IFtdO1xuICAgIGF3YWl0IHNlbGYuX211bHRpcGxleGVyLm9uRmx1c2goYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgZm9yIChjb25zdCB3IG9mIHdyaXRlcykge1xuICAgICAgICAgIGF3YWl0IHcuY29tbWl0dGVkKCk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIl9iZVN0ZWFkeSBlcnJvclwiLCB7d3JpdGVzfSwgZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG4gIF9oYW5kbGVPcGxvZ0VudHJ5UXVlcnlpbmc6IGZ1bmN0aW9uIChvcCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLl9uZWVkVG9GZXRjaC5zZXQoaWRGb3JPcChvcCksIG9wKTtcbiAgICB9KTtcbiAgfSxcbiAgX2hhbmRsZU9wbG9nRW50cnlTdGVhZHlPckZldGNoaW5nOiBmdW5jdGlvbiAob3ApIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGlkID0gaWRGb3JPcChvcCk7XG4gICAgICAvLyBJZiB3ZSdyZSBhbHJlYWR5IGZldGNoaW5nIHRoaXMgb25lLCBvciBhYm91dCB0bywgd2UgY2FuJ3Qgb3B0aW1pemU7XG4gICAgICAvLyBtYWtlIHN1cmUgdGhhdCB3ZSBmZXRjaCBpdCBhZ2FpbiBpZiBuZWNlc3NhcnkuXG5cbiAgICAgIGlmIChzZWxmLl9waGFzZSA9PT0gUEhBU0UuRkVUQ0hJTkcgJiZcbiAgICAgICAgICAoKHNlbGYuX2N1cnJlbnRseUZldGNoaW5nICYmIHNlbGYuX2N1cnJlbnRseUZldGNoaW5nLmhhcyhpZCkpIHx8XG4gICAgICAgICAgIHNlbGYuX25lZWRUb0ZldGNoLmhhcyhpZCkpKSB7XG4gICAgICAgIHNlbGYuX25lZWRUb0ZldGNoLnNldChpZCwgb3ApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChvcC5vcCA9PT0gJ2QnKSB7XG4gICAgICAgIGlmIChzZWxmLl9wdWJsaXNoZWQuaGFzKGlkKSB8fFxuICAgICAgICAgICAgKHNlbGYuX2xpbWl0ICYmIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLmhhcyhpZCkpKVxuICAgICAgICAgIHNlbGYuX3JlbW92ZU1hdGNoaW5nKGlkKTtcbiAgICAgIH0gZWxzZSBpZiAob3Aub3AgPT09ICdpJykge1xuICAgICAgICBpZiAoc2VsZi5fcHVibGlzaGVkLmhhcyhpZCkpXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaW5zZXJ0IGZvdW5kIGZvciBhbHJlYWR5LWV4aXN0aW5nIElEIGluIHB1Ymxpc2hlZFwiKTtcbiAgICAgICAgaWYgKHNlbGYuX3VucHVibGlzaGVkQnVmZmVyICYmIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLmhhcyhpZCkpXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaW5zZXJ0IGZvdW5kIGZvciBhbHJlYWR5LWV4aXN0aW5nIElEIGluIGJ1ZmZlclwiKTtcblxuICAgICAgICAvLyBYWFggd2hhdCBpZiBzZWxlY3RvciB5aWVsZHM/ICBmb3Igbm93IGl0IGNhbid0IGJ1dCBsYXRlciBpdCBjb3VsZFxuICAgICAgICAvLyBoYXZlICR3aGVyZVxuICAgICAgICBpZiAoc2VsZi5fbWF0Y2hlci5kb2N1bWVudE1hdGNoZXMob3AubykucmVzdWx0KVxuICAgICAgICAgIHNlbGYuX2FkZE1hdGNoaW5nKG9wLm8pO1xuICAgICAgfSBlbHNlIGlmIChvcC5vcCA9PT0gJ3UnKSB7XG4gICAgICAgIC8vIHdlIGFyZSBtYXBwaW5nIHRoZSBuZXcgb3Bsb2cgZm9ybWF0IG9uIG1vbmdvIDVcbiAgICAgICAgLy8gdG8gd2hhdCB3ZSBrbm93IGJldHRlciwgJHNldFxuICAgICAgICBvcC5vID0gb3Bsb2dWMlYxQ29udmVydGVyKG9wLm8pXG4gICAgICAgIC8vIElzIHRoaXMgYSBtb2RpZmllciAoJHNldC8kdW5zZXQsIHdoaWNoIG1heSByZXF1aXJlIHVzIHRvIHBvbGwgdGhlXG4gICAgICAgIC8vIGRhdGFiYXNlIHRvIGZpZ3VyZSBvdXQgaWYgdGhlIHdob2xlIGRvY3VtZW50IG1hdGNoZXMgdGhlIHNlbGVjdG9yKSBvclxuICAgICAgICAvLyBhIHJlcGxhY2VtZW50IChpbiB3aGljaCBjYXNlIHdlIGNhbiBqdXN0IGRpcmVjdGx5IHJlLWV2YWx1YXRlIHRoZVxuICAgICAgICAvLyBzZWxlY3Rvcik/XG4gICAgICAgIC8vIG9wbG9nIGZvcm1hdCBoYXMgY2hhbmdlZCBvbiBtb25nb2RiIDUsIHdlIGhhdmUgdG8gc3VwcG9ydCBib3RoIG5vd1xuICAgICAgICAvLyBkaWZmIGlzIHRoZSBmb3JtYXQgaW4gTW9uZ28gNSsgKG9wbG9nIHYyKVxuICAgICAgICB2YXIgaXNSZXBsYWNlID0gIWhhcyhvcC5vLCAnJHNldCcpICYmICFoYXMob3AubywgJ2RpZmYnKSAmJiAhaGFzKG9wLm8sICckdW5zZXQnKTtcbiAgICAgICAgLy8gSWYgdGhpcyBtb2RpZmllciBtb2RpZmllcyBzb21ldGhpbmcgaW5zaWRlIGFuIEVKU09OIGN1c3RvbSB0eXBlIChpZSxcbiAgICAgICAgLy8gYW55dGhpbmcgd2l0aCBFSlNPTiQpLCB0aGVuIHdlIGNhbid0IHRyeSB0byB1c2VcbiAgICAgICAgLy8gTG9jYWxDb2xsZWN0aW9uLl9tb2RpZnksIHNpbmNlIHRoYXQganVzdCBtdXRhdGVzIHRoZSBFSlNPTiBlbmNvZGluZyxcbiAgICAgICAgLy8gbm90IHRoZSBhY3R1YWwgb2JqZWN0LlxuICAgICAgICB2YXIgY2FuRGlyZWN0bHlNb2RpZnlEb2MgPVxuICAgICAgICAgICFpc1JlcGxhY2UgJiYgbW9kaWZpZXJDYW5CZURpcmVjdGx5QXBwbGllZChvcC5vKTtcblxuICAgICAgICB2YXIgcHVibGlzaGVkQmVmb3JlID0gc2VsZi5fcHVibGlzaGVkLmhhcyhpZCk7XG4gICAgICAgIHZhciBidWZmZXJlZEJlZm9yZSA9IHNlbGYuX2xpbWl0ICYmIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLmhhcyhpZCk7XG5cbiAgICAgICAgaWYgKGlzUmVwbGFjZSkge1xuICAgICAgICAgIHNlbGYuX2hhbmRsZURvYyhpZCwgT2JqZWN0LmFzc2lnbih7X2lkOiBpZH0sIG9wLm8pKTtcbiAgICAgICAgfSBlbHNlIGlmICgocHVibGlzaGVkQmVmb3JlIHx8IGJ1ZmZlcmVkQmVmb3JlKSAmJlxuICAgICAgICAgICAgICAgICAgIGNhbkRpcmVjdGx5TW9kaWZ5RG9jKSB7XG4gICAgICAgICAgLy8gT2ggZ3JlYXQsIHdlIGFjdHVhbGx5IGtub3cgd2hhdCB0aGUgZG9jdW1lbnQgaXMsIHNvIHdlIGNhbiBhcHBseVxuICAgICAgICAgIC8vIHRoaXMgZGlyZWN0bHkuXG4gICAgICAgICAgdmFyIG5ld0RvYyA9IHNlbGYuX3B1Ymxpc2hlZC5oYXMoaWQpXG4gICAgICAgICAgICA/IHNlbGYuX3B1Ymxpc2hlZC5nZXQoaWQpIDogc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuZ2V0KGlkKTtcbiAgICAgICAgICBuZXdEb2MgPSBFSlNPTi5jbG9uZShuZXdEb2MpO1xuXG4gICAgICAgICAgbmV3RG9jLl9pZCA9IGlkO1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBMb2NhbENvbGxlY3Rpb24uX21vZGlmeShuZXdEb2MsIG9wLm8pO1xuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGlmIChlLm5hbWUgIT09IFwiTWluaW1vbmdvRXJyb3JcIilcbiAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgIC8vIFdlIGRpZG4ndCB1bmRlcnN0YW5kIHRoZSBtb2RpZmllci4gIFJlLWZldGNoLlxuICAgICAgICAgICAgc2VsZi5fbmVlZFRvRmV0Y2guc2V0KGlkLCBvcCk7XG4gICAgICAgICAgICBpZiAoc2VsZi5fcGhhc2UgPT09IFBIQVNFLlNURUFEWSkge1xuICAgICAgICAgICAgICBzZWxmLl9mZXRjaE1vZGlmaWVkRG9jdW1lbnRzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHNlbGYuX2hhbmRsZURvYyhpZCwgc2VsZi5fc2hhcmVkUHJvamVjdGlvbkZuKG5ld0RvYykpO1xuICAgICAgICB9IGVsc2UgaWYgKCFjYW5EaXJlY3RseU1vZGlmeURvYyB8fFxuICAgICAgICAgICAgICAgICAgIHNlbGYuX21hdGNoZXIuY2FuQmVjb21lVHJ1ZUJ5TW9kaWZpZXIob3AubykgfHxcbiAgICAgICAgICAgICAgICAgICAoc2VsZi5fc29ydGVyICYmIHNlbGYuX3NvcnRlci5hZmZlY3RlZEJ5TW9kaWZpZXIob3AubykpKSB7XG4gICAgICAgICAgc2VsZi5fbmVlZFRvRmV0Y2guc2V0KGlkLCBvcCk7XG4gICAgICAgICAgaWYgKHNlbGYuX3BoYXNlID09PSBQSEFTRS5TVEVBRFkpXG4gICAgICAgICAgICBzZWxmLl9mZXRjaE1vZGlmaWVkRG9jdW1lbnRzKCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IEVycm9yKFwiWFhYIFNVUlBSSVNJTkcgT1BFUkFUSU9OOiBcIiArIG9wKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcblxuICBhc3luYyBfcnVuSW5pdGlhbFF1ZXJ5QXN5bmMoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwib3Bsb2cgc3RvcHBlZCBzdXJwcmlzaW5nbHkgZWFybHlcIik7XG5cbiAgICBhd2FpdCBzZWxmLl9ydW5RdWVyeSh7aW5pdGlhbDogdHJ1ZX0pOyAgLy8geWllbGRzXG5cbiAgICBpZiAoc2VsZi5fc3RvcHBlZClcbiAgICAgIHJldHVybjsgIC8vIGNhbiBoYXBwZW4gb24gcXVlcnlFcnJvclxuXG4gICAgLy8gQWxsb3cgb2JzZXJ2ZUNoYW5nZXMgY2FsbHMgdG8gcmV0dXJuLiAoQWZ0ZXIgdGhpcywgaXQncyBwb3NzaWJsZSBmb3JcbiAgICAvLyBzdG9wKCkgdG8gYmUgY2FsbGVkLilcbiAgICBhd2FpdCBzZWxmLl9tdWx0aXBsZXhlci5yZWFkeSgpO1xuXG4gICAgYXdhaXQgc2VsZi5fZG9uZVF1ZXJ5aW5nKCk7ICAvLyB5aWVsZHNcbiAgfSxcblxuICAvLyBZaWVsZHMhXG4gIF9ydW5Jbml0aWFsUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5fcnVuSW5pdGlhbFF1ZXJ5QXN5bmMoKTtcbiAgfSxcblxuICAvLyBJbiB2YXJpb3VzIGNpcmN1bXN0YW5jZXMsIHdlIG1heSBqdXN0IHdhbnQgdG8gc3RvcCBwcm9jZXNzaW5nIHRoZSBvcGxvZyBhbmRcbiAgLy8gcmUtcnVuIHRoZSBpbml0aWFsIHF1ZXJ5LCBqdXN0IGFzIGlmIHdlIHdlcmUgYSBQb2xsaW5nT2JzZXJ2ZURyaXZlci5cbiAgLy9cbiAgLy8gVGhpcyBmdW5jdGlvbiBtYXkgbm90IGJsb2NrLCBiZWNhdXNlIGl0IGlzIGNhbGxlZCBmcm9tIGFuIG9wbG9nIGVudHJ5XG4gIC8vIGhhbmRsZXIuXG4gIC8vXG4gIC8vIFhYWCBXZSBzaG91bGQgY2FsbCB0aGlzIHdoZW4gd2UgZGV0ZWN0IHRoYXQgd2UndmUgYmVlbiBpbiBGRVRDSElORyBmb3IgXCJ0b29cbiAgLy8gbG9uZ1wiLlxuICAvL1xuICAvLyBYWFggV2Ugc2hvdWxkIGNhbGwgdGhpcyB3aGVuIHdlIGRldGVjdCBNb25nbyBmYWlsb3ZlciAoc2luY2UgdGhhdCBtaWdodFxuICAvLyBtZWFuIHRoYXQgc29tZSBvZiB0aGUgb3Bsb2cgZW50cmllcyB3ZSBoYXZlIHByb2Nlc3NlZCBoYXZlIGJlZW4gcm9sbGVkXG4gIC8vIGJhY2spLiBUaGUgTm9kZSBNb25nbyBkcml2ZXIgaXMgaW4gdGhlIG1pZGRsZSBvZiBhIGJ1bmNoIG9mIGh1Z2VcbiAgLy8gcmVmYWN0b3JpbmdzLCBpbmNsdWRpbmcgdGhlIHdheSB0aGF0IGl0IG5vdGlmaWVzIHlvdSB3aGVuIHByaW1hcnlcbiAgLy8gY2hhbmdlcy4gV2lsbCBwdXQgb2ZmIGltcGxlbWVudGluZyB0aGlzIHVudGlsIGRyaXZlciAxLjQgaXMgb3V0LlxuICBfcG9sbFF1ZXJ5OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIC8vIFlheSwgd2UgZ2V0IHRvIGZvcmdldCBhYm91dCBhbGwgdGhlIHRoaW5ncyB3ZSB0aG91Z2h0IHdlIGhhZCB0byBmZXRjaC5cbiAgICAgIHNlbGYuX25lZWRUb0ZldGNoID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gICAgICBzZWxmLl9jdXJyZW50bHlGZXRjaGluZyA9IG51bGw7XG4gICAgICArK3NlbGYuX2ZldGNoR2VuZXJhdGlvbjsgIC8vIGlnbm9yZSBhbnkgaW4tZmxpZ2h0IGZldGNoZXNcbiAgICAgIHNlbGYuX3JlZ2lzdGVyUGhhc2VDaGFuZ2UoUEhBU0UuUVVFUllJTkcpO1xuXG4gICAgICAvLyBEZWZlciBzbyB0aGF0IHdlIGRvbid0IHlpZWxkLiAgV2UgZG9uJ3QgbmVlZCBmaW5pc2hJZk5lZWRUb1BvbGxRdWVyeVxuICAgICAgLy8gaGVyZSBiZWNhdXNlIFN3aXRjaGVkVG9RdWVyeSBpcyBub3QgdGhyb3duIGluIFFVRVJZSU5HIG1vZGUuXG4gICAgICBNZXRlb3IuZGVmZXIoYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICBhd2FpdCBzZWxmLl9ydW5RdWVyeSgpO1xuICAgICAgICBhd2FpdCBzZWxmLl9kb25lUXVlcnlpbmcoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9LFxuXG4gIC8vIFlpZWxkcyFcbiAgYXN5bmMgX3J1blF1ZXJ5QXN5bmMob3B0aW9ucykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICB2YXIgbmV3UmVzdWx0cywgbmV3QnVmZmVyO1xuXG4gICAgLy8gVGhpcyB3aGlsZSBsb29wIGlzIGp1c3QgdG8gcmV0cnkgZmFpbHVyZXMuXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIC8vIElmIHdlJ3ZlIGJlZW4gc3RvcHBlZCwgd2UgZG9uJ3QgaGF2ZSB0byBydW4gYW55dGhpbmcgYW55IG1vcmUuXG4gICAgICBpZiAoc2VsZi5fc3RvcHBlZClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBuZXdSZXN1bHRzID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gICAgICBuZXdCdWZmZXIgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcblxuICAgICAgLy8gUXVlcnkgMnggZG9jdW1lbnRzIGFzIHRoZSBoYWxmIGV4Y2x1ZGVkIGZyb20gdGhlIG9yaWdpbmFsIHF1ZXJ5IHdpbGwgZ29cbiAgICAgIC8vIGludG8gdW5wdWJsaXNoZWQgYnVmZmVyIHRvIHJlZHVjZSBhZGRpdGlvbmFsIE1vbmdvIGxvb2t1cHMgaW4gY2FzZXNcbiAgICAgIC8vIHdoZW4gZG9jdW1lbnRzIGFyZSByZW1vdmVkIGZyb20gdGhlIHB1Ymxpc2hlZCBzZXQgYW5kIG5lZWQgYVxuICAgICAgLy8gcmVwbGFjZW1lbnQuXG4gICAgICAvLyBYWFggbmVlZHMgbW9yZSB0aG91Z2h0IG9uIG5vbi16ZXJvIHNraXBcbiAgICAgIC8vIFhYWCAyIGlzIGEgXCJtYWdpYyBudW1iZXJcIiBtZWFuaW5nIHRoZXJlIGlzIGFuIGV4dHJhIGNodW5rIG9mIGRvY3MgZm9yXG4gICAgICAvLyBidWZmZXIgaWYgc3VjaCBpcyBuZWVkZWQuXG4gICAgICB2YXIgY3Vyc29yID0gc2VsZi5fY3Vyc29yRm9yUXVlcnkoeyBsaW1pdDogc2VsZi5fbGltaXQgKiAyIH0pO1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgY3Vyc29yLmZvckVhY2goZnVuY3Rpb24gKGRvYywgaSkgeyAgLy8geWllbGRzXG4gICAgICAgICAgaWYgKCFzZWxmLl9saW1pdCB8fCBpIDwgc2VsZi5fbGltaXQpIHtcbiAgICAgICAgICAgIG5ld1Jlc3VsdHMuc2V0KGRvYy5faWQsIGRvYyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5ld0J1ZmZlci5zZXQoZG9jLl9pZCwgZG9jKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMuaW5pdGlhbCAmJiB0eXBlb2YoZS5jb2RlKSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAvLyBUaGlzIGlzIGFuIGVycm9yIGRvY3VtZW50IHNlbnQgdG8gdXMgYnkgbW9uZ29kLCBub3QgYSBjb25uZWN0aW9uXG4gICAgICAgICAgLy8gZXJyb3IgZ2VuZXJhdGVkIGJ5IHRoZSBjbGllbnQuIEFuZCB3ZSd2ZSBuZXZlciBzZWVuIHRoaXMgcXVlcnkgd29ya1xuICAgICAgICAgIC8vIHN1Y2Nlc3NmdWxseS4gUHJvYmFibHkgaXQncyBhIGJhZCBzZWxlY3RvciBvciBzb21ldGhpbmcsIHNvIHdlXG4gICAgICAgICAgLy8gc2hvdWxkIE5PVCByZXRyeS4gSW5zdGVhZCwgd2Ugc2hvdWxkIGhhbHQgdGhlIG9ic2VydmUgKHdoaWNoIGVuZHNcbiAgICAgICAgICAvLyB1cCBjYWxsaW5nIGBzdG9wYCBvbiB1cykuXG4gICAgICAgICAgYXdhaXQgc2VsZi5fbXVsdGlwbGV4ZXIucXVlcnlFcnJvcihlKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBEdXJpbmcgZmFpbG92ZXIgKGVnKSBpZiB3ZSBnZXQgYW4gZXhjZXB0aW9uIHdlIHNob3VsZCBsb2cgYW5kIHJldHJ5XG4gICAgICAgIC8vIGluc3RlYWQgb2YgY3Jhc2hpbmcuXG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJHb3QgZXhjZXB0aW9uIHdoaWxlIHBvbGxpbmcgcXVlcnlcIiwgZSk7XG4gICAgICAgIGF3YWl0IE1ldGVvci5fc2xlZXBGb3JNcygxMDApO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgcmV0dXJuO1xuXG4gICAgc2VsZi5fcHVibGlzaE5ld1Jlc3VsdHMobmV3UmVzdWx0cywgbmV3QnVmZmVyKTtcbiAgfSxcblxuICAvLyBZaWVsZHMhXG4gIF9ydW5RdWVyeTogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICByZXR1cm4gdGhpcy5fcnVuUXVlcnlBc3luYyhvcHRpb25zKTtcbiAgfSxcblxuICAvLyBUcmFuc2l0aW9ucyB0byBRVUVSWUlORyBhbmQgcnVucyBhbm90aGVyIHF1ZXJ5LCBvciAoaWYgYWxyZWFkeSBpbiBRVUVSWUlORylcbiAgLy8gZW5zdXJlcyB0aGF0IHdlIHdpbGwgcXVlcnkgYWdhaW4gbGF0ZXIuXG4gIC8vXG4gIC8vIFRoaXMgZnVuY3Rpb24gbWF5IG5vdCBibG9jaywgYmVjYXVzZSBpdCBpcyBjYWxsZWQgZnJvbSBhbiBvcGxvZyBlbnRyeVxuICAvLyBoYW5kbGVyLiBIb3dldmVyLCBpZiB3ZSB3ZXJlIG5vdCBhbHJlYWR5IGluIHRoZSBRVUVSWUlORyBwaGFzZSwgaXQgdGhyb3dzXG4gIC8vIGFuIGV4Y2VwdGlvbiB0aGF0IGlzIGNhdWdodCBieSB0aGUgY2xvc2VzdCBzdXJyb3VuZGluZ1xuICAvLyBmaW5pc2hJZk5lZWRUb1BvbGxRdWVyeSBjYWxsOyB0aGlzIGVuc3VyZXMgdGhhdCB3ZSBkb24ndCBjb250aW51ZSBydW5uaW5nXG4gIC8vIGNsb3NlIHRoYXQgd2FzIGRlc2lnbmVkIGZvciBhbm90aGVyIHBoYXNlIGluc2lkZSBQSEFTRS5RVUVSWUlORy5cbiAgLy9cbiAgLy8gKEl0J3MgYWxzbyBuZWNlc3Nhcnkgd2hlbmV2ZXIgbG9naWMgaW4gdGhpcyBmaWxlIHlpZWxkcyB0byBjaGVjayB0aGF0IG90aGVyXG4gIC8vIHBoYXNlcyBoYXZlbid0IHB1dCB1cyBpbnRvIFFVRVJZSU5HIG1vZGUsIHRob3VnaDsgZWcsXG4gIC8vIF9mZXRjaE1vZGlmaWVkRG9jdW1lbnRzIGRvZXMgdGhpcy4pXG4gIF9uZWVkVG9Qb2xsUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgLy8gSWYgd2UncmUgbm90IGFscmVhZHkgaW4gdGhlIG1pZGRsZSBvZiBhIHF1ZXJ5LCB3ZSBjYW4gcXVlcnkgbm93XG4gICAgICAvLyAocG9zc2libHkgcGF1c2luZyBGRVRDSElORykuXG4gICAgICBpZiAoc2VsZi5fcGhhc2UgIT09IFBIQVNFLlFVRVJZSU5HKSB7XG4gICAgICAgIHNlbGYuX3BvbGxRdWVyeSgpO1xuICAgICAgICB0aHJvdyBuZXcgU3dpdGNoZWRUb1F1ZXJ5O1xuICAgICAgfVxuXG4gICAgICAvLyBXZSdyZSBjdXJyZW50bHkgaW4gUVVFUllJTkcuIFNldCBhIGZsYWcgdG8gZW5zdXJlIHRoYXQgd2UgcnVuIGFub3RoZXJcbiAgICAgIC8vIHF1ZXJ5IHdoZW4gd2UncmUgZG9uZS5cbiAgICAgIHNlbGYuX3JlcXVlcnlXaGVuRG9uZVRoaXNRdWVyeSA9IHRydWU7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gWWllbGRzIVxuICBfZG9uZVF1ZXJ5aW5nOiBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICByZXR1cm47XG5cbiAgICBhd2FpdCBzZWxmLl9tb25nb0hhbmRsZS5fb3Bsb2dIYW5kbGUud2FpdFVudGlsQ2F1Z2h0VXAoKTtcblxuICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgcmV0dXJuO1xuXG4gICAgaWYgKHNlbGYuX3BoYXNlICE9PSBQSEFTRS5RVUVSWUlORylcbiAgICAgIHRocm93IEVycm9yKFwiUGhhc2UgdW5leHBlY3RlZGx5IFwiICsgc2VsZi5fcGhhc2UpO1xuXG4gICAgaWYgKHNlbGYuX3JlcXVlcnlXaGVuRG9uZVRoaXNRdWVyeSkge1xuICAgICAgc2VsZi5fcmVxdWVyeVdoZW5Eb25lVGhpc1F1ZXJ5ID0gZmFsc2U7XG4gICAgICBzZWxmLl9wb2xsUXVlcnkoKTtcbiAgICB9IGVsc2UgaWYgKHNlbGYuX25lZWRUb0ZldGNoLmVtcHR5KCkpIHtcbiAgICAgIGF3YWl0IHNlbGYuX2JlU3RlYWR5KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGYuX2ZldGNoTW9kaWZpZWREb2N1bWVudHMoKTtcbiAgICB9XG4gIH0sXG5cbiAgX2N1cnNvckZvclF1ZXJ5OiBmdW5jdGlvbiAob3B0aW9uc092ZXJ3cml0ZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgLy8gVGhlIHF1ZXJ5IHdlIHJ1biBpcyBhbG1vc3QgdGhlIHNhbWUgYXMgdGhlIGN1cnNvciB3ZSBhcmUgb2JzZXJ2aW5nLFxuICAgICAgLy8gd2l0aCBhIGZldyBjaGFuZ2VzLiBXZSBuZWVkIHRvIHJlYWQgYWxsIHRoZSBmaWVsZHMgdGhhdCBhcmUgcmVsZXZhbnQgdG9cbiAgICAgIC8vIHRoZSBzZWxlY3Rvciwgbm90IGp1c3QgdGhlIGZpZWxkcyB3ZSBhcmUgZ29pbmcgdG8gcHVibGlzaCAodGhhdCdzIHRoZVxuICAgICAgLy8gXCJzaGFyZWRcIiBwcm9qZWN0aW9uKS4gQW5kIHdlIGRvbid0IHdhbnQgdG8gYXBwbHkgYW55IHRyYW5zZm9ybSBpbiB0aGVcbiAgICAgIC8vIGN1cnNvciwgYmVjYXVzZSBvYnNlcnZlQ2hhbmdlcyBzaG91bGRuJ3QgdXNlIHRoZSB0cmFuc2Zvcm0uXG4gICAgICB2YXIgb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMpO1xuXG4gICAgICAvLyBBbGxvdyB0aGUgY2FsbGVyIHRvIG1vZGlmeSB0aGUgb3B0aW9ucy4gVXNlZnVsIHRvIHNwZWNpZnkgZGlmZmVyZW50XG4gICAgICAvLyBza2lwIGFuZCBsaW1pdCB2YWx1ZXMuXG4gICAgICBPYmplY3QuYXNzaWduKG9wdGlvbnMsIG9wdGlvbnNPdmVyd3JpdGUpO1xuXG4gICAgICBvcHRpb25zLmZpZWxkcyA9IHNlbGYuX3NoYXJlZFByb2plY3Rpb247XG4gICAgICBkZWxldGUgb3B0aW9ucy50cmFuc2Zvcm07XG4gICAgICAvLyBXZSBhcmUgTk9UIGRlZXAgY2xvbmluZyBmaWVsZHMgb3Igc2VsZWN0b3IgaGVyZSwgd2hpY2ggc2hvdWxkIGJlIE9LLlxuICAgICAgdmFyIGRlc2NyaXB0aW9uID0gbmV3IEN1cnNvckRlc2NyaXB0aW9uKFxuICAgICAgICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgc2VsZi5fY3Vyc29yRGVzY3JpcHRpb24uc2VsZWN0b3IsXG4gICAgICAgIG9wdGlvbnMpO1xuICAgICAgcmV0dXJuIG5ldyBDdXJzb3Ioc2VsZi5fbW9uZ29IYW5kbGUsIGRlc2NyaXB0aW9uKTtcbiAgICB9KTtcbiAgfSxcblxuXG4gIC8vIFJlcGxhY2Ugc2VsZi5fcHVibGlzaGVkIHdpdGggbmV3UmVzdWx0cyAoYm90aCBhcmUgSWRNYXBzKSwgaW52b2tpbmcgb2JzZXJ2ZVxuICAvLyBjYWxsYmFja3Mgb24gdGhlIG11bHRpcGxleGVyLlxuICAvLyBSZXBsYWNlIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyIHdpdGggbmV3QnVmZmVyLlxuICAvL1xuICAvLyBYWFggVGhpcyBpcyB2ZXJ5IHNpbWlsYXIgdG8gTG9jYWxDb2xsZWN0aW9uLl9kaWZmUXVlcnlVbm9yZGVyZWRDaGFuZ2VzLiBXZVxuICAvLyBzaG91bGQgcmVhbGx5OiAoYSkgVW5pZnkgSWRNYXAgYW5kIE9yZGVyZWREaWN0IGludG8gVW5vcmRlcmVkL09yZGVyZWREaWN0XG4gIC8vIChiKSBSZXdyaXRlIGRpZmYuanMgdG8gdXNlIHRoZXNlIGNsYXNzZXMgaW5zdGVhZCBvZiBhcnJheXMgYW5kIG9iamVjdHMuXG4gIF9wdWJsaXNoTmV3UmVzdWx0czogZnVuY3Rpb24gKG5ld1Jlc3VsdHMsIG5ld0J1ZmZlcikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG5cbiAgICAgIC8vIElmIHRoZSBxdWVyeSBpcyBsaW1pdGVkIGFuZCB0aGVyZSBpcyBhIGJ1ZmZlciwgc2h1dCBkb3duIHNvIGl0IGRvZXNuJ3RcbiAgICAgIC8vIHN0YXkgaW4gYSB3YXkuXG4gICAgICBpZiAoc2VsZi5fbGltaXQpIHtcbiAgICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuY2xlYXIoKTtcbiAgICAgIH1cblxuICAgICAgLy8gRmlyc3QgcmVtb3ZlIGFueXRoaW5nIHRoYXQncyBnb25lLiBCZSBjYXJlZnVsIG5vdCB0byBtb2RpZnlcbiAgICAgIC8vIHNlbGYuX3B1Ymxpc2hlZCB3aGlsZSBpdGVyYXRpbmcgb3ZlciBpdC5cbiAgICAgIHZhciBpZHNUb1JlbW92ZSA9IFtdO1xuICAgICAgc2VsZi5fcHVibGlzaGVkLmZvckVhY2goZnVuY3Rpb24gKGRvYywgaWQpIHtcbiAgICAgICAgaWYgKCFuZXdSZXN1bHRzLmhhcyhpZCkpXG4gICAgICAgICAgaWRzVG9SZW1vdmUucHVzaChpZCk7XG4gICAgICB9KTtcbiAgICAgIGlkc1RvUmVtb3ZlLmZvckVhY2goZnVuY3Rpb24gKGlkKSB7XG4gICAgICAgIHNlbGYuX3JlbW92ZVB1Ymxpc2hlZChpZCk7XG4gICAgICB9KTtcblxuICAgICAgLy8gTm93IGRvIGFkZHMgYW5kIGNoYW5nZXMuXG4gICAgICAvLyBJZiBzZWxmIGhhcyBhIGJ1ZmZlciBhbmQgbGltaXQsIHRoZSBuZXcgZmV0Y2hlZCByZXN1bHQgd2lsbCBiZVxuICAgICAgLy8gbGltaXRlZCBjb3JyZWN0bHkgYXMgdGhlIHF1ZXJ5IGhhcyBzb3J0IHNwZWNpZmllci5cbiAgICAgIG5ld1Jlc3VsdHMuZm9yRWFjaChmdW5jdGlvbiAoZG9jLCBpZCkge1xuICAgICAgICBzZWxmLl9oYW5kbGVEb2MoaWQsIGRvYyk7XG4gICAgICB9KTtcblxuICAgICAgLy8gU2FuaXR5LWNoZWNrIHRoYXQgZXZlcnl0aGluZyB3ZSB0cmllZCB0byBwdXQgaW50byBfcHVibGlzaGVkIGVuZGVkIHVwXG4gICAgICAvLyB0aGVyZS5cbiAgICAgIC8vIFhYWCBpZiB0aGlzIGlzIHNsb3csIHJlbW92ZSBpdCBsYXRlclxuICAgICAgaWYgKHNlbGYuX3B1Ymxpc2hlZC5zaXplKCkgIT09IG5ld1Jlc3VsdHMuc2l6ZSgpKSB7XG4gICAgICAgIE1ldGVvci5fZGVidWcoJ1RoZSBNb25nbyBzZXJ2ZXIgYW5kIHRoZSBNZXRlb3IgcXVlcnkgZGlzYWdyZWUgb24gaG93ICcgK1xuICAgICAgICAgICdtYW55IGRvY3VtZW50cyBtYXRjaCB5b3VyIHF1ZXJ5LiBDdXJzb3IgZGVzY3JpcHRpb246ICcsXG4gICAgICAgICAgc2VsZi5fY3Vyc29yRGVzY3JpcHRpb24pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBzZWxmLl9wdWJsaXNoZWQuZm9yRWFjaChmdW5jdGlvbiAoZG9jLCBpZCkge1xuICAgICAgICBpZiAoIW5ld1Jlc3VsdHMuaGFzKGlkKSlcbiAgICAgICAgICB0aHJvdyBFcnJvcihcIl9wdWJsaXNoZWQgaGFzIGEgZG9jIHRoYXQgbmV3UmVzdWx0cyBkb2Vzbid0OyBcIiArIGlkKTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBGaW5hbGx5LCByZXBsYWNlIHRoZSBidWZmZXJcbiAgICAgIG5ld0J1ZmZlci5mb3JFYWNoKGZ1bmN0aW9uIChkb2MsIGlkKSB7XG4gICAgICAgIHNlbGYuX2FkZEJ1ZmZlcmVkKGlkLCBkb2MpO1xuICAgICAgfSk7XG5cbiAgICAgIHNlbGYuX3NhZmVBcHBlbmRUb0J1ZmZlciA9IG5ld0J1ZmZlci5zaXplKCkgPCBzZWxmLl9saW1pdDtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBUaGlzIHN0b3AgZnVuY3Rpb24gaXMgaW52b2tlZCBmcm9tIHRoZSBvblN0b3Agb2YgdGhlIE9ic2VydmVNdWx0aXBsZXhlciwgc29cbiAgLy8gaXQgc2hvdWxkbid0IGFjdHVhbGx5IGJlIHBvc3NpYmxlIHRvIGNhbGwgaXQgdW50aWwgdGhlIG11bHRpcGxleGVyIGlzXG4gIC8vIHJlYWR5LlxuICAvL1xuICAvLyBJdCdzIGltcG9ydGFudCB0byBjaGVjayBzZWxmLl9zdG9wcGVkIGFmdGVyIGV2ZXJ5IGNhbGwgaW4gdGhpcyBmaWxlIHRoYXRcbiAgLy8gY2FuIHlpZWxkIVxuICBfc3RvcDogYXN5bmMgZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgcmV0dXJuO1xuICAgIHNlbGYuX3N0b3BwZWQgPSB0cnVlO1xuXG4gICAgLy8gTm90ZTogd2UgKmRvbid0KiB1c2UgbXVsdGlwbGV4ZXIub25GbHVzaCBoZXJlIGJlY2F1c2UgdGhpcyBzdG9wXG4gICAgLy8gY2FsbGJhY2sgaXMgYWN0dWFsbHkgaW52b2tlZCBieSB0aGUgbXVsdGlwbGV4ZXIgaXRzZWxmIHdoZW4gaXQgaGFzXG4gICAgLy8gZGV0ZXJtaW5lZCB0aGF0IHRoZXJlIGFyZSBubyBoYW5kbGVzIGxlZnQuIFNvIG5vdGhpbmcgaXMgYWN0dWFsbHkgZ29pbmdcbiAgICAvLyB0byBnZXQgZmx1c2hlZCAoYW5kIGl0J3MgcHJvYmFibHkgbm90IHZhbGlkIHRvIGNhbGwgbWV0aG9kcyBvbiB0aGVcbiAgICAvLyBkeWluZyBtdWx0aXBsZXhlcikuXG4gICAgZm9yIChjb25zdCB3IG9mIHNlbGYuX3dyaXRlc1RvQ29tbWl0V2hlbldlUmVhY2hTdGVhZHkpIHtcbiAgICAgIGF3YWl0IHcuY29tbWl0dGVkKCk7XG4gICAgfVxuICAgIHNlbGYuX3dyaXRlc1RvQ29tbWl0V2hlbldlUmVhY2hTdGVhZHkgPSBudWxsO1xuXG4gICAgLy8gUHJvYWN0aXZlbHkgZHJvcCByZWZlcmVuY2VzIHRvIHBvdGVudGlhbGx5IGJpZyB0aGluZ3MuXG4gICAgc2VsZi5fcHVibGlzaGVkID0gbnVsbDtcbiAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlciA9IG51bGw7XG4gICAgc2VsZi5fbmVlZFRvRmV0Y2ggPSBudWxsO1xuICAgIHNlbGYuX2N1cnJlbnRseUZldGNoaW5nID0gbnVsbDtcbiAgICBzZWxmLl9vcGxvZ0VudHJ5SGFuZGxlID0gbnVsbDtcbiAgICBzZWxmLl9saXN0ZW5lcnNIYW5kbGUgPSBudWxsO1xuXG4gICAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgICAgICBcIm1vbmdvLWxpdmVkYXRhXCIsIFwib2JzZXJ2ZS1kcml2ZXJzLW9wbG9nXCIsIC0xKTtcblxuICAgIGZvciBhd2FpdCAoY29uc3QgaGFuZGxlIG9mIHNlbGYuX3N0b3BIYW5kbGVzKSB7XG4gICAgICBhd2FpdCBoYW5kbGUuc3RvcCgpO1xuICAgIH1cbiAgfSxcbiAgc3RvcDogYXN5bmMgZnVuY3Rpb24oKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgcmV0dXJuIGF3YWl0IHNlbGYuX3N0b3AoKTtcbiAgfSxcblxuICBfcmVnaXN0ZXJQaGFzZUNoYW5nZTogZnVuY3Rpb24gKHBoYXNlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBub3cgPSBuZXcgRGF0ZTtcblxuICAgICAgaWYgKHNlbGYuX3BoYXNlKSB7XG4gICAgICAgIHZhciB0aW1lRGlmZiA9IG5vdyAtIHNlbGYuX3BoYXNlU3RhcnRUaW1lO1xuICAgICAgICBQYWNrYWdlWydmYWN0cy1iYXNlJ10gJiYgUGFja2FnZVsnZmFjdHMtYmFzZSddLkZhY3RzLmluY3JlbWVudFNlcnZlckZhY3QoXG4gICAgICAgICAgXCJtb25nby1saXZlZGF0YVwiLCBcInRpbWUtc3BlbnQtaW4tXCIgKyBzZWxmLl9waGFzZSArIFwiLXBoYXNlXCIsIHRpbWVEaWZmKTtcbiAgICAgIH1cblxuICAgICAgc2VsZi5fcGhhc2UgPSBwaGFzZTtcbiAgICAgIHNlbGYuX3BoYXNlU3RhcnRUaW1lID0gbm93O1xuICAgIH0pO1xuICB9XG59KTtcblxuLy8gRG9lcyBvdXIgb3Bsb2cgdGFpbGluZyBjb2RlIHN1cHBvcnQgdGhpcyBjdXJzb3I/IEZvciBub3csIHdlIGFyZSBiZWluZyB2ZXJ5XG4vLyBjb25zZXJ2YXRpdmUgYW5kIGFsbG93aW5nIG9ubHkgc2ltcGxlIHF1ZXJpZXMgd2l0aCBzaW1wbGUgb3B0aW9ucy5cbi8vIChUaGlzIGlzIGEgXCJzdGF0aWMgbWV0aG9kXCIuKVxuT3Bsb2dPYnNlcnZlRHJpdmVyLmN1cnNvclN1cHBvcnRlZCA9IGZ1bmN0aW9uIChjdXJzb3JEZXNjcmlwdGlvbiwgbWF0Y2hlcikge1xuICAvLyBGaXJzdCwgY2hlY2sgdGhlIG9wdGlvbnMuXG4gIHZhciBvcHRpb25zID0gY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucztcblxuICAvLyBEaWQgdGhlIHVzZXIgc2F5IG5vIGV4cGxpY2l0bHk/XG4gIC8vIHVuZGVyc2NvcmVkIHZlcnNpb24gb2YgdGhlIG9wdGlvbiBpcyBDT01QQVQgd2l0aCAxLjJcbiAgaWYgKG9wdGlvbnMuZGlzYWJsZU9wbG9nIHx8IG9wdGlvbnMuX2Rpc2FibGVPcGxvZylcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgLy8gc2tpcCBpcyBub3Qgc3VwcG9ydGVkOiB0byBzdXBwb3J0IGl0IHdlIHdvdWxkIG5lZWQgdG8ga2VlcCB0cmFjayBvZiBhbGxcbiAgLy8gXCJza2lwcGVkXCIgZG9jdW1lbnRzIG9yIGF0IGxlYXN0IHRoZWlyIGlkcy5cbiAgLy8gbGltaXQgdy9vIGEgc29ydCBzcGVjaWZpZXIgaXMgbm90IHN1cHBvcnRlZDogY3VycmVudCBpbXBsZW1lbnRhdGlvbiBuZWVkcyBhXG4gIC8vIGRldGVybWluaXN0aWMgd2F5IHRvIG9yZGVyIGRvY3VtZW50cy5cbiAgaWYgKG9wdGlvbnMuc2tpcCB8fCAob3B0aW9ucy5saW1pdCAmJiAhb3B0aW9ucy5zb3J0KSkgcmV0dXJuIGZhbHNlO1xuXG4gIC8vIElmIGEgZmllbGRzIHByb2plY3Rpb24gb3B0aW9uIGlzIGdpdmVuIGNoZWNrIGlmIGl0IGlzIHN1cHBvcnRlZCBieVxuICAvLyBtaW5pbW9uZ28gKHNvbWUgb3BlcmF0b3JzIGFyZSBub3Qgc3VwcG9ydGVkKS5cbiAgY29uc3QgZmllbGRzID0gb3B0aW9ucy5maWVsZHMgfHwgb3B0aW9ucy5wcm9qZWN0aW9uO1xuICBpZiAoZmllbGRzKSB7XG4gICAgdHJ5IHtcbiAgICAgIExvY2FsQ29sbGVjdGlvbi5fY2hlY2tTdXBwb3J0ZWRQcm9qZWN0aW9uKGZpZWxkcyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGUubmFtZSA9PT0gXCJNaW5pbW9uZ29FcnJvclwiKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IGU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gV2UgZG9uJ3QgYWxsb3cgdGhlIGZvbGxvd2luZyBzZWxlY3RvcnM6XG4gIC8vICAgLSAkd2hlcmUgKG5vdCBjb25maWRlbnQgdGhhdCB3ZSBwcm92aWRlIHRoZSBzYW1lIEpTIGVudmlyb25tZW50XG4gIC8vICAgICAgICAgICAgIGFzIE1vbmdvLCBhbmQgY2FuIHlpZWxkISlcbiAgLy8gICAtICRuZWFyIChoYXMgXCJpbnRlcmVzdGluZ1wiIHByb3BlcnRpZXMgaW4gTW9uZ29EQiwgbGlrZSB0aGUgcG9zc2liaWxpdHlcbiAgLy8gICAgICAgICAgICBvZiByZXR1cm5pbmcgYW4gSUQgbXVsdGlwbGUgdGltZXMsIHRob3VnaCBldmVuIHBvbGxpbmcgbWF5YmVcbiAgLy8gICAgICAgICAgICBoYXZlIGEgYnVnIHRoZXJlKVxuICAvLyAgICAgICAgICAgWFhYOiBvbmNlIHdlIHN1cHBvcnQgaXQsIHdlIHdvdWxkIG5lZWQgdG8gdGhpbmsgbW9yZSBvbiBob3cgd2VcbiAgLy8gICAgICAgICAgIGluaXRpYWxpemUgdGhlIGNvbXBhcmF0b3JzIHdoZW4gd2UgY3JlYXRlIHRoZSBkcml2ZXIuXG4gIHJldHVybiAhbWF0Y2hlci5oYXNXaGVyZSgpICYmICFtYXRjaGVyLmhhc0dlb1F1ZXJ5KCk7XG59O1xuXG52YXIgbW9kaWZpZXJDYW5CZURpcmVjdGx5QXBwbGllZCA9IGZ1bmN0aW9uIChtb2RpZmllcikge1xuICByZXR1cm4gT2JqZWN0LmVudHJpZXMobW9kaWZpZXIpLmV2ZXJ5KGZ1bmN0aW9uIChbb3BlcmF0aW9uLCBmaWVsZHNdKSB7XG4gICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKGZpZWxkcykuZXZlcnkoZnVuY3Rpb24gKFtmaWVsZCwgdmFsdWVdKSB7XG4gICAgICByZXR1cm4gIS9FSlNPTlxcJC8udGVzdChmaWVsZCk7XG4gICAgfSk7XG4gIH0pO1xufTtcblxuTW9uZ29JbnRlcm5hbHMuT3Bsb2dPYnNlcnZlRHJpdmVyID0gT3Bsb2dPYnNlcnZlRHJpdmVyOyIsIi8vIENvbnZlcnRlciBvZiB0aGUgbmV3IE1vbmdvREIgT3Bsb2cgZm9ybWF0ICg+PTUuMCkgdG8gdGhlIG9uZSB0aGF0IE1ldGVvclxuLy8gaGFuZGxlcyB3ZWxsLCBpLmUuLCBgJHNldGAgYW5kIGAkdW5zZXRgLiBUaGUgbmV3IGZvcm1hdCBpcyBjb21wbGV0ZWx5IG5ldyxcbi8vIGFuZCBsb29rcyBhcyBmb2xsb3dzOlxuLy9cbi8vICAgeyAkdjogMiwgZGlmZjogRGlmZiB9XG4vL1xuLy8gd2hlcmUgYERpZmZgIGlzIGEgcmVjdXJzaXZlIHN0cnVjdHVyZTpcbi8vXG4vLyAgIHtcbi8vICAgICAvLyBOZXN0ZWQgdXBkYXRlcyAoc29tZXRpbWVzIGFsc28gcmVwcmVzZW50ZWQgd2l0aCBhbiBzLWZpZWxkKS5cbi8vICAgICAvLyBFeGFtcGxlOiBgeyAkc2V0OiB7ICdmb28uYmFyJzogMSB9IH1gLlxuLy8gICAgIGk6IHsgPGtleT46IDx2YWx1ZT4sIC4uLiB9LFxuLy9cbi8vICAgICAvLyBUb3AtbGV2ZWwgdXBkYXRlcy5cbi8vICAgICAvLyBFeGFtcGxlOiBgeyAkc2V0OiB7IGZvbzogeyBiYXI6IDEgfSB9IH1gLlxuLy8gICAgIHU6IHsgPGtleT46IDx2YWx1ZT4sIC4uLiB9LFxuLy9cbi8vICAgICAvLyBVbnNldHMuXG4vLyAgICAgLy8gRXhhbXBsZTogYHsgJHVuc2V0OiB7IGZvbzogJycgfSB9YC5cbi8vICAgICBkOiB7IDxrZXk+OiBmYWxzZSwgLi4uIH0sXG4vL1xuLy8gICAgIC8vIEFycmF5IG9wZXJhdGlvbnMuXG4vLyAgICAgLy8gRXhhbXBsZTogYHsgJHB1c2g6IHsgZm9vOiAnYmFyJyB9IH1gLlxuLy8gICAgIHM8a2V5PjogeyBhOiB0cnVlLCB1PGluZGV4PjogPHZhbHVlPiwgLi4uIH0sXG4vLyAgICAgLi4uXG4vL1xuLy8gICAgIC8vIE5lc3RlZCBvcGVyYXRpb25zIChzb21ldGltZXMgYWxzbyByZXByZXNlbnRlZCBpbiB0aGUgYGlgIGZpZWxkKS5cbi8vICAgICAvLyBFeGFtcGxlOiBgeyAkc2V0OiB7ICdmb28uYmFyJzogMSB9IH1gLlxuLy8gICAgIHM8a2V5PjogRGlmZixcbi8vICAgICAuLi5cbi8vICAgfVxuLy9cbi8vIChhbGwgZmllbGRzIGFyZSBvcHRpb25hbCkuXG5cbmZ1bmN0aW9uIGpvaW4ocHJlZml4LCBrZXkpIHtcbiAgcmV0dXJuIHByZWZpeCA/IGAke3ByZWZpeH0uJHtrZXl9YCA6IGtleTtcbn1cblxuY29uc3QgYXJyYXlPcGVyYXRvcktleVJlZ2V4ID0gL14oYXxbc3VdXFxkKykkLztcblxuZnVuY3Rpb24gaXNBcnJheU9wZXJhdG9yS2V5KGZpZWxkKSB7XG4gIHJldHVybiBhcnJheU9wZXJhdG9yS2V5UmVnZXgudGVzdChmaWVsZCk7XG59XG5cbmZ1bmN0aW9uIGlzQXJyYXlPcGVyYXRvcihvcGVyYXRvcikge1xuICByZXR1cm4gb3BlcmF0b3IuYSA9PT0gdHJ1ZSAmJiBPYmplY3Qua2V5cyhvcGVyYXRvcikuZXZlcnkoaXNBcnJheU9wZXJhdG9yS2V5KTtcbn1cblxuZnVuY3Rpb24gZmxhdHRlbk9iamVjdEludG8odGFyZ2V0LCBzb3VyY2UsIHByZWZpeCkge1xuICBpZiAoQXJyYXkuaXNBcnJheShzb3VyY2UpIHx8IHR5cGVvZiBzb3VyY2UgIT09ICdvYmplY3QnIHx8IHNvdXJjZSA9PT0gbnVsbCB8fFxuICAgICAgc291cmNlIGluc3RhbmNlb2YgTW9uZ28uT2JqZWN0SUQpIHtcbiAgICB0YXJnZXRbcHJlZml4XSA9IHNvdXJjZTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBlbnRyaWVzID0gT2JqZWN0LmVudHJpZXMoc291cmNlKTtcbiAgICBpZiAoZW50cmllcy5sZW5ndGgpIHtcbiAgICAgIGVudHJpZXMuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICAgIGZsYXR0ZW5PYmplY3RJbnRvKHRhcmdldCwgdmFsdWUsIGpvaW4ocHJlZml4LCBrZXkpKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0YXJnZXRbcHJlZml4XSA9IHNvdXJjZTtcbiAgICB9XG4gIH1cbn1cblxuY29uc3QgbG9nRGVidWdNZXNzYWdlcyA9ICEhcHJvY2Vzcy5lbnYuT1BMT0dfQ09OVkVSVEVSX0RFQlVHO1xuXG5mdW5jdGlvbiBjb252ZXJ0T3Bsb2dEaWZmKG9wbG9nRW50cnksIGRpZmYsIHByZWZpeCkge1xuICBpZiAobG9nRGVidWdNZXNzYWdlcykge1xuICAgIGNvbnNvbGUubG9nKGBjb252ZXJ0T3Bsb2dEaWZmKCR7SlNPTi5zdHJpbmdpZnkob3Bsb2dFbnRyeSl9LCAke0pTT04uc3RyaW5naWZ5KGRpZmYpfSwgJHtKU09OLnN0cmluZ2lmeShwcmVmaXgpfSlgKTtcbiAgfVxuXG4gIE9iamVjdC5lbnRyaWVzKGRpZmYpLmZvckVhY2goKFtkaWZmS2V5LCB2YWx1ZV0pID0+IHtcbiAgICBpZiAoZGlmZktleSA9PT0gJ2QnKSB7XG4gICAgICAvLyBIYW5kbGUgYCR1bnNldGBzLlxuICAgICAgb3Bsb2dFbnRyeS4kdW5zZXQgPz89IHt9O1xuICAgICAgT2JqZWN0LmtleXModmFsdWUpLmZvckVhY2goa2V5ID0+IHtcbiAgICAgICAgb3Bsb2dFbnRyeS4kdW5zZXRbam9pbihwcmVmaXgsIGtleSldID0gdHJ1ZTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAoZGlmZktleSA9PT0gJ2knKSB7XG4gICAgICAvLyBIYW5kbGUgKHBvdGVudGlhbGx5KSBuZXN0ZWQgYCRzZXRgcy5cbiAgICAgIG9wbG9nRW50cnkuJHNldCA/Pz0ge307XG4gICAgICBmbGF0dGVuT2JqZWN0SW50byhvcGxvZ0VudHJ5LiRzZXQsIHZhbHVlLCBwcmVmaXgpO1xuICAgIH0gZWxzZSBpZiAoZGlmZktleSA9PT0gJ3UnKSB7XG4gICAgICAvLyBIYW5kbGUgZmxhdCBgJHNldGBzLlxuICAgICAgb3Bsb2dFbnRyeS4kc2V0ID8/PSB7fTtcbiAgICAgIE9iamVjdC5lbnRyaWVzKHZhbHVlKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgICAgb3Bsb2dFbnRyeS4kc2V0W2pvaW4ocHJlZml4LCBrZXkpXSA9IHZhbHVlO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEhhbmRsZSBzLWZpZWxkcy5cbiAgICAgIGNvbnN0IGtleSA9IGRpZmZLZXkuc2xpY2UoMSk7XG4gICAgICBpZiAoaXNBcnJheU9wZXJhdG9yKHZhbHVlKSkge1xuICAgICAgICAvLyBBcnJheSBvcGVyYXRvci5cbiAgICAgICAgT2JqZWN0LmVudHJpZXModmFsdWUpLmZvckVhY2goKFtwb3NpdGlvbiwgdmFsdWVdKSA9PiB7XG4gICAgICAgICAgaWYgKHBvc2l0aW9uID09PSAnYScpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBwb3NpdGlvbktleSA9IGpvaW4oam9pbihwcmVmaXgsIGtleSksIHBvc2l0aW9uLnNsaWNlKDEpKTtcbiAgICAgICAgICBpZiAocG9zaXRpb25bMF0gPT09ICdzJykge1xuICAgICAgICAgICAgY29udmVydE9wbG9nRGlmZihvcGxvZ0VudHJ5LCB2YWx1ZSwgcG9zaXRpb25LZXkpO1xuICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgIG9wbG9nRW50cnkuJHVuc2V0ID8/PSB7fTtcbiAgICAgICAgICAgIG9wbG9nRW50cnkuJHVuc2V0W3Bvc2l0aW9uS2V5XSA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9wbG9nRW50cnkuJHNldCA/Pz0ge307XG4gICAgICAgICAgICBvcGxvZ0VudHJ5LiRzZXRbcG9zaXRpb25LZXldID0gdmFsdWU7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoa2V5KSB7XG4gICAgICAgIC8vIE5lc3RlZCBvYmplY3QuXG4gICAgICAgIGNvbnZlcnRPcGxvZ0RpZmYob3Bsb2dFbnRyeSwgdmFsdWUsIGpvaW4ocHJlZml4LCBrZXkpKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gb3Bsb2dWMlYxQ29udmVydGVyKG9wbG9nRW50cnkpIHtcbiAgLy8gUGFzcy10aHJvdWdoIHYxIGFuZCAocHJvYmFibHkpIGludmFsaWQgZW50cmllcy5cbiAgaWYgKG9wbG9nRW50cnkuJHYgIT09IDIgfHwgIW9wbG9nRW50cnkuZGlmZikge1xuICAgIHJldHVybiBvcGxvZ0VudHJ5O1xuICB9XG5cbiAgY29uc3QgY29udmVydGVkT3Bsb2dFbnRyeSA9IHsgJHY6IDIgfTtcbiAgY29udmVydE9wbG9nRGlmZihjb252ZXJ0ZWRPcGxvZ0VudHJ5LCBvcGxvZ0VudHJ5LmRpZmYsICcnKTtcbiAgcmV0dXJuIGNvbnZlcnRlZE9wbG9nRW50cnk7XG59XG4iLCIvLyBzaW5nbGV0b25cbmV4cG9ydCBjb25zdCBMb2NhbENvbGxlY3Rpb25Ecml2ZXIgPSBuZXcgKGNsYXNzIExvY2FsQ29sbGVjdGlvbkRyaXZlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMubm9Db25uQ29sbGVjdGlvbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICB9XG5cbiAgb3BlbihuYW1lLCBjb25uKSB7XG4gICAgaWYgKCEgbmFtZSkge1xuICAgICAgcmV0dXJuIG5ldyBMb2NhbENvbGxlY3Rpb247XG4gICAgfVxuXG4gICAgaWYgKCEgY29ubikge1xuICAgICAgcmV0dXJuIGVuc3VyZUNvbGxlY3Rpb24obmFtZSwgdGhpcy5ub0Nvbm5Db2xsZWN0aW9ucyk7XG4gICAgfVxuXG4gICAgaWYgKCEgY29ubi5fbW9uZ29fbGl2ZWRhdGFfY29sbGVjdGlvbnMpIHtcbiAgICAgIGNvbm4uX21vbmdvX2xpdmVkYXRhX2NvbGxlY3Rpb25zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICB9XG5cbiAgICAvLyBYWFggaXMgdGhlcmUgYSB3YXkgdG8ga2VlcCB0cmFjayBvZiBhIGNvbm5lY3Rpb24ncyBjb2xsZWN0aW9ucyB3aXRob3V0XG4gICAgLy8gZGFuZ2xpbmcgaXQgb2ZmIHRoZSBjb25uZWN0aW9uIG9iamVjdD9cbiAgICByZXR1cm4gZW5zdXJlQ29sbGVjdGlvbihuYW1lLCBjb25uLl9tb25nb19saXZlZGF0YV9jb2xsZWN0aW9ucyk7XG4gIH1cbn0pO1xuXG5mdW5jdGlvbiBlbnN1cmVDb2xsZWN0aW9uKG5hbWUsIGNvbGxlY3Rpb25zKSB7XG4gIHJldHVybiAobmFtZSBpbiBjb2xsZWN0aW9ucylcbiAgICA/IGNvbGxlY3Rpb25zW25hbWVdXG4gICAgOiBjb2xsZWN0aW9uc1tuYW1lXSA9IG5ldyBMb2NhbENvbGxlY3Rpb24obmFtZSk7XG59XG4iLCJpbXBvcnQgb25jZSBmcm9tICdsb2Rhc2gub25jZSc7XG5pbXBvcnQge1xuICBBU1lOQ19DT0xMRUNUSU9OX01FVEhPRFMsXG4gIGdldEFzeW5jTWV0aG9kTmFtZSxcbiAgQ0xJRU5UX09OTFlfTUVUSE9EU1xufSBmcm9tIFwibWV0ZW9yL21pbmltb25nby9jb25zdGFudHNcIjtcblxuTW9uZ29JbnRlcm5hbHMuUmVtb3RlQ29sbGVjdGlvbkRyaXZlciA9IGZ1bmN0aW9uIChcbiAgbW9uZ29fdXJsLCBvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2VsZi5tb25nbyA9IG5ldyBNb25nb0Nvbm5lY3Rpb24obW9uZ29fdXJsLCBvcHRpb25zKTtcbn07XG5cbmNvbnN0IFJFTU9URV9DT0xMRUNUSU9OX01FVEhPRFMgPSBbXG4gICdjcmVhdGVDYXBwZWRDb2xsZWN0aW9uQXN5bmMnLFxuICAnZHJvcEluZGV4QXN5bmMnLFxuICAnZW5zdXJlSW5kZXhBc3luYycsXG4gICdjcmVhdGVJbmRleEFzeW5jJyxcbiAgJ2NvdW50RG9jdW1lbnRzJyxcbiAgJ2Ryb3BDb2xsZWN0aW9uQXN5bmMnLFxuICAnZXN0aW1hdGVkRG9jdW1lbnRDb3VudCcsXG4gICdmaW5kJyxcbiAgJ2ZpbmRPbmVBc3luYycsXG4gICdpbnNlcnRBc3luYycsXG4gICdyYXdDb2xsZWN0aW9uJyxcbiAgJ3JlbW92ZUFzeW5jJyxcbiAgJ3VwZGF0ZUFzeW5jJyxcbiAgJ3Vwc2VydEFzeW5jJyxcbl07XG5cbk9iamVjdC5hc3NpZ24oTW9uZ29JbnRlcm5hbHMuUmVtb3RlQ29sbGVjdGlvbkRyaXZlci5wcm90b3R5cGUsIHtcbiAgb3BlbjogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHJldCA9IHt9O1xuICAgIFJFTU9URV9DT0xMRUNUSU9OX01FVEhPRFMuZm9yRWFjaChmdW5jdGlvbiAobSkge1xuICAgICAgcmV0W21dID0gc2VsZi5tb25nb1ttXS5iaW5kKHNlbGYubW9uZ28sIG5hbWUpO1xuXG4gICAgICBpZiAoIUFTWU5DX0NPTExFQ1RJT05fTUVUSE9EUy5pbmNsdWRlcyhtKSkgcmV0dXJuO1xuICAgICAgY29uc3QgYXN5bmNNZXRob2ROYW1lID0gZ2V0QXN5bmNNZXRob2ROYW1lKG0pO1xuICAgICAgcmV0W2FzeW5jTWV0aG9kTmFtZV0gPSBmdW5jdGlvbiAoLi4uYXJncykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUocmV0W21dKC4uLmFyZ3MpKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuXG4gICAgQ0xJRU5UX09OTFlfTUVUSE9EUy5mb3JFYWNoKGZ1bmN0aW9uIChtKSB7XG4gICAgICByZXRbbV0gPSBfLmJpbmQoc2VsZi5tb25nb1ttXSwgc2VsZi5tb25nbywgbmFtZSk7XG5cbiAgICAgIHJldFttXSA9IGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgJHttfSArICBpcyBub3QgYXZhaWxhYmxlIG9uIHRoZSBzZXJ2ZXIuIFBsZWFzZSB1c2UgJHtnZXRBc3luY01ldGhvZE5hbWUoXG4gICAgICAgICAgICBtXG4gICAgICAgICAgKX0oKSBpbnN0ZWFkLmBcbiAgICAgICAgKTtcbiAgICAgIH07XG4gICAgfSk7XG4gICAgcmV0dXJuIHJldDtcbiAgfSxcbn0pO1xuXG5cbi8vIENyZWF0ZSB0aGUgc2luZ2xldG9uIFJlbW90ZUNvbGxlY3Rpb25Ecml2ZXIgb25seSBvbiBkZW1hbmQsIHNvIHdlXG4vLyBvbmx5IHJlcXVpcmUgTW9uZ28gY29uZmlndXJhdGlvbiBpZiBpdCdzIGFjdHVhbGx5IHVzZWQgKGVnLCBub3QgaWZcbi8vIHlvdSdyZSBvbmx5IHRyeWluZyB0byByZWNlaXZlIGRhdGEgZnJvbSBhIHJlbW90ZSBERFAgc2VydmVyLilcbk1vbmdvSW50ZXJuYWxzLmRlZmF1bHRSZW1vdGVDb2xsZWN0aW9uRHJpdmVyID0gb25jZShmdW5jdGlvbiAoKSB7XG4gIHZhciBjb25uZWN0aW9uT3B0aW9ucyA9IHt9O1xuXG4gIHZhciBtb25nb1VybCA9IHByb2Nlc3MuZW52Lk1PTkdPX1VSTDtcblxuICBpZiAocHJvY2Vzcy5lbnYuTU9OR09fT1BMT0dfVVJMKSB7XG4gICAgY29ubmVjdGlvbk9wdGlvbnMub3Bsb2dVcmwgPSBwcm9jZXNzLmVudi5NT05HT19PUExPR19VUkw7XG4gIH1cblxuICBpZiAoISBtb25nb1VybClcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJNT05HT19VUkwgbXVzdCBiZSBzZXQgaW4gZW52aXJvbm1lbnRcIik7XG5cbiAgY29uc3QgZHJpdmVyID0gbmV3IE1vbmdvSW50ZXJuYWxzLlJlbW90ZUNvbGxlY3Rpb25Ecml2ZXIobW9uZ29VcmwsIGNvbm5lY3Rpb25PcHRpb25zKTtcbiAgLy8gQXMgbWFueSBkZXBsb3ltZW50IHRvb2xzLCBpbmNsdWRpbmcgTWV0ZW9yIFVwLCBzZW5kIHJlcXVlc3RzIHRvIHRoZSBhcHAgaW5cbiAgLy8gb3JkZXIgdG8gY29uZmlybSB0aGF0IHRoZSBkZXBsb3ltZW50IGZpbmlzaGVkIHN1Y2Nlc3NmdWxseSwgaXQncyByZXF1aXJlZFxuICAvLyB0byBrbm93IGFib3V0IGEgZGF0YWJhc2UgY29ubmVjdGlvbiBwcm9ibGVtIGJlZm9yZSB0aGUgYXBwIHN0YXJ0cy4gRG9pbmcgc29cbiAgLy8gaW4gYSBgTWV0ZW9yLnN0YXJ0dXBgIGlzIGZpbmUsIGFzIHRoZSBgV2ViQXBwYCBoYW5kbGVzIHJlcXVlc3RzIG9ubHkgYWZ0ZXJcbiAgLy8gYWxsIGFyZSBmaW5pc2hlZC5cbiAgTWV0ZW9yLnN0YXJ0dXAoYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IGRyaXZlci5tb25nby5jbGllbnQuY29ubmVjdCgpO1xuICB9KTtcblxuICByZXR1cm4gZHJpdmVyO1xufSk7IiwiLy8gb3B0aW9ucy5jb25uZWN0aW9uLCBpZiBnaXZlbiwgaXMgYSBMaXZlZGF0YUNsaWVudCBvciBMaXZlZGF0YVNlcnZlclxuLy8gWFhYIHByZXNlbnRseSB0aGVyZSBpcyBubyB3YXkgdG8gZGVzdHJveS9jbGVhbiB1cCBhIENvbGxlY3Rpb25cbmltcG9ydCB7XG4gIEFTWU5DX0NPTExFQ1RJT05fTUVUSE9EUyxcbiAgZ2V0QXN5bmNNZXRob2ROYW1lLFxufSBmcm9tICdtZXRlb3IvbWluaW1vbmdvL2NvbnN0YW50cyc7XG5cbmltcG9ydCB7IG5vcm1hbGl6ZVByb2plY3Rpb24gfSBmcm9tIFwiLi9tb25nb191dGlsc1wiO1xuXG4vKipcbiAqIEBzdW1tYXJ5IE5hbWVzcGFjZSBmb3IgTW9uZ29EQi1yZWxhdGVkIGl0ZW1zXG4gKiBAbmFtZXNwYWNlXG4gKi9cbk1vbmdvID0ge307XG5cbi8qKlxuICogQHN1bW1hcnkgQ29uc3RydWN0b3IgZm9yIGEgQ29sbGVjdGlvblxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAaW5zdGFuY2VuYW1lIGNvbGxlY3Rpb25cbiAqIEBjbGFzc1xuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIGNvbGxlY3Rpb24uICBJZiBudWxsLCBjcmVhdGVzIGFuIHVubWFuYWdlZCAodW5zeW5jaHJvbml6ZWQpIGxvY2FsIGNvbGxlY3Rpb24uXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5jb25uZWN0aW9uIFRoZSBzZXJ2ZXIgY29ubmVjdGlvbiB0aGF0IHdpbGwgbWFuYWdlIHRoaXMgY29sbGVjdGlvbi4gVXNlcyB0aGUgZGVmYXVsdCBjb25uZWN0aW9uIGlmIG5vdCBzcGVjaWZpZWQuICBQYXNzIHRoZSByZXR1cm4gdmFsdWUgb2YgY2FsbGluZyBbYEREUC5jb25uZWN0YF0oI0REUC1jb25uZWN0KSB0byBzcGVjaWZ5IGEgZGlmZmVyZW50IHNlcnZlci4gUGFzcyBgbnVsbGAgdG8gc3BlY2lmeSBubyBjb25uZWN0aW9uLiBVbm1hbmFnZWQgKGBuYW1lYCBpcyBudWxsKSBjb2xsZWN0aW9ucyBjYW5ub3Qgc3BlY2lmeSBhIGNvbm5lY3Rpb24uXG4gKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5pZEdlbmVyYXRpb24gVGhlIG1ldGhvZCBvZiBnZW5lcmF0aW5nIHRoZSBgX2lkYCBmaWVsZHMgb2YgbmV3IGRvY3VtZW50cyBpbiB0aGlzIGNvbGxlY3Rpb24uICBQb3NzaWJsZSB2YWx1ZXM6XG5cbiAtICoqYCdTVFJJTkcnYCoqOiByYW5kb20gc3RyaW5nc1xuIC0gKipgJ01PTkdPJ2AqKjogIHJhbmRvbSBbYE1vbmdvLk9iamVjdElEYF0oI21vbmdvX29iamVjdF9pZCkgdmFsdWVzXG5cblRoZSBkZWZhdWx0IGlkIGdlbmVyYXRpb24gdGVjaG5pcXVlIGlzIGAnU1RSSU5HJ2AuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLnRyYW5zZm9ybSBBbiBvcHRpb25hbCB0cmFuc2Zvcm1hdGlvbiBmdW5jdGlvbi4gRG9jdW1lbnRzIHdpbGwgYmUgcGFzc2VkIHRocm91Z2ggdGhpcyBmdW5jdGlvbiBiZWZvcmUgYmVpbmcgcmV0dXJuZWQgZnJvbSBgZmV0Y2hgIG9yIGBmaW5kT25lQXN5bmNgLCBhbmQgYmVmb3JlIGJlaW5nIHBhc3NlZCB0byBjYWxsYmFja3Mgb2YgYG9ic2VydmVgLCBgbWFwYCwgYGZvckVhY2hgLCBgYWxsb3dgLCBhbmQgYGRlbnlgLiBUcmFuc2Zvcm1zIGFyZSAqbm90KiBhcHBsaWVkIGZvciB0aGUgY2FsbGJhY2tzIG9mIGBvYnNlcnZlQ2hhbmdlc2Agb3IgdG8gY3Vyc29ycyByZXR1cm5lZCBmcm9tIHB1Ymxpc2ggZnVuY3Rpb25zLlxuICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLmRlZmluZU11dGF0aW9uTWV0aG9kcyBTZXQgdG8gYGZhbHNlYCB0byBza2lwIHNldHRpbmcgdXAgdGhlIG11dGF0aW9uIG1ldGhvZHMgdGhhdCBlbmFibGUgaW5zZXJ0L3VwZGF0ZS9yZW1vdmUgZnJvbSBjbGllbnQgY29kZS4gRGVmYXVsdCBgdHJ1ZWAuXG4gKi9cbk1vbmdvLkNvbGxlY3Rpb24gPSBmdW5jdGlvbiBDb2xsZWN0aW9uKG5hbWUsIG9wdGlvbnMpIHtcbiAgaWYgKCFuYW1lICYmIG5hbWUgIT09IG51bGwpIHtcbiAgICBNZXRlb3IuX2RlYnVnKFxuICAgICAgJ1dhcm5pbmc6IGNyZWF0aW5nIGFub255bW91cyBjb2xsZWN0aW9uLiBJdCB3aWxsIG5vdCBiZSAnICtcbiAgICAgICAgJ3NhdmVkIG9yIHN5bmNocm9uaXplZCBvdmVyIHRoZSBuZXR3b3JrLiAoUGFzcyBudWxsIGZvciAnICtcbiAgICAgICAgJ3RoZSBjb2xsZWN0aW9uIG5hbWUgdG8gdHVybiBvZmYgdGhpcyB3YXJuaW5nLiknXG4gICAgKTtcbiAgICBuYW1lID0gbnVsbDtcbiAgfVxuXG4gIGlmIChuYW1lICE9PSBudWxsICYmIHR5cGVvZiBuYW1lICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICdGaXJzdCBhcmd1bWVudCB0byBuZXcgTW9uZ28uQ29sbGVjdGlvbiBtdXN0IGJlIGEgc3RyaW5nIG9yIG51bGwnXG4gICAgKTtcbiAgfVxuXG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMubWV0aG9kcykge1xuICAgIC8vIEJhY2t3YXJkcyBjb21wYXRpYmlsaXR5IGhhY2sgd2l0aCBvcmlnaW5hbCBzaWduYXR1cmUgKHdoaWNoIHBhc3NlZFxuICAgIC8vIFwiY29ubmVjdGlvblwiIGRpcmVjdGx5IGluc3RlYWQgb2YgaW4gb3B0aW9ucy4gKENvbm5lY3Rpb25zIG11c3QgaGF2ZSBhIFwibWV0aG9kc1wiXG4gICAgLy8gbWV0aG9kLilcbiAgICAvLyBYWFggcmVtb3ZlIGJlZm9yZSAxLjBcbiAgICBvcHRpb25zID0geyBjb25uZWN0aW9uOiBvcHRpb25zIH07XG4gIH1cbiAgLy8gQmFja3dhcmRzIGNvbXBhdGliaWxpdHk6IFwiY29ubmVjdGlvblwiIHVzZWQgdG8gYmUgY2FsbGVkIFwibWFuYWdlclwiLlxuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLm1hbmFnZXIgJiYgIW9wdGlvbnMuY29ubmVjdGlvbikge1xuICAgIG9wdGlvbnMuY29ubmVjdGlvbiA9IG9wdGlvbnMubWFuYWdlcjtcbiAgfVxuXG4gIG9wdGlvbnMgPSB7XG4gICAgY29ubmVjdGlvbjogdW5kZWZpbmVkLFxuICAgIGlkR2VuZXJhdGlvbjogJ1NUUklORycsXG4gICAgdHJhbnNmb3JtOiBudWxsLFxuICAgIF9kcml2ZXI6IHVuZGVmaW5lZCxcbiAgICBfcHJldmVudEF1dG9wdWJsaXNoOiBmYWxzZSxcbiAgICAuLi5vcHRpb25zLFxuICB9O1xuXG4gIHN3aXRjaCAob3B0aW9ucy5pZEdlbmVyYXRpb24pIHtcbiAgICBjYXNlICdNT05HTyc6XG4gICAgICB0aGlzLl9tYWtlTmV3SUQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNyYyA9IG5hbWVcbiAgICAgICAgICA/IEREUC5yYW5kb21TdHJlYW0oJy9jb2xsZWN0aW9uLycgKyBuYW1lKVxuICAgICAgICAgIDogUmFuZG9tLmluc2VjdXJlO1xuICAgICAgICByZXR1cm4gbmV3IE1vbmdvLk9iamVjdElEKHNyYy5oZXhTdHJpbmcoMjQpKTtcbiAgICAgIH07XG4gICAgICBicmVhaztcbiAgICBjYXNlICdTVFJJTkcnOlxuICAgIGRlZmF1bHQ6XG4gICAgICB0aGlzLl9tYWtlTmV3SUQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNyYyA9IG5hbWVcbiAgICAgICAgICA/IEREUC5yYW5kb21TdHJlYW0oJy9jb2xsZWN0aW9uLycgKyBuYW1lKVxuICAgICAgICAgIDogUmFuZG9tLmluc2VjdXJlO1xuICAgICAgICByZXR1cm4gc3JjLmlkKCk7XG4gICAgICB9O1xuICAgICAgYnJlYWs7XG4gIH1cblxuICB0aGlzLl90cmFuc2Zvcm0gPSBMb2NhbENvbGxlY3Rpb24ud3JhcFRyYW5zZm9ybShvcHRpb25zLnRyYW5zZm9ybSk7XG5cbiAgdGhpcy5yZXNvbHZlclR5cGUgPSBvcHRpb25zLnJlc29sdmVyVHlwZTtcblxuICBpZiAoIW5hbWUgfHwgb3B0aW9ucy5jb25uZWN0aW9uID09PSBudWxsKVxuICAgIC8vIG5vdGU6IG5hbWVsZXNzIGNvbGxlY3Rpb25zIG5ldmVyIGhhdmUgYSBjb25uZWN0aW9uXG4gICAgdGhpcy5fY29ubmVjdGlvbiA9IG51bGw7XG4gIGVsc2UgaWYgKG9wdGlvbnMuY29ubmVjdGlvbikgdGhpcy5fY29ubmVjdGlvbiA9IG9wdGlvbnMuY29ubmVjdGlvbjtcbiAgZWxzZSBpZiAoTWV0ZW9yLmlzQ2xpZW50KSB0aGlzLl9jb25uZWN0aW9uID0gTWV0ZW9yLmNvbm5lY3Rpb247XG4gIGVsc2UgdGhpcy5fY29ubmVjdGlvbiA9IE1ldGVvci5zZXJ2ZXI7XG5cbiAgaWYgKCFvcHRpb25zLl9kcml2ZXIpIHtcbiAgICAvLyBYWFggVGhpcyBjaGVjayBhc3N1bWVzIHRoYXQgd2ViYXBwIGlzIGxvYWRlZCBzbyB0aGF0IE1ldGVvci5zZXJ2ZXIgIT09XG4gICAgLy8gbnVsbC4gV2Ugc2hvdWxkIGZ1bGx5IHN1cHBvcnQgdGhlIGNhc2Ugb2YgXCJ3YW50IHRvIHVzZSBhIE1vbmdvLWJhY2tlZFxuICAgIC8vIGNvbGxlY3Rpb24gZnJvbSBOb2RlIGNvZGUgd2l0aG91dCB3ZWJhcHBcIiwgYnV0IHdlIGRvbid0IHlldC5cbiAgICAvLyAjTWV0ZW9yU2VydmVyTnVsbFxuICAgIGlmIChcbiAgICAgIG5hbWUgJiZcbiAgICAgIHRoaXMuX2Nvbm5lY3Rpb24gPT09IE1ldGVvci5zZXJ2ZXIgJiZcbiAgICAgIHR5cGVvZiBNb25nb0ludGVybmFscyAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgIE1vbmdvSW50ZXJuYWxzLmRlZmF1bHRSZW1vdGVDb2xsZWN0aW9uRHJpdmVyXG4gICAgKSB7XG4gICAgICBvcHRpb25zLl9kcml2ZXIgPSBNb25nb0ludGVybmFscy5kZWZhdWx0UmVtb3RlQ29sbGVjdGlvbkRyaXZlcigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB7IExvY2FsQ29sbGVjdGlvbkRyaXZlciB9ID0gcmVxdWlyZSgnLi9sb2NhbF9jb2xsZWN0aW9uX2RyaXZlci5qcycpO1xuICAgICAgb3B0aW9ucy5fZHJpdmVyID0gTG9jYWxDb2xsZWN0aW9uRHJpdmVyO1xuICAgIH1cbiAgfVxuXG4gIHRoaXMuX2NvbGxlY3Rpb24gPSBvcHRpb25zLl9kcml2ZXIub3BlbihuYW1lLCB0aGlzLl9jb25uZWN0aW9uKTtcbiAgdGhpcy5fbmFtZSA9IG5hbWU7XG4gIHRoaXMuX2RyaXZlciA9IG9wdGlvbnMuX2RyaXZlcjtcblxuICAvLyBUT0RPW2ZpYmVyc106IF9tYXliZVNldFVwUmVwbGljYXRpb24gaXMgbm93IGFzeW5jLiBMZXQncyB3YXRjaCBob3cgbm90IHdhaXRpbmcgZm9yIHRoaXMgZnVuY3Rpb24gdG8gZmluaXNoXG4gICAgLy8gd2lsbCBhZmZlY3QgZXZlcnl0aGluZ1xuICB0aGlzLl9zZXR0aW5nVXBSZXBsaWNhdGlvblByb21pc2UgPSB0aGlzLl9tYXliZVNldFVwUmVwbGljYXRpb24obmFtZSwgb3B0aW9ucyk7XG5cbiAgLy8gWFhYIGRvbid0IGRlZmluZSB0aGVzZSB1bnRpbCBhbGxvdyBvciBkZW55IGlzIGFjdHVhbGx5IHVzZWQgZm9yIHRoaXNcbiAgLy8gY29sbGVjdGlvbi4gQ291bGQgYmUgaGFyZCBpZiB0aGUgc2VjdXJpdHkgcnVsZXMgYXJlIG9ubHkgZGVmaW5lZCBvbiB0aGVcbiAgLy8gc2VydmVyLlxuICBpZiAob3B0aW9ucy5kZWZpbmVNdXRhdGlvbk1ldGhvZHMgIT09IGZhbHNlKSB7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuX2RlZmluZU11dGF0aW9uTWV0aG9kcyh7XG4gICAgICAgIHVzZUV4aXN0aW5nOiBvcHRpb25zLl9zdXBwcmVzc1NhbWVOYW1lRXJyb3IgPT09IHRydWUsXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgLy8gVGhyb3cgYSBtb3JlIHVuZGVyc3RhbmRhYmxlIGVycm9yIG9uIHRoZSBzZXJ2ZXIgZm9yIHNhbWUgY29sbGVjdGlvbiBuYW1lXG4gICAgICBpZiAoXG4gICAgICAgIGVycm9yLm1lc3NhZ2UgPT09IGBBIG1ldGhvZCBuYW1lZCAnLyR7bmFtZX0vaW5zZXJ0QXN5bmMnIGlzIGFscmVhZHkgZGVmaW5lZGBcbiAgICAgIClcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaGVyZSBpcyBhbHJlYWR5IGEgY29sbGVjdGlvbiBuYW1lZCBcIiR7bmFtZX1cImApO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgLy8gYXV0b3B1Ymxpc2hcbiAgaWYgKFxuICAgIFBhY2thZ2UuYXV0b3B1Ymxpc2ggJiZcbiAgICAhb3B0aW9ucy5fcHJldmVudEF1dG9wdWJsaXNoICYmXG4gICAgdGhpcy5fY29ubmVjdGlvbiAmJlxuICAgIHRoaXMuX2Nvbm5lY3Rpb24ucHVibGlzaFxuICApIHtcbiAgICB0aGlzLl9jb25uZWN0aW9uLnB1Ymxpc2gobnVsbCwgKCkgPT4gdGhpcy5maW5kKCksIHtcbiAgICAgIGlzX2F1dG86IHRydWUsXG4gICAgfSk7XG4gIH1cblxuICBNb25nby5fY29sbGVjdGlvbnMuc2V0KHRoaXMuX25hbWUsIHRoaXMpO1xufTtcblxuT2JqZWN0LmFzc2lnbihNb25nby5Db2xsZWN0aW9uLnByb3RvdHlwZSwge1xuICBhc3luYyBfbWF5YmVTZXRVcFJlcGxpY2F0aW9uKG5hbWUpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBpZiAoXG4gICAgICAhKFxuICAgICAgICBzZWxmLl9jb25uZWN0aW9uICYmXG4gICAgICAgIHNlbGYuX2Nvbm5lY3Rpb24ucmVnaXN0ZXJTdG9yZUNsaWVudCAmJlxuICAgICAgICBzZWxmLl9jb25uZWN0aW9uLnJlZ2lzdGVyU3RvcmVTZXJ2ZXJcbiAgICAgIClcbiAgICApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cblxuICAgIGNvbnN0IHdyYXBwZWRTdG9yZUNvbW1vbiA9IHtcbiAgICAgIC8vIENhbGxlZCBhcm91bmQgbWV0aG9kIHN0dWIgaW52b2NhdGlvbnMgdG8gY2FwdHVyZSB0aGUgb3JpZ2luYWwgdmVyc2lvbnNcbiAgICAgIC8vIG9mIG1vZGlmaWVkIGRvY3VtZW50cy5cbiAgICAgIHNhdmVPcmlnaW5hbHMoKSB7XG4gICAgICAgIHNlbGYuX2NvbGxlY3Rpb24uc2F2ZU9yaWdpbmFscygpO1xuICAgICAgfSxcbiAgICAgIHJldHJpZXZlT3JpZ2luYWxzKCkge1xuICAgICAgICByZXR1cm4gc2VsZi5fY29sbGVjdGlvbi5yZXRyaWV2ZU9yaWdpbmFscygpO1xuICAgICAgfSxcbiAgICAgIC8vIFRvIGJlIGFibGUgdG8gZ2V0IGJhY2sgdG8gdGhlIGNvbGxlY3Rpb24gZnJvbSB0aGUgc3RvcmUuXG4gICAgICBfZ2V0Q29sbGVjdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHNlbGY7XG4gICAgICB9LFxuICAgIH07XG4gICAgY29uc3Qgd3JhcHBlZFN0b3JlQ2xpZW50ID0ge1xuICAgICAgLy8gQ2FsbGVkIGF0IHRoZSBiZWdpbm5pbmcgb2YgYSBiYXRjaCBvZiB1cGRhdGVzLiBiYXRjaFNpemUgaXMgdGhlIG51bWJlclxuICAgICAgLy8gb2YgdXBkYXRlIGNhbGxzIHRvIGV4cGVjdC5cbiAgICAgIC8vXG4gICAgICAvLyBYWFggVGhpcyBpbnRlcmZhY2UgaXMgcHJldHR5IGphbmt5LiByZXNldCBwcm9iYWJseSBvdWdodCB0byBnbyBiYWNrIHRvXG4gICAgICAvLyBiZWluZyBpdHMgb3duIGZ1bmN0aW9uLCBhbmQgY2FsbGVycyBzaG91bGRuJ3QgaGF2ZSB0byBjYWxjdWxhdGVcbiAgICAgIC8vIGJhdGNoU2l6ZS4gVGhlIG9wdGltaXphdGlvbiBvZiBub3QgY2FsbGluZyBwYXVzZS9yZW1vdmUgc2hvdWxkIGJlXG4gICAgICAvLyBkZWxheWVkIHVudGlsIGxhdGVyOiB0aGUgZmlyc3QgY2FsbCB0byB1cGRhdGUoKSBzaG91bGQgYnVmZmVyIGl0c1xuICAgICAgLy8gbWVzc2FnZSwgYW5kIHRoZW4gd2UgY2FuIGVpdGhlciBkaXJlY3RseSBhcHBseSBpdCBhdCBlbmRVcGRhdGUgdGltZSBpZlxuICAgICAgLy8gaXQgd2FzIHRoZSBvbmx5IHVwZGF0ZSwgb3IgZG8gcGF1c2VPYnNlcnZlcnMvYXBwbHkvYXBwbHkgYXQgdGhlIG5leHRcbiAgICAgIC8vIHVwZGF0ZSgpIGlmIHRoZXJlJ3MgYW5vdGhlciBvbmUuXG4gICAgICBhc3luYyBiZWdpblVwZGF0ZShiYXRjaFNpemUsIHJlc2V0KSB7XG4gICAgICAgIC8vIHBhdXNlIG9ic2VydmVycyBzbyB1c2VycyBkb24ndCBzZWUgZmxpY2tlciB3aGVuIHVwZGF0aW5nIHNldmVyYWxcbiAgICAgICAgLy8gb2JqZWN0cyBhdCBvbmNlIChpbmNsdWRpbmcgdGhlIHBvc3QtcmVjb25uZWN0IHJlc2V0LWFuZC1yZWFwcGx5XG4gICAgICAgIC8vIHN0YWdlKSwgYW5kIHNvIHRoYXQgYSByZS1zb3J0aW5nIG9mIGEgcXVlcnkgY2FuIHRha2UgYWR2YW50YWdlIG9mIHRoZVxuICAgICAgICAvLyBmdWxsIF9kaWZmUXVlcnkgbW92ZWQgY2FsY3VsYXRpb24gaW5zdGVhZCBvZiBhcHBseWluZyBjaGFuZ2Ugb25lIGF0IGFcbiAgICAgICAgLy8gdGltZS5cbiAgICAgICAgaWYgKGJhdGNoU2l6ZSA+IDEgfHwgcmVzZXQpIHNlbGYuX2NvbGxlY3Rpb24ucGF1c2VPYnNlcnZlcnMoKTtcblxuICAgICAgICBpZiAocmVzZXQpIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24ucmVtb3ZlKHt9KTtcbiAgICAgIH0sXG5cbiAgICAgIC8vIEFwcGx5IGFuIHVwZGF0ZS5cbiAgICAgIC8vIFhYWCBiZXR0ZXIgc3BlY2lmeSB0aGlzIGludGVyZmFjZSAobm90IGluIHRlcm1zIG9mIGEgd2lyZSBtZXNzYWdlKT9cbiAgICAgIHVwZGF0ZShtc2cpIHtcbiAgICAgICAgdmFyIG1vbmdvSWQgPSBNb25nb0lELmlkUGFyc2UobXNnLmlkKTtcbiAgICAgICAgdmFyIGRvYyA9IHNlbGYuX2NvbGxlY3Rpb24uX2RvY3MuZ2V0KG1vbmdvSWQpO1xuXG4gICAgICAgIC8vV2hlbiB0aGUgc2VydmVyJ3MgbWVyZ2Vib3ggaXMgZGlzYWJsZWQgZm9yIGEgY29sbGVjdGlvbiwgdGhlIGNsaWVudCBtdXN0IGdyYWNlZnVsbHkgaGFuZGxlIGl0IHdoZW46XG4gICAgICAgIC8vICpXZSByZWNlaXZlIGFuIGFkZGVkIG1lc3NhZ2UgZm9yIGEgZG9jdW1lbnQgdGhhdCBpcyBhbHJlYWR5IHRoZXJlLiBJbnN0ZWFkLCBpdCB3aWxsIGJlIGNoYW5nZWRcbiAgICAgICAgLy8gKldlIHJlZWl2ZSBhIGNoYW5nZSBtZXNzYWdlIGZvciBhIGRvY3VtZW50IHRoYXQgaXMgbm90IHRoZXJlLiBJbnN0ZWFkLCBpdCB3aWxsIGJlIGFkZGVkXG4gICAgICAgIC8vICpXZSByZWNlaXZlIGEgcmVtb3ZlZCBtZXNzc2FnZSBmb3IgYSBkb2N1bWVudCB0aGF0IGlzIG5vdCB0aGVyZS4gSW5zdGVhZCwgbm90aW5nIHdpbCBoYXBwZW4uXG5cbiAgICAgICAgLy9Db2RlIGlzIGRlcml2ZWQgZnJvbSBjbGllbnQtc2lkZSBjb2RlIG9yaWdpbmFsbHkgaW4gcGVlcmxpYnJhcnk6Y29udHJvbC1tZXJnZWJveFxuICAgICAgICAvL2h0dHBzOi8vZ2l0aHViLmNvbS9wZWVybGlicmFyeS9tZXRlb3ItY29udHJvbC1tZXJnZWJveC9ibG9iL21hc3Rlci9jbGllbnQuY29mZmVlXG5cbiAgICAgICAgLy9Gb3IgbW9yZSBpbmZvcm1hdGlvbiwgcmVmZXIgdG8gZGlzY3Vzc2lvbiBcIkluaXRpYWwgc3VwcG9ydCBmb3IgcHVibGljYXRpb24gc3RyYXRlZ2llcyBpbiBsaXZlZGF0YSBzZXJ2ZXJcIjpcbiAgICAgICAgLy9odHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9wdWxsLzExMTUxXG4gICAgICAgIGlmIChNZXRlb3IuaXNDbGllbnQpIHtcbiAgICAgICAgICBpZiAobXNnLm1zZyA9PT0gJ2FkZGVkJyAmJiBkb2MpIHtcbiAgICAgICAgICAgIG1zZy5tc2cgPSAnY2hhbmdlZCc7XG4gICAgICAgICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAncmVtb3ZlZCcgJiYgIWRvYykge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ2NoYW5nZWQnICYmICFkb2MpIHtcbiAgICAgICAgICAgIG1zZy5tc2cgPSAnYWRkZWQnO1xuICAgICAgICAgICAgY29uc3QgX3JlZiA9IG1zZy5maWVsZHM7XG4gICAgICAgICAgICBmb3IgKGxldCBmaWVsZCBpbiBfcmVmKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gX3JlZltmaWVsZF07XG4gICAgICAgICAgICAgIGlmICh2YWx1ZSA9PT0gdm9pZCAwKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIG1zZy5maWVsZHNbZmllbGRdO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIElzIHRoaXMgYSBcInJlcGxhY2UgdGhlIHdob2xlIGRvY1wiIG1lc3NhZ2UgY29taW5nIGZyb20gdGhlIHF1aWVzY2VuY2VcbiAgICAgICAgLy8gb2YgbWV0aG9kIHdyaXRlcyB0byBhbiBvYmplY3Q/IChOb3RlIHRoYXQgJ3VuZGVmaW5lZCcgaXMgYSB2YWxpZFxuICAgICAgICAvLyB2YWx1ZSBtZWFuaW5nIFwicmVtb3ZlIGl0XCIuKVxuICAgICAgICBpZiAobXNnLm1zZyA9PT0gJ3JlcGxhY2UnKSB7XG4gICAgICAgICAgdmFyIHJlcGxhY2UgPSBtc2cucmVwbGFjZTtcbiAgICAgICAgICBpZiAoIXJlcGxhY2UpIHtcbiAgICAgICAgICAgIGlmIChkb2MpIHNlbGYuX2NvbGxlY3Rpb24ucmVtb3ZlKG1vbmdvSWQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoIWRvYykge1xuICAgICAgICAgICAgc2VsZi5fY29sbGVjdGlvbi5pbnNlcnQocmVwbGFjZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFhYWCBjaGVjayB0aGF0IHJlcGxhY2UgaGFzIG5vICQgb3BzXG4gICAgICAgICAgICBzZWxmLl9jb2xsZWN0aW9uLnVwZGF0ZShtb25nb0lkLCByZXBsYWNlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdhZGRlZCcpIHtcbiAgICAgICAgICBpZiAoZG9jKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICdFeHBlY3RlZCBub3QgdG8gZmluZCBhIGRvY3VtZW50IGFscmVhZHkgcHJlc2VudCBmb3IgYW4gYWRkJ1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc2VsZi5fY29sbGVjdGlvbi5pbnNlcnQoeyBfaWQ6IG1vbmdvSWQsIC4uLm1zZy5maWVsZHMgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ3JlbW92ZWQnKSB7XG4gICAgICAgICAgaWYgKCFkb2MpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICdFeHBlY3RlZCB0byBmaW5kIGEgZG9jdW1lbnQgYWxyZWFkeSBwcmVzZW50IGZvciByZW1vdmVkJ1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICBzZWxmLl9jb2xsZWN0aW9uLnJlbW92ZShtb25nb0lkKTtcbiAgICAgICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAnY2hhbmdlZCcpIHtcbiAgICAgICAgICBpZiAoIWRvYykgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCB0byBmaW5kIGEgZG9jdW1lbnQgdG8gY2hhbmdlJyk7XG4gICAgICAgICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKG1zZy5maWVsZHMpO1xuICAgICAgICAgIGlmIChrZXlzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHZhciBtb2RpZmllciA9IHt9O1xuICAgICAgICAgICAga2V5cy5mb3JFYWNoKGtleSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gbXNnLmZpZWxkc1trZXldO1xuICAgICAgICAgICAgICBpZiAoRUpTT04uZXF1YWxzKGRvY1trZXldLCB2YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICBpZiAoIW1vZGlmaWVyLiR1bnNldCkge1xuICAgICAgICAgICAgICAgICAgbW9kaWZpZXIuJHVuc2V0ID0ge307XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG1vZGlmaWVyLiR1bnNldFtrZXldID0gMTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoIW1vZGlmaWVyLiRzZXQpIHtcbiAgICAgICAgICAgICAgICAgIG1vZGlmaWVyLiRzZXQgPSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbW9kaWZpZXIuJHNldFtrZXldID0gdmFsdWU7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKE9iamVjdC5rZXlzKG1vZGlmaWVyKS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIHNlbGYuX2NvbGxlY3Rpb24udXBkYXRlKG1vbmdvSWQsIG1vZGlmaWVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSSBkb24ndCBrbm93IGhvdyB0byBkZWFsIHdpdGggdGhpcyBtZXNzYWdlXCIpO1xuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAvLyBDYWxsZWQgYXQgdGhlIGVuZCBvZiBhIGJhdGNoIG9mIHVwZGF0ZXMubGl2ZWRhdGFfY29ubmVjdGlvbi5qczoxMjg3XG4gICAgICBlbmRVcGRhdGUoKSB7XG4gICAgICAgIHNlbGYuX2NvbGxlY3Rpb24ucmVzdW1lT2JzZXJ2ZXJzQ2xpZW50KCk7XG4gICAgICB9LFxuXG4gICAgICAvLyBVc2VkIHRvIHByZXNlcnZlIGN1cnJlbnQgdmVyc2lvbnMgb2YgZG9jdW1lbnRzIGFjcm9zcyBhIHN0b3JlIHJlc2V0LlxuICAgICAgZ2V0RG9jKGlkKSB7XG4gICAgICAgIHJldHVybiBzZWxmLmZpbmRPbmUoaWQpO1xuICAgICAgfSxcblxuICAgICAgLi4ud3JhcHBlZFN0b3JlQ29tbW9uLFxuICAgIH07XG4gICAgY29uc3Qgd3JhcHBlZFN0b3JlU2VydmVyID0ge1xuICAgICAgYXN5bmMgYmVnaW5VcGRhdGUoYmF0Y2hTaXplLCByZXNldCkge1xuICAgICAgICBpZiAoYmF0Y2hTaXplID4gMSB8fCByZXNldCkgc2VsZi5fY29sbGVjdGlvbi5wYXVzZU9ic2VydmVycygpO1xuXG4gICAgICAgIGlmIChyZXNldCkgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5yZW1vdmVBc3luYyh7fSk7XG4gICAgICB9LFxuXG4gICAgICBhc3luYyB1cGRhdGUobXNnKSB7XG4gICAgICAgIHZhciBtb25nb0lkID0gTW9uZ29JRC5pZFBhcnNlKG1zZy5pZCk7XG4gICAgICAgIHZhciBkb2MgPSBzZWxmLl9jb2xsZWN0aW9uLl9kb2NzLmdldChtb25nb0lkKTtcblxuICAgICAgICAvLyBJcyB0aGlzIGEgXCJyZXBsYWNlIHRoZSB3aG9sZSBkb2NcIiBtZXNzYWdlIGNvbWluZyBmcm9tIHRoZSBxdWllc2NlbmNlXG4gICAgICAgIC8vIG9mIG1ldGhvZCB3cml0ZXMgdG8gYW4gb2JqZWN0PyAoTm90ZSB0aGF0ICd1bmRlZmluZWQnIGlzIGEgdmFsaWRcbiAgICAgICAgLy8gdmFsdWUgbWVhbmluZyBcInJlbW92ZSBpdFwiLilcbiAgICAgICAgaWYgKG1zZy5tc2cgPT09ICdyZXBsYWNlJykge1xuICAgICAgICAgIHZhciByZXBsYWNlID0gbXNnLnJlcGxhY2U7XG4gICAgICAgICAgaWYgKCFyZXBsYWNlKSB7XG4gICAgICAgICAgICBpZiAoZG9jKSBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLnJlbW92ZUFzeW5jKG1vbmdvSWQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoIWRvYykge1xuICAgICAgICAgICAgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5pbnNlcnRBc3luYyhyZXBsYWNlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gWFhYIGNoZWNrIHRoYXQgcmVwbGFjZSBoYXMgbm8gJCBvcHNcbiAgICAgICAgICAgIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24udXBkYXRlQXN5bmMobW9uZ29JZCwgcmVwbGFjZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAnYWRkZWQnKSB7XG4gICAgICAgICAgaWYgKGRvYykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAnRXhwZWN0ZWQgbm90IHRvIGZpbmQgYSBkb2N1bWVudCBhbHJlYWR5IHByZXNlbnQgZm9yIGFuIGFkZCdcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24uaW5zZXJ0QXN5bmMoeyBfaWQ6IG1vbmdvSWQsIC4uLm1zZy5maWVsZHMgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ3JlbW92ZWQnKSB7XG4gICAgICAgICAgaWYgKCFkb2MpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICdFeHBlY3RlZCB0byBmaW5kIGEgZG9jdW1lbnQgYWxyZWFkeSBwcmVzZW50IGZvciByZW1vdmVkJ1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLnJlbW92ZUFzeW5jKG1vbmdvSWQpO1xuICAgICAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdjaGFuZ2VkJykge1xuICAgICAgICAgIGlmICghZG9jKSB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIHRvIGZpbmQgYSBkb2N1bWVudCB0byBjaGFuZ2UnKTtcbiAgICAgICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMobXNnLmZpZWxkcyk7XG4gICAgICAgICAgaWYgKGtleXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdmFyIG1vZGlmaWVyID0ge307XG4gICAgICAgICAgICBrZXlzLmZvckVhY2goa2V5ID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBtc2cuZmllbGRzW2tleV07XG4gICAgICAgICAgICAgIGlmIChFSlNPTi5lcXVhbHMoZG9jW2tleV0sIHZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIGlmICghbW9kaWZpZXIuJHVuc2V0KSB7XG4gICAgICAgICAgICAgICAgICBtb2RpZmllci4kdW5zZXQgPSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbW9kaWZpZXIuJHVuc2V0W2tleV0gPSAxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICghbW9kaWZpZXIuJHNldCkge1xuICAgICAgICAgICAgICAgICAgbW9kaWZpZXIuJHNldCA9IHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBtb2RpZmllci4kc2V0W2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMobW9kaWZpZXIpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi51cGRhdGVBc3luYyhtb25nb0lkLCBtb2RpZmllcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkkgZG9uJ3Qga25vdyBob3cgdG8gZGVhbCB3aXRoIHRoaXMgbWVzc2FnZVwiKTtcbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgLy8gQ2FsbGVkIGF0IHRoZSBlbmQgb2YgYSBiYXRjaCBvZiB1cGRhdGVzLlxuICAgICAgYXN5bmMgZW5kVXBkYXRlKCkge1xuICAgICAgICBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLnJlc3VtZU9ic2VydmVyc1NlcnZlcigpO1xuICAgICAgfSxcblxuICAgICAgLy8gVXNlZCB0byBwcmVzZXJ2ZSBjdXJyZW50IHZlcnNpb25zIG9mIGRvY3VtZW50cyBhY3Jvc3MgYSBzdG9yZSByZXNldC5cbiAgICAgIGFzeW5jIGdldERvYyhpZCkge1xuICAgICAgICByZXR1cm4gc2VsZi5maW5kT25lQXN5bmMoaWQpO1xuICAgICAgfSxcbiAgICAgIC4uLndyYXBwZWRTdG9yZUNvbW1vbixcbiAgICB9O1xuXG5cbiAgICAvLyBPSywgd2UncmUgZ29pbmcgdG8gYmUgYSBzbGF2ZSwgcmVwbGljYXRpbmcgc29tZSByZW1vdGVcbiAgICAvLyBkYXRhYmFzZSwgZXhjZXB0IHBvc3NpYmx5IHdpdGggc29tZSB0ZW1wb3JhcnkgZGl2ZXJnZW5jZSB3aGlsZVxuICAgIC8vIHdlIGhhdmUgdW5hY2tub3dsZWRnZWQgUlBDJ3MuXG4gICAgbGV0IHJlZ2lzdGVyU3RvcmVSZXN1bHQ7XG4gICAgaWYgKE1ldGVvci5pc0NsaWVudCkge1xuICAgICAgcmVnaXN0ZXJTdG9yZVJlc3VsdCA9IHNlbGYuX2Nvbm5lY3Rpb24ucmVnaXN0ZXJTdG9yZUNsaWVudChcbiAgICAgICAgbmFtZSxcbiAgICAgICAgd3JhcHBlZFN0b3JlQ2xpZW50XG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICByZWdpc3RlclN0b3JlUmVzdWx0ID0gc2VsZi5fY29ubmVjdGlvbi5yZWdpc3RlclN0b3JlU2VydmVyKFxuICAgICAgICBuYW1lLFxuICAgICAgICB3cmFwcGVkU3RvcmVTZXJ2ZXJcbiAgICAgICk7XG4gICAgfVxuXG4gICAgY29uc3QgbWVzc2FnZSA9IGBUaGVyZSBpcyBhbHJlYWR5IGEgY29sbGVjdGlvbiBuYW1lZCBcIiR7bmFtZX1cImA7XG4gICAgY29uc3QgbG9nV2FybiA9ICgpID0+IHtcbiAgICAgIGNvbnNvbGUud2FybiA/IGNvbnNvbGUud2FybihtZXNzYWdlKSA6IGNvbnNvbGUubG9nKG1lc3NhZ2UpO1xuICAgIH07XG5cbiAgICBpZiAoIXJlZ2lzdGVyU3RvcmVSZXN1bHQpIHtcbiAgICAgIHJldHVybiBsb2dXYXJuKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlZ2lzdGVyU3RvcmVSZXN1bHQ/LnRoZW4/LihvayA9PiB7XG4gICAgICBpZiAoIW9rKSB7XG4gICAgICAgIGxvZ1dhcm4oKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcblxuICAvLy9cbiAgLy8vIE1haW4gY29sbGVjdGlvbiBBUElcbiAgLy8vXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBHZXRzIHRoZSBudW1iZXIgb2YgZG9jdW1lbnRzIG1hdGNoaW5nIHRoZSBmaWx0ZXIuIEZvciBhIGZhc3QgY291bnQgb2YgdGhlIHRvdGFsIGRvY3VtZW50cyBpbiBhIGNvbGxlY3Rpb24gc2VlIGBlc3RpbWF0ZWREb2N1bWVudENvdW50YC5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgY291bnREb2N1bWVudHNcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gW3NlbGVjdG9yXSBBIHF1ZXJ5IGRlc2NyaWJpbmcgdGhlIGRvY3VtZW50cyB0byBjb3VudFxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIEFsbCBvcHRpb25zIGFyZSBsaXN0ZWQgaW4gW01vbmdvREIgZG9jdW1lbnRhdGlvbl0oaHR0cHM6Ly9tb25nb2RiLmdpdGh1Yi5pby9ub2RlLW1vbmdvZGItbmF0aXZlLzQuMTEvaW50ZXJmYWNlcy9Db3VudERvY3VtZW50c09wdGlvbnMuaHRtbCkuIFBsZWFzZSBub3RlIHRoYXQgbm90IGFsbCBvZiB0aGVtIGFyZSBhdmFpbGFibGUgb24gdGhlIGNsaWVudC5cbiAgICogQHJldHVybnMge1Byb21pc2U8bnVtYmVyPn1cbiAgICovXG4gIGNvdW50RG9jdW1lbnRzKC4uLmFyZ3MpIHtcbiAgICByZXR1cm4gdGhpcy5fY29sbGVjdGlvbi5jb3VudERvY3VtZW50cyguLi5hcmdzKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgR2V0cyBhbiBlc3RpbWF0ZSBvZiB0aGUgY291bnQgb2YgZG9jdW1lbnRzIGluIGEgY29sbGVjdGlvbiB1c2luZyBjb2xsZWN0aW9uIG1ldGFkYXRhLiBGb3IgYW4gZXhhY3QgY291bnQgb2YgdGhlIGRvY3VtZW50cyBpbiBhIGNvbGxlY3Rpb24gc2VlIGBjb3VudERvY3VtZW50c2AuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIGVzdGltYXRlZERvY3VtZW50Q291bnRcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc10gQWxsIG9wdGlvbnMgYXJlIGxpc3RlZCBpbiBbTW9uZ29EQiBkb2N1bWVudGF0aW9uXShodHRwczovL21vbmdvZGIuZ2l0aHViLmlvL25vZGUtbW9uZ29kYi1uYXRpdmUvNC4xMS9pbnRlcmZhY2VzL0VzdGltYXRlZERvY3VtZW50Q291bnRPcHRpb25zLmh0bWwpLiBQbGVhc2Ugbm90ZSB0aGF0IG5vdCBhbGwgb2YgdGhlbSBhcmUgYXZhaWxhYmxlIG9uIHRoZSBjbGllbnQuXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPG51bWJlcj59XG4gICAqL1xuICBlc3RpbWF0ZWREb2N1bWVudENvdW50KC4uLmFyZ3MpIHtcbiAgICByZXR1cm4gdGhpcy5fY29sbGVjdGlvbi5lc3RpbWF0ZWREb2N1bWVudENvdW50KC4uLmFyZ3MpO1xuICB9LFxuXG4gIF9nZXRGaW5kU2VsZWN0b3IoYXJncykge1xuICAgIGlmIChhcmdzLmxlbmd0aCA9PSAwKSByZXR1cm4ge307XG4gICAgZWxzZSByZXR1cm4gYXJnc1swXTtcbiAgfSxcblxuICBfZ2V0RmluZE9wdGlvbnMoYXJncykge1xuICAgIGNvbnN0IFssIG9wdGlvbnNdID0gYXJncyB8fCBbXTtcbiAgICBjb25zdCBuZXdPcHRpb25zID0gbm9ybWFsaXplUHJvamVjdGlvbihvcHRpb25zKTtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoYXJncy5sZW5ndGggPCAyKSB7XG4gICAgICByZXR1cm4geyB0cmFuc2Zvcm06IHNlbGYuX3RyYW5zZm9ybSB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBjaGVjayhcbiAgICAgICAgbmV3T3B0aW9ucyxcbiAgICAgICAgTWF0Y2guT3B0aW9uYWwoXG4gICAgICAgICAgTWF0Y2guT2JqZWN0SW5jbHVkaW5nKHtcbiAgICAgICAgICAgIHByb2plY3Rpb246IE1hdGNoLk9wdGlvbmFsKE1hdGNoLk9uZU9mKE9iamVjdCwgdW5kZWZpbmVkKSksXG4gICAgICAgICAgICBzb3J0OiBNYXRjaC5PcHRpb25hbChcbiAgICAgICAgICAgICAgTWF0Y2guT25lT2YoT2JqZWN0LCBBcnJheSwgRnVuY3Rpb24sIHVuZGVmaW5lZClcbiAgICAgICAgICAgICksXG4gICAgICAgICAgICBsaW1pdDogTWF0Y2guT3B0aW9uYWwoTWF0Y2guT25lT2YoTnVtYmVyLCB1bmRlZmluZWQpKSxcbiAgICAgICAgICAgIHNraXA6IE1hdGNoLk9wdGlvbmFsKE1hdGNoLk9uZU9mKE51bWJlciwgdW5kZWZpbmVkKSksXG4gICAgICAgICAgfSlcbiAgICAgICAgKVxuICAgICAgKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHJhbnNmb3JtOiBzZWxmLl90cmFuc2Zvcm0sXG4gICAgICAgIC4uLm5ld09wdGlvbnMsXG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgRmluZCB0aGUgZG9jdW1lbnRzIGluIGEgY29sbGVjdGlvbiB0aGF0IG1hdGNoIHRoZSBzZWxlY3Rvci5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgZmluZFxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtNb25nb1NlbGVjdG9yfSBbc2VsZWN0b3JdIEEgcXVlcnkgZGVzY3JpYmluZyB0aGUgZG9jdW1lbnRzIHRvIGZpbmRcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiBAcGFyYW0ge01vbmdvU29ydFNwZWNpZmllcn0gb3B0aW9ucy5zb3J0IFNvcnQgb3JkZXIgKGRlZmF1bHQ6IG5hdHVyYWwgb3JkZXIpXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLnNraXAgTnVtYmVyIG9mIHJlc3VsdHMgdG8gc2tpcCBhdCB0aGUgYmVnaW5uaW5nXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLmxpbWl0IE1heGltdW0gbnVtYmVyIG9mIHJlc3VsdHMgdG8gcmV0dXJuXG4gICAqIEBwYXJhbSB7TW9uZ29GaWVsZFNwZWNpZmllcn0gb3B0aW9ucy5maWVsZHMgRGljdGlvbmFyeSBvZiBmaWVsZHMgdG8gcmV0dXJuIG9yIGV4Y2x1ZGUuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5yZWFjdGl2ZSAoQ2xpZW50IG9ubHkpIERlZmF1bHQgYHRydWVgOyBwYXNzIGBmYWxzZWAgdG8gZGlzYWJsZSByZWFjdGl2aXR5XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbnMudHJhbnNmb3JtIE92ZXJyaWRlcyBgdHJhbnNmb3JtYCBvbiB0aGUgIFtgQ29sbGVjdGlvbmBdKCNjb2xsZWN0aW9ucykgZm9yIHRoaXMgY3Vyc29yLiAgUGFzcyBgbnVsbGAgdG8gZGlzYWJsZSB0cmFuc2Zvcm1hdGlvbi5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLmRpc2FibGVPcGxvZyAoU2VydmVyIG9ubHkpIFBhc3MgdHJ1ZSB0byBkaXNhYmxlIG9wbG9nLXRhaWxpbmcgb24gdGhpcyBxdWVyeS4gVGhpcyBhZmZlY3RzIHRoZSB3YXkgc2VydmVyIHByb2Nlc3NlcyBjYWxscyB0byBgb2JzZXJ2ZWAgb24gdGhpcyBxdWVyeS4gRGlzYWJsaW5nIHRoZSBvcGxvZyBjYW4gYmUgdXNlZnVsIHdoZW4gd29ya2luZyB3aXRoIGRhdGEgdGhhdCB1cGRhdGVzIGluIGxhcmdlIGJhdGNoZXMuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLnBvbGxpbmdJbnRlcnZhbE1zIChTZXJ2ZXIgb25seSkgV2hlbiBvcGxvZyBpcyBkaXNhYmxlZCAodGhyb3VnaCB0aGUgdXNlIG9mIGBkaXNhYmxlT3Bsb2dgIG9yIHdoZW4gb3RoZXJ3aXNlIG5vdCBhdmFpbGFibGUpLCB0aGUgZnJlcXVlbmN5IChpbiBtaWxsaXNlY29uZHMpIG9mIGhvdyBvZnRlbiB0byBwb2xsIHRoaXMgcXVlcnkgd2hlbiBvYnNlcnZpbmcgb24gdGhlIHNlcnZlci4gRGVmYXVsdHMgdG8gMTAwMDBtcyAoMTAgc2Vjb25kcykuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLnBvbGxpbmdUaHJvdHRsZU1zIChTZXJ2ZXIgb25seSkgV2hlbiBvcGxvZyBpcyBkaXNhYmxlZCAodGhyb3VnaCB0aGUgdXNlIG9mIGBkaXNhYmxlT3Bsb2dgIG9yIHdoZW4gb3RoZXJ3aXNlIG5vdCBhdmFpbGFibGUpLCB0aGUgbWluaW11bSB0aW1lIChpbiBtaWxsaXNlY29uZHMpIHRvIGFsbG93IGJldHdlZW4gcmUtcG9sbGluZyB3aGVuIG9ic2VydmluZyBvbiB0aGUgc2VydmVyLiBJbmNyZWFzaW5nIHRoaXMgd2lsbCBzYXZlIENQVSBhbmQgbW9uZ28gbG9hZCBhdCB0aGUgZXhwZW5zZSBvZiBzbG93ZXIgdXBkYXRlcyB0byB1c2Vycy4gRGVjcmVhc2luZyB0aGlzIGlzIG5vdCByZWNvbW1lbmRlZC4gRGVmYXVsdHMgdG8gNTBtcy5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IG9wdGlvbnMubWF4VGltZU1zIChTZXJ2ZXIgb25seSkgSWYgc2V0LCBpbnN0cnVjdHMgTW9uZ29EQiB0byBzZXQgYSB0aW1lIGxpbWl0IGZvciB0aGlzIGN1cnNvcidzIG9wZXJhdGlvbnMuIElmIHRoZSBvcGVyYXRpb24gcmVhY2hlcyB0aGUgc3BlY2lmaWVkIHRpbWUgbGltaXQgKGluIG1pbGxpc2Vjb25kcykgd2l0aG91dCB0aGUgaGF2aW5nIGJlZW4gY29tcGxldGVkLCBhbiBleGNlcHRpb24gd2lsbCBiZSB0aHJvd24uIFVzZWZ1bCB0byBwcmV2ZW50IGFuIChhY2NpZGVudGFsIG9yIG1hbGljaW91cykgdW5vcHRpbWl6ZWQgcXVlcnkgZnJvbSBjYXVzaW5nIGEgZnVsbCBjb2xsZWN0aW9uIHNjYW4gdGhhdCB3b3VsZCBkaXNydXB0IG90aGVyIGRhdGFiYXNlIHVzZXJzLCBhdCB0aGUgZXhwZW5zZSBvZiBuZWVkaW5nIHRvIGhhbmRsZSB0aGUgcmVzdWx0aW5nIGVycm9yLlxuICAgKiBAcGFyYW0ge1N0cmluZ3xPYmplY3R9IG9wdGlvbnMuaGludCAoU2VydmVyIG9ubHkpIE92ZXJyaWRlcyBNb25nb0RCJ3MgZGVmYXVsdCBpbmRleCBzZWxlY3Rpb24gYW5kIHF1ZXJ5IG9wdGltaXphdGlvbiBwcm9jZXNzLiBTcGVjaWZ5IGFuIGluZGV4IHRvIGZvcmNlIGl0cyB1c2UsIGVpdGhlciBieSBpdHMgbmFtZSBvciBpbmRleCBzcGVjaWZpY2F0aW9uLiBZb3UgY2FuIGFsc28gc3BlY2lmeSBgeyAkbmF0dXJhbCA6IDEgfWAgdG8gZm9yY2UgYSBmb3J3YXJkcyBjb2xsZWN0aW9uIHNjYW4sIG9yIGB7ICRuYXR1cmFsIDogLTEgfWAgZm9yIGEgcmV2ZXJzZSBjb2xsZWN0aW9uIHNjYW4uIFNldHRpbmcgdGhpcyBpcyBvbmx5IHJlY29tbWVuZGVkIGZvciBhZHZhbmNlZCB1c2Vycy5cbiAgICogQHBhcmFtIHtTdHJpbmd9IG9wdGlvbnMucmVhZFByZWZlcmVuY2UgKFNlcnZlciBvbmx5KSBTcGVjaWZpZXMgYSBjdXN0b20gTW9uZ29EQiBbYHJlYWRQcmVmZXJlbmNlYF0oaHR0cHM6Ly9kb2NzLm1vbmdvZGIuY29tL21hbnVhbC9jb3JlL3JlYWQtcHJlZmVyZW5jZSkgZm9yIHRoaXMgcGFydGljdWxhciBjdXJzb3IuIFBvc3NpYmxlIHZhbHVlcyBhcmUgYHByaW1hcnlgLCBgcHJpbWFyeVByZWZlcnJlZGAsIGBzZWNvbmRhcnlgLCBgc2Vjb25kYXJ5UHJlZmVycmVkYCBhbmQgYG5lYXJlc3RgLlxuICAgKiBAcmV0dXJucyB7TW9uZ28uQ3Vyc29yfVxuICAgKi9cbiAgZmluZCguLi5hcmdzKSB7XG4gICAgLy8gQ29sbGVjdGlvbi5maW5kKCkgKHJldHVybiBhbGwgZG9jcykgYmVoYXZlcyBkaWZmZXJlbnRseVxuICAgIC8vIGZyb20gQ29sbGVjdGlvbi5maW5kKHVuZGVmaW5lZCkgKHJldHVybiAwIGRvY3MpLiAgc28gYmVcbiAgICAvLyBjYXJlZnVsIGFib3V0IHRoZSBsZW5ndGggb2YgYXJndW1lbnRzLlxuICAgIHJldHVybiB0aGlzLl9jb2xsZWN0aW9uLmZpbmQoXG4gICAgICB0aGlzLl9nZXRGaW5kU2VsZWN0b3IoYXJncyksXG4gICAgICB0aGlzLl9nZXRGaW5kT3B0aW9ucyhhcmdzKVxuICAgICk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEZpbmRzIHRoZSBmaXJzdCBkb2N1bWVudCB0aGF0IG1hdGNoZXMgdGhlIHNlbGVjdG9yLCBhcyBvcmRlcmVkIGJ5IHNvcnQgYW5kIHNraXAgb3B0aW9ucy4gUmV0dXJucyBgdW5kZWZpbmVkYCBpZiBubyBtYXRjaGluZyBkb2N1bWVudCBpcyBmb3VuZC5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgZmluZE9uZUFzeW5jXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge01vbmdvU2VsZWN0b3J9IFtzZWxlY3Rvcl0gQSBxdWVyeSBkZXNjcmliaW5nIHRoZSBkb2N1bWVudHMgdG8gZmluZFxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIEBwYXJhbSB7TW9uZ29Tb3J0U3BlY2lmaWVyfSBvcHRpb25zLnNvcnQgU29ydCBvcmRlciAoZGVmYXVsdDogbmF0dXJhbCBvcmRlcilcbiAgICogQHBhcmFtIHtOdW1iZXJ9IG9wdGlvbnMuc2tpcCBOdW1iZXIgb2YgcmVzdWx0cyB0byBza2lwIGF0IHRoZSBiZWdpbm5pbmdcbiAgICogQHBhcmFtIHtNb25nb0ZpZWxkU3BlY2lmaWVyfSBvcHRpb25zLmZpZWxkcyBEaWN0aW9uYXJ5IG9mIGZpZWxkcyB0byByZXR1cm4gb3IgZXhjbHVkZS5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnJlYWN0aXZlIChDbGllbnQgb25seSkgRGVmYXVsdCB0cnVlOyBwYXNzIGZhbHNlIHRvIGRpc2FibGUgcmVhY3Rpdml0eVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLnRyYW5zZm9ybSBPdmVycmlkZXMgYHRyYW5zZm9ybWAgb24gdGhlIFtgQ29sbGVjdGlvbmBdKCNjb2xsZWN0aW9ucykgZm9yIHRoaXMgY3Vyc29yLiAgUGFzcyBgbnVsbGAgdG8gZGlzYWJsZSB0cmFuc2Zvcm1hdGlvbi5cbiAgICogQHBhcmFtIHtTdHJpbmd9IG9wdGlvbnMucmVhZFByZWZlcmVuY2UgKFNlcnZlciBvbmx5KSBTcGVjaWZpZXMgYSBjdXN0b20gTW9uZ29EQiBbYHJlYWRQcmVmZXJlbmNlYF0oaHR0cHM6Ly9kb2NzLm1vbmdvZGIuY29tL21hbnVhbC9jb3JlL3JlYWQtcHJlZmVyZW5jZSkgZm9yIGZldGNoaW5nIHRoZSBkb2N1bWVudC4gUG9zc2libGUgdmFsdWVzIGFyZSBgcHJpbWFyeWAsIGBwcmltYXJ5UHJlZmVycmVkYCwgYHNlY29uZGFyeWAsIGBzZWNvbmRhcnlQcmVmZXJyZWRgIGFuZCBgbmVhcmVzdGAuXG4gICAqIEByZXR1cm5zIHtPYmplY3R9XG4gICAqL1xuICBmaW5kT25lQXN5bmMoLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLl9jb2xsZWN0aW9uLmZpbmRPbmVBc3luYyhcbiAgICAgIHRoaXMuX2dldEZpbmRTZWxlY3RvcihhcmdzKSxcbiAgICAgIHRoaXMuX2dldEZpbmRPcHRpb25zKGFyZ3MpXG4gICAgKTtcbiAgfSxcbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEZpbmRzIHRoZSBmaXJzdCBkb2N1bWVudCB0aGF0IG1hdGNoZXMgdGhlIHNlbGVjdG9yLCBhcyBvcmRlcmVkIGJ5IHNvcnQgYW5kIHNraXAgb3B0aW9ucy4gUmV0dXJucyBgdW5kZWZpbmVkYCBpZiBubyBtYXRjaGluZyBkb2N1bWVudCBpcyBmb3VuZC5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgZmluZE9uZVxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtNb25nb1NlbGVjdG9yfSBbc2VsZWN0b3JdIEEgcXVlcnkgZGVzY3JpYmluZyB0aGUgZG9jdW1lbnRzIHRvIGZpbmRcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiBAcGFyYW0ge01vbmdvU29ydFNwZWNpZmllcn0gb3B0aW9ucy5zb3J0IFNvcnQgb3JkZXIgKGRlZmF1bHQ6IG5hdHVyYWwgb3JkZXIpXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLnNraXAgTnVtYmVyIG9mIHJlc3VsdHMgdG8gc2tpcCBhdCB0aGUgYmVnaW5uaW5nXG4gICAqIEBwYXJhbSB7TW9uZ29GaWVsZFNwZWNpZmllcn0gb3B0aW9ucy5maWVsZHMgRGljdGlvbmFyeSBvZiBmaWVsZHMgdG8gcmV0dXJuIG9yIGV4Y2x1ZGUuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5yZWFjdGl2ZSAoQ2xpZW50IG9ubHkpIERlZmF1bHQgdHJ1ZTsgcGFzcyBmYWxzZSB0byBkaXNhYmxlIHJlYWN0aXZpdHlcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0aW9ucy50cmFuc2Zvcm0gT3ZlcnJpZGVzIGB0cmFuc2Zvcm1gIG9uIHRoZSBbYENvbGxlY3Rpb25gXSgjY29sbGVjdGlvbnMpIGZvciB0aGlzIGN1cnNvci4gIFBhc3MgYG51bGxgIHRvIGRpc2FibGUgdHJhbnNmb3JtYXRpb24uXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBvcHRpb25zLnJlYWRQcmVmZXJlbmNlIChTZXJ2ZXIgb25seSkgU3BlY2lmaWVzIGEgY3VzdG9tIE1vbmdvREIgW2ByZWFkUHJlZmVyZW5jZWBdKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvY29yZS9yZWFkLXByZWZlcmVuY2UpIGZvciBmZXRjaGluZyB0aGUgZG9jdW1lbnQuIFBvc3NpYmxlIHZhbHVlcyBhcmUgYHByaW1hcnlgLCBgcHJpbWFyeVByZWZlcnJlZGAsIGBzZWNvbmRhcnlgLCBgc2Vjb25kYXJ5UHJlZmVycmVkYCBhbmQgYG5lYXJlc3RgLlxuICAgKiBAcmV0dXJucyB7T2JqZWN0fVxuICAgKi9cbiAgZmluZE9uZSguLi5hcmdzKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbGxlY3Rpb24uZmluZE9uZShcbiAgICAgIHRoaXMuX2dldEZpbmRTZWxlY3RvcihhcmdzKSxcbiAgICAgIHRoaXMuX2dldEZpbmRPcHRpb25zKGFyZ3MpXG4gICAgKTtcbiAgfSxcbn0pO1xuXG5PYmplY3QuYXNzaWduKE1vbmdvLkNvbGxlY3Rpb24sIHtcbiAgYXN5bmMgX3B1Ymxpc2hDdXJzb3IoY3Vyc29yLCBzdWIsIGNvbGxlY3Rpb24pIHtcbiAgICB2YXIgb2JzZXJ2ZUhhbmRsZSA9IGF3YWl0IGN1cnNvci5vYnNlcnZlQ2hhbmdlcyhcbiAgICAgICAge1xuICAgICAgICAgIGFkZGVkOiBmdW5jdGlvbihpZCwgZmllbGRzKSB7XG4gICAgICAgICAgICBzdWIuYWRkZWQoY29sbGVjdGlvbiwgaWQsIGZpZWxkcyk7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBjaGFuZ2VkOiBmdW5jdGlvbihpZCwgZmllbGRzKSB7XG4gICAgICAgICAgICBzdWIuY2hhbmdlZChjb2xsZWN0aW9uLCBpZCwgZmllbGRzKTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHJlbW92ZWQ6IGZ1bmN0aW9uKGlkKSB7XG4gICAgICAgICAgICBzdWIucmVtb3ZlZChjb2xsZWN0aW9uLCBpZCk7XG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgLy8gUHVibGljYXRpb25zIGRvbid0IG11dGF0ZSB0aGUgZG9jdW1lbnRzXG4gICAgICAgIC8vIFRoaXMgaXMgdGVzdGVkIGJ5IHRoZSBgbGl2ZWRhdGEgLSBwdWJsaXNoIGNhbGxiYWNrcyBjbG9uZWAgdGVzdFxuICAgICAgICB7IG5vbk11dGF0aW5nQ2FsbGJhY2tzOiB0cnVlIH1cbiAgICApO1xuXG4gICAgLy8gV2UgZG9uJ3QgY2FsbCBzdWIucmVhZHkoKSBoZXJlOiBpdCBnZXRzIGNhbGxlZCBpbiBsaXZlZGF0YV9zZXJ2ZXIsIGFmdGVyXG4gICAgLy8gcG9zc2libHkgY2FsbGluZyBfcHVibGlzaEN1cnNvciBvbiBtdWx0aXBsZSByZXR1cm5lZCBjdXJzb3JzLlxuXG4gICAgLy8gcmVnaXN0ZXIgc3RvcCBjYWxsYmFjayAoZXhwZWN0cyBsYW1iZGEgdy8gbm8gYXJncykuXG4gICAgc3ViLm9uU3RvcChhc3luYyBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBhd2FpdCBvYnNlcnZlSGFuZGxlLnN0b3AoKTtcbiAgICB9KTtcblxuICAgIC8vIHJldHVybiB0aGUgb2JzZXJ2ZUhhbmRsZSBpbiBjYXNlIGl0IG5lZWRzIHRvIGJlIHN0b3BwZWQgZWFybHlcbiAgICByZXR1cm4gb2JzZXJ2ZUhhbmRsZTtcbiAgfSxcblxuICAvLyBwcm90ZWN0IGFnYWluc3QgZGFuZ2Vyb3VzIHNlbGVjdG9ycy4gIGZhbHNleSBhbmQge19pZDogZmFsc2V5fSBhcmUgYm90aFxuICAvLyBsaWtlbHkgcHJvZ3JhbW1lciBlcnJvciwgYW5kIG5vdCB3aGF0IHlvdSB3YW50LCBwYXJ0aWN1bGFybHkgZm9yIGRlc3RydWN0aXZlXG4gIC8vIG9wZXJhdGlvbnMuIElmIGEgZmFsc2V5IF9pZCBpcyBzZW50IGluLCBhIG5ldyBzdHJpbmcgX2lkIHdpbGwgYmVcbiAgLy8gZ2VuZXJhdGVkIGFuZCByZXR1cm5lZDsgaWYgYSBmYWxsYmFja0lkIGlzIHByb3ZpZGVkLCBpdCB3aWxsIGJlIHJldHVybmVkXG4gIC8vIGluc3RlYWQuXG4gIF9yZXdyaXRlU2VsZWN0b3Ioc2VsZWN0b3IsIHsgZmFsbGJhY2tJZCB9ID0ge30pIHtcbiAgICAvLyBzaG9ydGhhbmQgLS0gc2NhbGFycyBtYXRjaCBfaWRcbiAgICBpZiAoTG9jYWxDb2xsZWN0aW9uLl9zZWxlY3RvcklzSWQoc2VsZWN0b3IpKSBzZWxlY3RvciA9IHsgX2lkOiBzZWxlY3RvciB9O1xuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoc2VsZWN0b3IpKSB7XG4gICAgICAvLyBUaGlzIGlzIGNvbnNpc3RlbnQgd2l0aCB0aGUgTW9uZ28gY29uc29sZSBpdHNlbGY7IGlmIHdlIGRvbid0IGRvIHRoaXNcbiAgICAgIC8vIGNoZWNrIHBhc3NpbmcgYW4gZW1wdHkgYXJyYXkgZW5kcyB1cCBzZWxlY3RpbmcgYWxsIGl0ZW1zXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNb25nbyBzZWxlY3RvciBjYW4ndCBiZSBhbiBhcnJheS5cIik7XG4gICAgfVxuXG4gICAgaWYgKCFzZWxlY3RvciB8fCAoJ19pZCcgaW4gc2VsZWN0b3IgJiYgIXNlbGVjdG9yLl9pZCkpIHtcbiAgICAgIC8vIGNhbid0IG1hdGNoIGFueXRoaW5nXG4gICAgICByZXR1cm4geyBfaWQ6IGZhbGxiYWNrSWQgfHwgUmFuZG9tLmlkKCkgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gc2VsZWN0b3I7XG4gIH0sXG59KTtcblxuT2JqZWN0LmFzc2lnbihNb25nby5Db2xsZWN0aW9uLnByb3RvdHlwZSwge1xuICAvLyAnaW5zZXJ0JyBpbW1lZGlhdGVseSByZXR1cm5zIHRoZSBpbnNlcnRlZCBkb2N1bWVudCdzIG5ldyBfaWQuXG4gIC8vIFRoZSBvdGhlcnMgcmV0dXJuIHZhbHVlcyBpbW1lZGlhdGVseSBpZiB5b3UgYXJlIGluIGEgc3R1YiwgYW4gaW4tbWVtb3J5XG4gIC8vIHVubWFuYWdlZCBjb2xsZWN0aW9uLCBvciBhIG1vbmdvLWJhY2tlZCBjb2xsZWN0aW9uIGFuZCB5b3UgZG9uJ3QgcGFzcyBhXG4gIC8vIGNhbGxiYWNrLiAndXBkYXRlJyBhbmQgJ3JlbW92ZScgcmV0dXJuIHRoZSBudW1iZXIgb2YgYWZmZWN0ZWRcbiAgLy8gZG9jdW1lbnRzLiAndXBzZXJ0JyByZXR1cm5zIGFuIG9iamVjdCB3aXRoIGtleXMgJ251bWJlckFmZmVjdGVkJyBhbmQsIGlmIGFuXG4gIC8vIGluc2VydCBoYXBwZW5lZCwgJ2luc2VydGVkSWQnLlxuICAvL1xuICAvLyBPdGhlcndpc2UsIHRoZSBzZW1hbnRpY3MgYXJlIGV4YWN0bHkgbGlrZSBvdGhlciBtZXRob2RzOiB0aGV5IHRha2VcbiAgLy8gYSBjYWxsYmFjayBhcyBhbiBvcHRpb25hbCBsYXN0IGFyZ3VtZW50OyBpZiBubyBjYWxsYmFjayBpc1xuICAvLyBwcm92aWRlZCwgdGhleSBibG9jayB1bnRpbCB0aGUgb3BlcmF0aW9uIGlzIGNvbXBsZXRlLCBhbmQgdGhyb3cgYW5cbiAgLy8gZXhjZXB0aW9uIGlmIGl0IGZhaWxzOyBpZiBhIGNhbGxiYWNrIGlzIHByb3ZpZGVkLCB0aGVuIHRoZXkgZG9uJ3RcbiAgLy8gbmVjZXNzYXJpbHkgYmxvY2ssIGFuZCB0aGV5IGNhbGwgdGhlIGNhbGxiYWNrIHdoZW4gdGhleSBmaW5pc2ggd2l0aCBlcnJvciBhbmRcbiAgLy8gcmVzdWx0IGFyZ3VtZW50cy4gIChUaGUgaW5zZXJ0IG1ldGhvZCBwcm92aWRlcyB0aGUgZG9jdW1lbnQgSUQgYXMgaXRzIHJlc3VsdDtcbiAgLy8gdXBkYXRlIGFuZCByZW1vdmUgcHJvdmlkZSB0aGUgbnVtYmVyIG9mIGFmZmVjdGVkIGRvY3MgYXMgdGhlIHJlc3VsdDsgdXBzZXJ0XG4gIC8vIHByb3ZpZGVzIGFuIG9iamVjdCB3aXRoIG51bWJlckFmZmVjdGVkIGFuZCBtYXliZSBpbnNlcnRlZElkLilcbiAgLy9cbiAgLy8gT24gdGhlIGNsaWVudCwgYmxvY2tpbmcgaXMgaW1wb3NzaWJsZSwgc28gaWYgYSBjYWxsYmFja1xuICAvLyBpc24ndCBwcm92aWRlZCwgdGhleSBqdXN0IHJldHVybiBpbW1lZGlhdGVseSBhbmQgYW55IGVycm9yXG4gIC8vIGluZm9ybWF0aW9uIGlzIGxvc3QuXG4gIC8vXG4gIC8vIFRoZXJlJ3Mgb25lIG1vcmUgdHdlYWsuIE9uIHRoZSBjbGllbnQsIGlmIHlvdSBkb24ndCBwcm92aWRlIGFcbiAgLy8gY2FsbGJhY2ssIHRoZW4gaWYgdGhlcmUgaXMgYW4gZXJyb3IsIGEgbWVzc2FnZSB3aWxsIGJlIGxvZ2dlZCB3aXRoXG4gIC8vIE1ldGVvci5fZGVidWcuXG4gIC8vXG4gIC8vIFRoZSBpbnRlbnQgKHRob3VnaCB0aGlzIGlzIGFjdHVhbGx5IGRldGVybWluZWQgYnkgdGhlIHVuZGVybHlpbmdcbiAgLy8gZHJpdmVycykgaXMgdGhhdCB0aGUgb3BlcmF0aW9ucyBzaG91bGQgYmUgZG9uZSBzeW5jaHJvbm91c2x5LCBub3RcbiAgLy8gZ2VuZXJhdGluZyB0aGVpciByZXN1bHQgdW50aWwgdGhlIGRhdGFiYXNlIGhhcyBhY2tub3dsZWRnZWRcbiAgLy8gdGhlbS4gSW4gdGhlIGZ1dHVyZSBtYXliZSB3ZSBzaG91bGQgcHJvdmlkZSBhIGZsYWcgdG8gdHVybiB0aGlzXG4gIC8vIG9mZi5cblxuICBfaW5zZXJ0KGRvYywgY2FsbGJhY2spIHtcbiAgICAvLyBNYWtlIHN1cmUgd2Ugd2VyZSBwYXNzZWQgYSBkb2N1bWVudCB0byBpbnNlcnRcbiAgICBpZiAoIWRvYykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnNlcnQgcmVxdWlyZXMgYW4gYXJndW1lbnQnKTtcbiAgICB9XG5cblxuICAgIC8vIE1ha2UgYSBzaGFsbG93IGNsb25lIG9mIHRoZSBkb2N1bWVudCwgcHJlc2VydmluZyBpdHMgcHJvdG90eXBlLlxuICAgIGRvYyA9IE9iamVjdC5jcmVhdGUoXG4gICAgICBPYmplY3QuZ2V0UHJvdG90eXBlT2YoZG9jKSxcbiAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzKGRvYylcbiAgICApO1xuXG4gICAgaWYgKCdfaWQnIGluIGRvYykge1xuICAgICAgaWYgKFxuICAgICAgICAhZG9jLl9pZCB8fFxuICAgICAgICAhKHR5cGVvZiBkb2MuX2lkID09PSAnc3RyaW5nJyB8fCBkb2MuX2lkIGluc3RhbmNlb2YgTW9uZ28uT2JqZWN0SUQpXG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICdNZXRlb3IgcmVxdWlyZXMgZG9jdW1lbnQgX2lkIGZpZWxkcyB0byBiZSBub24tZW1wdHkgc3RyaW5ncyBvciBPYmplY3RJRHMnXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBnZW5lcmF0ZUlkID0gdHJ1ZTtcblxuICAgICAgLy8gRG9uJ3QgZ2VuZXJhdGUgdGhlIGlkIGlmIHdlJ3JlIHRoZSBjbGllbnQgYW5kIHRoZSAnb3V0ZXJtb3N0JyBjYWxsXG4gICAgICAvLyBUaGlzIG9wdGltaXphdGlvbiBzYXZlcyB1cyBwYXNzaW5nIGJvdGggdGhlIHJhbmRvbVNlZWQgYW5kIHRoZSBpZFxuICAgICAgLy8gUGFzc2luZyBib3RoIGlzIHJlZHVuZGFudC5cbiAgICAgIGlmICh0aGlzLl9pc1JlbW90ZUNvbGxlY3Rpb24oKSkge1xuICAgICAgICBjb25zdCBlbmNsb3NpbmcgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLmdldCgpO1xuICAgICAgICBpZiAoIWVuY2xvc2luZykge1xuICAgICAgICAgIGdlbmVyYXRlSWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZ2VuZXJhdGVJZCkge1xuICAgICAgICBkb2MuX2lkID0gdGhpcy5fbWFrZU5ld0lEKCk7XG4gICAgICB9XG4gICAgfVxuXG5cbiAgICAvLyBPbiBpbnNlcnRzLCBhbHdheXMgcmV0dXJuIHRoZSBpZCB0aGF0IHdlIGdlbmVyYXRlZDsgb24gYWxsIG90aGVyXG4gICAgLy8gb3BlcmF0aW9ucywganVzdCByZXR1cm4gdGhlIHJlc3VsdCBmcm9tIHRoZSBjb2xsZWN0aW9uLlxuICAgIHZhciBjaG9vc2VSZXR1cm5WYWx1ZUZyb21Db2xsZWN0aW9uUmVzdWx0ID0gZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICBpZiAoTWV0ZW9yLl9pc1Byb21pc2UocmVzdWx0KSkgcmV0dXJuIHJlc3VsdDtcblxuICAgICAgaWYgKGRvYy5faWQpIHtcbiAgICAgICAgcmV0dXJuIGRvYy5faWQ7XG4gICAgICB9XG5cbiAgICAgIC8vIFhYWCB3aGF0IGlzIHRoaXMgZm9yPz9cbiAgICAgIC8vIEl0J3Mgc29tZSBpdGVyYWN0aW9uIGJldHdlZW4gdGhlIGNhbGxiYWNrIHRvIF9jYWxsTXV0YXRvck1ldGhvZCBhbmRcbiAgICAgIC8vIHRoZSByZXR1cm4gdmFsdWUgY29udmVyc2lvblxuICAgICAgZG9jLl9pZCA9IHJlc3VsdDtcblxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuXG4gICAgY29uc3Qgd3JhcHBlZENhbGxiYWNrID0gd3JhcENhbGxiYWNrKFxuICAgICAgY2FsbGJhY2ssXG4gICAgICBjaG9vc2VSZXR1cm5WYWx1ZUZyb21Db2xsZWN0aW9uUmVzdWx0XG4gICAgKTtcblxuICAgIGlmICh0aGlzLl9pc1JlbW90ZUNvbGxlY3Rpb24oKSkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5fY2FsbE11dGF0b3JNZXRob2QoJ2luc2VydCcsIFtkb2NdLCB3cmFwcGVkQ2FsbGJhY2spO1xuICAgICAgcmV0dXJuIGNob29zZVJldHVyblZhbHVlRnJvbUNvbGxlY3Rpb25SZXN1bHQocmVzdWx0KTtcbiAgICB9XG5cbiAgICAvLyBpdCdzIG15IGNvbGxlY3Rpb24uICBkZXNjZW5kIGludG8gdGhlIGNvbGxlY3Rpb24gb2JqZWN0XG4gICAgLy8gYW5kIHByb3BhZ2F0ZSBhbnkgZXhjZXB0aW9uLlxuICAgIHRyeSB7XG4gICAgICAvLyBJZiB0aGUgdXNlciBwcm92aWRlZCBhIGNhbGxiYWNrIGFuZCB0aGUgY29sbGVjdGlvbiBpbXBsZW1lbnRzIHRoaXNcbiAgICAgIC8vIG9wZXJhdGlvbiBhc3luY2hyb25vdXNseSwgdGhlbiBxdWVyeVJldCB3aWxsIGJlIHVuZGVmaW5lZCwgYW5kIHRoZVxuICAgICAgLy8gcmVzdWx0IHdpbGwgYmUgcmV0dXJuZWQgdGhyb3VnaCB0aGUgY2FsbGJhY2sgaW5zdGVhZC5cbiAgICAgIGxldCByZXN1bHQ7XG4gICAgICBpZiAoISF3cmFwcGVkQ2FsbGJhY2spIHtcbiAgICAgICAgdGhpcy5fY29sbGVjdGlvbi5pbnNlcnQoZG9jLCB3cmFwcGVkQ2FsbGJhY2spO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gSWYgd2UgZG9uJ3QgaGF2ZSB0aGUgY2FsbGJhY2ssIHdlIGFzc3VtZSB0aGUgdXNlciBpcyB1c2luZyB0aGUgcHJvbWlzZS5cbiAgICAgICAgLy8gV2UgY2FuJ3QganVzdCBwYXNzIHRoaXMuX2NvbGxlY3Rpb24uaW5zZXJ0IHRvIHRoZSBwcm9taXNpZnkgYmVjYXVzZSBpdCB3b3VsZCBsb3NlIHRoZSBjb250ZXh0LlxuICAgICAgICByZXN1bHQgPSB0aGlzLl9jb2xsZWN0aW9uLmluc2VydChkb2MpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gY2hvb3NlUmV0dXJuVmFsdWVGcm9tQ29sbGVjdGlvblJlc3VsdChyZXN1bHQpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayhlKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgSW5zZXJ0IGEgZG9jdW1lbnQgaW4gdGhlIGNvbGxlY3Rpb24uICBSZXR1cm5zIGl0cyB1bmlxdWUgX2lkLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCAgaW5zZXJ0XG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge09iamVjdH0gZG9jIFRoZSBkb2N1bWVudCB0byBpbnNlcnQuIE1heSBub3QgeWV0IGhhdmUgYW4gX2lkIGF0dHJpYnV0ZSwgaW4gd2hpY2ggY2FzZSBNZXRlb3Igd2lsbCBnZW5lcmF0ZSBvbmUgZm9yIHlvdS5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSBPcHRpb25hbC4gIElmIHByZXNlbnQsIGNhbGxlZCB3aXRoIGFuIGVycm9yIG9iamVjdCBhcyB0aGUgZmlyc3QgYXJndW1lbnQgYW5kLCBpZiBubyBlcnJvciwgdGhlIF9pZCBhcyB0aGUgc2Vjb25kLlxuICAgKi9cbiAgaW5zZXJ0KGRvYywgY2FsbGJhY2spIHtcbiAgICByZXR1cm4gdGhpcy5faW5zZXJ0KGRvYywgY2FsbGJhY2spO1xuICB9LFxuXG4gIF9pbnNlcnRBc3luYyhkb2MsIG9wdGlvbnMgPSB7fSkge1xuICAgIC8vIE1ha2Ugc3VyZSB3ZSB3ZXJlIHBhc3NlZCBhIGRvY3VtZW50IHRvIGluc2VydFxuICAgIGlmICghZG9jKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2luc2VydCByZXF1aXJlcyBhbiBhcmd1bWVudCcpO1xuICAgIH1cblxuICAgIC8vIE1ha2UgYSBzaGFsbG93IGNsb25lIG9mIHRoZSBkb2N1bWVudCwgcHJlc2VydmluZyBpdHMgcHJvdG90eXBlLlxuICAgIGRvYyA9IE9iamVjdC5jcmVhdGUoXG4gICAgICAgIE9iamVjdC5nZXRQcm90b3R5cGVPZihkb2MpLFxuICAgICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycyhkb2MpXG4gICAgKTtcblxuICAgIGlmICgnX2lkJyBpbiBkb2MpIHtcbiAgICAgIGlmIChcbiAgICAgICAgICAhZG9jLl9pZCB8fFxuICAgICAgICAgICEodHlwZW9mIGRvYy5faWQgPT09ICdzdHJpbmcnIHx8IGRvYy5faWQgaW5zdGFuY2VvZiBNb25nby5PYmplY3RJRClcbiAgICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAnTWV0ZW9yIHJlcXVpcmVzIGRvY3VtZW50IF9pZCBmaWVsZHMgdG8gYmUgbm9uLWVtcHR5IHN0cmluZ3Mgb3IgT2JqZWN0SURzJ1xuICAgICAgICApO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgZ2VuZXJhdGVJZCA9IHRydWU7XG5cbiAgICAgIC8vIERvbid0IGdlbmVyYXRlIHRoZSBpZCBpZiB3ZSdyZSB0aGUgY2xpZW50IGFuZCB0aGUgJ291dGVybW9zdCcgY2FsbFxuICAgICAgLy8gVGhpcyBvcHRpbWl6YXRpb24gc2F2ZXMgdXMgcGFzc2luZyBib3RoIHRoZSByYW5kb21TZWVkIGFuZCB0aGUgaWRcbiAgICAgIC8vIFBhc3NpbmcgYm90aCBpcyByZWR1bmRhbnQuXG4gICAgICBpZiAodGhpcy5faXNSZW1vdGVDb2xsZWN0aW9uKCkpIHtcbiAgICAgICAgY29uc3QgZW5jbG9zaW5nID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5nZXQoKTtcbiAgICAgICAgaWYgKCFlbmNsb3NpbmcpIHtcbiAgICAgICAgICBnZW5lcmF0ZUlkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGdlbmVyYXRlSWQpIHtcbiAgICAgICAgZG9jLl9pZCA9IHRoaXMuX21ha2VOZXdJRCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE9uIGluc2VydHMsIGFsd2F5cyByZXR1cm4gdGhlIGlkIHRoYXQgd2UgZ2VuZXJhdGVkOyBvbiBhbGwgb3RoZXJcbiAgICAvLyBvcGVyYXRpb25zLCBqdXN0IHJldHVybiB0aGUgcmVzdWx0IGZyb20gdGhlIGNvbGxlY3Rpb24uXG4gICAgdmFyIGNob29zZVJldHVyblZhbHVlRnJvbUNvbGxlY3Rpb25SZXN1bHQgPSBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgIGlmIChNZXRlb3IuX2lzUHJvbWlzZShyZXN1bHQpKSByZXR1cm4gcmVzdWx0O1xuXG4gICAgICBpZiAoZG9jLl9pZCkge1xuICAgICAgICByZXR1cm4gZG9jLl9pZDtcbiAgICAgIH1cblxuICAgICAgLy8gWFhYIHdoYXQgaXMgdGhpcyBmb3I/P1xuICAgICAgLy8gSXQncyBzb21lIGl0ZXJhY3Rpb24gYmV0d2VlbiB0aGUgY2FsbGJhY2sgdG8gX2NhbGxNdXRhdG9yTWV0aG9kIGFuZFxuICAgICAgLy8gdGhlIHJldHVybiB2YWx1ZSBjb252ZXJzaW9uXG4gICAgICBkb2MuX2lkID0gcmVzdWx0O1xuXG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG5cbiAgICBpZiAodGhpcy5faXNSZW1vdGVDb2xsZWN0aW9uKCkpIHtcbiAgICAgIGNvbnN0IHByb21pc2UgPSB0aGlzLl9jYWxsTXV0YXRvck1ldGhvZEFzeW5jKCdpbnNlcnRBc3luYycsIFtkb2NdLCBvcHRpb25zKTtcbiAgICAgIHByb21pc2UudGhlbihjaG9vc2VSZXR1cm5WYWx1ZUZyb21Db2xsZWN0aW9uUmVzdWx0KTtcbiAgICAgIHByb21pc2Uuc3R1YlByb21pc2UgPSBwcm9taXNlLnN0dWJQcm9taXNlLnRoZW4oY2hvb3NlUmV0dXJuVmFsdWVGcm9tQ29sbGVjdGlvblJlc3VsdCk7XG4gICAgICBwcm9taXNlLnNlcnZlclByb21pc2UgPSBwcm9taXNlLnNlcnZlclByb21pc2UudGhlbihjaG9vc2VSZXR1cm5WYWx1ZUZyb21Db2xsZWN0aW9uUmVzdWx0KTtcbiAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cblxuICAgIC8vIGl0J3MgbXkgY29sbGVjdGlvbi4gIGRlc2NlbmQgaW50byB0aGUgY29sbGVjdGlvbiBvYmplY3RcbiAgICAvLyBhbmQgcHJvcGFnYXRlIGFueSBleGNlcHRpb24uXG4gICAgcmV0dXJuIHRoaXMuX2NvbGxlY3Rpb24uaW5zZXJ0QXN5bmMoZG9jKVxuICAgICAgLnRoZW4oY2hvb3NlUmV0dXJuVmFsdWVGcm9tQ29sbGVjdGlvblJlc3VsdCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEluc2VydCBhIGRvY3VtZW50IGluIHRoZSBjb2xsZWN0aW9uLiAgUmV0dXJucyBhIHByb21pc2UgdGhhdCB3aWxsIHJldHVybiB0aGUgZG9jdW1lbnQncyB1bmlxdWUgX2lkIHdoZW4gc29sdmVkLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCAgaW5zZXJ0XG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge09iamVjdH0gZG9jIFRoZSBkb2N1bWVudCB0byBpbnNlcnQuIE1heSBub3QgeWV0IGhhdmUgYW4gX2lkIGF0dHJpYnV0ZSwgaW4gd2hpY2ggY2FzZSBNZXRlb3Igd2lsbCBnZW5lcmF0ZSBvbmUgZm9yIHlvdS5cbiAgICovXG4gIGluc2VydEFzeW5jKGRvYywgb3B0aW9ucykge1xuICAgIHJldHVybiB0aGlzLl9pbnNlcnRBc3luYyhkb2MsIG9wdGlvbnMpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBNb2RpZnkgb25lIG9yIG1vcmUgZG9jdW1lbnRzIGluIHRoZSBjb2xsZWN0aW9uLiBSZXR1cm5zIHRoZSBudW1iZXIgb2YgbWF0Y2hlZCBkb2N1bWVudHMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIHVwZGF0ZVxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtNb25nb1NlbGVjdG9yfSBzZWxlY3RvciBTcGVjaWZpZXMgd2hpY2ggZG9jdW1lbnRzIHRvIG1vZGlmeVxuICAgKiBAcGFyYW0ge01vbmdvTW9kaWZpZXJ9IG1vZGlmaWVyIFNwZWNpZmllcyBob3cgdG8gbW9kaWZ5IHRoZSBkb2N1bWVudHNcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMubXVsdGkgVHJ1ZSB0byBtb2RpZnkgYWxsIG1hdGNoaW5nIGRvY3VtZW50czsgZmFsc2UgdG8gb25seSBtb2RpZnkgb25lIG9mIHRoZSBtYXRjaGluZyBkb2N1bWVudHMgKHRoZSBkZWZhdWx0KS5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnVwc2VydCBUcnVlIHRvIGluc2VydCBhIGRvY3VtZW50IGlmIG5vIG1hdGNoaW5nIGRvY3VtZW50cyBhcmUgZm91bmQuXG4gICAqIEBwYXJhbSB7QXJyYXl9IG9wdGlvbnMuYXJyYXlGaWx0ZXJzIE9wdGlvbmFsLiBVc2VkIGluIGNvbWJpbmF0aW9uIHdpdGggTW9uZ29EQiBbZmlsdGVyZWQgcG9zaXRpb25hbCBvcGVyYXRvcl0oaHR0cHM6Ly9kb2NzLm1vbmdvZGIuY29tL21hbnVhbC9yZWZlcmVuY2Uvb3BlcmF0b3IvdXBkYXRlL3Bvc2l0aW9uYWwtZmlsdGVyZWQvKSB0byBzcGVjaWZ5IHdoaWNoIGVsZW1lbnRzIHRvIG1vZGlmeSBpbiBhbiBhcnJheSBmaWVsZC5cbiAgICovXG4gIHVwZGF0ZUFzeW5jKHNlbGVjdG9yLCBtb2RpZmllciwgLi4ub3B0aW9uc0FuZENhbGxiYWNrKSB7XG5cbiAgICAvLyBXZSd2ZSBhbHJlYWR5IHBvcHBlZCBvZmYgdGhlIGNhbGxiYWNrLCBzbyB3ZSBhcmUgbGVmdCB3aXRoIGFuIGFycmF5XG4gICAgLy8gb2Ygb25lIG9yIHplcm8gaXRlbXNcbiAgICBjb25zdCBvcHRpb25zID0geyAuLi4ob3B0aW9uc0FuZENhbGxiYWNrWzBdIHx8IG51bGwpIH07XG4gICAgbGV0IGluc2VydGVkSWQ7XG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy51cHNlcnQpIHtcbiAgICAgIC8vIHNldCBgaW5zZXJ0ZWRJZGAgaWYgYWJzZW50LiAgYGluc2VydGVkSWRgIGlzIGEgTWV0ZW9yIGV4dGVuc2lvbi5cbiAgICAgIGlmIChvcHRpb25zLmluc2VydGVkSWQpIHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgICEoXG4gICAgICAgICAgICB0eXBlb2Ygb3B0aW9ucy5pbnNlcnRlZElkID09PSAnc3RyaW5nJyB8fFxuICAgICAgICAgICAgb3B0aW9ucy5pbnNlcnRlZElkIGluc3RhbmNlb2YgTW9uZ28uT2JqZWN0SURcbiAgICAgICAgICApXG4gICAgICAgIClcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2luc2VydGVkSWQgbXVzdCBiZSBzdHJpbmcgb3IgT2JqZWN0SUQnKTtcbiAgICAgICAgaW5zZXJ0ZWRJZCA9IG9wdGlvbnMuaW5zZXJ0ZWRJZDtcbiAgICAgIH0gZWxzZSBpZiAoIXNlbGVjdG9yIHx8ICFzZWxlY3Rvci5faWQpIHtcbiAgICAgICAgaW5zZXJ0ZWRJZCA9IHRoaXMuX21ha2VOZXdJRCgpO1xuICAgICAgICBvcHRpb25zLmdlbmVyYXRlZElkID0gdHJ1ZTtcbiAgICAgICAgb3B0aW9ucy5pbnNlcnRlZElkID0gaW5zZXJ0ZWRJZDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBzZWxlY3RvciA9IE1vbmdvLkNvbGxlY3Rpb24uX3Jld3JpdGVTZWxlY3RvcihzZWxlY3Rvciwge1xuICAgICAgZmFsbGJhY2tJZDogaW5zZXJ0ZWRJZCxcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLl9pc1JlbW90ZUNvbGxlY3Rpb24oKSkge1xuICAgICAgY29uc3QgYXJncyA9IFtzZWxlY3RvciwgbW9kaWZpZXIsIG9wdGlvbnNdO1xuXG4gICAgICByZXR1cm4gdGhpcy5fY2FsbE11dGF0b3JNZXRob2RBc3luYygndXBkYXRlQXN5bmMnLCBhcmdzLCBvcHRpb25zKTtcbiAgICB9XG5cbiAgICAvLyBpdCdzIG15IGNvbGxlY3Rpb24uICBkZXNjZW5kIGludG8gdGhlIGNvbGxlY3Rpb24gb2JqZWN0XG4gICAgLy8gYW5kIHByb3BhZ2F0ZSBhbnkgZXhjZXB0aW9uLlxuICAgICAgLy8gSWYgdGhlIHVzZXIgcHJvdmlkZWQgYSBjYWxsYmFjayBhbmQgdGhlIGNvbGxlY3Rpb24gaW1wbGVtZW50cyB0aGlzXG4gICAgICAvLyBvcGVyYXRpb24gYXN5bmNocm9ub3VzbHksIHRoZW4gcXVlcnlSZXQgd2lsbCBiZSB1bmRlZmluZWQsIGFuZCB0aGVcbiAgICAgIC8vIHJlc3VsdCB3aWxsIGJlIHJldHVybmVkIHRocm91Z2ggdGhlIGNhbGxiYWNrIGluc3RlYWQuXG5cbiAgICByZXR1cm4gdGhpcy5fY29sbGVjdGlvbi51cGRhdGVBc3luYyhcbiAgICAgIHNlbGVjdG9yLFxuICAgICAgbW9kaWZpZXIsXG4gICAgICBvcHRpb25zXG4gICAgKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgQXN5bmNocm9ub3VzbHkgbW9kaWZpZXMgb25lIG9yIG1vcmUgZG9jdW1lbnRzIGluIHRoZSBjb2xsZWN0aW9uLiBSZXR1cm5zIHRoZSBudW1iZXIgb2YgbWF0Y2hlZCBkb2N1bWVudHMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIHVwZGF0ZVxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtNb25nb1NlbGVjdG9yfSBzZWxlY3RvciBTcGVjaWZpZXMgd2hpY2ggZG9jdW1lbnRzIHRvIG1vZGlmeVxuICAgKiBAcGFyYW0ge01vbmdvTW9kaWZpZXJ9IG1vZGlmaWVyIFNwZWNpZmllcyBob3cgdG8gbW9kaWZ5IHRoZSBkb2N1bWVudHNcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMubXVsdGkgVHJ1ZSB0byBtb2RpZnkgYWxsIG1hdGNoaW5nIGRvY3VtZW50czsgZmFsc2UgdG8gb25seSBtb2RpZnkgb25lIG9mIHRoZSBtYXRjaGluZyBkb2N1bWVudHMgKHRoZSBkZWZhdWx0KS5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnVwc2VydCBUcnVlIHRvIGluc2VydCBhIGRvY3VtZW50IGlmIG5vIG1hdGNoaW5nIGRvY3VtZW50cyBhcmUgZm91bmQuXG4gICAqIEBwYXJhbSB7QXJyYXl9IG9wdGlvbnMuYXJyYXlGaWx0ZXJzIE9wdGlvbmFsLiBVc2VkIGluIGNvbWJpbmF0aW9uIHdpdGggTW9uZ29EQiBbZmlsdGVyZWQgcG9zaXRpb25hbCBvcGVyYXRvcl0oaHR0cHM6Ly9kb2NzLm1vbmdvZGIuY29tL21hbnVhbC9yZWZlcmVuY2Uvb3BlcmF0b3IvdXBkYXRlL3Bvc2l0aW9uYWwtZmlsdGVyZWQvKSB0byBzcGVjaWZ5IHdoaWNoIGVsZW1lbnRzIHRvIG1vZGlmeSBpbiBhbiBhcnJheSBmaWVsZC5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSBPcHRpb25hbC4gIElmIHByZXNlbnQsIGNhbGxlZCB3aXRoIGFuIGVycm9yIG9iamVjdCBhcyB0aGUgZmlyc3QgYXJndW1lbnQgYW5kLCBpZiBubyBlcnJvciwgdGhlIG51bWJlciBvZiBhZmZlY3RlZCBkb2N1bWVudHMgYXMgdGhlIHNlY29uZC5cbiAgICovXG4gIHVwZGF0ZShzZWxlY3RvciwgbW9kaWZpZXIsIC4uLm9wdGlvbnNBbmRDYWxsYmFjaykge1xuICAgIGNvbnN0IGNhbGxiYWNrID0gcG9wQ2FsbGJhY2tGcm9tQXJncyhvcHRpb25zQW5kQ2FsbGJhY2spO1xuXG4gICAgLy8gV2UndmUgYWxyZWFkeSBwb3BwZWQgb2ZmIHRoZSBjYWxsYmFjaywgc28gd2UgYXJlIGxlZnQgd2l0aCBhbiBhcnJheVxuICAgIC8vIG9mIG9uZSBvciB6ZXJvIGl0ZW1zXG4gICAgY29uc3Qgb3B0aW9ucyA9IHsgLi4uKG9wdGlvbnNBbmRDYWxsYmFja1swXSB8fCBudWxsKSB9O1xuICAgIGxldCBpbnNlcnRlZElkO1xuICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMudXBzZXJ0KSB7XG4gICAgICAvLyBzZXQgYGluc2VydGVkSWRgIGlmIGFic2VudC4gIGBpbnNlcnRlZElkYCBpcyBhIE1ldGVvciBleHRlbnNpb24uXG4gICAgICBpZiAob3B0aW9ucy5pbnNlcnRlZElkKSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAhKFxuICAgICAgICAgICAgdHlwZW9mIG9wdGlvbnMuaW5zZXJ0ZWRJZCA9PT0gJ3N0cmluZycgfHxcbiAgICAgICAgICAgIG9wdGlvbnMuaW5zZXJ0ZWRJZCBpbnN0YW5jZW9mIE1vbmdvLk9iamVjdElEXG4gICAgICAgICAgKVxuICAgICAgICApXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnNlcnRlZElkIG11c3QgYmUgc3RyaW5nIG9yIE9iamVjdElEJyk7XG4gICAgICAgIGluc2VydGVkSWQgPSBvcHRpb25zLmluc2VydGVkSWQ7XG4gICAgICB9IGVsc2UgaWYgKCFzZWxlY3RvciB8fCAhc2VsZWN0b3IuX2lkKSB7XG4gICAgICAgIGluc2VydGVkSWQgPSB0aGlzLl9tYWtlTmV3SUQoKTtcbiAgICAgICAgb3B0aW9ucy5nZW5lcmF0ZWRJZCA9IHRydWU7XG4gICAgICAgIG9wdGlvbnMuaW5zZXJ0ZWRJZCA9IGluc2VydGVkSWQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgc2VsZWN0b3IgPSBNb25nby5Db2xsZWN0aW9uLl9yZXdyaXRlU2VsZWN0b3Ioc2VsZWN0b3IsIHtcbiAgICAgIGZhbGxiYWNrSWQ6IGluc2VydGVkSWQsXG4gICAgfSk7XG5cbiAgICBjb25zdCB3cmFwcGVkQ2FsbGJhY2sgPSB3cmFwQ2FsbGJhY2soY2FsbGJhY2spO1xuXG4gICAgaWYgKHRoaXMuX2lzUmVtb3RlQ29sbGVjdGlvbigpKSB7XG4gICAgICBjb25zdCBhcmdzID0gW3NlbGVjdG9yLCBtb2RpZmllciwgb3B0aW9uc107XG4gICAgICByZXR1cm4gdGhpcy5fY2FsbE11dGF0b3JNZXRob2QoJ3VwZGF0ZScsIGFyZ3MsIGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICAvLyBpdCdzIG15IGNvbGxlY3Rpb24uICBkZXNjZW5kIGludG8gdGhlIGNvbGxlY3Rpb24gb2JqZWN0XG4gICAgLy8gYW5kIHByb3BhZ2F0ZSBhbnkgZXhjZXB0aW9uLlxuICAgIC8vIElmIHRoZSB1c2VyIHByb3ZpZGVkIGEgY2FsbGJhY2sgYW5kIHRoZSBjb2xsZWN0aW9uIGltcGxlbWVudHMgdGhpc1xuICAgIC8vIG9wZXJhdGlvbiBhc3luY2hyb25vdXNseSwgdGhlbiBxdWVyeVJldCB3aWxsIGJlIHVuZGVmaW5lZCwgYW5kIHRoZVxuICAgIC8vIHJlc3VsdCB3aWxsIGJlIHJldHVybmVkIHRocm91Z2ggdGhlIGNhbGxiYWNrIGluc3RlYWQuXG4gICAgLy9jb25zb2xlLmxvZyh7Y2FsbGJhY2ssIG9wdGlvbnMsIHNlbGVjdG9yLCBtb2RpZmllciwgY29sbDogdGhpcy5fY29sbGVjdGlvbn0pO1xuICAgIHRyeSB7XG4gICAgICAvLyBJZiB0aGUgdXNlciBwcm92aWRlZCBhIGNhbGxiYWNrIGFuZCB0aGUgY29sbGVjdGlvbiBpbXBsZW1lbnRzIHRoaXNcbiAgICAgIC8vIG9wZXJhdGlvbiBhc3luY2hyb25vdXNseSwgdGhlbiBxdWVyeVJldCB3aWxsIGJlIHVuZGVmaW5lZCwgYW5kIHRoZVxuICAgICAgLy8gcmVzdWx0IHdpbGwgYmUgcmV0dXJuZWQgdGhyb3VnaCB0aGUgY2FsbGJhY2sgaW5zdGVhZC5cbiAgICAgIHJldHVybiB0aGlzLl9jb2xsZWN0aW9uLnVwZGF0ZShcbiAgICAgICAgc2VsZWN0b3IsXG4gICAgICAgIG1vZGlmaWVyLFxuICAgICAgICBvcHRpb25zLFxuICAgICAgICB3cmFwcGVkQ2FsbGJhY2tcbiAgICAgICk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKGUpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBBc3luY2hyb25vdXNseSByZW1vdmVzIGRvY3VtZW50cyBmcm9tIHRoZSBjb2xsZWN0aW9uLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCByZW1vdmVcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gc2VsZWN0b3IgU3BlY2lmaWVzIHdoaWNoIGRvY3VtZW50cyB0byByZW1vdmVcbiAgICovXG4gIHJlbW92ZUFzeW5jKHNlbGVjdG9yLCBvcHRpb25zID0ge30pIHtcbiAgICBzZWxlY3RvciA9IE1vbmdvLkNvbGxlY3Rpb24uX3Jld3JpdGVTZWxlY3RvcihzZWxlY3Rvcik7XG5cbiAgICBpZiAodGhpcy5faXNSZW1vdGVDb2xsZWN0aW9uKCkpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWxsTXV0YXRvck1ldGhvZEFzeW5jKCdyZW1vdmVBc3luYycsIFtzZWxlY3Rvcl0sIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIC8vIGl0J3MgbXkgY29sbGVjdGlvbi4gIGRlc2NlbmQgaW50byB0aGUgY29sbGVjdGlvbjEgb2JqZWN0XG4gICAgLy8gYW5kIHByb3BhZ2F0ZSBhbnkgZXhjZXB0aW9uLlxuICAgIHJldHVybiB0aGlzLl9jb2xsZWN0aW9uLnJlbW92ZUFzeW5jKHNlbGVjdG9yKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgUmVtb3ZlIGRvY3VtZW50cyBmcm9tIHRoZSBjb2xsZWN0aW9uXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIHJlbW92ZVxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtNb25nb1NlbGVjdG9yfSBzZWxlY3RvciBTcGVjaWZpZXMgd2hpY2ggZG9jdW1lbnRzIHRvIHJlbW92ZVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdIE9wdGlvbmFsLiAgSWYgcHJlc2VudCwgY2FsbGVkIHdpdGggYW4gZXJyb3Igb2JqZWN0IGFzIHRoZSBmaXJzdCBhcmd1bWVudCBhbmQsIGlmIG5vIGVycm9yLCB0aGUgbnVtYmVyIG9mIGFmZmVjdGVkIGRvY3VtZW50cyBhcyB0aGUgc2Vjb25kLlxuICAgKi9cbiAgcmVtb3ZlKHNlbGVjdG9yLCBjYWxsYmFjaykge1xuICAgIHNlbGVjdG9yID0gTW9uZ28uQ29sbGVjdGlvbi5fcmV3cml0ZVNlbGVjdG9yKHNlbGVjdG9yKTtcblxuICAgIGlmICh0aGlzLl9pc1JlbW90ZUNvbGxlY3Rpb24oKSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhbGxNdXRhdG9yTWV0aG9kKCdyZW1vdmUnLCBbc2VsZWN0b3JdLCBjYWxsYmFjayk7XG4gICAgfVxuXG5cbiAgICAvLyBpdCdzIG15IGNvbGxlY3Rpb24uICBkZXNjZW5kIGludG8gdGhlIGNvbGxlY3Rpb24xIG9iamVjdFxuICAgIC8vIGFuZCBwcm9wYWdhdGUgYW55IGV4Y2VwdGlvbi5cbiAgICByZXR1cm4gdGhpcy5fY29sbGVjdGlvbi5yZW1vdmUoc2VsZWN0b3IpO1xuICB9LFxuXG5cbiAgLy8gRGV0ZXJtaW5lIGlmIHRoaXMgY29sbGVjdGlvbiBpcyBzaW1wbHkgYSBtaW5pbW9uZ28gcmVwcmVzZW50YXRpb24gb2YgYSByZWFsXG4gIC8vIGRhdGFiYXNlIG9uIGFub3RoZXIgc2VydmVyXG4gIF9pc1JlbW90ZUNvbGxlY3Rpb24oKSB7XG4gICAgLy8gWFhYIHNlZSAjTWV0ZW9yU2VydmVyTnVsbFxuICAgIHJldHVybiB0aGlzLl9jb25uZWN0aW9uICYmIHRoaXMuX2Nvbm5lY3Rpb24gIT09IE1ldGVvci5zZXJ2ZXI7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEFzeW5jaHJvbm91c2x5IG1vZGlmaWVzIG9uZSBvciBtb3JlIGRvY3VtZW50cyBpbiB0aGUgY29sbGVjdGlvbiwgb3IgaW5zZXJ0IG9uZSBpZiBubyBtYXRjaGluZyBkb2N1bWVudHMgd2VyZSBmb3VuZC4gUmV0dXJucyBhbiBvYmplY3Qgd2l0aCBrZXlzIGBudW1iZXJBZmZlY3RlZGAgKHRoZSBudW1iZXIgb2YgZG9jdW1lbnRzIG1vZGlmaWVkKSAgYW5kIGBpbnNlcnRlZElkYCAodGhlIHVuaXF1ZSBfaWQgb2YgdGhlIGRvY3VtZW50IHRoYXQgd2FzIGluc2VydGVkLCBpZiBhbnkpLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCB1cHNlcnRcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gc2VsZWN0b3IgU3BlY2lmaWVzIHdoaWNoIGRvY3VtZW50cyB0byBtb2RpZnlcbiAgICogQHBhcmFtIHtNb25nb01vZGlmaWVyfSBtb2RpZmllciBTcGVjaWZpZXMgaG93IHRvIG1vZGlmeSB0aGUgZG9jdW1lbnRzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLm11bHRpIFRydWUgdG8gbW9kaWZ5IGFsbCBtYXRjaGluZyBkb2N1bWVudHM7IGZhbHNlIHRvIG9ubHkgbW9kaWZ5IG9uZSBvZiB0aGUgbWF0Y2hpbmcgZG9jdW1lbnRzICh0aGUgZGVmYXVsdCkuXG4gICAqL1xuICAgIGFzeW5jIHVwc2VydEFzeW5jKHNlbGVjdG9yLCBtb2RpZmllciwgb3B0aW9ucykge1xuICAgICAgcmV0dXJuIHRoaXMudXBkYXRlQXN5bmMoXG4gICAgICAgIHNlbGVjdG9yLFxuICAgICAgICBtb2RpZmllcixcbiAgICAgICAge1xuICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgX3JldHVybk9iamVjdDogdHJ1ZSxcbiAgICAgICAgICB1cHNlcnQ6IHRydWUsXG4gICAgICAgIH0pO1xuICAgIH0sXG5cblxuICAvKipcbiAgICogQHN1bW1hcnkgQXN5bmNocm9ub3VzbHkgbW9kaWZpZXMgb25lIG9yIG1vcmUgZG9jdW1lbnRzIGluIHRoZSBjb2xsZWN0aW9uLCBvciBpbnNlcnQgb25lIGlmIG5vIG1hdGNoaW5nIGRvY3VtZW50cyB3ZXJlIGZvdW5kLiBSZXR1cm5zIGFuIG9iamVjdCB3aXRoIGtleXMgYG51bWJlckFmZmVjdGVkYCAodGhlIG51bWJlciBvZiBkb2N1bWVudHMgbW9kaWZpZWQpICBhbmQgYGluc2VydGVkSWRgICh0aGUgdW5pcXVlIF9pZCBvZiB0aGUgZG9jdW1lbnQgdGhhdCB3YXMgaW5zZXJ0ZWQsIGlmIGFueSkuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIHVwc2VydFxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtNb25nb1NlbGVjdG9yfSBzZWxlY3RvciBTcGVjaWZpZXMgd2hpY2ggZG9jdW1lbnRzIHRvIG1vZGlmeVxuICAgKiBAcGFyYW0ge01vbmdvTW9kaWZpZXJ9IG1vZGlmaWVyIFNwZWNpZmllcyBob3cgdG8gbW9kaWZ5IHRoZSBkb2N1bWVudHNcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMubXVsdGkgVHJ1ZSB0byBtb2RpZnkgYWxsIG1hdGNoaW5nIGRvY3VtZW50czsgZmFsc2UgdG8gb25seSBtb2RpZnkgb25lIG9mIHRoZSBtYXRjaGluZyBkb2N1bWVudHMgKHRoZSBkZWZhdWx0KS5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSBPcHRpb25hbC4gIElmIHByZXNlbnQsIGNhbGxlZCB3aXRoIGFuIGVycm9yIG9iamVjdCBhcyB0aGUgZmlyc3QgYXJndW1lbnQgYW5kLCBpZiBubyBlcnJvciwgdGhlIG51bWJlciBvZiBhZmZlY3RlZCBkb2N1bWVudHMgYXMgdGhlIHNlY29uZC5cbiAgICovXG4gIHVwc2VydChzZWxlY3RvciwgbW9kaWZpZXIsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCFjYWxsYmFjayAmJiB0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2sgPSBvcHRpb25zO1xuICAgICAgb3B0aW9ucyA9IHt9O1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnVwZGF0ZShcbiAgICAgIHNlbGVjdG9yLFxuICAgICAgbW9kaWZpZXIsXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIF9yZXR1cm5PYmplY3Q6IHRydWUsXG4gICAgICAgIHVwc2VydDogdHJ1ZSxcbiAgICAgIH0pO1xuICB9LFxuXG4gIC8vIFdlJ2xsIGFjdHVhbGx5IGRlc2lnbiBhbiBpbmRleCBBUEkgbGF0ZXIuIEZvciBub3csIHdlIGp1c3QgcGFzcyB0aHJvdWdoIHRvXG4gIC8vIE1vbmdvJ3MsIGJ1dCBtYWtlIGl0IHN5bmNocm9ub3VzLlxuICAvKipcbiAgICogQHN1bW1hcnkgQXN5bmNocm9ub3VzbHkgY3JlYXRlcyB0aGUgc3BlY2lmaWVkIGluZGV4IG9uIHRoZSBjb2xsZWN0aW9uLlxuICAgKiBAbG9jdXMgc2VydmVyXG4gICAqIEBtZXRob2QgZW5zdXJlSW5kZXhBc3luY1xuICAgKiBAZGVwcmVjYXRlZCBpbiAzLjBcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbmRleCBBIGRvY3VtZW50IHRoYXQgY29udGFpbnMgdGhlIGZpZWxkIGFuZCB2YWx1ZSBwYWlycyB3aGVyZSB0aGUgZmllbGQgaXMgdGhlIGluZGV4IGtleSBhbmQgdGhlIHZhbHVlIGRlc2NyaWJlcyB0aGUgdHlwZSBvZiBpbmRleCBmb3IgdGhhdCBmaWVsZC4gRm9yIGFuIGFzY2VuZGluZyBpbmRleCBvbiBhIGZpZWxkLCBzcGVjaWZ5IGEgdmFsdWUgb2YgYDFgOyBmb3IgZGVzY2VuZGluZyBpbmRleCwgc3BlY2lmeSBhIHZhbHVlIG9mIGAtMWAuIFVzZSBgdGV4dGAgZm9yIHRleHQgaW5kZXhlcy5cbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBBbGwgb3B0aW9ucyBhcmUgbGlzdGVkIGluIFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL21ldGhvZC9kYi5jb2xsZWN0aW9uLmNyZWF0ZUluZGV4LyNvcHRpb25zKVxuICAgKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5uYW1lIE5hbWUgb2YgdGhlIGluZGV4XG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy51bmlxdWUgRGVmaW5lIHRoYXQgdGhlIGluZGV4IHZhbHVlcyBtdXN0IGJlIHVuaXF1ZSwgbW9yZSBhdCBbTW9uZ29EQiBkb2N1bWVudGF0aW9uXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL2NvcmUvaW5kZXgtdW5pcXVlLylcbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnNwYXJzZSBEZWZpbmUgdGhhdCB0aGUgaW5kZXggaXMgc3BhcnNlLCBtb3JlIGF0IFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvY29yZS9pbmRleC1zcGFyc2UvKVxuICAgKi9cbiAgYXN5bmMgZW5zdXJlSW5kZXhBc3luYyhpbmRleCwgb3B0aW9ucykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoIXNlbGYuX2NvbGxlY3Rpb24uZW5zdXJlSW5kZXhBc3luYyB8fCAhc2VsZi5fY29sbGVjdGlvbi5jcmVhdGVJbmRleEFzeW5jKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW4gb25seSBjYWxsIGNyZWF0ZUluZGV4QXN5bmMgb24gc2VydmVyIGNvbGxlY3Rpb25zJyk7XG4gICAgaWYgKHNlbGYuX2NvbGxlY3Rpb24uY3JlYXRlSW5kZXhBc3luYykge1xuICAgICAgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5jcmVhdGVJbmRleEFzeW5jKGluZGV4LCBvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaW1wb3J0IHsgTG9nIH0gZnJvbSAnbWV0ZW9yL2xvZ2dpbmcnO1xuXG4gICAgICBMb2cuZGVidWcoYGVuc3VyZUluZGV4QXN5bmMgaGFzIGJlZW4gZGVwcmVjYXRlZCwgcGxlYXNlIHVzZSB0aGUgbmV3ICdjcmVhdGVJbmRleEFzeW5jJyBpbnN0ZWFkJHsgb3B0aW9ucz8ubmFtZSA/IGAsIGluZGV4IG5hbWU6ICR7IG9wdGlvbnMubmFtZSB9YCA6IGAsIGluZGV4OiAkeyBKU09OLnN0cmluZ2lmeShpbmRleCkgfWAgfWApXG4gICAgICBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLmVuc3VyZUluZGV4QXN5bmMoaW5kZXgsIG9wdGlvbnMpO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgQXN5bmNocm9ub3VzbHkgY3JlYXRlcyB0aGUgc3BlY2lmaWVkIGluZGV4IG9uIHRoZSBjb2xsZWN0aW9uLlxuICAgKiBAbG9jdXMgc2VydmVyXG4gICAqIEBtZXRob2QgY3JlYXRlSW5kZXhBc3luY1xuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtPYmplY3R9IGluZGV4IEEgZG9jdW1lbnQgdGhhdCBjb250YWlucyB0aGUgZmllbGQgYW5kIHZhbHVlIHBhaXJzIHdoZXJlIHRoZSBmaWVsZCBpcyB0aGUgaW5kZXgga2V5IGFuZCB0aGUgdmFsdWUgZGVzY3JpYmVzIHRoZSB0eXBlIG9mIGluZGV4IGZvciB0aGF0IGZpZWxkLiBGb3IgYW4gYXNjZW5kaW5nIGluZGV4IG9uIGEgZmllbGQsIHNwZWNpZnkgYSB2YWx1ZSBvZiBgMWA7IGZvciBkZXNjZW5kaW5nIGluZGV4LCBzcGVjaWZ5IGEgdmFsdWUgb2YgYC0xYC4gVXNlIGB0ZXh0YCBmb3IgdGV4dCBpbmRleGVzLlxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIEFsbCBvcHRpb25zIGFyZSBsaXN0ZWQgaW4gW01vbmdvREIgZG9jdW1lbnRhdGlvbl0oaHR0cHM6Ly9kb2NzLm1vbmdvZGIuY29tL21hbnVhbC9yZWZlcmVuY2UvbWV0aG9kL2RiLmNvbGxlY3Rpb24uY3JlYXRlSW5kZXgvI29wdGlvbnMpXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBvcHRpb25zLm5hbWUgTmFtZSBvZiB0aGUgaW5kZXhcbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnVuaXF1ZSBEZWZpbmUgdGhhdCB0aGUgaW5kZXggdmFsdWVzIG11c3QgYmUgdW5pcXVlLCBtb3JlIGF0IFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvY29yZS9pbmRleC11bmlxdWUvKVxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMuc3BhcnNlIERlZmluZSB0aGF0IHRoZSBpbmRleCBpcyBzcGFyc2UsIG1vcmUgYXQgW01vbmdvREIgZG9jdW1lbnRhdGlvbl0oaHR0cHM6Ly9kb2NzLm1vbmdvZGIuY29tL21hbnVhbC9jb3JlL2luZGV4LXNwYXJzZS8pXG4gICAqL1xuICBhc3luYyBjcmVhdGVJbmRleEFzeW5jKGluZGV4LCBvcHRpb25zKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghc2VsZi5fY29sbGVjdGlvbi5jcmVhdGVJbmRleEFzeW5jKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW4gb25seSBjYWxsIGNyZWF0ZUluZGV4QXN5bmMgb24gc2VydmVyIGNvbGxlY3Rpb25zJyk7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5jcmVhdGVJbmRleEFzeW5jKGluZGV4LCBvcHRpb25zKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoXG4gICAgICAgIGUubWVzc2FnZS5pbmNsdWRlcyhcbiAgICAgICAgICAnQW4gZXF1aXZhbGVudCBpbmRleCBhbHJlYWR5IGV4aXN0cyB3aXRoIHRoZSBzYW1lIG5hbWUgYnV0IGRpZmZlcmVudCBvcHRpb25zLidcbiAgICAgICAgKSAmJlxuICAgICAgICBNZXRlb3Iuc2V0dGluZ3M/LnBhY2thZ2VzPy5tb25nbz8ucmVDcmVhdGVJbmRleE9uT3B0aW9uTWlzbWF0Y2hcbiAgICAgICkge1xuICAgICAgICBpbXBvcnQgeyBMb2cgfSBmcm9tICdtZXRlb3IvbG9nZ2luZyc7XG5cbiAgICAgICAgTG9nLmluZm8oYFJlLWNyZWF0aW5nIGluZGV4ICR7IGluZGV4IH0gZm9yICR7IHNlbGYuX25hbWUgfSBkdWUgdG8gb3B0aW9ucyBtaXNtYXRjaC5gKTtcbiAgICAgICAgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5kcm9wSW5kZXhBc3luYyhpbmRleCk7XG4gICAgICAgIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24uY3JlYXRlSW5kZXhBc3luYyhpbmRleCwgb3B0aW9ucyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKGUpO1xuICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKGBBbiBlcnJvciBvY2N1cnJlZCB3aGVuIGNyZWF0aW5nIGFuIGluZGV4IGZvciBjb2xsZWN0aW9uIFwiJHsgc2VsZi5fbmFtZSB9OiAkeyBlLm1lc3NhZ2UgfWApO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgQXN5bmNocm9ub3VzbHkgY3JlYXRlcyB0aGUgc3BlY2lmaWVkIGluZGV4IG9uIHRoZSBjb2xsZWN0aW9uLlxuICAgKiBAbG9jdXMgc2VydmVyXG4gICAqIEBtZXRob2QgY3JlYXRlSW5kZXhcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbmRleCBBIGRvY3VtZW50IHRoYXQgY29udGFpbnMgdGhlIGZpZWxkIGFuZCB2YWx1ZSBwYWlycyB3aGVyZSB0aGUgZmllbGQgaXMgdGhlIGluZGV4IGtleSBhbmQgdGhlIHZhbHVlIGRlc2NyaWJlcyB0aGUgdHlwZSBvZiBpbmRleCBmb3IgdGhhdCBmaWVsZC4gRm9yIGFuIGFzY2VuZGluZyBpbmRleCBvbiBhIGZpZWxkLCBzcGVjaWZ5IGEgdmFsdWUgb2YgYDFgOyBmb3IgZGVzY2VuZGluZyBpbmRleCwgc3BlY2lmeSBhIHZhbHVlIG9mIGAtMWAuIFVzZSBgdGV4dGAgZm9yIHRleHQgaW5kZXhlcy5cbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBBbGwgb3B0aW9ucyBhcmUgbGlzdGVkIGluIFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL21ldGhvZC9kYi5jb2xsZWN0aW9uLmNyZWF0ZUluZGV4LyNvcHRpb25zKVxuICAgKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5uYW1lIE5hbWUgb2YgdGhlIGluZGV4XG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy51bmlxdWUgRGVmaW5lIHRoYXQgdGhlIGluZGV4IHZhbHVlcyBtdXN0IGJlIHVuaXF1ZSwgbW9yZSBhdCBbTW9uZ29EQiBkb2N1bWVudGF0aW9uXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL2NvcmUvaW5kZXgtdW5pcXVlLylcbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnNwYXJzZSBEZWZpbmUgdGhhdCB0aGUgaW5kZXggaXMgc3BhcnNlLCBtb3JlIGF0IFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvY29yZS9pbmRleC1zcGFyc2UvKVxuICAgKi9cbiAgY3JlYXRlSW5kZXgoaW5kZXgsIG9wdGlvbnMpe1xuICAgIHJldHVybiB0aGlzLmNyZWF0ZUluZGV4QXN5bmMoaW5kZXgsIG9wdGlvbnMpO1xuICB9LFxuXG4gIGFzeW5jIGRyb3BJbmRleEFzeW5jKGluZGV4KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghc2VsZi5fY29sbGVjdGlvbi5kcm9wSW5kZXhBc3luYylcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2FuIG9ubHkgY2FsbCBkcm9wSW5kZXhBc3luYyBvbiBzZXJ2ZXIgY29sbGVjdGlvbnMnKTtcbiAgICBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLmRyb3BJbmRleEFzeW5jKGluZGV4KTtcbiAgfSxcblxuICBhc3luYyBkcm9wQ29sbGVjdGlvbkFzeW5jKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoIXNlbGYuX2NvbGxlY3Rpb24uZHJvcENvbGxlY3Rpb25Bc3luYylcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2FuIG9ubHkgY2FsbCBkcm9wQ29sbGVjdGlvbkFzeW5jIG9uIHNlcnZlciBjb2xsZWN0aW9ucycpO1xuICAgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5kcm9wQ29sbGVjdGlvbkFzeW5jKCk7XG4gIH0sXG5cbiAgYXN5bmMgY3JlYXRlQ2FwcGVkQ29sbGVjdGlvbkFzeW5jKGJ5dGVTaXplLCBtYXhEb2N1bWVudHMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCEgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5jcmVhdGVDYXBwZWRDb2xsZWN0aW9uQXN5bmMpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdDYW4gb25seSBjYWxsIGNyZWF0ZUNhcHBlZENvbGxlY3Rpb25Bc3luYyBvbiBzZXJ2ZXIgY29sbGVjdGlvbnMnXG4gICAgICApO1xuICAgIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24uY3JlYXRlQ2FwcGVkQ29sbGVjdGlvbkFzeW5jKGJ5dGVTaXplLCBtYXhEb2N1bWVudHMpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBSZXR1cm5zIHRoZSBbYENvbGxlY3Rpb25gXShodHRwOi8vbW9uZ29kYi5naXRodWIuaW8vbm9kZS1tb25nb2RiLW5hdGl2ZS8zLjAvYXBpL0NvbGxlY3Rpb24uaHRtbCkgb2JqZWN0IGNvcnJlc3BvbmRpbmcgdG8gdGhpcyBjb2xsZWN0aW9uIGZyb20gdGhlIFtucG0gYG1vbmdvZGJgIGRyaXZlciBtb2R1bGVdKGh0dHBzOi8vd3d3Lm5wbWpzLmNvbS9wYWNrYWdlL21vbmdvZGIpIHdoaWNoIGlzIHdyYXBwZWQgYnkgYE1vbmdvLkNvbGxlY3Rpb25gLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKi9cbiAgcmF3Q29sbGVjdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCFzZWxmLl9jb2xsZWN0aW9uLnJhd0NvbGxlY3Rpb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2FuIG9ubHkgY2FsbCByYXdDb2xsZWN0aW9uIG9uIHNlcnZlciBjb2xsZWN0aW9ucycpO1xuICAgIH1cbiAgICByZXR1cm4gc2VsZi5fY29sbGVjdGlvbi5yYXdDb2xsZWN0aW9uKCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFJldHVybnMgdGhlIFtgRGJgXShodHRwOi8vbW9uZ29kYi5naXRodWIuaW8vbm9kZS1tb25nb2RiLW5hdGl2ZS8zLjAvYXBpL0RiLmh0bWwpIG9iamVjdCBjb3JyZXNwb25kaW5nIHRvIHRoaXMgY29sbGVjdGlvbidzIGRhdGFiYXNlIGNvbm5lY3Rpb24gZnJvbSB0aGUgW25wbSBgbW9uZ29kYmAgZHJpdmVyIG1vZHVsZV0oaHR0cHM6Ly93d3cubnBtanMuY29tL3BhY2thZ2UvbW9uZ29kYikgd2hpY2ggaXMgd3JhcHBlZCBieSBgTW9uZ28uQ29sbGVjdGlvbmAuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqL1xuICByYXdEYXRhYmFzZSgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCEoc2VsZi5fZHJpdmVyLm1vbmdvICYmIHNlbGYuX2RyaXZlci5tb25nby5kYikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2FuIG9ubHkgY2FsbCByYXdEYXRhYmFzZSBvbiBzZXJ2ZXIgY29sbGVjdGlvbnMnKTtcbiAgICB9XG4gICAgcmV0dXJuIHNlbGYuX2RyaXZlci5tb25nby5kYjtcbiAgfSxcbn0pO1xuXG5PYmplY3QuYXNzaWduKE1vbmdvLCB7XG4gIC8qKlxuICAgKiBAc3VtbWFyeSBSZXRyaWV2ZSBhIE1ldGVvciBjb2xsZWN0aW9uIGluc3RhbmNlIGJ5IG5hbWUuIE9ubHkgY29sbGVjdGlvbnMgZGVmaW5lZCB3aXRoIFtgbmV3IE1vbmdvLkNvbGxlY3Rpb24oLi4uKWBdKCNjb2xsZWN0aW9ucykgYXJlIGF2YWlsYWJsZSB3aXRoIHRoaXMgbWV0aG9kLiBGb3IgcGxhaW4gTW9uZ29EQiBjb2xsZWN0aW9ucywgeW91J2xsIHdhbnQgdG8gbG9vayBhdCBbYHJhd0RhdGFiYXNlKClgXSgjTW9uZ28tQ29sbGVjdGlvbi1yYXdEYXRhYmFzZSkuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWVtYmVyb2YgTW9uZ29cbiAgICogQHN0YXRpY1xuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBOYW1lIG9mIHlvdXIgY29sbGVjdGlvbiBhcyBpdCB3YXMgZGVmaW5lZCB3aXRoIGBuZXcgTW9uZ28uQ29sbGVjdGlvbigpYC5cbiAgICogQHJldHVybnMge01vbmdvLkNvbGxlY3Rpb24gfCB1bmRlZmluZWR9XG4gICAqL1xuICBnZXRDb2xsZWN0aW9uKG5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5fY29sbGVjdGlvbnMuZ2V0KG5hbWUpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBBIHJlY29yZCBvZiBhbGwgZGVmaW5lZCBNb25nby5Db2xsZWN0aW9uIGluc3RhbmNlcywgaW5kZXhlZCBieSBjb2xsZWN0aW9uIG5hbWUuXG4gICAqIEB0eXBlIHtNYXA8c3RyaW5nLCBNb25nby5Db2xsZWN0aW9uPn1cbiAgICogQG1lbWJlcm9mIE1vbmdvXG4gICAqIEBwcm90ZWN0ZWRcbiAgICovXG4gIF9jb2xsZWN0aW9uczogbmV3IE1hcCgpLFxufSlcblxuLy8gQ29udmVydCB0aGUgY2FsbGJhY2sgdG8gbm90IHJldHVybiBhIHJlc3VsdCBpZiB0aGVyZSBpcyBhbiBlcnJvclxuZnVuY3Rpb24gd3JhcENhbGxiYWNrKGNhbGxiYWNrLCBjb252ZXJ0UmVzdWx0KSB7XG4gIHJldHVybiAoXG4gICAgY2FsbGJhY2sgJiZcbiAgICBmdW5jdGlvbihlcnJvciwgcmVzdWx0KSB7XG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgY2FsbGJhY2soZXJyb3IpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgY29udmVydFJlc3VsdCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjayhlcnJvciwgY29udmVydFJlc3VsdChyZXN1bHQpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCByZXN1bHQpO1xuICAgICAgfVxuICAgIH1cbiAgKTtcbn1cblxuLyoqXG4gKiBAc3VtbWFyeSBDcmVhdGUgYSBNb25nby1zdHlsZSBgT2JqZWN0SURgLiAgSWYgeW91IGRvbid0IHNwZWNpZnkgYSBgaGV4U3RyaW5nYCwgdGhlIGBPYmplY3RJRGAgd2lsbCBiZSBnZW5lcmF0ZWQgcmFuZG9tbHkgKG5vdCB1c2luZyBNb25nb0RCJ3MgSUQgY29uc3RydWN0aW9uIHJ1bGVzKS5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQGNsYXNzXG4gKiBAcGFyYW0ge1N0cmluZ30gW2hleFN0cmluZ10gT3B0aW9uYWwuICBUaGUgMjQtY2hhcmFjdGVyIGhleGFkZWNpbWFsIGNvbnRlbnRzIG9mIHRoZSBPYmplY3RJRCB0byBjcmVhdGVcbiAqL1xuTW9uZ28uT2JqZWN0SUQgPSBNb25nb0lELk9iamVjdElEO1xuXG4vKipcbiAqIEBzdW1tYXJ5IFRvIGNyZWF0ZSBhIGN1cnNvciwgdXNlIGZpbmQuIFRvIGFjY2VzcyB0aGUgZG9jdW1lbnRzIGluIGEgY3Vyc29yLCB1c2UgZm9yRWFjaCwgbWFwLCBvciBmZXRjaC5cbiAqIEBjbGFzc1xuICogQGluc3RhbmNlTmFtZSBjdXJzb3JcbiAqL1xuTW9uZ28uQ3Vyc29yID0gTG9jYWxDb2xsZWN0aW9uLkN1cnNvcjtcblxuLyoqXG4gKiBAZGVwcmVjYXRlZCBpbiAwLjkuMVxuICovXG5Nb25nby5Db2xsZWN0aW9uLkN1cnNvciA9IE1vbmdvLkN1cnNvcjtcblxuLyoqXG4gKiBAZGVwcmVjYXRlZCBpbiAwLjkuMVxuICovXG5Nb25nby5Db2xsZWN0aW9uLk9iamVjdElEID0gTW9uZ28uT2JqZWN0SUQ7XG5cbi8qKlxuICogQGRlcHJlY2F0ZWQgaW4gMC45LjFcbiAqL1xuTWV0ZW9yLkNvbGxlY3Rpb24gPSBNb25nby5Db2xsZWN0aW9uO1xuXG4vLyBBbGxvdyBkZW55IHN0dWZmIGlzIG5vdyBpbiB0aGUgYWxsb3ctZGVueSBwYWNrYWdlXG5PYmplY3QuYXNzaWduKE1vbmdvLkNvbGxlY3Rpb24ucHJvdG90eXBlLCBBbGxvd0RlbnkuQ29sbGVjdGlvblByb3RvdHlwZSk7XG5cbmZ1bmN0aW9uIHBvcENhbGxiYWNrRnJvbUFyZ3MoYXJncykge1xuICAvLyBQdWxsIG9mZiBhbnkgY2FsbGJhY2sgKG9yIHBlcmhhcHMgYSAnY2FsbGJhY2snIHZhcmlhYmxlIHRoYXQgd2FzIHBhc3NlZFxuICAvLyBpbiB1bmRlZmluZWQsIGxpa2UgaG93ICd1cHNlcnQnIGRvZXMgaXQpLlxuICBpZiAoXG4gICAgYXJncy5sZW5ndGggJiZcbiAgICAoYXJnc1thcmdzLmxlbmd0aCAtIDFdID09PSB1bmRlZmluZWQgfHxcbiAgICAgIGFyZ3NbYXJncy5sZW5ndGggLSAxXSBpbnN0YW5jZW9mIEZ1bmN0aW9uKVxuICApIHtcbiAgICByZXR1cm4gYXJncy5wb3AoKTtcbiAgfVxufVxuIiwiLyoqXG4gKiBAc3VtbWFyeSBBbGxvd3MgZm9yIHVzZXIgc3BlY2lmaWVkIGNvbm5lY3Rpb24gb3B0aW9uc1xuICogQGV4YW1wbGUgaHR0cDovL21vbmdvZGIuZ2l0aHViLmlvL25vZGUtbW9uZ29kYi1uYXRpdmUvMy4wL3JlZmVyZW5jZS9jb25uZWN0aW5nL2Nvbm5lY3Rpb24tc2V0dGluZ3MvXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyBVc2VyIHNwZWNpZmllZCBNb25nbyBjb25uZWN0aW9uIG9wdGlvbnNcbiAqL1xuTW9uZ28uc2V0Q29ubmVjdGlvbk9wdGlvbnMgPSBmdW5jdGlvbiBzZXRDb25uZWN0aW9uT3B0aW9ucyAob3B0aW9ucykge1xuICBjaGVjayhvcHRpb25zLCBPYmplY3QpO1xuICBNb25nby5fY29ubmVjdGlvbk9wdGlvbnMgPSBvcHRpb25zO1xufTsiLCJleHBvcnQgY29uc3Qgbm9ybWFsaXplUHJvamVjdGlvbiA9IG9wdGlvbnMgPT4ge1xuICAvLyB0cmFuc2Zvcm0gZmllbGRzIGtleSBpbiBwcm9qZWN0aW9uXG4gIGNvbnN0IHsgZmllbGRzLCBwcm9qZWN0aW9uLCAuLi5vdGhlck9wdGlvbnMgfSA9IG9wdGlvbnMgfHwge307XG4gIC8vIFRPRE86IGVuYWJsZSB0aGlzIGNvbW1lbnQgd2hlbiBkZXByZWNhdGluZyB0aGUgZmllbGRzIG9wdGlvblxuICAvLyBMb2cuZGVidWcoYGZpZWxkcyBvcHRpb24gaGFzIGJlZW4gZGVwcmVjYXRlZCwgcGxlYXNlIHVzZSB0aGUgbmV3ICdwcm9qZWN0aW9uJyBpbnN0ZWFkYClcblxuICByZXR1cm4ge1xuICAgIC4uLm90aGVyT3B0aW9ucyxcbiAgICAuLi4ocHJvamVjdGlvbiB8fCBmaWVsZHMgPyB7IHByb2plY3Rpb246IGZpZWxkcyB8fCBwcm9qZWN0aW9uIH0gOiB7fSksXG4gIH07XG59O1xuIl19
