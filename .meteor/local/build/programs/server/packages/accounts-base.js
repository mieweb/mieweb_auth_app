Package["core-runtime"].queue("accounts-base",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var DDPRateLimiter = Package['ddp-rate-limiter'].DDPRateLimiter;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var Hook = Package['callback-hook'].Hook;
var URL = Package.url.URL;
var URLSearchParams = Package.url.URLSearchParams;
var DDP = Package['ddp-client'].DDP;
var DDPServer = Package['ddp-server'].DDPServer;
var MongoInternals = Package.mongo.MongoInternals;
var Mongo = Package.mongo.Mongo;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var Accounts, options, stampedLoginToken, handler, name, query, oldestValidDate, user;

var require = meteorInstall({"node_modules":{"meteor":{"accounts-base":{"server_main.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/accounts-base/server_main.js                                                                               //
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
    var _Meteor$settings$pack, _Meteor$settings$pack2;
    module1.export({
      AccountsServer: () => AccountsServer
    });
    let AccountsServer;
    module1.link("./accounts_server.js", {
      AccountsServer(v) {
        AccountsServer = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    /**
     * @namespace Accounts
     * @summary The namespace for all server-side accounts-related methods.
     */
    Accounts = new AccountsServer(Meteor.server, _objectSpread(_objectSpread({}, (_Meteor$settings$pack = Meteor.settings.packages) === null || _Meteor$settings$pack === void 0 ? void 0 : _Meteor$settings$pack.accounts), (_Meteor$settings$pack2 = Meteor.settings.packages) === null || _Meteor$settings$pack2 === void 0 ? void 0 : _Meteor$settings$pack2['accounts-base']));
    // TODO[FIBERS]: I need TLA
    Accounts.init().then();
    // Users table. Don't use the normal autopublish, since we want to hide
    // some fields. Code to autopublish this is in accounts_server.js.
    // XXX Allow users to configure this collection name.

    /**
     * @summary A [Mongo.Collection](#collections) containing user documents.
     * @locus Anywhere
     * @type {Mongo.Collection}
     * @importFromPackage meteor
     */
    Meteor.users = Accounts.users;
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

},"accounts_common.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/accounts-base/accounts_common.js                                                                           //
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
    module.export({
      AccountsCommon: () => AccountsCommon,
      EXPIRE_TOKENS_INTERVAL_MS: () => EXPIRE_TOKENS_INTERVAL_MS
    });
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    // config option keys
    const VALID_CONFIG_KEYS = ['sendVerificationEmail', 'forbidClientAccountCreation', 'restrictCreationByEmailDomain', 'loginExpiration', 'loginExpirationInDays', 'oauthSecretKey', 'passwordResetTokenExpirationInDays', 'passwordResetTokenExpiration', 'passwordEnrollTokenExpirationInDays', 'passwordEnrollTokenExpiration', 'ambiguousErrorMessages', 'bcryptRounds', 'defaultFieldSelector', 'collection', 'loginTokenExpirationHours', 'tokenSequenceLength', 'clientStorage', 'ddpUrl', 'connection'];

    /**
     * @summary Super-constructor for AccountsClient and AccountsServer.
     * @locus Anywhere
     * @class AccountsCommon
     * @instancename accountsClientOrServer
     * @param options {Object} an object with fields:
     * - connection {Object} Optional DDP connection to reuse.
     * - ddpUrl {String} Optional URL for creating a new DDP connection.
     * - collection {String|Mongo.Collection} The name of the Mongo.Collection
     *     or the Mongo.Collection object to hold the users.
     */
    class AccountsCommon {
      constructor(options) {
        // Validate config options keys
        for (const key of Object.keys(options)) {
          if (!VALID_CONFIG_KEYS.includes(key)) {
            console.error("Accounts.config: Invalid key: ".concat(key));
          }
        }

        // Currently this is read directly by packages like accounts-password
        // and accounts-ui-unstyled.
        this._options = options || {};

        // Note that setting this.connection = null causes this.users to be a
        // LocalCollection, which is not what we want.
        this.connection = undefined;
        this._initConnection(options || {});

        // There is an allow call in accounts_server.js that restricts writes to
        // this collection.
        this.users = this._initializeCollection(options || {});

        // Callback exceptions are printed with Meteor._debug and ignored.
        this._onLoginHook = new Hook({
          bindEnvironment: false,
          debugPrintExceptions: 'onLogin callback'
        });
        this._onLoginFailureHook = new Hook({
          bindEnvironment: false,
          debugPrintExceptions: 'onLoginFailure callback'
        });
        this._onLogoutHook = new Hook({
          bindEnvironment: false,
          debugPrintExceptions: 'onLogout callback'
        });

        // Expose for testing.
        this.DEFAULT_LOGIN_EXPIRATION_DAYS = DEFAULT_LOGIN_EXPIRATION_DAYS;
        this.LOGIN_UNEXPIRING_TOKEN_DAYS = LOGIN_UNEXPIRING_TOKEN_DAYS;

        // Thrown when the user cancels the login process (eg, closes an oauth
        // popup, declines retina scan, etc)
        const lceName = 'Accounts.LoginCancelledError';
        this.LoginCancelledError = Meteor.makeErrorType(lceName, function (description) {
          this.message = description;
        });
        this.LoginCancelledError.prototype.name = lceName;

        // This is used to transmit specific subclass errors over the wire. We
        // should come up with a more generic way to do this (eg, with some sort of
        // symbolic error code rather than a number).
        this.LoginCancelledError.numericError = 0x8acdc2f;
      }
      _initializeCollection(options) {
        if (options.collection && typeof options.collection !== 'string' && !(options.collection instanceof Mongo.Collection)) {
          throw new Meteor.Error('Collection parameter can be only of type string or "Mongo.Collection"');
        }
        let collectionName = 'users';
        if (typeof options.collection === 'string') {
          collectionName = options.collection;
        }
        let collection;
        if (options.collection instanceof Mongo.Collection) {
          collection = options.collection;
        } else {
          collection = new Mongo.Collection(collectionName, {
            _preventAutopublish: true,
            connection: this.connection
          });
        }
        return collection;
      }

      /**
       * @summary Get the current user id, or `null` if no user is logged in. A reactive data source.
       * @locus Anywhere
       */
      userId() {
        throw new Error('userId method not implemented');
      }

      // merge the defaultFieldSelector with an existing options object
      _addDefaultFieldSelector() {
        let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        // this will be the most common case for most people, so make it quick
        if (!this._options.defaultFieldSelector) return options;

        // if no field selector then just use defaultFieldSelector
        if (!options.fields) return _objectSpread(_objectSpread({}, options), {}, {
          fields: this._options.defaultFieldSelector
        });

        // if empty field selector then the full user object is explicitly requested, so obey
        const keys = Object.keys(options.fields);
        if (!keys.length) return options;

        // if the requested fields are +ve then ignore defaultFieldSelector
        // assume they are all either +ve or -ve because Mongo doesn't like mixed
        if (!!options.fields[keys[0]]) return options;

        // The requested fields are -ve.
        // If the defaultFieldSelector is +ve then use requested fields, otherwise merge them
        const keys2 = Object.keys(this._options.defaultFieldSelector);
        return this._options.defaultFieldSelector[keys2[0]] ? options : _objectSpread(_objectSpread({}, options), {}, {
          fields: _objectSpread(_objectSpread({}, options.fields), this._options.defaultFieldSelector)
        });
      }

      /**
       * @summary Get the current user record, or `null` if no user is logged in. A reactive data source. In the server this fuction returns a promise.
       * @locus Anywhere
       * @param {Object} [options]
       * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
       */
      user(options) {
        if (Meteor.isServer) {
          console.warn(["`Meteor.user()` is deprecated on the server side.", "    To fetch the current user record on the server,", "    use `Meteor.userAsync()` instead."].join("\n"));
        }
        const self = this;
        const userId = self.userId();
        const findOne = function () {
          return Meteor.isClient ? self.users.findOne(...arguments) : self.users.findOneAsync(...arguments);
        };
        return userId ? findOne(userId, this._addDefaultFieldSelector(options)) : null;
      }

      /**
       * @summary Get the current user record, or `null` if no user is logged in.
       * @locus Anywhere
       * @param {Object} [options]
       * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
       */
      async userAsync(options) {
        const userId = this.userId();
        return userId ? this.users.findOneAsync(userId, this._addDefaultFieldSelector(options)) : null;
      }
      // Set up config for the accounts system. Call this on both the client
      // and the server.
      //
      // Note that this method gets overridden on AccountsServer.prototype, but
      // the overriding method calls the overridden method.
      //
      // XXX we should add some enforcement that this is called on both the
      // client and the server. Otherwise, a user can
      // 'forbidClientAccountCreation' only on the client and while it looks
      // like their app is secure, the server will still accept createUser
      // calls. https://github.com/meteor/meteor/issues/828
      //
      // @param options {Object} an object with fields:
      // - sendVerificationEmail {Boolean}
      //     Send email address verification emails to new users created from
      //     client signups.
      // - forbidClientAccountCreation {Boolean}
      //     Do not allow clients to create accounts directly.
      // - restrictCreationByEmailDomain {Function or String}
      //     Require created users to have an email matching the function or
      //     having the string as domain.
      // - loginExpirationInDays {Number}
      //     Number of days since login until a user is logged out (login token
      //     expires).
      // - collection {String|Mongo.Collection}
      //     A collection name or a Mongo.Collection object to hold the users.
      // - passwordResetTokenExpirationInDays {Number}
      //     Number of days since password reset token creation until the
      //     token can't be used any longer (password reset token expires).
      // - ambiguousErrorMessages {Boolean}
      //     Return ambiguous error messages from login failures to prevent
      //     user enumeration.
      // - bcryptRounds {Number}
      //     Allows override of number of bcrypt rounds (aka work factor) used
      //     to store passwords.

      /**
       * @summary Set global accounts options. You can also set these in `Meteor.settings.packages.accounts` without the need to call this function.
       * @locus Anywhere
       * @param {Object} options
       * @param {Boolean} options.sendVerificationEmail New users with an email address will receive an address verification email.
       * @param {Boolean} options.forbidClientAccountCreation Calls to [`createUser`](#accounts_createuser) from the client will be rejected. In addition, if you are using [accounts-ui](#accountsui), the "Create account" link will not be available.
       * @param {String | Function} options.restrictCreationByEmailDomain If set to a string, only allows new users if the domain part of their email address matches the string. If set to a function, only allows new users if the function returns true.  The function is passed the full email address of the proposed new user.  Works with password-based sign-in and external services that expose email addresses (Google, Facebook, GitHub). All existing users still can log in after enabling this option. Example: `Accounts.config({ restrictCreationByEmailDomain: 'school.edu' })`.
       * @param {Number} options.loginExpiration The number of milliseconds from when a user logs in until their token expires and they are logged out, for a more granular control. If `loginExpirationInDays` is set, it takes precedent.
       * @param {Number} options.loginExpirationInDays The number of days from when a user logs in until their token expires and they are logged out. Defaults to 90. Set to `null` to disable login expiration.
       * @param {String} options.oauthSecretKey When using the `oauth-encryption` package, the 16 byte key using to encrypt sensitive account credentials in the database, encoded in base64.  This option may only be specified on the server.  See packages/oauth-encryption/README.md for details.
       * @param {Number} options.passwordResetTokenExpirationInDays The number of days from when a link to reset password is sent until token expires and user can't reset password with the link anymore. Defaults to 3.
       * @param {Number} options.passwordResetTokenExpiration The number of milliseconds from when a link to reset password is sent until token expires and user can't reset password with the link anymore. If `passwordResetTokenExpirationInDays` is set, it takes precedent.
       * @param {Number} options.passwordEnrollTokenExpirationInDays The number of days from when a link to set initial password is sent until token expires and user can't set password with the link anymore. Defaults to 30.
       * @param {Number} options.passwordEnrollTokenExpiration The number of milliseconds from when a link to set initial password is sent until token expires and user can't set password with the link anymore. If `passwordEnrollTokenExpirationInDays` is set, it takes precedent.
       * @param {Boolean} options.ambiguousErrorMessages Return ambiguous error messages from login failures to prevent user enumeration. Defaults to `false`, but in production environments it is recommended it defaults to `true`.
       * @param {Number} options.bcryptRounds Allows override of number of bcrypt rounds (aka work factor) used to store passwords. The default is 10.
       * @param {MongoFieldSpecifier} options.defaultFieldSelector To exclude by default large custom fields from `Meteor.user()` and `Meteor.findUserBy...()` functions when called without a field selector, and all `onLogin`, `onLoginFailure` and `onLogout` callbacks.  Example: `Accounts.config({ defaultFieldSelector: { myBigArray: 0 }})`. Beware when using this. If, for instance, you do not include `email` when excluding the fields, you can have problems with functions like `forgotPassword` that will break because they won't have the required data available. It's recommend that you always keep the fields `_id`, `username`, and `email`.
       * @param {String|Mongo.Collection} options.collection A collection name or a Mongo.Collection object to hold the users.
       * @param {Number} options.loginTokenExpirationHours When using the package `accounts-2fa`, use this to set the amount of time a token sent is valid. As it's just a number, you can use, for example, 0.5 to make the token valid for just half hour. The default is 1 hour.
       * @param {Number} options.tokenSequenceLength When using the package `accounts-2fa`, use this to the size of the token sequence generated. The default is 6.
       * @param {'session' | 'local'} options.clientStorage By default login credentials are stored in local storage, setting this to true will switch to using session storage.
       */
      config(options) {
        // We don't want users to accidentally only call Accounts.config on the
        // client, where some of the options will have partial effects (eg removing
        // the "create account" button from accounts-ui if forbidClientAccountCreation
        // is set, or redirecting Google login to a specific-domain page) without
        // having their full effects.
        if (Meteor.isServer) {
          __meteor_runtime_config__.accountsConfigCalled = true;
        } else if (!__meteor_runtime_config__.accountsConfigCalled) {
          // XXX would be nice to "crash" the client and replace the UI with an error
          // message, but there's no trivial way to do this.
          Meteor._debug('Accounts.config was called on the client but not on the ' + 'server; some configuration options may not take effect.');
        }

        // We need to validate the oauthSecretKey option at the time
        // Accounts.config is called. We also deliberately don't store the
        // oauthSecretKey in Accounts._options.
        if (Object.prototype.hasOwnProperty.call(options, 'oauthSecretKey')) {
          if (Meteor.isClient) {
            throw new Error('The oauthSecretKey option may only be specified on the server');
          }
          if (!Package['oauth-encryption']) {
            throw new Error('The oauth-encryption package must be loaded to set oauthSecretKey');
          }
          Package['oauth-encryption'].OAuthEncryption.loadKey(options.oauthSecretKey);
          options = _objectSpread({}, options);
          delete options.oauthSecretKey;
        }

        // Validate config options keys
        for (const key of Object.keys(options)) {
          if (!VALID_CONFIG_KEYS.includes(key)) {
            console.error("Accounts.config: Invalid key: ".concat(key));
          }
        }

        // set values in Accounts._options
        for (const key of VALID_CONFIG_KEYS) {
          if (key in options) {
            if (key in this._options) {
              if (key !== 'collection' && Meteor.isTest && key !== 'clientStorage') {
                throw new Meteor.Error("Can't set `".concat(key, "` more than once"));
              }
            }
            this._options[key] = options[key];
          }
        }
        if (options.collection && options.collection !== this.users._name && options.collection !== this.users) {
          this.users = this._initializeCollection(options);
        }
      }

      /**
       * @summary Register a callback to be called after a login attempt succeeds.
       * @locus Anywhere
       * @param {Function} func The callback to be called when login is successful.
       *                        The callback receives a single object that
       *                        holds login details. This object contains the login
       *                        result type (password, resume, etc.) on both the
       *                        client and server. `onLogin` callbacks registered
       *                        on the server also receive extra data, such
       *                        as user details, connection information, etc.
       */
      onLogin(func) {
        let ret = this._onLoginHook.register(func);
        // call the just registered callback if already logged in
        this._startupCallback(ret.callback);
        return ret;
      }

      /**
       * @summary Register a callback to be called after a login attempt fails.
       * @locus Anywhere
       * @param {Function} func The callback to be called after the login has failed.
       */
      onLoginFailure(func) {
        return this._onLoginFailureHook.register(func);
      }

      /**
       * @summary Register a callback to be called after a logout attempt succeeds.
       * @locus Anywhere
       * @param {Function} func The callback to be called when logout is successful.
       */
      onLogout(func) {
        return this._onLogoutHook.register(func);
      }
      _initConnection(options) {
        if (!Meteor.isClient) {
          return;
        }

        // The connection used by the Accounts system. This is the connection
        // that will get logged in by Meteor.login(), and this is the
        // connection whose login state will be reflected by Meteor.userId().
        //
        // It would be much preferable for this to be in accounts_client.js,
        // but it has to be here because it's needed to create the
        // Meteor.users collection.
        if (options.connection) {
          this.connection = options.connection;
        } else if (options.ddpUrl) {
          this.connection = DDP.connect(options.ddpUrl);
        } else if (typeof __meteor_runtime_config__ !== 'undefined' && __meteor_runtime_config__.ACCOUNTS_CONNECTION_URL) {
          // Temporary, internal hook to allow the server to point the client
          // to a different authentication server. This is for a very
          // particular use case that comes up when implementing a oauth
          // server. Unsupported and may go away at any point in time.
          //
          // We will eventually provide a general way to use account-base
          // against any DDP connection, not just one special one.
          this.connection = DDP.connect(__meteor_runtime_config__.ACCOUNTS_CONNECTION_URL);
        } else {
          this.connection = Meteor.connection;
        }
      }
      _getTokenLifetimeMs() {
        // When loginExpirationInDays is set to null, we'll use a really high
        // number of days (LOGIN_UNEXPIRABLE_TOKEN_DAYS) to simulate an
        // unexpiring token.
        const loginExpirationInDays = this._options.loginExpirationInDays === null ? LOGIN_UNEXPIRING_TOKEN_DAYS : this._options.loginExpirationInDays;
        return this._options.loginExpiration || (loginExpirationInDays || DEFAULT_LOGIN_EXPIRATION_DAYS) * 86400000;
      }
      _getPasswordResetTokenLifetimeMs() {
        return this._options.passwordResetTokenExpiration || (this._options.passwordResetTokenExpirationInDays || DEFAULT_PASSWORD_RESET_TOKEN_EXPIRATION_DAYS) * 86400000;
      }
      _getPasswordEnrollTokenLifetimeMs() {
        return this._options.passwordEnrollTokenExpiration || (this._options.passwordEnrollTokenExpirationInDays || DEFAULT_PASSWORD_ENROLL_TOKEN_EXPIRATION_DAYS) * 86400000;
      }
      _tokenExpiration(when) {
        // We pass when through the Date constructor for backwards compatibility;
        // `when` used to be a number.
        return new Date(new Date(when).getTime() + this._getTokenLifetimeMs());
      }
      _tokenExpiresSoon(when) {
        let minLifetimeMs = 0.1 * this._getTokenLifetimeMs();
        const minLifetimeCapMs = MIN_TOKEN_LIFETIME_CAP_SECS * 1000;
        if (minLifetimeMs > minLifetimeCapMs) {
          minLifetimeMs = minLifetimeCapMs;
        }
        return new Date() > new Date(when) - minLifetimeMs;
      }

      // No-op on the server, overridden on the client.
      _startupCallback(callback) {}
    }
    // Note that Accounts is defined separately in accounts_client.js and
    // accounts_server.js.

    /**
     * @summary Get the current user id, or `null` if no user is logged in. A reactive data source.
     * @locus Anywhere
     * @importFromPackage meteor
     */
    Meteor.userId = () => Accounts.userId();

    /**
     * @summary Get the current user record, or `null` if no user is logged in. A reactive data source.
     * @locus Anywhere
     * @importFromPackage meteor
     * @param {Object} [options]
     * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
     */
    Meteor.user = options => Accounts.user(options);

    /**
     * @summary Get the current user record, or `null` if no user is logged in. A reactive data source.
     * @locus Anywhere
     * @importFromPackage meteor
     * @param {Object} [options]
     * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
     */
    Meteor.userAsync = options => Accounts.userAsync(options);

    // how long (in days) until a login token expires
    const DEFAULT_LOGIN_EXPIRATION_DAYS = 90;
    // how long (in days) until reset password token expires
    const DEFAULT_PASSWORD_RESET_TOKEN_EXPIRATION_DAYS = 3;
    // how long (in days) until enrol password token expires
    const DEFAULT_PASSWORD_ENROLL_TOKEN_EXPIRATION_DAYS = 30;
    // Clients don't try to auto-login with a token that is going to expire within
    // .1 * DEFAULT_LOGIN_EXPIRATION_DAYS, capped at MIN_TOKEN_LIFETIME_CAP_SECS.
    // Tries to avoid abrupt disconnects from expiring tokens.
    const MIN_TOKEN_LIFETIME_CAP_SECS = 3600; // one hour
    // how often (in milliseconds) we check for expired tokens
    const EXPIRE_TOKENS_INTERVAL_MS = 600 * 1000;
    // 10 minutes
    // A large number of expiration days (approximately 100 years worth) that is
    // used when creating unexpiring tokens.
    const LOGIN_UNEXPIRING_TOKEN_DAYS = 365 * 100;
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

},"accounts_server.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/accounts-base/accounts_server.js                                                                           //
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
    let _objectSpread;
    module.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 1);
    let _asyncIterator;
    module.link("@babel/runtime/helpers/asyncIterator", {
      default(v) {
        _asyncIterator = v;
      }
    }, 2);
    var _Package$oauthEncryp;
    const _excluded = ["token"];
    module.export({
      AccountsServer: () => AccountsServer
    });
    let crypto;
    module.link("crypto", {
      default(v) {
        crypto = v;
      }
    }, 0);
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 1);
    let AccountsCommon, EXPIRE_TOKENS_INTERVAL_MS;
    module.link("./accounts_common.js", {
      AccountsCommon(v) {
        AccountsCommon = v;
      },
      EXPIRE_TOKENS_INTERVAL_MS(v) {
        EXPIRE_TOKENS_INTERVAL_MS = v;
      }
    }, 2);
    let URL;
    module.link("meteor/url", {
      URL(v) {
        URL = v;
      }
    }, 3);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const hasOwn = Object.prototype.hasOwnProperty;

    // XXX maybe this belongs in the check package
    const NonEmptyString = Match.Where(x => {
      check(x, String);
      return x.length > 0;
    });

    /**
     * @summary Constructor for the `Accounts` namespace on the server.
     * @locus Server
     * @class AccountsServer
     * @extends AccountsCommon
     * @instancename accountsServer
     * @param {Object} server A server object such as `Meteor.server`.
     */
    class AccountsServer extends AccountsCommon {
      // Note that this constructor is less likely to be instantiated multiple
      // times than the `AccountsClient` constructor, because a single server
      // can provide only one set of methods.
      constructor(server, _options) {
        var _this;
        super(_options || {});
        _this = this;
        ///
        /// CREATE USER HOOKS
        ///
        /**
         * @summary Customize login token creation.
         * @locus Server
         * @param {Function} func Called whenever a new token is created.
         * Return the sequence and the user object. Return true to keep sending the default email, or false to override the behavior.
         */
        this.onCreateLoginToken = function (func) {
          if (this._onCreateLoginTokenHook) {
            throw new Error('Can only call onCreateLoginToken once');
          }
          this._onCreateLoginTokenHook = func;
        };
        // Generates a MongoDB selector that can be used to perform a fast case
        // insensitive lookup for the given fieldName and string. Since MongoDB does
        // not support case insensitive indexes, and case insensitive regex queries
        // are slow, we construct a set of prefix selectors for all permutations of
        // the first 4 characters ourselves. We first attempt to matching against
        // these, and because 'prefix expression' regex queries do use indexes (see
        // http://docs.mongodb.org/v2.6/reference/operator/query/regex/#index-use),
        // this has been found to greatly improve performance (from 1200ms to 5ms in a
        // test with 1.000.000 users).
        this._selectorForFastCaseInsensitiveLookup = (fieldName, string) => {
          // Performance seems to improve up to 4 prefix characters
          const prefix = string.substring(0, Math.min(string.length, 4));
          const orClause = generateCasePermutationsForString(prefix).map(prefixPermutation => {
            const selector = {};
            selector[fieldName] = new RegExp("^".concat(Meteor._escapeRegExp(prefixPermutation)));
            return selector;
          });
          const caseInsensitiveClause = {};
          caseInsensitiveClause[fieldName] = new RegExp("^".concat(Meteor._escapeRegExp(string), "$"), 'i');
          return {
            $and: [{
              $or: orClause
            }, caseInsensitiveClause]
          };
        };
        this._findUserByQuery = async (query, options) => {
          let user = null;
          if (query.id) {
            // default field selector is added within getUserById()
            user = await Meteor.users.findOneAsync(query.id, this._addDefaultFieldSelector(options));
          } else {
            options = this._addDefaultFieldSelector(options);
            let fieldName;
            let fieldValue;
            if (query.username) {
              fieldName = 'username';
              fieldValue = query.username;
            } else if (query.email) {
              fieldName = 'emails.address';
              fieldValue = query.email;
            } else {
              throw new Error("shouldn't happen (validation missed something)");
            }
            let selector = {};
            selector[fieldName] = fieldValue;
            user = await Meteor.users.findOneAsync(selector, options);
            // If user is not found, try a case insensitive lookup
            if (!user) {
              selector = this._selectorForFastCaseInsensitiveLookup(fieldName, fieldValue);
              const candidateUsers = await Meteor.users.find(selector, _objectSpread(_objectSpread({}, options), {}, {
                limit: 2
              })).fetchAsync();
              // No match if multiple candidates are found
              if (candidateUsers.length === 1) {
                user = candidateUsers[0];
              }
            }
          }
          return user;
        };
        this._handleError = function (msg) {
          var _this$_options$ambigu;
          let throwError = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
          let errorCode = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 403;
          const isErrorAmbiguous = (_this$_options$ambigu = _this._options.ambiguousErrorMessages) !== null && _this$_options$ambigu !== void 0 ? _this$_options$ambigu : true;
          const error = new Meteor.Error(errorCode, isErrorAmbiguous ? 'Something went wrong. Please check your credentials.' : msg);
          if (throwError) {
            throw error;
          }
          return error;
        };
        this._userQueryValidator = Match.Where(user => {
          check(user, {
            id: Match.Optional(NonEmptyString),
            username: Match.Optional(NonEmptyString),
            email: Match.Optional(NonEmptyString)
          });
          if (Object.keys(user).length !== 1) throw new Match.Error("User property must have exactly one field");
          return true;
        });
        this._server = server || Meteor.server;
        // Set up the server's methods, as if by calling Meteor.methods.
        this._initServerMethods();
        this._initAccountDataHooks();

        // If autopublish is on, publish these user fields. Login service
        // packages (eg accounts-google) add to these by calling
        // addAutopublishFields.  Notably, this isn't implemented with multiple
        // publishes since DDP only merges only across top-level fields, not
        // subfields (such as 'services.facebook.accessToken')
        this._autopublishFields = {
          loggedInUser: ['profile', 'username', 'emails'],
          otherUsers: ['profile', 'username']
        };

        // use object to keep the reference when used in functions
        // where _defaultPublishFields is destructured into lexical scope
        // for publish callbacks that need `this`
        this._defaultPublishFields = {
          projection: {
            profile: 1,
            username: 1,
            emails: 1
          }
        };
        this._initServerPublications();

        // connectionId -> {connection, loginToken}
        this._accountData = {};

        // connection id -> observe handle for the login token that this connection is
        // currently associated with, or a number. The number indicates that we are in
        // the process of setting up the observe (using a number instead of a single
        // sentinel allows multiple attempts to set up the observe to identify which
        // one was theirs).
        this._userObservesForConnections = {};
        this._nextUserObserveNumber = 1; // for the number described above.

        // list of all registered handlers.
        this._loginHandlers = [];
        setupDefaultLoginHandlers(this);
        setExpireTokensInterval(this);
        this._validateLoginHook = new Hook({
          bindEnvironment: false
        });
        this._validateNewUserHooks = [defaultValidateNewUserHook.bind(this)];
        this._deleteSavedTokensForAllUsersOnStartup();
        this._skipCaseInsensitiveChecksForTest = {};
        this.urls = {
          resetPassword: (token, extraParams) => this.buildEmailUrl("#/reset-password/".concat(token), extraParams),
          verifyEmail: (token, extraParams) => this.buildEmailUrl("#/verify-email/".concat(token), extraParams),
          loginToken: (selector, token, extraParams) => this.buildEmailUrl("/?loginToken=".concat(token, "&selector=").concat(selector), extraParams),
          enrollAccount: (token, extraParams) => this.buildEmailUrl("#/enroll-account/".concat(token), extraParams)
        };
        this.addDefaultRateLimit();
        this.buildEmailUrl = function (path) {
          let extraParams = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
          const url = new URL(Meteor.absoluteUrl(path));
          const params = Object.entries(extraParams);
          if (params.length > 0) {
            // Add additional parameters to the url
            for (const [key, value] of params) {
              url.searchParams.append(key, value);
            }
          }
          return url.toString();
        };
      }

      ///
      /// CURRENT USER
      ///

      // @override of "abstract" non-implementation in accounts_common.js
      userId() {
        // This function only works if called inside a method or a pubication.
        // Using any of the information from Meteor.user() in a method or
        // publish function will always use the value from when the function first
        // runs. This is likely not what the user expects. The way to make this work
        // in a method or publish function is to do Meteor.find(this.userId).observe
        // and recompute when the user record changes.
        const currentInvocation = DDP._CurrentMethodInvocation.get() || DDP._CurrentPublicationInvocation.get();
        if (!currentInvocation) throw new Error("Meteor.userId can only be invoked in method calls or publications.");
        return currentInvocation.userId;
      }
      async init() {
        await setupUsersCollection(this.users);
      }

      ///
      /// LOGIN HOOKS
      ///

      /**
       * @summary Validate login attempts.
       * @locus Server
       * @param {Function} func Called whenever a login is attempted (either successful or unsuccessful).  A login can be aborted by returning a falsy value or throwing an exception.
       */
      validateLoginAttempt(func) {
        // Exceptions inside the hook callback are passed up to us.
        return this._validateLoginHook.register(func);
      }

      /**
       * @summary Set restrictions on new user creation.
       * @locus Server
       * @param {Function} func Called whenever a new user is created. Takes the new user object, and returns true to allow the creation or false to abort.
       */
      validateNewUser(func) {
        this._validateNewUserHooks.push(func);
      }

      /**
       * @summary Validate login from external service
       * @locus Server
       * @param {Function} func Called whenever login/user creation from external service is attempted. Login or user creation based on this login can be aborted by passing a falsy value or throwing an exception.
       */
      beforeExternalLogin(func) {
        if (this._beforeExternalLoginHook) {
          throw new Error("Can only call beforeExternalLogin once");
        }
        this._beforeExternalLoginHook = func;
      }
      /**
       * @summary Customize new user creation.
       * @locus Server
       * @param {Function} func Called whenever a new user is created. Return the new user object, or throw an `Error` to abort the creation.
       */
      onCreateUser(func) {
        if (this._onCreateUserHook) {
          throw new Error("Can only call onCreateUser once");
        }
        this._onCreateUserHook = Meteor.wrapFn(func);
      }

      /**
       * @summary Customize oauth user profile updates
       * @locus Server
       * @param {Function} func Called whenever a user is logged in via oauth. Return the profile object to be merged, or throw an `Error` to abort the creation.
       */
      onExternalLogin(func) {
        if (this._onExternalLoginHook) {
          throw new Error("Can only call onExternalLogin once");
        }
        this._onExternalLoginHook = func;
      }

      /**
       * @summary Customize user selection on external logins
       * @locus Server
       * @param {Function} func Called whenever a user is logged in via oauth and a
       * user is not found with the service id. Return the user or undefined.
       */
      setAdditionalFindUserOnExternalLogin(func) {
        if (this._additionalFindUserOnExternalLogin) {
          throw new Error("Can only call setAdditionalFindUserOnExternalLogin once");
        }
        this._additionalFindUserOnExternalLogin = func;
      }
      async _validateLogin(connection, attempt) {
        await this._validateLoginHook.forEachAsync(async callback => {
          let ret;
          try {
            ret = await callback(cloneAttemptWithConnection(connection, attempt));
          } catch (e) {
            attempt.allowed = false;
            // XXX this means the last thrown error overrides previous error
            // messages. Maybe this is surprising to users and we should make
            // overriding errors more explicit. (see
            // https://github.com/meteor/meteor/issues/1960)
            attempt.error = e;
            return true;
          }
          if (!ret) {
            attempt.allowed = false;
            // don't override a specific error provided by a previous
            // validator or the initial attempt (eg "incorrect password").
            if (!attempt.error) attempt.error = new Meteor.Error(403, "Login forbidden");
          }
          return true;
        });
      }
      async _successfulLogin(connection, attempt) {
        await this._onLoginHook.forEachAsync(async callback => {
          await callback(cloneAttemptWithConnection(connection, attempt));
          return true;
        });
      }
      async _failedLogin(connection, attempt) {
        await this._onLoginFailureHook.forEachAsync(async callback => {
          await callback(cloneAttemptWithConnection(connection, attempt));
          return true;
        });
      }
      async _successfulLogout(connection, userId) {
        // don't fetch the user object unless there are some callbacks registered
        let user;
        await this._onLogoutHook.forEachAsync(async callback => {
          if (!user && userId) user = await this.users.findOneAsync(userId, {
            fields: this._options.defaultFieldSelector
          });
          callback({
            user,
            connection
          });
          return true;
        });
      }
      ///
      /// LOGIN METHODS
      ///

      // Login methods return to the client an object containing these
      // fields when the user was logged in successfully:
      //
      //   id: userId
      //   token: *
      //   tokenExpires: *
      //
      // tokenExpires is optional and intends to provide a hint to the
      // client as to when the token will expire. If not provided, the
      // client will call Accounts._tokenExpiration, passing it the date
      // that it received the token.
      //
      // The login method will throw an error back to the client if the user
      // failed to log in.
      //
      //
      // Login handlers and service specific login methods such as
      // `createUser` internally return a `result` object containing these
      // fields:
      //
      //   type:
      //     optional string; the service name, overrides the handler
      //     default if present.
      //
      //   error:
      //     exception; if the user is not allowed to login, the reason why.
      //
      //   userId:
      //     string; the user id of the user attempting to login (if
      //     known), required for an allowed login.
      //
      //   options:
      //     optional object merged into the result returned by the login
      //     method; used by HAMK from SRP.
      //
      //   stampedLoginToken:
      //     optional object with `token` and `when` indicating the login
      //     token is already present in the database, returned by the
      //     "resume" login handler.
      //
      // For convenience, login methods can also throw an exception, which
      // is converted into an {error} result.  However, if the id of the
      // user attempting the login is known, a {userId, error} result should
      // be returned instead since the user id is not captured when an
      // exception is thrown.
      //
      // This internal `result` object is automatically converted into the
      // public {id, token, tokenExpires} object returned to the client.

      // Try a login method, converting thrown exceptions into an {error}
      // result.  The `type` argument is a default, inserted into the result
      // object if not explicitly returned.
      //
      // Log in a user on a connection.
      //
      // We use the method invocation to set the user id on the connection,
      // not the connection object directly. setUserId is tied to methods to
      // enforce clear ordering of method application (using wait methods on
      // the client, and a no setUserId after unblock restriction on the
      // server)
      //
      // The `stampedLoginToken` parameter is optional.  When present, it
      // indicates that the login token has already been inserted into the
      // database and doesn't need to be inserted again.  (It's used by the
      // "resume" login handler).
      async _loginUser(methodInvocation, userId, stampedLoginToken) {
        if (!stampedLoginToken) {
          stampedLoginToken = this._generateStampedLoginToken();
          await this._insertLoginToken(userId, stampedLoginToken);
        }

        // This order (and the avoidance of yields) is important to make
        // sure that when publish functions are rerun, they see a
        // consistent view of the world: the userId is set and matches
        // the login token on the connection (not that there is
        // currently a public API for reading the login token on a
        // connection).
        Meteor._noYieldsAllowed(() => this._setLoginToken(userId, methodInvocation.connection, this._hashLoginToken(stampedLoginToken.token)));
        await methodInvocation.setUserId(userId);
        return {
          id: userId,
          token: stampedLoginToken.token,
          tokenExpires: this._tokenExpiration(stampedLoginToken.when)
        };
      }
      // After a login method has completed, call the login hooks.  Note
      // that `attemptLogin` is called for *all* login attempts, even ones
      // which aren't successful (such as an invalid password, etc).
      //
      // If the login is allowed and isn't aborted by a validate login hook
      // callback, log in the user.
      //
      async _attemptLogin(methodInvocation, methodName, methodArgs, result) {
        if (!result) throw new Error("result is required");

        // XXX A programming error in a login handler can lead to this occurring, and
        // then we don't call onLogin or onLoginFailure callbacks. Should
        // tryLoginMethod catch this case and turn it into an error?
        if (!result.userId && !result.error) throw new Error("A login method must specify a userId or an error");
        let user;
        if (result.userId) user = await this.users.findOneAsync(result.userId, {
          fields: this._options.defaultFieldSelector
        });
        const attempt = {
          type: result.type || "unknown",
          allowed: !!(result.userId && !result.error),
          methodName: methodName,
          methodArguments: Array.from(methodArgs)
        };
        if (result.error) {
          attempt.error = result.error;
        }
        if (user) {
          attempt.user = user;
        }

        // _validateLogin may mutate `attempt` by adding an error and changing allowed
        // to false, but that's the only change it can make (and the user's callbacks
        // only get a clone of `attempt`).
        await this._validateLogin(methodInvocation.connection, attempt);
        if (attempt.allowed) {
          const o = await this._loginUser(methodInvocation, result.userId, result.stampedLoginToken);
          const ret = _objectSpread(_objectSpread({}, o), result.options);
          ret.type = attempt.type;
          await this._successfulLogin(methodInvocation.connection, attempt);
          return ret;
        } else {
          await this._failedLogin(methodInvocation.connection, attempt);
          throw attempt.error;
        }
      }
      // All service specific login methods should go through this function.
      // Ensure that thrown exceptions are caught and that login hook
      // callbacks are still called.
      //
      async _loginMethod(methodInvocation, methodName, methodArgs, type, fn) {
        return await this._attemptLogin(methodInvocation, methodName, methodArgs, await tryLoginMethod(type, fn));
      }
      // Report a login attempt failed outside the context of a normal login
      // method. This is for use in the case where there is a multi-step login
      // procedure (eg SRP based password login). If a method early in the
      // chain fails, it should call this function to report a failure. There
      // is no corresponding method for a successful login; methods that can
      // succeed at logging a user in should always be actual login methods
      // (using either Accounts._loginMethod or Accounts.registerLoginHandler).
      async _reportLoginFailure(methodInvocation, methodName, methodArgs, result) {
        const attempt = {
          type: result.type || "unknown",
          allowed: false,
          error: result.error,
          methodName: methodName,
          methodArguments: Array.from(methodArgs)
        };
        if (result.userId) {
          attempt.user = this.users.findOneAsync(result.userId, {
            fields: this._options.defaultFieldSelector
          });
        }
        await this._validateLogin(methodInvocation.connection, attempt);
        await this._failedLogin(methodInvocation.connection, attempt);

        // _validateLogin may mutate attempt to set a new error message. Return
        // the modified version.
        return attempt;
      }
      ///
      /// LOGIN HANDLERS
      ///

      /**
       * @summary Registers a new login handler.
       * @locus Server
       * @param {String} [name] The type of login method like oauth, password, etc.
       * @param {Function} handler A function that receives an options object
       * (as passed as an argument to the `login` method) and returns one of
       * `undefined`, meaning don't handle or a login method result object.
       */
      registerLoginHandler(name, handler) {
        if (!handler) {
          handler = name;
          name = null;
        }
        this._loginHandlers.push({
          name: name,
          handler: Meteor.wrapFn(handler)
        });
      }
      // Checks a user's credentials against all the registered login
      // handlers, and returns a login token if the credentials are valid. It
      // is like the login method, except that it doesn't set the logged-in
      // user on the connection. Throws a Meteor.Error if logging in fails,
      // including the case where none of the login handlers handled the login
      // request. Otherwise, returns {id: userId, token: *, tokenExpires: *}.
      //
      // For example, if you want to login with a plaintext password, `options` could be
      //   { user: { username: <username> }, password: <password> }, or
      //   { user: { email: <email> }, password: <password> }.

      // Try all of the registered login handlers until one of them doesn't
      // return `undefined`, meaning it handled this call to `login`. Return
      // that return value.
      async _runLoginHandlers(methodInvocation, options) {
        for (let handler of this._loginHandlers) {
          const result = await tryLoginMethod(handler.name, async () => await handler.handler.call(methodInvocation, options));
          if (result) {
            return result;
          }
          if (result !== undefined) {
            throw new Meteor.Error(400, 'A login handler should return a result or undefined');
          }
        }
        return {
          type: null,
          error: new Meteor.Error(400, "Unrecognized options for login request")
        };
      }
      // Deletes the given loginToken from the database.
      //
      // For new-style hashed token, this will cause all connections
      // associated with the token to be closed.
      //
      // Any connections associated with old-style unhashed tokens will be
      // in the process of becoming associated with hashed tokens and then
      // they'll get closed.
      async destroyToken(userId, loginToken) {
        await this.users.updateAsync(userId, {
          $pull: {
            "services.resume.loginTokens": {
              $or: [{
                hashedToken: loginToken
              }, {
                token: loginToken
              }]
            }
          }
        });
      }
      _initServerMethods() {
        // The methods created in this function need to be created here so that
        // this variable is available in their scope.
        const accounts = this;

        // This object will be populated with methods and then passed to
        // accounts._server.methods further below.
        const methods = {};

        // @returns {Object|null}
        //   If successful, returns {token: reconnectToken, id: userId}
        //   If unsuccessful (for example, if the user closed the oauth login popup),
        //     throws an error describing the reason
        methods.login = async function (options) {
          // Login handlers should really also check whatever field they look at in
          // options, but we don't enforce it.
          check(options, Object);
          const result = await accounts._runLoginHandlers(this, options);
          //console.log({result});

          return await accounts._attemptLogin(this, "login", arguments, result);
        };
        methods.logout = async function () {
          const token = accounts._getLoginToken(this.connection.id);
          accounts._setLoginToken(this.userId, this.connection, null);
          if (token && this.userId) {
            await accounts.destroyToken(this.userId, token);
          }
          await accounts._successfulLogout(this.connection, this.userId);
          await this.setUserId(null);
        };

        // Generates a new login token with the same expiration as the
        // connection's current token and saves it to the database. Associates
        // the connection with this new token and returns it. Throws an error
        // if called on a connection that isn't logged in.
        //
        // @returns Object
        //   If successful, returns { token: <new token>, id: <user id>,
        //   tokenExpires: <expiration date> }.
        methods.getNewToken = async function () {
          const user = await accounts.users.findOneAsync(this.userId, {
            fields: {
              "services.resume.loginTokens": 1
            }
          });
          if (!this.userId || !user) {
            throw new Meteor.Error("You are not logged in.");
          }
          // Be careful not to generate a new token that has a later
          // expiration than the curren token. Otherwise, a bad guy with a
          // stolen token could use this method to stop his stolen token from
          // ever expiring.
          const currentHashedToken = accounts._getLoginToken(this.connection.id);
          const currentStampedToken = user.services.resume.loginTokens.find(stampedToken => stampedToken.hashedToken === currentHashedToken);
          if (!currentStampedToken) {
            // safety belt: this should never happen
            throw new Meteor.Error("Invalid login token");
          }
          const newStampedToken = accounts._generateStampedLoginToken();
          newStampedToken.when = currentStampedToken.when;
          await accounts._insertLoginToken(this.userId, newStampedToken);
          return await accounts._loginUser(this, this.userId, newStampedToken);
        };

        // Removes all tokens except the token associated with the current
        // connection. Throws an error if the connection is not logged
        // in. Returns nothing on success.
        methods.removeOtherTokens = async function () {
          if (!this.userId) {
            throw new Meteor.Error("You are not logged in.");
          }
          const currentToken = accounts._getLoginToken(this.connection.id);
          await accounts.users.updateAsync(this.userId, {
            $pull: {
              "services.resume.loginTokens": {
                hashedToken: {
                  $ne: currentToken
                }
              }
            }
          });
        };

        // Allow a one-time configuration for a login service. Modifications
        // to this collection are also allowed in insecure mode.
        methods.configureLoginService = async options => {
          check(options, Match.ObjectIncluding({
            service: String
          }));
          // Don't let random users configure a service we haven't added yet (so
          // that when we do later add it, it's set up with their configuration
          // instead of ours).
          // XXX if service configuration is oauth-specific then this code should
          //     be in accounts-oauth; if it's not then the registry should be
          //     in this package
          if (!(accounts.oauth && accounts.oauth.serviceNames().includes(options.service))) {
            throw new Meteor.Error(403, "Service unknown");
          }
          if (Package['service-configuration']) {
            const {
              ServiceConfiguration
            } = Package['service-configuration'];
            const service = await ServiceConfiguration.configurations.findOneAsync({
              service: options.service
            });
            if (service) throw new Meteor.Error(403, "Service ".concat(options.service, " already configured"));
            if (Package["oauth-encryption"]) {
              const {
                OAuthEncryption
              } = Package["oauth-encryption"];
              if (hasOwn.call(options, 'secret') && OAuthEncryption.keyIsLoaded()) options.secret = OAuthEncryption.seal(options.secret);
            }
            await ServiceConfiguration.configurations.insertAsync(options);
          }
        };
        accounts._server.methods(methods);
      }
      _initAccountDataHooks() {
        this._server.onConnection(connection => {
          this._accountData[connection.id] = {
            connection: connection
          };
          connection.onClose(() => {
            this._removeTokenFromConnection(connection.id);
            delete this._accountData[connection.id];
          });
        });
      }
      _initServerPublications() {
        // Bring into lexical scope for publish callbacks that need `this`
        const {
          users,
          _autopublishFields,
          _defaultPublishFields
        } = this;

        // Publish all login service configuration fields other than secret.
        this._server.publish("meteor.loginServiceConfiguration", function () {
          if (Package['service-configuration']) {
            const {
              ServiceConfiguration
            } = Package['service-configuration'];
            return ServiceConfiguration.configurations.find({}, {
              fields: {
                secret: 0
              }
            });
          }
          this.ready();
        }, {
          is_auto: true
        }); // not technically autopublish, but stops the warning.

        // Use Meteor.startup to give other packages a chance to call
        // setDefaultPublishFields.
        Meteor.startup(() => {
          // Merge custom fields selector and default publish fields so that the client
          // gets all the necessary fields to run properly
          const customFields = this._addDefaultFieldSelector().fields || {};
          const keys = Object.keys(customFields);
          // If the custom fields are negative, then ignore them and only send the necessary fields
          const fields = keys.length > 0 && customFields[keys[0]] ? _objectSpread(_objectSpread({}, this._addDefaultFieldSelector().fields), _defaultPublishFields.projection) : _defaultPublishFields.projection;
          // Publish the current user's record to the client.
          this._server.publish(null, function () {
            if (this.userId) {
              return users.find({
                _id: this.userId
              }, {
                fields
              });
            } else {
              return null;
            }
          }, /*suppress autopublish warning*/{
            is_auto: true
          });
        });

        // Use Meteor.startup to give other packages a chance to call
        // addAutopublishFields.
        Package.autopublish && Meteor.startup(() => {
          // ['profile', 'username'] -> {profile: 1, username: 1}
          const toFieldSelector = fields => fields.reduce((prev, field) => _objectSpread(_objectSpread({}, prev), {}, {
            [field]: 1
          }), {});
          this._server.publish(null, function () {
            if (this.userId) {
              return users.find({
                _id: this.userId
              }, {
                fields: toFieldSelector(_autopublishFields.loggedInUser)
              });
            } else {
              return null;
            }
          }, /*suppress autopublish warning*/{
            is_auto: true
          });

          // XXX this publish is neither dedup-able nor is it optimized by our special
          // treatment of queries on a specific _id. Therefore this will have O(n^2)
          // run-time performance every time a user document is changed (eg someone
          // logging in). If this is a problem, we can instead write a manual publish
          // function which filters out fields based on 'this.userId'.
          this._server.publish(null, function () {
            const selector = this.userId ? {
              _id: {
                $ne: this.userId
              }
            } : {};
            return users.find(selector, {
              fields: toFieldSelector(_autopublishFields.otherUsers)
            });
          }, /*suppress autopublish warning*/{
            is_auto: true
          });
        });
      }
      // Add to the list of fields or subfields to be automatically
      // published if autopublish is on. Must be called from top-level
      // code (ie, before Meteor.startup hooks run).
      //
      // @param opts {Object} with:
      //   - forLoggedInUser {Array} Array of fields published to the logged-in user
      //   - forOtherUsers {Array} Array of fields published to users that aren't logged in
      addAutopublishFields(opts) {
        this._autopublishFields.loggedInUser.push.apply(this._autopublishFields.loggedInUser, opts.forLoggedInUser);
        this._autopublishFields.otherUsers.push.apply(this._autopublishFields.otherUsers, opts.forOtherUsers);
      }
      // Replaces the fields to be automatically
      // published when the user logs in
      //
      // @param {MongoFieldSpecifier} fields Dictionary of fields to return or exclude.
      setDefaultPublishFields(fields) {
        this._defaultPublishFields.projection = fields;
      }
      ///
      /// ACCOUNT DATA
      ///

      // HACK: This is used by 'meteor-accounts' to get the loginToken for a
      // connection. Maybe there should be a public way to do that.
      _getAccountData(connectionId, field) {
        const data = this._accountData[connectionId];
        return data && data[field];
      }
      _setAccountData(connectionId, field, value) {
        const data = this._accountData[connectionId];

        // safety belt. shouldn't happen. accountData is set in onConnection,
        // we don't have a connectionId until it is set.
        if (!data) return;
        if (value === undefined) delete data[field];else data[field] = value;
      }
      ///
      /// RECONNECT TOKENS
      ///
      /// support reconnecting using a meteor login token

      _hashLoginToken(loginToken) {
        const hash = crypto.createHash('sha256');
        hash.update(loginToken);
        return hash.digest('base64');
      }
      // {token, when} => {hashedToken, when}
      _hashStampedToken(stampedToken) {
        const {
            token
          } = stampedToken,
          hashedStampedToken = _objectWithoutProperties(stampedToken, _excluded);
        return _objectSpread(_objectSpread({}, hashedStampedToken), {}, {
          hashedToken: this._hashLoginToken(token)
        });
      }
      // Using $addToSet avoids getting an index error if another client
      // logging in simultaneously has already inserted the new hashed
      // token.
      async _insertHashedLoginToken(userId, hashedToken, query) {
        query = query ? _objectSpread({}, query) : {};
        query._id = userId;
        await this.users.updateAsync(query, {
          $addToSet: {
            "services.resume.loginTokens": hashedToken
          }
        });
      }
      // Exported for tests.
      async _insertLoginToken(userId, stampedToken, query) {
        await this._insertHashedLoginToken(userId, this._hashStampedToken(stampedToken), query);
      }
      /**
       *
       * @param userId
       * @private
       * @returns {Promise<void>}
       */
      _clearAllLoginTokens(userId) {
        this.users.updateAsync(userId, {
          $set: {
            'services.resume.loginTokens': []
          }
        });
      }
      // test hook
      _getUserObserve(connectionId) {
        return this._userObservesForConnections[connectionId];
      }
      // Clean up this connection's association with the token: that is, stop
      // the observe that we started when we associated the connection with
      // this token.
      _removeTokenFromConnection(connectionId) {
        if (hasOwn.call(this._userObservesForConnections, connectionId)) {
          const observe = this._userObservesForConnections[connectionId];
          if (typeof observe === 'number') {
            // We're in the process of setting up an observe for this connection. We
            // can't clean up that observe yet, but if we delete the placeholder for
            // this connection, then the observe will get cleaned up as soon as it has
            // been set up.
            delete this._userObservesForConnections[connectionId];
          } else {
            delete this._userObservesForConnections[connectionId];
            observe.stop();
          }
        }
      }
      _getLoginToken(connectionId) {
        return this._getAccountData(connectionId, 'loginToken');
      }
      // newToken is a hashed token.
      _setLoginToken(userId, connection, newToken) {
        this._removeTokenFromConnection(connection.id);
        this._setAccountData(connection.id, 'loginToken', newToken);
        if (newToken) {
          // Set up an observe for this token. If the token goes away, we need
          // to close the connection.  We defer the observe because there's
          // no need for it to be on the critical path for login; we just need
          // to ensure that the connection will get closed at some point if
          // the token gets deleted.
          //
          // Initially, we set the observe for this connection to a number; this
          // signifies to other code (which might run while we yield) that we are in
          // the process of setting up an observe for this connection. Once the
          // observe is ready to go, we replace the number with the real observe
          // handle (unless the placeholder has been deleted or replaced by a
          // different placehold number, signifying that the connection was closed
          // already -- in this case we just clean up the observe that we started).
          const myObserveNumber = ++this._nextUserObserveNumber;
          this._userObservesForConnections[connection.id] = myObserveNumber;
          Meteor.defer(async () => {
            // If something else happened on this connection in the meantime (it got
            // closed, or another call to _setLoginToken happened), just do
            // nothing. We don't need to start an observe for an old connection or old
            // token.
            if (this._userObservesForConnections[connection.id] !== myObserveNumber) {
              return;
            }
            let foundMatchingUser;
            // Because we upgrade unhashed login tokens to hashed tokens at
            // login time, sessions will only be logged in with a hashed
            // token. Thus we only need to observe hashed tokens here.
            const observe = await this.users.find({
              _id: userId,
              'services.resume.loginTokens.hashedToken': newToken
            }, {
              fields: {
                _id: 1
              }
            }).observeChanges({
              added: () => {
                foundMatchingUser = true;
              },
              removed: connection.close
              // The onClose callback for the connection takes care of
              // cleaning up the observe handle and any other state we have
              // lying around.
            }, {
              nonMutatingCallbacks: true
            });

            // If the user ran another login or logout command we were waiting for the
            // defer or added to fire (ie, another call to _setLoginToken occurred),
            // then we let the later one win (start an observe, etc) and just stop our
            // observe now.
            //
            // Similarly, if the connection was already closed, then the onClose
            // callback would have called _removeTokenFromConnection and there won't
            // be an entry in _userObservesForConnections. We can stop the observe.
            if (this._userObservesForConnections[connection.id] !== myObserveNumber) {
              observe.stop();
              return;
            }
            this._userObservesForConnections[connection.id] = observe;
            if (!foundMatchingUser) {
              // We've set up an observe on the user associated with `newToken`,
              // so if the new token is removed from the database, we'll close
              // the connection. But the token might have already been deleted
              // before we set up the observe, which wouldn't have closed the
              // connection because the observe wasn't running yet.
              connection.close();
            }
          });
        }
      }
      // (Also used by Meteor Accounts server and tests).
      //
      _generateStampedLoginToken() {
        return {
          token: Random.secret(),
          when: new Date()
        };
      }
      ///
      /// TOKEN EXPIRATION
      ///

      // Deletes expired password reset tokens from the database.
      //
      // Exported for tests. Also, the arguments are only used by
      // tests. oldestValidDate is simulate expiring tokens without waiting
      // for them to actually expire. userId is used by tests to only expire
      // tokens for the test user.
      async _expirePasswordResetTokens(oldestValidDate, userId) {
        const tokenLifetimeMs = this._getPasswordResetTokenLifetimeMs();

        // when calling from a test with extra arguments, you must specify both!
        if (oldestValidDate && !userId || !oldestValidDate && userId) {
          throw new Error("Bad test. Must specify both oldestValidDate and userId.");
        }
        oldestValidDate = oldestValidDate || new Date(new Date() - tokenLifetimeMs);
        const tokenFilter = {
          $or: [{
            "services.password.reset.reason": "reset"
          }, {
            "services.password.reset.reason": {
              $exists: false
            }
          }]
        };
        await expirePasswordToken(this, oldestValidDate, tokenFilter, userId);
      }

      // Deletes expired password enroll tokens from the database.
      //
      // Exported for tests. Also, the arguments are only used by
      // tests. oldestValidDate is simulate expiring tokens without waiting
      // for them to actually expire. userId is used by tests to only expire
      // tokens for the test user.
      async _expirePasswordEnrollTokens(oldestValidDate, userId) {
        const tokenLifetimeMs = this._getPasswordEnrollTokenLifetimeMs();

        // when calling from a test with extra arguments, you must specify both!
        if (oldestValidDate && !userId || !oldestValidDate && userId) {
          throw new Error("Bad test. Must specify both oldestValidDate and userId.");
        }
        oldestValidDate = oldestValidDate || new Date(new Date() - tokenLifetimeMs);
        const tokenFilter = {
          "services.password.enroll.reason": "enroll"
        };
        await expirePasswordToken(this, oldestValidDate, tokenFilter, userId);
      }

      // Deletes expired tokens from the database and closes all open connections
      // associated with these tokens.
      //
      // Exported for tests. Also, the arguments are only used by
      // tests. oldestValidDate is simulate expiring tokens without waiting
      // for them to actually expire. userId is used by tests to only expire
      // tokens for the test user.
      /**
       *
       * @param oldestValidDate
       * @param userId
       * @private
       * @return {Promise<void>}
       */
      async _expireTokens(oldestValidDate, userId) {
        const tokenLifetimeMs = this._getTokenLifetimeMs();

        // when calling from a test with extra arguments, you must specify both!
        if (oldestValidDate && !userId || !oldestValidDate && userId) {
          throw new Error("Bad test. Must specify both oldestValidDate and userId.");
        }
        oldestValidDate = oldestValidDate || new Date(new Date() - tokenLifetimeMs);
        const userFilter = userId ? {
          _id: userId
        } : {};

        // Backwards compatible with older versions of meteor that stored login token
        // timestamps as numbers.
        await this.users.updateAsync(_objectSpread(_objectSpread({}, userFilter), {}, {
          $or: [{
            "services.resume.loginTokens.when": {
              $lt: oldestValidDate
            }
          }, {
            "services.resume.loginTokens.when": {
              $lt: +oldestValidDate
            }
          }]
        }), {
          $pull: {
            "services.resume.loginTokens": {
              $or: [{
                when: {
                  $lt: oldestValidDate
                }
              }, {
                when: {
                  $lt: +oldestValidDate
                }
              }]
            }
          }
        }, {
          multi: true
        });
        // The observe on Meteor.users will take care of closing connections for
        // expired tokens.
      }
      // @override from accounts_common.js
      config(options) {
        // Call the overridden implementation of the method.
        const superResult = AccountsCommon.prototype.config.apply(this, arguments);

        // If the user set loginExpirationInDays to null, then we need to clear the
        // timer that periodically expires tokens.
        if (hasOwn.call(this._options, 'loginExpirationInDays') && this._options.loginExpirationInDays === null && this.expireTokenInterval) {
          Meteor.clearInterval(this.expireTokenInterval);
          this.expireTokenInterval = null;
        }
        return superResult;
      }
      // Called by accounts-password
      async insertUserDoc(options, user) {
        // - clone user document, to protect from modification
        // - add createdAt timestamp
        // - prepare an _id, so that you can modify other collections (eg
        // create a first task for every new user)
        //
        // XXX If the onCreateUser or validateNewUser hooks fail, we might
        // end up having modified some other collection
        // inappropriately. The solution is probably to have onCreateUser
        // accept two callbacks - one that gets called before inserting
        // the user document (in which you can modify its contents), and
        // one that gets called after (in which you should change other
        // collections)
        user = _objectSpread({
          createdAt: new Date(),
          _id: Random.id()
        }, user);
        if (user.services) {
          Object.keys(user.services).forEach(service => pinEncryptedFieldsToUser(user.services[service], user._id));
        }
        let fullUser;
        if (this._onCreateUserHook) {
          // Allows _onCreateUserHook to be a promise returning func
          fullUser = await this._onCreateUserHook(options, user);

          // This is *not* part of the API. We need this because we can't isolate
          // the global server environment between tests, meaning we can't test
          // both having a create user hook set and not having one set.
          if (fullUser === 'TEST DEFAULT HOOK') fullUser = defaultCreateUserHook(options, user);
        } else {
          fullUser = defaultCreateUserHook(options, user);
        }
        var _iteratorAbruptCompletion = false;
        var _didIteratorError = false;
        var _iteratorError;
        try {
          for (var _iterator = _asyncIterator(this._validateNewUserHooks), _step; _iteratorAbruptCompletion = !(_step = await _iterator.next()).done; _iteratorAbruptCompletion = false) {
            const hook = _step.value;
            {
              if (!(await hook(fullUser))) throw new Meteor.Error(403, "User validation failed");
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
        let userId;
        try {
          userId = await this.users.insertAsync(fullUser);
        } catch (e) {
          // XXX string parsing sucks, maybe
          // https://jira.mongodb.org/browse/SERVER-3069 will get fixed one day
          // https://jira.mongodb.org/browse/SERVER-4637
          if (!e.errmsg) throw e;
          if (e.errmsg.includes('emails.address')) throw new Meteor.Error(403, "Email already exists.");
          if (e.errmsg.includes('username')) throw new Meteor.Error(403, "Username already exists.");
          throw e;
        }
        return userId;
      }
      // Helper function: returns false if email does not match company domain from
      // the configuration.
      _testEmailDomain(email) {
        const domain = this._options.restrictCreationByEmailDomain;
        return !domain || typeof domain === 'function' && domain(email) || typeof domain === 'string' && new RegExp("@".concat(Meteor._escapeRegExp(domain), "$"), 'i').test(email);
      }
      ///
      /// CLEAN UP FOR `logoutOtherClients`
      ///

      async _deleteSavedTokensForUser(userId, tokensToDelete) {
        if (tokensToDelete) {
          await this.users.updateAsync(userId, {
            $unset: {
              "services.resume.haveLoginTokensToDelete": 1,
              "services.resume.loginTokensToDelete": 1
            },
            $pullAll: {
              "services.resume.loginTokens": tokensToDelete
            }
          });
        }
      }
      _deleteSavedTokensForAllUsersOnStartup() {
        // If we find users who have saved tokens to delete on startup, delete
        // them now. It's possible that the server could have crashed and come
        // back up before new tokens are found in localStorage, but this
        // shouldn't happen very often. We shouldn't put a delay here because
        // that would give a lot of power to an attacker with a stolen login
        // token and the ability to crash the server.
        Meteor.startup(async () => {
          const users = await this.users.find({
            "services.resume.haveLoginTokensToDelete": true
          }, {
            fields: {
              "services.resume.loginTokensToDelete": 1
            }
          });
          users.forEach(user => {
            this._deleteSavedTokensForUser(user._id, user.services.resume.loginTokensToDelete)
            // We don't need to wait for this to complete.
            .then(_ => _).catch(err => {
              console.log(err);
            });
          });
        });
      }
      ///
      /// MANAGING USER OBJECTS
      ///

      // Updates or creates a user after we authenticate with a 3rd party.
      //
      // @param serviceName {String} Service name (eg, twitter).
      // @param serviceData {Object} Data to store in the user's record
      //        under services[serviceName]. Must include an "id" field
      //        which is a unique identifier for the user in the service.
      // @param options {Object, optional} Other options to pass to insertUserDoc
      //        (eg, profile)
      // @returns {Object} Object with token and id keys, like the result
      //        of the "login" method.
      //
      async updateOrCreateUserFromExternalService(serviceName, serviceData, options) {
        options = _objectSpread({}, options);
        if (serviceName === "password" || serviceName === "resume") {
          throw new Error("Can't use updateOrCreateUserFromExternalService with internal service " + serviceName);
        }
        if (!hasOwn.call(serviceData, 'id')) {
          throw new Error("Service data for service ".concat(serviceName, " must include id"));
        }

        // Look for a user with the appropriate service user id.
        const selector = {};
        const serviceIdKey = "services.".concat(serviceName, ".id");

        // XXX Temporary special case for Twitter. (Issue #629)
        //   The serviceData.id will be a string representation of an integer.
        //   We want it to match either a stored string or int representation.
        //   This is to cater to earlier versions of Meteor storing twitter
        //   user IDs in number form, and recent versions storing them as strings.
        //   This can be removed once migration technology is in place, and twitter
        //   users stored with integer IDs have been migrated to string IDs.
        if (serviceName === "twitter" && !isNaN(serviceData.id)) {
          selector["$or"] = [{}, {}];
          selector["$or"][0][serviceIdKey] = serviceData.id;
          selector["$or"][1][serviceIdKey] = parseInt(serviceData.id, 10);
        } else {
          selector[serviceIdKey] = serviceData.id;
        }
        let user = await this.users.findOneAsync(selector, {
          fields: this._options.defaultFieldSelector
        });
        // Check to see if the developer has a custom way to find the user outside
        // of the general selectors above.
        if (!user && this._additionalFindUserOnExternalLogin) {
          user = await this._additionalFindUserOnExternalLogin({
            serviceName,
            serviceData,
            options
          });
        }

        // Before continuing, run user hook to see if we should continue
        if (this._beforeExternalLoginHook && !(await this._beforeExternalLoginHook(serviceName, serviceData, user))) {
          throw new Meteor.Error(403, "Login forbidden");
        }

        // When creating a new user we pass through all options. When updating an
        // existing user, by default we only process/pass through the serviceData
        // (eg, so that we keep an unexpired access token and don't cache old email
        // addresses in serviceData.email). The onExternalLogin hook can be used when
        // creating or updating a user, to modify or pass through more options as
        // needed.
        let opts = user ? {} : options;
        if (this._onExternalLoginHook) {
          opts = await this._onExternalLoginHook(options, user);
        }
        if (user) {
          await pinEncryptedFieldsToUser(serviceData, user._id);
          let setAttrs = {};
          Object.keys(serviceData).forEach(key => setAttrs["services.".concat(serviceName, ".").concat(key)] = serviceData[key]);

          // XXX Maybe we should re-use the selector above and notice if the update
          //     touches nothing?
          setAttrs = _objectSpread(_objectSpread({}, setAttrs), opts);
          await this.users.updateAsync(user._id, {
            $set: setAttrs
          });
          return {
            type: serviceName,
            userId: user._id
          };
        } else {
          // Create a new user with the service data.
          user = {
            services: {}
          };
          user.services[serviceName] = serviceData;
          const userId = await this.insertUserDoc(opts, user);
          return {
            type: serviceName,
            userId
          };
        }
      }
      /**
       * @summary Removes default rate limiting rule
       * @locus Server
       * @importFromPackage accounts-base
       */
      removeDefaultRateLimit() {
        const resp = DDPRateLimiter.removeRule(this.defaultRateLimiterRuleId);
        this.defaultRateLimiterRuleId = null;
        return resp;
      }
      /**
       * @summary Add a default rule of limiting logins, creating new users and password reset
       * to 5 times every 10 seconds per connection.
       * @locus Server
       * @importFromPackage accounts-base
       */
      addDefaultRateLimit() {
        if (!this.defaultRateLimiterRuleId) {
          this.defaultRateLimiterRuleId = DDPRateLimiter.addRule({
            userId: null,
            clientAddress: null,
            type: 'method',
            name: name => ['login', 'createUser', 'resetPassword', 'forgotPassword'].includes(name),
            connectionId: connectionId => true
          }, 5, 10000);
        }
      }
      /**
       * @summary Creates options for email sending for reset password and enroll account emails.
       * You can use this function when customizing a reset password or enroll account email sending.
       * @locus Server
       * @param {Object} email Which address of the user's to send the email to.
       * @param {Object} user The user object to generate options for.
       * @param {String} url URL to which user is directed to confirm the email.
       * @param {String} reason `resetPassword` or `enrollAccount`.
       * @returns {Object} Options which can be passed to `Email.send`.
       * @importFromPackage accounts-base
       */
      async generateOptionsForEmail(email, user, url, reason) {
        let extra = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
        const options = {
          to: email,
          from: this.emailTemplates[reason].from ? await this.emailTemplates[reason].from(user) : this.emailTemplates.from,
          subject: await this.emailTemplates[reason].subject(user, url, extra)
        };
        if (typeof this.emailTemplates[reason].text === 'function') {
          options.text = await this.emailTemplates[reason].text(user, url, extra);
        }
        if (typeof this.emailTemplates[reason].html === 'function') {
          options.html = await this.emailTemplates[reason].html(user, url, extra);
        }
        if (typeof this.emailTemplates.headers === 'object') {
          options.headers = this.emailTemplates.headers;
        }
        return options;
      }
      async _checkForCaseInsensitiveDuplicates(fieldName, displayName, fieldValue, ownUserId) {
        // Some tests need the ability to add users with the same case insensitive
        // value, hence the _skipCaseInsensitiveChecksForTest check
        const skipCheck = Object.prototype.hasOwnProperty.call(this._skipCaseInsensitiveChecksForTest, fieldValue);
        if (fieldValue && !skipCheck) {
          const matchedUsers = await Meteor.users.find(this._selectorForFastCaseInsensitiveLookup(fieldName, fieldValue), {
            fields: {
              _id: 1
            },
            // we only need a maximum of 2 users for the logic below to work
            limit: 2
          }).fetchAsync();
          if (matchedUsers.length > 0 && (
          // If we don't have a userId yet, any match we find is a duplicate
          !ownUserId ||
          // Otherwise, check to see if there are multiple matches or a match
          // that is not us
          matchedUsers.length > 1 || matchedUsers[0]._id !== ownUserId)) {
            this._handleError("".concat(displayName, " already exists."));
          }
        }
      }
      async _createUserCheckingDuplicates(_ref) {
        let {
          user,
          email,
          username,
          options
        } = _ref;
        const newUser = _objectSpread(_objectSpread(_objectSpread({}, user), username ? {
          username
        } : {}), email ? {
          emails: [{
            address: email,
            verified: false
          }]
        } : {});

        // Perform a case insensitive check before insert
        await this._checkForCaseInsensitiveDuplicates('username', 'Username', username);
        await this._checkForCaseInsensitiveDuplicates('emails.address', 'Email', email);
        const userId = await this.insertUserDoc(options, newUser);
        // Perform another check after insert, in case a matching user has been
        // inserted in the meantime
        try {
          await this._checkForCaseInsensitiveDuplicates('username', 'Username', username, userId);
          await this._checkForCaseInsensitiveDuplicates('emails.address', 'Email', email, userId);
        } catch (ex) {
          // Remove inserted user if the check fails
          await Meteor.users.removeAsync(userId);
          throw ex;
        }
        return userId;
      }
    }
    // Give each login hook callback a fresh cloned copy of the attempt
    // object, but don't clone the connection.
    //
    const cloneAttemptWithConnection = (connection, attempt) => {
      const clonedAttempt = EJSON.clone(attempt);
      clonedAttempt.connection = connection;
      return clonedAttempt;
    };
    const tryLoginMethod = async (type, fn) => {
      let result;
      try {
        result = await fn();
      } catch (e) {
        result = {
          error: e
        };
      }
      if (result && !result.type && type) result.type = type;
      return result;
    };
    const setupDefaultLoginHandlers = accounts => {
      accounts.registerLoginHandler("resume", function (options) {
        return defaultResumeLoginHandler.call(this, accounts, options);
      });
    };

    // Login handler for resume tokens.
    const defaultResumeLoginHandler = async (accounts, options) => {
      if (!options.resume) return undefined;
      check(options.resume, String);
      const hashedToken = accounts._hashLoginToken(options.resume);

      // First look for just the new-style hashed login token, to avoid
      // sending the unhashed token to the database in a query if we don't
      // need to.
      let user = await accounts.users.findOneAsync({
        "services.resume.loginTokens.hashedToken": hashedToken
      }, {
        fields: {
          "services.resume.loginTokens.$": 1
        }
      });
      if (!user) {
        // If we didn't find the hashed login token, try also looking for
        // the old-style unhashed token.  But we need to look for either
        // the old-style token OR the new-style token, because another
        // client connection logging in simultaneously might have already
        // converted the token.
        user = await accounts.users.findOneAsync({
          $or: [{
            "services.resume.loginTokens.hashedToken": hashedToken
          }, {
            "services.resume.loginTokens.token": options.resume
          }]
        },
        // Note: Cannot use ...loginTokens.$ positional operator with $or query.
        {
          fields: {
            "services.resume.loginTokens": 1
          }
        });
      }
      if (!user) return {
        error: new Meteor.Error(403, "You've been logged out by the server. Please log in again.")
      };

      // Find the token, which will either be an object with fields
      // {hashedToken, when} for a hashed token or {token, when} for an
      // unhashed token.
      let oldUnhashedStyleToken;
      let token = await user.services.resume.loginTokens.find(token => token.hashedToken === hashedToken);
      if (token) {
        oldUnhashedStyleToken = false;
      } else {
        token = await user.services.resume.loginTokens.find(token => token.token === options.resume);
        oldUnhashedStyleToken = true;
      }
      const tokenExpires = accounts._tokenExpiration(token.when);
      if (new Date() >= tokenExpires) return {
        userId: user._id,
        error: new Meteor.Error(403, "Your session has expired. Please log in again.")
      };

      // Update to a hashed token when an unhashed token is encountered.
      if (oldUnhashedStyleToken) {
        // Only add the new hashed token if the old unhashed token still
        // exists (this avoids resurrecting the token if it was deleted
        // after we read it).  Using $addToSet avoids getting an index
        // error if another client logging in simultaneously has already
        // inserted the new hashed token.
        await accounts.users.updateAsync({
          _id: user._id,
          "services.resume.loginTokens.token": options.resume
        }, {
          $addToSet: {
            "services.resume.loginTokens": {
              "hashedToken": hashedToken,
              "when": token.when
            }
          }
        });

        // Remove the old token *after* adding the new, since otherwise
        // another client trying to login between our removing the old and
        // adding the new wouldn't find a token to login with.
        await accounts.users.updateAsync(user._id, {
          $pull: {
            "services.resume.loginTokens": {
              "token": options.resume
            }
          }
        });
      }
      return {
        userId: user._id,
        stampedLoginToken: {
          token: options.resume,
          when: token.when
        }
      };
    };
    const expirePasswordToken = async (accounts, oldestValidDate, tokenFilter, userId) => {
      // boolean value used to determine if this method was called from enroll account workflow
      let isEnroll = false;
      const userFilter = userId ? {
        _id: userId
      } : {};
      // check if this method was called from enroll account workflow
      if (tokenFilter['services.password.enroll.reason']) {
        isEnroll = true;
      }
      let resetRangeOr = {
        $or: [{
          "services.password.reset.when": {
            $lt: oldestValidDate
          }
        }, {
          "services.password.reset.when": {
            $lt: +oldestValidDate
          }
        }]
      };
      if (isEnroll) {
        resetRangeOr = {
          $or: [{
            "services.password.enroll.when": {
              $lt: oldestValidDate
            }
          }, {
            "services.password.enroll.when": {
              $lt: +oldestValidDate
            }
          }]
        };
      }
      const expireFilter = {
        $and: [tokenFilter, resetRangeOr]
      };
      if (isEnroll) {
        await accounts.users.updateAsync(_objectSpread(_objectSpread({}, userFilter), expireFilter), {
          $unset: {
            "services.password.enroll": ""
          }
        }, {
          multi: true
        });
      } else {
        await accounts.users.updateAsync(_objectSpread(_objectSpread({}, userFilter), expireFilter), {
          $unset: {
            "services.password.reset": ""
          }
        }, {
          multi: true
        });
      }
    };
    const setExpireTokensInterval = accounts => {
      accounts.expireTokenInterval = Meteor.setInterval(async () => {
        await accounts._expireTokens();
        await accounts._expirePasswordResetTokens();
        await accounts._expirePasswordEnrollTokens();
      }, EXPIRE_TOKENS_INTERVAL_MS);
    };
    const OAuthEncryption = (_Package$oauthEncryp = Package["oauth-encryption"]) === null || _Package$oauthEncryp === void 0 ? void 0 : _Package$oauthEncryp.OAuthEncryption;

    // OAuth service data is temporarily stored in the pending credentials
    // collection during the oauth authentication process.  Sensitive data
    // such as access tokens are encrypted without the user id because
    // we don't know the user id yet.  We re-encrypt these fields with the
    // user id included when storing the service data permanently in
    // the users collection.
    //
    const pinEncryptedFieldsToUser = (serviceData, userId) => {
      Object.keys(serviceData).forEach(key => {
        let value = serviceData[key];
        if (OAuthEncryption !== null && OAuthEncryption !== void 0 && OAuthEncryption.isSealed(value)) value = OAuthEncryption.seal(OAuthEncryption.open(value), userId);
        serviceData[key] = value;
      });
    };

    // XXX see comment on Accounts.createUser in passwords_server about adding a
    // second "server options" argument.
    const defaultCreateUserHook = (options, user) => {
      if (options.profile) user.profile = options.profile;
      return user;
    };

    // Validate new user's email or Google/Facebook/GitHub account's email
    function defaultValidateNewUserHook(user) {
      const domain = this._options.restrictCreationByEmailDomain;
      if (!domain) {
        return true;
      }
      let emailIsGood = false;
      if (user.emails && user.emails.length > 0) {
        emailIsGood = user.emails.reduce((prev, email) => prev || this._testEmailDomain(email.address), false);
      } else if (user.services && Object.values(user.services).length > 0) {
        // Find any email of any service and check it
        emailIsGood = Object.values(user.services).reduce((prev, service) => service.email && this._testEmailDomain(service.email), false);
      }
      if (emailIsGood) {
        return true;
      }
      if (typeof domain === 'string') {
        throw new Meteor.Error(403, "@".concat(domain, " email required"));
      } else {
        throw new Meteor.Error(403, "Email doesn't match the criteria.");
      }
    }
    const setupUsersCollection = async users => {
      ///
      /// RESTRICTING WRITES TO USER OBJECTS
      ///
      users.allow({
        // clients can modify the profile field of their own document, and
        // nothing else.
        update: (userId, user, fields, modifier) => {
          // make sure it is our record
          if (user._id !== userId) {
            return false;
          }

          // user can only modify the 'profile' field. sets to multiple
          // sub-keys (eg profile.foo and profile.bar) are merged into entry
          // in the fields list.
          if (fields.length !== 1 || fields[0] !== 'profile') {
            return false;
          }
          return true;
        },
        updateAsync: (userId, user, fields, modifier) => {
          // make sure it is our record
          if (user._id !== userId) {
            return false;
          }

          // user can only modify the 'profile' field. sets to multiple
          // sub-keys (eg profile.foo and profile.bar) are merged into entry
          // in the fields list.
          if (fields.length !== 1 || fields[0] !== 'profile') {
            return false;
          }
          return true;
        },
        fetch: ['_id'] // we only look at _id.
      });

      /// DEFAULT INDEXES ON USERS
      await users.createIndexAsync('username', {
        unique: true,
        sparse: true
      });
      await users.createIndexAsync('emails.address', {
        unique: true,
        sparse: true
      });
      await users.createIndexAsync('services.resume.loginTokens.hashedToken', {
        unique: true,
        sparse: true
      });
      await users.createIndexAsync('services.resume.loginTokens.token', {
        unique: true,
        sparse: true
      });
      // For taking care of logoutOtherClients calls that crashed before the
      // tokens were deleted.
      await users.createIndexAsync('services.resume.haveLoginTokensToDelete', {
        sparse: true
      });
      // For expiring login tokens
      await users.createIndexAsync("services.resume.loginTokens.when", {
        sparse: true
      });
      // For expiring password tokens
      await users.createIndexAsync('services.password.reset.when', {
        sparse: true
      });
      await users.createIndexAsync('services.password.enroll.when', {
        sparse: true
      });
    };

    // Generates permutations of all case variations of a given string.
    const generateCasePermutationsForString = string => {
      let permutations = [''];
      for (let i = 0; i < string.length; i++) {
        const ch = string.charAt(i);
        permutations = [].concat(...permutations.map(prefix => {
          const lowerCaseChar = ch.toLowerCase();
          const upperCaseChar = ch.toUpperCase();
          // Don't add unnecessary permutations when ch is not a letter
          if (lowerCaseChar === upperCaseChar) {
            return [prefix + ch];
          } else {
            return [prefix + lowerCaseChar, prefix + upperCaseChar];
          }
        }));
      }
      return permutations;
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

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      Accounts: Accounts
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/accounts-base/server_main.js"
  ],
  mainModulePath: "/node_modules/meteor/accounts-base/server_main.js"
}});

//# sourceURL=meteor://💻app/packages/accounts-base.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYWNjb3VudHMtYmFzZS9zZXJ2ZXJfbWFpbi5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYWNjb3VudHMtYmFzZS9hY2NvdW50c19jb21tb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2FjY291bnRzLWJhc2UvYWNjb3VudHNfc2VydmVyLmpzIl0sIm5hbWVzIjpbIl9vYmplY3RTcHJlYWQiLCJtb2R1bGUxIiwibGluayIsImRlZmF1bHQiLCJ2IiwiX01ldGVvciRzZXR0aW5ncyRwYWNrIiwiX01ldGVvciRzZXR0aW5ncyRwYWNrMiIsImV4cG9ydCIsIkFjY291bnRzU2VydmVyIiwiX19yZWlmeVdhaXRGb3JEZXBzX18iLCJBY2NvdW50cyIsIk1ldGVvciIsInNlcnZlciIsInNldHRpbmdzIiwicGFja2FnZXMiLCJhY2NvdW50cyIsImluaXQiLCJ0aGVuIiwidXNlcnMiLCJfX3JlaWZ5X2FzeW5jX3Jlc3VsdF9fIiwiX3JlaWZ5RXJyb3IiLCJzZWxmIiwiYXN5bmMiLCJtb2R1bGUiLCJBY2NvdW50c0NvbW1vbiIsIkVYUElSRV9UT0tFTlNfSU5URVJWQUxfTVMiLCJWQUxJRF9DT05GSUdfS0VZUyIsImNvbnN0cnVjdG9yIiwib3B0aW9ucyIsImtleSIsIk9iamVjdCIsImtleXMiLCJpbmNsdWRlcyIsImNvbnNvbGUiLCJlcnJvciIsImNvbmNhdCIsIl9vcHRpb25zIiwiY29ubmVjdGlvbiIsInVuZGVmaW5lZCIsIl9pbml0Q29ubmVjdGlvbiIsIl9pbml0aWFsaXplQ29sbGVjdGlvbiIsIl9vbkxvZ2luSG9vayIsIkhvb2siLCJiaW5kRW52aXJvbm1lbnQiLCJkZWJ1Z1ByaW50RXhjZXB0aW9ucyIsIl9vbkxvZ2luRmFpbHVyZUhvb2siLCJfb25Mb2dvdXRIb29rIiwiREVGQVVMVF9MT0dJTl9FWFBJUkFUSU9OX0RBWVMiLCJMT0dJTl9VTkVYUElSSU5HX1RPS0VOX0RBWVMiLCJsY2VOYW1lIiwiTG9naW5DYW5jZWxsZWRFcnJvciIsIm1ha2VFcnJvclR5cGUiLCJkZXNjcmlwdGlvbiIsIm1lc3NhZ2UiLCJwcm90b3R5cGUiLCJuYW1lIiwibnVtZXJpY0Vycm9yIiwiY29sbGVjdGlvbiIsIk1vbmdvIiwiQ29sbGVjdGlvbiIsIkVycm9yIiwiY29sbGVjdGlvbk5hbWUiLCJfcHJldmVudEF1dG9wdWJsaXNoIiwidXNlcklkIiwiX2FkZERlZmF1bHRGaWVsZFNlbGVjdG9yIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwiZGVmYXVsdEZpZWxkU2VsZWN0b3IiLCJmaWVsZHMiLCJrZXlzMiIsInVzZXIiLCJpc1NlcnZlciIsIndhcm4iLCJqb2luIiwiZmluZE9uZSIsImlzQ2xpZW50IiwiZmluZE9uZUFzeW5jIiwidXNlckFzeW5jIiwiY29uZmlnIiwiX19tZXRlb3JfcnVudGltZV9jb25maWdfXyIsImFjY291bnRzQ29uZmlnQ2FsbGVkIiwiX2RlYnVnIiwiaGFzT3duUHJvcGVydHkiLCJjYWxsIiwiUGFja2FnZSIsIk9BdXRoRW5jcnlwdGlvbiIsImxvYWRLZXkiLCJvYXV0aFNlY3JldEtleSIsImlzVGVzdCIsIl9uYW1lIiwib25Mb2dpbiIsImZ1bmMiLCJyZXQiLCJyZWdpc3RlciIsIl9zdGFydHVwQ2FsbGJhY2siLCJjYWxsYmFjayIsIm9uTG9naW5GYWlsdXJlIiwib25Mb2dvdXQiLCJkZHBVcmwiLCJERFAiLCJjb25uZWN0IiwiQUNDT1VOVFNfQ09OTkVDVElPTl9VUkwiLCJfZ2V0VG9rZW5MaWZldGltZU1zIiwibG9naW5FeHBpcmF0aW9uSW5EYXlzIiwibG9naW5FeHBpcmF0aW9uIiwiX2dldFBhc3N3b3JkUmVzZXRUb2tlbkxpZmV0aW1lTXMiLCJwYXNzd29yZFJlc2V0VG9rZW5FeHBpcmF0aW9uIiwicGFzc3dvcmRSZXNldFRva2VuRXhwaXJhdGlvbkluRGF5cyIsIkRFRkFVTFRfUEFTU1dPUkRfUkVTRVRfVE9LRU5fRVhQSVJBVElPTl9EQVlTIiwiX2dldFBhc3N3b3JkRW5yb2xsVG9rZW5MaWZldGltZU1zIiwicGFzc3dvcmRFbnJvbGxUb2tlbkV4cGlyYXRpb24iLCJwYXNzd29yZEVucm9sbFRva2VuRXhwaXJhdGlvbkluRGF5cyIsIkRFRkFVTFRfUEFTU1dPUkRfRU5ST0xMX1RPS0VOX0VYUElSQVRJT05fREFZUyIsIl90b2tlbkV4cGlyYXRpb24iLCJ3aGVuIiwiRGF0ZSIsImdldFRpbWUiLCJfdG9rZW5FeHBpcmVzU29vbiIsIm1pbkxpZmV0aW1lTXMiLCJtaW5MaWZldGltZUNhcE1zIiwiTUlOX1RPS0VOX0xJRkVUSU1FX0NBUF9TRUNTIiwiX29iamVjdFdpdGhvdXRQcm9wZXJ0aWVzIiwiX2FzeW5jSXRlcmF0b3IiLCJfUGFja2FnZSRvYXV0aEVuY3J5cCIsIl9leGNsdWRlZCIsImNyeXB0byIsIlVSTCIsImhhc093biIsIk5vbkVtcHR5U3RyaW5nIiwiTWF0Y2giLCJXaGVyZSIsIngiLCJjaGVjayIsIlN0cmluZyIsIl90aGlzIiwidGhpcyIsIm9uQ3JlYXRlTG9naW5Ub2tlbiIsIl9vbkNyZWF0ZUxvZ2luVG9rZW5Ib29rIiwiX3NlbGVjdG9yRm9yRmFzdENhc2VJbnNlbnNpdGl2ZUxvb2t1cCIsImZpZWxkTmFtZSIsInN0cmluZyIsInByZWZpeCIsInN1YnN0cmluZyIsIk1hdGgiLCJtaW4iLCJvckNsYXVzZSIsImdlbmVyYXRlQ2FzZVBlcm11dGF0aW9uc0ZvclN0cmluZyIsIm1hcCIsInByZWZpeFBlcm11dGF0aW9uIiwic2VsZWN0b3IiLCJSZWdFeHAiLCJfZXNjYXBlUmVnRXhwIiwiY2FzZUluc2Vuc2l0aXZlQ2xhdXNlIiwiJGFuZCIsIiRvciIsIl9maW5kVXNlckJ5UXVlcnkiLCJxdWVyeSIsImlkIiwiZmllbGRWYWx1ZSIsInVzZXJuYW1lIiwiZW1haWwiLCJjYW5kaWRhdGVVc2VycyIsImZpbmQiLCJsaW1pdCIsImZldGNoQXN5bmMiLCJfaGFuZGxlRXJyb3IiLCJtc2ciLCJfdGhpcyRfb3B0aW9ucyRhbWJpZ3UiLCJ0aHJvd0Vycm9yIiwiZXJyb3JDb2RlIiwiaXNFcnJvckFtYmlndW91cyIsImFtYmlndW91c0Vycm9yTWVzc2FnZXMiLCJfdXNlclF1ZXJ5VmFsaWRhdG9yIiwiT3B0aW9uYWwiLCJfc2VydmVyIiwiX2luaXRTZXJ2ZXJNZXRob2RzIiwiX2luaXRBY2NvdW50RGF0YUhvb2tzIiwiX2F1dG9wdWJsaXNoRmllbGRzIiwibG9nZ2VkSW5Vc2VyIiwib3RoZXJVc2VycyIsIl9kZWZhdWx0UHVibGlzaEZpZWxkcyIsInByb2plY3Rpb24iLCJwcm9maWxlIiwiZW1haWxzIiwiX2luaXRTZXJ2ZXJQdWJsaWNhdGlvbnMiLCJfYWNjb3VudERhdGEiLCJfdXNlck9ic2VydmVzRm9yQ29ubmVjdGlvbnMiLCJfbmV4dFVzZXJPYnNlcnZlTnVtYmVyIiwiX2xvZ2luSGFuZGxlcnMiLCJzZXR1cERlZmF1bHRMb2dpbkhhbmRsZXJzIiwic2V0RXhwaXJlVG9rZW5zSW50ZXJ2YWwiLCJfdmFsaWRhdGVMb2dpbkhvb2siLCJfdmFsaWRhdGVOZXdVc2VySG9va3MiLCJkZWZhdWx0VmFsaWRhdGVOZXdVc2VySG9vayIsImJpbmQiLCJfZGVsZXRlU2F2ZWRUb2tlbnNGb3JBbGxVc2Vyc09uU3RhcnR1cCIsIl9za2lwQ2FzZUluc2Vuc2l0aXZlQ2hlY2tzRm9yVGVzdCIsInVybHMiLCJyZXNldFBhc3N3b3JkIiwidG9rZW4iLCJleHRyYVBhcmFtcyIsImJ1aWxkRW1haWxVcmwiLCJ2ZXJpZnlFbWFpbCIsImxvZ2luVG9rZW4iLCJlbnJvbGxBY2NvdW50IiwiYWRkRGVmYXVsdFJhdGVMaW1pdCIsInBhdGgiLCJ1cmwiLCJhYnNvbHV0ZVVybCIsInBhcmFtcyIsImVudHJpZXMiLCJ2YWx1ZSIsInNlYXJjaFBhcmFtcyIsImFwcGVuZCIsInRvU3RyaW5nIiwiY3VycmVudEludm9jYXRpb24iLCJfQ3VycmVudE1ldGhvZEludm9jYXRpb24iLCJnZXQiLCJfQ3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbiIsInNldHVwVXNlcnNDb2xsZWN0aW9uIiwidmFsaWRhdGVMb2dpbkF0dGVtcHQiLCJ2YWxpZGF0ZU5ld1VzZXIiLCJwdXNoIiwiYmVmb3JlRXh0ZXJuYWxMb2dpbiIsIl9iZWZvcmVFeHRlcm5hbExvZ2luSG9vayIsIm9uQ3JlYXRlVXNlciIsIl9vbkNyZWF0ZVVzZXJIb29rIiwid3JhcEZuIiwib25FeHRlcm5hbExvZ2luIiwiX29uRXh0ZXJuYWxMb2dpbkhvb2siLCJzZXRBZGRpdGlvbmFsRmluZFVzZXJPbkV4dGVybmFsTG9naW4iLCJfYWRkaXRpb25hbEZpbmRVc2VyT25FeHRlcm5hbExvZ2luIiwiX3ZhbGlkYXRlTG9naW4iLCJhdHRlbXB0IiwiZm9yRWFjaEFzeW5jIiwiY2xvbmVBdHRlbXB0V2l0aENvbm5lY3Rpb24iLCJlIiwiYWxsb3dlZCIsIl9zdWNjZXNzZnVsTG9naW4iLCJfZmFpbGVkTG9naW4iLCJfc3VjY2Vzc2Z1bExvZ291dCIsIl9sb2dpblVzZXIiLCJtZXRob2RJbnZvY2F0aW9uIiwic3RhbXBlZExvZ2luVG9rZW4iLCJfZ2VuZXJhdGVTdGFtcGVkTG9naW5Ub2tlbiIsIl9pbnNlcnRMb2dpblRva2VuIiwiX25vWWllbGRzQWxsb3dlZCIsIl9zZXRMb2dpblRva2VuIiwiX2hhc2hMb2dpblRva2VuIiwic2V0VXNlcklkIiwidG9rZW5FeHBpcmVzIiwiX2F0dGVtcHRMb2dpbiIsIm1ldGhvZE5hbWUiLCJtZXRob2RBcmdzIiwicmVzdWx0IiwidHlwZSIsIm1ldGhvZEFyZ3VtZW50cyIsIkFycmF5IiwiZnJvbSIsIm8iLCJfbG9naW5NZXRob2QiLCJmbiIsInRyeUxvZ2luTWV0aG9kIiwiX3JlcG9ydExvZ2luRmFpbHVyZSIsInJlZ2lzdGVyTG9naW5IYW5kbGVyIiwiaGFuZGxlciIsIl9ydW5Mb2dpbkhhbmRsZXJzIiwiZGVzdHJveVRva2VuIiwidXBkYXRlQXN5bmMiLCIkcHVsbCIsImhhc2hlZFRva2VuIiwibWV0aG9kcyIsImxvZ2luIiwibG9nb3V0IiwiX2dldExvZ2luVG9rZW4iLCJnZXROZXdUb2tlbiIsImN1cnJlbnRIYXNoZWRUb2tlbiIsImN1cnJlbnRTdGFtcGVkVG9rZW4iLCJzZXJ2aWNlcyIsInJlc3VtZSIsImxvZ2luVG9rZW5zIiwic3RhbXBlZFRva2VuIiwibmV3U3RhbXBlZFRva2VuIiwicmVtb3ZlT3RoZXJUb2tlbnMiLCJjdXJyZW50VG9rZW4iLCIkbmUiLCJjb25maWd1cmVMb2dpblNlcnZpY2UiLCJPYmplY3RJbmNsdWRpbmciLCJzZXJ2aWNlIiwib2F1dGgiLCJzZXJ2aWNlTmFtZXMiLCJTZXJ2aWNlQ29uZmlndXJhdGlvbiIsImNvbmZpZ3VyYXRpb25zIiwia2V5SXNMb2FkZWQiLCJzZWNyZXQiLCJzZWFsIiwiaW5zZXJ0QXN5bmMiLCJvbkNvbm5lY3Rpb24iLCJvbkNsb3NlIiwiX3JlbW92ZVRva2VuRnJvbUNvbm5lY3Rpb24iLCJwdWJsaXNoIiwicmVhZHkiLCJpc19hdXRvIiwic3RhcnR1cCIsImN1c3RvbUZpZWxkcyIsIl9pZCIsImF1dG9wdWJsaXNoIiwidG9GaWVsZFNlbGVjdG9yIiwicmVkdWNlIiwicHJldiIsImZpZWxkIiwiYWRkQXV0b3B1Ymxpc2hGaWVsZHMiLCJvcHRzIiwiYXBwbHkiLCJmb3JMb2dnZWRJblVzZXIiLCJmb3JPdGhlclVzZXJzIiwic2V0RGVmYXVsdFB1Ymxpc2hGaWVsZHMiLCJfZ2V0QWNjb3VudERhdGEiLCJjb25uZWN0aW9uSWQiLCJkYXRhIiwiX3NldEFjY291bnREYXRhIiwiaGFzaCIsImNyZWF0ZUhhc2giLCJ1cGRhdGUiLCJkaWdlc3QiLCJfaGFzaFN0YW1wZWRUb2tlbiIsImhhc2hlZFN0YW1wZWRUb2tlbiIsIl9pbnNlcnRIYXNoZWRMb2dpblRva2VuIiwiJGFkZFRvU2V0IiwiX2NsZWFyQWxsTG9naW5Ub2tlbnMiLCIkc2V0IiwiX2dldFVzZXJPYnNlcnZlIiwib2JzZXJ2ZSIsInN0b3AiLCJuZXdUb2tlbiIsIm15T2JzZXJ2ZU51bWJlciIsImRlZmVyIiwiZm91bmRNYXRjaGluZ1VzZXIiLCJvYnNlcnZlQ2hhbmdlcyIsImFkZGVkIiwicmVtb3ZlZCIsImNsb3NlIiwibm9uTXV0YXRpbmdDYWxsYmFja3MiLCJSYW5kb20iLCJfZXhwaXJlUGFzc3dvcmRSZXNldFRva2VucyIsIm9sZGVzdFZhbGlkRGF0ZSIsInRva2VuTGlmZXRpbWVNcyIsInRva2VuRmlsdGVyIiwiJGV4aXN0cyIsImV4cGlyZVBhc3N3b3JkVG9rZW4iLCJfZXhwaXJlUGFzc3dvcmRFbnJvbGxUb2tlbnMiLCJfZXhwaXJlVG9rZW5zIiwidXNlckZpbHRlciIsIiRsdCIsIm11bHRpIiwic3VwZXJSZXN1bHQiLCJleHBpcmVUb2tlbkludGVydmFsIiwiY2xlYXJJbnRlcnZhbCIsImluc2VydFVzZXJEb2MiLCJjcmVhdGVkQXQiLCJmb3JFYWNoIiwicGluRW5jcnlwdGVkRmllbGRzVG9Vc2VyIiwiZnVsbFVzZXIiLCJkZWZhdWx0Q3JlYXRlVXNlckhvb2siLCJfaXRlcmF0b3JBYnJ1cHRDb21wbGV0aW9uIiwiX2RpZEl0ZXJhdG9yRXJyb3IiLCJfaXRlcmF0b3JFcnJvciIsIl9pdGVyYXRvciIsIl9zdGVwIiwibmV4dCIsImRvbmUiLCJob29rIiwiZXJyIiwicmV0dXJuIiwiZXJybXNnIiwiX3Rlc3RFbWFpbERvbWFpbiIsImRvbWFpbiIsInJlc3RyaWN0Q3JlYXRpb25CeUVtYWlsRG9tYWluIiwidGVzdCIsIl9kZWxldGVTYXZlZFRva2Vuc0ZvclVzZXIiLCJ0b2tlbnNUb0RlbGV0ZSIsIiR1bnNldCIsIiRwdWxsQWxsIiwibG9naW5Ub2tlbnNUb0RlbGV0ZSIsIl8iLCJjYXRjaCIsImxvZyIsInVwZGF0ZU9yQ3JlYXRlVXNlckZyb21FeHRlcm5hbFNlcnZpY2UiLCJzZXJ2aWNlTmFtZSIsInNlcnZpY2VEYXRhIiwic2VydmljZUlkS2V5IiwiaXNOYU4iLCJwYXJzZUludCIsInNldEF0dHJzIiwicmVtb3ZlRGVmYXVsdFJhdGVMaW1pdCIsInJlc3AiLCJERFBSYXRlTGltaXRlciIsInJlbW92ZVJ1bGUiLCJkZWZhdWx0UmF0ZUxpbWl0ZXJSdWxlSWQiLCJhZGRSdWxlIiwiY2xpZW50QWRkcmVzcyIsImdlbmVyYXRlT3B0aW9uc0ZvckVtYWlsIiwicmVhc29uIiwiZXh0cmEiLCJ0byIsImVtYWlsVGVtcGxhdGVzIiwic3ViamVjdCIsInRleHQiLCJodG1sIiwiaGVhZGVycyIsIl9jaGVja0ZvckNhc2VJbnNlbnNpdGl2ZUR1cGxpY2F0ZXMiLCJkaXNwbGF5TmFtZSIsIm93blVzZXJJZCIsInNraXBDaGVjayIsIm1hdGNoZWRVc2VycyIsIl9jcmVhdGVVc2VyQ2hlY2tpbmdEdXBsaWNhdGVzIiwiX3JlZiIsIm5ld1VzZXIiLCJhZGRyZXNzIiwidmVyaWZpZWQiLCJleCIsInJlbW92ZUFzeW5jIiwiY2xvbmVkQXR0ZW1wdCIsIkVKU09OIiwiY2xvbmUiLCJkZWZhdWx0UmVzdW1lTG9naW5IYW5kbGVyIiwib2xkVW5oYXNoZWRTdHlsZVRva2VuIiwiaXNFbnJvbGwiLCJyZXNldFJhbmdlT3IiLCJleHBpcmVGaWx0ZXIiLCJzZXRJbnRlcnZhbCIsImlzU2VhbGVkIiwib3BlbiIsImVtYWlsSXNHb29kIiwidmFsdWVzIiwiYWxsb3ciLCJtb2RpZmllciIsImZldGNoIiwiY3JlYXRlSW5kZXhBc3luYyIsInVuaXF1ZSIsInNwYXJzZSIsInBlcm11dGF0aW9ucyIsImkiLCJjaCIsImNoYXJBdCIsImxvd2VyQ2FzZUNoYXIiLCJ0b0xvd2VyQ2FzZSIsInVwcGVyQ2FzZUNoYXIiLCJ0b1VwcGVyQ2FzZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFBQSxJQUFJQSxhQUFhO0lBQUNDLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLHNDQUFzQyxFQUFDO01BQUNDLE9BQU9BLENBQUNDLENBQUMsRUFBQztRQUFDSixhQUFhLEdBQUNJLENBQUM7TUFBQTtJQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBQyxJQUFBQyxxQkFBQSxFQUFBQyxzQkFBQTtJQUF2R0wsT0FBTyxDQUFDTSxNQUFNLENBQUM7TUFBQ0MsY0FBYyxFQUFDQSxDQUFBLEtBQUlBO0lBQWMsQ0FBQyxDQUFDO0lBQUMs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UUFDdEMsTUFBTUMsRUFBRSxHQUFHL1MsTUFBTSxDQUFDZ1QsTUFBTSxDQUFDRixDQUFDLENBQUM7UUFDM0JELFlBQVksR0FBRyxFQUFFLENBQUN0WixNQUFNLENBQUMsR0FBSXNaLFlBQVksQ0FBQ3RTLEdBQUcsQ0FBQ04sTUFBTSxJQUFJO1VBQ3RELE1BQU1nVCxhQUFhLEdBQUdGLEVBQUUsQ0FBQ0csV0FBVyxDQUFDLENBQUM7VUFDdEMsTUFBTUMsYUFBYSxHQUFHSixFQUFFLENBQUNLLFdBQVcsQ0FBQyxDQUFDO1VBQ3RDO1VBQ0EsSUFBSUgsYUFBYSxLQUFLRSxhQUFhLEVBQUU7WUFDbkMsT0FBTyxDQUFDbFQsTUFBTSxHQUFHOFMsRUFBRSxDQUFDO1VBQ3RCLENBQUMsTUFBTTtZQUNMLE9BQU8sQ0FBQzlTLE1BQU0sR0FBR2dULGFBQWEsRUFBRWhULE1BQU0sR0FBR2tULGFBQWEsQ0FBQztVQUN6RDtRQUNGLENBQUMsQ0FBRSxDQUFDO01BQ047TUFDQSxPQUFPTixZQUFZO0lBQ3JCLENBQUM7SUFBQXRhLHNCQUFBO0VBQUEsU0FBQUMsV0FBQTtJQUFBLE9BQUFELHNCQUFBLENBQUFDLFdBQUE7RUFBQTtFQUFBRCxzQkFBQTtBQUFBO0VBQUFFLElBQUE7RUFBQUMsS0FBQTtBQUFBLEciLCJmaWxlIjoiL3BhY2thZ2VzL2FjY291bnRzLWJhc2UuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBY2NvdW50c1NlcnZlciB9IGZyb20gXCIuL2FjY291bnRzX3NlcnZlci5qc1wiO1xuXG4vKipcbiAqIEBuYW1lc3BhY2UgQWNjb3VudHNcbiAqIEBzdW1tYXJ5IFRoZSBuYW1lc3BhY2UgZm9yIGFsbCBzZXJ2ZXItc2lkZSBhY2NvdW50cy1yZWxhdGVkIG1ldGhvZHMuXG4gKi9cbkFjY291bnRzID0gbmV3IEFjY291bnRzU2VydmVyKE1ldGVvci5zZXJ2ZXIsIHsgLi4uTWV0ZW9yLnNldHRpbmdzLnBhY2thZ2VzPy5hY2NvdW50cywgLi4uTWV0ZW9yLnNldHRpbmdzLnBhY2thZ2VzPy5bJ2FjY291bnRzLWJhc2UnXSB9KTtcbi8vIFRPRE9bRklCRVJTXTogSSBuZWVkIFRMQVxuQWNjb3VudHMuaW5pdCgpLnRoZW4oKTtcbi8vIFVzZXJzIHRhYmxlLiBEb24ndCB1c2UgdGhlIG5vcm1hbCBhdXRvcHVibGlzaCwgc2luY2Ugd2Ugd2FudCB0byBoaWRlXG4vLyBzb21lIGZpZWxkcy4gQ29kZSB0byBhdXRvcHVibGlzaCB0aGlzIGlzIGluIGFjY291bnRzX3NlcnZlci5qcy5cbi8vIFhYWCBBbGxvdyB1c2VycyB0byBjb25maWd1cmUgdGhpcyBjb2xsZWN0aW9uIG5hbWUuXG5cbi8qKlxuICogQHN1bW1hcnkgQSBbTW9uZ28uQ29sbGVjdGlvbl0oI2NvbGxlY3Rpb25zKSBjb250YWluaW5nIHVzZXIgZG9jdW1lbnRzLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAdHlwZSB7TW9uZ28uQ29sbGVjdGlvbn1cbiAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAqL1xuTWV0ZW9yLnVzZXJzID0gQWNjb3VudHMudXNlcnM7XG5cbmV4cG9ydCB7XG4gIC8vIFNpbmNlIHRoaXMgZmlsZSBpcyB0aGUgbWFpbiBtb2R1bGUgZm9yIHRoZSBzZXJ2ZXIgdmVyc2lvbiBvZiB0aGVcbiAgLy8gYWNjb3VudHMtYmFzZSBwYWNrYWdlLCBwcm9wZXJ0aWVzIG9mIG5vbi1lbnRyeS1wb2ludCBtb2R1bGVzIG5lZWQgdG9cbiAgLy8gYmUgcmUtZXhwb3J0ZWQgaW4gb3JkZXIgdG8gYmUgYWNjZXNzaWJsZSB0byBtb2R1bGVzIHRoYXQgaW1wb3J0IHRoZVxuICAvLyBhY2NvdW50cy1iYXNlIHBhY2thZ2UuXG4gIEFjY291bnRzU2VydmVyXG59O1xuIiwiaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XG5cbi8vIGNvbmZpZyBvcHRpb24ga2V5c1xuY29uc3QgVkFMSURfQ09ORklHX0tFWVMgPSBbXG4gICdzZW5kVmVyaWZpY2F0aW9uRW1haWwnLFxuICAnZm9yYmlkQ2xpZW50QWNjb3VudENyZWF0aW9uJyxcbiAgJ3Jlc3RyaWN0Q3JlYXRpb25CeUVtYWlsRG9tYWluJyxcbiAgJ2xvZ2luRXhwaXJhdGlvbicsXG4gICdsb2dpbkV4cGlyYXRpb25JbkRheXMnLFxuICAnb2F1dGhTZWNyZXRLZXknLFxuICAncGFzc3dvcmRSZXNldFRva2VuRXhwaXJhdGlvbkluRGF5cycsXG4gICdwYXNzd29yZFJlc2V0VG9rZW5FeHBpcmF0aW9uJyxcbiAgJ3Bhc3N3b3JkRW5yb2xsVG9rZW5FeHBpcmF0aW9uSW5EYXlzJyxcbiAgJ3Bhc3N3b3JkRW5yb2xsVG9rZW5FeHBpcmF0aW9uJyxcbiAgJ2FtYmlndW91c0Vycm9yTWVzc2FnZXMnLFxuICAnYmNyeXB0Um91bmRzJyxcbiAgJ2RlZmF1bHRGaWVsZFNlbGVjdG9yJyxcbiAgJ2NvbGxlY3Rpb24nLFxuICAnbG9naW5Ub2tlbkV4cGlyYXRpb25Ib3VycycsXG4gICd0b2tlblNlcXVlbmNlTGVuZ3RoJyxcbiAgJ2NsaWVudFN0b3JhZ2UnLFxuICAnZGRwVXJsJyxcbiAgJ2Nvbm5lY3Rpb24nLFxuXTtcblxuLyoqXG4gKiBAc3VtbWFyeSBTdXBlci1jb25zdHJ1Y3RvciBmb3IgQWNjb3VudHNDbGllbnQgYW5kIEFjY291bnRzU2VydmVyLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAY2xhc3MgQWNjb3VudHNDb21tb25cbiAqIEBpbnN0YW5jZW5hbWUgYWNjb3VudHNDbGllbnRPclNlcnZlclxuICogQHBhcmFtIG9wdGlvbnMge09iamVjdH0gYW4gb2JqZWN0IHdpdGggZmllbGRzOlxuICogLSBjb25uZWN0aW9uIHtPYmplY3R9IE9wdGlvbmFsIEREUCBjb25uZWN0aW9uIHRvIHJldXNlLlxuICogLSBkZHBVcmwge1N0cmluZ30gT3B0aW9uYWwgVVJMIGZvciBjcmVhdGluZyBhIG5ldyBERFAgY29ubmVjdGlvbi5cbiAqIC0gY29sbGVjdGlvbiB7U3RyaW5nfE1vbmdvLkNvbGxlY3Rpb259IFRoZSBuYW1lIG9mIHRoZSBNb25nby5Db2xsZWN0aW9uXG4gKiAgICAgb3IgdGhlIE1vbmdvLkNvbGxlY3Rpb24gb2JqZWN0IHRvIGhvbGQgdGhlIHVzZXJzLlxuICovXG5leHBvcnQgY2xhc3MgQWNjb3VudHNDb21tb24ge1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgLy8gVmFsaWRhdGUgY29uZmlnIG9wdGlvbnMga2V5c1xuICAgIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKG9wdGlvbnMpKSB7XG4gICAgICBpZiAoIVZBTElEX0NPTkZJR19LRVlTLmluY2x1ZGVzKGtleSkpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihgQWNjb3VudHMuY29uZmlnOiBJbnZhbGlkIGtleTogJHtrZXl9YCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ3VycmVudGx5IHRoaXMgaXMgcmVhZCBkaXJlY3RseSBieSBwYWNrYWdlcyBsaWtlIGFjY291bnRzLXBhc3N3b3JkXG4gICAgLy8gYW5kIGFjY291bnRzLXVpLXVuc3R5bGVkLlxuICAgIHRoaXMuX29wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgLy8gTm90ZSB0aGF0IHNldHRpbmcgdGhpcy5jb25uZWN0aW9uID0gbnVsbCBjYXVzZXMgdGhpcy51c2VycyB0byBiZSBhXG4gICAgLy8gTG9jYWxDb2xsZWN0aW9uLCB3aGljaCBpcyBub3Qgd2hhdCB3ZSB3YW50LlxuICAgIHRoaXMuY29ubmVjdGlvbiA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLl9pbml0Q29ubmVjdGlvbihvcHRpb25zIHx8IHt9KTtcblxuICAgIC8vIFRoZXJlIGlzIGFuIGFsbG93IGNhbGwgaW4gYWNjb3VudHNfc2VydmVyLmpzIHRoYXQgcmVzdHJpY3RzIHdyaXRlcyB0b1xuICAgIC8vIHRoaXMgY29sbGVjdGlvbi5cbiAgICB0aGlzLnVzZXJzID0gdGhpcy5faW5pdGlhbGl6ZUNvbGxlY3Rpb24ob3B0aW9ucyB8fCB7fSk7XG5cbiAgICAvLyBDYWxsYmFjayBleGNlcHRpb25zIGFyZSBwcmludGVkIHdpdGggTWV0ZW9yLl9kZWJ1ZyBhbmQgaWdub3JlZC5cbiAgICB0aGlzLl9vbkxvZ2luSG9vayA9IG5ldyBIb29rKHtcbiAgICAgIGJpbmRFbnZpcm9ubWVudDogZmFsc2UsXG4gICAgICBkZWJ1Z1ByaW50RXhjZXB0aW9uczogJ29uTG9naW4gY2FsbGJhY2snLFxuICAgIH0pO1xuXG4gICAgdGhpcy5fb25Mb2dpbkZhaWx1cmVIb29rID0gbmV3IEhvb2soe1xuICAgICAgYmluZEVudmlyb25tZW50OiBmYWxzZSxcbiAgICAgIGRlYnVnUHJpbnRFeGNlcHRpb25zOiAnb25Mb2dpbkZhaWx1cmUgY2FsbGJhY2snLFxuICAgIH0pO1xuXG4gICAgdGhpcy5fb25Mb2dvdXRIb29rID0gbmV3IEhvb2soe1xuICAgICAgYmluZEVudmlyb25tZW50OiBmYWxzZSxcbiAgICAgIGRlYnVnUHJpbnRFeGNlcHRpb25zOiAnb25Mb2dvdXQgY2FsbGJhY2snLFxuICAgIH0pO1xuXG4gICAgLy8gRXhwb3NlIGZvciB0ZXN0aW5nLlxuICAgIHRoaXMuREVGQVVMVF9MT0dJTl9FWFBJUkFUSU9OX0RBWVMgPSBERUZBVUxUX0xPR0lOX0VYUElSQVRJT05fREFZUztcbiAgICB0aGlzLkxPR0lOX1VORVhQSVJJTkdfVE9LRU5fREFZUyA9IExPR0lOX1VORVhQSVJJTkdfVE9LRU5fREFZUztcblxuICAgIC8vIFRocm93biB3aGVuIHRoZSB1c2VyIGNhbmNlbHMgdGhlIGxvZ2luIHByb2Nlc3MgKGVnLCBjbG9zZXMgYW4gb2F1dGhcbiAgICAvLyBwb3B1cCwgZGVjbGluZXMgcmV0aW5hIHNjYW4sIGV0YylcbiAgICBjb25zdCBsY2VOYW1lID0gJ0FjY291bnRzLkxvZ2luQ2FuY2VsbGVkRXJyb3InO1xuICAgIHRoaXMuTG9naW5DYW5jZWxsZWRFcnJvciA9IE1ldGVvci5tYWtlRXJyb3JUeXBlKGxjZU5hbWUsIGZ1bmN0aW9uKFxuICAgICAgZGVzY3JpcHRpb25cbiAgICApIHtcbiAgICAgIHRoaXMubWVzc2FnZSA9IGRlc2NyaXB0aW9uO1xuICAgIH0pO1xuICAgIHRoaXMuTG9naW5DYW5jZWxsZWRFcnJvci5wcm90b3R5cGUubmFtZSA9IGxjZU5hbWU7XG5cbiAgICAvLyBUaGlzIGlzIHVzZWQgdG8gdHJhbnNtaXQgc3BlY2lmaWMgc3ViY2xhc3MgZXJyb3JzIG92ZXIgdGhlIHdpcmUuIFdlXG4gICAgLy8gc2hvdWxkIGNvbWUgdXAgd2l0aCBhIG1vcmUgZ2VuZXJpYyB3YXkgdG8gZG8gdGhpcyAoZWcsIHdpdGggc29tZSBzb3J0IG9mXG4gICAgLy8gc3ltYm9saWMgZXJyb3IgY29kZSByYXRoZXIgdGhhbiBhIG51bWJlcikuXG4gICAgdGhpcy5Mb2dpbkNhbmNlbGxlZEVycm9yLm51bWVyaWNFcnJvciA9IDB4OGFjZGMyZjtcbiAgfVxuXG4gIF9pbml0aWFsaXplQ29sbGVjdGlvbihvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuY29sbGVjdGlvbiAmJiB0eXBlb2Ygb3B0aW9ucy5jb2xsZWN0aW9uICE9PSAnc3RyaW5nJyAmJiAhKG9wdGlvbnMuY29sbGVjdGlvbiBpbnN0YW5jZW9mIE1vbmdvLkNvbGxlY3Rpb24pKSB7XG4gICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdDb2xsZWN0aW9uIHBhcmFtZXRlciBjYW4gYmUgb25seSBvZiB0eXBlIHN0cmluZyBvciBcIk1vbmdvLkNvbGxlY3Rpb25cIicpO1xuICAgIH1cblxuICAgIGxldCBjb2xsZWN0aW9uTmFtZSA9ICd1c2Vycyc7XG4gICAgaWYgKHR5cGVvZiBvcHRpb25zLmNvbGxlY3Rpb24gPT09ICdzdHJpbmcnKSB7XG4gICAgICBjb2xsZWN0aW9uTmFtZSA9IG9wdGlvbnMuY29sbGVjdGlvbjtcbiAgICB9XG5cbiAgICBsZXQgY29sbGVjdGlvbjtcbiAgICBpZiAob3B0aW9ucy5jb2xsZWN0aW9uIGluc3RhbmNlb2YgTW9uZ28uQ29sbGVjdGlvbikge1xuICAgICAgY29sbGVjdGlvbiA9IG9wdGlvbnMuY29sbGVjdGlvbjtcbiAgICB9IGVsc2Uge1xuICAgICAgY29sbGVjdGlvbiA9IG5ldyBNb25nby5Db2xsZWN0aW9uKGNvbGxlY3Rpb25OYW1lLCB7XG4gICAgICAgIF9wcmV2ZW50QXV0b3B1Ymxpc2g6IHRydWUsXG4gICAgICAgIGNvbm5lY3Rpb246IHRoaXMuY29ubmVjdGlvbixcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBjb2xsZWN0aW9uO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEdldCB0aGUgY3VycmVudCB1c2VyIGlkLCBvciBgbnVsbGAgaWYgbm8gdXNlciBpcyBsb2dnZWQgaW4uIEEgcmVhY3RpdmUgZGF0YSBzb3VyY2UuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKi9cbiAgdXNlcklkKCkge1xuICAgIHRocm93IG5ldyBFcnJvcigndXNlcklkIG1ldGhvZCBub3QgaW1wbGVtZW50ZWQnKTtcbiAgfVxuXG4gIC8vIG1lcmdlIHRoZSBkZWZhdWx0RmllbGRTZWxlY3RvciB3aXRoIGFuIGV4aXN0aW5nIG9wdGlvbnMgb2JqZWN0XG4gIF9hZGREZWZhdWx0RmllbGRTZWxlY3RvcihvcHRpb25zID0ge30pIHtcbiAgICAvLyB0aGlzIHdpbGwgYmUgdGhlIG1vc3QgY29tbW9uIGNhc2UgZm9yIG1vc3QgcGVvcGxlLCBzbyBtYWtlIGl0IHF1aWNrXG4gICAgaWYgKCF0aGlzLl9vcHRpb25zLmRlZmF1bHRGaWVsZFNlbGVjdG9yKSByZXR1cm4gb3B0aW9ucztcblxuICAgIC8vIGlmIG5vIGZpZWxkIHNlbGVjdG9yIHRoZW4ganVzdCB1c2UgZGVmYXVsdEZpZWxkU2VsZWN0b3JcbiAgICBpZiAoIW9wdGlvbnMuZmllbGRzKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgZmllbGRzOiB0aGlzLl9vcHRpb25zLmRlZmF1bHRGaWVsZFNlbGVjdG9yLFxuICAgICAgfTtcblxuICAgIC8vIGlmIGVtcHR5IGZpZWxkIHNlbGVjdG9yIHRoZW4gdGhlIGZ1bGwgdXNlciBvYmplY3QgaXMgZXhwbGljaXRseSByZXF1ZXN0ZWQsIHNvIG9iZXlcbiAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMob3B0aW9ucy5maWVsZHMpO1xuICAgIGlmICgha2V5cy5sZW5ndGgpIHJldHVybiBvcHRpb25zO1xuXG4gICAgLy8gaWYgdGhlIHJlcXVlc3RlZCBmaWVsZHMgYXJlICt2ZSB0aGVuIGlnbm9yZSBkZWZhdWx0RmllbGRTZWxlY3RvclxuICAgIC8vIGFzc3VtZSB0aGV5IGFyZSBhbGwgZWl0aGVyICt2ZSBvciAtdmUgYmVjYXVzZSBNb25nbyBkb2Vzbid0IGxpa2UgbWl4ZWRcbiAgICBpZiAoISFvcHRpb25zLmZpZWxkc1trZXlzWzBdXSkgcmV0dXJuIG9wdGlvbnM7XG5cbiAgICAvLyBUaGUgcmVxdWVzdGVkIGZpZWxkcyBhcmUgLXZlLlxuICAgIC8vIElmIHRoZSBkZWZhdWx0RmllbGRTZWxlY3RvciBpcyArdmUgdGhlbiB1c2UgcmVxdWVzdGVkIGZpZWxkcywgb3RoZXJ3aXNlIG1lcmdlIHRoZW1cbiAgICBjb25zdCBrZXlzMiA9IE9iamVjdC5rZXlzKHRoaXMuX29wdGlvbnMuZGVmYXVsdEZpZWxkU2VsZWN0b3IpO1xuICAgIHJldHVybiB0aGlzLl9vcHRpb25zLmRlZmF1bHRGaWVsZFNlbGVjdG9yW2tleXMyWzBdXVxuICAgICAgPyBvcHRpb25zXG4gICAgICA6IHtcbiAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgIGZpZWxkczoge1xuICAgICAgICAgICAgLi4ub3B0aW9ucy5maWVsZHMsXG4gICAgICAgICAgICAuLi50aGlzLl9vcHRpb25zLmRlZmF1bHRGaWVsZFNlbGVjdG9yLFxuICAgICAgICAgIH0sXG4gICAgICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgR2V0IHRoZSBjdXJyZW50IHVzZXIgcmVjb3JkLCBvciBgbnVsbGAgaWYgbm8gdXNlciBpcyBsb2dnZWQgaW4uIEEgcmVhY3RpdmUgZGF0YSBzb3VyY2UuIEluIHRoZSBzZXJ2ZXIgdGhpcyBmdWN0aW9uIHJldHVybnMgYSBwcm9taXNlLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiBAcGFyYW0ge01vbmdvRmllbGRTcGVjaWZpZXJ9IG9wdGlvbnMuZmllbGRzIERpY3Rpb25hcnkgb2YgZmllbGRzIHRvIHJldHVybiBvciBleGNsdWRlLlxuICAgKi9cbiAgdXNlcihvcHRpb25zKSB7XG4gICAgaWYgKE1ldGVvci5pc1NlcnZlcikge1xuICAgICAgY29uc29sZS53YXJuKFtcbiAgICAgICAgXCJgTWV0ZW9yLnVzZXIoKWAgaXMgZGVwcmVjYXRlZCBvbiB0aGUgc2VydmVyIHNpZGUuXCIsXG4gICAgICAgIFwiICAgIFRvIGZldGNoIHRoZSBjdXJyZW50IHVzZXIgcmVjb3JkIG9uIHRoZSBzZXJ2ZXIsXCIsXG4gICAgICAgIFwiICAgIHVzZSBgTWV0ZW9yLnVzZXJBc3luYygpYCBpbnN0ZWFkLlwiLFxuICAgICAgXS5qb2luKFwiXFxuXCIpKTtcbiAgICB9XG5cbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBjb25zdCB1c2VySWQgPSBzZWxmLnVzZXJJZCgpO1xuICAgIGNvbnN0IGZpbmRPbmUgPSAoLi4uYXJncykgPT4gTWV0ZW9yLmlzQ2xpZW50XG4gICAgICA/IHNlbGYudXNlcnMuZmluZE9uZSguLi5hcmdzKVxuICAgICAgOiBzZWxmLnVzZXJzLmZpbmRPbmVBc3luYyguLi5hcmdzKTtcbiAgICByZXR1cm4gdXNlcklkXG4gICAgICA/IGZpbmRPbmUodXNlcklkLCB0aGlzLl9hZGREZWZhdWx0RmllbGRTZWxlY3RvcihvcHRpb25zKSlcbiAgICAgIDogbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBHZXQgdGhlIGN1cnJlbnQgdXNlciByZWNvcmQsIG9yIGBudWxsYCBpZiBubyB1c2VyIGlzIGxvZ2dlZCBpbi5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtNb25nb0ZpZWxkU3BlY2lmaWVyfSBvcHRpb25zLmZpZWxkcyBEaWN0aW9uYXJ5IG9mIGZpZWxkcyB0byByZXR1cm4gb3IgZXhjbHVkZS5cbiAgICovXG4gIGFzeW5jIHVzZXJBc3luYyhvcHRpb25zKSB7XG4gICAgY29uc3QgdXNlcklkID0gdGhpcy51c2VySWQoKTtcbiAgICByZXR1cm4gdXNlcklkXG4gICAgICA/IHRoaXMudXNlcnMuZmluZE9uZUFzeW5jKHVzZXJJZCwgdGhpcy5fYWRkRGVmYXVsdEZpZWxkU2VsZWN0b3Iob3B0aW9ucykpXG4gICAgICA6IG51bGw7XG4gIH1cbiAgLy8gU2V0IHVwIGNvbmZpZyBmb3IgdGhlIGFjY291bnRzIHN5c3RlbS4gQ2FsbCB0aGlzIG9uIGJvdGggdGhlIGNsaWVudFxuICAvLyBhbmQgdGhlIHNlcnZlci5cbiAgLy9cbiAgLy8gTm90ZSB0aGF0IHRoaXMgbWV0aG9kIGdldHMgb3ZlcnJpZGRlbiBvbiBBY2NvdW50c1NlcnZlci5wcm90b3R5cGUsIGJ1dFxuICAvLyB0aGUgb3ZlcnJpZGluZyBtZXRob2QgY2FsbHMgdGhlIG92ZXJyaWRkZW4gbWV0aG9kLlxuICAvL1xuICAvLyBYWFggd2Ugc2hvdWxkIGFkZCBzb21lIGVuZm9yY2VtZW50IHRoYXQgdGhpcyBpcyBjYWxsZWQgb24gYm90aCB0aGVcbiAgLy8gY2xpZW50IGFuZCB0aGUgc2VydmVyLiBPdGhlcndpc2UsIGEgdXNlciBjYW5cbiAgLy8gJ2ZvcmJpZENsaWVudEFjY291bnRDcmVhdGlvbicgb25seSBvbiB0aGUgY2xpZW50IGFuZCB3aGlsZSBpdCBsb29rc1xuICAvLyBsaWtlIHRoZWlyIGFwcCBpcyBzZWN1cmUsIHRoZSBzZXJ2ZXIgd2lsbCBzdGlsbCBhY2NlcHQgY3JlYXRlVXNlclxuICAvLyBjYWxscy4gaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3IvaXNzdWVzLzgyOFxuICAvL1xuICAvLyBAcGFyYW0gb3B0aW9ucyB7T2JqZWN0fSBhbiBvYmplY3Qgd2l0aCBmaWVsZHM6XG4gIC8vIC0gc2VuZFZlcmlmaWNhdGlvbkVtYWlsIHtCb29sZWFufVxuICAvLyAgICAgU2VuZCBlbWFpbCBhZGRyZXNzIHZlcmlmaWNhdGlvbiBlbWFpbHMgdG8gbmV3IHVzZXJzIGNyZWF0ZWQgZnJvbVxuICAvLyAgICAgY2xpZW50IHNpZ251cHMuXG4gIC8vIC0gZm9yYmlkQ2xpZW50QWNjb3VudENyZWF0aW9uIHtCb29sZWFufVxuICAvLyAgICAgRG8gbm90IGFsbG93IGNsaWVudHMgdG8gY3JlYXRlIGFjY291bnRzIGRpcmVjdGx5LlxuICAvLyAtIHJlc3RyaWN0Q3JlYXRpb25CeUVtYWlsRG9tYWluIHtGdW5jdGlvbiBvciBTdHJpbmd9XG4gIC8vICAgICBSZXF1aXJlIGNyZWF0ZWQgdXNlcnMgdG8gaGF2ZSBhbiBlbWFpbCBtYXRjaGluZyB0aGUgZnVuY3Rpb24gb3JcbiAgLy8gICAgIGhhdmluZyB0aGUgc3RyaW5nIGFzIGRvbWFpbi5cbiAgLy8gLSBsb2dpbkV4cGlyYXRpb25JbkRheXMge051bWJlcn1cbiAgLy8gICAgIE51bWJlciBvZiBkYXlzIHNpbmNlIGxvZ2luIHVudGlsIGEgdXNlciBpcyBsb2dnZWQgb3V0IChsb2dpbiB0b2tlblxuICAvLyAgICAgZXhwaXJlcykuXG4gIC8vIC0gY29sbGVjdGlvbiB7U3RyaW5nfE1vbmdvLkNvbGxlY3Rpb259XG4gIC8vICAgICBBIGNvbGxlY3Rpb24gbmFtZSBvciBhIE1vbmdvLkNvbGxlY3Rpb24gb2JqZWN0IHRvIGhvbGQgdGhlIHVzZXJzLlxuICAvLyAtIHBhc3N3b3JkUmVzZXRUb2tlbkV4cGlyYXRpb25JbkRheXMge051bWJlcn1cbiAgLy8gICAgIE51bWJlciBvZiBkYXlzIHNpbmNlIHBhc3N3b3JkIHJlc2V0IHRva2VuIGNyZWF0aW9uIHVudGlsIHRoZVxuICAvLyAgICAgdG9rZW4gY2FuJ3QgYmUgdXNlZCBhbnkgbG9uZ2VyIChwYXNzd29yZCByZXNldCB0b2tlbiBleHBpcmVzKS5cbiAgLy8gLSBhbWJpZ3VvdXNFcnJvck1lc3NhZ2VzIHtCb29sZWFufVxuICAvLyAgICAgUmV0dXJuIGFtYmlndW91cyBlcnJvciBtZXNzYWdlcyBmcm9tIGxvZ2luIGZhaWx1cmVzIHRvIHByZXZlbnRcbiAgLy8gICAgIHVzZXIgZW51bWVyYXRpb24uXG4gIC8vIC0gYmNyeXB0Um91bmRzIHtOdW1iZXJ9XG4gIC8vICAgICBBbGxvd3Mgb3ZlcnJpZGUgb2YgbnVtYmVyIG9mIGJjcnlwdCByb3VuZHMgKGFrYSB3b3JrIGZhY3RvcikgdXNlZFxuICAvLyAgICAgdG8gc3RvcmUgcGFzc3dvcmRzLlxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBTZXQgZ2xvYmFsIGFjY291bnRzIG9wdGlvbnMuIFlvdSBjYW4gYWxzbyBzZXQgdGhlc2UgaW4gYE1ldGVvci5zZXR0aW5ncy5wYWNrYWdlcy5hY2NvdW50c2Agd2l0aG91dCB0aGUgbmVlZCB0byBjYWxsIHRoaXMgZnVuY3Rpb24uXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMuc2VuZFZlcmlmaWNhdGlvbkVtYWlsIE5ldyB1c2VycyB3aXRoIGFuIGVtYWlsIGFkZHJlc3Mgd2lsbCByZWNlaXZlIGFuIGFkZHJlc3MgdmVyaWZpY2F0aW9uIGVtYWlsLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMuZm9yYmlkQ2xpZW50QWNjb3VudENyZWF0aW9uIENhbGxzIHRvIFtgY3JlYXRlVXNlcmBdKCNhY2NvdW50c19jcmVhdGV1c2VyKSBmcm9tIHRoZSBjbGllbnQgd2lsbCBiZSByZWplY3RlZC4gSW4gYWRkaXRpb24sIGlmIHlvdSBhcmUgdXNpbmcgW2FjY291bnRzLXVpXSgjYWNjb3VudHN1aSksIHRoZSBcIkNyZWF0ZSBhY2NvdW50XCIgbGluayB3aWxsIG5vdCBiZSBhdmFpbGFibGUuXG4gICAqIEBwYXJhbSB7U3RyaW5nIHwgRnVuY3Rpb259IG9wdGlvbnMucmVzdHJpY3RDcmVhdGlvbkJ5RW1haWxEb21haW4gSWYgc2V0IHRvIGEgc3RyaW5nLCBvbmx5IGFsbG93cyBuZXcgdXNlcnMgaWYgdGhlIGRvbWFpbiBwYXJ0IG9mIHRoZWlyIGVtYWlsIGFkZHJlc3MgbWF0Y2hlcyB0aGUgc3RyaW5nLiBJZiBzZXQgdG8gYSBmdW5jdGlvbiwgb25seSBhbGxvd3MgbmV3IHVzZXJzIGlmIHRoZSBmdW5jdGlvbiByZXR1cm5zIHRydWUuICBUaGUgZnVuY3Rpb24gaXMgcGFzc2VkIHRoZSBmdWxsIGVtYWlsIGFkZHJlc3Mgb2YgdGhlIHByb3Bvc2VkIG5ldyB1c2VyLiAgV29ya3Mgd2l0aCBwYXNzd29yZC1iYXNlZCBzaWduLWluIGFuZCBleHRlcm5hbCBzZXJ2aWNlcyB0aGF0IGV4cG9zZSBlbWFpbCBhZGRyZXNzZXMgKEdvb2dsZSwgRmFjZWJvb2ssIEdpdEh1YikuIEFsbCBleGlzdGluZyB1c2VycyBzdGlsbCBjYW4gbG9nIGluIGFmdGVyIGVuYWJsaW5nIHRoaXMgb3B0aW9uLiBFeGFtcGxlOiBgQWNjb3VudHMuY29uZmlnKHsgcmVzdHJpY3RDcmVhdGlvbkJ5RW1haWxEb21haW46ICdzY2hvb2wuZWR1JyB9KWAuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLmxvZ2luRXhwaXJhdGlvbiBUaGUgbnVtYmVyIG9mIG1pbGxpc2Vjb25kcyBmcm9tIHdoZW4gYSB1c2VyIGxvZ3MgaW4gdW50aWwgdGhlaXIgdG9rZW4gZXhwaXJlcyBhbmQgdGhleSBhcmUgbG9nZ2VkIG91dCwgZm9yIGEgbW9yZSBncmFudWxhciBjb250cm9sLiBJZiBgbG9naW5FeHBpcmF0aW9uSW5EYXlzYCBpcyBzZXQsIGl0IHRha2VzIHByZWNlZGVudC5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IG9wdGlvbnMubG9naW5FeHBpcmF0aW9uSW5EYXlzIFRoZSBudW1iZXIgb2YgZGF5cyBmcm9tIHdoZW4gYSB1c2VyIGxvZ3MgaW4gdW50aWwgdGhlaXIgdG9rZW4gZXhwaXJlcyBhbmQgdGhleSBhcmUgbG9nZ2VkIG91dC4gRGVmYXVsdHMgdG8gOTAuIFNldCB0byBgbnVsbGAgdG8gZGlzYWJsZSBsb2dpbiBleHBpcmF0aW9uLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5vYXV0aFNlY3JldEtleSBXaGVuIHVzaW5nIHRoZSBgb2F1dGgtZW5jcnlwdGlvbmAgcGFja2FnZSwgdGhlIDE2IGJ5dGUga2V5IHVzaW5nIHRvIGVuY3J5cHQgc2Vuc2l0aXZlIGFjY291bnQgY3JlZGVudGlhbHMgaW4gdGhlIGRhdGFiYXNlLCBlbmNvZGVkIGluIGJhc2U2NC4gIFRoaXMgb3B0aW9uIG1heSBvbmx5IGJlIHNwZWNpZmllZCBvbiB0aGUgc2VydmVyLiAgU2VlIHBhY2thZ2VzL29hdXRoLWVuY3J5cHRpb24vUkVBRE1FLm1kIGZvciBkZXRhaWxzLlxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5wYXNzd29yZFJlc2V0VG9rZW5FeHBpcmF0aW9uSW5EYXlzIFRoZSBudW1iZXIgb2YgZGF5cyBmcm9tIHdoZW4gYSBsaW5rIHRvIHJlc2V0IHBhc3N3b3JkIGlzIHNlbnQgdW50aWwgdG9rZW4gZXhwaXJlcyBhbmQgdXNlciBjYW4ndCByZXNldCBwYXNzd29yZCB3aXRoIHRoZSBsaW5rIGFueW1vcmUuIERlZmF1bHRzIHRvIDMuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLnBhc3N3b3JkUmVzZXRUb2tlbkV4cGlyYXRpb24gVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgZnJvbSB3aGVuIGEgbGluayB0byByZXNldCBwYXNzd29yZCBpcyBzZW50IHVudGlsIHRva2VuIGV4cGlyZXMgYW5kIHVzZXIgY2FuJ3QgcmVzZXQgcGFzc3dvcmQgd2l0aCB0aGUgbGluayBhbnltb3JlLiBJZiBgcGFzc3dvcmRSZXNldFRva2VuRXhwaXJhdGlvbkluRGF5c2AgaXMgc2V0LCBpdCB0YWtlcyBwcmVjZWRlbnQuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLnBhc3N3b3JkRW5yb2xsVG9rZW5FeHBpcmF0aW9uSW5EYXlzIFRoZSBudW1iZXIgb2YgZGF5cyBmcm9tIHdoZW4gYSBsaW5rIHRvIHNldCBpbml0aWFsIHBhc3N3b3JkIGlzIHNlbnQgdW50aWwgdG9rZW4gZXhwaXJlcyBhbmQgdXNlciBjYW4ndCBzZXQgcGFzc3dvcmQgd2l0aCB0aGUgbGluayBhbnltb3JlLiBEZWZhdWx0cyB0byAzMC5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IG9wdGlvbnMucGFzc3dvcmRFbnJvbGxUb2tlbkV4cGlyYXRpb24gVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgZnJvbSB3aGVuIGEgbGluayB0byBzZXQgaW5pdGlhbCBwYXNzd29yZCBpcyBzZW50IHVudGlsIHRva2VuIGV4cGlyZXMgYW5kIHVzZXIgY2FuJ3Qgc2V0IHBhc3N3b3JkIHdpdGggdGhlIGxpbmsgYW55bW9yZS4gSWYgYHBhc3N3b3JkRW5yb2xsVG9rZW5FeHBpcmF0aW9uSW5EYXlzYCBpcyBzZXQsIGl0IHRha2VzIHByZWNlZGVudC5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLmFtYmlndW91c0Vycm9yTWVzc2FnZXMgUmV0dXJuIGFtYmlndW91cyBlcnJvciBtZXNzYWdlcyBmcm9tIGxvZ2luIGZhaWx1cmVzIHRvIHByZXZlbnQgdXNlciBlbnVtZXJhdGlvbi4gRGVmYXVsdHMgdG8gYGZhbHNlYCwgYnV0IGluIHByb2R1Y3Rpb24gZW52aXJvbm1lbnRzIGl0IGlzIHJlY29tbWVuZGVkIGl0IGRlZmF1bHRzIHRvIGB0cnVlYC5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IG9wdGlvbnMuYmNyeXB0Um91bmRzIEFsbG93cyBvdmVycmlkZSBvZiBudW1iZXIgb2YgYmNyeXB0IHJvdW5kcyAoYWthIHdvcmsgZmFjdG9yKSB1c2VkIHRvIHN0b3JlIHBhc3N3b3Jkcy4gVGhlIGRlZmF1bHQgaXMgMTAuXG4gICAqIEBwYXJhbSB7TW9uZ29GaWVsZFNwZWNpZmllcn0gb3B0aW9ucy5kZWZhdWx0RmllbGRTZWxlY3RvciBUbyBleGNsdWRlIGJ5IGRlZmF1bHQgbGFyZ2UgY3VzdG9tIGZpZWxkcyBmcm9tIGBNZXRlb3IudXNlcigpYCBhbmQgYE1ldGVvci5maW5kVXNlckJ5Li4uKClgIGZ1bmN0aW9ucyB3aGVuIGNhbGxlZCB3aXRob3V0IGEgZmllbGQgc2VsZWN0b3IsIGFuZCBhbGwgYG9uTG9naW5gLCBgb25Mb2dpbkZhaWx1cmVgIGFuZCBgb25Mb2dvdXRgIGNhbGxiYWNrcy4gIEV4YW1wbGU6IGBBY2NvdW50cy5jb25maWcoeyBkZWZhdWx0RmllbGRTZWxlY3RvcjogeyBteUJpZ0FycmF5OiAwIH19KWAuIEJld2FyZSB3aGVuIHVzaW5nIHRoaXMuIElmLCBmb3IgaW5zdGFuY2UsIHlvdSBkbyBub3QgaW5jbHVkZSBgZW1haWxgIHdoZW4gZXhjbHVkaW5nIHRoZSBmaWVsZHMsIHlvdSBjYW4gaGF2ZSBwcm9ibGVtcyB3aXRoIGZ1bmN0aW9ucyBsaWtlIGBmb3Jnb3RQYXNzd29yZGAgdGhhdCB3aWxsIGJyZWFrIGJlY2F1c2UgdGhleSB3b24ndCBoYXZlIHRoZSByZXF1aXJlZCBkYXRhIGF2YWlsYWJsZS4gSXQncyByZWNvbW1lbmQgdGhhdCB5b3UgYWx3YXlzIGtlZXAgdGhlIGZpZWxkcyBgX2lkYCwgYHVzZXJuYW1lYCwgYW5kIGBlbWFpbGAuXG4gICAqIEBwYXJhbSB7U3RyaW5nfE1vbmdvLkNvbGxlY3Rpb259IG9wdGlvbnMuY29sbGVjdGlvbiBBIGNvbGxlY3Rpb24gbmFtZSBvciBhIE1vbmdvLkNvbGxlY3Rpb24gb2JqZWN0IHRvIGhvbGQgdGhlIHVzZXJzLlxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5sb2dpblRva2VuRXhwaXJhdGlvbkhvdXJzIFdoZW4gdXNpbmcgdGhlIHBhY2thZ2UgYGFjY291bnRzLTJmYWAsIHVzZSB0aGlzIHRvIHNldCB0aGUgYW1vdW50IG9mIHRpbWUgYSB0b2tlbiBzZW50IGlzIHZhbGlkLiBBcyBpdCdzIGp1c3QgYSBudW1iZXIsIHlvdSBjYW4gdXNlLCBmb3IgZXhhbXBsZSwgMC41IHRvIG1ha2UgdGhlIHRva2VuIHZhbGlkIGZvciBqdXN0IGhhbGYgaG91ci4gVGhlIGRlZmF1bHQgaXMgMSBob3VyLlxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy50b2tlblNlcXVlbmNlTGVuZ3RoIFdoZW4gdXNpbmcgdGhlIHBhY2thZ2UgYGFjY291bnRzLTJmYWAsIHVzZSB0aGlzIHRvIHRoZSBzaXplIG9mIHRoZSB0b2tlbiBzZXF1ZW5jZSBnZW5lcmF0ZWQuIFRoZSBkZWZhdWx0IGlzIDYuXG4gICAqIEBwYXJhbSB7J3Nlc3Npb24nIHwgJ2xvY2FsJ30gb3B0aW9ucy5jbGllbnRTdG9yYWdlIEJ5IGRlZmF1bHQgbG9naW4gY3JlZGVudGlhbHMgYXJlIHN0b3JlZCBpbiBsb2NhbCBzdG9yYWdlLCBzZXR0aW5nIHRoaXMgdG8gdHJ1ZSB3aWxsIHN3aXRjaCB0byB1c2luZyBzZXNzaW9uIHN0b3JhZ2UuXG4gICAqL1xuICBjb25maWcob3B0aW9ucykge1xuICAgIC8vIFdlIGRvbid0IHdhbnQgdXNlcnMgdG8gYWNjaWRlbnRhbGx5IG9ubHkgY2FsbCBBY2NvdW50cy5jb25maWcgb24gdGhlXG4gICAgLy8gY2xpZW50LCB3aGVyZSBzb21lIG9mIHRoZSBvcHRpb25zIHdpbGwgaGF2ZSBwYXJ0aWFsIGVmZmVjdHMgKGVnIHJlbW92aW5nXG4gICAgLy8gdGhlIFwiY3JlYXRlIGFjY291bnRcIiBidXR0b24gZnJvbSBhY2NvdW50cy11aSBpZiBmb3JiaWRDbGllbnRBY2NvdW50Q3JlYXRpb25cbiAgICAvLyBpcyBzZXQsIG9yIHJlZGlyZWN0aW5nIEdvb2dsZSBsb2dpbiB0byBhIHNwZWNpZmljLWRvbWFpbiBwYWdlKSB3aXRob3V0XG4gICAgLy8gaGF2aW5nIHRoZWlyIGZ1bGwgZWZmZWN0cy5cbiAgICBpZiAoTWV0ZW9yLmlzU2VydmVyKSB7XG4gICAgICBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLmFjY291bnRzQ29uZmlnQ2FsbGVkID0gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKCFfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLmFjY291bnRzQ29uZmlnQ2FsbGVkKSB7XG4gICAgICAvLyBYWFggd291bGQgYmUgbmljZSB0byBcImNyYXNoXCIgdGhlIGNsaWVudCBhbmQgcmVwbGFjZSB0aGUgVUkgd2l0aCBhbiBlcnJvclxuICAgICAgLy8gbWVzc2FnZSwgYnV0IHRoZXJlJ3Mgbm8gdHJpdmlhbCB3YXkgdG8gZG8gdGhpcy5cbiAgICAgIE1ldGVvci5fZGVidWcoXG4gICAgICAgICdBY2NvdW50cy5jb25maWcgd2FzIGNhbGxlZCBvbiB0aGUgY2xpZW50IGJ1dCBub3Qgb24gdGhlICcgK1xuICAgICAgICAgICdzZXJ2ZXI7IHNvbWUgY29uZmlndXJhdGlvbiBvcHRpb25zIG1heSBub3QgdGFrZSBlZmZlY3QuJ1xuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBXZSBuZWVkIHRvIHZhbGlkYXRlIHRoZSBvYXV0aFNlY3JldEtleSBvcHRpb24gYXQgdGhlIHRpbWVcbiAgICAvLyBBY2NvdW50cy5jb25maWcgaXMgY2FsbGVkLiBXZSBhbHNvIGRlbGliZXJhdGVseSBkb24ndCBzdG9yZSB0aGVcbiAgICAvLyBvYXV0aFNlY3JldEtleSBpbiBBY2NvdW50cy5fb3B0aW9ucy5cbiAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9wdGlvbnMsICdvYXV0aFNlY3JldEtleScpKSB7XG4gICAgICBpZiAoTWV0ZW9yLmlzQ2xpZW50KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAnVGhlIG9hdXRoU2VjcmV0S2V5IG9wdGlvbiBtYXkgb25seSBiZSBzcGVjaWZpZWQgb24gdGhlIHNlcnZlcidcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGlmICghUGFja2FnZVsnb2F1dGgtZW5jcnlwdGlvbiddKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAnVGhlIG9hdXRoLWVuY3J5cHRpb24gcGFja2FnZSBtdXN0IGJlIGxvYWRlZCB0byBzZXQgb2F1dGhTZWNyZXRLZXknXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBQYWNrYWdlWydvYXV0aC1lbmNyeXB0aW9uJ10uT0F1dGhFbmNyeXB0aW9uLmxvYWRLZXkoXG4gICAgICAgIG9wdGlvbnMub2F1dGhTZWNyZXRLZXlcbiAgICAgICk7XG4gICAgICBvcHRpb25zID0geyAuLi5vcHRpb25zIH07XG4gICAgICBkZWxldGUgb3B0aW9ucy5vYXV0aFNlY3JldEtleTtcbiAgICB9XG5cbiAgICAvLyBWYWxpZGF0ZSBjb25maWcgb3B0aW9ucyBrZXlzXG4gICAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMob3B0aW9ucykpIHtcbiAgICAgIGlmICghVkFMSURfQ09ORklHX0tFWVMuaW5jbHVkZXMoa2V5KSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBBY2NvdW50cy5jb25maWc6IEludmFsaWQga2V5OiAke2tleX1gKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzZXQgdmFsdWVzIGluIEFjY291bnRzLl9vcHRpb25zXG4gICAgZm9yIChjb25zdCBrZXkgb2YgVkFMSURfQ09ORklHX0tFWVMpIHtcbiAgICAgIGlmIChrZXkgaW4gb3B0aW9ucykge1xuICAgICAgICBpZiAoa2V5IGluIHRoaXMuX29wdGlvbnMpIHtcbiAgICAgICAgICBpZiAoa2V5ICE9PSAnY29sbGVjdGlvbicgJiYgKE1ldGVvci5pc1Rlc3QgJiYga2V5ICE9PSAnY2xpZW50U3RvcmFnZScpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKGBDYW4ndCBzZXQgXFxgJHtrZXl9XFxgIG1vcmUgdGhhbiBvbmNlYCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX29wdGlvbnNba2V5XSA9IG9wdGlvbnNba2V5XTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5jb2xsZWN0aW9uICYmIG9wdGlvbnMuY29sbGVjdGlvbiAhPT0gdGhpcy51c2Vycy5fbmFtZSAmJiBvcHRpb25zLmNvbGxlY3Rpb24gIT09IHRoaXMudXNlcnMpIHtcbiAgICAgIHRoaXMudXNlcnMgPSB0aGlzLl9pbml0aWFsaXplQ29sbGVjdGlvbihvcHRpb25zKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgUmVnaXN0ZXIgYSBjYWxsYmFjayB0byBiZSBjYWxsZWQgYWZ0ZXIgYSBsb2dpbiBhdHRlbXB0IHN1Y2NlZWRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgY2FsbGJhY2sgdG8gYmUgY2FsbGVkIHdoZW4gbG9naW4gaXMgc3VjY2Vzc2Z1bC5cbiAgICogICAgICAgICAgICAgICAgICAgICAgICBUaGUgY2FsbGJhY2sgcmVjZWl2ZXMgYSBzaW5nbGUgb2JqZWN0IHRoYXRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICBob2xkcyBsb2dpbiBkZXRhaWxzLiBUaGlzIG9iamVjdCBjb250YWlucyB0aGUgbG9naW5cbiAgICogICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgdHlwZSAocGFzc3dvcmQsIHJlc3VtZSwgZXRjLikgb24gYm90aCB0aGVcbiAgICogICAgICAgICAgICAgICAgICAgICAgICBjbGllbnQgYW5kIHNlcnZlci4gYG9uTG9naW5gIGNhbGxiYWNrcyByZWdpc3RlcmVkXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgb24gdGhlIHNlcnZlciBhbHNvIHJlY2VpdmUgZXh0cmEgZGF0YSwgc3VjaFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgIGFzIHVzZXIgZGV0YWlscywgY29ubmVjdGlvbiBpbmZvcm1hdGlvbiwgZXRjLlxuICAgKi9cbiAgb25Mb2dpbihmdW5jKSB7XG4gICAgbGV0IHJldCA9IHRoaXMuX29uTG9naW5Ib29rLnJlZ2lzdGVyKGZ1bmMpO1xuICAgIC8vIGNhbGwgdGhlIGp1c3QgcmVnaXN0ZXJlZCBjYWxsYmFjayBpZiBhbHJlYWR5IGxvZ2dlZCBpblxuICAgIHRoaXMuX3N0YXJ0dXBDYWxsYmFjayhyZXQuY2FsbGJhY2spO1xuICAgIHJldHVybiByZXQ7XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgUmVnaXN0ZXIgYSBjYWxsYmFjayB0byBiZSBjYWxsZWQgYWZ0ZXIgYSBsb2dpbiBhdHRlbXB0IGZhaWxzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgY2FsbGJhY2sgdG8gYmUgY2FsbGVkIGFmdGVyIHRoZSBsb2dpbiBoYXMgZmFpbGVkLlxuICAgKi9cbiAgb25Mb2dpbkZhaWx1cmUoZnVuYykge1xuICAgIHJldHVybiB0aGlzLl9vbkxvZ2luRmFpbHVyZUhvb2sucmVnaXN0ZXIoZnVuYyk7XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgUmVnaXN0ZXIgYSBjYWxsYmFjayB0byBiZSBjYWxsZWQgYWZ0ZXIgYSBsb2dvdXQgYXR0ZW1wdCBzdWNjZWVkcy5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGNhbGxiYWNrIHRvIGJlIGNhbGxlZCB3aGVuIGxvZ291dCBpcyBzdWNjZXNzZnVsLlxuICAgKi9cbiAgb25Mb2dvdXQoZnVuYykge1xuICAgIHJldHVybiB0aGlzLl9vbkxvZ291dEhvb2sucmVnaXN0ZXIoZnVuYyk7XG4gIH1cblxuICBfaW5pdENvbm5lY3Rpb24ob3B0aW9ucykge1xuICAgIGlmICghTWV0ZW9yLmlzQ2xpZW50KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gVGhlIGNvbm5lY3Rpb24gdXNlZCBieSB0aGUgQWNjb3VudHMgc3lzdGVtLiBUaGlzIGlzIHRoZSBjb25uZWN0aW9uXG4gICAgLy8gdGhhdCB3aWxsIGdldCBsb2dnZWQgaW4gYnkgTWV0ZW9yLmxvZ2luKCksIGFuZCB0aGlzIGlzIHRoZVxuICAgIC8vIGNvbm5lY3Rpb24gd2hvc2UgbG9naW4gc3RhdGUgd2lsbCBiZSByZWZsZWN0ZWQgYnkgTWV0ZW9yLnVzZXJJZCgpLlxuICAgIC8vXG4gICAgLy8gSXQgd291bGQgYmUgbXVjaCBwcmVmZXJhYmxlIGZvciB0aGlzIHRvIGJlIGluIGFjY291bnRzX2NsaWVudC5qcyxcbiAgICAvLyBidXQgaXQgaGFzIHRvIGJlIGhlcmUgYmVjYXVzZSBpdCdzIG5lZWRlZCB0byBjcmVhdGUgdGhlXG4gICAgLy8gTWV0ZW9yLnVzZXJzIGNvbGxlY3Rpb24uXG4gICAgaWYgKG9wdGlvbnMuY29ubmVjdGlvbikge1xuICAgICAgdGhpcy5jb25uZWN0aW9uID0gb3B0aW9ucy5jb25uZWN0aW9uO1xuICAgIH0gZWxzZSBpZiAob3B0aW9ucy5kZHBVcmwpIHtcbiAgICAgIHRoaXMuY29ubmVjdGlvbiA9IEREUC5jb25uZWN0KG9wdGlvbnMuZGRwVXJsKTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgdHlwZW9mIF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18gIT09ICd1bmRlZmluZWQnICYmXG4gICAgICBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLkFDQ09VTlRTX0NPTk5FQ1RJT05fVVJMXG4gICAgKSB7XG4gICAgICAvLyBUZW1wb3JhcnksIGludGVybmFsIGhvb2sgdG8gYWxsb3cgdGhlIHNlcnZlciB0byBwb2ludCB0aGUgY2xpZW50XG4gICAgICAvLyB0byBhIGRpZmZlcmVudCBhdXRoZW50aWNhdGlvbiBzZXJ2ZXIuIFRoaXMgaXMgZm9yIGEgdmVyeVxuICAgICAgLy8gcGFydGljdWxhciB1c2UgY2FzZSB0aGF0IGNvbWVzIHVwIHdoZW4gaW1wbGVtZW50aW5nIGEgb2F1dGhcbiAgICAgIC8vIHNlcnZlci4gVW5zdXBwb3J0ZWQgYW5kIG1heSBnbyBhd2F5IGF0IGFueSBwb2ludCBpbiB0aW1lLlxuICAgICAgLy9cbiAgICAgIC8vIFdlIHdpbGwgZXZlbnR1YWxseSBwcm92aWRlIGEgZ2VuZXJhbCB3YXkgdG8gdXNlIGFjY291bnQtYmFzZVxuICAgICAgLy8gYWdhaW5zdCBhbnkgRERQIGNvbm5lY3Rpb24sIG5vdCBqdXN0IG9uZSBzcGVjaWFsIG9uZS5cbiAgICAgIHRoaXMuY29ubmVjdGlvbiA9IEREUC5jb25uZWN0KFxuICAgICAgICBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLkFDQ09VTlRTX0NPTk5FQ1RJT05fVVJMXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNvbm5lY3Rpb24gPSBNZXRlb3IuY29ubmVjdGlvbjtcbiAgICB9XG4gIH1cblxuICBfZ2V0VG9rZW5MaWZldGltZU1zKCkge1xuICAgIC8vIFdoZW4gbG9naW5FeHBpcmF0aW9uSW5EYXlzIGlzIHNldCB0byBudWxsLCB3ZSdsbCB1c2UgYSByZWFsbHkgaGlnaFxuICAgIC8vIG51bWJlciBvZiBkYXlzIChMT0dJTl9VTkVYUElSQUJMRV9UT0tFTl9EQVlTKSB0byBzaW11bGF0ZSBhblxuICAgIC8vIHVuZXhwaXJpbmcgdG9rZW4uXG4gICAgY29uc3QgbG9naW5FeHBpcmF0aW9uSW5EYXlzID1cbiAgICAgIHRoaXMuX29wdGlvbnMubG9naW5FeHBpcmF0aW9uSW5EYXlzID09PSBudWxsXG4gICAgICAgID8gTE9HSU5fVU5FWFBJUklOR19UT0tFTl9EQVlTXG4gICAgICAgIDogdGhpcy5fb3B0aW9ucy5sb2dpbkV4cGlyYXRpb25JbkRheXM7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuX29wdGlvbnMubG9naW5FeHBpcmF0aW9uIHx8XG4gICAgICAobG9naW5FeHBpcmF0aW9uSW5EYXlzIHx8IERFRkFVTFRfTE9HSU5fRVhQSVJBVElPTl9EQVlTKSAqIDg2NDAwMDAwXG4gICAgKTtcbiAgfVxuXG4gIF9nZXRQYXNzd29yZFJlc2V0VG9rZW5MaWZldGltZU1zKCkge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLl9vcHRpb25zLnBhc3N3b3JkUmVzZXRUb2tlbkV4cGlyYXRpb24gfHxcbiAgICAgICh0aGlzLl9vcHRpb25zLnBhc3N3b3JkUmVzZXRUb2tlbkV4cGlyYXRpb25JbkRheXMgfHxcbiAgICAgICAgREVGQVVMVF9QQVNTV09SRF9SRVNFVF9UT0tFTl9FWFBJUkFUSU9OX0RBWVMpICogODY0MDAwMDBcbiAgICApO1xuICB9XG5cbiAgX2dldFBhc3N3b3JkRW5yb2xsVG9rZW5MaWZldGltZU1zKCkge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLl9vcHRpb25zLnBhc3N3b3JkRW5yb2xsVG9rZW5FeHBpcmF0aW9uIHx8XG4gICAgICAodGhpcy5fb3B0aW9ucy5wYXNzd29yZEVucm9sbFRva2VuRXhwaXJhdGlvbkluRGF5cyB8fFxuICAgICAgICBERUZBVUxUX1BBU1NXT1JEX0VOUk9MTF9UT0tFTl9FWFBJUkFUSU9OX0RBWVMpICogODY0MDAwMDBcbiAgICApO1xuICB9XG5cbiAgX3Rva2VuRXhwaXJhdGlvbih3aGVuKSB7XG4gICAgLy8gV2UgcGFzcyB3aGVuIHRocm91Z2ggdGhlIERhdGUgY29uc3RydWN0b3IgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5O1xuICAgIC8vIGB3aGVuYCB1c2VkIHRvIGJlIGEgbnVtYmVyLlxuICAgIHJldHVybiBuZXcgRGF0ZShuZXcgRGF0ZSh3aGVuKS5nZXRUaW1lKCkgKyB0aGlzLl9nZXRUb2tlbkxpZmV0aW1lTXMoKSk7XG4gIH1cblxuICBfdG9rZW5FeHBpcmVzU29vbih3aGVuKSB7XG4gICAgbGV0IG1pbkxpZmV0aW1lTXMgPSAwLjEgKiB0aGlzLl9nZXRUb2tlbkxpZmV0aW1lTXMoKTtcbiAgICBjb25zdCBtaW5MaWZldGltZUNhcE1zID0gTUlOX1RPS0VOX0xJRkVUSU1FX0NBUF9TRUNTICogMTAwMDtcbiAgICBpZiAobWluTGlmZXRpbWVNcyA+IG1pbkxpZmV0aW1lQ2FwTXMpIHtcbiAgICAgIG1pbkxpZmV0aW1lTXMgPSBtaW5MaWZldGltZUNhcE1zO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IERhdGUoKSA+IG5ldyBEYXRlKHdoZW4pIC0gbWluTGlmZXRpbWVNcztcbiAgfVxuXG4gIC8vIE5vLW9wIG9uIHRoZSBzZXJ2ZXIsIG92ZXJyaWRkZW4gb24gdGhlIGNsaWVudC5cbiAgX3N0YXJ0dXBDYWxsYmFjayhjYWxsYmFjaykge31cbn1cblxuLy8gTm90ZSB0aGF0IEFjY291bnRzIGlzIGRlZmluZWQgc2VwYXJhdGVseSBpbiBhY2NvdW50c19jbGllbnQuanMgYW5kXG4vLyBhY2NvdW50c19zZXJ2ZXIuanMuXG5cbi8qKlxuICogQHN1bW1hcnkgR2V0IHRoZSBjdXJyZW50IHVzZXIgaWQsIG9yIGBudWxsYCBpZiBubyB1c2VyIGlzIGxvZ2dlZCBpbi4gQSByZWFjdGl2ZSBkYXRhIHNvdXJjZS5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICovXG5NZXRlb3IudXNlcklkID0gKCkgPT4gQWNjb3VudHMudXNlcklkKCk7XG5cbi8qKlxuICogQHN1bW1hcnkgR2V0IHRoZSBjdXJyZW50IHVzZXIgcmVjb3JkLCBvciBgbnVsbGAgaWYgbm8gdXNlciBpcyBsb2dnZWQgaW4uIEEgcmVhY3RpdmUgZGF0YSBzb3VyY2UuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAqIEBwYXJhbSB7TW9uZ29GaWVsZFNwZWNpZmllcn0gb3B0aW9ucy5maWVsZHMgRGljdGlvbmFyeSBvZiBmaWVsZHMgdG8gcmV0dXJuIG9yIGV4Y2x1ZGUuXG4gKi9cbk1ldGVvci51c2VyID0gb3B0aW9ucyA9PiBBY2NvdW50cy51c2VyKG9wdGlvbnMpO1xuXG4vKipcbiAqIEBzdW1tYXJ5IEdldCB0aGUgY3VycmVudCB1c2VyIHJlY29yZCwgb3IgYG51bGxgIGlmIG5vIHVzZXIgaXMgbG9nZ2VkIGluLiBBIHJlYWN0aXZlIGRhdGEgc291cmNlLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAcGFyYW0ge01vbmdvRmllbGRTcGVjaWZpZXJ9IG9wdGlvbnMuZmllbGRzIERpY3Rpb25hcnkgb2YgZmllbGRzIHRvIHJldHVybiBvciBleGNsdWRlLlxuICovXG5NZXRlb3IudXNlckFzeW5jID0gb3B0aW9ucyA9PiBBY2NvdW50cy51c2VyQXN5bmMob3B0aW9ucyk7XG5cbi8vIGhvdyBsb25nIChpbiBkYXlzKSB1bnRpbCBhIGxvZ2luIHRva2VuIGV4cGlyZXNcbmNvbnN0IERFRkFVTFRfTE9HSU5fRVhQSVJBVElPTl9EQVlTID0gOTA7XG4vLyBob3cgbG9uZyAoaW4gZGF5cykgdW50aWwgcmVzZXQgcGFzc3dvcmQgdG9rZW4gZXhwaXJlc1xuY29uc3QgREVGQVVMVF9QQVNTV09SRF9SRVNFVF9UT0tFTl9FWFBJUkFUSU9OX0RBWVMgPSAzO1xuLy8gaG93IGxvbmcgKGluIGRheXMpIHVudGlsIGVucm9sIHBhc3N3b3JkIHRva2VuIGV4cGlyZXNcbmNvbnN0IERFRkFVTFRfUEFTU1dPUkRfRU5ST0xMX1RPS0VOX0VYUElSQVRJT05fREFZUyA9IDMwO1xuLy8gQ2xpZW50cyBkb24ndCB0cnkgdG8gYXV0by1sb2dpbiB3aXRoIGEgdG9rZW4gdGhhdCBpcyBnb2luZyB0byBleHBpcmUgd2l0aGluXG4vLyAuMSAqIERFRkFVTFRfTE9HSU5fRVhQSVJBVElPTl9EQVlTLCBjYXBwZWQgYXQgTUlOX1RPS0VOX0xJRkVUSU1FX0NBUF9TRUNTLlxuLy8gVHJpZXMgdG8gYXZvaWQgYWJydXB0IGRpc2Nvbm5lY3RzIGZyb20gZXhwaXJpbmcgdG9rZW5zLlxuY29uc3QgTUlOX1RPS0VOX0xJRkVUSU1FX0NBUF9TRUNTID0gMzYwMDsgLy8gb25lIGhvdXJcbi8vIGhvdyBvZnRlbiAoaW4gbWlsbGlzZWNvbmRzKSB3ZSBjaGVjayBmb3IgZXhwaXJlZCB0b2tlbnNcbmV4cG9ydCBjb25zdCBFWFBJUkVfVE9LRU5TX0lOVEVSVkFMX01TID0gNjAwICogMTAwMDsgLy8gMTAgbWludXRlc1xuLy8gQSBsYXJnZSBudW1iZXIgb2YgZXhwaXJhdGlvbiBkYXlzIChhcHByb3hpbWF0ZWx5IDEwMCB5ZWFycyB3b3J0aCkgdGhhdCBpc1xuLy8gdXNlZCB3aGVuIGNyZWF0aW5nIHVuZXhwaXJpbmcgdG9rZW5zLlxuY29uc3QgTE9HSU5fVU5FWFBJUklOR19UT0tFTl9EQVlTID0gMzY1ICogMTAwO1xuIiwiaW1wb3J0IGNyeXB0byBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XG5pbXBvcnQge1xuICBBY2NvdW50c0NvbW1vbixcbiAgRVhQSVJFX1RPS0VOU19JTlRFUlZBTF9NUyxcbn0gZnJvbSAnLi9hY2NvdW50c19jb21tb24uanMnO1xuaW1wb3J0IHsgVVJMIH0gZnJvbSAnbWV0ZW9yL3VybCc7XG5cbmNvbnN0IGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbi8vIFhYWCBtYXliZSB0aGlzIGJlbG9uZ3MgaW4gdGhlIGNoZWNrIHBhY2thZ2VcbmNvbnN0IE5vbkVtcHR5U3RyaW5nID0gTWF0Y2guV2hlcmUoeCA9PiB7XG4gIGNoZWNrKHgsIFN0cmluZyk7XG4gIHJldHVybiB4Lmxlbmd0aCA+IDA7XG59KTtcblxuXG4vKipcbiAqIEBzdW1tYXJ5IENvbnN0cnVjdG9yIGZvciB0aGUgYEFjY291bnRzYCBuYW1lc3BhY2Ugb24gdGhlIHNlcnZlci5cbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBjbGFzcyBBY2NvdW50c1NlcnZlclxuICogQGV4dGVuZHMgQWNjb3VudHNDb21tb25cbiAqIEBpbnN0YW5jZW5hbWUgYWNjb3VudHNTZXJ2ZXJcbiAqIEBwYXJhbSB7T2JqZWN0fSBzZXJ2ZXIgQSBzZXJ2ZXIgb2JqZWN0IHN1Y2ggYXMgYE1ldGVvci5zZXJ2ZXJgLlxuICovXG5leHBvcnQgY2xhc3MgQWNjb3VudHNTZXJ2ZXIgZXh0ZW5kcyBBY2NvdW50c0NvbW1vbiB7XG4gIC8vIE5vdGUgdGhhdCB0aGlzIGNvbnN0cnVjdG9yIGlzIGxlc3MgbGlrZWx5IHRvIGJlIGluc3RhbnRpYXRlZCBtdWx0aXBsZVxuICAvLyB0aW1lcyB0aGFuIHRoZSBgQWNjb3VudHNDbGllbnRgIGNvbnN0cnVjdG9yLCBiZWNhdXNlIGEgc2luZ2xlIHNlcnZlclxuICAvLyBjYW4gcHJvdmlkZSBvbmx5IG9uZSBzZXQgb2YgbWV0aG9kcy5cbiAgY29uc3RydWN0b3Ioc2VydmVyLCBvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyB8fCB7fSk7XG5cbiAgICB0aGlzLl9zZXJ2ZXIgPSBzZXJ2ZXIgfHwgTWV0ZW9yLnNlcnZlcjtcbiAgICAvLyBTZXQgdXAgdGhlIHNlcnZlcidzIG1ldGhvZHMsIGFzIGlmIGJ5IGNhbGxpbmcgTWV0ZW9yLm1ldGhvZHMuXG4gICAgdGhpcy5faW5pdFNlcnZlck1ldGhvZHMoKTtcblxuICAgIHRoaXMuX2luaXRBY2NvdW50RGF0YUhvb2tzKCk7XG5cbiAgICAvLyBJZiBhdXRvcHVibGlzaCBpcyBvbiwgcHVibGlzaCB0aGVzZSB1c2VyIGZpZWxkcy4gTG9naW4gc2VydmljZVxuICAgIC8vIHBhY2thZ2VzIChlZyBhY2NvdW50cy1nb29nbGUpIGFkZCB0byB0aGVzZSBieSBjYWxsaW5nXG4gICAgLy8gYWRkQXV0b3B1Ymxpc2hGaWVsZHMuICBOb3RhYmx5LCB0aGlzIGlzbid0IGltcGxlbWVudGVkIHdpdGggbXVsdGlwbGVcbiAgICAvLyBwdWJsaXNoZXMgc2luY2UgRERQIG9ubHkgbWVyZ2VzIG9ubHkgYWNyb3NzIHRvcC1sZXZlbCBmaWVsZHMsIG5vdFxuICAgIC8vIHN1YmZpZWxkcyAoc3VjaCBhcyAnc2VydmljZXMuZmFjZWJvb2suYWNjZXNzVG9rZW4nKVxuICAgIHRoaXMuX2F1dG9wdWJsaXNoRmllbGRzID0ge1xuICAgICAgbG9nZ2VkSW5Vc2VyOiBbJ3Byb2ZpbGUnLCAndXNlcm5hbWUnLCAnZW1haWxzJ10sXG4gICAgICBvdGhlclVzZXJzOiBbJ3Byb2ZpbGUnLCAndXNlcm5hbWUnXVxuICAgIH07XG5cbiAgICAvLyB1c2Ugb2JqZWN0IHRvIGtlZXAgdGhlIHJlZmVyZW5jZSB3aGVuIHVzZWQgaW4gZnVuY3Rpb25zXG4gICAgLy8gd2hlcmUgX2RlZmF1bHRQdWJsaXNoRmllbGRzIGlzIGRlc3RydWN0dXJlZCBpbnRvIGxleGljYWwgc2NvcGVcbiAgICAvLyBmb3IgcHVibGlzaCBjYWxsYmFja3MgdGhhdCBuZWVkIGB0aGlzYFxuICAgIHRoaXMuX2RlZmF1bHRQdWJsaXNoRmllbGRzID0ge1xuICAgICAgcHJvamVjdGlvbjoge1xuICAgICAgICBwcm9maWxlOiAxLFxuICAgICAgICB1c2VybmFtZTogMSxcbiAgICAgICAgZW1haWxzOiAxLFxuICAgICAgfVxuICAgIH07XG5cbiAgICB0aGlzLl9pbml0U2VydmVyUHVibGljYXRpb25zKCk7XG5cbiAgICAvLyBjb25uZWN0aW9uSWQgLT4ge2Nvbm5lY3Rpb24sIGxvZ2luVG9rZW59XG4gICAgdGhpcy5fYWNjb3VudERhdGEgPSB7fTtcblxuICAgIC8vIGNvbm5lY3Rpb24gaWQgLT4gb2JzZXJ2ZSBoYW5kbGUgZm9yIHRoZSBsb2dpbiB0b2tlbiB0aGF0IHRoaXMgY29ubmVjdGlvbiBpc1xuICAgIC8vIGN1cnJlbnRseSBhc3NvY2lhdGVkIHdpdGgsIG9yIGEgbnVtYmVyLiBUaGUgbnVtYmVyIGluZGljYXRlcyB0aGF0IHdlIGFyZSBpblxuICAgIC8vIHRoZSBwcm9jZXNzIG9mIHNldHRpbmcgdXAgdGhlIG9ic2VydmUgKHVzaW5nIGEgbnVtYmVyIGluc3RlYWQgb2YgYSBzaW5nbGVcbiAgICAvLyBzZW50aW5lbCBhbGxvd3MgbXVsdGlwbGUgYXR0ZW1wdHMgdG8gc2V0IHVwIHRoZSBvYnNlcnZlIHRvIGlkZW50aWZ5IHdoaWNoXG4gICAgLy8gb25lIHdhcyB0aGVpcnMpLlxuICAgIHRoaXMuX3VzZXJPYnNlcnZlc0ZvckNvbm5lY3Rpb25zID0ge307XG4gICAgdGhpcy5fbmV4dFVzZXJPYnNlcnZlTnVtYmVyID0gMTsgIC8vIGZvciB0aGUgbnVtYmVyIGRlc2NyaWJlZCBhYm92ZS5cblxuICAgIC8vIGxpc3Qgb2YgYWxsIHJlZ2lzdGVyZWQgaGFuZGxlcnMuXG4gICAgdGhpcy5fbG9naW5IYW5kbGVycyA9IFtdO1xuICAgIHNldHVwRGVmYXVsdExvZ2luSGFuZGxlcnModGhpcyk7XG4gICAgc2V0RXhwaXJlVG9rZW5zSW50ZXJ2YWwodGhpcyk7XG5cbiAgICB0aGlzLl92YWxpZGF0ZUxvZ2luSG9vayA9IG5ldyBIb29rKHsgYmluZEVudmlyb25tZW50OiBmYWxzZSB9KTtcbiAgICB0aGlzLl92YWxpZGF0ZU5ld1VzZXJIb29rcyA9IFtcbiAgICAgIGRlZmF1bHRWYWxpZGF0ZU5ld1VzZXJIb29rLmJpbmQodGhpcylcbiAgICBdO1xuXG4gICAgdGhpcy5fZGVsZXRlU2F2ZWRUb2tlbnNGb3JBbGxVc2Vyc09uU3RhcnR1cCgpO1xuXG4gICAgdGhpcy5fc2tpcENhc2VJbnNlbnNpdGl2ZUNoZWNrc0ZvclRlc3QgPSB7fTtcblxuICAgIHRoaXMudXJscyA9IHtcbiAgICAgIHJlc2V0UGFzc3dvcmQ6ICh0b2tlbiwgZXh0cmFQYXJhbXMpID0+IHRoaXMuYnVpbGRFbWFpbFVybChgIy9yZXNldC1wYXNzd29yZC8ke3Rva2VufWAsIGV4dHJhUGFyYW1zKSxcbiAgICAgIHZlcmlmeUVtYWlsOiAodG9rZW4sIGV4dHJhUGFyYW1zKSA9PiB0aGlzLmJ1aWxkRW1haWxVcmwoYCMvdmVyaWZ5LWVtYWlsLyR7dG9rZW59YCwgZXh0cmFQYXJhbXMpLFxuICAgICAgbG9naW5Ub2tlbjogKHNlbGVjdG9yLCB0b2tlbiwgZXh0cmFQYXJhbXMpID0+XG4gICAgICAgIHRoaXMuYnVpbGRFbWFpbFVybChgLz9sb2dpblRva2VuPSR7dG9rZW59JnNlbGVjdG9yPSR7c2VsZWN0b3J9YCwgZXh0cmFQYXJhbXMpLFxuICAgICAgZW5yb2xsQWNjb3VudDogKHRva2VuLCBleHRyYVBhcmFtcykgPT4gdGhpcy5idWlsZEVtYWlsVXJsKGAjL2Vucm9sbC1hY2NvdW50LyR7dG9rZW59YCwgZXh0cmFQYXJhbXMpLFxuICAgIH07XG5cbiAgICB0aGlzLmFkZERlZmF1bHRSYXRlTGltaXQoKTtcblxuICAgIHRoaXMuYnVpbGRFbWFpbFVybCA9IChwYXRoLCBleHRyYVBhcmFtcyA9IHt9KSA9PiB7XG4gICAgICBjb25zdCB1cmwgPSBuZXcgVVJMKE1ldGVvci5hYnNvbHV0ZVVybChwYXRoKSk7XG4gICAgICBjb25zdCBwYXJhbXMgPSBPYmplY3QuZW50cmllcyhleHRyYVBhcmFtcyk7XG4gICAgICBpZiAocGFyYW1zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgLy8gQWRkIGFkZGl0aW9uYWwgcGFyYW1ldGVycyB0byB0aGUgdXJsXG4gICAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIHBhcmFtcykge1xuICAgICAgICAgIHVybC5zZWFyY2hQYXJhbXMuYXBwZW5kKGtleSwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdXJsLnRvU3RyaW5nKCk7XG4gICAgfTtcbiAgfVxuXG4gIC8vL1xuICAvLy8gQ1VSUkVOVCBVU0VSXG4gIC8vL1xuXG4gIC8vIEBvdmVycmlkZSBvZiBcImFic3RyYWN0XCIgbm9uLWltcGxlbWVudGF0aW9uIGluIGFjY291bnRzX2NvbW1vbi5qc1xuICB1c2VySWQoKSB7XG4gICAgLy8gVGhpcyBmdW5jdGlvbiBvbmx5IHdvcmtzIGlmIGNhbGxlZCBpbnNpZGUgYSBtZXRob2Qgb3IgYSBwdWJpY2F0aW9uLlxuICAgIC8vIFVzaW5nIGFueSBvZiB0aGUgaW5mb3JtYXRpb24gZnJvbSBNZXRlb3IudXNlcigpIGluIGEgbWV0aG9kIG9yXG4gICAgLy8gcHVibGlzaCBmdW5jdGlvbiB3aWxsIGFsd2F5cyB1c2UgdGhlIHZhbHVlIGZyb20gd2hlbiB0aGUgZnVuY3Rpb24gZmlyc3RcbiAgICAvLyBydW5zLiBUaGlzIGlzIGxpa2VseSBub3Qgd2hhdCB0aGUgdXNlciBleHBlY3RzLiBUaGUgd2F5IHRvIG1ha2UgdGhpcyB3b3JrXG4gICAgLy8gaW4gYSBtZXRob2Qgb3IgcHVibGlzaCBmdW5jdGlvbiBpcyB0byBkbyBNZXRlb3IuZmluZCh0aGlzLnVzZXJJZCkub2JzZXJ2ZVxuICAgIC8vIGFuZCByZWNvbXB1dGUgd2hlbiB0aGUgdXNlciByZWNvcmQgY2hhbmdlcy5cbiAgICBjb25zdCBjdXJyZW50SW52b2NhdGlvbiA9IEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uZ2V0KCkgfHwgRERQLl9DdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uLmdldCgpO1xuICAgIGlmICghY3VycmVudEludm9jYXRpb24pXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNZXRlb3IudXNlcklkIGNhbiBvbmx5IGJlIGludm9rZWQgaW4gbWV0aG9kIGNhbGxzIG9yIHB1YmxpY2F0aW9ucy5cIik7XG4gICAgcmV0dXJuIGN1cnJlbnRJbnZvY2F0aW9uLnVzZXJJZDtcbiAgfVxuXG4gIGFzeW5jIGluaXQoKSB7XG4gICAgYXdhaXQgc2V0dXBVc2Vyc0NvbGxlY3Rpb24odGhpcy51c2Vycyk7XG4gIH1cblxuICAvLy9cbiAgLy8vIExPR0lOIEhPT0tTXG4gIC8vL1xuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBWYWxpZGF0ZSBsb2dpbiBhdHRlbXB0cy5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIENhbGxlZCB3aGVuZXZlciBhIGxvZ2luIGlzIGF0dGVtcHRlZCAoZWl0aGVyIHN1Y2Nlc3NmdWwgb3IgdW5zdWNjZXNzZnVsKS4gIEEgbG9naW4gY2FuIGJlIGFib3J0ZWQgYnkgcmV0dXJuaW5nIGEgZmFsc3kgdmFsdWUgb3IgdGhyb3dpbmcgYW4gZXhjZXB0aW9uLlxuICAgKi9cbiAgdmFsaWRhdGVMb2dpbkF0dGVtcHQoZnVuYykge1xuICAgIC8vIEV4Y2VwdGlvbnMgaW5zaWRlIHRoZSBob29rIGNhbGxiYWNrIGFyZSBwYXNzZWQgdXAgdG8gdXMuXG4gICAgcmV0dXJuIHRoaXMuX3ZhbGlkYXRlTG9naW5Ib29rLnJlZ2lzdGVyKGZ1bmMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFNldCByZXN0cmljdGlvbnMgb24gbmV3IHVzZXIgY3JlYXRpb24uXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBDYWxsZWQgd2hlbmV2ZXIgYSBuZXcgdXNlciBpcyBjcmVhdGVkLiBUYWtlcyB0aGUgbmV3IHVzZXIgb2JqZWN0LCBhbmQgcmV0dXJucyB0cnVlIHRvIGFsbG93IHRoZSBjcmVhdGlvbiBvciBmYWxzZSB0byBhYm9ydC5cbiAgICovXG4gIHZhbGlkYXRlTmV3VXNlcihmdW5jKSB7XG4gICAgdGhpcy5fdmFsaWRhdGVOZXdVc2VySG9va3MucHVzaChmdW5jKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBWYWxpZGF0ZSBsb2dpbiBmcm9tIGV4dGVybmFsIHNlcnZpY2VcbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIENhbGxlZCB3aGVuZXZlciBsb2dpbi91c2VyIGNyZWF0aW9uIGZyb20gZXh0ZXJuYWwgc2VydmljZSBpcyBhdHRlbXB0ZWQuIExvZ2luIG9yIHVzZXIgY3JlYXRpb24gYmFzZWQgb24gdGhpcyBsb2dpbiBjYW4gYmUgYWJvcnRlZCBieSBwYXNzaW5nIGEgZmFsc3kgdmFsdWUgb3IgdGhyb3dpbmcgYW4gZXhjZXB0aW9uLlxuICAgKi9cbiAgYmVmb3JlRXh0ZXJuYWxMb2dpbihmdW5jKSB7XG4gICAgaWYgKHRoaXMuX2JlZm9yZUV4dGVybmFsTG9naW5Ib29rKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4gb25seSBjYWxsIGJlZm9yZUV4dGVybmFsTG9naW4gb25jZVwiKTtcbiAgICB9XG5cbiAgICB0aGlzLl9iZWZvcmVFeHRlcm5hbExvZ2luSG9vayA9IGZ1bmM7XG4gIH1cblxuICAvLy9cbiAgLy8vIENSRUFURSBVU0VSIEhPT0tTXG4gIC8vL1xuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDdXN0b21pemUgbG9naW4gdG9rZW4gY3JlYXRpb24uXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBDYWxsZWQgd2hlbmV2ZXIgYSBuZXcgdG9rZW4gaXMgY3JlYXRlZC5cbiAgICogUmV0dXJuIHRoZSBzZXF1ZW5jZSBhbmQgdGhlIHVzZXIgb2JqZWN0LiBSZXR1cm4gdHJ1ZSB0byBrZWVwIHNlbmRpbmcgdGhlIGRlZmF1bHQgZW1haWwsIG9yIGZhbHNlIHRvIG92ZXJyaWRlIHRoZSBiZWhhdmlvci5cbiAgICovXG4gIG9uQ3JlYXRlTG9naW5Ub2tlbiA9IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgICBpZiAodGhpcy5fb25DcmVhdGVMb2dpblRva2VuSG9vaykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW4gb25seSBjYWxsIG9uQ3JlYXRlTG9naW5Ub2tlbiBvbmNlJyk7XG4gICAgfVxuXG4gICAgdGhpcy5fb25DcmVhdGVMb2dpblRva2VuSG9vayA9IGZ1bmM7XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgQ3VzdG9taXplIG5ldyB1c2VyIGNyZWF0aW9uLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgQ2FsbGVkIHdoZW5ldmVyIGEgbmV3IHVzZXIgaXMgY3JlYXRlZC4gUmV0dXJuIHRoZSBuZXcgdXNlciBvYmplY3QsIG9yIHRocm93IGFuIGBFcnJvcmAgdG8gYWJvcnQgdGhlIGNyZWF0aW9uLlxuICAgKi9cbiAgb25DcmVhdGVVc2VyKGZ1bmMpIHtcbiAgICBpZiAodGhpcy5fb25DcmVhdGVVc2VySG9vaykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuIG9ubHkgY2FsbCBvbkNyZWF0ZVVzZXIgb25jZVwiKTtcbiAgICB9XG5cbiAgICB0aGlzLl9vbkNyZWF0ZVVzZXJIb29rID0gTWV0ZW9yLndyYXBGbihmdW5jKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDdXN0b21pemUgb2F1dGggdXNlciBwcm9maWxlIHVwZGF0ZXNcbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIENhbGxlZCB3aGVuZXZlciBhIHVzZXIgaXMgbG9nZ2VkIGluIHZpYSBvYXV0aC4gUmV0dXJuIHRoZSBwcm9maWxlIG9iamVjdCB0byBiZSBtZXJnZWQsIG9yIHRocm93IGFuIGBFcnJvcmAgdG8gYWJvcnQgdGhlIGNyZWF0aW9uLlxuICAgKi9cbiAgb25FeHRlcm5hbExvZ2luKGZ1bmMpIHtcbiAgICBpZiAodGhpcy5fb25FeHRlcm5hbExvZ2luSG9vaykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuIG9ubHkgY2FsbCBvbkV4dGVybmFsTG9naW4gb25jZVwiKTtcbiAgICB9XG5cbiAgICB0aGlzLl9vbkV4dGVybmFsTG9naW5Ib29rID0gZnVuYztcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDdXN0b21pemUgdXNlciBzZWxlY3Rpb24gb24gZXh0ZXJuYWwgbG9naW5zXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBDYWxsZWQgd2hlbmV2ZXIgYSB1c2VyIGlzIGxvZ2dlZCBpbiB2aWEgb2F1dGggYW5kIGFcbiAgICogdXNlciBpcyBub3QgZm91bmQgd2l0aCB0aGUgc2VydmljZSBpZC4gUmV0dXJuIHRoZSB1c2VyIG9yIHVuZGVmaW5lZC5cbiAgICovXG4gIHNldEFkZGl0aW9uYWxGaW5kVXNlck9uRXh0ZXJuYWxMb2dpbihmdW5jKSB7XG4gICAgaWYgKHRoaXMuX2FkZGl0aW9uYWxGaW5kVXNlck9uRXh0ZXJuYWxMb2dpbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuIG9ubHkgY2FsbCBzZXRBZGRpdGlvbmFsRmluZFVzZXJPbkV4dGVybmFsTG9naW4gb25jZVwiKTtcbiAgICB9XG4gICAgdGhpcy5fYWRkaXRpb25hbEZpbmRVc2VyT25FeHRlcm5hbExvZ2luID0gZnVuYztcbiAgfVxuXG4gIGFzeW5jIF92YWxpZGF0ZUxvZ2luKGNvbm5lY3Rpb24sIGF0dGVtcHQpIHtcbiAgICBhd2FpdCB0aGlzLl92YWxpZGF0ZUxvZ2luSG9vay5mb3JFYWNoQXN5bmMoYXN5bmMgKGNhbGxiYWNrKSA9PiB7XG4gICAgICBsZXQgcmV0O1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0ID0gYXdhaXQgY2FsbGJhY2soY2xvbmVBdHRlbXB0V2l0aENvbm5lY3Rpb24oY29ubmVjdGlvbiwgYXR0ZW1wdCkpO1xuICAgICAgfVxuICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgYXR0ZW1wdC5hbGxvd2VkID0gZmFsc2U7XG4gICAgICAgIC8vIFhYWCB0aGlzIG1lYW5zIHRoZSBsYXN0IHRocm93biBlcnJvciBvdmVycmlkZXMgcHJldmlvdXMgZXJyb3JcbiAgICAgICAgLy8gbWVzc2FnZXMuIE1heWJlIHRoaXMgaXMgc3VycHJpc2luZyB0byB1c2VycyBhbmQgd2Ugc2hvdWxkIG1ha2VcbiAgICAgICAgLy8gb3ZlcnJpZGluZyBlcnJvcnMgbW9yZSBleHBsaWNpdC4gKHNlZVxuICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9pc3N1ZXMvMTk2MClcbiAgICAgICAgYXR0ZW1wdC5lcnJvciA9IGU7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKCEgcmV0KSB7XG4gICAgICAgIGF0dGVtcHQuYWxsb3dlZCA9IGZhbHNlO1xuICAgICAgICAvLyBkb24ndCBvdmVycmlkZSBhIHNwZWNpZmljIGVycm9yIHByb3ZpZGVkIGJ5IGEgcHJldmlvdXNcbiAgICAgICAgLy8gdmFsaWRhdG9yIG9yIHRoZSBpbml0aWFsIGF0dGVtcHQgKGVnIFwiaW5jb3JyZWN0IHBhc3N3b3JkXCIpLlxuICAgICAgICBpZiAoIWF0dGVtcHQuZXJyb3IpXG4gICAgICAgICAgYXR0ZW1wdC5lcnJvciA9IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIkxvZ2luIGZvcmJpZGRlblwiKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0pO1xuICB9O1xuXG4gIGFzeW5jIF9zdWNjZXNzZnVsTG9naW4oY29ubmVjdGlvbiwgYXR0ZW1wdCkge1xuICAgIGF3YWl0IHRoaXMuX29uTG9naW5Ib29rLmZvckVhY2hBc3luYyhhc3luYyAoY2FsbGJhY2spID0+IHtcbiAgICAgIGF3YWl0IGNhbGxiYWNrKGNsb25lQXR0ZW1wdFdpdGhDb25uZWN0aW9uKGNvbm5lY3Rpb24sIGF0dGVtcHQpKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0pO1xuICB9O1xuXG4gIGFzeW5jIF9mYWlsZWRMb2dpbihjb25uZWN0aW9uLCBhdHRlbXB0KSB7XG4gICAgYXdhaXQgdGhpcy5fb25Mb2dpbkZhaWx1cmVIb29rLmZvckVhY2hBc3luYyhhc3luYyAoY2FsbGJhY2spID0+IHtcbiAgICAgIGF3YWl0IGNhbGxiYWNrKGNsb25lQXR0ZW1wdFdpdGhDb25uZWN0aW9uKGNvbm5lY3Rpb24sIGF0dGVtcHQpKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0pO1xuICB9O1xuXG4gIGFzeW5jIF9zdWNjZXNzZnVsTG9nb3V0KGNvbm5lY3Rpb24sIHVzZXJJZCkge1xuICAgIC8vIGRvbid0IGZldGNoIHRoZSB1c2VyIG9iamVjdCB1bmxlc3MgdGhlcmUgYXJlIHNvbWUgY2FsbGJhY2tzIHJlZ2lzdGVyZWRcbiAgICBsZXQgdXNlcjtcbiAgICBhd2FpdCB0aGlzLl9vbkxvZ291dEhvb2suZm9yRWFjaEFzeW5jKGFzeW5jIGNhbGxiYWNrID0+IHtcbiAgICAgIGlmICghdXNlciAmJiB1c2VySWQpIHVzZXIgPSBhd2FpdCB0aGlzLnVzZXJzLmZpbmRPbmVBc3luYyh1c2VySWQsIHsgZmllbGRzOiB0aGlzLl9vcHRpb25zLmRlZmF1bHRGaWVsZFNlbGVjdG9yIH0pO1xuICAgICAgY2FsbGJhY2soeyB1c2VyLCBjb25uZWN0aW9uIH0pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gR2VuZXJhdGVzIGEgTW9uZ29EQiBzZWxlY3RvciB0aGF0IGNhbiBiZSB1c2VkIHRvIHBlcmZvcm0gYSBmYXN0IGNhc2VcbiAgLy8gaW5zZW5zaXRpdmUgbG9va3VwIGZvciB0aGUgZ2l2ZW4gZmllbGROYW1lIGFuZCBzdHJpbmcuIFNpbmNlIE1vbmdvREIgZG9lc1xuICAvLyBub3Qgc3VwcG9ydCBjYXNlIGluc2Vuc2l0aXZlIGluZGV4ZXMsIGFuZCBjYXNlIGluc2Vuc2l0aXZlIHJlZ2V4IHF1ZXJpZXNcbiAgLy8gYXJlIHNsb3csIHdlIGNvbnN0cnVjdCBhIHNldCBvZiBwcmVmaXggc2VsZWN0b3JzIGZvciBhbGwgcGVybXV0YXRpb25zIG9mXG4gIC8vIHRoZSBmaXJzdCA0IGNoYXJhY3RlcnMgb3Vyc2VsdmVzLiBXZSBmaXJzdCBhdHRlbXB0IHRvIG1hdGNoaW5nIGFnYWluc3RcbiAgLy8gdGhlc2UsIGFuZCBiZWNhdXNlICdwcmVmaXggZXhwcmVzc2lvbicgcmVnZXggcXVlcmllcyBkbyB1c2UgaW5kZXhlcyAoc2VlXG4gIC8vIGh0dHA6Ly9kb2NzLm1vbmdvZGIub3JnL3YyLjYvcmVmZXJlbmNlL29wZXJhdG9yL3F1ZXJ5L3JlZ2V4LyNpbmRleC11c2UpLFxuICAvLyB0aGlzIGhhcyBiZWVuIGZvdW5kIHRvIGdyZWF0bHkgaW1wcm92ZSBwZXJmb3JtYW5jZSAoZnJvbSAxMjAwbXMgdG8gNW1zIGluIGFcbiAgLy8gdGVzdCB3aXRoIDEuMDAwLjAwMCB1c2VycykuXG4gIF9zZWxlY3RvckZvckZhc3RDYXNlSW5zZW5zaXRpdmVMb29rdXAgPSAoZmllbGROYW1lLCBzdHJpbmcpID0+IHtcbiAgICAvLyBQZXJmb3JtYW5jZSBzZWVtcyB0byBpbXByb3ZlIHVwIHRvIDQgcHJlZml4IGNoYXJhY3RlcnNcbiAgICBjb25zdCBwcmVmaXggPSBzdHJpbmcuc3Vic3RyaW5nKDAsIE1hdGgubWluKHN0cmluZy5sZW5ndGgsIDQpKTtcbiAgICBjb25zdCBvckNsYXVzZSA9IGdlbmVyYXRlQ2FzZVBlcm11dGF0aW9uc0ZvclN0cmluZyhwcmVmaXgpLm1hcChcbiAgICAgICAgcHJlZml4UGVybXV0YXRpb24gPT4ge1xuICAgICAgICAgIGNvbnN0IHNlbGVjdG9yID0ge307XG4gICAgICAgICAgc2VsZWN0b3JbZmllbGROYW1lXSA9XG4gICAgICAgICAgICAgIG5ldyBSZWdFeHAoYF4ke01ldGVvci5fZXNjYXBlUmVnRXhwKHByZWZpeFBlcm11dGF0aW9uKX1gKTtcbiAgICAgICAgICByZXR1cm4gc2VsZWN0b3I7XG4gICAgICAgIH0pO1xuICAgIGNvbnN0IGNhc2VJbnNlbnNpdGl2ZUNsYXVzZSA9IHt9O1xuICAgIGNhc2VJbnNlbnNpdGl2ZUNsYXVzZVtmaWVsZE5hbWVdID1cbiAgICAgICAgbmV3IFJlZ0V4cChgXiR7TWV0ZW9yLl9lc2NhcGVSZWdFeHAoc3RyaW5nKX0kYCwgJ2knKVxuICAgIHJldHVybiB7JGFuZDogW3skb3I6IG9yQ2xhdXNlfSwgY2FzZUluc2Vuc2l0aXZlQ2xhdXNlXX07XG4gIH1cblxuICBfZmluZFVzZXJCeVF1ZXJ5ID0gYXN5bmMgKHF1ZXJ5LCBvcHRpb25zKSA9PiB7XG4gICAgbGV0IHVzZXIgPSBudWxsO1xuXG4gICAgaWYgKHF1ZXJ5LmlkKSB7XG4gICAgICAvLyBkZWZhdWx0IGZpZWxkIHNlbGVjdG9yIGlzIGFkZGVkIHdpdGhpbiBnZXRVc2VyQnlJZCgpXG4gICAgICB1c2VyID0gYXdhaXQgTWV0ZW9yLnVzZXJzLmZpbmRPbmVBc3luYyhxdWVyeS5pZCwgdGhpcy5fYWRkRGVmYXVsdEZpZWxkU2VsZWN0b3Iob3B0aW9ucykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRpb25zID0gdGhpcy5fYWRkRGVmYXVsdEZpZWxkU2VsZWN0b3Iob3B0aW9ucyk7XG4gICAgICBsZXQgZmllbGROYW1lO1xuICAgICAgbGV0IGZpZWxkVmFsdWU7XG4gICAgICBpZiAocXVlcnkudXNlcm5hbWUpIHtcbiAgICAgICAgZmllbGROYW1lID0gJ3VzZXJuYW1lJztcbiAgICAgICAgZmllbGRWYWx1ZSA9IHF1ZXJ5LnVzZXJuYW1lO1xuICAgICAgfSBlbHNlIGlmIChxdWVyeS5lbWFpbCkge1xuICAgICAgICBmaWVsZE5hbWUgPSAnZW1haWxzLmFkZHJlc3MnO1xuICAgICAgICBmaWVsZFZhbHVlID0gcXVlcnkuZW1haWw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJzaG91bGRuJ3QgaGFwcGVuICh2YWxpZGF0aW9uIG1pc3NlZCBzb21ldGhpbmcpXCIpO1xuICAgICAgfVxuICAgICAgbGV0IHNlbGVjdG9yID0ge307XG4gICAgICBzZWxlY3RvcltmaWVsZE5hbWVdID0gZmllbGRWYWx1ZTtcbiAgICAgIHVzZXIgPSBhd2FpdCBNZXRlb3IudXNlcnMuZmluZE9uZUFzeW5jKHNlbGVjdG9yLCBvcHRpb25zKTtcbiAgICAgIC8vIElmIHVzZXIgaXMgbm90IGZvdW5kLCB0cnkgYSBjYXNlIGluc2Vuc2l0aXZlIGxvb2t1cFxuICAgICAgaWYgKCF1c2VyKSB7XG4gICAgICAgIHNlbGVjdG9yID0gdGhpcy5fc2VsZWN0b3JGb3JGYXN0Q2FzZUluc2Vuc2l0aXZlTG9va3VwKGZpZWxkTmFtZSwgZmllbGRWYWx1ZSk7XG4gICAgICAgIGNvbnN0IGNhbmRpZGF0ZVVzZXJzID0gYXdhaXQgTWV0ZW9yLnVzZXJzLmZpbmQoc2VsZWN0b3IsIHsgLi4ub3B0aW9ucywgbGltaXQ6IDIgfSkuZmV0Y2hBc3luYygpO1xuICAgICAgICAvLyBObyBtYXRjaCBpZiBtdWx0aXBsZSBjYW5kaWRhdGVzIGFyZSBmb3VuZFxuICAgICAgICBpZiAoY2FuZGlkYXRlVXNlcnMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgdXNlciA9IGNhbmRpZGF0ZVVzZXJzWzBdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHVzZXI7XG4gIH1cblxuICAvLy9cbiAgLy8vIExPR0lOIE1FVEhPRFNcbiAgLy8vXG5cbiAgLy8gTG9naW4gbWV0aG9kcyByZXR1cm4gdG8gdGhlIGNsaWVudCBhbiBvYmplY3QgY29udGFpbmluZyB0aGVzZVxuICAvLyBmaWVsZHMgd2hlbiB0aGUgdXNlciB3YXMgbG9nZ2VkIGluIHN1Y2Nlc3NmdWxseTpcbiAgLy9cbiAgLy8gICBpZDogdXNlcklkXG4gIC8vICAgdG9rZW46ICpcbiAgLy8gICB0b2tlbkV4cGlyZXM6ICpcbiAgLy9cbiAgLy8gdG9rZW5FeHBpcmVzIGlzIG9wdGlvbmFsIGFuZCBpbnRlbmRzIHRvIHByb3ZpZGUgYSBoaW50IHRvIHRoZVxuICAvLyBjbGllbnQgYXMgdG8gd2hlbiB0aGUgdG9rZW4gd2lsbCBleHBpcmUuIElmIG5vdCBwcm92aWRlZCwgdGhlXG4gIC8vIGNsaWVudCB3aWxsIGNhbGwgQWNjb3VudHMuX3Rva2VuRXhwaXJhdGlvbiwgcGFzc2luZyBpdCB0aGUgZGF0ZVxuICAvLyB0aGF0IGl0IHJlY2VpdmVkIHRoZSB0b2tlbi5cbiAgLy9cbiAgLy8gVGhlIGxvZ2luIG1ldGhvZCB3aWxsIHRocm93IGFuIGVycm9yIGJhY2sgdG8gdGhlIGNsaWVudCBpZiB0aGUgdXNlclxuICAvLyBmYWlsZWQgdG8gbG9nIGluLlxuICAvL1xuICAvL1xuICAvLyBMb2dpbiBoYW5kbGVycyBhbmQgc2VydmljZSBzcGVjaWZpYyBsb2dpbiBtZXRob2RzIHN1Y2ggYXNcbiAgLy8gYGNyZWF0ZVVzZXJgIGludGVybmFsbHkgcmV0dXJuIGEgYHJlc3VsdGAgb2JqZWN0IGNvbnRhaW5pbmcgdGhlc2VcbiAgLy8gZmllbGRzOlxuICAvL1xuICAvLyAgIHR5cGU6XG4gIC8vICAgICBvcHRpb25hbCBzdHJpbmc7IHRoZSBzZXJ2aWNlIG5hbWUsIG92ZXJyaWRlcyB0aGUgaGFuZGxlclxuICAvLyAgICAgZGVmYXVsdCBpZiBwcmVzZW50LlxuICAvL1xuICAvLyAgIGVycm9yOlxuICAvLyAgICAgZXhjZXB0aW9uOyBpZiB0aGUgdXNlciBpcyBub3QgYWxsb3dlZCB0byBsb2dpbiwgdGhlIHJlYXNvbiB3aHkuXG4gIC8vXG4gIC8vICAgdXNlcklkOlxuICAvLyAgICAgc3RyaW5nOyB0aGUgdXNlciBpZCBvZiB0aGUgdXNlciBhdHRlbXB0aW5nIHRvIGxvZ2luIChpZlxuICAvLyAgICAga25vd24pLCByZXF1aXJlZCBmb3IgYW4gYWxsb3dlZCBsb2dpbi5cbiAgLy9cbiAgLy8gICBvcHRpb25zOlxuICAvLyAgICAgb3B0aW9uYWwgb2JqZWN0IG1lcmdlZCBpbnRvIHRoZSByZXN1bHQgcmV0dXJuZWQgYnkgdGhlIGxvZ2luXG4gIC8vICAgICBtZXRob2Q7IHVzZWQgYnkgSEFNSyBmcm9tIFNSUC5cbiAgLy9cbiAgLy8gICBzdGFtcGVkTG9naW5Ub2tlbjpcbiAgLy8gICAgIG9wdGlvbmFsIG9iamVjdCB3aXRoIGB0b2tlbmAgYW5kIGB3aGVuYCBpbmRpY2F0aW5nIHRoZSBsb2dpblxuICAvLyAgICAgdG9rZW4gaXMgYWxyZWFkeSBwcmVzZW50IGluIHRoZSBkYXRhYmFzZSwgcmV0dXJuZWQgYnkgdGhlXG4gIC8vICAgICBcInJlc3VtZVwiIGxvZ2luIGhhbmRsZXIuXG4gIC8vXG4gIC8vIEZvciBjb252ZW5pZW5jZSwgbG9naW4gbWV0aG9kcyBjYW4gYWxzbyB0aHJvdyBhbiBleGNlcHRpb24sIHdoaWNoXG4gIC8vIGlzIGNvbnZlcnRlZCBpbnRvIGFuIHtlcnJvcn0gcmVzdWx0LiAgSG93ZXZlciwgaWYgdGhlIGlkIG9mIHRoZVxuICAvLyB1c2VyIGF0dGVtcHRpbmcgdGhlIGxvZ2luIGlzIGtub3duLCBhIHt1c2VySWQsIGVycm9yfSByZXN1bHQgc2hvdWxkXG4gIC8vIGJlIHJldHVybmVkIGluc3RlYWQgc2luY2UgdGhlIHVzZXIgaWQgaXMgbm90IGNhcHR1cmVkIHdoZW4gYW5cbiAgLy8gZXhjZXB0aW9uIGlzIHRocm93bi5cbiAgLy9cbiAgLy8gVGhpcyBpbnRlcm5hbCBgcmVzdWx0YCBvYmplY3QgaXMgYXV0b21hdGljYWxseSBjb252ZXJ0ZWQgaW50byB0aGVcbiAgLy8gcHVibGljIHtpZCwgdG9rZW4sIHRva2VuRXhwaXJlc30gb2JqZWN0IHJldHVybmVkIHRvIHRoZSBjbGllbnQuXG5cbiAgLy8gVHJ5IGEgbG9naW4gbWV0aG9kLCBjb252ZXJ0aW5nIHRocm93biBleGNlcHRpb25zIGludG8gYW4ge2Vycm9yfVxuICAvLyByZXN1bHQuICBUaGUgYHR5cGVgIGFyZ3VtZW50IGlzIGEgZGVmYXVsdCwgaW5zZXJ0ZWQgaW50byB0aGUgcmVzdWx0XG4gIC8vIG9iamVjdCBpZiBub3QgZXhwbGljaXRseSByZXR1cm5lZC5cbiAgLy9cbiAgLy8gTG9nIGluIGEgdXNlciBvbiBhIGNvbm5lY3Rpb24uXG4gIC8vXG4gIC8vIFdlIHVzZSB0aGUgbWV0aG9kIGludm9jYXRpb24gdG8gc2V0IHRoZSB1c2VyIGlkIG9uIHRoZSBjb25uZWN0aW9uLFxuICAvLyBub3QgdGhlIGNvbm5lY3Rpb24gb2JqZWN0IGRpcmVjdGx5LiBzZXRVc2VySWQgaXMgdGllZCB0byBtZXRob2RzIHRvXG4gIC8vIGVuZm9yY2UgY2xlYXIgb3JkZXJpbmcgb2YgbWV0aG9kIGFwcGxpY2F0aW9uICh1c2luZyB3YWl0IG1ldGhvZHMgb25cbiAgLy8gdGhlIGNsaWVudCwgYW5kIGEgbm8gc2V0VXNlcklkIGFmdGVyIHVuYmxvY2sgcmVzdHJpY3Rpb24gb24gdGhlXG4gIC8vIHNlcnZlcilcbiAgLy9cbiAgLy8gVGhlIGBzdGFtcGVkTG9naW5Ub2tlbmAgcGFyYW1ldGVyIGlzIG9wdGlvbmFsLiAgV2hlbiBwcmVzZW50LCBpdFxuICAvLyBpbmRpY2F0ZXMgdGhhdCB0aGUgbG9naW4gdG9rZW4gaGFzIGFscmVhZHkgYmVlbiBpbnNlcnRlZCBpbnRvIHRoZVxuICAvLyBkYXRhYmFzZSBhbmQgZG9lc24ndCBuZWVkIHRvIGJlIGluc2VydGVkIGFnYWluLiAgKEl0J3MgdXNlZCBieSB0aGVcbiAgLy8gXCJyZXN1bWVcIiBsb2dpbiBoYW5kbGVyKS5cbiAgYXN5bmMgX2xvZ2luVXNlcihtZXRob2RJbnZvY2F0aW9uLCB1c2VySWQsIHN0YW1wZWRMb2dpblRva2VuKSB7XG4gICAgaWYgKCEgc3RhbXBlZExvZ2luVG9rZW4pIHtcbiAgICAgIHN0YW1wZWRMb2dpblRva2VuID0gdGhpcy5fZ2VuZXJhdGVTdGFtcGVkTG9naW5Ub2tlbigpO1xuICAgICAgYXdhaXQgdGhpcy5faW5zZXJ0TG9naW5Ub2tlbih1c2VySWQsIHN0YW1wZWRMb2dpblRva2VuKTtcbiAgICB9XG5cbiAgICAvLyBUaGlzIG9yZGVyIChhbmQgdGhlIGF2b2lkYW5jZSBvZiB5aWVsZHMpIGlzIGltcG9ydGFudCB0byBtYWtlXG4gICAgLy8gc3VyZSB0aGF0IHdoZW4gcHVibGlzaCBmdW5jdGlvbnMgYXJlIHJlcnVuLCB0aGV5IHNlZSBhXG4gICAgLy8gY29uc2lzdGVudCB2aWV3IG9mIHRoZSB3b3JsZDogdGhlIHVzZXJJZCBpcyBzZXQgYW5kIG1hdGNoZXNcbiAgICAvLyB0aGUgbG9naW4gdG9rZW4gb24gdGhlIGNvbm5lY3Rpb24gKG5vdCB0aGF0IHRoZXJlIGlzXG4gICAgLy8gY3VycmVudGx5IGEgcHVibGljIEFQSSBmb3IgcmVhZGluZyB0aGUgbG9naW4gdG9rZW4gb24gYVxuICAgIC8vIGNvbm5lY3Rpb24pLlxuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKCgpID0+XG4gICAgICB0aGlzLl9zZXRMb2dpblRva2VuKFxuICAgICAgICB1c2VySWQsXG4gICAgICAgIG1ldGhvZEludm9jYXRpb24uY29ubmVjdGlvbixcbiAgICAgICAgdGhpcy5faGFzaExvZ2luVG9rZW4oc3RhbXBlZExvZ2luVG9rZW4udG9rZW4pXG4gICAgICApXG4gICAgKTtcblxuICAgIGF3YWl0IG1ldGhvZEludm9jYXRpb24uc2V0VXNlcklkKHVzZXJJZCk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgaWQ6IHVzZXJJZCxcbiAgICAgIHRva2VuOiBzdGFtcGVkTG9naW5Ub2tlbi50b2tlbixcbiAgICAgIHRva2VuRXhwaXJlczogdGhpcy5fdG9rZW5FeHBpcmF0aW9uKHN0YW1wZWRMb2dpblRva2VuLndoZW4pXG4gICAgfTtcbiAgfTtcblxuICAvLyBBZnRlciBhIGxvZ2luIG1ldGhvZCBoYXMgY29tcGxldGVkLCBjYWxsIHRoZSBsb2dpbiBob29rcy4gIE5vdGVcbiAgLy8gdGhhdCBgYXR0ZW1wdExvZ2luYCBpcyBjYWxsZWQgZm9yICphbGwqIGxvZ2luIGF0dGVtcHRzLCBldmVuIG9uZXNcbiAgLy8gd2hpY2ggYXJlbid0IHN1Y2Nlc3NmdWwgKHN1Y2ggYXMgYW4gaW52YWxpZCBwYXNzd29yZCwgZXRjKS5cbiAgLy9cbiAgLy8gSWYgdGhlIGxvZ2luIGlzIGFsbG93ZWQgYW5kIGlzbid0IGFib3J0ZWQgYnkgYSB2YWxpZGF0ZSBsb2dpbiBob29rXG4gIC8vIGNhbGxiYWNrLCBsb2cgaW4gdGhlIHVzZXIuXG4gIC8vXG4gIGFzeW5jIF9hdHRlbXB0TG9naW4oXG4gICAgbWV0aG9kSW52b2NhdGlvbixcbiAgICBtZXRob2ROYW1lLFxuICAgIG1ldGhvZEFyZ3MsXG4gICAgcmVzdWx0XG4gICkge1xuICAgIGlmICghcmVzdWx0KVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwicmVzdWx0IGlzIHJlcXVpcmVkXCIpO1xuXG4gICAgLy8gWFhYIEEgcHJvZ3JhbW1pbmcgZXJyb3IgaW4gYSBsb2dpbiBoYW5kbGVyIGNhbiBsZWFkIHRvIHRoaXMgb2NjdXJyaW5nLCBhbmRcbiAgICAvLyB0aGVuIHdlIGRvbid0IGNhbGwgb25Mb2dpbiBvciBvbkxvZ2luRmFpbHVyZSBjYWxsYmFja3MuIFNob3VsZFxuICAgIC8vIHRyeUxvZ2luTWV0aG9kIGNhdGNoIHRoaXMgY2FzZSBhbmQgdHVybiBpdCBpbnRvIGFuIGVycm9yP1xuICAgIGlmICghcmVzdWx0LnVzZXJJZCAmJiAhcmVzdWx0LmVycm9yKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQSBsb2dpbiBtZXRob2QgbXVzdCBzcGVjaWZ5IGEgdXNlcklkIG9yIGFuIGVycm9yXCIpO1xuXG4gICAgbGV0IHVzZXI7XG4gICAgaWYgKHJlc3VsdC51c2VySWQpXG4gICAgICB1c2VyID0gYXdhaXQgdGhpcy51c2Vycy5maW5kT25lQXN5bmMocmVzdWx0LnVzZXJJZCwge2ZpZWxkczogdGhpcy5fb3B0aW9ucy5kZWZhdWx0RmllbGRTZWxlY3Rvcn0pO1xuXG4gICAgY29uc3QgYXR0ZW1wdCA9IHtcbiAgICAgIHR5cGU6IHJlc3VsdC50eXBlIHx8IFwidW5rbm93blwiLFxuICAgICAgYWxsb3dlZDogISEgKHJlc3VsdC51c2VySWQgJiYgIXJlc3VsdC5lcnJvciksXG4gICAgICBtZXRob2ROYW1lOiBtZXRob2ROYW1lLFxuICAgICAgbWV0aG9kQXJndW1lbnRzOiBBcnJheS5mcm9tKG1ldGhvZEFyZ3MpXG4gICAgfTtcbiAgICBpZiAocmVzdWx0LmVycm9yKSB7XG4gICAgICBhdHRlbXB0LmVycm9yID0gcmVzdWx0LmVycm9yO1xuICAgIH1cbiAgICBpZiAodXNlcikge1xuICAgICAgYXR0ZW1wdC51c2VyID0gdXNlcjtcbiAgICB9XG5cbiAgICAvLyBfdmFsaWRhdGVMb2dpbiBtYXkgbXV0YXRlIGBhdHRlbXB0YCBieSBhZGRpbmcgYW4gZXJyb3IgYW5kIGNoYW5naW5nIGFsbG93ZWRcbiAgICAvLyB0byBmYWxzZSwgYnV0IHRoYXQncyB0aGUgb25seSBjaGFuZ2UgaXQgY2FuIG1ha2UgKGFuZCB0aGUgdXNlcidzIGNhbGxiYWNrc1xuICAgIC8vIG9ubHkgZ2V0IGEgY2xvbmUgb2YgYGF0dGVtcHRgKS5cbiAgICBhd2FpdCB0aGlzLl92YWxpZGF0ZUxvZ2luKG1ldGhvZEludm9jYXRpb24uY29ubmVjdGlvbiwgYXR0ZW1wdCk7XG5cbiAgICBpZiAoYXR0ZW1wdC5hbGxvd2VkKSB7XG4gICAgICBjb25zdCBvID0gYXdhaXQgdGhpcy5fbG9naW5Vc2VyKFxuICAgICAgICBtZXRob2RJbnZvY2F0aW9uLFxuICAgICAgICByZXN1bHQudXNlcklkLFxuICAgICAgICByZXN1bHQuc3RhbXBlZExvZ2luVG9rZW5cbiAgICAgIClcbiAgICAgIGNvbnN0IHJldCA9IHtcbiAgICAgICAgLi4ubyxcbiAgICAgICAgLi4ucmVzdWx0Lm9wdGlvbnNcbiAgICAgIH07XG4gICAgICByZXQudHlwZSA9IGF0dGVtcHQudHlwZTtcbiAgICAgIGF3YWl0IHRoaXMuX3N1Y2Nlc3NmdWxMb2dpbihtZXRob2RJbnZvY2F0aW9uLmNvbm5lY3Rpb24sIGF0dGVtcHQpO1xuICAgICAgcmV0dXJuIHJldDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBhd2FpdCB0aGlzLl9mYWlsZWRMb2dpbihtZXRob2RJbnZvY2F0aW9uLmNvbm5lY3Rpb24sIGF0dGVtcHQpO1xuICAgICAgdGhyb3cgYXR0ZW1wdC5lcnJvcjtcbiAgICB9XG4gIH07XG5cbiAgLy8gQWxsIHNlcnZpY2Ugc3BlY2lmaWMgbG9naW4gbWV0aG9kcyBzaG91bGQgZ28gdGhyb3VnaCB0aGlzIGZ1bmN0aW9uLlxuICAvLyBFbnN1cmUgdGhhdCB0aHJvd24gZXhjZXB0aW9ucyBhcmUgY2F1Z2h0IGFuZCB0aGF0IGxvZ2luIGhvb2tcbiAgLy8gY2FsbGJhY2tzIGFyZSBzdGlsbCBjYWxsZWQuXG4gIC8vXG4gIGFzeW5jIF9sb2dpbk1ldGhvZChcbiAgICBtZXRob2RJbnZvY2F0aW9uLFxuICAgIG1ldGhvZE5hbWUsXG4gICAgbWV0aG9kQXJncyxcbiAgICB0eXBlLFxuICAgIGZuXG4gICkge1xuICAgIHJldHVybiBhd2FpdCB0aGlzLl9hdHRlbXB0TG9naW4oXG4gICAgICBtZXRob2RJbnZvY2F0aW9uLFxuICAgICAgbWV0aG9kTmFtZSxcbiAgICAgIG1ldGhvZEFyZ3MsXG4gICAgICBhd2FpdCB0cnlMb2dpbk1ldGhvZCh0eXBlLCBmbilcbiAgICApO1xuICB9O1xuXG5cbiAgLy8gUmVwb3J0IGEgbG9naW4gYXR0ZW1wdCBmYWlsZWQgb3V0c2lkZSB0aGUgY29udGV4dCBvZiBhIG5vcm1hbCBsb2dpblxuICAvLyBtZXRob2QuIFRoaXMgaXMgZm9yIHVzZSBpbiB0aGUgY2FzZSB3aGVyZSB0aGVyZSBpcyBhIG11bHRpLXN0ZXAgbG9naW5cbiAgLy8gcHJvY2VkdXJlIChlZyBTUlAgYmFzZWQgcGFzc3dvcmQgbG9naW4pLiBJZiBhIG1ldGhvZCBlYXJseSBpbiB0aGVcbiAgLy8gY2hhaW4gZmFpbHMsIGl0IHNob3VsZCBjYWxsIHRoaXMgZnVuY3Rpb24gdG8gcmVwb3J0IGEgZmFpbHVyZS4gVGhlcmVcbiAgLy8gaXMgbm8gY29ycmVzcG9uZGluZyBtZXRob2QgZm9yIGEgc3VjY2Vzc2Z1bCBsb2dpbjsgbWV0aG9kcyB0aGF0IGNhblxuICAvLyBzdWNjZWVkIGF0IGxvZ2dpbmcgYSB1c2VyIGluIHNob3VsZCBhbHdheXMgYmUgYWN0dWFsIGxvZ2luIG1ldGhvZHNcbiAgLy8gKHVzaW5nIGVpdGhlciBBY2NvdW50cy5fbG9naW5NZXRob2Qgb3IgQWNjb3VudHMucmVnaXN0ZXJMb2dpbkhhbmRsZXIpLlxuICBhc3luYyBfcmVwb3J0TG9naW5GYWlsdXJlKFxuICAgIG1ldGhvZEludm9jYXRpb24sXG4gICAgbWV0aG9kTmFtZSxcbiAgICBtZXRob2RBcmdzLFxuICAgIHJlc3VsdFxuICApIHtcbiAgICBjb25zdCBhdHRlbXB0ID0ge1xuICAgICAgdHlwZTogcmVzdWx0LnR5cGUgfHwgXCJ1bmtub3duXCIsXG4gICAgICBhbGxvd2VkOiBmYWxzZSxcbiAgICAgIGVycm9yOiByZXN1bHQuZXJyb3IsXG4gICAgICBtZXRob2ROYW1lOiBtZXRob2ROYW1lLFxuICAgICAgbWV0aG9kQXJndW1lbnRzOiBBcnJheS5mcm9tKG1ldGhvZEFyZ3MpXG4gICAgfTtcblxuICAgIGlmIChyZXN1bHQudXNlcklkKSB7XG4gICAgICBhdHRlbXB0LnVzZXIgPSB0aGlzLnVzZXJzLmZpbmRPbmVBc3luYyhyZXN1bHQudXNlcklkLCB7ZmllbGRzOiB0aGlzLl9vcHRpb25zLmRlZmF1bHRGaWVsZFNlbGVjdG9yfSk7XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5fdmFsaWRhdGVMb2dpbihtZXRob2RJbnZvY2F0aW9uLmNvbm5lY3Rpb24sIGF0dGVtcHQpO1xuICAgIGF3YWl0IHRoaXMuX2ZhaWxlZExvZ2luKG1ldGhvZEludm9jYXRpb24uY29ubmVjdGlvbiwgYXR0ZW1wdCk7XG5cbiAgICAvLyBfdmFsaWRhdGVMb2dpbiBtYXkgbXV0YXRlIGF0dGVtcHQgdG8gc2V0IGEgbmV3IGVycm9yIG1lc3NhZ2UuIFJldHVyblxuICAgIC8vIHRoZSBtb2RpZmllZCB2ZXJzaW9uLlxuICAgIHJldHVybiBhdHRlbXB0O1xuICB9O1xuXG4gIC8vL1xuICAvLy8gTE9HSU4gSEFORExFUlNcbiAgLy8vXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFJlZ2lzdGVycyBhIG5ldyBsb2dpbiBoYW5kbGVyLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBbbmFtZV0gVGhlIHR5cGUgb2YgbG9naW4gbWV0aG9kIGxpa2Ugb2F1dGgsIHBhc3N3b3JkLCBldGMuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGhhbmRsZXIgQSBmdW5jdGlvbiB0aGF0IHJlY2VpdmVzIGFuIG9wdGlvbnMgb2JqZWN0XG4gICAqIChhcyBwYXNzZWQgYXMgYW4gYXJndW1lbnQgdG8gdGhlIGBsb2dpbmAgbWV0aG9kKSBhbmQgcmV0dXJucyBvbmUgb2ZcbiAgICogYHVuZGVmaW5lZGAsIG1lYW5pbmcgZG9uJ3QgaGFuZGxlIG9yIGEgbG9naW4gbWV0aG9kIHJlc3VsdCBvYmplY3QuXG4gICAqL1xuICByZWdpc3RlckxvZ2luSGFuZGxlcihuYW1lLCBoYW5kbGVyKSB7XG4gICAgaWYgKCEgaGFuZGxlcikge1xuICAgICAgaGFuZGxlciA9IG5hbWU7XG4gICAgICBuYW1lID0gbnVsbDtcbiAgICB9XG5cbiAgICB0aGlzLl9sb2dpbkhhbmRsZXJzLnB1c2goe1xuICAgICAgbmFtZTogbmFtZSxcbiAgICAgIGhhbmRsZXI6IE1ldGVvci53cmFwRm4oaGFuZGxlcilcbiAgICB9KTtcbiAgfTtcblxuXG4gIC8vIENoZWNrcyBhIHVzZXIncyBjcmVkZW50aWFscyBhZ2FpbnN0IGFsbCB0aGUgcmVnaXN0ZXJlZCBsb2dpblxuICAvLyBoYW5kbGVycywgYW5kIHJldHVybnMgYSBsb2dpbiB0b2tlbiBpZiB0aGUgY3JlZGVudGlhbHMgYXJlIHZhbGlkLiBJdFxuICAvLyBpcyBsaWtlIHRoZSBsb2dpbiBtZXRob2QsIGV4Y2VwdCB0aGF0IGl0IGRvZXNuJ3Qgc2V0IHRoZSBsb2dnZWQtaW5cbiAgLy8gdXNlciBvbiB0aGUgY29ubmVjdGlvbi4gVGhyb3dzIGEgTWV0ZW9yLkVycm9yIGlmIGxvZ2dpbmcgaW4gZmFpbHMsXG4gIC8vIGluY2x1ZGluZyB0aGUgY2FzZSB3aGVyZSBub25lIG9mIHRoZSBsb2dpbiBoYW5kbGVycyBoYW5kbGVkIHRoZSBsb2dpblxuICAvLyByZXF1ZXN0LiBPdGhlcndpc2UsIHJldHVybnMge2lkOiB1c2VySWQsIHRva2VuOiAqLCB0b2tlbkV4cGlyZXM6ICp9LlxuICAvL1xuICAvLyBGb3IgZXhhbXBsZSwgaWYgeW91IHdhbnQgdG8gbG9naW4gd2l0aCBhIHBsYWludGV4dCBwYXNzd29yZCwgYG9wdGlvbnNgIGNvdWxkIGJlXG4gIC8vICAgeyB1c2VyOiB7IHVzZXJuYW1lOiA8dXNlcm5hbWU+IH0sIHBhc3N3b3JkOiA8cGFzc3dvcmQ+IH0sIG9yXG4gIC8vICAgeyB1c2VyOiB7IGVtYWlsOiA8ZW1haWw+IH0sIHBhc3N3b3JkOiA8cGFzc3dvcmQ+IH0uXG5cbiAgLy8gVHJ5IGFsbCBvZiB0aGUgcmVnaXN0ZXJlZCBsb2dpbiBoYW5kbGVycyB1bnRpbCBvbmUgb2YgdGhlbSBkb2Vzbid0XG4gIC8vIHJldHVybiBgdW5kZWZpbmVkYCwgbWVhbmluZyBpdCBoYW5kbGVkIHRoaXMgY2FsbCB0byBgbG9naW5gLiBSZXR1cm5cbiAgLy8gdGhhdCByZXR1cm4gdmFsdWUuXG4gIGFzeW5jIF9ydW5Mb2dpbkhhbmRsZXJzKG1ldGhvZEludm9jYXRpb24sIG9wdGlvbnMpIHtcbiAgICBmb3IgKGxldCBoYW5kbGVyIG9mIHRoaXMuX2xvZ2luSGFuZGxlcnMpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRyeUxvZ2luTWV0aG9kKGhhbmRsZXIubmFtZSwgYXN5bmMgKCkgPT5cbiAgICAgICAgYXdhaXQgaGFuZGxlci5oYW5kbGVyLmNhbGwobWV0aG9kSW52b2NhdGlvbiwgb3B0aW9ucylcbiAgICAgICk7XG5cbiAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cblxuICAgICAgaWYgKHJlc3VsdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoXG4gICAgICAgICAgNDAwLFxuICAgICAgICAgICdBIGxvZ2luIGhhbmRsZXIgc2hvdWxkIHJldHVybiBhIHJlc3VsdCBvciB1bmRlZmluZWQnXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6IG51bGwsXG4gICAgICBlcnJvcjogbmV3IE1ldGVvci5FcnJvcig0MDAsIFwiVW5yZWNvZ25pemVkIG9wdGlvbnMgZm9yIGxvZ2luIHJlcXVlc3RcIilcbiAgICB9O1xuICB9O1xuXG4gIC8vIERlbGV0ZXMgdGhlIGdpdmVuIGxvZ2luVG9rZW4gZnJvbSB0aGUgZGF0YWJhc2UuXG4gIC8vXG4gIC8vIEZvciBuZXctc3R5bGUgaGFzaGVkIHRva2VuLCB0aGlzIHdpbGwgY2F1c2UgYWxsIGNvbm5lY3Rpb25zXG4gIC8vIGFzc29jaWF0ZWQgd2l0aCB0aGUgdG9rZW4gdG8gYmUgY2xvc2VkLlxuICAvL1xuICAvLyBBbnkgY29ubmVjdGlvbnMgYXNzb2NpYXRlZCB3aXRoIG9sZC1zdHlsZSB1bmhhc2hlZCB0b2tlbnMgd2lsbCBiZVxuICAvLyBpbiB0aGUgcHJvY2VzcyBvZiBiZWNvbWluZyBhc3NvY2lhdGVkIHdpdGggaGFzaGVkIHRva2VucyBhbmQgdGhlblxuICAvLyB0aGV5J2xsIGdldCBjbG9zZWQuXG4gIGFzeW5jIGRlc3Ryb3lUb2tlbih1c2VySWQsIGxvZ2luVG9rZW4pIHtcbiAgICBhd2FpdCB0aGlzLnVzZXJzLnVwZGF0ZUFzeW5jKHVzZXJJZCwge1xuICAgICAgJHB1bGw6IHtcbiAgICAgICAgXCJzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnNcIjoge1xuICAgICAgICAgICRvcjogW1xuICAgICAgICAgICAgeyBoYXNoZWRUb2tlbjogbG9naW5Ub2tlbiB9LFxuICAgICAgICAgICAgeyB0b2tlbjogbG9naW5Ub2tlbiB9XG4gICAgICAgICAgXVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH07XG5cbiAgX2luaXRTZXJ2ZXJNZXRob2RzKCkge1xuICAgIC8vIFRoZSBtZXRob2RzIGNyZWF0ZWQgaW4gdGhpcyBmdW5jdGlvbiBuZWVkIHRvIGJlIGNyZWF0ZWQgaGVyZSBzbyB0aGF0XG4gICAgLy8gdGhpcyB2YXJpYWJsZSBpcyBhdmFpbGFibGUgaW4gdGhlaXIgc2NvcGUuXG4gICAgY29uc3QgYWNjb3VudHMgPSB0aGlzO1xuXG5cbiAgICAvLyBUaGlzIG9iamVjdCB3aWxsIGJlIHBvcHVsYXRlZCB3aXRoIG1ldGhvZHMgYW5kIHRoZW4gcGFzc2VkIHRvXG4gICAgLy8gYWNjb3VudHMuX3NlcnZlci5tZXRob2RzIGZ1cnRoZXIgYmVsb3cuXG4gICAgY29uc3QgbWV0aG9kcyA9IHt9O1xuXG4gICAgLy8gQHJldHVybnMge09iamVjdHxudWxsfVxuICAgIC8vICAgSWYgc3VjY2Vzc2Z1bCwgcmV0dXJucyB7dG9rZW46IHJlY29ubmVjdFRva2VuLCBpZDogdXNlcklkfVxuICAgIC8vICAgSWYgdW5zdWNjZXNzZnVsIChmb3IgZXhhbXBsZSwgaWYgdGhlIHVzZXIgY2xvc2VkIHRoZSBvYXV0aCBsb2dpbiBwb3B1cCksXG4gICAgLy8gICAgIHRocm93cyBhbiBlcnJvciBkZXNjcmliaW5nIHRoZSByZWFzb25cbiAgICBtZXRob2RzLmxvZ2luID0gYXN5bmMgZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgIC8vIExvZ2luIGhhbmRsZXJzIHNob3VsZCByZWFsbHkgYWxzbyBjaGVjayB3aGF0ZXZlciBmaWVsZCB0aGV5IGxvb2sgYXQgaW5cbiAgICAgIC8vIG9wdGlvbnMsIGJ1dCB3ZSBkb24ndCBlbmZvcmNlIGl0LlxuICAgICAgY2hlY2sob3B0aW9ucywgT2JqZWN0KTtcblxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYWNjb3VudHMuX3J1bkxvZ2luSGFuZGxlcnModGhpcywgb3B0aW9ucyk7XG4gICAgICAvL2NvbnNvbGUubG9nKHtyZXN1bHR9KTtcblxuICAgICAgcmV0dXJuIGF3YWl0IGFjY291bnRzLl9hdHRlbXB0TG9naW4odGhpcywgXCJsb2dpblwiLCBhcmd1bWVudHMsIHJlc3VsdCk7XG4gICAgfTtcblxuICAgIG1ldGhvZHMubG9nb3V0ID0gYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgY29uc3QgdG9rZW4gPSBhY2NvdW50cy5fZ2V0TG9naW5Ub2tlbih0aGlzLmNvbm5lY3Rpb24uaWQpO1xuICAgICAgYWNjb3VudHMuX3NldExvZ2luVG9rZW4odGhpcy51c2VySWQsIHRoaXMuY29ubmVjdGlvbiwgbnVsbCk7XG4gICAgICBpZiAodG9rZW4gJiYgdGhpcy51c2VySWQpIHtcbiAgICAgICBhd2FpdCBhY2NvdW50cy5kZXN0cm95VG9rZW4odGhpcy51c2VySWQsIHRva2VuKTtcbiAgICAgIH1cbiAgICAgIGF3YWl0IGFjY291bnRzLl9zdWNjZXNzZnVsTG9nb3V0KHRoaXMuY29ubmVjdGlvbiwgdGhpcy51c2VySWQpO1xuICAgICAgYXdhaXQgdGhpcy5zZXRVc2VySWQobnVsbCk7XG4gICAgfTtcblxuICAgIC8vIEdlbmVyYXRlcyBhIG5ldyBsb2dpbiB0b2tlbiB3aXRoIHRoZSBzYW1lIGV4cGlyYXRpb24gYXMgdGhlXG4gICAgLy8gY29ubmVjdGlvbidzIGN1cnJlbnQgdG9rZW4gYW5kIHNhdmVzIGl0IHRvIHRoZSBkYXRhYmFzZS4gQXNzb2NpYXRlc1xuICAgIC8vIHRoZSBjb25uZWN0aW9uIHdpdGggdGhpcyBuZXcgdG9rZW4gYW5kIHJldHVybnMgaXQuIFRocm93cyBhbiBlcnJvclxuICAgIC8vIGlmIGNhbGxlZCBvbiBhIGNvbm5lY3Rpb24gdGhhdCBpc24ndCBsb2dnZWQgaW4uXG4gICAgLy9cbiAgICAvLyBAcmV0dXJucyBPYmplY3RcbiAgICAvLyAgIElmIHN1Y2Nlc3NmdWwsIHJldHVybnMgeyB0b2tlbjogPG5ldyB0b2tlbj4sIGlkOiA8dXNlciBpZD4sXG4gICAgLy8gICB0b2tlbkV4cGlyZXM6IDxleHBpcmF0aW9uIGRhdGU+IH0uXG4gICAgbWV0aG9kcy5nZXROZXdUb2tlbiA9IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBhY2NvdW50cy51c2Vycy5maW5kT25lQXN5bmModGhpcy51c2VySWQsIHtcbiAgICAgICAgZmllbGRzOiB7IFwic2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zXCI6IDEgfVxuICAgICAgfSk7XG4gICAgICBpZiAoISB0aGlzLnVzZXJJZCB8fCAhIHVzZXIpIHtcbiAgICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcihcIllvdSBhcmUgbm90IGxvZ2dlZCBpbi5cIik7XG4gICAgICB9XG4gICAgICAvLyBCZSBjYXJlZnVsIG5vdCB0byBnZW5lcmF0ZSBhIG5ldyB0b2tlbiB0aGF0IGhhcyBhIGxhdGVyXG4gICAgICAvLyBleHBpcmF0aW9uIHRoYW4gdGhlIGN1cnJlbiB0b2tlbi4gT3RoZXJ3aXNlLCBhIGJhZCBndXkgd2l0aCBhXG4gICAgICAvLyBzdG9sZW4gdG9rZW4gY291bGQgdXNlIHRoaXMgbWV0aG9kIHRvIHN0b3AgaGlzIHN0b2xlbiB0b2tlbiBmcm9tXG4gICAgICAvLyBldmVyIGV4cGlyaW5nLlxuICAgICAgY29uc3QgY3VycmVudEhhc2hlZFRva2VuID0gYWNjb3VudHMuX2dldExvZ2luVG9rZW4odGhpcy5jb25uZWN0aW9uLmlkKTtcbiAgICAgIGNvbnN0IGN1cnJlbnRTdGFtcGVkVG9rZW4gPSB1c2VyLnNlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vucy5maW5kKFxuICAgICAgICBzdGFtcGVkVG9rZW4gPT4gc3RhbXBlZFRva2VuLmhhc2hlZFRva2VuID09PSBjdXJyZW50SGFzaGVkVG9rZW5cbiAgICAgICk7XG4gICAgICBpZiAoISBjdXJyZW50U3RhbXBlZFRva2VuKSB7IC8vIHNhZmV0eSBiZWx0OiB0aGlzIHNob3VsZCBuZXZlciBoYXBwZW5cbiAgICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcihcIkludmFsaWQgbG9naW4gdG9rZW5cIik7XG4gICAgICB9XG4gICAgICBjb25zdCBuZXdTdGFtcGVkVG9rZW4gPSBhY2NvdW50cy5fZ2VuZXJhdGVTdGFtcGVkTG9naW5Ub2tlbigpO1xuICAgICAgbmV3U3RhbXBlZFRva2VuLndoZW4gPSBjdXJyZW50U3RhbXBlZFRva2VuLndoZW47XG4gICAgICBhd2FpdCBhY2NvdW50cy5faW5zZXJ0TG9naW5Ub2tlbih0aGlzLnVzZXJJZCwgbmV3U3RhbXBlZFRva2VuKTtcbiAgICAgIHJldHVybiBhd2FpdCBhY2NvdW50cy5fbG9naW5Vc2VyKHRoaXMsIHRoaXMudXNlcklkLCBuZXdTdGFtcGVkVG9rZW4pO1xuICAgIH07XG5cbiAgICAvLyBSZW1vdmVzIGFsbCB0b2tlbnMgZXhjZXB0IHRoZSB0b2tlbiBhc3NvY2lhdGVkIHdpdGggdGhlIGN1cnJlbnRcbiAgICAvLyBjb25uZWN0aW9uLiBUaHJvd3MgYW4gZXJyb3IgaWYgdGhlIGNvbm5lY3Rpb24gaXMgbm90IGxvZ2dlZFxuICAgIC8vIGluLiBSZXR1cm5zIG5vdGhpbmcgb24gc3VjY2Vzcy5cbiAgICBtZXRob2RzLnJlbW92ZU90aGVyVG9rZW5zID0gYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKCEgdGhpcy51c2VySWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcihcIllvdSBhcmUgbm90IGxvZ2dlZCBpbi5cIik7XG4gICAgICB9XG4gICAgICBjb25zdCBjdXJyZW50VG9rZW4gPSBhY2NvdW50cy5fZ2V0TG9naW5Ub2tlbih0aGlzLmNvbm5lY3Rpb24uaWQpO1xuICAgICAgYXdhaXQgYWNjb3VudHMudXNlcnMudXBkYXRlQXN5bmModGhpcy51c2VySWQsIHtcbiAgICAgICAgJHB1bGw6IHtcbiAgICAgICAgICBcInNlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vuc1wiOiB7IGhhc2hlZFRva2VuOiB7ICRuZTogY3VycmVudFRva2VuIH0gfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgLy8gQWxsb3cgYSBvbmUtdGltZSBjb25maWd1cmF0aW9uIGZvciBhIGxvZ2luIHNlcnZpY2UuIE1vZGlmaWNhdGlvbnNcbiAgICAvLyB0byB0aGlzIGNvbGxlY3Rpb24gYXJlIGFsc28gYWxsb3dlZCBpbiBpbnNlY3VyZSBtb2RlLlxuICAgIG1ldGhvZHMuY29uZmlndXJlTG9naW5TZXJ2aWNlID0gYXN5bmMgKG9wdGlvbnMpID0+IHtcbiAgICAgIGNoZWNrKG9wdGlvbnMsIE1hdGNoLk9iamVjdEluY2x1ZGluZyh7c2VydmljZTogU3RyaW5nfSkpO1xuICAgICAgLy8gRG9uJ3QgbGV0IHJhbmRvbSB1c2VycyBjb25maWd1cmUgYSBzZXJ2aWNlIHdlIGhhdmVuJ3QgYWRkZWQgeWV0IChzb1xuICAgICAgLy8gdGhhdCB3aGVuIHdlIGRvIGxhdGVyIGFkZCBpdCwgaXQncyBzZXQgdXAgd2l0aCB0aGVpciBjb25maWd1cmF0aW9uXG4gICAgICAvLyBpbnN0ZWFkIG9mIG91cnMpLlxuICAgICAgLy8gWFhYIGlmIHNlcnZpY2UgY29uZmlndXJhdGlvbiBpcyBvYXV0aC1zcGVjaWZpYyB0aGVuIHRoaXMgY29kZSBzaG91bGRcbiAgICAgIC8vICAgICBiZSBpbiBhY2NvdW50cy1vYXV0aDsgaWYgaXQncyBub3QgdGhlbiB0aGUgcmVnaXN0cnkgc2hvdWxkIGJlXG4gICAgICAvLyAgICAgaW4gdGhpcyBwYWNrYWdlXG4gICAgICBpZiAoIShhY2NvdW50cy5vYXV0aFxuICAgICAgICAmJiBhY2NvdW50cy5vYXV0aC5zZXJ2aWNlTmFtZXMoKS5pbmNsdWRlcyhvcHRpb25zLnNlcnZpY2UpKSkge1xuICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJTZXJ2aWNlIHVua25vd25cIik7XG4gICAgICB9XG5cbiAgICAgIGlmIChQYWNrYWdlWydzZXJ2aWNlLWNvbmZpZ3VyYXRpb24nXSkge1xuICAgICAgICBjb25zdCB7IFNlcnZpY2VDb25maWd1cmF0aW9uIH0gPSBQYWNrYWdlWydzZXJ2aWNlLWNvbmZpZ3VyYXRpb24nXTtcbiAgICAgICAgY29uc3Qgc2VydmljZSA9IGF3YWl0IFNlcnZpY2VDb25maWd1cmF0aW9uLmNvbmZpZ3VyYXRpb25zLmZpbmRPbmVBc3luYyh7c2VydmljZTogb3B0aW9ucy5zZXJ2aWNlfSlcbiAgICAgICAgaWYgKHNlcnZpY2UpXG4gICAgICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDMsIGBTZXJ2aWNlICR7b3B0aW9ucy5zZXJ2aWNlfSBhbHJlYWR5IGNvbmZpZ3VyZWRgKTtcblxuICAgICAgICBpZiAoUGFja2FnZVtcIm9hdXRoLWVuY3J5cHRpb25cIl0pIHtcbiAgICAgICAgICBjb25zdCB7IE9BdXRoRW5jcnlwdGlvbiB9ID0gUGFja2FnZVtcIm9hdXRoLWVuY3J5cHRpb25cIl1cbiAgICAgICAgICBpZiAoaGFzT3duLmNhbGwob3B0aW9ucywgJ3NlY3JldCcpICYmIE9BdXRoRW5jcnlwdGlvbi5rZXlJc0xvYWRlZCgpKVxuICAgICAgICAgICAgb3B0aW9ucy5zZWNyZXQgPSBPQXV0aEVuY3J5cHRpb24uc2VhbChvcHRpb25zLnNlY3JldCk7XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCBTZXJ2aWNlQ29uZmlndXJhdGlvbi5jb25maWd1cmF0aW9ucy5pbnNlcnRBc3luYyhvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgYWNjb3VudHMuX3NlcnZlci5tZXRob2RzKG1ldGhvZHMpO1xuICB9O1xuXG4gIF9pbml0QWNjb3VudERhdGFIb29rcygpIHtcbiAgICB0aGlzLl9zZXJ2ZXIub25Db25uZWN0aW9uKGNvbm5lY3Rpb24gPT4ge1xuICAgICAgdGhpcy5fYWNjb3VudERhdGFbY29ubmVjdGlvbi5pZF0gPSB7XG4gICAgICAgIGNvbm5lY3Rpb246IGNvbm5lY3Rpb25cbiAgICAgIH07XG5cbiAgICAgIGNvbm5lY3Rpb24ub25DbG9zZSgoKSA9PiB7XG4gICAgICAgIHRoaXMuX3JlbW92ZVRva2VuRnJvbUNvbm5lY3Rpb24oY29ubmVjdGlvbi5pZCk7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9hY2NvdW50RGF0YVtjb25uZWN0aW9uLmlkXTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9O1xuXG4gIF9pbml0U2VydmVyUHVibGljYXRpb25zKCkge1xuICAgIC8vIEJyaW5nIGludG8gbGV4aWNhbCBzY29wZSBmb3IgcHVibGlzaCBjYWxsYmFja3MgdGhhdCBuZWVkIGB0aGlzYFxuICAgIGNvbnN0IHsgdXNlcnMsIF9hdXRvcHVibGlzaEZpZWxkcywgX2RlZmF1bHRQdWJsaXNoRmllbGRzIH0gPSB0aGlzO1xuXG4gICAgLy8gUHVibGlzaCBhbGwgbG9naW4gc2VydmljZSBjb25maWd1cmF0aW9uIGZpZWxkcyBvdGhlciB0aGFuIHNlY3JldC5cbiAgICB0aGlzLl9zZXJ2ZXIucHVibGlzaChcIm1ldGVvci5sb2dpblNlcnZpY2VDb25maWd1cmF0aW9uXCIsIGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKFBhY2thZ2VbJ3NlcnZpY2UtY29uZmlndXJhdGlvbiddKSB7XG4gICAgICAgIGNvbnN0IHsgU2VydmljZUNvbmZpZ3VyYXRpb24gfSA9IFBhY2thZ2VbJ3NlcnZpY2UtY29uZmlndXJhdGlvbiddO1xuICAgICAgICByZXR1cm4gU2VydmljZUNvbmZpZ3VyYXRpb24uY29uZmlndXJhdGlvbnMuZmluZCh7fSwge2ZpZWxkczoge3NlY3JldDogMH19KTtcbiAgICAgIH1cbiAgICAgIHRoaXMucmVhZHkoKTtcbiAgICB9LCB7aXNfYXV0bzogdHJ1ZX0pOyAvLyBub3QgdGVjaG5pY2FsbHkgYXV0b3B1Ymxpc2gsIGJ1dCBzdG9wcyB0aGUgd2FybmluZy5cblxuICAgIC8vIFVzZSBNZXRlb3Iuc3RhcnR1cCB0byBnaXZlIG90aGVyIHBhY2thZ2VzIGEgY2hhbmNlIHRvIGNhbGxcbiAgICAvLyBzZXREZWZhdWx0UHVibGlzaEZpZWxkcy5cbiAgICBNZXRlb3Iuc3RhcnR1cCgoKSA9PiB7XG4gICAgICAvLyBNZXJnZSBjdXN0b20gZmllbGRzIHNlbGVjdG9yIGFuZCBkZWZhdWx0IHB1Ymxpc2ggZmllbGRzIHNvIHRoYXQgdGhlIGNsaWVudFxuICAgICAgLy8gZ2V0cyBhbGwgdGhlIG5lY2Vzc2FyeSBmaWVsZHMgdG8gcnVuIHByb3Blcmx5XG4gICAgICBjb25zdCBjdXN0b21GaWVsZHMgPSB0aGlzLl9hZGREZWZhdWx0RmllbGRTZWxlY3RvcigpLmZpZWxkcyB8fCB7fTtcbiAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhjdXN0b21GaWVsZHMpO1xuICAgICAgLy8gSWYgdGhlIGN1c3RvbSBmaWVsZHMgYXJlIG5lZ2F0aXZlLCB0aGVuIGlnbm9yZSB0aGVtIGFuZCBvbmx5IHNlbmQgdGhlIG5lY2Vzc2FyeSBmaWVsZHNcbiAgICAgIGNvbnN0IGZpZWxkcyA9IGtleXMubGVuZ3RoID4gMCAmJiBjdXN0b21GaWVsZHNba2V5c1swXV0gPyB7XG4gICAgICAgIC4uLnRoaXMuX2FkZERlZmF1bHRGaWVsZFNlbGVjdG9yKCkuZmllbGRzLFxuICAgICAgICAuLi5fZGVmYXVsdFB1Ymxpc2hGaWVsZHMucHJvamVjdGlvblxuICAgICAgfSA6IF9kZWZhdWx0UHVibGlzaEZpZWxkcy5wcm9qZWN0aW9uXG4gICAgICAvLyBQdWJsaXNoIHRoZSBjdXJyZW50IHVzZXIncyByZWNvcmQgdG8gdGhlIGNsaWVudC5cbiAgICAgIHRoaXMuX3NlcnZlci5wdWJsaXNoKG51bGwsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHRoaXMudXNlcklkKSB7XG4gICAgICAgICAgcmV0dXJuIHVzZXJzLmZpbmQoe1xuICAgICAgICAgICAgX2lkOiB0aGlzLnVzZXJJZFxuICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgIGZpZWxkcyxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfSwgLypzdXBwcmVzcyBhdXRvcHVibGlzaCB3YXJuaW5nKi97aXNfYXV0bzogdHJ1ZX0pO1xuICAgIH0pO1xuXG4gICAgLy8gVXNlIE1ldGVvci5zdGFydHVwIHRvIGdpdmUgb3RoZXIgcGFja2FnZXMgYSBjaGFuY2UgdG8gY2FsbFxuICAgIC8vIGFkZEF1dG9wdWJsaXNoRmllbGRzLlxuICAgIFBhY2thZ2UuYXV0b3B1Ymxpc2ggJiYgTWV0ZW9yLnN0YXJ0dXAoKCkgPT4ge1xuICAgICAgLy8gWydwcm9maWxlJywgJ3VzZXJuYW1lJ10gLT4ge3Byb2ZpbGU6IDEsIHVzZXJuYW1lOiAxfVxuICAgICAgY29uc3QgdG9GaWVsZFNlbGVjdG9yID0gZmllbGRzID0+IGZpZWxkcy5yZWR1Y2UoKHByZXYsIGZpZWxkKSA9PiAoXG4gICAgICAgICAgeyAuLi5wcmV2LCBbZmllbGRdOiAxIH0pLFxuICAgICAgICB7fVxuICAgICAgKTtcbiAgICAgIHRoaXMuX3NlcnZlci5wdWJsaXNoKG51bGwsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHRoaXMudXNlcklkKSB7XG4gICAgICAgICAgcmV0dXJuIHVzZXJzLmZpbmQoeyBfaWQ6IHRoaXMudXNlcklkIH0sIHtcbiAgICAgICAgICAgIGZpZWxkczogdG9GaWVsZFNlbGVjdG9yKF9hdXRvcHVibGlzaEZpZWxkcy5sb2dnZWRJblVzZXIpLFxuICAgICAgICAgIH0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgIH0sIC8qc3VwcHJlc3MgYXV0b3B1Ymxpc2ggd2FybmluZyove2lzX2F1dG86IHRydWV9KTtcblxuICAgICAgLy8gWFhYIHRoaXMgcHVibGlzaCBpcyBuZWl0aGVyIGRlZHVwLWFibGUgbm9yIGlzIGl0IG9wdGltaXplZCBieSBvdXIgc3BlY2lhbFxuICAgICAgLy8gdHJlYXRtZW50IG9mIHF1ZXJpZXMgb24gYSBzcGVjaWZpYyBfaWQuIFRoZXJlZm9yZSB0aGlzIHdpbGwgaGF2ZSBPKG5eMilcbiAgICAgIC8vIHJ1bi10aW1lIHBlcmZvcm1hbmNlIGV2ZXJ5IHRpbWUgYSB1c2VyIGRvY3VtZW50IGlzIGNoYW5nZWQgKGVnIHNvbWVvbmVcbiAgICAgIC8vIGxvZ2dpbmcgaW4pLiBJZiB0aGlzIGlzIGEgcHJvYmxlbSwgd2UgY2FuIGluc3RlYWQgd3JpdGUgYSBtYW51YWwgcHVibGlzaFxuICAgICAgLy8gZnVuY3Rpb24gd2hpY2ggZmlsdGVycyBvdXQgZmllbGRzIGJhc2VkIG9uICd0aGlzLnVzZXJJZCcuXG4gICAgICB0aGlzLl9zZXJ2ZXIucHVibGlzaChudWxsLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnN0IHNlbGVjdG9yID0gdGhpcy51c2VySWQgPyB7IF9pZDogeyAkbmU6IHRoaXMudXNlcklkIH0gfSA6IHt9O1xuICAgICAgICByZXR1cm4gdXNlcnMuZmluZChzZWxlY3Rvciwge1xuICAgICAgICAgIGZpZWxkczogdG9GaWVsZFNlbGVjdG9yKF9hdXRvcHVibGlzaEZpZWxkcy5vdGhlclVzZXJzKSxcbiAgICAgICAgfSlcbiAgICAgIH0sIC8qc3VwcHJlc3MgYXV0b3B1Ymxpc2ggd2FybmluZyove2lzX2F1dG86IHRydWV9KTtcbiAgICB9KTtcbiAgfTtcblxuICAvLyBBZGQgdG8gdGhlIGxpc3Qgb2YgZmllbGRzIG9yIHN1YmZpZWxkcyB0byBiZSBhdXRvbWF0aWNhbGx5XG4gIC8vIHB1Ymxpc2hlZCBpZiBhdXRvcHVibGlzaCBpcyBvbi4gTXVzdCBiZSBjYWxsZWQgZnJvbSB0b3AtbGV2ZWxcbiAgLy8gY29kZSAoaWUsIGJlZm9yZSBNZXRlb3Iuc3RhcnR1cCBob29rcyBydW4pLlxuICAvL1xuICAvLyBAcGFyYW0gb3B0cyB7T2JqZWN0fSB3aXRoOlxuICAvLyAgIC0gZm9yTG9nZ2VkSW5Vc2VyIHtBcnJheX0gQXJyYXkgb2YgZmllbGRzIHB1Ymxpc2hlZCB0byB0aGUgbG9nZ2VkLWluIHVzZXJcbiAgLy8gICAtIGZvck90aGVyVXNlcnMge0FycmF5fSBBcnJheSBvZiBmaWVsZHMgcHVibGlzaGVkIHRvIHVzZXJzIHRoYXQgYXJlbid0IGxvZ2dlZCBpblxuICBhZGRBdXRvcHVibGlzaEZpZWxkcyhvcHRzKSB7XG4gICAgdGhpcy5fYXV0b3B1Ymxpc2hGaWVsZHMubG9nZ2VkSW5Vc2VyLnB1c2guYXBwbHkoXG4gICAgICB0aGlzLl9hdXRvcHVibGlzaEZpZWxkcy5sb2dnZWRJblVzZXIsIG9wdHMuZm9yTG9nZ2VkSW5Vc2VyKTtcbiAgICB0aGlzLl9hdXRvcHVibGlzaEZpZWxkcy5vdGhlclVzZXJzLnB1c2guYXBwbHkoXG4gICAgICB0aGlzLl9hdXRvcHVibGlzaEZpZWxkcy5vdGhlclVzZXJzLCBvcHRzLmZvck90aGVyVXNlcnMpO1xuICB9O1xuXG4gIC8vIFJlcGxhY2VzIHRoZSBmaWVsZHMgdG8gYmUgYXV0b21hdGljYWxseVxuICAvLyBwdWJsaXNoZWQgd2hlbiB0aGUgdXNlciBsb2dzIGluXG4gIC8vXG4gIC8vIEBwYXJhbSB7TW9uZ29GaWVsZFNwZWNpZmllcn0gZmllbGRzIERpY3Rpb25hcnkgb2YgZmllbGRzIHRvIHJldHVybiBvciBleGNsdWRlLlxuICBzZXREZWZhdWx0UHVibGlzaEZpZWxkcyhmaWVsZHMpIHtcbiAgICB0aGlzLl9kZWZhdWx0UHVibGlzaEZpZWxkcy5wcm9qZWN0aW9uID0gZmllbGRzO1xuICB9O1xuXG4gIC8vL1xuICAvLy8gQUNDT1VOVCBEQVRBXG4gIC8vL1xuXG4gIC8vIEhBQ0s6IFRoaXMgaXMgdXNlZCBieSAnbWV0ZW9yLWFjY291bnRzJyB0byBnZXQgdGhlIGxvZ2luVG9rZW4gZm9yIGFcbiAgLy8gY29ubmVjdGlvbi4gTWF5YmUgdGhlcmUgc2hvdWxkIGJlIGEgcHVibGljIHdheSB0byBkbyB0aGF0LlxuICBfZ2V0QWNjb3VudERhdGEoY29ubmVjdGlvbklkLCBmaWVsZCkge1xuICAgIGNvbnN0IGRhdGEgPSB0aGlzLl9hY2NvdW50RGF0YVtjb25uZWN0aW9uSWRdO1xuICAgIHJldHVybiBkYXRhICYmIGRhdGFbZmllbGRdO1xuICB9O1xuXG4gIF9zZXRBY2NvdW50RGF0YShjb25uZWN0aW9uSWQsIGZpZWxkLCB2YWx1ZSkge1xuICAgIGNvbnN0IGRhdGEgPSB0aGlzLl9hY2NvdW50RGF0YVtjb25uZWN0aW9uSWRdO1xuXG4gICAgLy8gc2FmZXR5IGJlbHQuIHNob3VsZG4ndCBoYXBwZW4uIGFjY291bnREYXRhIGlzIHNldCBpbiBvbkNvbm5lY3Rpb24sXG4gICAgLy8gd2UgZG9uJ3QgaGF2ZSBhIGNvbm5lY3Rpb25JZCB1bnRpbCBpdCBpcyBzZXQuXG4gICAgaWYgKCFkYXRhKVxuICAgICAgcmV0dXJuO1xuXG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpXG4gICAgICBkZWxldGUgZGF0YVtmaWVsZF07XG4gICAgZWxzZVxuICAgICAgZGF0YVtmaWVsZF0gPSB2YWx1ZTtcbiAgfTtcblxuICAvLy9cbiAgLy8vIFJFQ09OTkVDVCBUT0tFTlNcbiAgLy8vXG4gIC8vLyBzdXBwb3J0IHJlY29ubmVjdGluZyB1c2luZyBhIG1ldGVvciBsb2dpbiB0b2tlblxuXG4gIF9oYXNoTG9naW5Ub2tlbihsb2dpblRva2VuKSB7XG4gICAgY29uc3QgaGFzaCA9IGNyeXB0by5jcmVhdGVIYXNoKCdzaGEyNTYnKTtcbiAgICBoYXNoLnVwZGF0ZShsb2dpblRva2VuKTtcbiAgICByZXR1cm4gaGFzaC5kaWdlc3QoJ2Jhc2U2NCcpO1xuICB9O1xuXG4gIC8vIHt0b2tlbiwgd2hlbn0gPT4ge2hhc2hlZFRva2VuLCB3aGVufVxuICBfaGFzaFN0YW1wZWRUb2tlbihzdGFtcGVkVG9rZW4pIHtcbiAgICBjb25zdCB7IHRva2VuLCAuLi5oYXNoZWRTdGFtcGVkVG9rZW4gfSA9IHN0YW1wZWRUb2tlbjtcbiAgICByZXR1cm4ge1xuICAgICAgLi4uaGFzaGVkU3RhbXBlZFRva2VuLFxuICAgICAgaGFzaGVkVG9rZW46IHRoaXMuX2hhc2hMb2dpblRva2VuKHRva2VuKVxuICAgIH07XG4gIH07XG5cbiAgLy8gVXNpbmcgJGFkZFRvU2V0IGF2b2lkcyBnZXR0aW5nIGFuIGluZGV4IGVycm9yIGlmIGFub3RoZXIgY2xpZW50XG4gIC8vIGxvZ2dpbmcgaW4gc2ltdWx0YW5lb3VzbHkgaGFzIGFscmVhZHkgaW5zZXJ0ZWQgdGhlIG5ldyBoYXNoZWRcbiAgLy8gdG9rZW4uXG4gIGFzeW5jIF9pbnNlcnRIYXNoZWRMb2dpblRva2VuKHVzZXJJZCwgaGFzaGVkVG9rZW4sIHF1ZXJ5KSB7XG4gICAgcXVlcnkgPSBxdWVyeSA/IHsgLi4ucXVlcnkgfSA6IHt9O1xuICAgIHF1ZXJ5Ll9pZCA9IHVzZXJJZDtcbiAgICBhd2FpdCB0aGlzLnVzZXJzLnVwZGF0ZUFzeW5jKHF1ZXJ5LCB7XG4gICAgICAkYWRkVG9TZXQ6IHtcbiAgICAgICAgXCJzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnNcIjogaGFzaGVkVG9rZW5cbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcblxuICAvLyBFeHBvcnRlZCBmb3IgdGVzdHMuXG4gIGFzeW5jIF9pbnNlcnRMb2dpblRva2VuKHVzZXJJZCwgc3RhbXBlZFRva2VuLCBxdWVyeSkge1xuICAgIGF3YWl0IHRoaXMuX2luc2VydEhhc2hlZExvZ2luVG9rZW4oXG4gICAgICB1c2VySWQsXG4gICAgICB0aGlzLl9oYXNoU3RhbXBlZFRva2VuKHN0YW1wZWRUb2tlbiksXG4gICAgICBxdWVyeVxuICAgICk7XG4gIH07XG5cbiAgLyoqXG4gICAqXG4gICAqIEBwYXJhbSB1c2VySWRcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybnMge1Byb21pc2U8dm9pZD59XG4gICAqL1xuICBfY2xlYXJBbGxMb2dpblRva2Vucyh1c2VySWQpIHtcbiAgICB0aGlzLnVzZXJzLnVwZGF0ZUFzeW5jKHVzZXJJZCwge1xuICAgICAgJHNldDoge1xuICAgICAgICAnc2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zJzogW11cbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcblxuICAvLyB0ZXN0IGhvb2tcbiAgX2dldFVzZXJPYnNlcnZlKGNvbm5lY3Rpb25JZCkge1xuICAgIHJldHVybiB0aGlzLl91c2VyT2JzZXJ2ZXNGb3JDb25uZWN0aW9uc1tjb25uZWN0aW9uSWRdO1xuICB9O1xuXG4gIC8vIENsZWFuIHVwIHRoaXMgY29ubmVjdGlvbidzIGFzc29jaWF0aW9uIHdpdGggdGhlIHRva2VuOiB0aGF0IGlzLCBzdG9wXG4gIC8vIHRoZSBvYnNlcnZlIHRoYXQgd2Ugc3RhcnRlZCB3aGVuIHdlIGFzc29jaWF0ZWQgdGhlIGNvbm5lY3Rpb24gd2l0aFxuICAvLyB0aGlzIHRva2VuLlxuICBfcmVtb3ZlVG9rZW5Gcm9tQ29ubmVjdGlvbihjb25uZWN0aW9uSWQpIHtcbiAgICBpZiAoaGFzT3duLmNhbGwodGhpcy5fdXNlck9ic2VydmVzRm9yQ29ubmVjdGlvbnMsIGNvbm5lY3Rpb25JZCkpIHtcbiAgICAgIGNvbnN0IG9ic2VydmUgPSB0aGlzLl91c2VyT2JzZXJ2ZXNGb3JDb25uZWN0aW9uc1tjb25uZWN0aW9uSWRdO1xuICAgICAgaWYgKHR5cGVvZiBvYnNlcnZlID09PSAnbnVtYmVyJykge1xuICAgICAgICAvLyBXZSdyZSBpbiB0aGUgcHJvY2VzcyBvZiBzZXR0aW5nIHVwIGFuIG9ic2VydmUgZm9yIHRoaXMgY29ubmVjdGlvbi4gV2VcbiAgICAgICAgLy8gY2FuJ3QgY2xlYW4gdXAgdGhhdCBvYnNlcnZlIHlldCwgYnV0IGlmIHdlIGRlbGV0ZSB0aGUgcGxhY2Vob2xkZXIgZm9yXG4gICAgICAgIC8vIHRoaXMgY29ubmVjdGlvbiwgdGhlbiB0aGUgb2JzZXJ2ZSB3aWxsIGdldCBjbGVhbmVkIHVwIGFzIHNvb24gYXMgaXQgaGFzXG4gICAgICAgIC8vIGJlZW4gc2V0IHVwLlxuICAgICAgICBkZWxldGUgdGhpcy5fdXNlck9ic2VydmVzRm9yQ29ubmVjdGlvbnNbY29ubmVjdGlvbklkXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl91c2VyT2JzZXJ2ZXNGb3JDb25uZWN0aW9uc1tjb25uZWN0aW9uSWRdO1xuICAgICAgICBvYnNlcnZlLnN0b3AoKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgX2dldExvZ2luVG9rZW4oY29ubmVjdGlvbklkKSB7XG4gICAgcmV0dXJuIHRoaXMuX2dldEFjY291bnREYXRhKGNvbm5lY3Rpb25JZCwgJ2xvZ2luVG9rZW4nKTtcbiAgfTtcblxuICAvLyBuZXdUb2tlbiBpcyBhIGhhc2hlZCB0b2tlbi5cbiAgX3NldExvZ2luVG9rZW4odXNlcklkLCBjb25uZWN0aW9uLCBuZXdUb2tlbikge1xuICAgIHRoaXMuX3JlbW92ZVRva2VuRnJvbUNvbm5lY3Rpb24oY29ubmVjdGlvbi5pZCk7XG4gICAgdGhpcy5fc2V0QWNjb3VudERhdGEoY29ubmVjdGlvbi5pZCwgJ2xvZ2luVG9rZW4nLCBuZXdUb2tlbik7XG5cbiAgICBpZiAobmV3VG9rZW4pIHtcbiAgICAgIC8vIFNldCB1cCBhbiBvYnNlcnZlIGZvciB0aGlzIHRva2VuLiBJZiB0aGUgdG9rZW4gZ29lcyBhd2F5LCB3ZSBuZWVkXG4gICAgICAvLyB0byBjbG9zZSB0aGUgY29ubmVjdGlvbi4gIFdlIGRlZmVyIHRoZSBvYnNlcnZlIGJlY2F1c2UgdGhlcmUnc1xuICAgICAgLy8gbm8gbmVlZCBmb3IgaXQgdG8gYmUgb24gdGhlIGNyaXRpY2FsIHBhdGggZm9yIGxvZ2luOyB3ZSBqdXN0IG5lZWRcbiAgICAgIC8vIHRvIGVuc3VyZSB0aGF0IHRoZSBjb25uZWN0aW9uIHdpbGwgZ2V0IGNsb3NlZCBhdCBzb21lIHBvaW50IGlmXG4gICAgICAvLyB0aGUgdG9rZW4gZ2V0cyBkZWxldGVkLlxuICAgICAgLy9cbiAgICAgIC8vIEluaXRpYWxseSwgd2Ugc2V0IHRoZSBvYnNlcnZlIGZvciB0aGlzIGNvbm5lY3Rpb24gdG8gYSBudW1iZXI7IHRoaXNcbiAgICAgIC8vIHNpZ25pZmllcyB0byBvdGhlciBjb2RlICh3aGljaCBtaWdodCBydW4gd2hpbGUgd2UgeWllbGQpIHRoYXQgd2UgYXJlIGluXG4gICAgICAvLyB0aGUgcHJvY2VzcyBvZiBzZXR0aW5nIHVwIGFuIG9ic2VydmUgZm9yIHRoaXMgY29ubmVjdGlvbi4gT25jZSB0aGVcbiAgICAgIC8vIG9ic2VydmUgaXMgcmVhZHkgdG8gZ28sIHdlIHJlcGxhY2UgdGhlIG51bWJlciB3aXRoIHRoZSByZWFsIG9ic2VydmVcbiAgICAgIC8vIGhhbmRsZSAodW5sZXNzIHRoZSBwbGFjZWhvbGRlciBoYXMgYmVlbiBkZWxldGVkIG9yIHJlcGxhY2VkIGJ5IGFcbiAgICAgIC8vIGRpZmZlcmVudCBwbGFjZWhvbGQgbnVtYmVyLCBzaWduaWZ5aW5nIHRoYXQgdGhlIGNvbm5lY3Rpb24gd2FzIGNsb3NlZFxuICAgICAgLy8gYWxyZWFkeSAtLSBpbiB0aGlzIGNhc2Ugd2UganVzdCBjbGVhbiB1cCB0aGUgb2JzZXJ2ZSB0aGF0IHdlIHN0YXJ0ZWQpLlxuICAgICAgY29uc3QgbXlPYnNlcnZlTnVtYmVyID0gKyt0aGlzLl9uZXh0VXNlck9ic2VydmVOdW1iZXI7XG4gICAgICB0aGlzLl91c2VyT2JzZXJ2ZXNGb3JDb25uZWN0aW9uc1tjb25uZWN0aW9uLmlkXSA9IG15T2JzZXJ2ZU51bWJlcjtcbiAgICAgIE1ldGVvci5kZWZlcihhc3luYyAoKSA9PiB7XG4gICAgICAgIC8vIElmIHNvbWV0aGluZyBlbHNlIGhhcHBlbmVkIG9uIHRoaXMgY29ubmVjdGlvbiBpbiB0aGUgbWVhbnRpbWUgKGl0IGdvdFxuICAgICAgICAvLyBjbG9zZWQsIG9yIGFub3RoZXIgY2FsbCB0byBfc2V0TG9naW5Ub2tlbiBoYXBwZW5lZCksIGp1c3QgZG9cbiAgICAgICAgLy8gbm90aGluZy4gV2UgZG9uJ3QgbmVlZCB0byBzdGFydCBhbiBvYnNlcnZlIGZvciBhbiBvbGQgY29ubmVjdGlvbiBvciBvbGRcbiAgICAgICAgLy8gdG9rZW4uXG4gICAgICAgIGlmICh0aGlzLl91c2VyT2JzZXJ2ZXNGb3JDb25uZWN0aW9uc1tjb25uZWN0aW9uLmlkXSAhPT0gbXlPYnNlcnZlTnVtYmVyKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGZvdW5kTWF0Y2hpbmdVc2VyO1xuICAgICAgICAvLyBCZWNhdXNlIHdlIHVwZ3JhZGUgdW5oYXNoZWQgbG9naW4gdG9rZW5zIHRvIGhhc2hlZCB0b2tlbnMgYXRcbiAgICAgICAgLy8gbG9naW4gdGltZSwgc2Vzc2lvbnMgd2lsbCBvbmx5IGJlIGxvZ2dlZCBpbiB3aXRoIGEgaGFzaGVkXG4gICAgICAgIC8vIHRva2VuLiBUaHVzIHdlIG9ubHkgbmVlZCB0byBvYnNlcnZlIGhhc2hlZCB0b2tlbnMgaGVyZS5cbiAgICAgICAgY29uc3Qgb2JzZXJ2ZSA9IGF3YWl0IHRoaXMudXNlcnMuZmluZCh7XG4gICAgICAgICAgX2lkOiB1c2VySWQsXG4gICAgICAgICAgJ3NlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vucy5oYXNoZWRUb2tlbic6IG5ld1Rva2VuXG4gICAgICAgIH0sIHsgZmllbGRzOiB7IF9pZDogMSB9IH0pLm9ic2VydmVDaGFuZ2VzKHtcbiAgICAgICAgICBhZGRlZDogKCkgPT4ge1xuICAgICAgICAgICAgZm91bmRNYXRjaGluZ1VzZXIgPSB0cnVlO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgcmVtb3ZlZDogY29ubmVjdGlvbi5jbG9zZSxcbiAgICAgICAgICAvLyBUaGUgb25DbG9zZSBjYWxsYmFjayBmb3IgdGhlIGNvbm5lY3Rpb24gdGFrZXMgY2FyZSBvZlxuICAgICAgICAgIC8vIGNsZWFuaW5nIHVwIHRoZSBvYnNlcnZlIGhhbmRsZSBhbmQgYW55IG90aGVyIHN0YXRlIHdlIGhhdmVcbiAgICAgICAgICAvLyBseWluZyBhcm91bmQuXG4gICAgICAgIH0sIHsgbm9uTXV0YXRpbmdDYWxsYmFja3M6IHRydWUgfSk7XG5cbiAgICAgICAgLy8gSWYgdGhlIHVzZXIgcmFuIGFub3RoZXIgbG9naW4gb3IgbG9nb3V0IGNvbW1hbmQgd2Ugd2VyZSB3YWl0aW5nIGZvciB0aGVcbiAgICAgICAgLy8gZGVmZXIgb3IgYWRkZWQgdG8gZmlyZSAoaWUsIGFub3RoZXIgY2FsbCB0byBfc2V0TG9naW5Ub2tlbiBvY2N1cnJlZCksXG4gICAgICAgIC8vIHRoZW4gd2UgbGV0IHRoZSBsYXRlciBvbmUgd2luIChzdGFydCBhbiBvYnNlcnZlLCBldGMpIGFuZCBqdXN0IHN0b3Agb3VyXG4gICAgICAgIC8vIG9ic2VydmUgbm93LlxuICAgICAgICAvL1xuICAgICAgICAvLyBTaW1pbGFybHksIGlmIHRoZSBjb25uZWN0aW9uIHdhcyBhbHJlYWR5IGNsb3NlZCwgdGhlbiB0aGUgb25DbG9zZVxuICAgICAgICAvLyBjYWxsYmFjayB3b3VsZCBoYXZlIGNhbGxlZCBfcmVtb3ZlVG9rZW5Gcm9tQ29ubmVjdGlvbiBhbmQgdGhlcmUgd29uJ3RcbiAgICAgICAgLy8gYmUgYW4gZW50cnkgaW4gX3VzZXJPYnNlcnZlc0ZvckNvbm5lY3Rpb25zLiBXZSBjYW4gc3RvcCB0aGUgb2JzZXJ2ZS5cbiAgICAgICAgaWYgKHRoaXMuX3VzZXJPYnNlcnZlc0ZvckNvbm5lY3Rpb25zW2Nvbm5lY3Rpb24uaWRdICE9PSBteU9ic2VydmVOdW1iZXIpIHtcbiAgICAgICAgICBvYnNlcnZlLnN0b3AoKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl91c2VyT2JzZXJ2ZXNGb3JDb25uZWN0aW9uc1tjb25uZWN0aW9uLmlkXSA9IG9ic2VydmU7XG5cbiAgICAgICAgaWYgKCEgZm91bmRNYXRjaGluZ1VzZXIpIHtcbiAgICAgICAgICAvLyBXZSd2ZSBzZXQgdXAgYW4gb2JzZXJ2ZSBvbiB0aGUgdXNlciBhc3NvY2lhdGVkIHdpdGggYG5ld1Rva2VuYCxcbiAgICAgICAgICAvLyBzbyBpZiB0aGUgbmV3IHRva2VuIGlzIHJlbW92ZWQgZnJvbSB0aGUgZGF0YWJhc2UsIHdlJ2xsIGNsb3NlXG4gICAgICAgICAgLy8gdGhlIGNvbm5lY3Rpb24uIEJ1dCB0aGUgdG9rZW4gbWlnaHQgaGF2ZSBhbHJlYWR5IGJlZW4gZGVsZXRlZFxuICAgICAgICAgIC8vIGJlZm9yZSB3ZSBzZXQgdXAgdGhlIG9ic2VydmUsIHdoaWNoIHdvdWxkbid0IGhhdmUgY2xvc2VkIHRoZVxuICAgICAgICAgIC8vIGNvbm5lY3Rpb24gYmVjYXVzZSB0aGUgb2JzZXJ2ZSB3YXNuJ3QgcnVubmluZyB5ZXQuXG4gICAgICAgICAgY29ubmVjdGlvbi5jbG9zZSgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH07XG5cbiAgLy8gKEFsc28gdXNlZCBieSBNZXRlb3IgQWNjb3VudHMgc2VydmVyIGFuZCB0ZXN0cykuXG4gIC8vXG4gIF9nZW5lcmF0ZVN0YW1wZWRMb2dpblRva2VuKCkge1xuICAgIHJldHVybiB7XG4gICAgICB0b2tlbjogUmFuZG9tLnNlY3JldCgpLFxuICAgICAgd2hlbjogbmV3IERhdGVcbiAgICB9O1xuICB9O1xuXG4gIC8vL1xuICAvLy8gVE9LRU4gRVhQSVJBVElPTlxuICAvLy9cblxuICAvLyBEZWxldGVzIGV4cGlyZWQgcGFzc3dvcmQgcmVzZXQgdG9rZW5zIGZyb20gdGhlIGRhdGFiYXNlLlxuICAvL1xuICAvLyBFeHBvcnRlZCBmb3IgdGVzdHMuIEFsc28sIHRoZSBhcmd1bWVudHMgYXJlIG9ubHkgdXNlZCBieVxuICAvLyB0ZXN0cy4gb2xkZXN0VmFsaWREYXRlIGlzIHNpbXVsYXRlIGV4cGlyaW5nIHRva2VucyB3aXRob3V0IHdhaXRpbmdcbiAgLy8gZm9yIHRoZW0gdG8gYWN0dWFsbHkgZXhwaXJlLiB1c2VySWQgaXMgdXNlZCBieSB0ZXN0cyB0byBvbmx5IGV4cGlyZVxuICAvLyB0b2tlbnMgZm9yIHRoZSB0ZXN0IHVzZXIuXG4gIGFzeW5jIF9leHBpcmVQYXNzd29yZFJlc2V0VG9rZW5zKG9sZGVzdFZhbGlkRGF0ZSwgdXNlcklkKSB7XG4gICAgY29uc3QgdG9rZW5MaWZldGltZU1zID0gdGhpcy5fZ2V0UGFzc3dvcmRSZXNldFRva2VuTGlmZXRpbWVNcygpO1xuXG4gICAgLy8gd2hlbiBjYWxsaW5nIGZyb20gYSB0ZXN0IHdpdGggZXh0cmEgYXJndW1lbnRzLCB5b3UgbXVzdCBzcGVjaWZ5IGJvdGghXG4gICAgaWYgKChvbGRlc3RWYWxpZERhdGUgJiYgIXVzZXJJZCkgfHwgKCFvbGRlc3RWYWxpZERhdGUgJiYgdXNlcklkKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQmFkIHRlc3QuIE11c3Qgc3BlY2lmeSBib3RoIG9sZGVzdFZhbGlkRGF0ZSBhbmQgdXNlcklkLlwiKTtcbiAgICB9XG5cbiAgICBvbGRlc3RWYWxpZERhdGUgPSBvbGRlc3RWYWxpZERhdGUgfHxcbiAgICAgIChuZXcgRGF0ZShuZXcgRGF0ZSgpIC0gdG9rZW5MaWZldGltZU1zKSk7XG5cbiAgICBjb25zdCB0b2tlbkZpbHRlciA9IHtcbiAgICAgICRvcjogW1xuICAgICAgICB7IFwic2VydmljZXMucGFzc3dvcmQucmVzZXQucmVhc29uXCI6IFwicmVzZXRcIn0sXG4gICAgICAgIHsgXCJzZXJ2aWNlcy5wYXNzd29yZC5yZXNldC5yZWFzb25cIjogeyRleGlzdHM6IGZhbHNlfX1cbiAgICAgIF1cbiAgICB9O1xuXG4gICBhd2FpdCBleHBpcmVQYXNzd29yZFRva2VuKHRoaXMsIG9sZGVzdFZhbGlkRGF0ZSwgdG9rZW5GaWx0ZXIsIHVzZXJJZCk7XG4gIH1cblxuICAvLyBEZWxldGVzIGV4cGlyZWQgcGFzc3dvcmQgZW5yb2xsIHRva2VucyBmcm9tIHRoZSBkYXRhYmFzZS5cbiAgLy9cbiAgLy8gRXhwb3J0ZWQgZm9yIHRlc3RzLiBBbHNvLCB0aGUgYXJndW1lbnRzIGFyZSBvbmx5IHVzZWQgYnlcbiAgLy8gdGVzdHMuIG9sZGVzdFZhbGlkRGF0ZSBpcyBzaW11bGF0ZSBleHBpcmluZyB0b2tlbnMgd2l0aG91dCB3YWl0aW5nXG4gIC8vIGZvciB0aGVtIHRvIGFjdHVhbGx5IGV4cGlyZS4gdXNlcklkIGlzIHVzZWQgYnkgdGVzdHMgdG8gb25seSBleHBpcmVcbiAgLy8gdG9rZW5zIGZvciB0aGUgdGVzdCB1c2VyLlxuICBhc3luYyBfZXhwaXJlUGFzc3dvcmRFbnJvbGxUb2tlbnMob2xkZXN0VmFsaWREYXRlLCB1c2VySWQpIHtcbiAgICBjb25zdCB0b2tlbkxpZmV0aW1lTXMgPSB0aGlzLl9nZXRQYXNzd29yZEVucm9sbFRva2VuTGlmZXRpbWVNcygpO1xuXG4gICAgLy8gd2hlbiBjYWxsaW5nIGZyb20gYSB0ZXN0IHdpdGggZXh0cmEgYXJndW1lbnRzLCB5b3UgbXVzdCBzcGVjaWZ5IGJvdGghXG4gICAgaWYgKChvbGRlc3RWYWxpZERhdGUgJiYgIXVzZXJJZCkgfHwgKCFvbGRlc3RWYWxpZERhdGUgJiYgdXNlcklkKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQmFkIHRlc3QuIE11c3Qgc3BlY2lmeSBib3RoIG9sZGVzdFZhbGlkRGF0ZSBhbmQgdXNlcklkLlwiKTtcbiAgICB9XG5cbiAgICBvbGRlc3RWYWxpZERhdGUgPSBvbGRlc3RWYWxpZERhdGUgfHxcbiAgICAgIChuZXcgRGF0ZShuZXcgRGF0ZSgpIC0gdG9rZW5MaWZldGltZU1zKSk7XG5cbiAgICBjb25zdCB0b2tlbkZpbHRlciA9IHtcbiAgICAgIFwic2VydmljZXMucGFzc3dvcmQuZW5yb2xsLnJlYXNvblwiOiBcImVucm9sbFwiXG4gICAgfTtcblxuICAgIGF3YWl0IGV4cGlyZVBhc3N3b3JkVG9rZW4odGhpcywgb2xkZXN0VmFsaWREYXRlLCB0b2tlbkZpbHRlciwgdXNlcklkKTtcbiAgfVxuXG4gIC8vIERlbGV0ZXMgZXhwaXJlZCB0b2tlbnMgZnJvbSB0aGUgZGF0YWJhc2UgYW5kIGNsb3NlcyBhbGwgb3BlbiBjb25uZWN0aW9uc1xuICAvLyBhc3NvY2lhdGVkIHdpdGggdGhlc2UgdG9rZW5zLlxuICAvL1xuICAvLyBFeHBvcnRlZCBmb3IgdGVzdHMuIEFsc28sIHRoZSBhcmd1bWVudHMgYXJlIG9ubHkgdXNlZCBieVxuICAvLyB0ZXN0cy4gb2xkZXN0VmFsaWREYXRlIGlzIHNpbXVsYXRlIGV4cGlyaW5nIHRva2VucyB3aXRob3V0IHdhaXRpbmdcbiAgLy8gZm9yIHRoZW0gdG8gYWN0dWFsbHkgZXhwaXJlLiB1c2VySWQgaXMgdXNlZCBieSB0ZXN0cyB0byBvbmx5IGV4cGlyZVxuICAvLyB0b2tlbnMgZm9yIHRoZSB0ZXN0IHVzZXIuXG4gIC8qKlxuICAgKlxuICAgKiBAcGFyYW0gb2xkZXN0VmFsaWREYXRlXG4gICAqIEBwYXJhbSB1c2VySWRcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybiB7UHJvbWlzZTx2b2lkPn1cbiAgICovXG4gIGFzeW5jIF9leHBpcmVUb2tlbnMob2xkZXN0VmFsaWREYXRlLCB1c2VySWQpIHtcbiAgICBjb25zdCB0b2tlbkxpZmV0aW1lTXMgPSB0aGlzLl9nZXRUb2tlbkxpZmV0aW1lTXMoKTtcblxuICAgIC8vIHdoZW4gY2FsbGluZyBmcm9tIGEgdGVzdCB3aXRoIGV4dHJhIGFyZ3VtZW50cywgeW91IG11c3Qgc3BlY2lmeSBib3RoIVxuICAgIGlmICgob2xkZXN0VmFsaWREYXRlICYmICF1c2VySWQpIHx8ICghb2xkZXN0VmFsaWREYXRlICYmIHVzZXJJZCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkJhZCB0ZXN0LiBNdXN0IHNwZWNpZnkgYm90aCBvbGRlc3RWYWxpZERhdGUgYW5kIHVzZXJJZC5cIik7XG4gICAgfVxuXG4gICAgb2xkZXN0VmFsaWREYXRlID0gb2xkZXN0VmFsaWREYXRlIHx8XG4gICAgICAobmV3IERhdGUobmV3IERhdGUoKSAtIHRva2VuTGlmZXRpbWVNcykpO1xuICAgIGNvbnN0IHVzZXJGaWx0ZXIgPSB1c2VySWQgPyB7X2lkOiB1c2VySWR9IDoge307XG5cblxuICAgIC8vIEJhY2t3YXJkcyBjb21wYXRpYmxlIHdpdGggb2xkZXIgdmVyc2lvbnMgb2YgbWV0ZW9yIHRoYXQgc3RvcmVkIGxvZ2luIHRva2VuXG4gICAgLy8gdGltZXN0YW1wcyBhcyBudW1iZXJzLlxuICAgIGF3YWl0IHRoaXMudXNlcnMudXBkYXRlQXN5bmMoeyAuLi51c2VyRmlsdGVyLFxuICAgICAgJG9yOiBbXG4gICAgICAgIHsgXCJzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnMud2hlblwiOiB7ICRsdDogb2xkZXN0VmFsaWREYXRlIH0gfSxcbiAgICAgICAgeyBcInNlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vucy53aGVuXCI6IHsgJGx0OiArb2xkZXN0VmFsaWREYXRlIH0gfVxuICAgICAgXVxuICAgIH0sIHtcbiAgICAgICRwdWxsOiB7XG4gICAgICAgIFwic2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zXCI6IHtcbiAgICAgICAgICAkb3I6IFtcbiAgICAgICAgICAgIHsgd2hlbjogeyAkbHQ6IG9sZGVzdFZhbGlkRGF0ZSB9IH0sXG4gICAgICAgICAgICB7IHdoZW46IHsgJGx0OiArb2xkZXN0VmFsaWREYXRlIH0gfVxuICAgICAgICAgIF1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sIHsgbXVsdGk6IHRydWUgfSk7XG4gICAgLy8gVGhlIG9ic2VydmUgb24gTWV0ZW9yLnVzZXJzIHdpbGwgdGFrZSBjYXJlIG9mIGNsb3NpbmcgY29ubmVjdGlvbnMgZm9yXG4gICAgLy8gZXhwaXJlZCB0b2tlbnMuXG4gIH07XG5cbiAgLy8gQG92ZXJyaWRlIGZyb20gYWNjb3VudHNfY29tbW9uLmpzXG4gIGNvbmZpZyhvcHRpb25zKSB7XG4gICAgLy8gQ2FsbCB0aGUgb3ZlcnJpZGRlbiBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgbWV0aG9kLlxuICAgIGNvbnN0IHN1cGVyUmVzdWx0ID0gQWNjb3VudHNDb21tb24ucHJvdG90eXBlLmNvbmZpZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG4gICAgLy8gSWYgdGhlIHVzZXIgc2V0IGxvZ2luRXhwaXJhdGlvbkluRGF5cyB0byBudWxsLCB0aGVuIHdlIG5lZWQgdG8gY2xlYXIgdGhlXG4gICAgLy8gdGltZXIgdGhhdCBwZXJpb2RpY2FsbHkgZXhwaXJlcyB0b2tlbnMuXG4gICAgaWYgKGhhc093bi5jYWxsKHRoaXMuX29wdGlvbnMsICdsb2dpbkV4cGlyYXRpb25JbkRheXMnKSAmJlxuICAgICAgdGhpcy5fb3B0aW9ucy5sb2dpbkV4cGlyYXRpb25JbkRheXMgPT09IG51bGwgJiZcbiAgICAgIHRoaXMuZXhwaXJlVG9rZW5JbnRlcnZhbCkge1xuICAgICAgTWV0ZW9yLmNsZWFySW50ZXJ2YWwodGhpcy5leHBpcmVUb2tlbkludGVydmFsKTtcbiAgICAgIHRoaXMuZXhwaXJlVG9rZW5JbnRlcnZhbCA9IG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN1cGVyUmVzdWx0O1xuICB9O1xuXG4gIC8vIENhbGxlZCBieSBhY2NvdW50cy1wYXNzd29yZFxuICBhc3luYyBpbnNlcnRVc2VyRG9jKG9wdGlvbnMsIHVzZXIpIHtcbiAgICAvLyAtIGNsb25lIHVzZXIgZG9jdW1lbnQsIHRvIHByb3RlY3QgZnJvbSBtb2RpZmljYXRpb25cbiAgICAvLyAtIGFkZCBjcmVhdGVkQXQgdGltZXN0YW1wXG4gICAgLy8gLSBwcmVwYXJlIGFuIF9pZCwgc28gdGhhdCB5b3UgY2FuIG1vZGlmeSBvdGhlciBjb2xsZWN0aW9ucyAoZWdcbiAgICAvLyBjcmVhdGUgYSBmaXJzdCB0YXNrIGZvciBldmVyeSBuZXcgdXNlcilcbiAgICAvL1xuICAgIC8vIFhYWCBJZiB0aGUgb25DcmVhdGVVc2VyIG9yIHZhbGlkYXRlTmV3VXNlciBob29rcyBmYWlsLCB3ZSBtaWdodFxuICAgIC8vIGVuZCB1cCBoYXZpbmcgbW9kaWZpZWQgc29tZSBvdGhlciBjb2xsZWN0aW9uXG4gICAgLy8gaW5hcHByb3ByaWF0ZWx5LiBUaGUgc29sdXRpb24gaXMgcHJvYmFibHkgdG8gaGF2ZSBvbkNyZWF0ZVVzZXJcbiAgICAvLyBhY2NlcHQgdHdvIGNhbGxiYWNrcyAtIG9uZSB0aGF0IGdldHMgY2FsbGVkIGJlZm9yZSBpbnNlcnRpbmdcbiAgICAvLyB0aGUgdXNlciBkb2N1bWVudCAoaW4gd2hpY2ggeW91IGNhbiBtb2RpZnkgaXRzIGNvbnRlbnRzKSwgYW5kXG4gICAgLy8gb25lIHRoYXQgZ2V0cyBjYWxsZWQgYWZ0ZXIgKGluIHdoaWNoIHlvdSBzaG91bGQgY2hhbmdlIG90aGVyXG4gICAgLy8gY29sbGVjdGlvbnMpXG4gICAgdXNlciA9IHtcbiAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKSxcbiAgICAgIF9pZDogUmFuZG9tLmlkKCksXG4gICAgICAuLi51c2VyLFxuICAgIH07XG5cbiAgICBpZiAodXNlci5zZXJ2aWNlcykge1xuICAgICAgT2JqZWN0LmtleXModXNlci5zZXJ2aWNlcykuZm9yRWFjaChzZXJ2aWNlID0+XG4gICAgICAgIHBpbkVuY3J5cHRlZEZpZWxkc1RvVXNlcih1c2VyLnNlcnZpY2VzW3NlcnZpY2VdLCB1c2VyLl9pZClcbiAgICAgICk7XG4gICAgfVxuXG4gICAgbGV0IGZ1bGxVc2VyO1xuICAgIGlmICh0aGlzLl9vbkNyZWF0ZVVzZXJIb29rKSB7XG4gICAgICAvLyBBbGxvd3MgX29uQ3JlYXRlVXNlckhvb2sgdG8gYmUgYSBwcm9taXNlIHJldHVybmluZyBmdW5jXG4gICAgICBmdWxsVXNlciA9IGF3YWl0IHRoaXMuX29uQ3JlYXRlVXNlckhvb2sob3B0aW9ucywgdXNlcik7XG5cbiAgICAgIC8vIFRoaXMgaXMgKm5vdCogcGFydCBvZiB0aGUgQVBJLiBXZSBuZWVkIHRoaXMgYmVjYXVzZSB3ZSBjYW4ndCBpc29sYXRlXG4gICAgICAvLyB0aGUgZ2xvYmFsIHNlcnZlciBlbnZpcm9ubWVudCBiZXR3ZWVuIHRlc3RzLCBtZWFuaW5nIHdlIGNhbid0IHRlc3RcbiAgICAgIC8vIGJvdGggaGF2aW5nIGEgY3JlYXRlIHVzZXIgaG9vayBzZXQgYW5kIG5vdCBoYXZpbmcgb25lIHNldC5cbiAgICAgIGlmIChmdWxsVXNlciA9PT0gJ1RFU1QgREVGQVVMVCBIT09LJylcbiAgICAgICAgZnVsbFVzZXIgPSBkZWZhdWx0Q3JlYXRlVXNlckhvb2sob3B0aW9ucywgdXNlcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZ1bGxVc2VyID0gZGVmYXVsdENyZWF0ZVVzZXJIb29rKG9wdGlvbnMsIHVzZXIpO1xuICAgIH1cblxuICAgIGZvciBhd2FpdCAoY29uc3QgaG9vayBvZiB0aGlzLl92YWxpZGF0ZU5ld1VzZXJIb29rcykge1xuICAgICAgaWYgKCEgYXdhaXQgaG9vayhmdWxsVXNlcikpXG4gICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIlVzZXIgdmFsaWRhdGlvbiBmYWlsZWRcIik7XG4gICAgfVxuXG4gICAgbGV0IHVzZXJJZDtcbiAgICB0cnkge1xuICAgICAgdXNlcklkID0gYXdhaXQgdGhpcy51c2Vycy5pbnNlcnRBc3luYyhmdWxsVXNlcik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gWFhYIHN0cmluZyBwYXJzaW5nIHN1Y2tzLCBtYXliZVxuICAgICAgLy8gaHR0cHM6Ly9qaXJhLm1vbmdvZGIub3JnL2Jyb3dzZS9TRVJWRVItMzA2OSB3aWxsIGdldCBmaXhlZCBvbmUgZGF5XG4gICAgICAvLyBodHRwczovL2ppcmEubW9uZ29kYi5vcmcvYnJvd3NlL1NFUlZFUi00NjM3XG4gICAgICBpZiAoIWUuZXJybXNnKSB0aHJvdyBlO1xuICAgICAgaWYgKGUuZXJybXNnLmluY2x1ZGVzKCdlbWFpbHMuYWRkcmVzcycpKVxuICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJFbWFpbCBhbHJlYWR5IGV4aXN0cy5cIik7XG4gICAgICBpZiAoZS5lcnJtc2cuaW5jbHVkZXMoJ3VzZXJuYW1lJykpXG4gICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIlVzZXJuYW1lIGFscmVhZHkgZXhpc3RzLlwiKTtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICAgIHJldHVybiB1c2VySWQ7XG4gIH07XG5cbiAgLy8gSGVscGVyIGZ1bmN0aW9uOiByZXR1cm5zIGZhbHNlIGlmIGVtYWlsIGRvZXMgbm90IG1hdGNoIGNvbXBhbnkgZG9tYWluIGZyb21cbiAgLy8gdGhlIGNvbmZpZ3VyYXRpb24uXG4gIF90ZXN0RW1haWxEb21haW4oZW1haWwpIHtcbiAgICBjb25zdCBkb21haW4gPSB0aGlzLl9vcHRpb25zLnJlc3RyaWN0Q3JlYXRpb25CeUVtYWlsRG9tYWluO1xuXG4gICAgcmV0dXJuICFkb21haW4gfHxcbiAgICAgICh0eXBlb2YgZG9tYWluID09PSAnZnVuY3Rpb24nICYmIGRvbWFpbihlbWFpbCkpIHx8XG4gICAgICAodHlwZW9mIGRvbWFpbiA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgKG5ldyBSZWdFeHAoYEAke01ldGVvci5fZXNjYXBlUmVnRXhwKGRvbWFpbil9JGAsICdpJykpLnRlc3QoZW1haWwpKTtcbiAgfTtcblxuICAvLy9cbiAgLy8vIENMRUFOIFVQIEZPUiBgbG9nb3V0T3RoZXJDbGllbnRzYFxuICAvLy9cblxuICBhc3luYyBfZGVsZXRlU2F2ZWRUb2tlbnNGb3JVc2VyKHVzZXJJZCwgdG9rZW5zVG9EZWxldGUpIHtcbiAgICBpZiAodG9rZW5zVG9EZWxldGUpIHtcbiAgICAgIGF3YWl0IHRoaXMudXNlcnMudXBkYXRlQXN5bmModXNlcklkLCB7XG4gICAgICAgICR1bnNldDoge1xuICAgICAgICAgIFwic2VydmljZXMucmVzdW1lLmhhdmVMb2dpblRva2Vuc1RvRGVsZXRlXCI6IDEsXG4gICAgICAgICAgXCJzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnNUb0RlbGV0ZVwiOiAxXG4gICAgICAgIH0sXG4gICAgICAgICRwdWxsQWxsOiB7XG4gICAgICAgICAgXCJzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnNcIjogdG9rZW5zVG9EZWxldGVcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9O1xuXG4gIF9kZWxldGVTYXZlZFRva2Vuc0ZvckFsbFVzZXJzT25TdGFydHVwKCkge1xuICAgIC8vIElmIHdlIGZpbmQgdXNlcnMgd2hvIGhhdmUgc2F2ZWQgdG9rZW5zIHRvIGRlbGV0ZSBvbiBzdGFydHVwLCBkZWxldGVcbiAgICAvLyB0aGVtIG5vdy4gSXQncyBwb3NzaWJsZSB0aGF0IHRoZSBzZXJ2ZXIgY291bGQgaGF2ZSBjcmFzaGVkIGFuZCBjb21lXG4gICAgLy8gYmFjayB1cCBiZWZvcmUgbmV3IHRva2VucyBhcmUgZm91bmQgaW4gbG9jYWxTdG9yYWdlLCBidXQgdGhpc1xuICAgIC8vIHNob3VsZG4ndCBoYXBwZW4gdmVyeSBvZnRlbi4gV2Ugc2hvdWxkbid0IHB1dCBhIGRlbGF5IGhlcmUgYmVjYXVzZVxuICAgIC8vIHRoYXQgd291bGQgZ2l2ZSBhIGxvdCBvZiBwb3dlciB0byBhbiBhdHRhY2tlciB3aXRoIGEgc3RvbGVuIGxvZ2luXG4gICAgLy8gdG9rZW4gYW5kIHRoZSBhYmlsaXR5IHRvIGNyYXNoIHRoZSBzZXJ2ZXIuXG4gICAgTWV0ZW9yLnN0YXJ0dXAoYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgdXNlcnMgPSBhd2FpdCB0aGlzLnVzZXJzLmZpbmQoe1xuICAgICAgICBcInNlcnZpY2VzLnJlc3VtZS5oYXZlTG9naW5Ub2tlbnNUb0RlbGV0ZVwiOiB0cnVlXG4gICAgICB9LCB7XG4gICAgICAgIGZpZWxkczoge1xuICAgICAgICAgIFwic2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zVG9EZWxldGVcIjogMVxuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgdXNlcnMuZm9yRWFjaCh1c2VyID0+IHtcbiAgICAgICAgdGhpcy5fZGVsZXRlU2F2ZWRUb2tlbnNGb3JVc2VyKFxuICAgICAgICAgIHVzZXIuX2lkLFxuICAgICAgICAgIHVzZXIuc2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zVG9EZWxldGVcbiAgICAgICAgKVxuICAgICAgICAgIC8vIFdlIGRvbid0IG5lZWQgdG8gd2FpdCBmb3IgdGhpcyB0byBjb21wbGV0ZS5cbiAgICAgICAgICAudGhlbihfID0+IF8pXG4gICAgICAgICAgLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH07XG5cbiAgLy8vXG4gIC8vLyBNQU5BR0lORyBVU0VSIE9CSkVDVFNcbiAgLy8vXG5cbiAgLy8gVXBkYXRlcyBvciBjcmVhdGVzIGEgdXNlciBhZnRlciB3ZSBhdXRoZW50aWNhdGUgd2l0aCBhIDNyZCBwYXJ0eS5cbiAgLy9cbiAgLy8gQHBhcmFtIHNlcnZpY2VOYW1lIHtTdHJpbmd9IFNlcnZpY2UgbmFtZSAoZWcsIHR3aXR0ZXIpLlxuICAvLyBAcGFyYW0gc2VydmljZURhdGEge09iamVjdH0gRGF0YSB0byBzdG9yZSBpbiB0aGUgdXNlcidzIHJlY29yZFxuICAvLyAgICAgICAgdW5kZXIgc2VydmljZXNbc2VydmljZU5hbWVdLiBNdXN0IGluY2x1ZGUgYW4gXCJpZFwiIGZpZWxkXG4gIC8vICAgICAgICB3aGljaCBpcyBhIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgdXNlciBpbiB0aGUgc2VydmljZS5cbiAgLy8gQHBhcmFtIG9wdGlvbnMge09iamVjdCwgb3B0aW9uYWx9IE90aGVyIG9wdGlvbnMgdG8gcGFzcyB0byBpbnNlcnRVc2VyRG9jXG4gIC8vICAgICAgICAoZWcsIHByb2ZpbGUpXG4gIC8vIEByZXR1cm5zIHtPYmplY3R9IE9iamVjdCB3aXRoIHRva2VuIGFuZCBpZCBrZXlzLCBsaWtlIHRoZSByZXN1bHRcbiAgLy8gICAgICAgIG9mIHRoZSBcImxvZ2luXCIgbWV0aG9kLlxuICAvL1xuICBhc3luYyB1cGRhdGVPckNyZWF0ZVVzZXJGcm9tRXh0ZXJuYWxTZXJ2aWNlKFxuICAgIHNlcnZpY2VOYW1lLFxuICAgIHNlcnZpY2VEYXRhLFxuICAgIG9wdGlvbnNcbiAgKSB7XG4gICAgb3B0aW9ucyA9IHsgLi4ub3B0aW9ucyB9O1xuXG4gICAgaWYgKHNlcnZpY2VOYW1lID09PSBcInBhc3N3b3JkXCIgfHwgc2VydmljZU5hbWUgPT09IFwicmVzdW1lXCIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgXCJDYW4ndCB1c2UgdXBkYXRlT3JDcmVhdGVVc2VyRnJvbUV4dGVybmFsU2VydmljZSB3aXRoIGludGVybmFsIHNlcnZpY2UgXCJcbiAgICAgICAgKyBzZXJ2aWNlTmFtZSk7XG4gICAgfVxuICAgIGlmICghaGFzT3duLmNhbGwoc2VydmljZURhdGEsICdpZCcpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBTZXJ2aWNlIGRhdGEgZm9yIHNlcnZpY2UgJHtzZXJ2aWNlTmFtZX0gbXVzdCBpbmNsdWRlIGlkYCk7XG4gICAgfVxuXG4gICAgLy8gTG9vayBmb3IgYSB1c2VyIHdpdGggdGhlIGFwcHJvcHJpYXRlIHNlcnZpY2UgdXNlciBpZC5cbiAgICBjb25zdCBzZWxlY3RvciA9IHt9O1xuICAgIGNvbnN0IHNlcnZpY2VJZEtleSA9IGBzZXJ2aWNlcy4ke3NlcnZpY2VOYW1lfS5pZGA7XG5cbiAgICAvLyBYWFggVGVtcG9yYXJ5IHNwZWNpYWwgY2FzZSBmb3IgVHdpdHRlci4gKElzc3VlICM2MjkpXG4gICAgLy8gICBUaGUgc2VydmljZURhdGEuaWQgd2lsbCBiZSBhIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiBhbiBpbnRlZ2VyLlxuICAgIC8vICAgV2Ugd2FudCBpdCB0byBtYXRjaCBlaXRoZXIgYSBzdG9yZWQgc3RyaW5nIG9yIGludCByZXByZXNlbnRhdGlvbi5cbiAgICAvLyAgIFRoaXMgaXMgdG8gY2F0ZXIgdG8gZWFybGllciB2ZXJzaW9ucyBvZiBNZXRlb3Igc3RvcmluZyB0d2l0dGVyXG4gICAgLy8gICB1c2VyIElEcyBpbiBudW1iZXIgZm9ybSwgYW5kIHJlY2VudCB2ZXJzaW9ucyBzdG9yaW5nIHRoZW0gYXMgc3RyaW5ncy5cbiAgICAvLyAgIFRoaXMgY2FuIGJlIHJlbW92ZWQgb25jZSBtaWdyYXRpb24gdGVjaG5vbG9neSBpcyBpbiBwbGFjZSwgYW5kIHR3aXR0ZXJcbiAgICAvLyAgIHVzZXJzIHN0b3JlZCB3aXRoIGludGVnZXIgSURzIGhhdmUgYmVlbiBtaWdyYXRlZCB0byBzdHJpbmcgSURzLlxuICAgIGlmIChzZXJ2aWNlTmFtZSA9PT0gXCJ0d2l0dGVyXCIgJiYgIWlzTmFOKHNlcnZpY2VEYXRhLmlkKSkge1xuICAgICAgc2VsZWN0b3JbXCIkb3JcIl0gPSBbe30se31dO1xuICAgICAgc2VsZWN0b3JbXCIkb3JcIl1bMF1bc2VydmljZUlkS2V5XSA9IHNlcnZpY2VEYXRhLmlkO1xuICAgICAgc2VsZWN0b3JbXCIkb3JcIl1bMV1bc2VydmljZUlkS2V5XSA9IHBhcnNlSW50KHNlcnZpY2VEYXRhLmlkLCAxMCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGVjdG9yW3NlcnZpY2VJZEtleV0gPSBzZXJ2aWNlRGF0YS5pZDtcbiAgICB9XG4gICAgbGV0IHVzZXIgPSBhd2FpdCB0aGlzLnVzZXJzLmZpbmRPbmVBc3luYyhzZWxlY3Rvciwge2ZpZWxkczogdGhpcy5fb3B0aW9ucy5kZWZhdWx0RmllbGRTZWxlY3Rvcn0pO1xuICAgIC8vIENoZWNrIHRvIHNlZSBpZiB0aGUgZGV2ZWxvcGVyIGhhcyBhIGN1c3RvbSB3YXkgdG8gZmluZCB0aGUgdXNlciBvdXRzaWRlXG4gICAgLy8gb2YgdGhlIGdlbmVyYWwgc2VsZWN0b3JzIGFib3ZlLlxuICAgIGlmICghdXNlciAmJiB0aGlzLl9hZGRpdGlvbmFsRmluZFVzZXJPbkV4dGVybmFsTG9naW4pIHtcbiAgICAgIHVzZXIgPSBhd2FpdCB0aGlzLl9hZGRpdGlvbmFsRmluZFVzZXJPbkV4dGVybmFsTG9naW4oe3NlcnZpY2VOYW1lLCBzZXJ2aWNlRGF0YSwgb3B0aW9uc30pXG4gICAgfVxuXG4gICAgLy8gQmVmb3JlIGNvbnRpbnVpbmcsIHJ1biB1c2VyIGhvb2sgdG8gc2VlIGlmIHdlIHNob3VsZCBjb250aW51ZVxuICAgIGlmICh0aGlzLl9iZWZvcmVFeHRlcm5hbExvZ2luSG9vayAmJiAhKGF3YWl0IHRoaXMuX2JlZm9yZUV4dGVybmFsTG9naW5Ib29rKHNlcnZpY2VOYW1lLCBzZXJ2aWNlRGF0YSwgdXNlcikpKSB7XG4gICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJMb2dpbiBmb3JiaWRkZW5cIik7XG4gICAgfVxuXG4gICAgLy8gV2hlbiBjcmVhdGluZyBhIG5ldyB1c2VyIHdlIHBhc3MgdGhyb3VnaCBhbGwgb3B0aW9ucy4gV2hlbiB1cGRhdGluZyBhblxuICAgIC8vIGV4aXN0aW5nIHVzZXIsIGJ5IGRlZmF1bHQgd2Ugb25seSBwcm9jZXNzL3Bhc3MgdGhyb3VnaCB0aGUgc2VydmljZURhdGFcbiAgICAvLyAoZWcsIHNvIHRoYXQgd2Uga2VlcCBhbiB1bmV4cGlyZWQgYWNjZXNzIHRva2VuIGFuZCBkb24ndCBjYWNoZSBvbGQgZW1haWxcbiAgICAvLyBhZGRyZXNzZXMgaW4gc2VydmljZURhdGEuZW1haWwpLiBUaGUgb25FeHRlcm5hbExvZ2luIGhvb2sgY2FuIGJlIHVzZWQgd2hlblxuICAgIC8vIGNyZWF0aW5nIG9yIHVwZGF0aW5nIGEgdXNlciwgdG8gbW9kaWZ5IG9yIHBhc3MgdGhyb3VnaCBtb3JlIG9wdGlvbnMgYXNcbiAgICAvLyBuZWVkZWQuXG4gICAgbGV0IG9wdHMgPSB1c2VyID8ge30gOiBvcHRpb25zO1xuICAgIGlmICh0aGlzLl9vbkV4dGVybmFsTG9naW5Ib29rKSB7XG4gICAgICBvcHRzID0gYXdhaXQgdGhpcy5fb25FeHRlcm5hbExvZ2luSG9vayhvcHRpb25zLCB1c2VyKTtcbiAgICB9XG5cbiAgICBpZiAodXNlcikge1xuICAgICAgYXdhaXQgcGluRW5jcnlwdGVkRmllbGRzVG9Vc2VyKHNlcnZpY2VEYXRhLCB1c2VyLl9pZCk7XG5cbiAgICAgIGxldCBzZXRBdHRycyA9IHt9O1xuICAgICAgT2JqZWN0LmtleXMoc2VydmljZURhdGEpLmZvckVhY2goa2V5ID0+XG4gICAgICAgIHNldEF0dHJzW2BzZXJ2aWNlcy4ke3NlcnZpY2VOYW1lfS4ke2tleX1gXSA9IHNlcnZpY2VEYXRhW2tleV1cbiAgICAgICk7XG5cbiAgICAgIC8vIFhYWCBNYXliZSB3ZSBzaG91bGQgcmUtdXNlIHRoZSBzZWxlY3RvciBhYm92ZSBhbmQgbm90aWNlIGlmIHRoZSB1cGRhdGVcbiAgICAgIC8vICAgICB0b3VjaGVzIG5vdGhpbmc/XG4gICAgICBzZXRBdHRycyA9IHsgLi4uc2V0QXR0cnMsIC4uLm9wdHMgfTtcbiAgICAgIGF3YWl0IHRoaXMudXNlcnMudXBkYXRlQXN5bmModXNlci5faWQsIHtcbiAgICAgICAgJHNldDogc2V0QXR0cnNcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlOiBzZXJ2aWNlTmFtZSxcbiAgICAgICAgdXNlcklkOiB1c2VyLl9pZFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQ3JlYXRlIGEgbmV3IHVzZXIgd2l0aCB0aGUgc2VydmljZSBkYXRhLlxuICAgICAgdXNlciA9IHtzZXJ2aWNlczoge319O1xuICAgICAgdXNlci5zZXJ2aWNlc1tzZXJ2aWNlTmFtZV0gPSBzZXJ2aWNlRGF0YTtcbiAgICAgIGNvbnN0IHVzZXJJZCA9IGF3YWl0IHRoaXMuaW5zZXJ0VXNlckRvYyhvcHRzLCB1c2VyKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGU6IHNlcnZpY2VOYW1lLFxuICAgICAgICB1c2VySWRcbiAgICAgIH07XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBSZW1vdmVzIGRlZmF1bHQgcmF0ZSBsaW1pdGluZyBydWxlXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIGFjY291bnRzLWJhc2VcbiAgICovXG4gIHJlbW92ZURlZmF1bHRSYXRlTGltaXQoKSB7XG4gICAgY29uc3QgcmVzcCA9IEREUFJhdGVMaW1pdGVyLnJlbW92ZVJ1bGUodGhpcy5kZWZhdWx0UmF0ZUxpbWl0ZXJSdWxlSWQpO1xuICAgIHRoaXMuZGVmYXVsdFJhdGVMaW1pdGVyUnVsZUlkID0gbnVsbDtcbiAgICByZXR1cm4gcmVzcDtcbiAgfTtcblxuICAvKipcbiAgICogQHN1bW1hcnkgQWRkIGEgZGVmYXVsdCBydWxlIG9mIGxpbWl0aW5nIGxvZ2lucywgY3JlYXRpbmcgbmV3IHVzZXJzIGFuZCBwYXNzd29yZCByZXNldFxuICAgKiB0byA1IHRpbWVzIGV2ZXJ5IDEwIHNlY29uZHMgcGVyIGNvbm5lY3Rpb24uXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIGFjY291bnRzLWJhc2VcbiAgICovXG4gIGFkZERlZmF1bHRSYXRlTGltaXQoKSB7XG4gICAgaWYgKCF0aGlzLmRlZmF1bHRSYXRlTGltaXRlclJ1bGVJZCkge1xuICAgICAgdGhpcy5kZWZhdWx0UmF0ZUxpbWl0ZXJSdWxlSWQgPSBERFBSYXRlTGltaXRlci5hZGRSdWxlKHtcbiAgICAgICAgdXNlcklkOiBudWxsLFxuICAgICAgICBjbGllbnRBZGRyZXNzOiBudWxsLFxuICAgICAgICB0eXBlOiAnbWV0aG9kJyxcbiAgICAgICAgbmFtZTogbmFtZSA9PiBbJ2xvZ2luJywgJ2NyZWF0ZVVzZXInLCAncmVzZXRQYXNzd29yZCcsICdmb3Jnb3RQYXNzd29yZCddXG4gICAgICAgICAgLmluY2x1ZGVzKG5hbWUpLFxuICAgICAgICBjb25uZWN0aW9uSWQ6IChjb25uZWN0aW9uSWQpID0+IHRydWUsXG4gICAgICB9LCA1LCAxMDAwMCk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDcmVhdGVzIG9wdGlvbnMgZm9yIGVtYWlsIHNlbmRpbmcgZm9yIHJlc2V0IHBhc3N3b3JkIGFuZCBlbnJvbGwgYWNjb3VudCBlbWFpbHMuXG4gICAqIFlvdSBjYW4gdXNlIHRoaXMgZnVuY3Rpb24gd2hlbiBjdXN0b21pemluZyBhIHJlc2V0IHBhc3N3b3JkIG9yIGVucm9sbCBhY2NvdW50IGVtYWlsIHNlbmRpbmcuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtPYmplY3R9IGVtYWlsIFdoaWNoIGFkZHJlc3Mgb2YgdGhlIHVzZXIncyB0byBzZW5kIHRoZSBlbWFpbCB0by5cbiAgICogQHBhcmFtIHtPYmplY3R9IHVzZXIgVGhlIHVzZXIgb2JqZWN0IHRvIGdlbmVyYXRlIG9wdGlvbnMgZm9yLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gdXJsIFVSTCB0byB3aGljaCB1c2VyIGlzIGRpcmVjdGVkIHRvIGNvbmZpcm0gdGhlIGVtYWlsLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gcmVhc29uIGByZXNldFBhc3N3b3JkYCBvciBgZW5yb2xsQWNjb3VudGAuXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IE9wdGlvbnMgd2hpY2ggY2FuIGJlIHBhc3NlZCB0byBgRW1haWwuc2VuZGAuXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBhY2NvdW50cy1iYXNlXG4gICAqL1xuICBhc3luYyBnZW5lcmF0ZU9wdGlvbnNGb3JFbWFpbChlbWFpbCwgdXNlciwgdXJsLCByZWFzb24sIGV4dHJhID0ge30pe1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0bzogZW1haWwsXG4gICAgICBmcm9tOiB0aGlzLmVtYWlsVGVtcGxhdGVzW3JlYXNvbl0uZnJvbVxuICAgICAgICA/IGF3YWl0IHRoaXMuZW1haWxUZW1wbGF0ZXNbcmVhc29uXS5mcm9tKHVzZXIpXG4gICAgICAgIDogdGhpcy5lbWFpbFRlbXBsYXRlcy5mcm9tLFxuICAgICAgc3ViamVjdDogYXdhaXQgdGhpcy5lbWFpbFRlbXBsYXRlc1tyZWFzb25dLnN1YmplY3QodXNlciwgdXJsLCBleHRyYSksXG4gICAgfTtcblxuICAgIGlmICh0eXBlb2YgdGhpcy5lbWFpbFRlbXBsYXRlc1tyZWFzb25dLnRleHQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIG9wdGlvbnMudGV4dCA9IGF3YWl0IHRoaXMuZW1haWxUZW1wbGF0ZXNbcmVhc29uXS50ZXh0KHVzZXIsIHVybCwgZXh0cmEpO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdGhpcy5lbWFpbFRlbXBsYXRlc1tyZWFzb25dLmh0bWwgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIG9wdGlvbnMuaHRtbCA9IGF3YWl0IHRoaXMuZW1haWxUZW1wbGF0ZXNbcmVhc29uXS5odG1sKHVzZXIsIHVybCwgZXh0cmEpO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdGhpcy5lbWFpbFRlbXBsYXRlcy5oZWFkZXJzID09PSAnb2JqZWN0Jykge1xuICAgICAgb3B0aW9ucy5oZWFkZXJzID0gdGhpcy5lbWFpbFRlbXBsYXRlcy5oZWFkZXJzO1xuICAgIH1cblxuICAgIHJldHVybiBvcHRpb25zO1xuICB9O1xuXG4gIGFzeW5jIF9jaGVja0ZvckNhc2VJbnNlbnNpdGl2ZUR1cGxpY2F0ZXMoXG4gICAgZmllbGROYW1lLFxuICAgIGRpc3BsYXlOYW1lLFxuICAgIGZpZWxkVmFsdWUsXG4gICAgb3duVXNlcklkXG4gICkge1xuICAgIC8vIFNvbWUgdGVzdHMgbmVlZCB0aGUgYWJpbGl0eSB0byBhZGQgdXNlcnMgd2l0aCB0aGUgc2FtZSBjYXNlIGluc2Vuc2l0aXZlXG4gICAgLy8gdmFsdWUsIGhlbmNlIHRoZSBfc2tpcENhc2VJbnNlbnNpdGl2ZUNoZWNrc0ZvclRlc3QgY2hlY2tcbiAgICBjb25zdCBza2lwQ2hlY2sgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoXG4gICAgICB0aGlzLl9za2lwQ2FzZUluc2Vuc2l0aXZlQ2hlY2tzRm9yVGVzdCxcbiAgICAgIGZpZWxkVmFsdWVcbiAgICApO1xuXG4gICAgaWYgKGZpZWxkVmFsdWUgJiYgIXNraXBDaGVjaykge1xuICAgICAgY29uc3QgbWF0Y2hlZFVzZXJzID0gYXdhaXQgTWV0ZW9yLnVzZXJzXG4gICAgICAgIC5maW5kKFxuICAgICAgICAgIHRoaXMuX3NlbGVjdG9yRm9yRmFzdENhc2VJbnNlbnNpdGl2ZUxvb2t1cChmaWVsZE5hbWUsIGZpZWxkVmFsdWUpLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGZpZWxkczogeyBfaWQ6IDEgfSxcbiAgICAgICAgICAgIC8vIHdlIG9ubHkgbmVlZCBhIG1heGltdW0gb2YgMiB1c2VycyBmb3IgdGhlIGxvZ2ljIGJlbG93IHRvIHdvcmtcbiAgICAgICAgICAgIGxpbWl0OiAyLFxuICAgICAgICAgIH1cbiAgICAgICAgKVxuICAgICAgICAuZmV0Y2hBc3luYygpO1xuXG4gICAgICBpZiAoXG4gICAgICAgIG1hdGNoZWRVc2Vycy5sZW5ndGggPiAwICYmXG4gICAgICAgIC8vIElmIHdlIGRvbid0IGhhdmUgYSB1c2VySWQgeWV0LCBhbnkgbWF0Y2ggd2UgZmluZCBpcyBhIGR1cGxpY2F0ZVxuICAgICAgICAoIW93blVzZXJJZCB8fFxuICAgICAgICAgIC8vIE90aGVyd2lzZSwgY2hlY2sgdG8gc2VlIGlmIHRoZXJlIGFyZSBtdWx0aXBsZSBtYXRjaGVzIG9yIGEgbWF0Y2hcbiAgICAgICAgICAvLyB0aGF0IGlzIG5vdCB1c1xuICAgICAgICAgIG1hdGNoZWRVc2Vycy5sZW5ndGggPiAxIHx8IG1hdGNoZWRVc2Vyc1swXS5faWQgIT09IG93blVzZXJJZClcbiAgICAgICkge1xuICAgICAgICB0aGlzLl9oYW5kbGVFcnJvcihgJHtkaXNwbGF5TmFtZX0gYWxyZWFkeSBleGlzdHMuYCk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIGFzeW5jIF9jcmVhdGVVc2VyQ2hlY2tpbmdEdXBsaWNhdGVzKHsgdXNlciwgZW1haWwsIHVzZXJuYW1lLCBvcHRpb25zIH0pIHtcbiAgICBjb25zdCBuZXdVc2VyID0ge1xuICAgICAgLi4udXNlcixcbiAgICAgIC4uLih1c2VybmFtZSA/IHsgdXNlcm5hbWUgfSA6IHt9KSxcbiAgICAgIC4uLihlbWFpbCA/IHsgZW1haWxzOiBbeyBhZGRyZXNzOiBlbWFpbCwgdmVyaWZpZWQ6IGZhbHNlIH1dIH0gOiB7fSksXG4gICAgfTtcblxuICAgIC8vIFBlcmZvcm0gYSBjYXNlIGluc2Vuc2l0aXZlIGNoZWNrIGJlZm9yZSBpbnNlcnRcbiAgICBhd2FpdCB0aGlzLl9jaGVja0ZvckNhc2VJbnNlbnNpdGl2ZUR1cGxpY2F0ZXMoJ3VzZXJuYW1lJywgJ1VzZXJuYW1lJywgdXNlcm5hbWUpO1xuICAgIGF3YWl0IHRoaXMuX2NoZWNrRm9yQ2FzZUluc2Vuc2l0aXZlRHVwbGljYXRlcygnZW1haWxzLmFkZHJlc3MnLCAnRW1haWwnLCBlbWFpbCk7XG5cbiAgICBjb25zdCB1c2VySWQgPSBhd2FpdCB0aGlzLmluc2VydFVzZXJEb2Mob3B0aW9ucywgbmV3VXNlcik7XG4gICAgLy8gUGVyZm9ybSBhbm90aGVyIGNoZWNrIGFmdGVyIGluc2VydCwgaW4gY2FzZSBhIG1hdGNoaW5nIHVzZXIgaGFzIGJlZW5cbiAgICAvLyBpbnNlcnRlZCBpbiB0aGUgbWVhbnRpbWVcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5fY2hlY2tGb3JDYXNlSW5zZW5zaXRpdmVEdXBsaWNhdGVzKCd1c2VybmFtZScsICdVc2VybmFtZScsIHVzZXJuYW1lLCB1c2VySWQpO1xuICAgICAgYXdhaXQgdGhpcy5fY2hlY2tGb3JDYXNlSW5zZW5zaXRpdmVEdXBsaWNhdGVzKCdlbWFpbHMuYWRkcmVzcycsICdFbWFpbCcsIGVtYWlsLCB1c2VySWQpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAvLyBSZW1vdmUgaW5zZXJ0ZWQgdXNlciBpZiB0aGUgY2hlY2sgZmFpbHNcbiAgICAgIGF3YWl0IE1ldGVvci51c2Vycy5yZW1vdmVBc3luYyh1c2VySWQpO1xuICAgICAgdGhyb3cgZXg7XG4gICAgfVxuICAgIHJldHVybiB1c2VySWQ7XG4gIH1cblxuICBfaGFuZGxlRXJyb3IgPSAobXNnLCB0aHJvd0Vycm9yID0gdHJ1ZSwgZXJyb3JDb2RlID0gNDAzKSA9PiB7XG4gICAgY29uc3QgaXNFcnJvckFtYmlndW91cyA9IHRoaXMuX29wdGlvbnMuYW1iaWd1b3VzRXJyb3JNZXNzYWdlcyA/PyB0cnVlO1xuICAgIGNvbnN0IGVycm9yID0gbmV3IE1ldGVvci5FcnJvcihcbiAgICAgIGVycm9yQ29kZSxcbiAgICAgIGlzRXJyb3JBbWJpZ3VvdXNcbiAgICAgICAgPyAnU29tZXRoaW5nIHdlbnQgd3JvbmcuIFBsZWFzZSBjaGVjayB5b3VyIGNyZWRlbnRpYWxzLidcbiAgICAgICAgOiBtc2dcbiAgICApO1xuICAgIGlmICh0aHJvd0Vycm9yKSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gICAgcmV0dXJuIGVycm9yO1xuICB9XG5cbiAgX3VzZXJRdWVyeVZhbGlkYXRvciA9IE1hdGNoLldoZXJlKHVzZXIgPT4ge1xuICAgIGNoZWNrKHVzZXIsIHtcbiAgICAgIGlkOiBNYXRjaC5PcHRpb25hbChOb25FbXB0eVN0cmluZyksXG4gICAgICB1c2VybmFtZTogTWF0Y2guT3B0aW9uYWwoTm9uRW1wdHlTdHJpbmcpLFxuICAgICAgZW1haWw6IE1hdGNoLk9wdGlvbmFsKE5vbkVtcHR5U3RyaW5nKVxuICAgIH0pO1xuICAgIGlmIChPYmplY3Qua2V5cyh1c2VyKS5sZW5ndGggIT09IDEpXG4gICAgICB0aHJvdyBuZXcgTWF0Y2guRXJyb3IoXCJVc2VyIHByb3BlcnR5IG11c3QgaGF2ZSBleGFjdGx5IG9uZSBmaWVsZFwiKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSk7XG5cbn1cblxuLy8gR2l2ZSBlYWNoIGxvZ2luIGhvb2sgY2FsbGJhY2sgYSBmcmVzaCBjbG9uZWQgY29weSBvZiB0aGUgYXR0ZW1wdFxuLy8gb2JqZWN0LCBidXQgZG9uJ3QgY2xvbmUgdGhlIGNvbm5lY3Rpb24uXG4vL1xuY29uc3QgY2xvbmVBdHRlbXB0V2l0aENvbm5lY3Rpb24gPSAoY29ubmVjdGlvbiwgYXR0ZW1wdCkgPT4ge1xuICBjb25zdCBjbG9uZWRBdHRlbXB0ID0gRUpTT04uY2xvbmUoYXR0ZW1wdCk7XG4gIGNsb25lZEF0dGVtcHQuY29ubmVjdGlvbiA9IGNvbm5lY3Rpb247XG4gIHJldHVybiBjbG9uZWRBdHRlbXB0O1xufTtcblxuY29uc3QgdHJ5TG9naW5NZXRob2QgPSBhc3luYyAodHlwZSwgZm4pID0+IHtcbiAgbGV0IHJlc3VsdDtcbiAgdHJ5IHtcbiAgICByZXN1bHQgPSBhd2FpdCBmbigpO1xuICB9XG4gIGNhdGNoIChlKSB7XG4gICAgcmVzdWx0ID0ge2Vycm9yOiBlfTtcbiAgfVxuXG4gIGlmIChyZXN1bHQgJiYgIXJlc3VsdC50eXBlICYmIHR5cGUpXG4gICAgcmVzdWx0LnR5cGUgPSB0eXBlO1xuXG4gIHJldHVybiByZXN1bHQ7XG59O1xuXG5jb25zdCBzZXR1cERlZmF1bHRMb2dpbkhhbmRsZXJzID0gYWNjb3VudHMgPT4ge1xuICBhY2NvdW50cy5yZWdpc3RlckxvZ2luSGFuZGxlcihcInJlc3VtZVwiLCBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHJldHVybiBkZWZhdWx0UmVzdW1lTG9naW5IYW5kbGVyLmNhbGwodGhpcywgYWNjb3VudHMsIG9wdGlvbnMpO1xuICB9KTtcbn07XG5cbi8vIExvZ2luIGhhbmRsZXIgZm9yIHJlc3VtZSB0b2tlbnMuXG5jb25zdCBkZWZhdWx0UmVzdW1lTG9naW5IYW5kbGVyID0gYXN5bmMgKGFjY291bnRzLCBvcHRpb25zKSA9PiB7XG4gIGlmICghb3B0aW9ucy5yZXN1bWUpXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcblxuICBjaGVjayhvcHRpb25zLnJlc3VtZSwgU3RyaW5nKTtcblxuICBjb25zdCBoYXNoZWRUb2tlbiA9IGFjY291bnRzLl9oYXNoTG9naW5Ub2tlbihvcHRpb25zLnJlc3VtZSk7XG5cbiAgLy8gRmlyc3QgbG9vayBmb3IganVzdCB0aGUgbmV3LXN0eWxlIGhhc2hlZCBsb2dpbiB0b2tlbiwgdG8gYXZvaWRcbiAgLy8gc2VuZGluZyB0aGUgdW5oYXNoZWQgdG9rZW4gdG8gdGhlIGRhdGFiYXNlIGluIGEgcXVlcnkgaWYgd2UgZG9uJ3RcbiAgLy8gbmVlZCB0by5cbiAgbGV0IHVzZXIgPSBhd2FpdCBhY2NvdW50cy51c2Vycy5maW5kT25lQXN5bmMoXG4gICAge1wic2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zLmhhc2hlZFRva2VuXCI6IGhhc2hlZFRva2VufSxcbiAgICB7ZmllbGRzOiB7XCJzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnMuJFwiOiAxfX0pO1xuXG4gIGlmICghIHVzZXIpIHtcbiAgICAvLyBJZiB3ZSBkaWRuJ3QgZmluZCB0aGUgaGFzaGVkIGxvZ2luIHRva2VuLCB0cnkgYWxzbyBsb29raW5nIGZvclxuICAgIC8vIHRoZSBvbGQtc3R5bGUgdW5oYXNoZWQgdG9rZW4uICBCdXQgd2UgbmVlZCB0byBsb29rIGZvciBlaXRoZXJcbiAgICAvLyB0aGUgb2xkLXN0eWxlIHRva2VuIE9SIHRoZSBuZXctc3R5bGUgdG9rZW4sIGJlY2F1c2UgYW5vdGhlclxuICAgIC8vIGNsaWVudCBjb25uZWN0aW9uIGxvZ2dpbmcgaW4gc2ltdWx0YW5lb3VzbHkgbWlnaHQgaGF2ZSBhbHJlYWR5XG4gICAgLy8gY29udmVydGVkIHRoZSB0b2tlbi5cbiAgICB1c2VyID0gIGF3YWl0IGFjY291bnRzLnVzZXJzLmZpbmRPbmVBc3luYyh7XG4gICAgICAgICRvcjogW1xuICAgICAgICAgIHtcInNlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vucy5oYXNoZWRUb2tlblwiOiBoYXNoZWRUb2tlbn0sXG4gICAgICAgICAge1wic2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zLnRva2VuXCI6IG9wdGlvbnMucmVzdW1lfVxuICAgICAgICBdXG4gICAgICB9LFxuICAgICAgLy8gTm90ZTogQ2Fubm90IHVzZSAuLi5sb2dpblRva2Vucy4kIHBvc2l0aW9uYWwgb3BlcmF0b3Igd2l0aCAkb3IgcXVlcnkuXG4gICAgICB7ZmllbGRzOiB7XCJzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnNcIjogMX19KTtcbiAgfVxuXG4gIGlmICghIHVzZXIpXG4gICAgcmV0dXJuIHtcbiAgICAgIGVycm9yOiBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJZb3UndmUgYmVlbiBsb2dnZWQgb3V0IGJ5IHRoZSBzZXJ2ZXIuIFBsZWFzZSBsb2cgaW4gYWdhaW4uXCIpXG4gICAgfTtcblxuICAvLyBGaW5kIHRoZSB0b2tlbiwgd2hpY2ggd2lsbCBlaXRoZXIgYmUgYW4gb2JqZWN0IHdpdGggZmllbGRzXG4gIC8vIHtoYXNoZWRUb2tlbiwgd2hlbn0gZm9yIGEgaGFzaGVkIHRva2VuIG9yIHt0b2tlbiwgd2hlbn0gZm9yIGFuXG4gIC8vIHVuaGFzaGVkIHRva2VuLlxuICBsZXQgb2xkVW5oYXNoZWRTdHlsZVRva2VuO1xuICBsZXQgdG9rZW4gPSBhd2FpdCB1c2VyLnNlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vucy5maW5kKHRva2VuID0+XG4gICAgdG9rZW4uaGFzaGVkVG9rZW4gPT09IGhhc2hlZFRva2VuXG4gICk7XG4gIGlmICh0b2tlbikge1xuICAgIG9sZFVuaGFzaGVkU3R5bGVUb2tlbiA9IGZhbHNlO1xuICB9IGVsc2Uge1xuICAgICB0b2tlbiA9IGF3YWl0IHVzZXIuc2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zLmZpbmQodG9rZW4gPT5cbiAgICAgIHRva2VuLnRva2VuID09PSBvcHRpb25zLnJlc3VtZVxuICAgICk7XG4gICAgb2xkVW5oYXNoZWRTdHlsZVRva2VuID0gdHJ1ZTtcbiAgfVxuXG4gIGNvbnN0IHRva2VuRXhwaXJlcyA9IGFjY291bnRzLl90b2tlbkV4cGlyYXRpb24odG9rZW4ud2hlbik7XG4gIGlmIChuZXcgRGF0ZSgpID49IHRva2VuRXhwaXJlcylcbiAgICByZXR1cm4ge1xuICAgICAgdXNlcklkOiB1c2VyLl9pZCxcbiAgICAgIGVycm9yOiBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJZb3VyIHNlc3Npb24gaGFzIGV4cGlyZWQuIFBsZWFzZSBsb2cgaW4gYWdhaW4uXCIpXG4gICAgfTtcblxuICAvLyBVcGRhdGUgdG8gYSBoYXNoZWQgdG9rZW4gd2hlbiBhbiB1bmhhc2hlZCB0b2tlbiBpcyBlbmNvdW50ZXJlZC5cbiAgaWYgKG9sZFVuaGFzaGVkU3R5bGVUb2tlbikge1xuICAgIC8vIE9ubHkgYWRkIHRoZSBuZXcgaGFzaGVkIHRva2VuIGlmIHRoZSBvbGQgdW5oYXNoZWQgdG9rZW4gc3RpbGxcbiAgICAvLyBleGlzdHMgKHRoaXMgYXZvaWRzIHJlc3VycmVjdGluZyB0aGUgdG9rZW4gaWYgaXQgd2FzIGRlbGV0ZWRcbiAgICAvLyBhZnRlciB3ZSByZWFkIGl0KS4gIFVzaW5nICRhZGRUb1NldCBhdm9pZHMgZ2V0dGluZyBhbiBpbmRleFxuICAgIC8vIGVycm9yIGlmIGFub3RoZXIgY2xpZW50IGxvZ2dpbmcgaW4gc2ltdWx0YW5lb3VzbHkgaGFzIGFscmVhZHlcbiAgICAvLyBpbnNlcnRlZCB0aGUgbmV3IGhhc2hlZCB0b2tlbi5cbiAgICBhd2FpdCBhY2NvdW50cy51c2Vycy51cGRhdGVBc3luYyhcbiAgICAgIHtcbiAgICAgICAgX2lkOiB1c2VyLl9pZCxcbiAgICAgICAgXCJzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnMudG9rZW5cIjogb3B0aW9ucy5yZXN1bWVcbiAgICAgIH0sXG4gICAgICB7JGFkZFRvU2V0OiB7XG4gICAgICAgICAgXCJzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnNcIjoge1xuICAgICAgICAgICAgXCJoYXNoZWRUb2tlblwiOiBoYXNoZWRUb2tlbixcbiAgICAgICAgICAgIFwid2hlblwiOiB0b2tlbi53aGVuXG4gICAgICAgICAgfVxuICAgICAgICB9fVxuICAgICk7XG5cbiAgICAvLyBSZW1vdmUgdGhlIG9sZCB0b2tlbiAqYWZ0ZXIqIGFkZGluZyB0aGUgbmV3LCBzaW5jZSBvdGhlcndpc2VcbiAgICAvLyBhbm90aGVyIGNsaWVudCB0cnlpbmcgdG8gbG9naW4gYmV0d2VlbiBvdXIgcmVtb3ZpbmcgdGhlIG9sZCBhbmRcbiAgICAvLyBhZGRpbmcgdGhlIG5ldyB3b3VsZG4ndCBmaW5kIGEgdG9rZW4gdG8gbG9naW4gd2l0aC5cbiAgICBhd2FpdCBhY2NvdW50cy51c2Vycy51cGRhdGVBc3luYyh1c2VyLl9pZCwge1xuICAgICAgJHB1bGw6IHtcbiAgICAgICAgXCJzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnNcIjogeyBcInRva2VuXCI6IG9wdGlvbnMucmVzdW1lIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgdXNlcklkOiB1c2VyLl9pZCxcbiAgICBzdGFtcGVkTG9naW5Ub2tlbjoge1xuICAgICAgdG9rZW46IG9wdGlvbnMucmVzdW1lLFxuICAgICAgd2hlbjogdG9rZW4ud2hlblxuICAgIH1cbiAgfTtcbn07XG5cbmNvbnN0IGV4cGlyZVBhc3N3b3JkVG9rZW4gPVxuICBhc3luYyAoXG4gICAgYWNjb3VudHMsXG4gICAgb2xkZXN0VmFsaWREYXRlLFxuICAgIHRva2VuRmlsdGVyLFxuICAgIHVzZXJJZFxuICApID0+IHtcbiAgICAvLyBib29sZWFuIHZhbHVlIHVzZWQgdG8gZGV0ZXJtaW5lIGlmIHRoaXMgbWV0aG9kIHdhcyBjYWxsZWQgZnJvbSBlbnJvbGwgYWNjb3VudCB3b3JrZmxvd1xuICAgIGxldCBpc0Vucm9sbCA9IGZhbHNlO1xuICAgIGNvbnN0IHVzZXJGaWx0ZXIgPSB1c2VySWQgPyB7IF9pZDogdXNlcklkIH0gOiB7fTtcbiAgICAvLyBjaGVjayBpZiB0aGlzIG1ldGhvZCB3YXMgY2FsbGVkIGZyb20gZW5yb2xsIGFjY291bnQgd29ya2Zsb3dcbiAgICBpZiAodG9rZW5GaWx0ZXJbJ3NlcnZpY2VzLnBhc3N3b3JkLmVucm9sbC5yZWFzb24nXSkge1xuICAgICAgaXNFbnJvbGwgPSB0cnVlO1xuICAgIH1cbiAgICBsZXQgcmVzZXRSYW5nZU9yID0ge1xuICAgICAgJG9yOiBbXG4gICAgICAgIHsgXCJzZXJ2aWNlcy5wYXNzd29yZC5yZXNldC53aGVuXCI6IHsgJGx0OiBvbGRlc3RWYWxpZERhdGUgfSB9LFxuICAgICAgICB7IFwic2VydmljZXMucGFzc3dvcmQucmVzZXQud2hlblwiOiB7ICRsdDogK29sZGVzdFZhbGlkRGF0ZSB9IH1cbiAgICAgIF1cbiAgICB9O1xuICAgIGlmIChpc0Vucm9sbCkge1xuICAgICAgcmVzZXRSYW5nZU9yID0ge1xuICAgICAgICAkb3I6IFtcbiAgICAgICAgICB7IFwic2VydmljZXMucGFzc3dvcmQuZW5yb2xsLndoZW5cIjogeyAkbHQ6IG9sZGVzdFZhbGlkRGF0ZSB9IH0sXG4gICAgICAgICAgeyBcInNlcnZpY2VzLnBhc3N3b3JkLmVucm9sbC53aGVuXCI6IHsgJGx0OiArb2xkZXN0VmFsaWREYXRlIH0gfVxuICAgICAgICBdXG4gICAgICB9O1xuICAgIH1cbiAgICBjb25zdCBleHBpcmVGaWx0ZXIgPSB7ICRhbmQ6IFt0b2tlbkZpbHRlciwgcmVzZXRSYW5nZU9yXSB9O1xuICAgIGlmIChpc0Vucm9sbCkge1xuICAgICAgYXdhaXQgYWNjb3VudHMudXNlcnMudXBkYXRlQXN5bmMoeyAuLi51c2VyRmlsdGVyLCAuLi5leHBpcmVGaWx0ZXIgfSwge1xuICAgICAgICAkdW5zZXQ6IHtcbiAgICAgICAgICBcInNlcnZpY2VzLnBhc3N3b3JkLmVucm9sbFwiOiBcIlwiXG4gICAgICAgIH1cbiAgICAgIH0sIHsgbXVsdGk6IHRydWUgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGF3YWl0IGFjY291bnRzLnVzZXJzLnVwZGF0ZUFzeW5jKHsgLi4udXNlckZpbHRlciwgLi4uZXhwaXJlRmlsdGVyIH0sIHtcbiAgICAgICAgJHVuc2V0OiB7XG4gICAgICAgICAgXCJzZXJ2aWNlcy5wYXNzd29yZC5yZXNldFwiOiBcIlwiXG4gICAgICAgIH1cbiAgICAgIH0sIHsgbXVsdGk6IHRydWUgfSk7XG4gICAgfVxuXG4gIH07XG5cbmNvbnN0IHNldEV4cGlyZVRva2Vuc0ludGVydmFsID0gYWNjb3VudHMgPT4ge1xuICBhY2NvdW50cy5leHBpcmVUb2tlbkludGVydmFsID0gTWV0ZW9yLnNldEludGVydmFsKGFzeW5jICgpID0+IHtcbiAgIGF3YWl0IGFjY291bnRzLl9leHBpcmVUb2tlbnMoKTtcbiAgIGF3YWl0IGFjY291bnRzLl9leHBpcmVQYXNzd29yZFJlc2V0VG9rZW5zKCk7XG4gICBhd2FpdCBhY2NvdW50cy5fZXhwaXJlUGFzc3dvcmRFbnJvbGxUb2tlbnMoKTtcbiAgfSwgRVhQSVJFX1RPS0VOU19JTlRFUlZBTF9NUyk7XG59O1xuXG5jb25zdCBPQXV0aEVuY3J5cHRpb24gPSBQYWNrYWdlW1wib2F1dGgtZW5jcnlwdGlvblwiXT8uT0F1dGhFbmNyeXB0aW9uO1xuXG4vLyBPQXV0aCBzZXJ2aWNlIGRhdGEgaXMgdGVtcG9yYXJpbHkgc3RvcmVkIGluIHRoZSBwZW5kaW5nIGNyZWRlbnRpYWxzXG4vLyBjb2xsZWN0aW9uIGR1cmluZyB0aGUgb2F1dGggYXV0aGVudGljYXRpb24gcHJvY2Vzcy4gIFNlbnNpdGl2ZSBkYXRhXG4vLyBzdWNoIGFzIGFjY2VzcyB0b2tlbnMgYXJlIGVuY3J5cHRlZCB3aXRob3V0IHRoZSB1c2VyIGlkIGJlY2F1c2Vcbi8vIHdlIGRvbid0IGtub3cgdGhlIHVzZXIgaWQgeWV0LiAgV2UgcmUtZW5jcnlwdCB0aGVzZSBmaWVsZHMgd2l0aCB0aGVcbi8vIHVzZXIgaWQgaW5jbHVkZWQgd2hlbiBzdG9yaW5nIHRoZSBzZXJ2aWNlIGRhdGEgcGVybWFuZW50bHkgaW5cbi8vIHRoZSB1c2VycyBjb2xsZWN0aW9uLlxuLy9cbmNvbnN0IHBpbkVuY3J5cHRlZEZpZWxkc1RvVXNlciA9IChzZXJ2aWNlRGF0YSwgdXNlcklkKSA9PiB7XG4gIE9iamVjdC5rZXlzKHNlcnZpY2VEYXRhKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgbGV0IHZhbHVlID0gc2VydmljZURhdGFba2V5XTtcbiAgICBpZiAoT0F1dGhFbmNyeXB0aW9uPy5pc1NlYWxlZCh2YWx1ZSkpXG4gICAgICB2YWx1ZSA9IE9BdXRoRW5jcnlwdGlvbi5zZWFsKE9BdXRoRW5jcnlwdGlvbi5vcGVuKHZhbHVlKSwgdXNlcklkKTtcbiAgICBzZXJ2aWNlRGF0YVtrZXldID0gdmFsdWU7XG4gIH0pO1xufTtcblxuLy8gWFhYIHNlZSBjb21tZW50IG9uIEFjY291bnRzLmNyZWF0ZVVzZXIgaW4gcGFzc3dvcmRzX3NlcnZlciBhYm91dCBhZGRpbmcgYVxuLy8gc2Vjb25kIFwic2VydmVyIG9wdGlvbnNcIiBhcmd1bWVudC5cbmNvbnN0IGRlZmF1bHRDcmVhdGVVc2VySG9vayA9IChvcHRpb25zLCB1c2VyKSA9PiB7XG4gIGlmIChvcHRpb25zLnByb2ZpbGUpXG4gICAgdXNlci5wcm9maWxlID0gb3B0aW9ucy5wcm9maWxlO1xuICByZXR1cm4gdXNlcjtcbn07XG5cbi8vIFZhbGlkYXRlIG5ldyB1c2VyJ3MgZW1haWwgb3IgR29vZ2xlL0ZhY2Vib29rL0dpdEh1YiBhY2NvdW50J3MgZW1haWxcbmZ1bmN0aW9uIGRlZmF1bHRWYWxpZGF0ZU5ld1VzZXJIb29rKHVzZXIpIHtcbiAgY29uc3QgZG9tYWluID0gdGhpcy5fb3B0aW9ucy5yZXN0cmljdENyZWF0aW9uQnlFbWFpbERvbWFpbjtcbiAgaWYgKCFkb21haW4pIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGxldCBlbWFpbElzR29vZCA9IGZhbHNlO1xuICBpZiAodXNlci5lbWFpbHMgJiYgdXNlci5lbWFpbHMubGVuZ3RoID4gMCkge1xuICAgIGVtYWlsSXNHb29kID0gdXNlci5lbWFpbHMucmVkdWNlKFxuICAgICAgKHByZXYsIGVtYWlsKSA9PiBwcmV2IHx8IHRoaXMuX3Rlc3RFbWFpbERvbWFpbihlbWFpbC5hZGRyZXNzKSwgZmFsc2VcbiAgICApO1xuICB9IGVsc2UgaWYgKHVzZXIuc2VydmljZXMgJiYgT2JqZWN0LnZhbHVlcyh1c2VyLnNlcnZpY2VzKS5sZW5ndGggPiAwKSB7XG4gICAgLy8gRmluZCBhbnkgZW1haWwgb2YgYW55IHNlcnZpY2UgYW5kIGNoZWNrIGl0XG4gICAgZW1haWxJc0dvb2QgPSBPYmplY3QudmFsdWVzKHVzZXIuc2VydmljZXMpLnJlZHVjZShcbiAgICAgIChwcmV2LCBzZXJ2aWNlKSA9PiBzZXJ2aWNlLmVtYWlsICYmIHRoaXMuX3Rlc3RFbWFpbERvbWFpbihzZXJ2aWNlLmVtYWlsKSxcbiAgICAgIGZhbHNlLFxuICAgICk7XG4gIH1cblxuICBpZiAoZW1haWxJc0dvb2QpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgZG9tYWluID09PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBgQCR7ZG9tYWlufSBlbWFpbCByZXF1aXJlZGApO1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIkVtYWlsIGRvZXNuJ3QgbWF0Y2ggdGhlIGNyaXRlcmlhLlwiKTtcbiAgfVxufVxuXG5jb25zdCBzZXR1cFVzZXJzQ29sbGVjdGlvbiA9IGFzeW5jIHVzZXJzID0+IHtcbiAgLy8vXG4gIC8vLyBSRVNUUklDVElORyBXUklURVMgVE8gVVNFUiBPQkpFQ1RTXG4gIC8vL1xuICB1c2Vycy5hbGxvdyh7XG4gICAgLy8gY2xpZW50cyBjYW4gbW9kaWZ5IHRoZSBwcm9maWxlIGZpZWxkIG9mIHRoZWlyIG93biBkb2N1bWVudCwgYW5kXG4gICAgLy8gbm90aGluZyBlbHNlLlxuICAgIHVwZGF0ZTogKHVzZXJJZCwgdXNlciwgZmllbGRzLCBtb2RpZmllcikgPT4ge1xuICAgICAgLy8gbWFrZSBzdXJlIGl0IGlzIG91ciByZWNvcmRcbiAgICAgIGlmICh1c2VyLl9pZCAhPT0gdXNlcklkKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgLy8gdXNlciBjYW4gb25seSBtb2RpZnkgdGhlICdwcm9maWxlJyBmaWVsZC4gc2V0cyB0byBtdWx0aXBsZVxuICAgICAgLy8gc3ViLWtleXMgKGVnIHByb2ZpbGUuZm9vIGFuZCBwcm9maWxlLmJhcikgYXJlIG1lcmdlZCBpbnRvIGVudHJ5XG4gICAgICAvLyBpbiB0aGUgZmllbGRzIGxpc3QuXG4gICAgICBpZiAoZmllbGRzLmxlbmd0aCAhPT0gMSB8fCBmaWVsZHNbMF0gIT09ICdwcm9maWxlJykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG4gICAgdXBkYXRlQXN5bmM6ICh1c2VySWQsIHVzZXIsIGZpZWxkcywgbW9kaWZpZXIpID0+IHtcbiAgICAgIC8vIG1ha2Ugc3VyZSBpdCBpcyBvdXIgcmVjb3JkXG4gICAgICBpZiAodXNlci5faWQgIT09IHVzZXJJZCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIC8vIHVzZXIgY2FuIG9ubHkgbW9kaWZ5IHRoZSAncHJvZmlsZScgZmllbGQuIHNldHMgdG8gbXVsdGlwbGVcbiAgICAgIC8vIHN1Yi1rZXlzIChlZyBwcm9maWxlLmZvbyBhbmQgcHJvZmlsZS5iYXIpIGFyZSBtZXJnZWQgaW50byBlbnRyeVxuICAgICAgLy8gaW4gdGhlIGZpZWxkcyBsaXN0LlxuICAgICAgaWYgKGZpZWxkcy5sZW5ndGggIT09IDEgfHwgZmllbGRzWzBdICE9PSAncHJvZmlsZScpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuICAgIGZldGNoOiBbJ19pZCddIC8vIHdlIG9ubHkgbG9vayBhdCBfaWQuXG4gIH0pO1xuXG4gIC8vLyBERUZBVUxUIElOREVYRVMgT04gVVNFUlNcbiAgYXdhaXQgdXNlcnMuY3JlYXRlSW5kZXhBc3luYygndXNlcm5hbWUnLCB7IHVuaXF1ZTogdHJ1ZSwgc3BhcnNlOiB0cnVlIH0pO1xuICBhd2FpdCB1c2Vycy5jcmVhdGVJbmRleEFzeW5jKCdlbWFpbHMuYWRkcmVzcycsIHsgdW5pcXVlOiB0cnVlLCBzcGFyc2U6IHRydWUgfSk7XG4gIGF3YWl0IHVzZXJzLmNyZWF0ZUluZGV4QXN5bmMoJ3NlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vucy5oYXNoZWRUb2tlbicsXG4gICAgeyB1bmlxdWU6IHRydWUsIHNwYXJzZTogdHJ1ZSB9KTtcbiAgYXdhaXQgdXNlcnMuY3JlYXRlSW5kZXhBc3luYygnc2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zLnRva2VuJyxcbiAgICB7IHVuaXF1ZTogdHJ1ZSwgc3BhcnNlOiB0cnVlIH0pO1xuICAvLyBGb3IgdGFraW5nIGNhcmUgb2YgbG9nb3V0T3RoZXJDbGllbnRzIGNhbGxzIHRoYXQgY3Jhc2hlZCBiZWZvcmUgdGhlXG4gIC8vIHRva2VucyB3ZXJlIGRlbGV0ZWQuXG4gIGF3YWl0IHVzZXJzLmNyZWF0ZUluZGV4QXN5bmMoJ3NlcnZpY2VzLnJlc3VtZS5oYXZlTG9naW5Ub2tlbnNUb0RlbGV0ZScsXG4gICAgeyBzcGFyc2U6IHRydWUgfSk7XG4gIC8vIEZvciBleHBpcmluZyBsb2dpbiB0b2tlbnNcbiAgYXdhaXQgdXNlcnMuY3JlYXRlSW5kZXhBc3luYyhcInNlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vucy53aGVuXCIsIHsgc3BhcnNlOiB0cnVlIH0pO1xuICAvLyBGb3IgZXhwaXJpbmcgcGFzc3dvcmQgdG9rZW5zXG4gIGF3YWl0IHVzZXJzLmNyZWF0ZUluZGV4QXN5bmMoJ3NlcnZpY2VzLnBhc3N3b3JkLnJlc2V0LndoZW4nLCB7IHNwYXJzZTogdHJ1ZSB9KTtcbiAgYXdhaXQgdXNlcnMuY3JlYXRlSW5kZXhBc3luYygnc2VydmljZXMucGFzc3dvcmQuZW5yb2xsLndoZW4nLCB7IHNwYXJzZTogdHJ1ZSB9KTtcbn07XG5cblxuLy8gR2VuZXJhdGVzIHBlcm11dGF0aW9ucyBvZiBhbGwgY2FzZSB2YXJpYXRpb25zIG9mIGEgZ2l2ZW4gc3RyaW5nLlxuY29uc3QgZ2VuZXJhdGVDYXNlUGVybXV0YXRpb25zRm9yU3RyaW5nID0gc3RyaW5nID0+IHtcbiAgbGV0IHBlcm11dGF0aW9ucyA9IFsnJ107XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyaW5nLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY2ggPSBzdHJpbmcuY2hhckF0KGkpO1xuICAgIHBlcm11dGF0aW9ucyA9IFtdLmNvbmNhdCguLi4ocGVybXV0YXRpb25zLm1hcChwcmVmaXggPT4ge1xuICAgICAgY29uc3QgbG93ZXJDYXNlQ2hhciA9IGNoLnRvTG93ZXJDYXNlKCk7XG4gICAgICBjb25zdCB1cHBlckNhc2VDaGFyID0gY2gudG9VcHBlckNhc2UoKTtcbiAgICAgIC8vIERvbid0IGFkZCB1bm5lY2Vzc2FyeSBwZXJtdXRhdGlvbnMgd2hlbiBjaCBpcyBub3QgYSBsZXR0ZXJcbiAgICAgIGlmIChsb3dlckNhc2VDaGFyID09PSB1cHBlckNhc2VDaGFyKSB7XG4gICAgICAgIHJldHVybiBbcHJlZml4ICsgY2hdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFtwcmVmaXggKyBsb3dlckNhc2VDaGFyLCBwcmVmaXggKyB1cHBlckNhc2VDaGFyXTtcbiAgICAgIH1cbiAgICB9KSkpO1xuICB9XG4gIHJldHVybiBwZXJtdXRhdGlvbnM7XG59XG5cbiJdfQ==
