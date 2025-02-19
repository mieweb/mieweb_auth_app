Package["core-runtime"].queue("allow-deny",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var LocalCollection = Package.minimongo.LocalCollection;
var Minimongo = Package.minimongo.Minimongo;
var check = Package.check.check;
var Match = Package.check.Match;
var EJSON = Package.ejson.EJSON;
var DDP = Package['ddp-client'].DDP;
var DDPServer = Package['ddp-server'].DDPServer;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var AllowDeny;

var require = meteorInstall({"node_modules":{"meteor":{"allow-deny":{"allow-deny.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/allow-deny/allow-deny.js                                                                                  //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    ///
    /// Remote methods and access control.
    ///

    const hasOwn = Object.prototype.hasOwnProperty;

    // Restrict default mutators on collection. allow() and deny() take the
    // same options:
    //
    // options.insertAsync {Function(userId, doc)}
    //   return true to allow/deny adding this document
    //
    // options.updateAsync {Function(userId, docs, fields, modifier)}
    //   return true to allow/deny updating these documents.
    //   `fields` is passed as an array of fields that are to be modified
    //
    // options.removeAsync {Function(userId, docs)}
    //   return true to allow/deny removing these documents
    //
    // options.fetch {Array}
    //   Fields to fetch for these validators. If any call to allow or deny
    //   does not have this option then all fields are loaded.
    //
    // allow and deny can be called multiple times. The validators are
    // evaluated as follows:
    // - If neither deny() nor allow() has been called on the collection,
    //   then the request is allowed if and only if the "insecure" smart
    //   package is in use.
    // - Otherwise, if any deny() function returns true, the request is denied.
    // - Otherwise, if any allow() function returns true, the request is allowed.
    // - Otherwise, the request is denied.
    //
    // Meteor may call your deny() and allow() functions in any order, and may not
    // call all of them if it is able to make a decision without calling them all
    // (so don't include side effects).

    AllowDeny = {
      CollectionPrototype: {}
    };

    // In the `mongo` package, we will extend Mongo.Collection.prototype with these
    // methods
    const CollectionPrototype = AllowDeny.CollectionPrototype;

    /**
     * @summary Allow users to write directly to this collection from client code, subject to limitations you define.
     * @locus Server
     * @method allow
     * @memberOf Mongo.Collection
     * @instance
     * @param {Object} options
     * @param {Function} options.insertAsync,updateAsync,removeAsync Functions that look at a proposed modification to the database and return true if it should be allowed.
     * @param {String[]} options.fetch Optional performance enhancement. Limits the fields that will be fetched from the database for inspection by your `update` and `remove` functions.
     * @param {Function} options.transform Overrides `transform` on the  [`Collection`](#collections).  Pass `null` to disable transformation.
     */
    CollectionPrototype.allow = function (options) {
      addValidator(this, 'allow', options);
    };

    /**
     * @summary Override `allow` rules.
     * @locus Server
     * @method deny
     * @memberOf Mongo.Collection
     * @instance
     * @param {Object} options
     * @param {Function} options.insertAsync,updateAsync,removeAsync Functions that look at a proposed modification to the database and return true if it should be denied, even if an [allow](#allow) rule says otherwise.
     * @param {String[]} options.fetch Optional performance enhancement. Limits the fields that will be fetched from the database for inspection by your `update` and `remove` functions.
     * @param {Function} options.transform Overrides `transform` on the  [`Collection`](#collections).  Pass `null` to disable transformation.
     */
    CollectionPrototype.deny = function (options) {
      addValidator(this, 'deny', options);
    };
    CollectionPrototype._defineMutationMethods = function (options) {
      const self = this;
      options = options || {};

      // set to true once we call any allow or deny methods. If true, use
      // allow/deny semantics. If false, use insecure mode semantics.
      self._restricted = false;

      // Insecure mode (default to allowing writes). Defaults to 'undefined' which
      // means insecure iff the insecure package is loaded. This property can be
      // overriden by tests or packages wishing to change insecure mode behavior of
      // their collections.
      self._insecure = undefined;
      self._validators = {
        insert: {
          allow: [],
          deny: []
        },
        update: {
          allow: [],
          deny: []
        },
        remove: {
          allow: [],
          deny: []
        },
        insertAsync: {
          allow: [],
          deny: []
        },
        updateAsync: {
          allow: [],
          deny: []
        },
        removeAsync: {
          allow: [],
          deny: []
        },
        upsertAsync: {
          allow: [],
          deny: []
        },
        // dummy arrays; can't set these!
        fetch: [],
        fetchAllFields: false
      };
      if (!self._name) return; // anonymous collection

      // XXX Think about method namespacing. Maybe methods should be
      // "Meteor:Mongo:insertAsync/NAME"?
      self._prefix = '/' + self._name + '/';

      // Mutation Methods
      // Minimongo on the server gets no stubs; instead, by default
      // it wait()s until its result is ready, yielding.
      // This matches the behavior of macromongo on the server better.
      // XXX see #MeteorServerNull
      if (self._connection && (self._connection === Meteor.server || Meteor.isClient)) {
        const m = {};
        ['insertAsync', 'updateAsync', 'removeAsync', 'insert', 'update', 'remove'].forEach(method => {
          const methodName = self._prefix + method;
          if (options.useExisting) {
            const handlerPropName = Meteor.isClient ? '_methodHandlers' : 'method_handlers';
            // Do not try to create additional methods if this has already been called.
            // (Otherwise the .methods() call below will throw an error.)
            if (self._connection[handlerPropName] && typeof self._connection[handlerPropName][methodName] === 'function') return;
          }
          const isInsert = name => name.includes('insert');
          m[methodName] = function /* ... */
          () {
            // All the methods do their own validation, instead of using check().
            check(arguments, [Match.Any]);
            const args = Array.from(arguments);
            try {
              // For an insert/insertAsync, if the client didn't specify an _id, generate one
              // now; because this uses DDP.randomStream, it will be consistent with
              // what the client generated. We generate it now rather than later so
              // that if (eg) an allow/deny rule does an insert/insertAsync to the same
              // collection (not that it really should), the generated _id will
              // still be the first use of the stream and will be consistent.
              //
              // However, we don't actually stick the _id onto the document yet,
              // because we want allow/deny rules to be able to differentiate
              // between arbitrary client-specified _id fields and merely
              // client-controlled-via-randomSeed fields.
              let generatedId = null;
              if (isInsert(method) && !hasOwn.call(args[0], '_id')) {
                generatedId = self._makeNewID();
              }
              if (this.isSimulation) {
                // In a client simulation, you can do any mutation (even with a
                // complex selector).
                if (generatedId !== null) {
                  args[0]._id = generatedId;
                }
                return self._collection[method].apply(self._collection, args);
              }

              // This is the server receiving a method call from the client.

              // We don't allow arbitrary selectors in mutations from the client: only
              // single-ID selectors.
              if (!isInsert(method)) throwIfSelectorIsNotId(args[0], method);
              if (self._restricted) {
                // short circuit if there is no way it will pass.
                if (self._validators[method].allow.length === 0) {
                  throw new Meteor.Error(403, 'Access denied. No allow validators set on restricted ' + "collection for method '" + method + "'.");
                }
                const syncMethodName = method.replace('Async', '');
                const syncValidatedMethodName = '_validated' + method.charAt(0).toUpperCase() + syncMethodName.slice(1);
                // it forces to use async validated behavior on the server
                const validatedMethodName = Meteor.isServer ? syncValidatedMethodName + 'Async' : syncValidatedMethodName;
                args.unshift(this.userId);
                isInsert(method) && args.push(generatedId);
                return self[validatedMethodName].apply(self, args);
              } else if (self._isInsecure()) {
                if (generatedId !== null) args[0]._id = generatedId;
                // In insecure mode we use the server _collection methods, and these sync methods
                // do not exist in the server anymore, so we have this mapper to call the async methods
                // instead.
                const syncMethodsMapper = {
                  insert: "insertAsync",
                  update: "updateAsync",
                  remove: "removeAsync"
                };

                // In insecure mode, allow any mutation (with a simple selector).
                // XXX This is kind of bogus.  Instead of blindly passing whatever
                //     we get from the network to this function, we should actually
                //     know the correct arguments for the function and pass just
                //     them.  For example, if you have an extraneous extra null
                //     argument and this is Mongo on the server, the .wrapAsync'd
                //     functions like update will get confused and pass the
                //     "fut.resolver()" in the wrong slot, where _update will never
                //     invoke it. Bam, broken DDP connection.  Probably should just
                //     take this whole method and write it three times, invoking
                //     helpers for the common code.
                return self._collection[syncMethodsMapper[method] || method].apply(self._collection, args);
              } else {
                // In secure mode, if we haven't called allow or deny, then nothing
                // is permitted.
                throw new Meteor.Error(403, 'Access denied');
              }
            } catch (e) {
              if (e.name === 'MongoError' ||
              // for old versions of MongoDB (probably not necessary but it's here just in case)
              e.name === 'BulkWriteError' ||
              // for newer versions of MongoDB (https://docs.mongodb.com/drivers/node/current/whats-new/#bulkwriteerror---mongobulkwriteerror)
              e.name === 'MongoBulkWriteError' || e.name === 'MinimongoError') {
                throw new Meteor.Error(409, e.toString());
              } else {
                throw e;
              }
            }
          };
        });
        self._connection.methods(m);
      }
    };
    CollectionPrototype._updateFetch = function (fields) {
      const self = this;
      if (!self._validators.fetchAllFields) {
        if (fields) {
          const union = Object.create(null);
          const add = names => names && names.forEach(name => union[name] = 1);
          add(self._validators.fetch);
          add(fields);
          self._validators.fetch = Object.keys(union);
        } else {
          self._validators.fetchAllFields = true;
          // clear fetch just to make sure we don't accidentally read it
          self._validators.fetch = null;
        }
      }
    };
    CollectionPrototype._isInsecure = function () {
      const self = this;
      if (self._insecure === undefined) return !!Package.insecure;
      return self._insecure;
    };
    async function asyncSome(array, predicate) {
      for (let item of array) {
        if (await predicate(item)) {
          return true;
        }
      }
      return false;
    }
    async function asyncEvery(array, predicate) {
      for (let item of array) {
        if (!(await predicate(item))) {
          return false;
        }
      }
      return true;
    }
    CollectionPrototype._validatedInsertAsync = async function (userId, doc, generatedId) {
      const self = this;
      // call user validators.
      // Any deny returns true means denied.
      if (await asyncSome(self._validators.insertAsync.deny, async validator => {
        const result = validator(userId, docToValidate(validator, doc, generatedId));
        return Meteor._isPromise(result) ? await result : result;
      })) {
        throw new Meteor.Error(403, "Access denied");
      }
      // Any allow returns true means proceed. Throw error if they all fail.

      if (await asyncEvery(self._validators.insertAsync.allow, async validator => {
        const result = validator(userId, docToValidate(validator, doc, generatedId));
        return !(Meteor._isPromise(result) ? await result : result);
      })) {
        throw new Meteor.Error(403, "Access denied");
      }

      // If we generated an ID above, insertAsync it now: after the validation, but
      // before actually inserting.
      if (generatedId !== null) doc._id = generatedId;
      return self._collection.insertAsync.call(self._collection, doc);
    };
    CollectionPrototype._validatedInsert = function (userId, doc, generatedId) {
      const self = this;

      // call user validators.
      // Any deny returns true means denied.
      if (self._validators.insert.deny.some(validator => {
        return validator(userId, docToValidate(validator, doc, generatedId));
      })) {
        throw new Meteor.Error(403, "Access denied");
      }
      // Any allow returns true means proceed. Throw error if they all fail.

      if (self._validators.insert.allow.every(validator => {
        return !validator(userId, docToValidate(validator, doc, generatedId));
      })) {
        throw new Meteor.Error(403, "Access denied");
      }

      // If we generated an ID above, insert it now: after the validation, but
      // before actually inserting.
      if (generatedId !== null) doc._id = generatedId;
      return (Meteor.isServer ? self._collection.insertAsync : self._collection.insert).call(self._collection, doc);
    };

    // Simulate a mongo `update` operation while validating that the access
    // control rules set by calls to `allow/deny` are satisfied. If all
    // pass, rewrite the mongo operation to use $in to set the list of
    // document ids to change ##ValidatedChange
    CollectionPrototype._validatedUpdateAsync = async function (userId, selector, mutator, options) {
      const self = this;
      check(mutator, Object);
      options = Object.assign(Object.create(null), options);
      if (!LocalCollection._selectorIsIdPerhapsAsObject(selector)) throw new Error("validated update should be of a single ID");

      // We don't support upserts because they don't fit nicely into allow/deny
      // rules.
      if (options.upsert) throw new Meteor.Error(403, "Access denied. Upserts not " + "allowed in a restricted collection.");
      const noReplaceError = "Access denied. In a restricted collection you can only" + " update documents, not replace them. Use a Mongo update operator, such " + "as '$set'.";
      const mutatorKeys = Object.keys(mutator);

      // compute modified fields
      const modifiedFields = {};
      if (mutatorKeys.length === 0) {
        throw new Meteor.Error(403, noReplaceError);
      }
      mutatorKeys.forEach(op => {
        const params = mutator[op];
        if (op.charAt(0) !== '$') {
          throw new Meteor.Error(403, noReplaceError);
        } else if (!hasOwn.call(ALLOWED_UPDATE_OPERATIONS, op)) {
          throw new Meteor.Error(403, "Access denied. Operator " + op + " not allowed in a restricted collection.");
        } else {
          Object.keys(params).forEach(field => {
            // treat dotted fields as if they are replacing their
            // top-level part
            if (field.indexOf('.') !== -1) field = field.substring(0, field.indexOf('.'));

            // record the field we are trying to change
            modifiedFields[field] = true;
          });
        }
      });
      const fields = Object.keys(modifiedFields);
      const findOptions = {
        transform: null
      };
      if (!self._validators.fetchAllFields) {
        findOptions.fields = {};
        self._validators.fetch.forEach(fieldName => {
          findOptions.fields[fieldName] = 1;
        });
      }
      const doc = await self._collection.findOneAsync(selector, findOptions);
      if (!doc)
        // none satisfied!
        return 0;

      // call user validators.
      // Any deny returns true means denied.
      if (await asyncSome(self._validators.updateAsync.deny, async validator => {
        const factoriedDoc = transformDoc(validator, doc);
        const result = validator(userId, factoriedDoc, fields, mutator);
        return Meteor._isPromise(result) ? await result : result;
      })) {
        throw new Meteor.Error(403, "Access denied");
      }
      // Any allow returns true means proceed. Throw error if they all fail.
      if (await asyncEvery(self._validators.updateAsync.allow, async validator => {
        const factoriedDoc = transformDoc(validator, doc);
        const result = validator(userId, factoriedDoc, fields, mutator);
        return !(Meteor._isPromise(result) ? await result : result);
      })) {
        throw new Meteor.Error(403, "Access denied");
      }
      options._forbidReplace = true;

      // Back when we supported arbitrary client-provided selectors, we actually
      // rewrote the selector to include an _id clause before passing to Mongo to
      // avoid races, but since selector is guaranteed to already just be an ID, we
      // don't have to any more.

      return self._collection.updateAsync.call(self._collection, selector, mutator, options);
    };
    CollectionPrototype._validatedUpdate = function (userId, selector, mutator, options) {
      const self = this;
      check(mutator, Object);
      options = Object.assign(Object.create(null), options);
      if (!LocalCollection._selectorIsIdPerhapsAsObject(selector)) throw new Error("validated update should be of a single ID");

      // We don't support upserts because they don't fit nicely into allow/deny
      // rules.
      if (options.upsert) throw new Meteor.Error(403, "Access denied. Upserts not " + "allowed in a restricted collection.");
      const noReplaceError = "Access denied. In a restricted collection you can only" + " update documents, not replace them. Use a Mongo update operator, such " + "as '$set'.";
      const mutatorKeys = Object.keys(mutator);

      // compute modified fields
      const modifiedFields = {};
      if (mutatorKeys.length === 0) {
        throw new Meteor.Error(403, noReplaceError);
      }
      mutatorKeys.forEach(op => {
        const params = mutator[op];
        if (op.charAt(0) !== '$') {
          throw new Meteor.Error(403, noReplaceError);
        } else if (!hasOwn.call(ALLOWED_UPDATE_OPERATIONS, op)) {
          throw new Meteor.Error(403, "Access denied. Operator " + op + " not allowed in a restricted collection.");
        } else {
          Object.keys(params).forEach(field => {
            // treat dotted fields as if they are replacing their
            // top-level part
            if (field.indexOf('.') !== -1) field = field.substring(0, field.indexOf('.'));

            // record the field we are trying to change
            modifiedFields[field] = true;
          });
        }
      });
      const fields = Object.keys(modifiedFields);
      const findOptions = {
        transform: null
      };
      if (!self._validators.fetchAllFields) {
        findOptions.fields = {};
        self._validators.fetch.forEach(fieldName => {
          findOptions.fields[fieldName] = 1;
        });
      }
      const doc = self._collection.findOne(selector, findOptions);
      if (!doc)
        // none satisfied!
        return 0;

      // call user validators.
      // Any deny returns true means denied.
      if (self._validators.update.deny.some(validator => {
        const factoriedDoc = transformDoc(validator, doc);
        return validator(userId, factoriedDoc, fields, mutator);
      })) {
        throw new Meteor.Error(403, "Access denied");
      }
      // Any allow returns true means proceed. Throw error if they all fail.
      if (self._validators.update.allow.every(validator => {
        const factoriedDoc = transformDoc(validator, doc);
        return !validator(userId, factoriedDoc, fields, mutator);
      })) {
        throw new Meteor.Error(403, "Access denied");
      }
      options._forbidReplace = true;

      // Back when we supported arbitrary client-provided selectors, we actually
      // rewrote the selector to include an _id clause before passing to Mongo to
      // avoid races, but since selector is guaranteed to already just be an ID, we
      // don't have to any more.

      return self._collection.update.call(self._collection, selector, mutator, options);
    };

    // Only allow these operations in validated updates. Specifically
    // whitelist operations, rather than blacklist, so new complex
    // operations that are added aren't automatically allowed. A complex
    // operation is one that does more than just modify its target
    // field. For now this contains all update operations except '$rename'.
    // http://docs.mongodb.org/manual/reference/operators/#update
    const ALLOWED_UPDATE_OPERATIONS = {
      $inc: 1,
      $set: 1,
      $unset: 1,
      $addToSet: 1,
      $pop: 1,
      $pullAll: 1,
      $pull: 1,
      $pushAll: 1,
      $push: 1,
      $bit: 1
    };

    // Simulate a mongo `remove` operation while validating access control
    // rules. See #ValidatedChange
    CollectionPrototype._validatedRemoveAsync = async function (userId, selector) {
      const self = this;
      const findOptions = {
        transform: null
      };
      if (!self._validators.fetchAllFields) {
        findOptions.fields = {};
        self._validators.fetch.forEach(fieldName => {
          findOptions.fields[fieldName] = 1;
        });
      }
      const doc = await self._collection.findOneAsync(selector, findOptions);
      if (!doc) return 0;

      // call user validators.
      // Any deny returns true means denied.
      if (await asyncSome(self._validators.removeAsync.deny, async validator => {
        const result = validator(userId, transformDoc(validator, doc));
        return Meteor._isPromise(result) ? await result : result;
      })) {
        throw new Meteor.Error(403, "Access denied");
      }
      // Any allow returns true means proceed. Throw error if they all fail.
      if (await asyncEvery(self._validators.removeAsync.allow, async validator => {
        const result = validator(userId, transformDoc(validator, doc));
        return !(Meteor._isPromise(result) ? await result : result);
      })) {
        throw new Meteor.Error(403, "Access denied");
      }

      // Back when we supported arbitrary client-provided selectors, we actually
      // rewrote the selector to {_id: {$in: [ids that we found]}} before passing to
      // Mongo to avoid races, but since selector is guaranteed to already just be
      // an ID, we don't have to any more.

      return self._collection.removeAsync.call(self._collection, selector);
    };
    CollectionPrototype._validatedRemove = function (userId, selector) {
      const self = this;
      const findOptions = {
        transform: null
      };
      if (!self._validators.fetchAllFields) {
        findOptions.fields = {};
        self._validators.fetch.forEach(fieldName => {
          findOptions.fields[fieldName] = 1;
        });
      }
      const doc = self._collection.findOne(selector, findOptions);
      if (!doc) return 0;

      // call user validators.
      // Any deny returns true means denied.
      if (self._validators.remove.deny.some(validator => {
        return validator(userId, transformDoc(validator, doc));
      })) {
        throw new Meteor.Error(403, "Access denied");
      }
      // Any allow returns true means proceed. Throw error if they all fail.
      if (self._validators.remove.allow.every(validator => {
        return !validator(userId, transformDoc(validator, doc));
      })) {
        throw new Meteor.Error(403, "Access denied");
      }

      // Back when we supported arbitrary client-provided selectors, we actually
      // rewrote the selector to {_id: {$in: [ids that we found]}} before passing to
      // Mongo to avoid races, but since selector is guaranteed to already just be
      // an ID, we don't have to any more.

      return self._collection.remove.call(self._collection, selector);
    };
    CollectionPrototype._callMutatorMethodAsync = function _callMutatorMethodAsync(name, args) {
      let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      // For two out of three mutator methods, the first argument is a selector
      const firstArgIsSelector = name === "updateAsync" || name === "removeAsync";
      if (firstArgIsSelector && !alreadyInSimulation()) {
        // If we're about to actually send an RPC, we should throw an error if
        // this is a non-ID selector, because the mutation methods only allow
        // single-ID selectors. (If we don't throw here, we'll see flicker.)
        throwIfSelectorIsNotId(args[0], name);
      }
      const mutatorMethodName = this._prefix + name;
      return this._connection.applyAsync(mutatorMethodName, args, _objectSpread({
        returnStubValue: this.resolverType === 'stub' || this.resolverType == null,
        // StubStream is only used for testing where you don't care about the server
        returnServerResultPromise: !this._connection._stream._isStub && this.resolverType !== 'stub'
      }, options));
    };
    CollectionPrototype._callMutatorMethod = function _callMutatorMethod(name, args, callback) {
      if (Meteor.isClient && !callback && !alreadyInSimulation()) {
        // Client can't block, so it can't report errors by exception,
        // only by callback. If they forget the callback, give them a
        // default one that logs the error, so they aren't totally
        // baffled if their writes don't work because their database is
        // down.
        // Don't give a default callback in simulation, because inside stubs we
        // want to return the results from the local collection immediately and
        // not force a callback.
        callback = function (err) {
          if (err) Meteor._debug(name + " failed", err);
        };
      }

      // For two out of three mutator methods, the first argument is a selector
      const firstArgIsSelector = name === "update" || name === "remove";
      if (firstArgIsSelector && !alreadyInSimulation()) {
        // If we're about to actually send an RPC, we should throw an error if
        // this is a non-ID selector, because the mutation methods only allow
        // single-ID selectors. (If we don't throw here, we'll see flicker.)
        throwIfSelectorIsNotId(args[0], name);
      }
      const mutatorMethodName = this._prefix + name;
      return this._connection.apply(mutatorMethodName, args, {
        returnStubValue: true
      }, callback);
    };
    function transformDoc(validator, doc) {
      if (validator.transform) return validator.transform(doc);
      return doc;
    }
    function docToValidate(validator, doc, generatedId) {
      let ret = doc;
      if (validator.transform) {
        ret = EJSON.clone(doc);
        // If you set a server-side transform on your collection, then you don't get
        // to tell the difference between "client specified the ID" and "server
        // generated the ID", because transforms expect to get _id.  If you want to
        // do that check, you can do it with a specific
        // `C.allow({insertAsync: f, transform: null})` validator.
        if (generatedId !== null) {
          ret._id = generatedId;
        }
        ret = validator.transform(ret);
      }
      return ret;
    }
    function addValidator(collection, allowOrDeny, options) {
      // validate keys
      const validKeysRegEx = /^(?:insertAsync|updateAsync|removeAsync|insert|update|remove|fetch|transform)$/;
      Object.keys(options).forEach(key => {
        if (!validKeysRegEx.test(key)) throw new Error(allowOrDeny + ": Invalid key: " + key);
      });
      collection._restricted = true;
      ['insertAsync', 'updateAsync', 'removeAsync', 'insert', 'update', 'remove'].forEach(name => {
        if (hasOwn.call(options, name)) {
          if (!(options[name] instanceof Function)) {
            throw new Error(allowOrDeny + ': Value for `' + name + '` must be a function');
          }

          // If the transform is specified at all (including as 'null') in this
          // call, then take that; otherwise, take the transform from the
          // collection.
          if (options.transform === undefined) {
            options[name].transform = collection._transform; // already wrapped
          } else {
            options[name].transform = LocalCollection.wrapTransform(options.transform);
          }
          collection._validators[name][allowOrDeny].push(options[name]);
        }
      });

      // Only updateAsync the fetch fields if we're passed things that affect
      // fetching. This way allow({}) and allow({insertAsync: f}) don't result in
      // setting fetchAllFields
      if (options.updateAsync || options.removeAsync || options.fetch) {
        if (options.fetch && !(options.fetch instanceof Array)) {
          throw new Error(allowOrDeny + ": Value for `fetch` must be an array");
        }
        collection._updateFetch(options.fetch);
      }
    }
    function throwIfSelectorIsNotId(selector, methodName) {
      if (!LocalCollection._selectorIsIdPerhapsAsObject(selector)) {
        throw new Meteor.Error(403, "Not permitted. Untrusted code may only " + methodName + " documents by ID.");
      }
    }
    ;

    // Determine if we are in a DDP method simulation
    function alreadyInSimulation() {
      var CurrentInvocation = DDP._CurrentMethodInvocation ||
      // For backwards compatibility, as explained in this issue:
      // https://github.com/meteor/meteor/issues/8947
      DDP._CurrentInvocation;
      const enclosing = CurrentInvocation.get();
      return enclosing && enclosing.isSimulation;
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
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      AllowDeny: AllowDeny
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/allow-deny/allow-deny.js"
  ]
}});

//# sourceURL=meteor://💻app/packages/allow-deny.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYWxsb3ctZGVueS9hbGxvdy1kZW55LmpzIl0sIm5hbWVzIjpbIl9vYmplY3RTcHJlYWQiLCJtb2R1bGUiLCJsaW5rIiwiZGVmYXVsdCIsInYiLCJfX3JlaWZ5V2FpdEZvckRlcHNfXyIsImhhc093biIsIk9iamVjdCIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiQWxsb3dEZW55IiwiQ29sbGVjdGlvblByb3RvdHlwZSIsImFsbG93Iiwib3B0aW9ucyIsImFkZFZhbGlkYXRvciIsImRlbnkiLCJfZGVmaW5lTXV0YXRpb25NZXRob2RzIiwic2VsZiIsIl9yZXN0cmljdGVkIiwiX2luc2VjdXJlIiwidW5kZWZpbmVkIiwiX3ZhbGlkYXRvcnMiLCJpbnNlcnQiLCJ1cGRhdGUiLCJyZW1vdmUiLCJpbnNlcnRBc3luYyIsInVwZGF0ZUFzeW5jIiwicmVtb3ZlQXN5bmMiLCJ1cHNlcnRBc3luYyIsImZldGNoIiwiZmV0Y2hBbGxGaWVsZHMiLCJfbmFtZSIsIl9wcmVmaXgiLCJfY29ubmVjdGlvbiIsIk1ldGVvciIsInNlcnZlciIsImlzQ2xpZW50IiwibSIsImZvckVhY2giLCJtZXRob2QiLCJtZXRob2ROYW1lIiwidXNlRXhpc3RpbmciLCJoYW5kbGVyUHJvcE5hbWUiLCJpc0luc2VydCIsIm5hbWUiLCJpbmNsdWRlcyIsImNoZWNrIiwiYXJndW1lbnRzIiwiTWF0Y2giLCJBbnkiLCJhcmdzIiwiQXJyYXkiLCJmcm9tIiwiZ2VuZXJhdGVkSWQiLCJjYWxsIiwiX21ha2VOZXdJRCIsImlzU2ltdWxhdGlvbiIsIl9pZCIsIl9jb2xsZWN0aW9uIiwiYXBwbHkiLCJ0aHJvd0lmU2VsZWN0b3JJc05vdElkIiwibGVuZ3RoIiwiRXJyb3IiLCJzeW5jTWV0aG9kTmFtZSIsInJlcGxhY2UiLCJzeW5jVmFsaWRhdGVkTWV0aG9kTmFtZSIsImNoYXJBdCIsInRvVXBwZXJDYXNlIiwic2xpY2UiLCJ2YWxpZGF0ZWRNZXRob2ROYW1lIiwiaXNTZXJ2ZXIiLCJ1bnNoaWZ0IiwidXNlcklkIiwicHVzaCIsIl9pc0luc2VjdXJlIiwic3luY01ldGhvZHNNYXBwZXIiLCJlIiwidG9TdHJpbmciLCJtZXRob2RzIiwiX3VwZGF0ZUZldGNoIiwiZmllbGRzIiwidW5pb24iLCJjcmVhdGUiLCJhZGQiLCJuYW1lcyIsImtleXMiLCJQYWNrYWdlIiwiaW5zZWN1cmUiLCJhc3luY1NvbWUiLCJhcnJheSIsInByZWRpY2F0ZSIsIml0ZW0iLCJhc3luY0V2ZXJ5IiwiX3ZhbGlkYXRlZEluc2VydEFzeW5jIiwiZG9jIiwidmFsaWRhdG9yIiwicmVzdWx0IiwiZG9jVG9WYWxpZGF0ZSIsIl9pc1Byb21pc2UiLCJfdmFsaWRhdGVkSW5zZXJ0Iiwic29tZSIsImV2ZXJ5IiwiX3ZhbGlkYXRlZFVwZGF0ZUFzeW5jIiwic2VsZWN0b3IiLCJtdXRhdG9yIiwiYXNzaWduIiwiTG9jYWxDb2xsZWN0aW9uIiwiX3NlbGVjdG9ySXNJZFBlcmhhcHNBc09iamVjdCIsInVwc2VydCIsIm5vUmVwbGFjZUVycm9yIiwibXV0YXRvcktleXMiLCJtb2RpZmllZEZpZWxkcyIsIm9wIiwicGFyYW1zIiwiQUxMT1dFRF9VUERBVEVfT1BFUkFUSU9OUyIsImZpZWxkIiwiaW5kZXhPZiIsInN1YnN0cmluZyIsImZpbmRPcHRpb25zIiwidHJhbnNmb3JtIiwiZmllbGROYW1lIiwiZmluZE9uZUFzeW5jIiwiZmFjdG9yaWVkRG9jIiwidHJhbnNmb3JtRG9jIiwiX2ZvcmJpZFJlcGxhY2UiLCJfdmFsaWRhdGVkVXBkYXRlIiwiZmluZE9uZSIsIiRpbmMiLCIkc2V0IiwiJHVuc2V0IiwiJGFkZFRvU2V0IiwiJHBvcCIsIiRwdWxsQWxsIiwiJHB1bGwiLCIkcHVzaEFsbCIsIiRwdXNoIiwiJGJpdCIsIl92YWxpZGF0ZWRSZW1vdmVBc3luYyIsIl92YWxpZGF0ZWRSZW1vdmUiLCJfY2FsbE11dGF0b3JNZXRob2RBc3luYyIsImZpcnN0QXJnSXNTZWxlY3RvciIsImFscmVhZHlJblNpbXVsYXRpb24iLCJtdXRhdG9yTWV0aG9kTmFtZSIsImFwcGx5QXN5bmMiLCJyZXR1cm5TdHViVmFsdWUiLCJyZXNvbHZlclR5cGUiLCJyZXR1cm5TZXJ2ZXJSZXN1bHRQcm9taXNlIiwiX3N0cmVhbSIsIl9pc1N0dWIiLCJfY2FsbE11dGF0b3JNZXRob2QiLCJjYWxsYmFjayIsImVyciIsIl9kZWJ1ZyIsInJldCIsIkVKU09OIiwiY2xvbmUiLCJjb2xsZWN0aW9uIiwiYWxsb3dPckRlbnkiLCJ2YWxpZEtleXNSZWdFeCIsImtleSIsInRlc3QiLCJGdW5jdGlvbiIsIl90cmFuc2Zvcm0iLCJ3cmFwVHJhbnNmb3JtIiwiQ3VycmVudEludm9jYXRpb24iLCJERFAiLCJfQ3VycmVudE1ldGhvZEludm9jYXRpb24iLCJfQ3VycmVudEludm9jYXRpb24iLCJlbmNsb3NpbmciLCJnZXQiLCJfX3JlaWZ5X2FzeW5jX3Jlc3VsdF9fIiwiX3JlaWZ5RXJyb3IiLCJhc3luYyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBQUEsSUFBSUEsYUFBYTtJQUFDQyxNQUFNLENBQUNDLElBQUksQ0FBQyxzQ0FBc0MsRUFBQztNQUFDQyxPQUFPQSxDQUFDQyxDQUFDLEVBQUM7UUFBQ0osYUFBYSxHQUFDSSxDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSUMsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTUEsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFBbEs7SUFDQTtJQUNBOztJQUVBLE1BQU1DLE1BQU0sR0FBR0MsTUFBTSxDQUFDQyxTQUFTLENBQUNDLGNBQWM7O0lBRTlDO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7O0lBRUFD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LEtBQUssQ0FDcEIsR0FBRyxFQUFFLHlDQUF5QyxHQUFHdEIsVUFBVSxHQUN6RCxtQkFBbUIsQ0FBQztNQUMxQjtJQUNGO0lBQUM7O0lBRUQ7SUFDQSxTQUFTcUcsbUJBQW1CQSxDQUFBLEVBQUc7TUFDN0IsSUFBSXVCLGlCQUFpQixHQUNuQkMsR0FBRyxDQUFDQyx3QkFBd0I7TUFDNUI7TUFDQTtNQUNBRCxHQUFHLENBQUNFLGtCQUFrQjtNQUV4QixNQUFNQyxTQUFTLEdBQUdKLGlCQUFpQixDQUFDSyxHQUFHLENBQUMsQ0FBQztNQUN6QyxPQUFPRCxTQUFTLElBQUlBLFNBQVMsQ0FBQ2hILFlBQVk7SUFDNUM7SUFBQ2tILHNCQUFBO0VBQUEsU0FBQUMsV0FBQTtJQUFBLE9BQUFELHNCQUFBLENBQUFDLFdBQUE7RUFBQTtFQUFBRCxzQkFBQTtBQUFBO0VBQUF6SixJQUFBO0VBQUEySixLQUFBO0FBQUEsRyIsImZpbGUiOiIvcGFja2FnZXMvYWxsb3ctZGVueS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vL1xuLy8vIFJlbW90ZSBtZXRob2RzIGFuZCBhY2Nlc3MgY29udHJvbC5cbi8vL1xuXG5jb25zdCBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG4vLyBSZXN0cmljdCBkZWZhdWx0IG11dGF0b3JzIG9uIGNvbGxlY3Rpb24uIGFsbG93KCkgYW5kIGRlbnkoKSB0YWtlIHRoZVxuLy8gc2FtZSBvcHRpb25zOlxuLy9cbi8vIG9wdGlvbnMuaW5zZXJ0QXN5bmMge0Z1bmN0aW9uKHVzZXJJZCwgZG9jKX1cbi8vICAgcmV0dXJuIHRydWUgdG8gYWxsb3cvZGVueSBhZGRpbmcgdGhpcyBkb2N1bWVudFxuLy9cbi8vIG9wdGlvbnMudXBkYXRlQXN5bmMge0Z1bmN0aW9uKHVzZXJJZCwgZG9jcywgZmllbGRzLCBtb2RpZmllcil9XG4vLyAgIHJldHVybiB0cnVlIHRvIGFsbG93L2RlbnkgdXBkYXRpbmcgdGhlc2UgZG9jdW1lbnRzLlxuLy8gICBgZmllbGRzYCBpcyBwYXNzZWQgYXMgYW4gYXJyYXkgb2YgZmllbGRzIHRoYXQgYXJlIHRvIGJlIG1vZGlmaWVkXG4vL1xuLy8gb3B0aW9ucy5yZW1vdmVBc3luYyB7RnVuY3Rpb24odXNlcklkLCBkb2NzKX1cbi8vICAgcmV0dXJuIHRydWUgdG8gYWxsb3cvZGVueSByZW1vdmluZyB0aGVzZSBkb2N1bWVudHNcbi8vXG4vLyBvcHRpb25zLmZldGNoIHtBcnJheX1cbi8vICAgRmllbGRzIHRvIGZldGNoIGZvciB0aGVzZSB2YWxpZGF0b3JzLiBJZiBhbnkgY2FsbCB0byBhbGxvdyBvciBkZW55XG4vLyAgIGRvZXMgbm90IGhhdmUgdGhpcyBvcHRpb24gdGhlbiBhbGwgZmllbGRzIGFyZSBsb2FkZWQuXG4vL1xuLy8gYWxsb3cgYW5kIGRlbnkgY2FuIGJlIGNhbGxlZCBtdWx0aXBsZSB0aW1lcy4gVGhlIHZhbGlkYXRvcnMgYXJlXG4vLyBldmFsdWF0ZWQgYXMgZm9sbG93czpcbi8vIC0gSWYgbmVpdGhlciBkZW55KCkgbm9yIGFsbG93KCkgaGFzIGJlZW4gY2FsbGVkIG9uIHRoZSBjb2xsZWN0aW9uLFxuLy8gICB0aGVuIHRoZSByZXF1ZXN0IGlzIGFsbG93ZWQgaWYgYW5kIG9ubHkgaWYgdGhlIFwiaW5zZWN1cmVcIiBzbWFydFxuLy8gICBwYWNrYWdlIGlzIGluIHVzZS5cbi8vIC0gT3RoZXJ3aXNlLCBpZiBhbnkgZGVueSgpIGZ1bmN0aW9uIHJldHVybnMgdHJ1ZSwgdGhlIHJlcXVlc3QgaXMgZGVuaWVkLlxuLy8gLSBPdGhlcndpc2UsIGlmIGFueSBhbGxvdygpIGZ1bmN0aW9uIHJldHVybnMgdHJ1ZSwgdGhlIHJlcXVlc3QgaXMgYWxsb3dlZC5cbi8vIC0gT3RoZXJ3aXNlLCB0aGUgcmVxdWVzdCBpcyBkZW5pZWQuXG4vL1xuLy8gTWV0ZW9yIG1heSBjYWxsIHlvdXIgZGVueSgpIGFuZCBhbGxvdygpIGZ1bmN0aW9ucyBpbiBhbnkgb3JkZXIsIGFuZCBtYXkgbm90XG4vLyBjYWxsIGFsbCBvZiB0aGVtIGlmIGl0IGlzIGFibGUgdG8gbWFrZSBhIGRlY2lzaW9uIHdpdGhvdXQgY2FsbGluZyB0aGVtIGFsbFxuLy8gKHNvIGRvbid0IGluY2x1ZGUgc2lkZSBlZmZlY3RzKS5cblxuQWxsb3dEZW55ID0ge1xuICBDb2xsZWN0aW9uUHJvdG90eXBlOiB7fVxufTtcblxuLy8gSW4gdGhlIGBtb25nb2AgcGFja2FnZSwgd2Ugd2lsbCBleHRlbmQgTW9uZ28uQ29sbGVjdGlvbi5wcm90b3R5cGUgd2l0aCB0aGVzZVxuLy8gbWV0aG9kc1xuY29uc3QgQ29sbGVjdGlvblByb3RvdHlwZSA9IEFsbG93RGVueS5Db2xsZWN0aW9uUHJvdG90eXBlO1xuXG4vKipcbiAqIEBzdW1tYXJ5IEFsbG93IHVzZXJzIHRvIHdyaXRlIGRpcmVjdGx5IHRvIHRoaXMgY29sbGVjdGlvbiBmcm9tIGNsaWVudCBjb2RlLCBzdWJqZWN0IHRvIGxpbWl0YXRpb25zIHlvdSBkZWZpbmUuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAbWV0aG9kIGFsbG93XG4gKiBAbWVtYmVyT2YgTW9uZ28uQ29sbGVjdGlvblxuICogQGluc3RhbmNlXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0aW9ucy5pbnNlcnRBc3luYyx1cGRhdGVBc3luYyxyZW1vdmVBc3luYyBGdW5jdGlvbnMgdGhhdCBsb29rIGF0IGEgcHJvcG9zZWQgbW9kaWZpY2F0aW9uIHRvIHRoZSBkYXRhYmFzZSBhbmQgcmV0dXJuIHRydWUgaWYgaXQgc2hvdWxkIGJlIGFsbG93ZWQuXG4gKiBAcGFyYW0ge1N0cmluZ1tdfSBvcHRpb25zLmZldGNoIE9wdGlvbmFsIHBlcmZvcm1hbmNlIGVuaGFuY2VtZW50LiBMaW1pdHMgdGhlIGZpZWxkcyB0aGF0IHdpbGwgYmUgZmV0Y2hlZCBmcm9tIHRoZSBkYXRhYmFzZSBmb3IgaW5zcGVjdGlvbiBieSB5b3VyIGB1cGRhdGVgIGFuZCBgcmVtb3ZlYCBmdW5jdGlvbnMuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLnRyYW5zZm9ybSBPdmVycmlkZXMgYHRyYW5zZm9ybWAgb24gdGhlICBbYENvbGxlY3Rpb25gXSgjY29sbGVjdGlvbnMpLiAgUGFzcyBgbnVsbGAgdG8gZGlzYWJsZSB0cmFuc2Zvcm1hdGlvbi5cbiAqL1xuQ29sbGVjdGlvblByb3RvdHlwZS5hbGxvdyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgYWRkVmFsaWRhdG9yKHRoaXMsICdhbGxvdycsIG9wdGlvbnMpO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBPdmVycmlkZSBgYWxsb3dgIHJ1bGVzLlxuICogQGxvY3VzIFNlcnZlclxuICogQG1ldGhvZCBkZW55XG4gKiBAbWVtYmVyT2YgTW9uZ28uQ29sbGVjdGlvblxuICogQGluc3RhbmNlXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0aW9ucy5pbnNlcnRBc3luYyx1cGRhdGVBc3luYyxyZW1vdmVBc3luYyBGdW5jdGlvbnMgdGhhdCBsb29rIGF0IGEgcHJvcG9zZWQgbW9kaWZpY2F0aW9uIHRvIHRoZSBkYXRhYmFzZSBhbmQgcmV0dXJuIHRydWUgaWYgaXQgc2hvdWxkIGJlIGRlbmllZCwgZXZlbiBpZiBhbiBbYWxsb3ddKCNhbGxvdykgcnVsZSBzYXlzIG90aGVyd2lzZS5cbiAqIEBwYXJhbSB7U3RyaW5nW119IG9wdGlvbnMuZmV0Y2ggT3B0aW9uYWwgcGVyZm9ybWFuY2UgZW5oYW5jZW1lbnQuIExpbWl0cyB0aGUgZmllbGRzIHRoYXQgd2lsbCBiZSBmZXRjaGVkIGZyb20gdGhlIGRhdGFiYXNlIGZvciBpbnNwZWN0aW9uIGJ5IHlvdXIgYHVwZGF0ZWAgYW5kIGByZW1vdmVgIGZ1bmN0aW9ucy5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbnMudHJhbnNmb3JtIE92ZXJyaWRlcyBgdHJhbnNmb3JtYCBvbiB0aGUgIFtgQ29sbGVjdGlvbmBdKCNjb2xsZWN0aW9ucykuICBQYXNzIGBudWxsYCB0byBkaXNhYmxlIHRyYW5zZm9ybWF0aW9uLlxuICovXG5Db2xsZWN0aW9uUHJvdG90eXBlLmRlbnkgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIGFkZFZhbGlkYXRvcih0aGlzLCAnZGVueScsIG9wdGlvbnMpO1xufTtcblxuQ29sbGVjdGlvblByb3RvdHlwZS5fZGVmaW5lTXV0YXRpb25NZXRob2RzID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICBjb25zdCBzZWxmID0gdGhpcztcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgLy8gc2V0IHRvIHRydWUgb25jZSB3ZSBjYWxsIGFueSBhbGxvdyBvciBkZW55IG1ldGhvZHMuIElmIHRydWUsIHVzZVxuICAvLyBhbGxvdy9kZW55IHNlbWFudGljcy4gSWYgZmFsc2UsIHVzZSBpbnNlY3VyZSBtb2RlIHNlbWFudGljcy5cbiAgc2VsZi5fcmVzdHJpY3RlZCA9IGZhbHNlO1xuXG4gIC8vIEluc2VjdXJlIG1vZGUgKGRlZmF1bHQgdG8gYWxsb3dpbmcgd3JpdGVzKS4gRGVmYXVsdHMgdG8gJ3VuZGVmaW5lZCcgd2hpY2hcbiAgLy8gbWVhbnMgaW5zZWN1cmUgaWZmIHRoZSBpbnNlY3VyZSBwYWNrYWdlIGlzIGxvYWRlZC4gVGhpcyBwcm9wZXJ0eSBjYW4gYmVcbiAgLy8gb3ZlcnJpZGVuIGJ5IHRlc3RzIG9yIHBhY2thZ2VzIHdpc2hpbmcgdG8gY2hhbmdlIGluc2VjdXJlIG1vZGUgYmVoYXZpb3Igb2ZcbiAgLy8gdGhlaXIgY29sbGVjdGlvbnMuXG4gIHNlbGYuX2luc2VjdXJlID0gdW5kZWZpbmVkO1xuXG4gIHNlbGYuX3ZhbGlkYXRvcnMgPSB7XG4gICAgaW5zZXJ0OiB7YWxsb3c6IFtdLCBkZW55OiBbXX0sXG4gICAgdXBkYXRlOiB7YWxsb3c6IFtdLCBkZW55OiBbXX0sXG4gICAgcmVtb3ZlOiB7YWxsb3c6IFtdLCBkZW55OiBbXX0sXG4gICAgaW5zZXJ0QXN5bmM6IHthbGxvdzogW10sIGRlbnk6IFtdfSxcbiAgICB1cGRhdGVBc3luYzoge2FsbG93OiBbXSwgZGVueTogW119LFxuICAgIHJlbW92ZUFzeW5jOiB7YWxsb3c6IFtdLCBkZW55OiBbXX0sXG4gICAgdXBzZXJ0QXN5bmM6IHthbGxvdzogW10sIGRlbnk6IFtdfSwgLy8gZHVtbXkgYXJyYXlzOyBjYW4ndCBzZXQgdGhlc2UhXG4gICAgZmV0Y2g6IFtdLFxuICAgIGZldGNoQWxsRmllbGRzOiBmYWxzZVxuICB9O1xuXG4gIGlmICghc2VsZi5fbmFtZSlcbiAgICByZXR1cm47IC8vIGFub255bW91cyBjb2xsZWN0aW9uXG5cbiAgLy8gWFhYIFRoaW5rIGFib3V0IG1ldGhvZCBuYW1lc3BhY2luZy4gTWF5YmUgbWV0aG9kcyBzaG91bGQgYmVcbiAgLy8gXCJNZXRlb3I6TW9uZ286aW5zZXJ0QXN5bmMvTkFNRVwiP1xuICBzZWxmLl9wcmVmaXggPSAnLycgKyBzZWxmLl9uYW1lICsgJy8nO1xuXG4gIC8vIE11dGF0aW9uIE1ldGhvZHNcbiAgLy8gTWluaW1vbmdvIG9uIHRoZSBzZXJ2ZXIgZ2V0cyBubyBzdHViczsgaW5zdGVhZCwgYnkgZGVmYXVsdFxuICAvLyBpdCB3YWl0KClzIHVudGlsIGl0cyByZXN1bHQgaXMgcmVhZHksIHlpZWxkaW5nLlxuICAvLyBUaGlzIG1hdGNoZXMgdGhlIGJlaGF2aW9yIG9mIG1hY3JvbW9uZ28gb24gdGhlIHNlcnZlciBiZXR0ZXIuXG4gIC8vIFhYWCBzZWUgI01ldGVvclNlcnZlck51bGxcbiAgaWYgKHNlbGYuX2Nvbm5lY3Rpb24gJiYgKHNlbGYuX2Nvbm5lY3Rpb24gPT09IE1ldGVvci5zZXJ2ZXIgfHwgTWV0ZW9yLmlzQ2xpZW50KSkge1xuICAgIGNvbnN0IG0gPSB7fTtcblxuICAgIFtcbiAgICAgICdpbnNlcnRBc3luYycsXG4gICAgICAndXBkYXRlQXN5bmMnLFxuICAgICAgJ3JlbW92ZUFzeW5jJyxcbiAgICAgICdpbnNlcnQnLFxuICAgICAgJ3VwZGF0ZScsXG4gICAgICAncmVtb3ZlJyxcbiAgICBdLmZvckVhY2gobWV0aG9kID0+IHtcbiAgICAgIGNvbnN0IG1ldGhvZE5hbWUgPSBzZWxmLl9wcmVmaXggKyBtZXRob2Q7XG5cbiAgICAgIGlmIChvcHRpb25zLnVzZUV4aXN0aW5nKSB7XG4gICAgICAgIGNvbnN0IGhhbmRsZXJQcm9wTmFtZSA9IE1ldGVvci5pc0NsaWVudFxuICAgICAgICAgID8gJ19tZXRob2RIYW5kbGVycydcbiAgICAgICAgICA6ICdtZXRob2RfaGFuZGxlcnMnO1xuICAgICAgICAvLyBEbyBub3QgdHJ5IHRvIGNyZWF0ZSBhZGRpdGlvbmFsIG1ldGhvZHMgaWYgdGhpcyBoYXMgYWxyZWFkeSBiZWVuIGNhbGxlZC5cbiAgICAgICAgLy8gKE90aGVyd2lzZSB0aGUgLm1ldGhvZHMoKSBjYWxsIGJlbG93IHdpbGwgdGhyb3cgYW4gZXJyb3IuKVxuICAgICAgICBpZiAoXG4gICAgICAgICAgc2VsZi5fY29ubmVjdGlvbltoYW5kbGVyUHJvcE5hbWVdICYmXG4gICAgICAgICAgdHlwZW9mIHNlbGYuX2Nvbm5lY3Rpb25baGFuZGxlclByb3BOYW1lXVttZXRob2ROYW1lXSA9PT0gJ2Z1bmN0aW9uJ1xuICAgICAgICApXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBpc0luc2VydCA9IG5hbWUgPT4gbmFtZS5pbmNsdWRlcygnaW5zZXJ0Jyk7XG5cbiAgICAgIG1bbWV0aG9kTmFtZV0gPSBmdW5jdGlvbiAoLyogLi4uICovKSB7XG4gICAgICAgIC8vIEFsbCB0aGUgbWV0aG9kcyBkbyB0aGVpciBvd24gdmFsaWRhdGlvbiwgaW5zdGVhZCBvZiB1c2luZyBjaGVjaygpLlxuICAgICAgICBjaGVjayhhcmd1bWVudHMsIFtNYXRjaC5BbnldKTtcbiAgICAgICAgY29uc3QgYXJncyA9IEFycmF5LmZyb20oYXJndW1lbnRzKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAvLyBGb3IgYW4gaW5zZXJ0L2luc2VydEFzeW5jLCBpZiB0aGUgY2xpZW50IGRpZG4ndCBzcGVjaWZ5IGFuIF9pZCwgZ2VuZXJhdGUgb25lXG4gICAgICAgICAgLy8gbm93OyBiZWNhdXNlIHRoaXMgdXNlcyBERFAucmFuZG9tU3RyZWFtLCBpdCB3aWxsIGJlIGNvbnNpc3RlbnQgd2l0aFxuICAgICAgICAgIC8vIHdoYXQgdGhlIGNsaWVudCBnZW5lcmF0ZWQuIFdlIGdlbmVyYXRlIGl0IG5vdyByYXRoZXIgdGhhbiBsYXRlciBzb1xuICAgICAgICAgIC8vIHRoYXQgaWYgKGVnKSBhbiBhbGxvdy9kZW55IHJ1bGUgZG9lcyBhbiBpbnNlcnQvaW5zZXJ0QXN5bmMgdG8gdGhlIHNhbWVcbiAgICAgICAgICAvLyBjb2xsZWN0aW9uIChub3QgdGhhdCBpdCByZWFsbHkgc2hvdWxkKSwgdGhlIGdlbmVyYXRlZCBfaWQgd2lsbFxuICAgICAgICAgIC8vIHN0aWxsIGJlIHRoZSBmaXJzdCB1c2Ugb2YgdGhlIHN0cmVhbSBhbmQgd2lsbCBiZSBjb25zaXN0ZW50LlxuICAgICAgICAgIC8vXG4gICAgICAgICAgLy8gSG93ZXZlciwgd2UgZG9uJ3QgYWN0dWFsbHkgc3RpY2sgdGhlIF9pZCBvbnRvIHRoZSBkb2N1bWVudCB5ZXQsXG4gICAgICAgICAgLy8gYmVjYXVzZSB3ZSB3YW50IGFsbG93L2RlbnkgcnVsZXMgdG8gYmUgYWJsZSB0byBkaWZmZXJlbnRpYXRlXG4gICAgICAgICAgLy8gYmV0d2VlbiBhcmJpdHJhcnkgY2xpZW50LXNwZWNpZmllZCBfaWQgZmllbGRzIGFuZCBtZXJlbHlcbiAgICAgICAgICAvLyBjbGllbnQtY29udHJvbGxlZC12aWEtcmFuZG9tU2VlZCBmaWVsZHMuXG4gICAgICAgICAgbGV0IGdlbmVyYXRlZElkID0gbnVsbDtcbiAgICAgICAgICBpZiAoaXNJbnNlcnQobWV0aG9kKSAmJiAhaGFzT3duLmNhbGwoYXJnc1swXSwgJ19pZCcpKSB7XG4gICAgICAgICAgICBnZW5lcmF0ZWRJZCA9IHNlbGYuX21ha2VOZXdJRCgpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICh0aGlzLmlzU2ltdWxhdGlvbikge1xuICAgICAgICAgICAgLy8gSW4gYSBjbGllbnQgc2ltdWxhdGlvbiwgeW91IGNhbiBkbyBhbnkgbXV0YXRpb24gKGV2ZW4gd2l0aCBhXG4gICAgICAgICAgICAvLyBjb21wbGV4IHNlbGVjdG9yKS5cbiAgICAgICAgICAgIGlmIChnZW5lcmF0ZWRJZCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICBhcmdzWzBdLl9pZCA9IGdlbmVyYXRlZElkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHNlbGYuX2NvbGxlY3Rpb25bbWV0aG9kXS5hcHBseShzZWxmLl9jb2xsZWN0aW9uLCBhcmdzKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBUaGlzIGlzIHRoZSBzZXJ2ZXIgcmVjZWl2aW5nIGEgbWV0aG9kIGNhbGwgZnJvbSB0aGUgY2xpZW50LlxuXG4gICAgICAgICAgLy8gV2UgZG9uJ3QgYWxsb3cgYXJiaXRyYXJ5IHNlbGVjdG9ycyBpbiBtdXRhdGlvbnMgZnJvbSB0aGUgY2xpZW50OiBvbmx5XG4gICAgICAgICAgLy8gc2luZ2xlLUlEIHNlbGVjdG9ycy5cbiAgICAgICAgICBpZiAoIWlzSW5zZXJ0KG1ldGhvZCkpIHRocm93SWZTZWxlY3RvcklzTm90SWQoYXJnc1swXSwgbWV0aG9kKTtcblxuICAgICAgICAgIGlmIChzZWxmLl9yZXN0cmljdGVkKSB7XG4gICAgICAgICAgICAvLyBzaG9ydCBjaXJjdWl0IGlmIHRoZXJlIGlzIG5vIHdheSBpdCB3aWxsIHBhc3MuXG4gICAgICAgICAgICBpZiAoc2VsZi5fdmFsaWRhdG9yc1ttZXRob2RdLmFsbG93Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKFxuICAgICAgICAgICAgICAgIDQwMyxcbiAgICAgICAgICAgICAgICAnQWNjZXNzIGRlbmllZC4gTm8gYWxsb3cgdmFsaWRhdG9ycyBzZXQgb24gcmVzdHJpY3RlZCAnICtcbiAgICAgICAgICAgICAgICAgIFwiY29sbGVjdGlvbiBmb3IgbWV0aG9kICdcIiArXG4gICAgICAgICAgICAgICAgICBtZXRob2QgK1xuICAgICAgICAgICAgICAgICAgXCInLlwiXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHN5bmNNZXRob2ROYW1lID0gbWV0aG9kLnJlcGxhY2UoJ0FzeW5jJywgJycpO1xuICAgICAgICAgICAgY29uc3Qgc3luY1ZhbGlkYXRlZE1ldGhvZE5hbWUgPSAnX3ZhbGlkYXRlZCcgKyBtZXRob2QuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzeW5jTWV0aG9kTmFtZS5zbGljZSgxKTtcbiAgICAgICAgICAgIC8vIGl0IGZvcmNlcyB0byB1c2UgYXN5bmMgdmFsaWRhdGVkIGJlaGF2aW9yIG9uIHRoZSBzZXJ2ZXJcbiAgICAgICAgICAgIGNvbnN0IHZhbGlkYXRlZE1ldGhvZE5hbWUgPSBNZXRlb3IuaXNTZXJ2ZXIgPyBzeW5jVmFsaWRhdGVkTWV0aG9kTmFtZSArICdBc3luYycgOiBzeW5jVmFsaWRhdGVkTWV0aG9kTmFtZTtcblxuICAgICAgICAgICAgYXJncy51bnNoaWZ0KHRoaXMudXNlcklkKTtcbiAgICAgICAgICAgIGlzSW5zZXJ0KG1ldGhvZCkgJiYgYXJncy5wdXNoKGdlbmVyYXRlZElkKTtcbiAgICAgICAgICAgIHJldHVybiBzZWxmW3ZhbGlkYXRlZE1ldGhvZE5hbWVdLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoc2VsZi5faXNJbnNlY3VyZSgpKSB7XG4gICAgICAgICAgICBpZiAoZ2VuZXJhdGVkSWQgIT09IG51bGwpIGFyZ3NbMF0uX2lkID0gZ2VuZXJhdGVkSWQ7XG4gICAgICAgICAgICAvLyBJbiBpbnNlY3VyZSBtb2RlIHdlIHVzZSB0aGUgc2VydmVyIF9jb2xsZWN0aW9uIG1ldGhvZHMsIGFuZCB0aGVzZSBzeW5jIG1ldGhvZHNcbiAgICAgICAgICAgIC8vIGRvIG5vdCBleGlzdCBpbiB0aGUgc2VydmVyIGFueW1vcmUsIHNvIHdlIGhhdmUgdGhpcyBtYXBwZXIgdG8gY2FsbCB0aGUgYXN5bmMgbWV0aG9kc1xuICAgICAgICAgICAgLy8gaW5zdGVhZC5cbiAgICAgICAgICAgIGNvbnN0IHN5bmNNZXRob2RzTWFwcGVyID0ge1xuICAgICAgICAgICAgICBpbnNlcnQ6IFwiaW5zZXJ0QXN5bmNcIixcbiAgICAgICAgICAgICAgdXBkYXRlOiBcInVwZGF0ZUFzeW5jXCIsXG4gICAgICAgICAgICAgIHJlbW92ZTogXCJyZW1vdmVBc3luY1wiLFxuICAgICAgICAgICAgfTtcblxuXG4gICAgICAgICAgICAvLyBJbiBpbnNlY3VyZSBtb2RlLCBhbGxvdyBhbnkgbXV0YXRpb24gKHdpdGggYSBzaW1wbGUgc2VsZWN0b3IpLlxuICAgICAgICAgICAgLy8gWFhYIFRoaXMgaXMga2luZCBvZiBib2d1cy4gIEluc3RlYWQgb2YgYmxpbmRseSBwYXNzaW5nIHdoYXRldmVyXG4gICAgICAgICAgICAvLyAgICAgd2UgZ2V0IGZyb20gdGhlIG5ldHdvcmsgdG8gdGhpcyBmdW5jdGlvbiwgd2Ugc2hvdWxkIGFjdHVhbGx5XG4gICAgICAgICAgICAvLyAgICAga25vdyB0aGUgY29ycmVjdCBhcmd1bWVudHMgZm9yIHRoZSBmdW5jdGlvbiBhbmQgcGFzcyBqdXN0XG4gICAgICAgICAgICAvLyAgICAgdGhlbS4gIEZvciBleGFtcGxlLCBpZiB5b3UgaGF2ZSBhbiBleHRyYW5lb3VzIGV4dHJhIG51bGxcbiAgICAgICAgICAgIC8vICAgICBhcmd1bWVudCBhbmQgdGhpcyBpcyBNb25nbyBvbiB0aGUgc2VydmVyLCB0aGUgLndyYXBBc3luYydkXG4gICAgICAgICAgICAvLyAgICAgZnVuY3Rpb25zIGxpa2UgdXBkYXRlIHdpbGwgZ2V0IGNvbmZ1c2VkIGFuZCBwYXNzIHRoZVxuICAgICAgICAgICAgLy8gICAgIFwiZnV0LnJlc29sdmVyKClcIiBpbiB0aGUgd3Jvbmcgc2xvdCwgd2hlcmUgX3VwZGF0ZSB3aWxsIG5ldmVyXG4gICAgICAgICAgICAvLyAgICAgaW52b2tlIGl0LiBCYW0sIGJyb2tlbiBERFAgY29ubmVjdGlvbi4gIFByb2JhYmx5IHNob3VsZCBqdXN0XG4gICAgICAgICAgICAvLyAgICAgdGFrZSB0aGlzIHdob2xlIG1ldGhvZCBhbmQgd3JpdGUgaXQgdGhyZWUgdGltZXMsIGludm9raW5nXG4gICAgICAgICAgICAvLyAgICAgaGVscGVycyBmb3IgdGhlIGNvbW1vbiBjb2RlLlxuICAgICAgICAgICAgcmV0dXJuIHNlbGYuX2NvbGxlY3Rpb25bc3luY01ldGhvZHNNYXBwZXJbbWV0aG9kXSB8fCBtZXRob2RdLmFwcGx5KHNlbGYuX2NvbGxlY3Rpb24sIGFyZ3MpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBJbiBzZWN1cmUgbW9kZSwgaWYgd2UgaGF2ZW4ndCBjYWxsZWQgYWxsb3cgb3IgZGVueSwgdGhlbiBub3RoaW5nXG4gICAgICAgICAgICAvLyBpcyBwZXJtaXR0ZWQuXG4gICAgICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgJ0FjY2VzcyBkZW5pZWQnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBlLm5hbWUgPT09ICdNb25nb0Vycm9yJyB8fFxuICAgICAgICAgICAgLy8gZm9yIG9sZCB2ZXJzaW9ucyBvZiBNb25nb0RCIChwcm9iYWJseSBub3QgbmVjZXNzYXJ5IGJ1dCBpdCdzIGhlcmUganVzdCBpbiBjYXNlKVxuICAgICAgICAgICAgZS5uYW1lID09PSAnQnVsa1dyaXRlRXJyb3InIHx8XG4gICAgICAgICAgICAvLyBmb3IgbmV3ZXIgdmVyc2lvbnMgb2YgTW9uZ29EQiAoaHR0cHM6Ly9kb2NzLm1vbmdvZGIuY29tL2RyaXZlcnMvbm9kZS9jdXJyZW50L3doYXRzLW5ldy8jYnVsa3dyaXRlZXJyb3ItLS1tb25nb2J1bGt3cml0ZWVycm9yKVxuICAgICAgICAgICAgZS5uYW1lID09PSAnTW9uZ29CdWxrV3JpdGVFcnJvcicgfHxcbiAgICAgICAgICAgIGUubmFtZSA9PT0gJ01pbmltb25nb0Vycm9yJ1xuICAgICAgICAgICkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDksIGUudG9TdHJpbmcoKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuXG4gICAgc2VsZi5fY29ubmVjdGlvbi5tZXRob2RzKG0pO1xuICB9XG59O1xuXG5Db2xsZWN0aW9uUHJvdG90eXBlLl91cGRhdGVGZXRjaCA9IGZ1bmN0aW9uIChmaWVsZHMpIHtcbiAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgaWYgKCFzZWxmLl92YWxpZGF0b3JzLmZldGNoQWxsRmllbGRzKSB7XG4gICAgaWYgKGZpZWxkcykge1xuICAgICAgY29uc3QgdW5pb24gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgICAgY29uc3QgYWRkID0gbmFtZXMgPT4gbmFtZXMgJiYgbmFtZXMuZm9yRWFjaChuYW1lID0+IHVuaW9uW25hbWVdID0gMSk7XG4gICAgICBhZGQoc2VsZi5fdmFsaWRhdG9ycy5mZXRjaCk7XG4gICAgICBhZGQoZmllbGRzKTtcbiAgICAgIHNlbGYuX3ZhbGlkYXRvcnMuZmV0Y2ggPSBPYmplY3Qua2V5cyh1bmlvbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGYuX3ZhbGlkYXRvcnMuZmV0Y2hBbGxGaWVsZHMgPSB0cnVlO1xuICAgICAgLy8gY2xlYXIgZmV0Y2gganVzdCB0byBtYWtlIHN1cmUgd2UgZG9uJ3QgYWNjaWRlbnRhbGx5IHJlYWQgaXRcbiAgICAgIHNlbGYuX3ZhbGlkYXRvcnMuZmV0Y2ggPSBudWxsO1xuICAgIH1cbiAgfVxufTtcblxuQ29sbGVjdGlvblByb3RvdHlwZS5faXNJbnNlY3VyZSA9IGZ1bmN0aW9uICgpIHtcbiAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gIGlmIChzZWxmLl9pbnNlY3VyZSA9PT0gdW5kZWZpbmVkKVxuICAgIHJldHVybiAhIVBhY2thZ2UuaW5zZWN1cmU7XG4gIHJldHVybiBzZWxmLl9pbnNlY3VyZTtcbn07XG5cbmFzeW5jIGZ1bmN0aW9uIGFzeW5jU29tZShhcnJheSwgcHJlZGljYXRlKSB7XG4gIGZvciAobGV0IGl0ZW0gb2YgYXJyYXkpIHtcbiAgICBpZiAoYXdhaXQgcHJlZGljYXRlKGl0ZW0pKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5hc3luYyBmdW5jdGlvbiBhc3luY0V2ZXJ5KGFycmF5LCBwcmVkaWNhdGUpIHtcbiAgZm9yIChsZXQgaXRlbSBvZiBhcnJheSkge1xuICAgIGlmICghYXdhaXQgcHJlZGljYXRlKGl0ZW0pKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5Db2xsZWN0aW9uUHJvdG90eXBlLl92YWxpZGF0ZWRJbnNlcnRBc3luYyA9IGFzeW5jIGZ1bmN0aW9uKHVzZXJJZCwgZG9jLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnZW5lcmF0ZWRJZCkge1xuICBjb25zdCBzZWxmID0gdGhpcztcbiAgLy8gY2FsbCB1c2VyIHZhbGlkYXRvcnMuXG4gIC8vIEFueSBkZW55IHJldHVybnMgdHJ1ZSBtZWFucyBkZW5pZWQuXG4gIGlmIChhd2FpdCBhc3luY1NvbWUoc2VsZi5fdmFsaWRhdG9ycy5pbnNlcnRBc3luYy5kZW55LCBhc3luYyAodmFsaWRhdG9yKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gdmFsaWRhdG9yKHVzZXJJZCwgZG9jVG9WYWxpZGF0ZSh2YWxpZGF0b3IsIGRvYywgZ2VuZXJhdGVkSWQpKTtcbiAgICByZXR1cm4gTWV0ZW9yLl9pc1Byb21pc2UocmVzdWx0KSA/IGF3YWl0IHJlc3VsdCA6IHJlc3VsdDtcbiAgfSkpIHtcbiAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJBY2Nlc3MgZGVuaWVkXCIpO1xuICB9XG4gIC8vIEFueSBhbGxvdyByZXR1cm5zIHRydWUgbWVhbnMgcHJvY2VlZC4gVGhyb3cgZXJyb3IgaWYgdGhleSBhbGwgZmFpbC5cblxuICBpZiAoYXdhaXQgYXN5bmNFdmVyeShzZWxmLl92YWxpZGF0b3JzLmluc2VydEFzeW5jLmFsbG93LCBhc3luYyAodmFsaWRhdG9yKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gdmFsaWRhdG9yKHVzZXJJZCwgZG9jVG9WYWxpZGF0ZSh2YWxpZGF0b3IsIGRvYywgZ2VuZXJhdGVkSWQpKTtcbiAgICByZXR1cm4gIShNZXRlb3IuX2lzUHJvbWlzZShyZXN1bHQpID8gYXdhaXQgcmVzdWx0IDogcmVzdWx0KTtcbiAgfSkpIHtcbiAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJBY2Nlc3MgZGVuaWVkXCIpO1xuICB9XG5cbiAgLy8gSWYgd2UgZ2VuZXJhdGVkIGFuIElEIGFib3ZlLCBpbnNlcnRBc3luYyBpdCBub3c6IGFmdGVyIHRoZSB2YWxpZGF0aW9uLCBidXRcbiAgLy8gYmVmb3JlIGFjdHVhbGx5IGluc2VydGluZy5cbiAgaWYgKGdlbmVyYXRlZElkICE9PSBudWxsKVxuICAgIGRvYy5faWQgPSBnZW5lcmF0ZWRJZDtcblxuICByZXR1cm4gc2VsZi5fY29sbGVjdGlvbi5pbnNlcnRBc3luYy5jYWxsKHNlbGYuX2NvbGxlY3Rpb24sIGRvYyk7XG59O1xuXG5Db2xsZWN0aW9uUHJvdG90eXBlLl92YWxpZGF0ZWRJbnNlcnQgPSBmdW5jdGlvbiAodXNlcklkLCBkb2MsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnZW5lcmF0ZWRJZCkge1xuICBjb25zdCBzZWxmID0gdGhpcztcblxuICAvLyBjYWxsIHVzZXIgdmFsaWRhdG9ycy5cbiAgLy8gQW55IGRlbnkgcmV0dXJucyB0cnVlIG1lYW5zIGRlbmllZC5cbiAgaWYgKHNlbGYuX3ZhbGlkYXRvcnMuaW5zZXJ0LmRlbnkuc29tZSgodmFsaWRhdG9yKSA9PiB7XG4gICAgcmV0dXJuIHZhbGlkYXRvcih1c2VySWQsIGRvY1RvVmFsaWRhdGUodmFsaWRhdG9yLCBkb2MsIGdlbmVyYXRlZElkKSk7XG4gIH0pKSB7XG4gICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDMsIFwiQWNjZXNzIGRlbmllZFwiKTtcbiAgfVxuICAvLyBBbnkgYWxsb3cgcmV0dXJucyB0cnVlIG1lYW5zIHByb2NlZWQuIFRocm93IGVycm9yIGlmIHRoZXkgYWxsIGZhaWwuXG5cbiAgaWYgKHNlbGYuX3ZhbGlkYXRvcnMuaW5zZXJ0LmFsbG93LmV2ZXJ5KCh2YWxpZGF0b3IpID0+IHtcbiAgICByZXR1cm4gIXZhbGlkYXRvcih1c2VySWQsIGRvY1RvVmFsaWRhdGUodmFsaWRhdG9yLCBkb2MsIGdlbmVyYXRlZElkKSk7XG4gIH0pKSB7XG4gICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDMsIFwiQWNjZXNzIGRlbmllZFwiKTtcbiAgfVxuXG4gIC8vIElmIHdlIGdlbmVyYXRlZCBhbiBJRCBhYm92ZSwgaW5zZXJ0IGl0IG5vdzogYWZ0ZXIgdGhlIHZhbGlkYXRpb24sIGJ1dFxuICAvLyBiZWZvcmUgYWN0dWFsbHkgaW5zZXJ0aW5nLlxuICBpZiAoZ2VuZXJhdGVkSWQgIT09IG51bGwpXG4gICAgZG9jLl9pZCA9IGdlbmVyYXRlZElkO1xuXG4gIHJldHVybiAoTWV0ZW9yLmlzU2VydmVyXG4gICAgPyBzZWxmLl9jb2xsZWN0aW9uLmluc2VydEFzeW5jXG4gICAgOiBzZWxmLl9jb2xsZWN0aW9uLmluc2VydFxuICApLmNhbGwoc2VsZi5fY29sbGVjdGlvbiwgZG9jKTtcbn07XG5cbi8vIFNpbXVsYXRlIGEgbW9uZ28gYHVwZGF0ZWAgb3BlcmF0aW9uIHdoaWxlIHZhbGlkYXRpbmcgdGhhdCB0aGUgYWNjZXNzXG4vLyBjb250cm9sIHJ1bGVzIHNldCBieSBjYWxscyB0byBgYWxsb3cvZGVueWAgYXJlIHNhdGlzZmllZC4gSWYgYWxsXG4vLyBwYXNzLCByZXdyaXRlIHRoZSBtb25nbyBvcGVyYXRpb24gdG8gdXNlICRpbiB0byBzZXQgdGhlIGxpc3Qgb2Zcbi8vIGRvY3VtZW50IGlkcyB0byBjaGFuZ2UgIyNWYWxpZGF0ZWRDaGFuZ2VcbkNvbGxlY3Rpb25Qcm90b3R5cGUuX3ZhbGlkYXRlZFVwZGF0ZUFzeW5jID0gYXN5bmMgZnVuY3Rpb24oXG4gICAgdXNlcklkLCBzZWxlY3RvciwgbXV0YXRvciwgb3B0aW9ucykge1xuICBjb25zdCBzZWxmID0gdGhpcztcblxuICBjaGVjayhtdXRhdG9yLCBPYmplY3QpO1xuXG4gIG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKE9iamVjdC5jcmVhdGUobnVsbCksIG9wdGlvbnMpO1xuXG4gIGlmICghTG9jYWxDb2xsZWN0aW9uLl9zZWxlY3RvcklzSWRQZXJoYXBzQXNPYmplY3Qoc2VsZWN0b3IpKVxuICAgIHRocm93IG5ldyBFcnJvcihcInZhbGlkYXRlZCB1cGRhdGUgc2hvdWxkIGJlIG9mIGEgc2luZ2xlIElEXCIpO1xuXG4gIC8vIFdlIGRvbid0IHN1cHBvcnQgdXBzZXJ0cyBiZWNhdXNlIHRoZXkgZG9uJ3QgZml0IG5pY2VseSBpbnRvIGFsbG93L2RlbnlcbiAgLy8gcnVsZXMuXG4gIGlmIChvcHRpb25zLnVwc2VydClcbiAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJBY2Nlc3MgZGVuaWVkLiBVcHNlcnRzIG5vdCBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBcImFsbG93ZWQgaW4gYSByZXN0cmljdGVkIGNvbGxlY3Rpb24uXCIpO1xuXG4gIGNvbnN0IG5vUmVwbGFjZUVycm9yID0gXCJBY2Nlc3MgZGVuaWVkLiBJbiBhIHJlc3RyaWN0ZWQgY29sbGVjdGlvbiB5b3UgY2FuIG9ubHlcIiArXG4gICAgICAgIFwiIHVwZGF0ZSBkb2N1bWVudHMsIG5vdCByZXBsYWNlIHRoZW0uIFVzZSBhIE1vbmdvIHVwZGF0ZSBvcGVyYXRvciwgc3VjaCBcIiArXG4gICAgICAgIFwiYXMgJyRzZXQnLlwiO1xuXG4gIGNvbnN0IG11dGF0b3JLZXlzID0gT2JqZWN0LmtleXMobXV0YXRvcik7XG5cbiAgLy8gY29tcHV0ZSBtb2RpZmllZCBmaWVsZHNcbiAgY29uc3QgbW9kaWZpZWRGaWVsZHMgPSB7fTtcblxuICBpZiAobXV0YXRvcktleXMubGVuZ3RoID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDMsIG5vUmVwbGFjZUVycm9yKTtcbiAgfVxuICBtdXRhdG9yS2V5cy5mb3JFYWNoKChvcCkgPT4ge1xuICAgIGNvbnN0IHBhcmFtcyA9IG11dGF0b3Jbb3BdO1xuICAgIGlmIChvcC5jaGFyQXQoMCkgIT09ICckJykge1xuICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDMsIG5vUmVwbGFjZUVycm9yKTtcbiAgICB9IGVsc2UgaWYgKCFoYXNPd24uY2FsbChBTExPV0VEX1VQREFURV9PUEVSQVRJT05TLCBvcCkpIHtcbiAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoXG4gICAgICAgIDQwMywgXCJBY2Nlc3MgZGVuaWVkLiBPcGVyYXRvciBcIiArIG9wICsgXCIgbm90IGFsbG93ZWQgaW4gYSByZXN0cmljdGVkIGNvbGxlY3Rpb24uXCIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBPYmplY3Qua2V5cyhwYXJhbXMpLmZvckVhY2goKGZpZWxkKSA9PiB7XG4gICAgICAgIC8vIHRyZWF0IGRvdHRlZCBmaWVsZHMgYXMgaWYgdGhleSBhcmUgcmVwbGFjaW5nIHRoZWlyXG4gICAgICAgIC8vIHRvcC1sZXZlbCBwYXJ0XG4gICAgICAgIGlmIChmaWVsZC5pbmRleE9mKCcuJykgIT09IC0xKVxuICAgICAgICAgIGZpZWxkID0gZmllbGQuc3Vic3RyaW5nKDAsIGZpZWxkLmluZGV4T2YoJy4nKSk7XG5cbiAgICAgICAgLy8gcmVjb3JkIHRoZSBmaWVsZCB3ZSBhcmUgdHJ5aW5nIHRvIGNoYW5nZVxuICAgICAgICBtb2RpZmllZEZpZWxkc1tmaWVsZF0gPSB0cnVlO1xuICAgICAgfSk7XG4gICAgfVxuICB9KTtcblxuICBjb25zdCBmaWVsZHMgPSBPYmplY3Qua2V5cyhtb2RpZmllZEZpZWxkcyk7XG5cbiAgY29uc3QgZmluZE9wdGlvbnMgPSB7dHJhbnNmb3JtOiBudWxsfTtcbiAgaWYgKCFzZWxmLl92YWxpZGF0b3JzLmZldGNoQWxsRmllbGRzKSB7XG4gICAgZmluZE9wdGlvbnMuZmllbGRzID0ge307XG4gICAgc2VsZi5fdmFsaWRhdG9ycy5mZXRjaC5mb3JFYWNoKChmaWVsZE5hbWUpID0+IHtcbiAgICAgIGZpbmRPcHRpb25zLmZpZWxkc1tmaWVsZE5hbWVdID0gMTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IGRvYyA9IGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24uZmluZE9uZUFzeW5jKHNlbGVjdG9yLCBmaW5kT3B0aW9ucyk7XG4gIGlmICghZG9jKSAgLy8gbm9uZSBzYXRpc2ZpZWQhXG4gICAgcmV0dXJuIDA7XG5cbiAgLy8gY2FsbCB1c2VyIHZhbGlkYXRvcnMuXG4gIC8vIEFueSBkZW55IHJldHVybnMgdHJ1ZSBtZWFucyBkZW5pZWQuXG4gIGlmIChhd2FpdCBhc3luY1NvbWUoc2VsZi5fdmFsaWRhdG9ycy51cGRhdGVBc3luYy5kZW55LCBhc3luYyAodmFsaWRhdG9yKSA9PiB7XG4gICAgY29uc3QgZmFjdG9yaWVkRG9jID0gdHJhbnNmb3JtRG9jKHZhbGlkYXRvciwgZG9jKTtcbiAgICBjb25zdCByZXN1bHQgPSB2YWxpZGF0b3IodXNlcklkLFxuICAgICAgZmFjdG9yaWVkRG9jLFxuICAgICAgZmllbGRzLFxuICAgICAgbXV0YXRvcik7XG4gICAgcmV0dXJuIE1ldGVvci5faXNQcm9taXNlKHJlc3VsdCkgPyBhd2FpdCByZXN1bHQgOiByZXN1bHQ7XG4gIH0pKSB7XG4gICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDMsIFwiQWNjZXNzIGRlbmllZFwiKTtcbiAgfVxuICAvLyBBbnkgYWxsb3cgcmV0dXJucyB0cnVlIG1lYW5zIHByb2NlZWQuIFRocm93IGVycm9yIGlmIHRoZXkgYWxsIGZhaWwuXG4gIGlmIChhd2FpdCBhc3luY0V2ZXJ5KHNlbGYuX3ZhbGlkYXRvcnMudXBkYXRlQXN5bmMuYWxsb3csIGFzeW5jICh2YWxpZGF0b3IpID0+IHtcbiAgICBjb25zdCBmYWN0b3JpZWREb2MgPSB0cmFuc2Zvcm1Eb2ModmFsaWRhdG9yLCBkb2MpO1xuICAgIGNvbnN0IHJlc3VsdCA9IHZhbGlkYXRvcih1c2VySWQsXG4gICAgICBmYWN0b3JpZWREb2MsXG4gICAgICBmaWVsZHMsXG4gICAgICBtdXRhdG9yKTtcbiAgICByZXR1cm4gIShNZXRlb3IuX2lzUHJvbWlzZShyZXN1bHQpID8gYXdhaXQgcmVzdWx0IDogcmVzdWx0KTtcbiAgfSkpIHtcbiAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJBY2Nlc3MgZGVuaWVkXCIpO1xuICB9XG5cbiAgb3B0aW9ucy5fZm9yYmlkUmVwbGFjZSA9IHRydWU7XG5cbiAgLy8gQmFjayB3aGVuIHdlIHN1cHBvcnRlZCBhcmJpdHJhcnkgY2xpZW50LXByb3ZpZGVkIHNlbGVjdG9ycywgd2UgYWN0dWFsbHlcbiAgLy8gcmV3cm90ZSB0aGUgc2VsZWN0b3IgdG8gaW5jbHVkZSBhbiBfaWQgY2xhdXNlIGJlZm9yZSBwYXNzaW5nIHRvIE1vbmdvIHRvXG4gIC8vIGF2b2lkIHJhY2VzLCBidXQgc2luY2Ugc2VsZWN0b3IgaXMgZ3VhcmFudGVlZCB0byBhbHJlYWR5IGp1c3QgYmUgYW4gSUQsIHdlXG4gIC8vIGRvbid0IGhhdmUgdG8gYW55IG1vcmUuXG5cbiAgcmV0dXJuIHNlbGYuX2NvbGxlY3Rpb24udXBkYXRlQXN5bmMuY2FsbChcbiAgICBzZWxmLl9jb2xsZWN0aW9uLCBzZWxlY3RvciwgbXV0YXRvciwgb3B0aW9ucyk7XG59O1xuXG5Db2xsZWN0aW9uUHJvdG90eXBlLl92YWxpZGF0ZWRVcGRhdGUgPSBmdW5jdGlvbihcbiAgICB1c2VySWQsIHNlbGVjdG9yLCBtdXRhdG9yLCBvcHRpb25zKSB7XG4gIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gIGNoZWNrKG11dGF0b3IsIE9iamVjdCk7XG5cbiAgb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oT2JqZWN0LmNyZWF0ZShudWxsKSwgb3B0aW9ucyk7XG5cbiAgaWYgKCFMb2NhbENvbGxlY3Rpb24uX3NlbGVjdG9ySXNJZFBlcmhhcHNBc09iamVjdChzZWxlY3RvcikpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwidmFsaWRhdGVkIHVwZGF0ZSBzaG91bGQgYmUgb2YgYSBzaW5nbGUgSURcIik7XG5cbiAgLy8gV2UgZG9uJ3Qgc3VwcG9ydCB1cHNlcnRzIGJlY2F1c2UgdGhleSBkb24ndCBmaXQgbmljZWx5IGludG8gYWxsb3cvZGVueVxuICAvLyBydWxlcy5cbiAgaWYgKG9wdGlvbnMudXBzZXJ0KVxuICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIkFjY2VzcyBkZW5pZWQuIFVwc2VydHMgbm90IFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiYWxsb3dlZCBpbiBhIHJlc3RyaWN0ZWQgY29sbGVjdGlvbi5cIik7XG5cbiAgY29uc3Qgbm9SZXBsYWNlRXJyb3IgPSBcIkFjY2VzcyBkZW5pZWQuIEluIGEgcmVzdHJpY3RlZCBjb2xsZWN0aW9uIHlvdSBjYW4gb25seVwiICtcbiAgICAgICAgXCIgdXBkYXRlIGRvY3VtZW50cywgbm90IHJlcGxhY2UgdGhlbS4gVXNlIGEgTW9uZ28gdXBkYXRlIG9wZXJhdG9yLCBzdWNoIFwiICtcbiAgICAgICAgXCJhcyAnJHNldCcuXCI7XG5cbiAgY29uc3QgbXV0YXRvcktleXMgPSBPYmplY3Qua2V5cyhtdXRhdG9yKTtcblxuICAvLyBjb21wdXRlIG1vZGlmaWVkIGZpZWxkc1xuICBjb25zdCBtb2RpZmllZEZpZWxkcyA9IHt9O1xuXG4gIGlmIChtdXRhdG9yS2V5cy5sZW5ndGggPT09IDApIHtcbiAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgbm9SZXBsYWNlRXJyb3IpO1xuICB9XG4gIG11dGF0b3JLZXlzLmZvckVhY2goKG9wKSA9PiB7XG4gICAgY29uc3QgcGFyYW1zID0gbXV0YXRvcltvcF07XG4gICAgaWYgKG9wLmNoYXJBdCgwKSAhPT0gJyQnKSB7XG4gICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgbm9SZXBsYWNlRXJyb3IpO1xuICAgIH0gZWxzZSBpZiAoIWhhc093bi5jYWxsKEFMTE9XRURfVVBEQVRFX09QRVJBVElPTlMsIG9wKSkge1xuICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcihcbiAgICAgICAgNDAzLCBcIkFjY2VzcyBkZW5pZWQuIE9wZXJhdG9yIFwiICsgb3AgKyBcIiBub3QgYWxsb3dlZCBpbiBhIHJlc3RyaWN0ZWQgY29sbGVjdGlvbi5cIik7XG4gICAgfSBlbHNlIHtcbiAgICAgIE9iamVjdC5rZXlzKHBhcmFtcykuZm9yRWFjaCgoZmllbGQpID0+IHtcbiAgICAgICAgLy8gdHJlYXQgZG90dGVkIGZpZWxkcyBhcyBpZiB0aGV5IGFyZSByZXBsYWNpbmcgdGhlaXJcbiAgICAgICAgLy8gdG9wLWxldmVsIHBhcnRcbiAgICAgICAgaWYgKGZpZWxkLmluZGV4T2YoJy4nKSAhPT0gLTEpXG4gICAgICAgICAgZmllbGQgPSBmaWVsZC5zdWJzdHJpbmcoMCwgZmllbGQuaW5kZXhPZignLicpKTtcblxuICAgICAgICAvLyByZWNvcmQgdGhlIGZpZWxkIHdlIGFyZSB0cnlpbmcgdG8gY2hhbmdlXG4gICAgICAgIG1vZGlmaWVkRmllbGRzW2ZpZWxkXSA9IHRydWU7XG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIGNvbnN0IGZpZWxkcyA9IE9iamVjdC5rZXlzKG1vZGlmaWVkRmllbGRzKTtcblxuICBjb25zdCBmaW5kT3B0aW9ucyA9IHt0cmFuc2Zvcm06IG51bGx9O1xuICBpZiAoIXNlbGYuX3ZhbGlkYXRvcnMuZmV0Y2hBbGxGaWVsZHMpIHtcbiAgICBmaW5kT3B0aW9ucy5maWVsZHMgPSB7fTtcbiAgICBzZWxmLl92YWxpZGF0b3JzLmZldGNoLmZvckVhY2goKGZpZWxkTmFtZSkgPT4ge1xuICAgICAgZmluZE9wdGlvbnMuZmllbGRzW2ZpZWxkTmFtZV0gPSAxO1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgZG9jID0gc2VsZi5fY29sbGVjdGlvbi5maW5kT25lKHNlbGVjdG9yLCBmaW5kT3B0aW9ucyk7XG4gIGlmICghZG9jKSAgLy8gbm9uZSBzYXRpc2ZpZWQhXG4gICAgcmV0dXJuIDA7XG5cbiAgLy8gY2FsbCB1c2VyIHZhbGlkYXRvcnMuXG4gIC8vIEFueSBkZW55IHJldHVybnMgdHJ1ZSBtZWFucyBkZW5pZWQuXG4gIGlmIChzZWxmLl92YWxpZGF0b3JzLnVwZGF0ZS5kZW55LnNvbWUoKHZhbGlkYXRvcikgPT4ge1xuICAgIGNvbnN0IGZhY3RvcmllZERvYyA9IHRyYW5zZm9ybURvYyh2YWxpZGF0b3IsIGRvYyk7XG4gICAgcmV0dXJuIHZhbGlkYXRvcih1c2VySWQsXG4gICAgICAgICAgICAgICAgICAgICBmYWN0b3JpZWREb2MsXG4gICAgICAgICAgICAgICAgICAgICBmaWVsZHMsXG4gICAgICAgICAgICAgICAgICAgICBtdXRhdG9yKTtcbiAgfSkpIHtcbiAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJBY2Nlc3MgZGVuaWVkXCIpO1xuICB9XG4gIC8vIEFueSBhbGxvdyByZXR1cm5zIHRydWUgbWVhbnMgcHJvY2VlZC4gVGhyb3cgZXJyb3IgaWYgdGhleSBhbGwgZmFpbC5cbiAgaWYgKHNlbGYuX3ZhbGlkYXRvcnMudXBkYXRlLmFsbG93LmV2ZXJ5KCh2YWxpZGF0b3IpID0+IHtcbiAgICBjb25zdCBmYWN0b3JpZWREb2MgPSB0cmFuc2Zvcm1Eb2ModmFsaWRhdG9yLCBkb2MpO1xuICAgIHJldHVybiAhdmFsaWRhdG9yKHVzZXJJZCxcbiAgICAgICAgICAgICAgICAgICAgICBmYWN0b3JpZWREb2MsXG4gICAgICAgICAgICAgICAgICAgICAgZmllbGRzLFxuICAgICAgICAgICAgICAgICAgICAgIG11dGF0b3IpO1xuICB9KSkge1xuICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIkFjY2VzcyBkZW5pZWRcIik7XG4gIH1cblxuICBvcHRpb25zLl9mb3JiaWRSZXBsYWNlID0gdHJ1ZTtcblxuICAvLyBCYWNrIHdoZW4gd2Ugc3VwcG9ydGVkIGFyYml0cmFyeSBjbGllbnQtcHJvdmlkZWQgc2VsZWN0b3JzLCB3ZSBhY3R1YWxseVxuICAvLyByZXdyb3RlIHRoZSBzZWxlY3RvciB0byBpbmNsdWRlIGFuIF9pZCBjbGF1c2UgYmVmb3JlIHBhc3NpbmcgdG8gTW9uZ28gdG9cbiAgLy8gYXZvaWQgcmFjZXMsIGJ1dCBzaW5jZSBzZWxlY3RvciBpcyBndWFyYW50ZWVkIHRvIGFscmVhZHkganVzdCBiZSBhbiBJRCwgd2VcbiAgLy8gZG9uJ3QgaGF2ZSB0byBhbnkgbW9yZS5cblxuICByZXR1cm4gc2VsZi5fY29sbGVjdGlvbi51cGRhdGUuY2FsbChcbiAgICBzZWxmLl9jb2xsZWN0aW9uLCBzZWxlY3RvciwgbXV0YXRvciwgb3B0aW9ucyk7XG59O1xuXG4vLyBPbmx5IGFsbG93IHRoZXNlIG9wZXJhdGlvbnMgaW4gdmFsaWRhdGVkIHVwZGF0ZXMuIFNwZWNpZmljYWxseVxuLy8gd2hpdGVsaXN0IG9wZXJhdGlvbnMsIHJhdGhlciB0aGFuIGJsYWNrbGlzdCwgc28gbmV3IGNvbXBsZXhcbi8vIG9wZXJhdGlvbnMgdGhhdCBhcmUgYWRkZWQgYXJlbid0IGF1dG9tYXRpY2FsbHkgYWxsb3dlZC4gQSBjb21wbGV4XG4vLyBvcGVyYXRpb24gaXMgb25lIHRoYXQgZG9lcyBtb3JlIHRoYW4ganVzdCBtb2RpZnkgaXRzIHRhcmdldFxuLy8gZmllbGQuIEZvciBub3cgdGhpcyBjb250YWlucyBhbGwgdXBkYXRlIG9wZXJhdGlvbnMgZXhjZXB0ICckcmVuYW1lJy5cbi8vIGh0dHA6Ly9kb2NzLm1vbmdvZGIub3JnL21hbnVhbC9yZWZlcmVuY2Uvb3BlcmF0b3JzLyN1cGRhdGVcbmNvbnN0IEFMTE9XRURfVVBEQVRFX09QRVJBVElPTlMgPSB7XG4gICRpbmM6MSwgJHNldDoxLCAkdW5zZXQ6MSwgJGFkZFRvU2V0OjEsICRwb3A6MSwgJHB1bGxBbGw6MSwgJHB1bGw6MSxcbiAgJHB1c2hBbGw6MSwgJHB1c2g6MSwgJGJpdDoxXG59O1xuXG4vLyBTaW11bGF0ZSBhIG1vbmdvIGByZW1vdmVgIG9wZXJhdGlvbiB3aGlsZSB2YWxpZGF0aW5nIGFjY2VzcyBjb250cm9sXG4vLyBydWxlcy4gU2VlICNWYWxpZGF0ZWRDaGFuZ2VcbkNvbGxlY3Rpb25Qcm90b3R5cGUuX3ZhbGlkYXRlZFJlbW92ZUFzeW5jID0gYXN5bmMgZnVuY3Rpb24odXNlcklkLCBzZWxlY3Rvcikge1xuICBjb25zdCBzZWxmID0gdGhpcztcblxuICBjb25zdCBmaW5kT3B0aW9ucyA9IHt0cmFuc2Zvcm06IG51bGx9O1xuICBpZiAoIXNlbGYuX3ZhbGlkYXRvcnMuZmV0Y2hBbGxGaWVsZHMpIHtcbiAgICBmaW5kT3B0aW9ucy5maWVsZHMgPSB7fTtcbiAgICBzZWxmLl92YWxpZGF0b3JzLmZldGNoLmZvckVhY2goKGZpZWxkTmFtZSkgPT4ge1xuICAgICAgZmluZE9wdGlvbnMuZmllbGRzW2ZpZWxkTmFtZV0gPSAxO1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgZG9jID0gYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5maW5kT25lQXN5bmMoc2VsZWN0b3IsIGZpbmRPcHRpb25zKTtcbiAgaWYgKCFkb2MpXG4gICAgcmV0dXJuIDA7XG5cbiAgLy8gY2FsbCB1c2VyIHZhbGlkYXRvcnMuXG4gIC8vIEFueSBkZW55IHJldHVybnMgdHJ1ZSBtZWFucyBkZW5pZWQuXG4gIGlmIChhd2FpdCBhc3luY1NvbWUoc2VsZi5fdmFsaWRhdG9ycy5yZW1vdmVBc3luYy5kZW55LCBhc3luYyAodmFsaWRhdG9yKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gdmFsaWRhdG9yKHVzZXJJZCwgdHJhbnNmb3JtRG9jKHZhbGlkYXRvciwgZG9jKSk7XG4gICAgcmV0dXJuIE1ldGVvci5faXNQcm9taXNlKHJlc3VsdCkgPyBhd2FpdCByZXN1bHQgOiByZXN1bHQ7XG4gIH0pKSB7XG4gICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDMsIFwiQWNjZXNzIGRlbmllZFwiKTtcbiAgfVxuICAvLyBBbnkgYWxsb3cgcmV0dXJucyB0cnVlIG1lYW5zIHByb2NlZWQuIFRocm93IGVycm9yIGlmIHRoZXkgYWxsIGZhaWwuXG4gIGlmIChhd2FpdCBhc3luY0V2ZXJ5KHNlbGYuX3ZhbGlkYXRvcnMucmVtb3ZlQXN5bmMuYWxsb3csIGFzeW5jICh2YWxpZGF0b3IpID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSB2YWxpZGF0b3IodXNlcklkLCB0cmFuc2Zvcm1Eb2ModmFsaWRhdG9yLCBkb2MpKTtcbiAgICByZXR1cm4gIShNZXRlb3IuX2lzUHJvbWlzZShyZXN1bHQpID8gYXdhaXQgcmVzdWx0IDogcmVzdWx0KTtcbiAgfSkpIHtcbiAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJBY2Nlc3MgZGVuaWVkXCIpO1xuICB9XG5cbiAgLy8gQmFjayB3aGVuIHdlIHN1cHBvcnRlZCBhcmJpdHJhcnkgY2xpZW50LXByb3ZpZGVkIHNlbGVjdG9ycywgd2UgYWN0dWFsbHlcbiAgLy8gcmV3cm90ZSB0aGUgc2VsZWN0b3IgdG8ge19pZDogeyRpbjogW2lkcyB0aGF0IHdlIGZvdW5kXX19IGJlZm9yZSBwYXNzaW5nIHRvXG4gIC8vIE1vbmdvIHRvIGF2b2lkIHJhY2VzLCBidXQgc2luY2Ugc2VsZWN0b3IgaXMgZ3VhcmFudGVlZCB0byBhbHJlYWR5IGp1c3QgYmVcbiAgLy8gYW4gSUQsIHdlIGRvbid0IGhhdmUgdG8gYW55IG1vcmUuXG5cbiAgcmV0dXJuIHNlbGYuX2NvbGxlY3Rpb24ucmVtb3ZlQXN5bmMuY2FsbChzZWxmLl9jb2xsZWN0aW9uLCBzZWxlY3Rvcik7XG59O1xuXG5Db2xsZWN0aW9uUHJvdG90eXBlLl92YWxpZGF0ZWRSZW1vdmUgPSBmdW5jdGlvbih1c2VySWQsIHNlbGVjdG9yKSB7XG4gIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gIGNvbnN0IGZpbmRPcHRpb25zID0ge3RyYW5zZm9ybTogbnVsbH07XG4gIGlmICghc2VsZi5fdmFsaWRhdG9ycy5mZXRjaEFsbEZpZWxkcykge1xuICAgIGZpbmRPcHRpb25zLmZpZWxkcyA9IHt9O1xuICAgIHNlbGYuX3ZhbGlkYXRvcnMuZmV0Y2guZm9yRWFjaCgoZmllbGROYW1lKSA9PiB7XG4gICAgICBmaW5kT3B0aW9ucy5maWVsZHNbZmllbGROYW1lXSA9IDE7XG4gICAgfSk7XG4gIH1cblxuICBjb25zdCBkb2MgPSBzZWxmLl9jb2xsZWN0aW9uLmZpbmRPbmUoc2VsZWN0b3IsIGZpbmRPcHRpb25zKTtcbiAgaWYgKCFkb2MpXG4gICAgcmV0dXJuIDA7XG5cbiAgLy8gY2FsbCB1c2VyIHZhbGlkYXRvcnMuXG4gIC8vIEFueSBkZW55IHJldHVybnMgdHJ1ZSBtZWFucyBkZW5pZWQuXG4gIGlmIChzZWxmLl92YWxpZGF0b3JzLnJlbW92ZS5kZW55LnNvbWUoKHZhbGlkYXRvcikgPT4ge1xuICAgIHJldHVybiB2YWxpZGF0b3IodXNlcklkLCB0cmFuc2Zvcm1Eb2ModmFsaWRhdG9yLCBkb2MpKTtcbiAgfSkpIHtcbiAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJBY2Nlc3MgZGVuaWVkXCIpO1xuICB9XG4gIC8vIEFueSBhbGxvdyByZXR1cm5zIHRydWUgbWVhbnMgcHJvY2VlZC4gVGhyb3cgZXJyb3IgaWYgdGhleSBhbGwgZmFpbC5cbiAgaWYgKHNlbGYuX3ZhbGlkYXRvcnMucmVtb3ZlLmFsbG93LmV2ZXJ5KCh2YWxpZGF0b3IpID0+IHtcbiAgICByZXR1cm4gIXZhbGlkYXRvcih1c2VySWQsIHRyYW5zZm9ybURvYyh2YWxpZGF0b3IsIGRvYykpO1xuICB9KSkge1xuICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIkFjY2VzcyBkZW5pZWRcIik7XG4gIH1cblxuICAvLyBCYWNrIHdoZW4gd2Ugc3VwcG9ydGVkIGFyYml0cmFyeSBjbGllbnQtcHJvdmlkZWQgc2VsZWN0b3JzLCB3ZSBhY3R1YWxseVxuICAvLyByZXdyb3RlIHRoZSBzZWxlY3RvciB0byB7X2lkOiB7JGluOiBbaWRzIHRoYXQgd2UgZm91bmRdfX0gYmVmb3JlIHBhc3NpbmcgdG9cbiAgLy8gTW9uZ28gdG8gYXZvaWQgcmFjZXMsIGJ1dCBzaW5jZSBzZWxlY3RvciBpcyBndWFyYW50ZWVkIHRvIGFscmVhZHkganVzdCBiZVxuICAvLyBhbiBJRCwgd2UgZG9uJ3QgaGF2ZSB0byBhbnkgbW9yZS5cblxuICByZXR1cm4gc2VsZi5fY29sbGVjdGlvbi5yZW1vdmUuY2FsbChzZWxmLl9jb2xsZWN0aW9uLCBzZWxlY3Rvcik7XG59O1xuXG5Db2xsZWN0aW9uUHJvdG90eXBlLl9jYWxsTXV0YXRvck1ldGhvZEFzeW5jID0gZnVuY3Rpb24gX2NhbGxNdXRhdG9yTWV0aG9kQXN5bmMobmFtZSwgYXJncywgb3B0aW9ucyA9IHt9KSB7XG5cbiAgLy8gRm9yIHR3byBvdXQgb2YgdGhyZWUgbXV0YXRvciBtZXRob2RzLCB0aGUgZmlyc3QgYXJndW1lbnQgaXMgYSBzZWxlY3RvclxuICBjb25zdCBmaXJzdEFyZ0lzU2VsZWN0b3IgPSBuYW1lID09PSBcInVwZGF0ZUFzeW5jXCIgfHwgbmFtZSA9PT0gXCJyZW1vdmVBc3luY1wiO1xuICBpZiAoZmlyc3RBcmdJc1NlbGVjdG9yICYmICFhbHJlYWR5SW5TaW11bGF0aW9uKCkpIHtcbiAgICAvLyBJZiB3ZSdyZSBhYm91dCB0byBhY3R1YWxseSBzZW5kIGFuIFJQQywgd2Ugc2hvdWxkIHRocm93IGFuIGVycm9yIGlmXG4gICAgLy8gdGhpcyBpcyBhIG5vbi1JRCBzZWxlY3RvciwgYmVjYXVzZSB0aGUgbXV0YXRpb24gbWV0aG9kcyBvbmx5IGFsbG93XG4gICAgLy8gc2luZ2xlLUlEIHNlbGVjdG9ycy4gKElmIHdlIGRvbid0IHRocm93IGhlcmUsIHdlJ2xsIHNlZSBmbGlja2VyLilcbiAgICB0aHJvd0lmU2VsZWN0b3JJc05vdElkKGFyZ3NbMF0sIG5hbWUpO1xuICB9XG5cbiAgY29uc3QgbXV0YXRvck1ldGhvZE5hbWUgPSB0aGlzLl9wcmVmaXggKyBuYW1lO1xuICByZXR1cm4gdGhpcy5fY29ubmVjdGlvbi5hcHBseUFzeW5jKG11dGF0b3JNZXRob2ROYW1lLCBhcmdzLCB7XG4gICAgcmV0dXJuU3R1YlZhbHVlOiB0aGlzLnJlc29sdmVyVHlwZSA9PT0gJ3N0dWInIHx8IHRoaXMucmVzb2x2ZXJUeXBlID09IG51bGwsXG4gICAgLy8gU3R1YlN0cmVhbSBpcyBvbmx5IHVzZWQgZm9yIHRlc3Rpbmcgd2hlcmUgeW91IGRvbid0IGNhcmUgYWJvdXQgdGhlIHNlcnZlclxuICAgIHJldHVyblNlcnZlclJlc3VsdFByb21pc2U6ICF0aGlzLl9jb25uZWN0aW9uLl9zdHJlYW0uX2lzU3R1YiAmJiB0aGlzLnJlc29sdmVyVHlwZSAhPT0gJ3N0dWInLFxuICAgIC4uLm9wdGlvbnMsXG4gIH0pO1xufVxuXG5Db2xsZWN0aW9uUHJvdG90eXBlLl9jYWxsTXV0YXRvck1ldGhvZCA9IGZ1bmN0aW9uIF9jYWxsTXV0YXRvck1ldGhvZChuYW1lLCBhcmdzLCBjYWxsYmFjaykge1xuICBpZiAoTWV0ZW9yLmlzQ2xpZW50ICYmICFjYWxsYmFjayAmJiAhYWxyZWFkeUluU2ltdWxhdGlvbigpKSB7XG4gICAgLy8gQ2xpZW50IGNhbid0IGJsb2NrLCBzbyBpdCBjYW4ndCByZXBvcnQgZXJyb3JzIGJ5IGV4Y2VwdGlvbixcbiAgICAvLyBvbmx5IGJ5IGNhbGxiYWNrLiBJZiB0aGV5IGZvcmdldCB0aGUgY2FsbGJhY2ssIGdpdmUgdGhlbSBhXG4gICAgLy8gZGVmYXVsdCBvbmUgdGhhdCBsb2dzIHRoZSBlcnJvciwgc28gdGhleSBhcmVuJ3QgdG90YWxseVxuICAgIC8vIGJhZmZsZWQgaWYgdGhlaXIgd3JpdGVzIGRvbid0IHdvcmsgYmVjYXVzZSB0aGVpciBkYXRhYmFzZSBpc1xuICAgIC8vIGRvd24uXG4gICAgLy8gRG9uJ3QgZ2l2ZSBhIGRlZmF1bHQgY2FsbGJhY2sgaW4gc2ltdWxhdGlvbiwgYmVjYXVzZSBpbnNpZGUgc3R1YnMgd2VcbiAgICAvLyB3YW50IHRvIHJldHVybiB0aGUgcmVzdWx0cyBmcm9tIHRoZSBsb2NhbCBjb2xsZWN0aW9uIGltbWVkaWF0ZWx5IGFuZFxuICAgIC8vIG5vdCBmb3JjZSBhIGNhbGxiYWNrLlxuICAgIGNhbGxiYWNrID0gZnVuY3Rpb24gKGVycikge1xuICAgICAgaWYgKGVycilcbiAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhuYW1lICsgXCIgZmFpbGVkXCIsIGVycik7XG4gICAgfTtcbiAgfVxuXG4gIC8vIEZvciB0d28gb3V0IG9mIHRocmVlIG11dGF0b3IgbWV0aG9kcywgdGhlIGZpcnN0IGFyZ3VtZW50IGlzIGEgc2VsZWN0b3JcbiAgY29uc3QgZmlyc3RBcmdJc1NlbGVjdG9yID0gbmFtZSA9PT0gXCJ1cGRhdGVcIiB8fCBuYW1lID09PSBcInJlbW92ZVwiO1xuICBpZiAoZmlyc3RBcmdJc1NlbGVjdG9yICYmICFhbHJlYWR5SW5TaW11bGF0aW9uKCkpIHtcbiAgICAvLyBJZiB3ZSdyZSBhYm91dCB0byBhY3R1YWxseSBzZW5kIGFuIFJQQywgd2Ugc2hvdWxkIHRocm93IGFuIGVycm9yIGlmXG4gICAgLy8gdGhpcyBpcyBhIG5vbi1JRCBzZWxlY3RvciwgYmVjYXVzZSB0aGUgbXV0YXRpb24gbWV0aG9kcyBvbmx5IGFsbG93XG4gICAgLy8gc2luZ2xlLUlEIHNlbGVjdG9ycy4gKElmIHdlIGRvbid0IHRocm93IGhlcmUsIHdlJ2xsIHNlZSBmbGlja2VyLilcbiAgICB0aHJvd0lmU2VsZWN0b3JJc05vdElkKGFyZ3NbMF0sIG5hbWUpO1xuICB9XG5cbiAgY29uc3QgbXV0YXRvck1ldGhvZE5hbWUgPSB0aGlzLl9wcmVmaXggKyBuYW1lO1xuICByZXR1cm4gdGhpcy5fY29ubmVjdGlvbi5hcHBseShcbiAgICBtdXRhdG9yTWV0aG9kTmFtZSwgYXJncywgeyByZXR1cm5TdHViVmFsdWU6IHRydWUgfSwgY2FsbGJhY2spO1xufVxuXG5mdW5jdGlvbiB0cmFuc2Zvcm1Eb2ModmFsaWRhdG9yLCBkb2MpIHtcbiAgaWYgKHZhbGlkYXRvci50cmFuc2Zvcm0pXG4gICAgcmV0dXJuIHZhbGlkYXRvci50cmFuc2Zvcm0oZG9jKTtcbiAgcmV0dXJuIGRvYztcbn1cblxuZnVuY3Rpb24gZG9jVG9WYWxpZGF0ZSh2YWxpZGF0b3IsIGRvYywgZ2VuZXJhdGVkSWQpIHtcbiAgbGV0IHJldCA9IGRvYztcbiAgaWYgKHZhbGlkYXRvci50cmFuc2Zvcm0pIHtcbiAgICByZXQgPSBFSlNPTi5jbG9uZShkb2MpO1xuICAgIC8vIElmIHlvdSBzZXQgYSBzZXJ2ZXItc2lkZSB0cmFuc2Zvcm0gb24geW91ciBjb2xsZWN0aW9uLCB0aGVuIHlvdSBkb24ndCBnZXRcbiAgICAvLyB0byB0ZWxsIHRoZSBkaWZmZXJlbmNlIGJldHdlZW4gXCJjbGllbnQgc3BlY2lmaWVkIHRoZSBJRFwiIGFuZCBcInNlcnZlclxuICAgIC8vIGdlbmVyYXRlZCB0aGUgSURcIiwgYmVjYXVzZSB0cmFuc2Zvcm1zIGV4cGVjdCB0byBnZXQgX2lkLiAgSWYgeW91IHdhbnQgdG9cbiAgICAvLyBkbyB0aGF0IGNoZWNrLCB5b3UgY2FuIGRvIGl0IHdpdGggYSBzcGVjaWZpY1xuICAgIC8vIGBDLmFsbG93KHtpbnNlcnRBc3luYzogZiwgdHJhbnNmb3JtOiBudWxsfSlgIHZhbGlkYXRvci5cbiAgICBpZiAoZ2VuZXJhdGVkSWQgIT09IG51bGwpIHtcbiAgICAgIHJldC5faWQgPSBnZW5lcmF0ZWRJZDtcbiAgICB9XG4gICAgcmV0ID0gdmFsaWRhdG9yLnRyYW5zZm9ybShyZXQpO1xuICB9XG4gIHJldHVybiByZXQ7XG59XG5cbmZ1bmN0aW9uIGFkZFZhbGlkYXRvcihjb2xsZWN0aW9uLCBhbGxvd09yRGVueSwgb3B0aW9ucykge1xuICAvLyB2YWxpZGF0ZSBrZXlzXG4gIGNvbnN0IHZhbGlkS2V5c1JlZ0V4ID0gL14oPzppbnNlcnRBc3luY3x1cGRhdGVBc3luY3xyZW1vdmVBc3luY3xpbnNlcnR8dXBkYXRlfHJlbW92ZXxmZXRjaHx0cmFuc2Zvcm0pJC87XG4gIE9iamVjdC5rZXlzKG9wdGlvbnMpLmZvckVhY2goKGtleSkgPT4ge1xuICAgIGlmICghdmFsaWRLZXlzUmVnRXgudGVzdChrZXkpKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKGFsbG93T3JEZW55ICsgXCI6IEludmFsaWQga2V5OiBcIiArIGtleSk7XG4gIH0pO1xuXG4gIGNvbGxlY3Rpb24uX3Jlc3RyaWN0ZWQgPSB0cnVlO1xuXG4gIFtcbiAgICAnaW5zZXJ0QXN5bmMnLFxuICAgICd1cGRhdGVBc3luYycsXG4gICAgJ3JlbW92ZUFzeW5jJyxcbiAgICAnaW5zZXJ0JyxcbiAgICAndXBkYXRlJyxcbiAgICAncmVtb3ZlJyxcbiAgXS5mb3JFYWNoKG5hbWUgPT4ge1xuICAgIGlmIChoYXNPd24uY2FsbChvcHRpb25zLCBuYW1lKSkge1xuICAgICAgaWYgKCEob3B0aW9uc1tuYW1lXSBpbnN0YW5jZW9mIEZ1bmN0aW9uKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYWxsb3dPckRlbnkgKyAnOiBWYWx1ZSBmb3IgYCcgKyBuYW1lICsgJ2AgbXVzdCBiZSBhIGZ1bmN0aW9uJ1xuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiB0aGUgdHJhbnNmb3JtIGlzIHNwZWNpZmllZCBhdCBhbGwgKGluY2x1ZGluZyBhcyAnbnVsbCcpIGluIHRoaXNcbiAgICAgIC8vIGNhbGwsIHRoZW4gdGFrZSB0aGF0OyBvdGhlcndpc2UsIHRha2UgdGhlIHRyYW5zZm9ybSBmcm9tIHRoZVxuICAgICAgLy8gY29sbGVjdGlvbi5cbiAgICAgIGlmIChvcHRpb25zLnRyYW5zZm9ybSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIG9wdGlvbnNbbmFtZV0udHJhbnNmb3JtID0gY29sbGVjdGlvbi5fdHJhbnNmb3JtOyAvLyBhbHJlYWR5IHdyYXBwZWRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wdGlvbnNbbmFtZV0udHJhbnNmb3JtID0gTG9jYWxDb2xsZWN0aW9uLndyYXBUcmFuc2Zvcm0oXG4gICAgICAgICAgb3B0aW9ucy50cmFuc2Zvcm1cbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGNvbGxlY3Rpb24uX3ZhbGlkYXRvcnNbbmFtZV1bYWxsb3dPckRlbnldLnB1c2gob3B0aW9uc1tuYW1lXSk7XG4gICAgfVxuICB9KTtcblxuICAvLyBPbmx5IHVwZGF0ZUFzeW5jIHRoZSBmZXRjaCBmaWVsZHMgaWYgd2UncmUgcGFzc2VkIHRoaW5ncyB0aGF0IGFmZmVjdFxuICAvLyBmZXRjaGluZy4gVGhpcyB3YXkgYWxsb3coe30pIGFuZCBhbGxvdyh7aW5zZXJ0QXN5bmM6IGZ9KSBkb24ndCByZXN1bHQgaW5cbiAgLy8gc2V0dGluZyBmZXRjaEFsbEZpZWxkc1xuICBpZiAob3B0aW9ucy51cGRhdGVBc3luYyB8fCBvcHRpb25zLnJlbW92ZUFzeW5jIHx8IG9wdGlvbnMuZmV0Y2gpIHtcbiAgICBpZiAob3B0aW9ucy5mZXRjaCAmJiAhKG9wdGlvbnMuZmV0Y2ggaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihhbGxvd09yRGVueSArIFwiOiBWYWx1ZSBmb3IgYGZldGNoYCBtdXN0IGJlIGFuIGFycmF5XCIpO1xuICAgIH1cbiAgICBjb2xsZWN0aW9uLl91cGRhdGVGZXRjaChvcHRpb25zLmZldGNoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiB0aHJvd0lmU2VsZWN0b3JJc05vdElkKHNlbGVjdG9yLCBtZXRob2ROYW1lKSB7XG4gIGlmICghTG9jYWxDb2xsZWN0aW9uLl9zZWxlY3RvcklzSWRQZXJoYXBzQXNPYmplY3Qoc2VsZWN0b3IpKSB7XG4gICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcihcbiAgICAgIDQwMywgXCJOb3QgcGVybWl0dGVkLiBVbnRydXN0ZWQgY29kZSBtYXkgb25seSBcIiArIG1ldGhvZE5hbWUgK1xuICAgICAgICBcIiBkb2N1bWVudHMgYnkgSUQuXCIpO1xuICB9XG59O1xuXG4vLyBEZXRlcm1pbmUgaWYgd2UgYXJlIGluIGEgRERQIG1ldGhvZCBzaW11bGF0aW9uXG5mdW5jdGlvbiBhbHJlYWR5SW5TaW11bGF0aW9uKCkge1xuICB2YXIgQ3VycmVudEludm9jYXRpb24gPVxuICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24gfHxcbiAgICAvLyBGb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHksIGFzIGV4cGxhaW5lZCBpbiB0aGlzIGlzc3VlOlxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL2lzc3Vlcy84OTQ3XG4gICAgRERQLl9DdXJyZW50SW52b2NhdGlvbjtcblxuICBjb25zdCBlbmNsb3NpbmcgPSBDdXJyZW50SW52b2NhdGlvbi5nZXQoKTtcbiAgcmV0dXJuIGVuY2xvc2luZyAmJiBlbmNsb3NpbmcuaXNTaW11bGF0aW9uO1xufVxuIl19
