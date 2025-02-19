Package["core-runtime"].queue("accounts-password",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var Accounts = Package['accounts-base'].Accounts;
var SHA256 = Package.sha.SHA256;
var EJSON = Package.ejson.EJSON;
var DDP = Package['ddp-client'].DDP;
var DDPServer = Package['ddp-server'].DDPServer;
var Email = Package.email.Email;
var EmailInternals = Package.email.EmailInternals;
var Random = Package.random.Random;
var check = Package.check.check;
var Match = Package.check.Match;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

var require = meteorInstall({"node_modules":{"meteor":{"accounts-password":{"email_templates.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/accounts-password/email_templates.js                                                               //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
    const greet = welcomeMsg => (user, url) => {
      const greeting = user.profile && user.profile.name ? "Hello ".concat(user.profile.name, ",") : 'Hello,';
      return "".concat(greeting, "\n\n").concat(welcomeMsg, ", simply click the link below.\n\n").concat(url, "\n\nThank you.\n");
    };

    /**
     * @summary Options to customize emails sent from the Accounts system.
     * @locus Server
     * @importFromPackage accounts-base
     */
    Accounts.emailTemplates = _objectSpread(_objectSpread({}, Accounts.emailTemplates || {}), {}, {
      from: 'Accounts Example <no-reply@example.com>',
      siteName: Meteor.absoluteUrl().replace(/^https?:\/\//, '').replace(/\/$/, ''),
      resetPassword: {
        subject: () => "How to reset your password on ".concat(Accounts.emailTemplates.siteName),
        text: greet('To reset your password')
      },
      verifyEmail: {
        subject: () => "How to verify email address on ".concat(Accounts.emailTemplates.siteName),
        text: greet('To verify your account email')
      },
      enrollAccount: {
        subject: () => "An account has been created for you on ".concat(Accounts.emailTemplates.siteName),
        text: greet('To start using the service')
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"password_server.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/accounts-password/password_server.js                                                               //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
    let bcryptHash, bcryptCompare;
    module.link("bcrypt", {
      hash(v) {
        bcryptHash = v;
      },
      compare(v) {
        bcryptCompare = v;
      }
    }, 0);
    let Accounts;
    module.link("meteor/accounts-base", {
      Accounts(v) {
        Accounts = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    // Utility for grabbing user
    const getUserById = async (id, options) => await Meteor.users.findOneAsync(id, Accounts._addDefaultFieldSelector(options));

    // User records have a 'services.password.bcrypt' field on them to hold
    // their hashed passwords.
    //
    // When the client sends a password to the server, it can either be a
    // string (the plaintext password) or an object with keys 'digest' and
    // 'algorithm' (must be "sha-256" for now). The Meteor client always sends
    // password objects { digest: *, algorithm: "sha-256" }, but DDP clients
    // that don't have access to SHA can just send plaintext passwords as
    // strings.
    //
    // When the server receives a plaintext password as a string, it always
    // hashes it with SHA256 before passing it into bcrypt. When the server
    // receives a password as an object, it asserts that the algorithm is
    // "sha-256" and then passes the digest to bcrypt.

    Accounts._bcryptRounds = () => Accounts._options.bcryptRounds || 10;

    // Given a 'password' from the client, extract the string that we should
    // bcrypt. 'password' can be one of:
    //  - String (the plaintext password)
    //  - Object with 'digest' and 'algorithm' keys. 'algorithm' must be "sha-256".
    //
    const getPasswordString = password => {
      if (typeof password === "string") {
        password = SHA256(password);
      } else {
        // 'password' is an object
        if (password.algorithm !== "sha-256") {
          throw new Error("Invalid password hash algorithm. " + "Only 'sha-256' is allowed.");
        }
        password = password.digest;
      }
      return password;
    };

    // Use bcrypt to hash the password for storage in the database.
    // `password` can be a string (in which case it will be run through
    // SHA256 before bcrypt) or an object with properties `digest` and
    // `algorithm` (in which case we bcrypt `password.digest`).
    //
    const hashPassword = async password => {
      password = getPasswordString(password);
      return await bcryptHash(password, Accounts._bcryptRounds());
    };

    // Extract the number of rounds used in the specified bcrypt hash.
    const getRoundsFromBcryptHash = hash => {
      let rounds;
      if (hash) {
        const hashSegments = hash.split('$');
        if (hashSegments.length > 2) {
          rounds = parseInt(hashSegments[2], 10);
        }
      }
      return rounds;
    };

    // Check whether the provided password matches the bcrypt'ed password in
    // the database user record. `password` can be a string (in which case
    // it will be run through SHA256 before bcrypt) or an object with
    // properties `digest` and `algorithm` (in which case we bcrypt
    // `password.digest`).
    //
    // The user parameter needs at least user._id and user.services
    Accounts._checkPasswordUserFields = {
      _id: 1,
      services: 1
    };
    //
    const checkPasswordAsync = async (user, password) => {
      const result = {
        userId: user._id
      };
      const formattedPassword = getPasswordString(password);
      const hash = user.services.password.bcrypt;
      const hashRounds = getRoundsFromBcryptHash(hash);
      if (!(await bcryptCompare(formattedPassword, hash))) {
        result.error = Accounts._handleError("Incorrect password", false);
      } else if (hash && Accounts._bcryptRounds() != hashRounds) {
        // The password checks out, but the user's bcrypt hash needs to be updated.

        Meteor.defer(async () => {
          await Meteor.users.updateAsync({
            _id: user._id
          }, {
            $set: {
              'services.password.bcrypt': await bcryptHash(formattedPassword, Accounts._bcryptRounds())
            }
          });
        });
      }
      return result;
    };
    Accounts._checkPasswordAsync = checkPasswordAsync;

    ///
    /// LOGIN
    ///

    /**
     * @summary Finds the user asynchronously with the specified username.
     * First tries to match username case sensitively; if that fails, it
     * tries case insensitively; but if more than one user matches the case
     * insensitive search, it returns null.
     * @locus Server
     * @param {String} username The username to look for
     * @param {Object} [options]
     * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
     * @returns {Promise<Object>} A user if found, else null
     * @importFromPackage accounts-base
     */
    Accounts.findUserByUsername = async (username, options) => await Accounts._findUserByQuery({
      username
    }, options);

    /**
     * @summary Finds the user asynchronously with the specified email.
     * First tries to match email case sensitively; if that fails, it
     * tries case insensitively; but if more than one user matches the case
     * insensitive search, it returns null.
     * @locus Server
     * @param {String} email The email address to look for
     * @param {Object} [options]
     * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
     * @returns {Promise<Object>} A user if found, else null
     * @importFromPackage accounts-base
     */
    Accounts.findUserByEmail = async (email, options) => await Accounts._findUserByQuery({
      email
    }, options);

    // XXX maybe this belongs in the check package
    const NonEmptyString = Match.Where(x => {
      check(x, String);
      return x.length > 0;
    });
    const passwordValidator = Match.OneOf(Match.Where(str => {
      var _Meteor$settings, _Meteor$settings$pack, _Meteor$settings$pack2;
      return Match.test(str, String) && str.length <= ((_Meteor$settings = Meteor.settings) === null || _Meteor$settings === void 0 ? void 0 : (_Meteor$settings$pack = _Meteor$settings.packages) === null || _Meteor$settings$pack === void 0 ? void 0 : (_Meteor$settings$pack2 = _Meteor$settings$pack.accounts) === null || _Meteor$settings$pack2 === void 0 ? void 0 : _Meteor$settings$pack2.passwordMaxLength) || 256;
    }), {
      digest: Match.Where(str => Match.test(str, String) && str.length === 64),
      algorithm: Match.OneOf('sha-256')
    });

    // Handler to login with a password.
    //
    // The Meteor client sets options.password to an object with keys
    // 'digest' (set to SHA256(password)) and 'algorithm' ("sha-256").
    //
    // For other DDP clients which don't have access to SHA, the handler
    // also accepts the plaintext password in options.password as a string.
    //
    // (It might be nice if servers could turn the plaintext password
    // option off. Or maybe it should be opt-in, not opt-out?
    // Accounts.config option?)
    //
    // Note that neither password option is secure without SSL.
    //
    Accounts.registerLoginHandler("password", async options => {
      var _Accounts$_check2faEn, _Accounts;
      if (!options.password) return undefined; // don't handle

      check(options, {
        user: Accounts._userQueryValidator,
        password: passwordValidator,
        code: Match.Optional(NonEmptyString)
      });
      const user = await Accounts._findUserByQuery(options.user, {
        fields: _objectSpread({
          services: 1
        }, Accounts._checkPasswordUserFields)
      });
      if (!user) {
        Accounts._handleError("User not found");
      }
      if (!user.services || !user.services.password || !user.services.password.bcrypt) {
        Accounts._handleError("User has no password set");
      }
      const result = await checkPasswordAsync(user, options.password);
      // This method is added by the package accounts-2fa
      // First the login is validated, then the code situation is checked
      if (!result.error && (_Accounts$_check2faEn = (_Accounts = Accounts)._check2faEnabled) !== null && _Accounts$_check2faEn !== void 0 && _Accounts$_check2faEn.call(_Accounts, user)) {
        if (!options.code) {
          Accounts._handleError('2FA code must be informed', true, 'no-2fa-code');
        }
        if (!Accounts._isTokenValid(user.services.twoFactorAuthentication.secret, options.code)) {
          Accounts._handleError('Invalid 2FA code', true, 'invalid-2fa-code');
        }
      }
      return result;
    });

    ///
    /// CHANGING
    ///

    /**
     * @summary Change a user's username asynchronously. Use this instead of updating the
     * database directly. The operation will fail if there is an existing user
     * with a username only differing in case.
     * @locus Server
     * @param {String} userId The ID of the user to update.
     * @param {String} newUsername A new username for the user.
     * @importFromPackage accounts-base
     */
    Accounts.setUsername = async (userId, newUsername) => {
      check(userId, NonEmptyString);
      check(newUsername, NonEmptyString);
      const user = await getUserById(userId, {
        fields: {
          username: 1
        }
      });
      if (!user) {
        Accounts._handleError("User not found");
      }
      const oldUsername = user.username;

      // Perform a case insensitive check for duplicates before update
      await Accounts._checkForCaseInsensitiveDuplicates('username', 'Username', newUsername, user._id);
      await Meteor.users.updateAsync({
        _id: user._id
      }, {
        $set: {
          username: newUsername
        }
      });

      // Perform another check after update, in case a matching user has been
      // inserted in the meantime
      try {
        await Accounts._checkForCaseInsensitiveDuplicates('username', 'Username', newUsername, user._id);
      } catch (ex) {
        // Undo update if the check fails
        await Meteor.users.updateAsync({
          _id: user._id
        }, {
          $set: {
            username: oldUsername
          }
        });
        throw ex;
      }
    };

    // Let the user change their own password if they know the old
    // password. `oldPassword` and `newPassword` should be objects with keys
    // `digest` and `algorithm` (representing the SHA256 of the password).
    Meteor.methods({
      changePassword: async function (oldPassword, newPassword) {
        check(oldPassword, passwordValidator);
        check(newPassword, passwordValidator);
        if (!this.userId) {
          throw new Meteor.Error(401, "Must be logged in");
        }
        const user = await getUserById(this.userId, {
          fields: _objectSpread({
            services: 1
          }, Accounts._checkPasswordUserFields)
        });
        if (!user) {
          Accounts._handleError("User not found");
        }
        if (!user.services || !user.services.password || !user.services.password.bcrypt) {
          Accounts._handleError("User has no password set");
        }
        const result = await checkPasswordAsync(user, oldPassword);
        if (result.error) {
          throw result.error;
        }
        const hashed = await hashPassword(newPassword);

        // It would be better if this removed ALL existing tokens and replaced
        // the token for the current connection with a new one, but that would
        // be tricky, so we'll settle for just replacing all tokens other than
        // the one for the current connection.
        const currentToken = Accounts._getLoginToken(this.connection.id);
        await Meteor.users.updateAsync({
          _id: this.userId
        }, {
          $set: {
            'services.password.bcrypt': hashed
          },
          $pull: {
            'services.resume.loginTokens': {
              hashedToken: {
                $ne: currentToken
              }
            }
          },
          $unset: {
            'services.password.reset': 1
          }
        });
        return {
          passwordChanged: true
        };
      }
    });

    // Force change the users password.

    /**
     * @summary Forcibly change the password for a user.
     * @locus Server
     * @param {String} userId The id of the user to update.
     * @param {String} newPassword A new password for the user.
     * @param {Object} [options]
     * @param {Object} options.logout Logout all current connections with this userId (default: true)
     * @importFromPackage accounts-base
     */
    Accounts.setPasswordAsync = async (userId, newPlaintextPassword, options) => {
      check(userId, String);
      check(newPlaintextPassword, Match.Where(str => {
        var _Meteor$settings2, _Meteor$settings2$pac, _Meteor$settings2$pac2;
        return Match.test(str, String) && str.length <= ((_Meteor$settings2 = Meteor.settings) === null || _Meteor$settings2 === void 0 ? void 0 : (_Meteor$settings2$pac = _Meteor$settings2.packages) === null || _Meteor$settings2$pac === void 0 ? void 0 : (_Meteor$settings2$pac2 = _Meteor$settings2$pac.accounts) === null || _Meteor$settings2$pac2 === void 0 ? void 0 : _Meteor$settings2$pac2.passwordMaxLength) || 256;
      }));
      check(options, Match.Maybe({
        logout: Boolean
      }));
      options = _objectSpread({
        logout: true
      }, options);
      const user = await getUserById(userId, {
        fields: {
          _id: 1
        }
      });
      if (!user) {
        throw new Meteor.Error(403, "User not found");
      }
      const update = {
        $unset: {
          'services.password.reset': 1
        },
        $set: {
          'services.password.bcrypt': await hashPassword(newPlaintextPassword)
        }
      };
      if (options.logout) {
        update.$unset['services.resume.loginTokens'] = 1;
      }
      await Meteor.users.updateAsync({
        _id: user._id
      }, update);
    };

    ///
    /// RESETTING VIA EMAIL
    ///

    // Utility for plucking addresses from emails
    const pluckAddresses = function () {
      let emails = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
      return emails.map(email => email.address);
    };

    // Method called by a user to request a password reset email. This is
    // the start of the reset process.
    Meteor.methods({
      forgotPassword: async options => {
        check(options, {
          email: String
        });
        const user = await Accounts.findUserByEmail(options.email, {
          fields: {
            emails: 1
          }
        });
        if (!user) {
          Accounts._handleError("User not found");
        }
        const emails = pluckAddresses(user.emails);
        const caseSensitiveEmail = emails.find(email => email.toLowerCase() === options.email.toLowerCase());
        await Accounts.sendResetPasswordEmail(user._id, caseSensitiveEmail);
      }
    });

    /**
     * @summary Asynchronously generates a reset token and saves it into the database.
     * @locus Server
     * @param {String} userId The id of the user to generate the reset token for.
     * @param {String} email Which address of the user to generate the reset token for. This address must be in the user's `emails` list. If `null`, defaults to the first email in the list.
     * @param {String} reason `resetPassword` or `enrollAccount`.
     * @param {Object} [extraTokenData] Optional additional data to be added into the token record.
     * @returns {Promise<Object>} Promise of an object with {email, user, token} values.
     * @importFromPackage accounts-base
     */
    Accounts.generateResetToken = async (userId, email, reason, extraTokenData) => {
      // Make sure the user exists, and email is one of their addresses.
      // Don't limit the fields in the user object since the user is returned
      // by the function and some other fields might be used elsewhere.
      const user = await getUserById(userId);
      if (!user) {
        Accounts._handleError("Can't find user");
      }

      // pick the first email if we weren't passed an email.
      if (!email && user.emails && user.emails[0]) {
        email = user.emails[0].address;
      }

      // make sure we have a valid email
      if (!email || !pluckAddresses(user.emails).includes(email)) {
        Accounts._handleError("No such email for user.");
      }
      const token = Random.secret();
      const tokenRecord = {
        token,
        email,
        when: new Date()
      };
      if (reason === 'resetPassword') {
        tokenRecord.reason = 'reset';
      } else if (reason === 'enrollAccount') {
        tokenRecord.reason = 'enroll';
      } else if (reason) {
        // fallback so that this function can be used for unknown reasons as well
        tokenRecord.reason = reason;
      }
      if (extraTokenData) {
        Object.assign(tokenRecord, extraTokenData);
      }
      // if this method is called from the enroll account work-flow then
      // store the token record in 'services.password.enroll' db field
      // else store the token record in in 'services.password.reset' db field
      if (reason === 'enrollAccount') {
        await Meteor.users.updateAsync({
          _id: user._id
        }, {
          $set: {
            'services.password.enroll': tokenRecord
          }
        });
        // before passing to template, update user object with new token
        Meteor._ensure(user, 'services', 'password').enroll = tokenRecord;
      } else {
        await Meteor.users.updateAsync({
          _id: user._id
        }, {
          $set: {
            'services.password.reset': tokenRecord
          }
        });
        // before passing to template, update user object with new token
        Meteor._ensure(user, 'services', 'password').reset = tokenRecord;
      }
      return {
        email,
        user,
        token
      };
    };

    /**
     * @summary Generates asynchronously an e-mail verification token and saves it into the database.
     * @locus Server
     * @param {String} userId The id of the user to generate the  e-mail verification token for.
     * @param {String} email Which address of the user to generate the e-mail verification token for. This address must be in the user's `emails` list. If `null`, defaults to the first unverified email in the list.
     * @param {Object} [extraTokenData] Optional additional data to be added into the token record.
     * @returns {Promise<Object>} Promise of an object with {email, user, token} values.
     * @importFromPackage accounts-base
     */
    Accounts.generateVerificationToken = async (userId, email, extraTokenData) => {
      // Make sure the user exists, and email is one of their addresses.
      // Don't limit the fields in the user object since the user is returned
      // by the function and some other fields might be used elsewhere.
      const user = await getUserById(userId);
      if (!user) {
        Accounts._handleError("Can't find user");
      }

      // pick the first unverified email if we weren't passed an email.
      if (!email) {
        const emailRecord = (user.emails || []).find(e => !e.verified);
        email = (emailRecord || {}).address;
        if (!email) {
          Accounts._handleError("That user has no unverified email addresses.");
        }
      }

      // make sure we have a valid email
      if (!email || !pluckAddresses(user.emails).includes(email)) {
        Accounts._handleError("No such email for user.");
      }
      const token = Random.secret();
      const tokenRecord = {
        token,
        // TODO: This should probably be renamed to "email" to match reset token record.
        address: email,
        when: new Date()
      };
      if (extraTokenData) {
        Object.assign(tokenRecord, extraTokenData);
      }
      await Meteor.users.updateAsync({
        _id: user._id
      }, {
        $push: {
          'services.email.verificationTokens': tokenRecord
        }
      });

      // before passing to template, update user object with new token
      Meteor._ensure(user, 'services', 'email');
      if (!user.services.email.verificationTokens) {
        user.services.email.verificationTokens = [];
      }
      user.services.email.verificationTokens.push(tokenRecord);
      return {
        email,
        user,
        token
      };
    };

    // send the user an email with a link that when opened allows the user
    // to set a new password, without the old password.

    /**
     * @summary Send an email asynchronously with a link the user can use to reset their password.
     * @locus Server
     * @param {String} userId The id of the user to send email to.
     * @param {String} [email] Optional. Which address of the user's to send the email to. This address must be in the user's `emails` list. Defaults to the first email in the list.
     * @param {Object} [extraTokenData] Optional additional data to be added into the token record.
     * @param {Object} [extraParams] Optional additional params to be added to the reset url.
     * @returns {Promise<Object>} Promise of an object with {email, user, token, url, options} values.
     * @importFromPackage accounts-base
     */
    Accounts.sendResetPasswordEmail = async (userId, email, extraTokenData, extraParams) => {
      const {
        email: realEmail,
        user,
        token
      } = await Accounts.generateResetToken(userId, email, 'resetPassword', extraTokenData);
      const url = Accounts.urls.resetPassword(token, extraParams);
      const options = await Accounts.generateOptionsForEmail(realEmail, user, url, 'resetPassword');
      await Email.sendAsync(options);
      if (Meteor.isDevelopment) {
        console.log("\nReset password URL: ".concat(url));
      }
      return {
        email: realEmail,
        user,
        token,
        url,
        options
      };
    };

    // send the user an email informing them that their account was created, with
    // a link that when opened both marks their email as verified and forces them
    // to choose their password. The email must be one of the addresses in the
    // user's emails field, or undefined to pick the first email automatically.
    //
    // This is not called automatically. It must be called manually if you
    // want to use enrollment emails.

    /**
     * @summary Send an email asynchronously with a link the user can use to set their initial password.
     * @locus Server
     * @param {String} userId The id of the user to send email to.
     * @param {String} [email] Optional. Which address of the user's to send the email to. This address must be in the user's `emails` list. Defaults to the first email in the list.
     * @param {Object} [extraTokenData] Optional additional data to be added into the token record.
     * @param {Object} [extraParams] Optional additional params to be added to the enrollment url.
     * @returns {Promise<Object>} Promise of an object {email, user, token, url, options} values.
     * @importFromPackage accounts-base
     */
    Accounts.sendEnrollmentEmail = async (userId, email, extraTokenData, extraParams) => {
      const {
        email: realEmail,
        user,
        token
      } = await Accounts.generateResetToken(userId, email, 'enrollAccount', extraTokenData);
      const url = Accounts.urls.enrollAccount(token, extraParams);
      const options = await Accounts.generateOptionsForEmail(realEmail, user, url, 'enrollAccount');
      await Email.sendAsync(options);
      if (Meteor.isDevelopment) {
        console.log("\nEnrollment email URL: ".concat(url));
      }
      return {
        email: realEmail,
        user,
        token,
        url,
        options
      };
    };

    // Take token from sendResetPasswordEmail or sendEnrollmentEmail, change
    // the users password, and log them in.
    Meteor.methods({
      resetPassword: async function () {
        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }
        const token = args[0];
        const newPassword = args[1];
        return await Accounts._loginMethod(this, "resetPassword", args, "password", async () => {
          var _Accounts$_check2faEn2, _Accounts2;
          check(token, String);
          check(newPassword, passwordValidator);
          let user = await Meteor.users.findOneAsync({
            "services.password.reset.token": token
          }, {
            fields: {
              services: 1,
              emails: 1
            }
          });
          let isEnroll = false;
          // if token is in services.password.reset db field implies
          // this method is was not called from enroll account workflow
          // else this method is called from enroll account workflow
          if (!user) {
            user = await Meteor.users.findOneAsync({
              "services.password.enroll.token": token
            }, {
              fields: {
                services: 1,
                emails: 1
              }
            });
            isEnroll = true;
          }
          if (!user) {
            throw new Meteor.Error(403, "Token expired");
          }
          let tokenRecord = {};
          if (isEnroll) {
            tokenRecord = user.services.password.enroll;
          } else {
            tokenRecord = user.services.password.reset;
          }
          const {
            when,
            email
          } = tokenRecord;
          let tokenLifetimeMs = Accounts._getPasswordResetTokenLifetimeMs();
          if (isEnroll) {
            tokenLifetimeMs = Accounts._getPasswordEnrollTokenLifetimeMs();
          }
          const currentTimeMs = Date.now();
          if (currentTimeMs - when > tokenLifetimeMs) throw new Meteor.Error(403, "Token expired");
          if (!pluckAddresses(user.emails).includes(email)) return {
            userId: user._id,
            error: new Meteor.Error(403, "Token has invalid email address")
          };
          const hashed = await hashPassword(newPassword);

          // NOTE: We're about to invalidate tokens on the user, who we might be
          // logged in as. Make sure to avoid logging ourselves out if this
          // happens. But also make sure not to leave the connection in a state
          // of having a bad token set if things fail.
          const oldToken = Accounts._getLoginToken(this.connection.id);
          Accounts._setLoginToken(user._id, this.connection, null);
          const resetToOldToken = () => Accounts._setLoginToken(user._id, this.connection, oldToken);
          try {
            // Update the user record by:
            // - Changing the password to the new one
            // - Forgetting about the reset token or enroll token that was just used
            // - Verifying their email, since they got the password reset via email.
            let affectedRecords = {};
            // if reason is enroll then check services.password.enroll.token field for affected records
            if (isEnroll) {
              affectedRecords = await Meteor.users.updateAsync({
                _id: user._id,
                'emails.address': email,
                'services.password.enroll.token': token
              }, {
                $set: {
                  'services.password.bcrypt': hashed,
                  'emails.$.verified': true
                },
                $unset: {
                  'services.password.enroll': 1
                }
              });
            } else {
              affectedRecords = await Meteor.users.updateAsync({
                _id: user._id,
                'emails.address': email,
                'services.password.reset.token': token
              }, {
                $set: {
                  'services.password.bcrypt': hashed,
                  'emails.$.verified': true
                },
                $unset: {
                  'services.password.reset': 1
                }
              });
            }
            if (affectedRecords !== 1) return {
              userId: user._id,
              error: new Meteor.Error(403, "Invalid email")
            };
          } catch (err) {
            resetToOldToken();
            throw err;
          }

          // Replace all valid login tokens with new ones (changing
          // password should invalidate existing sessions).
          await Accounts._clearAllLoginTokens(user._id);
          if ((_Accounts$_check2faEn2 = (_Accounts2 = Accounts)._check2faEnabled) !== null && _Accounts$_check2faEn2 !== void 0 && _Accounts$_check2faEn2.call(_Accounts2, user)) {
            return {
              userId: user._id,
              error: Accounts._handleError('Changed password, but user not logged in because 2FA is enabled', false, '2fa-enabled')
            };
          }
          return {
            userId: user._id
          };
        });
      }
    });

    ///
    /// EMAIL VERIFICATION
    ///

    // send the user an email with a link that when opened marks that
    // address as verified

    /**
     * @summary Send an email asynchronously with a link the user can use verify their email address.
     * @locus Server
     * @param {String} userId The id of the user to send email to.
     * @param {String} [email] Optional. Which address of the user's to send the email to. This address must be in the user's `emails` list. Defaults to the first unverified email in the list.
     * @param {Object} [extraTokenData] Optional additional data to be added into the token record.
     * @param {Object} [extraParams] Optional additional params to be added to the verification url.
     * @returns {Promise<Object>} Promise of an object with {email, user, token, url, options} values.
     * @importFromPackage accounts-base
     */
    Accounts.sendVerificationEmail = async (userId, email, extraTokenData, extraParams) => {
      // XXX Also generate a link using which someone can delete this
      // account if they own said address but weren't those who created
      // this account.

      const {
        email: realEmail,
        user,
        token
      } = await Accounts.generateVerificationToken(userId, email, extraTokenData);
      const url = Accounts.urls.verifyEmail(token, extraParams);
      const options = await Accounts.generateOptionsForEmail(realEmail, user, url, 'verifyEmail');
      await Email.sendAsync(options);
      if (Meteor.isDevelopment) {
        console.log("\nVerification email URL: ".concat(url));
      }
      return {
        email: realEmail,
        user,
        token,
        url,
        options
      };
    };

    // Take token from sendVerificationEmail, mark the email as verified,
    // and log them in.
    Meteor.methods({
      verifyEmail: async function () {
        for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
          args[_key2] = arguments[_key2];
        }
        const token = args[0];
        return await Accounts._loginMethod(this, "verifyEmail", args, "password", async () => {
          var _Accounts$_check2faEn3, _Accounts3;
          check(token, String);
          const user = await Meteor.users.findOneAsync({
            'services.email.verificationTokens.token': token
          }, {
            fields: {
              services: 1,
              emails: 1
            }
          });
          if (!user) throw new Meteor.Error(403, "Verify email link expired");
          const tokenRecord = await user.services.email.verificationTokens.find(t => t.token == token);
          if (!tokenRecord) return {
            userId: user._id,
            error: new Meteor.Error(403, "Verify email link expired")
          };
          const emailsRecord = user.emails.find(e => e.address == tokenRecord.address);
          if (!emailsRecord) return {
            userId: user._id,
            error: new Meteor.Error(403, "Verify email link is for unknown address")
          };

          // By including the address in the query, we can use 'emails.$' in the
          // modifier to get a reference to the specific object in the emails
          // array. See
          // http://www.mongodb.org/display/DOCS/Updating/#Updating-The%24positionaloperator)
          // http://www.mongodb.org/display/DOCS/Updating#Updating-%24pull
          await Meteor.users.updateAsync({
            _id: user._id,
            'emails.address': tokenRecord.address
          }, {
            $set: {
              'emails.$.verified': true
            },
            $pull: {
              'services.email.verificationTokens': {
                address: tokenRecord.address
              }
            }
          });
          if ((_Accounts$_check2faEn3 = (_Accounts3 = Accounts)._check2faEnabled) !== null && _Accounts$_check2faEn3 !== void 0 && _Accounts$_check2faEn3.call(_Accounts3, user)) {
            return {
              userId: user._id,
              error: Accounts._handleError('Email verified, but user not logged in because 2FA is enabled', false, '2fa-enabled')
            };
          }
          return {
            userId: user._id
          };
        });
      }
    });

    /**
     * @summary Asynchronously add an email address for a user. Use this instead of directly
     * updating the database. The operation will fail if there is a different user
     * with an email only differing in case. If the specified user has an existing
     * email only differing in case however, we replace it.
     * @locus Server
     * @param {String} userId The ID of the user to update.
     * @param {String} newEmail A new email address for the user.
     * @param {Boolean} [verified] Optional - whether the new email address should
     * be marked as verified. Defaults to false.
     * @importFromPackage accounts-base
     */
    Accounts.addEmailAsync = async (userId, newEmail, verified) => {
      check(userId, NonEmptyString);
      check(newEmail, NonEmptyString);
      check(verified, Match.Optional(Boolean));
      if (verified === void 0) {
        verified = false;
      }
      const user = await getUserById(userId, {
        fields: {
          emails: 1
        }
      });
      if (!user) throw new Meteor.Error(403, "User not found");

      // Allow users to change their own email to a version with a different case

      // We don't have to call checkForCaseInsensitiveDuplicates to do a case
      // insensitive check across all emails in the database here because: (1) if
      // there is no case-insensitive duplicate between this user and other users,
      // then we are OK and (2) if this would create a conflict with other users
      // then there would already be a case-insensitive duplicate and we can't fix
      // that in this code anyway.
      const caseInsensitiveRegExp = new RegExp("^".concat(Meteor._escapeRegExp(newEmail), "$"), "i");

      // TODO: This is a linear search. If we have a lot of emails.
      //  we should consider using a different data structure.
      const updatedEmail = async function () {
        let emails = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
        let _id = arguments.length > 1 ? arguments[1] : undefined;
        let updated = false;
        for (const email of emails) {
          if (caseInsensitiveRegExp.test(email.address)) {
            await Meteor.users.updateAsync({
              _id: _id,
              "emails.address": email.address
            }, {
              $set: {
                "emails.$.address": newEmail,
                "emails.$.verified": verified
              }
            });
            updated = true;
          }
        }
        return updated;
      };
      const didUpdateOwnEmail = await updatedEmail(user.emails, user._id);

      // In the other updates below, we have to do another call to
      // checkForCaseInsensitiveDuplicates to make sure that no conflicting values
      // were added to the database in the meantime. We don't have to do this for
      // the case where the user is updating their email address to one that is the
      // same as before, but only different because of capitalization. Read the
      // big comment above to understand why.

      if (didUpdateOwnEmail) {
        return;
      }

      // Perform a case insensitive check for duplicates before update
      await Accounts._checkForCaseInsensitiveDuplicates("emails.address", "Email", newEmail, user._id);
      await Meteor.users.updateAsync({
        _id: user._id
      }, {
        $addToSet: {
          emails: {
            address: newEmail,
            verified: verified
          }
        }
      });

      // Perform another check after update, in case a matching user has been
      // inserted in the meantime
      try {
        await Accounts._checkForCaseInsensitiveDuplicates("emails.address", "Email", newEmail, user._id);
      } catch (ex) {
        // Undo update if the check fails
        await Meteor.users.updateAsync({
          _id: user._id
        }, {
          $pull: {
            emails: {
              address: newEmail
            }
          }
        });
        throw ex;
      }
    };

    /**
     * @summary Remove an email address asynchronously for a user. Use this instead of updating
     * the database directly.
     * @locus Server
     * @param {String} userId The ID of the user to update.
     * @param {String} email The email address to remove.
     * @importFromPackage accounts-base
     */
    Accounts.removeEmail = async (userId, email) => {
      check(userId, NonEmptyString);
      check(email, NonEmptyString);
      const user = await getUserById(userId, {
        fields: {
          _id: 1
        }
      });
      if (!user) throw new Meteor.Error(403, "User not found");
      await Meteor.users.updateAsync({
        _id: user._id
      }, {
        $pull: {
          emails: {
            address: email
          }
        }
      });
    };

    ///
    /// CREATING USERS
    ///

    // Shared createUser function called from the createUser method, both
    // if originates in client or server code. Calls user provided hooks,
    // does the actual user insertion.
    //
    // returns the user id
    const createUser = async options => {
      // Unknown keys allowed, because a onCreateUserHook can take arbitrary
      // options.
      check(options, Match.ObjectIncluding({
        username: Match.Optional(String),
        email: Match.Optional(String),
        password: Match.Optional(passwordValidator)
      }));
      const {
        username,
        email,
        password
      } = options;
      if (!username && !email) throw new Meteor.Error(400, "Need to set a username or email");
      const user = {
        services: {}
      };
      if (password) {
        const hashed = await hashPassword(password);
        user.services.password = {
          bcrypt: hashed
        };
      }
      return await Accounts._createUserCheckingDuplicates({
        user,
        email,
        username,
        options
      });
    };

    // method for create user. Requests come from the client.
    Meteor.methods({
      createUser: async function () {
        for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
          args[_key3] = arguments[_key3];
        }
        const options = args[0];
        return await Accounts._loginMethod(this, "createUser", args, "password", async () => {
          // createUser() above does more checking.
          check(options, Object);
          if (Accounts._options.forbidClientAccountCreation) return {
            error: new Meteor.Error(403, "Signups forbidden")
          };
          const userId = await Accounts.createUserVerifyingEmail(options);

          // client gets logged in as the new user afterwards.
          return {
            userId: userId
          };
        });
      }
    });

    /**
     * @summary Creates an user asynchronously and sends an email if `options.email` is informed.
     * Then if the `sendVerificationEmail` option from the `Accounts` package is
     * enabled, you'll send a verification email if `options.password` is informed,
     * otherwise you'll send an enrollment email.
     * @locus Server
     * @param {Object} options The options object to be passed down when creating
     * the user
     * @param {String} options.username A unique name for this user.
     * @param {String} options.email The user's email address.
     * @param {String} options.password The user's password. This is __not__ sent in plain text over the wire.
     * @param {Object} options.profile The user's profile, typically including the `name` field.
     * @importFromPackage accounts-base
     * */
    Accounts.createUserVerifyingEmail = async options => {
      options = _objectSpread({}, options);
      // Create user. result contains id and token.
      const userId = await createUser(options);
      // safety belt. createUser is supposed to throw on error. send 500 error
      // instead of sending a verification email with empty userid.
      if (!userId) throw new Error("createUser failed to insert new user");

      // If `Accounts._options.sendVerificationEmail` is set, register
      // a token to verify the user's primary email, and send it to
      // that address.
      if (options.email && Accounts._options.sendVerificationEmail) {
        if (options.password) {
          await Accounts.sendVerificationEmail(userId, options.email);
        } else {
          await Accounts.sendEnrollmentEmail(userId, options.email);
        }
      }
      return userId;
    };

    // Create user directly on the server.
    //
    // Unlike the client version, this does not log you in as this user
    // after creation.
    //
    // returns Promise<userId> or throws an error if it can't create
    //
    // XXX add another argument ("server options") that gets sent to onCreateUser,
    // which is always empty when called from the createUser method? eg, "admin:
    // true", which we want to prevent the client from setting, but which a custom
    // method calling Accounts.createUser could set?
    //

    Accounts.createUserAsync = createUser;

    // Create user directly on the server.
    //
    // Unlike the client version, this does not log you in as this user
    // after creation.
    //
    // returns userId or throws an error if it can't create
    //
    // XXX add another argument ("server options") that gets sent to onCreateUser,
    // which is always empty when called from the createUser method? eg, "admin:
    // true", which we want to prevent the client from setting, but which a custom
    // method calling Accounts.createUser could set?
    //

    Accounts.createUser = Accounts.createUserAsync;

    ///
    /// PASSWORD-SPECIFIC INDEXES ON USERS
    ///
    await Meteor.users.createIndexAsync('services.email.verificationTokens.token', {
      unique: true,
      sparse: true
    });
    await Meteor.users.createIndexAsync('services.password.reset.token', {
      unique: true,
      sparse: true
    });
    await Meteor.users.createIndexAsync('services.password.enroll.token', {
      unique: true,
      sparse: true
    });
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: true
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"bcrypt":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// node_modules/meteor/accounts-password/node_modules/bcrypt/package.json                                      //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
module.exports = {
  "name": "bcrypt",
  "version": "5.0.1",
  "main": "./bcrypt"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"bcrypt.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// node_modules/meteor/accounts-password/node_modules/bcrypt/bcrypt.js                                         //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/accounts-password/email_templates.js",
    "/node_modules/meteor/accounts-password/password_server.js"
  ]
}});

//# sourceURL=meteor://💻app/packages/accounts-password.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYWNjb3VudHMtcGFzc3dvcmQvZW1haWxfdGVtcGxhdGVzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9hY2NvdW50cy1wYXNzd29yZC9wYXNzd29yZF9zZXJ2ZXIuanMiXSwibmFtZXMiOlsiX29iamVjdFNwcmVhZCIsIm1vZHVsZSIsImxpbmsiLCJkZWZhdWx0IiwidiIsIl9fcmVpZnlXYWl0Rm9yRGVwc19fIiwiZ3JlZXQiLCJ3ZWxjb21lTXNnIiwidXNlciIsInVybCIsImdyZWV0aW5nIiwicHJvZmlsZSIsIm5hbWUiLCJjb25jYXQiLCJBY2NvdW50cyIsImVtYWlsVGVtcGxhdGVzIiwiZnJvbSIsInNpdGVOYW1lIiwiTWV0ZW9yIiwiYWJzb2x1dGVVcmwiLCJyZXBsYWNlIiwicmVzZXRQYXNzd29yZCIsInN1YmplY3QiLCJ0ZXh0IiwidmVyaWZ5RW1haWwiLCJlbnJvbGxBY2NvdW50IiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwic2VsZiIsImFzeW5jIiwiYmNyeXB0SGFzaCIsImJjcnlwdENvbXBhcmUiLCJoYXNoIiwiY29tcGFyZSIsImdldFVzZXJCeUlkIiwiaWQiLCJvcHRpb25zIiwidXNlcnMiLCJmaW5kT25lQXN5bmMiLCJfYWRkRGVmYXVsdEZpZWxkU2VsZWN0b3IiLCJfYmNyeXB0Um91bmRzIiwiX29wdGlvbnMiLCJiY3J5cHRSb3VuZHMiLCJnZXRQYXNzd29yZFN0cmluZyIsInBhc3N3b3JkIiwiU0hBMjU2IiwiYWxnb3JpdGhtIiwiRXJyb3IiLCJkaWdlc3QiLCJoYXNoUGFzc3dvcmQiLCJnZXRSb3VuZHNGcm9tQmNyeXB0SGFzaCIsInJvdW5kcyIsImhhc2hTZWdtZW50cyIsInNwbGl0IiwibGVuZ3RoIiwicGFyc2VJbnQiLCJfY2hlY2tQYXNzd29yZFVzZXJGaWVsZHMiLCJfaWQiLCJzZXJ2aWNlcyIsImNoZWNrUGFzc3dvcmRBc3luYyIsInJlc3VsdCIsInVzZXJJZCIsImZvcm1hdHRlZFBhc3N3b3JkIiwiYmNyeXB0IiwiaGFzaFJvdW5kcyIsImVycm9yIiwiX2hhbmRsZUVycm9yIiwiZGVmZXIiLCJ1cGRhdGVBc3luYyIsIiRzZXQiLCJfY2hlY2tQYXNzd29yZEFzeW5jIiwiZmluZFVzZXJCeVVzZXJuYW1lIiwidXNlcm5hbWUiLCJfZmluZFVzZXJCeVF1ZXJ5IiwiZmluZFVzZXJCeUVtYWlsIiwiZW1haWwiLCJOb25FbXB0eVN0cmluZyIsIk1hdGNoIiwiV2hlcmUiLCJ4IiwiY2hlY2siLCJTdHJpbmciLCJwYXNzd29yZFZhbGlkYXRvciIsIk9uZU9mIiwic3RyIiwiX01ldGVvciRzZXR0aW5ncyIsIl9NZXRlb3Ikc2V0dGluZ3MkcGFjayIsIl9NZXRlb3Ikc2V0dGluZ3MkcGFjazIiLCJ0ZXN0Iiwic2V0dGluZ3MiLCJwYWNrYWdlcyIsImFjY291bnRzIiwicGFzc3dvcmRNYXhMZW5ndGgiLCJyZWdpc3RlckxvZ2luSGFuZGxlciIsIl9BY2NvdW50cyRfY2hlY2syZmFFbiIsIl9BY2NvdW50cyIsInVuZGVmaW5lZCIsIl91c2VyUXVlcnlWYWxpZGF0b3IiLCJjb2RlIiwiT3B0aW9uYWwiLCJmaWVsZHMiLCJfY2hlY2syZmFFbmFibGVkIiwiY2FsbCIsIl9pc1Rva2VuVmFsaWQiLCJ0d29GYWN0b3JBdXRoZW50aWNhdGlvbiIsInNlY3JldCIsInNldFVzZXJuYW1lIiwibmV3VXNlcm5hbWUiLCJvbGRVc2VybmFtZSIsIl9jaGVja0ZvckNhc2VJbnNlbnNpdGl2ZUR1cGxpY2F0ZXMiLCJleCIsIm1ldGhvZHMiLCJjaGFuZ2VQYXNzd29yZCIsIm9sZFBhc3N3b3JkIiwibmV3UGFzc3dvcmQiLCJoYXNoZWQiLCJjdXJyZW50VG9rZW4iLCJfZ2V0TG9naW5Ub2tlbiIsImNvbm5lY3Rpb24iLCIkcHVsbCIsImhhc2hlZFRva2VuIiwiJG5lIiwiJHVuc2V0IiwicGFzc3dvcmRDaGFuZ2VkIiwic2V0UGFzc3dvcmRBc3luYyIsIm5ld1BsYWludGV4dFBhc3N3b3JkIiwiX01ldGVvciRzZXR0aW5nczIiLCJfTWV0ZW9yJHNldHRpbmdzMiRwYWMiLCJfTWV0ZW9yJHNldHRpbmdzMiRwYWMyIiwiTWF5YmUiLCJsb2dvdXQiLCJCb29sZWFuIiwidXBkYXRlIiwicGx1Y2tBZGRyZXNzZXMiLCJlbWFpbHMiLCJhcmd1bWVudHMiLCJtYXAiLCJhZGRyZXNzIiwiZm9yZ290UGFzc3dvcmQiLCJjYXNlU2Vuc2l0aXZlRW1haWwiLCJmaW5kIiwidG9Mb3dlckNhc2UiLCJzZW5kUmVzZXRQYXNzd29yZEVtYWlsIiwiZ2VuZXJhdGVSZXNldFRva2VuIiwicmVhc29uIiwiZXh0cmFUb2tlbkRhdGEiLCJpbmNsdWRlcyIsInRva2VuIiwiUmFuZG9tIiwidG9rZW5SZWNvcmQiLCJ3aGVuIiwiRGF0ZSIsIk9iamVjdCIsImFzc2lnbiIsIl9lbnN1cmUiLCJlbnJvbGwiLCJyZXNldCIsImdlbmVyYXRlVmVyaWZpY2F0aW9uVG9rZW4iLCJlbWFpbFJlY29yZCIsImUiLCJ2ZXJpZmllZCIsIiRwdXNoIiwidmVyaWZpY2F0aW9uVG9rZW5zIiwicHVzaCIsImV4dHJhUGFyYW1zIiwicmVhbEVtYWlsIiwidXJscyIsImdlbmVyYXRlT3B0aW9uc0ZvckVtYWlsIiwiRW1haWwiLCJzZW5kQXN5bmMiLCJpc0RldmVsb3BtZW50IiwiY29uc29sZSIsImxvZyIsInNlbmRFbnJvbGxtZW50RW1haWwiLCJfbGVuIiwiYXJncyIsIkFycmF5IiwiX2tleSIsIl9sb2dpbk1ldGhvZCIsIl9BY2NvdW50cyRfY2hlY2syZmFFbjIiLCJfQWNjb3VudHMyIiwiaXNFbnJvbGwiLCJ0b2tlbkxpZmV0aW1lTXMiLCJfZ2V0UGFzc3dvcmRSZXNldFRva2VuTGlmZXRpbWVNcyIsIl9nZXRQYXNzd29yZEVucm9sbFRva2VuTGlmZXRpbWVNcyIsImN1cnJlbnRUaW1lTXMiLCJub3ciLCJvbGRUb2tlbiIsIl9zZXRMb2dpblRva2VuIiwicmVzZXRUb09sZFRva2VuIiwiYWZmZWN0ZWRSZWNvcmRzIiwiZXJyIiwiX2NsZWFyQWxsTG9naW5Ub2tlbnMiLCJzZW5kVmVyaWZpY2F0aW9uRW1haWwiLCJfbGVuMiIsIl9rZXkyIiwiX0FjY291bnRzJF9jaGVjazJmYUVuMyIsIl9BY2NvdW50czMiLCJ0IiwiZW1haWxzUmVjb3JkIiwiYWRkRW1haWxBc3luYyIsIm5ld0VtYWlsIiwiY2FzZUluc2Vuc2l0aXZlUmVnRXhwIiwiUmVnRXhwIiwiX2VzY2FwZVJlZ0V4cCIsInVwZGF0ZWRFbWFpbCIsInVwZGF0ZWQiLCJkaWRVcGRhdGVPd25FbWFpbCIsIiRhZGRUb1NldCIsInJlbW92ZUVtYWlsIiwiY3JlYXRlVXNlciIsIk9iamVjdEluY2x1ZGluZyIsIl9jcmVhdGVVc2VyQ2hlY2tpbmdEdXBsaWNhdGVzIiwiX2xlbjMiLCJfa2V5MyIsImZvcmJpZENsaWVudEFjY291bnRDcmVhdGlvbiIsImNyZWF0ZVVzZXJWZXJpZnlpbmdFbWFpbCIsImNyZWF0ZVVzZXJBc3luYyIsImNyZWF0ZUluZGV4QXN5bmMiLCJ1bmlxdWUiLCJzcGFyc2UiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUFBLElBQUlBLGFBQWE7SUFBQ0MsTUFBTSxDQUFDQyxJQUFJLENBQUMsc0NBQXNDLEVBQUM7TUFBQ0MsT0FBT0EsQ0FBQ0MsQ0FBQyxFQUFDO1FBQUNKLGFBQWEsR0FBQ0ksQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUFDLElBQUlDLG9CQUFvQixDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU1BLG9CQUFvQixDQUFDLENBQUMsRUFBRSxDQUFDO0lBQWxLLE1BQU1DLEtBQUssR0FBR0MsVUFBVSxJQUFJLENBQUNDLElBQUksRUFBRUMsR0FBRyxLQUFLO01BQ3pDLE1BQU1DLFFBQVEsR0FDWkYsSUFBSSxDQUFDRyxPQUFPLElBQUlILElBQUksQ0FBQ0csT0FBTyxDQUFDQyxJQUFJLFlBQUFDLE1BQUEsQ0FDcEJMLElBQUksQ0FBQ0csT0FBTyxDQUFDQyxJQUFJLFNBQzFCLFFBQVE7TUFDZCxV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QUFNLEVBQUUsSUFBSTtNQUFFQyxNQUFNLEVBQUU7SUFBSyxDQUFDLENBQUM7SUFDakMsTUFBTTFNLE1BQU0sQ0FBQ21CLEtBQUssQ0FBQ3FMLGdCQUFnQixDQUFDLGdDQUFnQyxFQUNsRTtNQUFFQyxNQUFNLEVBQUUsSUFBSTtNQUFFQyxNQUFNLEVBQUU7SUFBSyxDQUFDLENBQUM7SUFBQ2xNLHNCQUFBO0VBQUEsU0FBQUMsV0FBQTtJQUFBLE9BQUFELHNCQUFBLENBQUFDLFdBQUE7RUFBQTtFQUFBRCxzQkFBQTtBQUFBO0VBQUFFLElBQUE7RUFBQUMsS0FBQTtBQUFBLEciLCJmaWxlIjoiL3BhY2thZ2VzL2FjY291bnRzLXBhc3N3b3JkLmpzIiwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgZ3JlZXQgPSB3ZWxjb21lTXNnID0+ICh1c2VyLCB1cmwpID0+IHtcbiAgY29uc3QgZ3JlZXRpbmcgPVxuICAgIHVzZXIucHJvZmlsZSAmJiB1c2VyLnByb2ZpbGUubmFtZVxuICAgICAgPyBgSGVsbG8gJHt1c2VyLnByb2ZpbGUubmFtZX0sYFxuICAgICAgOiAnSGVsbG8sJztcbiAgcmV0dXJuIGAke2dyZWV0aW5nfVxuXG4ke3dlbGNvbWVNc2d9LCBzaW1wbHkgY2xpY2sgdGhlIGxpbmsgYmVsb3cuXG5cbiR7dXJsfVxuXG5UaGFuayB5b3UuXG5gO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBPcHRpb25zIHRvIGN1c3RvbWl6ZSBlbWFpbHMgc2VudCBmcm9tIHRoZSBBY2NvdW50cyBzeXN0ZW0uXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgYWNjb3VudHMtYmFzZVxuICovXG5BY2NvdW50cy5lbWFpbFRlbXBsYXRlcyA9IHtcbiAgLi4uKEFjY291bnRzLmVtYWlsVGVtcGxhdGVzIHx8IHt9KSxcbiAgZnJvbTogJ0FjY291bnRzIEV4YW1wbGUgPG5vLXJlcGx5QGV4YW1wbGUuY29tPicsXG4gIHNpdGVOYW1lOiBNZXRlb3IuYWJzb2x1dGVVcmwoKVxuICAgIC5yZXBsYWNlKC9eaHR0cHM/OlxcL1xcLy8sICcnKVxuICAgIC5yZXBsYWNlKC9cXC8kLywgJycpLFxuXG4gIHJlc2V0UGFzc3dvcmQ6IHtcbiAgICBzdWJqZWN0OiAoKSA9PlxuICAgICAgYEhvdyB0byByZXNldCB5b3VyIHBhc3N3b3JkIG9uICR7QWNjb3VudHMuZW1haWxUZW1wbGF0ZXMuc2l0ZU5hbWV9YCxcbiAgICB0ZXh0OiBncmVldCgnVG8gcmVzZXQgeW91ciBwYXNzd29yZCcpLFxuICB9LFxuICB2ZXJpZnlFbWFpbDoge1xuICAgIHN1YmplY3Q6ICgpID0+XG4gICAgICBgSG93IHRvIHZlcmlmeSBlbWFpbCBhZGRyZXNzIG9uICR7QWNjb3VudHMuZW1haWxUZW1wbGF0ZXMuc2l0ZU5hbWV9YCxcbiAgICB0ZXh0OiBncmVldCgnVG8gdmVyaWZ5IHlvdXIgYWNjb3VudCBlbWFpbCcpLFxuICB9LFxuICBlbnJvbGxBY2NvdW50OiB7XG4gICAgc3ViamVjdDogKCkgPT5cbiAgICAgIGBBbiBhY2NvdW50IGhhcyBiZWVuIGNyZWF0ZWQgZm9yIHlvdSBvbiAke0FjY291bnRzLmVtYWlsVGVtcGxhdGVzLnNpdGVOYW1lfWAsXG4gICAgdGV4dDogZ3JlZXQoJ1RvIHN0YXJ0IHVzaW5nIHRoZSBzZXJ2aWNlJyksXG4gIH0sXG59O1xuIiwiaW1wb3J0IHsgaGFzaCBhcyBiY3J5cHRIYXNoLCBjb21wYXJlIGFzIGJjcnlwdENvbXBhcmUgfSBmcm9tICdiY3J5cHQnO1xuaW1wb3J0IHsgQWNjb3VudHMgfSBmcm9tIFwibWV0ZW9yL2FjY291bnRzLWJhc2VcIjtcblxuLy8gVXRpbGl0eSBmb3IgZ3JhYmJpbmcgdXNlclxuY29uc3QgZ2V0VXNlckJ5SWQgPVxuICBhc3luYyAoaWQsIG9wdGlvbnMpID0+XG4gICAgYXdhaXQgTWV0ZW9yLnVzZXJzLmZpbmRPbmVBc3luYyhpZCwgQWNjb3VudHMuX2FkZERlZmF1bHRGaWVsZFNlbGVjdG9yKG9wdGlvbnMpKTtcblxuLy8gVXNlciByZWNvcmRzIGhhdmUgYSAnc2VydmljZXMucGFzc3dvcmQuYmNyeXB0JyBmaWVsZCBvbiB0aGVtIHRvIGhvbGRcbi8vIHRoZWlyIGhhc2hlZCBwYXNzd29yZHMuXG4vL1xuLy8gV2hlbiB0aGUgY2xpZW50IHNlbmRzIGEgcGFzc3dvcmQgdG8gdGhlIHNlcnZlciwgaXQgY2FuIGVpdGhlciBiZSBhXG4vLyBzdHJpbmcgKHRoZSBwbGFpbnRleHQgcGFzc3dvcmQpIG9yIGFuIG9iamVjdCB3aXRoIGtleXMgJ2RpZ2VzdCcgYW5kXG4vLyAnYWxnb3JpdGhtJyAobXVzdCBiZSBcInNoYS0yNTZcIiBmb3Igbm93KS4gVGhlIE1ldGVvciBjbGllbnQgYWx3YXlzIHNlbmRzXG4vLyBwYXNzd29yZCBvYmplY3RzIHsgZGlnZXN0OiAqLCBhbGdvcml0aG06IFwic2hhLTI1NlwiIH0sIGJ1dCBERFAgY2xpZW50c1xuLy8gdGhhdCBkb24ndCBoYXZlIGFjY2VzcyB0byBTSEEgY2FuIGp1c3Qgc2VuZCBwbGFpbnRleHQgcGFzc3dvcmRzIGFzXG4vLyBzdHJpbmdzLlxuLy9cbi8vIFdoZW4gdGhlIHNlcnZlciByZWNlaXZlcyBhIHBsYWludGV4dCBwYXNzd29yZCBhcyBhIHN0cmluZywgaXQgYWx3YXlzXG4vLyBoYXNoZXMgaXQgd2l0aCBTSEEyNTYgYmVmb3JlIHBhc3NpbmcgaXQgaW50byBiY3J5cHQuIFdoZW4gdGhlIHNlcnZlclxuLy8gcmVjZWl2ZXMgYSBwYXNzd29yZCBhcyBhbiBvYmplY3QsIGl0IGFzc2VydHMgdGhhdCB0aGUgYWxnb3JpdGhtIGlzXG4vLyBcInNoYS0yNTZcIiBhbmQgdGhlbiBwYXNzZXMgdGhlIGRpZ2VzdCB0byBiY3J5cHQuXG5cblxuQWNjb3VudHMuX2JjcnlwdFJvdW5kcyA9ICgpID0+IEFjY291bnRzLl9vcHRpb25zLmJjcnlwdFJvdW5kcyB8fCAxMDtcblxuLy8gR2l2ZW4gYSAncGFzc3dvcmQnIGZyb20gdGhlIGNsaWVudCwgZXh0cmFjdCB0aGUgc3RyaW5nIHRoYXQgd2Ugc2hvdWxkXG4vLyBiY3J5cHQuICdwYXNzd29yZCcgY2FuIGJlIG9uZSBvZjpcbi8vICAtIFN0cmluZyAodGhlIHBsYWludGV4dCBwYXNzd29yZClcbi8vICAtIE9iamVjdCB3aXRoICdkaWdlc3QnIGFuZCAnYWxnb3JpdGhtJyBrZXlzLiAnYWxnb3JpdGhtJyBtdXN0IGJlIFwic2hhLTI1NlwiLlxuLy9cbmNvbnN0IGdldFBhc3N3b3JkU3RyaW5nID0gcGFzc3dvcmQgPT4ge1xuICBpZiAodHlwZW9mIHBhc3N3b3JkID09PSBcInN0cmluZ1wiKSB7XG4gICAgcGFzc3dvcmQgPSBTSEEyNTYocGFzc3dvcmQpO1xuICB9IGVsc2UgeyAvLyAncGFzc3dvcmQnIGlzIGFuIG9iamVjdFxuICAgIGlmIChwYXNzd29yZC5hbGdvcml0aG0gIT09IFwic2hhLTI1NlwiKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIHBhc3N3b3JkIGhhc2ggYWxnb3JpdGhtLiBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgXCJPbmx5ICdzaGEtMjU2JyBpcyBhbGxvd2VkLlwiKTtcbiAgICB9XG4gICAgcGFzc3dvcmQgPSBwYXNzd29yZC5kaWdlc3Q7XG4gIH1cbiAgcmV0dXJuIHBhc3N3b3JkO1xufTtcblxuLy8gVXNlIGJjcnlwdCB0byBoYXNoIHRoZSBwYXNzd29yZCBmb3Igc3RvcmFnZSBpbiB0aGUgZGF0YWJhc2UuXG4vLyBgcGFzc3dvcmRgIGNhbiBiZSBhIHN0cmluZyAoaW4gd2hpY2ggY2FzZSBpdCB3aWxsIGJlIHJ1biB0aHJvdWdoXG4vLyBTSEEyNTYgYmVmb3JlIGJjcnlwdCkgb3IgYW4gb2JqZWN0IHdpdGggcHJvcGVydGllcyBgZGlnZXN0YCBhbmRcbi8vIGBhbGdvcml0aG1gIChpbiB3aGljaCBjYXNlIHdlIGJjcnlwdCBgcGFzc3dvcmQuZGlnZXN0YCkuXG4vL1xuY29uc3QgaGFzaFBhc3N3b3JkID0gYXN5bmMgcGFzc3dvcmQgPT4ge1xuICBwYXNzd29yZCA9IGdldFBhc3N3b3JkU3RyaW5nKHBhc3N3b3JkKTtcbiAgcmV0dXJuIGF3YWl0IGJjcnlwdEhhc2gocGFzc3dvcmQsIEFjY291bnRzLl9iY3J5cHRSb3VuZHMoKSk7XG59O1xuXG4vLyBFeHRyYWN0IHRoZSBudW1iZXIgb2Ygcm91bmRzIHVzZWQgaW4gdGhlIHNwZWNpZmllZCBiY3J5cHQgaGFzaC5cbmNvbnN0IGdldFJvdW5kc0Zyb21CY3J5cHRIYXNoID0gaGFzaCA9PiB7XG4gIGxldCByb3VuZHM7XG4gIGlmIChoYXNoKSB7XG4gICAgY29uc3QgaGFzaFNlZ21lbnRzID0gaGFzaC5zcGxpdCgnJCcpO1xuICAgIGlmIChoYXNoU2VnbWVudHMubGVuZ3RoID4gMikge1xuICAgICAgcm91bmRzID0gcGFyc2VJbnQoaGFzaFNlZ21lbnRzWzJdLCAxMCk7XG4gICAgfVxuICB9XG4gIHJldHVybiByb3VuZHM7XG59O1xuXG4vLyBDaGVjayB3aGV0aGVyIHRoZSBwcm92aWRlZCBwYXNzd29yZCBtYXRjaGVzIHRoZSBiY3J5cHQnZWQgcGFzc3dvcmQgaW5cbi8vIHRoZSBkYXRhYmFzZSB1c2VyIHJlY29yZC4gYHBhc3N3b3JkYCBjYW4gYmUgYSBzdHJpbmcgKGluIHdoaWNoIGNhc2Vcbi8vIGl0IHdpbGwgYmUgcnVuIHRocm91Z2ggU0hBMjU2IGJlZm9yZSBiY3J5cHQpIG9yIGFuIG9iamVjdCB3aXRoXG4vLyBwcm9wZXJ0aWVzIGBkaWdlc3RgIGFuZCBgYWxnb3JpdGhtYCAoaW4gd2hpY2ggY2FzZSB3ZSBiY3J5cHRcbi8vIGBwYXNzd29yZC5kaWdlc3RgKS5cbi8vXG4vLyBUaGUgdXNlciBwYXJhbWV0ZXIgbmVlZHMgYXQgbGVhc3QgdXNlci5faWQgYW5kIHVzZXIuc2VydmljZXNcbkFjY291bnRzLl9jaGVja1Bhc3N3b3JkVXNlckZpZWxkcyA9IHtfaWQ6IDEsIHNlcnZpY2VzOiAxfTtcbi8vXG5jb25zdCBjaGVja1Bhc3N3b3JkQXN5bmMgPSBhc3luYyAodXNlciwgcGFzc3dvcmQpID0+IHtcbiAgY29uc3QgcmVzdWx0ID0ge1xuICAgIHVzZXJJZDogdXNlci5faWRcbiAgfTtcblxuICBjb25zdCBmb3JtYXR0ZWRQYXNzd29yZCA9IGdldFBhc3N3b3JkU3RyaW5nKHBhc3N3b3JkKTtcbiAgY29uc3QgaGFzaCA9IHVzZXIuc2VydmljZXMucGFzc3dvcmQuYmNyeXB0O1xuICBjb25zdCBoYXNoUm91bmRzID0gZ2V0Um91bmRzRnJvbUJjcnlwdEhhc2goaGFzaCk7XG5cbiAgaWYgKCEgYXdhaXQgYmNyeXB0Q29tcGFyZShmb3JtYXR0ZWRQYXNzd29yZCwgaGFzaCkpIHtcbiAgICByZXN1bHQuZXJyb3IgPSBBY2NvdW50cy5faGFuZGxlRXJyb3IoXCJJbmNvcnJlY3QgcGFzc3dvcmRcIiwgZmFsc2UpO1xuICB9IGVsc2UgaWYgKGhhc2ggJiYgQWNjb3VudHMuX2JjcnlwdFJvdW5kcygpICE9IGhhc2hSb3VuZHMpIHtcbiAgICAvLyBUaGUgcGFzc3dvcmQgY2hlY2tzIG91dCwgYnV0IHRoZSB1c2VyJ3MgYmNyeXB0IGhhc2ggbmVlZHMgdG8gYmUgdXBkYXRlZC5cblxuICAgIE1ldGVvci5kZWZlcihhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCBNZXRlb3IudXNlcnMudXBkYXRlQXN5bmMoeyBfaWQ6IHVzZXIuX2lkIH0sIHtcbiAgICAgICAgJHNldDoge1xuICAgICAgICAgICdzZXJ2aWNlcy5wYXNzd29yZC5iY3J5cHQnOlxuICAgICAgICAgICAgYXdhaXQgYmNyeXB0SGFzaChmb3JtYXR0ZWRQYXNzd29yZCwgQWNjb3VudHMuX2JjcnlwdFJvdW5kcygpKVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59O1xuXG5BY2NvdW50cy5fY2hlY2tQYXNzd29yZEFzeW5jID0gIGNoZWNrUGFzc3dvcmRBc3luYztcblxuLy8vXG4vLy8gTE9HSU5cbi8vL1xuXG5cbi8qKlxuICogQHN1bW1hcnkgRmluZHMgdGhlIHVzZXIgYXN5bmNocm9ub3VzbHkgd2l0aCB0aGUgc3BlY2lmaWVkIHVzZXJuYW1lLlxuICogRmlyc3QgdHJpZXMgdG8gbWF0Y2ggdXNlcm5hbWUgY2FzZSBzZW5zaXRpdmVseTsgaWYgdGhhdCBmYWlscywgaXRcbiAqIHRyaWVzIGNhc2UgaW5zZW5zaXRpdmVseTsgYnV0IGlmIG1vcmUgdGhhbiBvbmUgdXNlciBtYXRjaGVzIHRoZSBjYXNlXG4gKiBpbnNlbnNpdGl2ZSBzZWFyY2gsIGl0IHJldHVybnMgbnVsbC5cbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBwYXJhbSB7U3RyaW5nfSB1c2VybmFtZSBUaGUgdXNlcm5hbWUgdG8gbG9vayBmb3JcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAqIEBwYXJhbSB7TW9uZ29GaWVsZFNwZWNpZmllcn0gb3B0aW9ucy5maWVsZHMgRGljdGlvbmFyeSBvZiBmaWVsZHMgdG8gcmV0dXJuIG9yIGV4Y2x1ZGUuXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxPYmplY3Q+fSBBIHVzZXIgaWYgZm91bmQsIGVsc2UgbnVsbFxuICogQGltcG9ydEZyb21QYWNrYWdlIGFjY291bnRzLWJhc2VcbiAqL1xuQWNjb3VudHMuZmluZFVzZXJCeVVzZXJuYW1lID1cbiAgYXN5bmMgKHVzZXJuYW1lLCBvcHRpb25zKSA9PlxuICAgIGF3YWl0IEFjY291bnRzLl9maW5kVXNlckJ5UXVlcnkoeyB1c2VybmFtZSB9LCBvcHRpb25zKTtcblxuLyoqXG4gKiBAc3VtbWFyeSBGaW5kcyB0aGUgdXNlciBhc3luY2hyb25vdXNseSB3aXRoIHRoZSBzcGVjaWZpZWQgZW1haWwuXG4gKiBGaXJzdCB0cmllcyB0byBtYXRjaCBlbWFpbCBjYXNlIHNlbnNpdGl2ZWx5OyBpZiB0aGF0IGZhaWxzLCBpdFxuICogdHJpZXMgY2FzZSBpbnNlbnNpdGl2ZWx5OyBidXQgaWYgbW9yZSB0aGFuIG9uZSB1c2VyIG1hdGNoZXMgdGhlIGNhc2VcbiAqIGluc2Vuc2l0aXZlIHNlYXJjaCwgaXQgcmV0dXJucyBudWxsLlxuICogQGxvY3VzIFNlcnZlclxuICogQHBhcmFtIHtTdHJpbmd9IGVtYWlsIFRoZSBlbWFpbCBhZGRyZXNzIHRvIGxvb2sgZm9yXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAcGFyYW0ge01vbmdvRmllbGRTcGVjaWZpZXJ9IG9wdGlvbnMuZmllbGRzIERpY3Rpb25hcnkgb2YgZmllbGRzIHRvIHJldHVybiBvciBleGNsdWRlLlxuICogQHJldHVybnMge1Byb21pc2U8T2JqZWN0Pn0gQSB1c2VyIGlmIGZvdW5kLCBlbHNlIG51bGxcbiAqIEBpbXBvcnRGcm9tUGFja2FnZSBhY2NvdW50cy1iYXNlXG4gKi9cbkFjY291bnRzLmZpbmRVc2VyQnlFbWFpbCA9XG4gIGFzeW5jIChlbWFpbCwgb3B0aW9ucykgPT5cbiAgICBhd2FpdCBBY2NvdW50cy5fZmluZFVzZXJCeVF1ZXJ5KHsgZW1haWwgfSwgb3B0aW9ucyk7XG5cbi8vIFhYWCBtYXliZSB0aGlzIGJlbG9uZ3MgaW4gdGhlIGNoZWNrIHBhY2thZ2VcbmNvbnN0IE5vbkVtcHR5U3RyaW5nID0gTWF0Y2guV2hlcmUoeCA9PiB7XG4gIGNoZWNrKHgsIFN0cmluZyk7XG4gIHJldHVybiB4Lmxlbmd0aCA+IDA7XG59KTtcblxuY29uc3QgcGFzc3dvcmRWYWxpZGF0b3IgPSBNYXRjaC5PbmVPZihcbiAgTWF0Y2guV2hlcmUoc3RyID0+IE1hdGNoLnRlc3Qoc3RyLCBTdHJpbmcpICYmIHN0ci5sZW5ndGggPD0gTWV0ZW9yLnNldHRpbmdzPy5wYWNrYWdlcz8uYWNjb3VudHM/LnBhc3N3b3JkTWF4TGVuZ3RoIHx8IDI1NiksIHtcbiAgICBkaWdlc3Q6IE1hdGNoLldoZXJlKHN0ciA9PiBNYXRjaC50ZXN0KHN0ciwgU3RyaW5nKSAmJiBzdHIubGVuZ3RoID09PSA2NCksXG4gICAgYWxnb3JpdGhtOiBNYXRjaC5PbmVPZignc2hhLTI1NicpXG4gIH1cbik7XG5cbi8vIEhhbmRsZXIgdG8gbG9naW4gd2l0aCBhIHBhc3N3b3JkLlxuLy9cbi8vIFRoZSBNZXRlb3IgY2xpZW50IHNldHMgb3B0aW9ucy5wYXNzd29yZCB0byBhbiBvYmplY3Qgd2l0aCBrZXlzXG4vLyAnZGlnZXN0JyAoc2V0IHRvIFNIQTI1NihwYXNzd29yZCkpIGFuZCAnYWxnb3JpdGhtJyAoXCJzaGEtMjU2XCIpLlxuLy9cbi8vIEZvciBvdGhlciBERFAgY2xpZW50cyB3aGljaCBkb24ndCBoYXZlIGFjY2VzcyB0byBTSEEsIHRoZSBoYW5kbGVyXG4vLyBhbHNvIGFjY2VwdHMgdGhlIHBsYWludGV4dCBwYXNzd29yZCBpbiBvcHRpb25zLnBhc3N3b3JkIGFzIGEgc3RyaW5nLlxuLy9cbi8vIChJdCBtaWdodCBiZSBuaWNlIGlmIHNlcnZlcnMgY291bGQgdHVybiB0aGUgcGxhaW50ZXh0IHBhc3N3b3JkXG4vLyBvcHRpb24gb2ZmLiBPciBtYXliZSBpdCBzaG91bGQgYmUgb3B0LWluLCBub3Qgb3B0LW91dD9cbi8vIEFjY291bnRzLmNvbmZpZyBvcHRpb24/KVxuLy9cbi8vIE5vdGUgdGhhdCBuZWl0aGVyIHBhc3N3b3JkIG9wdGlvbiBpcyBzZWN1cmUgd2l0aG91dCBTU0wuXG4vL1xuQWNjb3VudHMucmVnaXN0ZXJMb2dpbkhhbmRsZXIoXCJwYXNzd29yZFwiLCBhc3luYyBvcHRpb25zID0+IHtcbiAgaWYgKCFvcHRpb25zLnBhc3N3b3JkKVxuICAgIHJldHVybiB1bmRlZmluZWQ7IC8vIGRvbid0IGhhbmRsZVxuXG4gIGNoZWNrKG9wdGlvbnMsIHtcbiAgICB1c2VyOiBBY2NvdW50cy5fdXNlclF1ZXJ5VmFsaWRhdG9yLFxuICAgIHBhc3N3b3JkOiBwYXNzd29yZFZhbGlkYXRvcixcbiAgICBjb2RlOiBNYXRjaC5PcHRpb25hbChOb25FbXB0eVN0cmluZyksXG4gIH0pO1xuXG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IEFjY291bnRzLl9maW5kVXNlckJ5UXVlcnkob3B0aW9ucy51c2VyLCB7ZmllbGRzOiB7XG4gICAgc2VydmljZXM6IDEsXG4gICAgLi4uQWNjb3VudHMuX2NoZWNrUGFzc3dvcmRVc2VyRmllbGRzLFxuICB9fSk7XG4gIGlmICghdXNlcikge1xuICAgIEFjY291bnRzLl9oYW5kbGVFcnJvcihcIlVzZXIgbm90IGZvdW5kXCIpO1xuICB9XG5cblxuICBpZiAoIXVzZXIuc2VydmljZXMgfHwgIXVzZXIuc2VydmljZXMucGFzc3dvcmQgfHxcbiAgICAgICF1c2VyLnNlcnZpY2VzLnBhc3N3b3JkLmJjcnlwdCkge1xuICAgIEFjY291bnRzLl9oYW5kbGVFcnJvcihcIlVzZXIgaGFzIG5vIHBhc3N3b3JkIHNldFwiKTtcbiAgfVxuXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNoZWNrUGFzc3dvcmRBc3luYyh1c2VyLCBvcHRpb25zLnBhc3N3b3JkKTtcbiAgLy8gVGhpcyBtZXRob2QgaXMgYWRkZWQgYnkgdGhlIHBhY2thZ2UgYWNjb3VudHMtMmZhXG4gIC8vIEZpcnN0IHRoZSBsb2dpbiBpcyB2YWxpZGF0ZWQsIHRoZW4gdGhlIGNvZGUgc2l0dWF0aW9uIGlzIGNoZWNrZWRcbiAgaWYgKFxuICAgICFyZXN1bHQuZXJyb3IgJiZcbiAgICBBY2NvdW50cy5fY2hlY2syZmFFbmFibGVkPy4odXNlcilcbiAgKSB7XG4gICAgaWYgKCFvcHRpb25zLmNvZGUpIHtcbiAgICAgIEFjY291bnRzLl9oYW5kbGVFcnJvcignMkZBIGNvZGUgbXVzdCBiZSBpbmZvcm1lZCcsIHRydWUsICduby0yZmEtY29kZScpO1xuICAgIH1cbiAgICBpZiAoXG4gICAgICAhQWNjb3VudHMuX2lzVG9rZW5WYWxpZChcbiAgICAgICAgdXNlci5zZXJ2aWNlcy50d29GYWN0b3JBdXRoZW50aWNhdGlvbi5zZWNyZXQsXG4gICAgICAgIG9wdGlvbnMuY29kZVxuICAgICAgKVxuICAgICkge1xuICAgICAgQWNjb3VudHMuX2hhbmRsZUVycm9yKCdJbnZhbGlkIDJGQSBjb2RlJywgdHJ1ZSwgJ2ludmFsaWQtMmZhLWNvZGUnKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufSk7XG5cbi8vL1xuLy8vIENIQU5HSU5HXG4vLy9cblxuLyoqXG4gKiBAc3VtbWFyeSBDaGFuZ2UgYSB1c2VyJ3MgdXNlcm5hbWUgYXN5bmNocm9ub3VzbHkuIFVzZSB0aGlzIGluc3RlYWQgb2YgdXBkYXRpbmcgdGhlXG4gKiBkYXRhYmFzZSBkaXJlY3RseS4gVGhlIG9wZXJhdGlvbiB3aWxsIGZhaWwgaWYgdGhlcmUgaXMgYW4gZXhpc3RpbmcgdXNlclxuICogd2l0aCBhIHVzZXJuYW1lIG9ubHkgZGlmZmVyaW5nIGluIGNhc2UuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge1N0cmluZ30gdXNlcklkIFRoZSBJRCBvZiB0aGUgdXNlciB0byB1cGRhdGUuXG4gKiBAcGFyYW0ge1N0cmluZ30gbmV3VXNlcm5hbWUgQSBuZXcgdXNlcm5hbWUgZm9yIHRoZSB1c2VyLlxuICogQGltcG9ydEZyb21QYWNrYWdlIGFjY291bnRzLWJhc2VcbiAqL1xuQWNjb3VudHMuc2V0VXNlcm5hbWUgPVxuICBhc3luYyAodXNlcklkLCBuZXdVc2VybmFtZSkgPT4ge1xuICAgIGNoZWNrKHVzZXJJZCwgTm9uRW1wdHlTdHJpbmcpO1xuICAgIGNoZWNrKG5ld1VzZXJuYW1lLCBOb25FbXB0eVN0cmluZyk7XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgZ2V0VXNlckJ5SWQodXNlcklkLCB7XG4gICAgICBmaWVsZHM6IHtcbiAgICAgICAgdXNlcm5hbWU6IDEsXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoIXVzZXIpIHtcbiAgICAgIEFjY291bnRzLl9oYW5kbGVFcnJvcihcIlVzZXIgbm90IGZvdW5kXCIpO1xuICAgIH1cblxuICAgIGNvbnN0IG9sZFVzZXJuYW1lID0gdXNlci51c2VybmFtZTtcblxuICAgIC8vIFBlcmZvcm0gYSBjYXNlIGluc2Vuc2l0aXZlIGNoZWNrIGZvciBkdXBsaWNhdGVzIGJlZm9yZSB1cGRhdGVcbiAgICBhd2FpdCBBY2NvdW50cy5fY2hlY2tGb3JDYXNlSW5zZW5zaXRpdmVEdXBsaWNhdGVzKCd1c2VybmFtZScsXG4gICAgICAnVXNlcm5hbWUnLCBuZXdVc2VybmFtZSwgdXNlci5faWQpO1xuXG4gICAgYXdhaXQgTWV0ZW9yLnVzZXJzLnVwZGF0ZUFzeW5jKHsgX2lkOiB1c2VyLl9pZCB9LCB7ICRzZXQ6IHsgdXNlcm5hbWU6IG5ld1VzZXJuYW1lIH0gfSk7XG5cbiAgICAvLyBQZXJmb3JtIGFub3RoZXIgY2hlY2sgYWZ0ZXIgdXBkYXRlLCBpbiBjYXNlIGEgbWF0Y2hpbmcgdXNlciBoYXMgYmVlblxuICAgIC8vIGluc2VydGVkIGluIHRoZSBtZWFudGltZVxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBBY2NvdW50cy5fY2hlY2tGb3JDYXNlSW5zZW5zaXRpdmVEdXBsaWNhdGVzKCd1c2VybmFtZScsXG4gICAgICAgICdVc2VybmFtZScsIG5ld1VzZXJuYW1lLCB1c2VyLl9pZCk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIC8vIFVuZG8gdXBkYXRlIGlmIHRoZSBjaGVjayBmYWlsc1xuICAgICAgYXdhaXQgTWV0ZW9yLnVzZXJzLnVwZGF0ZUFzeW5jKHsgX2lkOiB1c2VyLl9pZCB9LCB7ICRzZXQ6IHsgdXNlcm5hbWU6IG9sZFVzZXJuYW1lIH0gfSk7XG4gICAgICB0aHJvdyBleDtcbiAgICB9XG4gIH07XG5cbi8vIExldCB0aGUgdXNlciBjaGFuZ2UgdGhlaXIgb3duIHBhc3N3b3JkIGlmIHRoZXkga25vdyB0aGUgb2xkXG4vLyBwYXNzd29yZC4gYG9sZFBhc3N3b3JkYCBhbmQgYG5ld1Bhc3N3b3JkYCBzaG91bGQgYmUgb2JqZWN0cyB3aXRoIGtleXNcbi8vIGBkaWdlc3RgIGFuZCBgYWxnb3JpdGhtYCAocmVwcmVzZW50aW5nIHRoZSBTSEEyNTYgb2YgdGhlIHBhc3N3b3JkKS5cbk1ldGVvci5tZXRob2RzKFxuICB7XG4gICAgY2hhbmdlUGFzc3dvcmQ6IGFzeW5jIGZ1bmN0aW9uIChvbGRQYXNzd29yZCwgbmV3UGFzc3dvcmQpIHtcbiAgY2hlY2sob2xkUGFzc3dvcmQsIHBhc3N3b3JkVmFsaWRhdG9yKTtcbiAgY2hlY2sobmV3UGFzc3dvcmQsIHBhc3N3b3JkVmFsaWRhdG9yKTtcblxuICBpZiAoIXRoaXMudXNlcklkKSB7XG4gICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDEsIFwiTXVzdCBiZSBsb2dnZWQgaW5cIik7XG4gIH1cblxuICBjb25zdCB1c2VyID0gYXdhaXQgZ2V0VXNlckJ5SWQodGhpcy51c2VySWQsIHtmaWVsZHM6IHtcbiAgICBzZXJ2aWNlczogMSxcbiAgICAuLi5BY2NvdW50cy5fY2hlY2tQYXNzd29yZFVzZXJGaWVsZHMsXG4gIH19KTtcbiAgaWYgKCF1c2VyKSB7XG4gICAgQWNjb3VudHMuX2hhbmRsZUVycm9yKFwiVXNlciBub3QgZm91bmRcIik7XG4gIH1cblxuICBpZiAoIXVzZXIuc2VydmljZXMgfHwgIXVzZXIuc2VydmljZXMucGFzc3dvcmQgfHwgIXVzZXIuc2VydmljZXMucGFzc3dvcmQuYmNyeXB0KSB7XG4gICAgQWNjb3VudHMuX2hhbmRsZUVycm9yKFwiVXNlciBoYXMgbm8gcGFzc3dvcmQgc2V0XCIpO1xuICB9XG5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2hlY2tQYXNzd29yZEFzeW5jKHVzZXIsIG9sZFBhc3N3b3JkKTtcbiAgaWYgKHJlc3VsdC5lcnJvcikge1xuICAgIHRocm93IHJlc3VsdC5lcnJvcjtcbiAgfVxuXG4gIGNvbnN0IGhhc2hlZCA9IGF3YWl0IGhhc2hQYXNzd29yZChuZXdQYXNzd29yZCk7XG5cbiAgLy8gSXQgd291bGQgYmUgYmV0dGVyIGlmIHRoaXMgcmVtb3ZlZCBBTEwgZXhpc3RpbmcgdG9rZW5zIGFuZCByZXBsYWNlZFxuICAvLyB0aGUgdG9rZW4gZm9yIHRoZSBjdXJyZW50IGNvbm5lY3Rpb24gd2l0aCBhIG5ldyBvbmUsIGJ1dCB0aGF0IHdvdWxkXG4gIC8vIGJlIHRyaWNreSwgc28gd2UnbGwgc2V0dGxlIGZvciBqdXN0IHJlcGxhY2luZyBhbGwgdG9rZW5zIG90aGVyIHRoYW5cbiAgLy8gdGhlIG9uZSBmb3IgdGhlIGN1cnJlbnQgY29ubmVjdGlvbi5cbiAgY29uc3QgY3VycmVudFRva2VuID0gQWNjb3VudHMuX2dldExvZ2luVG9rZW4odGhpcy5jb25uZWN0aW9uLmlkKTtcbiAgYXdhaXQgTWV0ZW9yLnVzZXJzLnVwZGF0ZUFzeW5jKFxuICAgIHsgX2lkOiB0aGlzLnVzZXJJZCB9LFxuICAgIHtcbiAgICAgICRzZXQ6IHsgJ3NlcnZpY2VzLnBhc3N3b3JkLmJjcnlwdCc6IGhhc2hlZCB9LFxuICAgICAgJHB1bGw6IHtcbiAgICAgICAgJ3NlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vucyc6IHsgaGFzaGVkVG9rZW46IHsgJG5lOiBjdXJyZW50VG9rZW4gfSB9XG4gICAgICB9LFxuICAgICAgJHVuc2V0OiB7ICdzZXJ2aWNlcy5wYXNzd29yZC5yZXNldCc6IDEgfVxuICAgIH1cbiAgKTtcblxuICByZXR1cm4ge3Bhc3N3b3JkQ2hhbmdlZDogdHJ1ZX07XG59fSk7XG5cblxuLy8gRm9yY2UgY2hhbmdlIHRoZSB1c2VycyBwYXNzd29yZC5cblxuLyoqXG4gKiBAc3VtbWFyeSBGb3JjaWJseSBjaGFuZ2UgdGhlIHBhc3N3b3JkIGZvciBhIHVzZXIuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge1N0cmluZ30gdXNlcklkIFRoZSBpZCBvZiB0aGUgdXNlciB0byB1cGRhdGUuXG4gKiBAcGFyYW0ge1N0cmluZ30gbmV3UGFzc3dvcmQgQSBuZXcgcGFzc3dvcmQgZm9yIHRoZSB1c2VyLlxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMubG9nb3V0IExvZ291dCBhbGwgY3VycmVudCBjb25uZWN0aW9ucyB3aXRoIHRoaXMgdXNlcklkIChkZWZhdWx0OiB0cnVlKVxuICogQGltcG9ydEZyb21QYWNrYWdlIGFjY291bnRzLWJhc2VcbiAqL1xuQWNjb3VudHMuc2V0UGFzc3dvcmRBc3luYyA9XG4gIGFzeW5jICh1c2VySWQsIG5ld1BsYWludGV4dFBhc3N3b3JkLCBvcHRpb25zKSA9PiB7XG4gIGNoZWNrKHVzZXJJZCwgU3RyaW5nKTtcbiAgY2hlY2sobmV3UGxhaW50ZXh0UGFzc3dvcmQsIE1hdGNoLldoZXJlKHN0ciA9PiBNYXRjaC50ZXN0KHN0ciwgU3RyaW5nKSAmJiBzdHIubGVuZ3RoIDw9IE1ldGVvci5zZXR0aW5ncz8ucGFja2FnZXM/LmFjY291bnRzPy5wYXNzd29yZE1heExlbmd0aCB8fCAyNTYpKTtcbiAgY2hlY2sob3B0aW9ucywgTWF0Y2guTWF5YmUoeyBsb2dvdXQ6IEJvb2xlYW4gfSkpO1xuICBvcHRpb25zID0geyBsb2dvdXQ6IHRydWUgLCAuLi5vcHRpb25zIH07XG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IGdldFVzZXJCeUlkKHVzZXJJZCwgeyBmaWVsZHM6IHsgX2lkOiAxIH0gfSk7XG4gIGlmICghdXNlcikge1xuICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIlVzZXIgbm90IGZvdW5kXCIpO1xuICB9XG5cbiAgY29uc3QgdXBkYXRlID0ge1xuICAgICR1bnNldDoge1xuICAgICAgJ3NlcnZpY2VzLnBhc3N3b3JkLnJlc2V0JzogMVxuICAgIH0sXG4gICAgJHNldDogeydzZXJ2aWNlcy5wYXNzd29yZC5iY3J5cHQnOiBhd2FpdCBoYXNoUGFzc3dvcmQobmV3UGxhaW50ZXh0UGFzc3dvcmQpfVxuICB9O1xuXG4gIGlmIChvcHRpb25zLmxvZ291dCkge1xuICAgIHVwZGF0ZS4kdW5zZXRbJ3NlcnZpY2VzLnJlc3VtZS5sb2dpblRva2VucyddID0gMTtcbiAgfVxuXG4gIGF3YWl0IE1ldGVvci51c2Vycy51cGRhdGVBc3luYyh7X2lkOiB1c2VyLl9pZH0sIHVwZGF0ZSk7XG59O1xuXG4vLy9cbi8vLyBSRVNFVFRJTkcgVklBIEVNQUlMXG4vLy9cblxuLy8gVXRpbGl0eSBmb3IgcGx1Y2tpbmcgYWRkcmVzc2VzIGZyb20gZW1haWxzXG5jb25zdCBwbHVja0FkZHJlc3NlcyA9IChlbWFpbHMgPSBbXSkgPT4gZW1haWxzLm1hcChlbWFpbCA9PiBlbWFpbC5hZGRyZXNzKTtcblxuLy8gTWV0aG9kIGNhbGxlZCBieSBhIHVzZXIgdG8gcmVxdWVzdCBhIHBhc3N3b3JkIHJlc2V0IGVtYWlsLiBUaGlzIGlzXG4vLyB0aGUgc3RhcnQgb2YgdGhlIHJlc2V0IHByb2Nlc3MuXG5NZXRlb3IubWV0aG9kcyh7Zm9yZ290UGFzc3dvcmQ6IGFzeW5jIG9wdGlvbnMgPT4ge1xuICBjaGVjayhvcHRpb25zLCB7ZW1haWw6IFN0cmluZ30pXG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IEFjY291bnRzLmZpbmRVc2VyQnlFbWFpbChvcHRpb25zLmVtYWlsLCB7IGZpZWxkczogeyBlbWFpbHM6IDEgfSB9KTtcblxuICBpZiAoIXVzZXIpIHtcbiAgICBBY2NvdW50cy5faGFuZGxlRXJyb3IoXCJVc2VyIG5vdCBmb3VuZFwiKTtcbiAgfVxuXG4gIGNvbnN0IGVtYWlscyA9IHBsdWNrQWRkcmVzc2VzKHVzZXIuZW1haWxzKTtcbiAgY29uc3QgY2FzZVNlbnNpdGl2ZUVtYWlsID0gZW1haWxzLmZpbmQoXG4gICAgZW1haWwgPT4gZW1haWwudG9Mb3dlckNhc2UoKSA9PT0gb3B0aW9ucy5lbWFpbC50b0xvd2VyQ2FzZSgpXG4gICk7XG5cbiAgYXdhaXQgQWNjb3VudHMuc2VuZFJlc2V0UGFzc3dvcmRFbWFpbCh1c2VyLl9pZCwgY2FzZVNlbnNpdGl2ZUVtYWlsKTtcbn19KTtcblxuLyoqXG4gKiBAc3VtbWFyeSBBc3luY2hyb25vdXNseSBnZW5lcmF0ZXMgYSByZXNldCB0b2tlbiBhbmQgc2F2ZXMgaXQgaW50byB0aGUgZGF0YWJhc2UuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge1N0cmluZ30gdXNlcklkIFRoZSBpZCBvZiB0aGUgdXNlciB0byBnZW5lcmF0ZSB0aGUgcmVzZXQgdG9rZW4gZm9yLlxuICogQHBhcmFtIHtTdHJpbmd9IGVtYWlsIFdoaWNoIGFkZHJlc3Mgb2YgdGhlIHVzZXIgdG8gZ2VuZXJhdGUgdGhlIHJlc2V0IHRva2VuIGZvci4gVGhpcyBhZGRyZXNzIG11c3QgYmUgaW4gdGhlIHVzZXIncyBgZW1haWxzYCBsaXN0LiBJZiBgbnVsbGAsIGRlZmF1bHRzIHRvIHRoZSBmaXJzdCBlbWFpbCBpbiB0aGUgbGlzdC5cbiAqIEBwYXJhbSB7U3RyaW5nfSByZWFzb24gYHJlc2V0UGFzc3dvcmRgIG9yIGBlbnJvbGxBY2NvdW50YC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbZXh0cmFUb2tlbkRhdGFdIE9wdGlvbmFsIGFkZGl0aW9uYWwgZGF0YSB0byBiZSBhZGRlZCBpbnRvIHRoZSB0b2tlbiByZWNvcmQuXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxPYmplY3Q+fSBQcm9taXNlIG9mIGFuIG9iamVjdCB3aXRoIHtlbWFpbCwgdXNlciwgdG9rZW59IHZhbHVlcy5cbiAqIEBpbXBvcnRGcm9tUGFja2FnZSBhY2NvdW50cy1iYXNlXG4gKi9cbkFjY291bnRzLmdlbmVyYXRlUmVzZXRUb2tlbiA9XG4gIGFzeW5jICh1c2VySWQsIGVtYWlsLCByZWFzb24sIGV4dHJhVG9rZW5EYXRhKSA9PiB7XG4gIC8vIE1ha2Ugc3VyZSB0aGUgdXNlciBleGlzdHMsIGFuZCBlbWFpbCBpcyBvbmUgb2YgdGhlaXIgYWRkcmVzc2VzLlxuICAvLyBEb24ndCBsaW1pdCB0aGUgZmllbGRzIGluIHRoZSB1c2VyIG9iamVjdCBzaW5jZSB0aGUgdXNlciBpcyByZXR1cm5lZFxuICAvLyBieSB0aGUgZnVuY3Rpb24gYW5kIHNvbWUgb3RoZXIgZmllbGRzIG1pZ2h0IGJlIHVzZWQgZWxzZXdoZXJlLlxuICBjb25zdCB1c2VyID0gYXdhaXQgZ2V0VXNlckJ5SWQodXNlcklkKTtcbiAgaWYgKCF1c2VyKSB7XG4gICAgQWNjb3VudHMuX2hhbmRsZUVycm9yKFwiQ2FuJ3QgZmluZCB1c2VyXCIpO1xuICB9XG5cbiAgLy8gcGljayB0aGUgZmlyc3QgZW1haWwgaWYgd2Ugd2VyZW4ndCBwYXNzZWQgYW4gZW1haWwuXG4gIGlmICghZW1haWwgJiYgdXNlci5lbWFpbHMgJiYgdXNlci5lbWFpbHNbMF0pIHtcbiAgICBlbWFpbCA9IHVzZXIuZW1haWxzWzBdLmFkZHJlc3M7XG4gIH1cblxuICAvLyBtYWtlIHN1cmUgd2UgaGF2ZSBhIHZhbGlkIGVtYWlsXG4gIGlmICghZW1haWwgfHxcbiAgICAhKHBsdWNrQWRkcmVzc2VzKHVzZXIuZW1haWxzKS5pbmNsdWRlcyhlbWFpbCkpKSB7XG4gICAgQWNjb3VudHMuX2hhbmRsZUVycm9yKFwiTm8gc3VjaCBlbWFpbCBmb3IgdXNlci5cIik7XG4gIH1cblxuICBjb25zdCB0b2tlbiA9IFJhbmRvbS5zZWNyZXQoKTtcbiAgY29uc3QgdG9rZW5SZWNvcmQgPSB7XG4gICAgdG9rZW4sXG4gICAgZW1haWwsXG4gICAgd2hlbjogbmV3IERhdGUoKVxuICB9O1xuXG4gIGlmIChyZWFzb24gPT09ICdyZXNldFBhc3N3b3JkJykge1xuICAgIHRva2VuUmVjb3JkLnJlYXNvbiA9ICdyZXNldCc7XG4gIH0gZWxzZSBpZiAocmVhc29uID09PSAnZW5yb2xsQWNjb3VudCcpIHtcbiAgICB0b2tlblJlY29yZC5yZWFzb24gPSAnZW5yb2xsJztcbiAgfSBlbHNlIGlmIChyZWFzb24pIHtcbiAgICAvLyBmYWxsYmFjayBzbyB0aGF0IHRoaXMgZnVuY3Rpb24gY2FuIGJlIHVzZWQgZm9yIHVua25vd24gcmVhc29ucyBhcyB3ZWxsXG4gICAgdG9rZW5SZWNvcmQucmVhc29uID0gcmVhc29uO1xuICB9XG5cbiAgaWYgKGV4dHJhVG9rZW5EYXRhKSB7XG4gICAgT2JqZWN0LmFzc2lnbih0b2tlblJlY29yZCwgZXh0cmFUb2tlbkRhdGEpO1xuICB9XG4gIC8vIGlmIHRoaXMgbWV0aG9kIGlzIGNhbGxlZCBmcm9tIHRoZSBlbnJvbGwgYWNjb3VudCB3b3JrLWZsb3cgdGhlblxuICAvLyBzdG9yZSB0aGUgdG9rZW4gcmVjb3JkIGluICdzZXJ2aWNlcy5wYXNzd29yZC5lbnJvbGwnIGRiIGZpZWxkXG4gIC8vIGVsc2Ugc3RvcmUgdGhlIHRva2VuIHJlY29yZCBpbiBpbiAnc2VydmljZXMucGFzc3dvcmQucmVzZXQnIGRiIGZpZWxkXG4gIGlmKHJlYXNvbiA9PT0gJ2Vucm9sbEFjY291bnQnKSB7XG4gICAgYXdhaXQgTWV0ZW9yLnVzZXJzLnVwZGF0ZUFzeW5jKHtfaWQ6IHVzZXIuX2lkfSwge1xuICAgICAgJHNldCA6IHtcbiAgICAgICAgJ3NlcnZpY2VzLnBhc3N3b3JkLmVucm9sbCc6IHRva2VuUmVjb3JkXG4gICAgICB9XG4gICAgfSk7XG4gICAgLy8gYmVmb3JlIHBhc3NpbmcgdG8gdGVtcGxhdGUsIHVwZGF0ZSB1c2VyIG9iamVjdCB3aXRoIG5ldyB0b2tlblxuICAgICBNZXRlb3IuX2Vuc3VyZSh1c2VyLCAnc2VydmljZXMnLCAncGFzc3dvcmQnKS5lbnJvbGwgPSB0b2tlblJlY29yZDtcbiAgfSBlbHNlIHtcbiAgICBhd2FpdCBNZXRlb3IudXNlcnMudXBkYXRlQXN5bmMoe19pZDogdXNlci5faWR9LCB7XG4gICAgICAkc2V0IDoge1xuICAgICAgICAnc2VydmljZXMucGFzc3dvcmQucmVzZXQnOiB0b2tlblJlY29yZFxuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIGJlZm9yZSBwYXNzaW5nIHRvIHRlbXBsYXRlLCB1cGRhdGUgdXNlciBvYmplY3Qgd2l0aCBuZXcgdG9rZW5cbiAgICAgTWV0ZW9yLl9lbnN1cmUodXNlciwgJ3NlcnZpY2VzJywgJ3Bhc3N3b3JkJykucmVzZXQgPSB0b2tlblJlY29yZDtcbiAgfVxuXG4gIHJldHVybiB7ZW1haWwsIHVzZXIsIHRva2VufTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgR2VuZXJhdGVzIGFzeW5jaHJvbm91c2x5IGFuIGUtbWFpbCB2ZXJpZmljYXRpb24gdG9rZW4gYW5kIHNhdmVzIGl0IGludG8gdGhlIGRhdGFiYXNlLlxuICogQGxvY3VzIFNlcnZlclxuICogQHBhcmFtIHtTdHJpbmd9IHVzZXJJZCBUaGUgaWQgb2YgdGhlIHVzZXIgdG8gZ2VuZXJhdGUgdGhlICBlLW1haWwgdmVyaWZpY2F0aW9uIHRva2VuIGZvci5cbiAqIEBwYXJhbSB7U3RyaW5nfSBlbWFpbCBXaGljaCBhZGRyZXNzIG9mIHRoZSB1c2VyIHRvIGdlbmVyYXRlIHRoZSBlLW1haWwgdmVyaWZpY2F0aW9uIHRva2VuIGZvci4gVGhpcyBhZGRyZXNzIG11c3QgYmUgaW4gdGhlIHVzZXIncyBgZW1haWxzYCBsaXN0LiBJZiBgbnVsbGAsIGRlZmF1bHRzIHRvIHRoZSBmaXJzdCB1bnZlcmlmaWVkIGVtYWlsIGluIHRoZSBsaXN0LlxuICogQHBhcmFtIHtPYmplY3R9IFtleHRyYVRva2VuRGF0YV0gT3B0aW9uYWwgYWRkaXRpb25hbCBkYXRhIHRvIGJlIGFkZGVkIGludG8gdGhlIHRva2VuIHJlY29yZC5cbiAqIEByZXR1cm5zIHtQcm9taXNlPE9iamVjdD59IFByb21pc2Ugb2YgYW4gb2JqZWN0IHdpdGgge2VtYWlsLCB1c2VyLCB0b2tlbn0gdmFsdWVzLlxuICogQGltcG9ydEZyb21QYWNrYWdlIGFjY291bnRzLWJhc2VcbiAqL1xuQWNjb3VudHMuZ2VuZXJhdGVWZXJpZmljYXRpb25Ub2tlbiA9XG4gIGFzeW5jICh1c2VySWQsIGVtYWlsLCBleHRyYVRva2VuRGF0YSkgPT4ge1xuICAvLyBNYWtlIHN1cmUgdGhlIHVzZXIgZXhpc3RzLCBhbmQgZW1haWwgaXMgb25lIG9mIHRoZWlyIGFkZHJlc3Nlcy5cbiAgLy8gRG9uJ3QgbGltaXQgdGhlIGZpZWxkcyBpbiB0aGUgdXNlciBvYmplY3Qgc2luY2UgdGhlIHVzZXIgaXMgcmV0dXJuZWRcbiAgLy8gYnkgdGhlIGZ1bmN0aW9uIGFuZCBzb21lIG90aGVyIGZpZWxkcyBtaWdodCBiZSB1c2VkIGVsc2V3aGVyZS5cbiAgY29uc3QgdXNlciA9IGF3YWl0IGdldFVzZXJCeUlkKHVzZXJJZCk7XG4gIGlmICghdXNlcikge1xuICAgIEFjY291bnRzLl9oYW5kbGVFcnJvcihcIkNhbid0IGZpbmQgdXNlclwiKTtcbiAgfVxuXG4gIC8vIHBpY2sgdGhlIGZpcnN0IHVudmVyaWZpZWQgZW1haWwgaWYgd2Ugd2VyZW4ndCBwYXNzZWQgYW4gZW1haWwuXG4gIGlmICghZW1haWwpIHtcbiAgICBjb25zdCBlbWFpbFJlY29yZCA9ICh1c2VyLmVtYWlscyB8fCBbXSkuZmluZChlID0+ICFlLnZlcmlmaWVkKTtcbiAgICBlbWFpbCA9IChlbWFpbFJlY29yZCB8fCB7fSkuYWRkcmVzcztcblxuICAgIGlmICghZW1haWwpIHtcbiAgICAgIEFjY291bnRzLl9oYW5kbGVFcnJvcihcIlRoYXQgdXNlciBoYXMgbm8gdW52ZXJpZmllZCBlbWFpbCBhZGRyZXNzZXMuXCIpO1xuICAgIH1cbiAgfVxuXG4gIC8vIG1ha2Ugc3VyZSB3ZSBoYXZlIGEgdmFsaWQgZW1haWxcbiAgaWYgKCFlbWFpbCB8fFxuICAgICEocGx1Y2tBZGRyZXNzZXModXNlci5lbWFpbHMpLmluY2x1ZGVzKGVtYWlsKSkpIHtcbiAgICBBY2NvdW50cy5faGFuZGxlRXJyb3IoXCJObyBzdWNoIGVtYWlsIGZvciB1c2VyLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHRva2VuID0gUmFuZG9tLnNlY3JldCgpO1xuICBjb25zdCB0b2tlblJlY29yZCA9IHtcbiAgICB0b2tlbixcbiAgICAvLyBUT0RPOiBUaGlzIHNob3VsZCBwcm9iYWJseSBiZSByZW5hbWVkIHRvIFwiZW1haWxcIiB0byBtYXRjaCByZXNldCB0b2tlbiByZWNvcmQuXG4gICAgYWRkcmVzczogZW1haWwsXG4gICAgd2hlbjogbmV3IERhdGUoKVxuICB9O1xuXG4gIGlmIChleHRyYVRva2VuRGF0YSkge1xuICAgIE9iamVjdC5hc3NpZ24odG9rZW5SZWNvcmQsIGV4dHJhVG9rZW5EYXRhKTtcbiAgfVxuXG4gIGF3YWl0IE1ldGVvci51c2Vycy51cGRhdGVBc3luYyh7X2lkOiB1c2VyLl9pZH0sIHskcHVzaDoge1xuICAgICdzZXJ2aWNlcy5lbWFpbC52ZXJpZmljYXRpb25Ub2tlbnMnOiB0b2tlblJlY29yZFxuICB9fSk7XG5cbiAgLy8gYmVmb3JlIHBhc3NpbmcgdG8gdGVtcGxhdGUsIHVwZGF0ZSB1c2VyIG9iamVjdCB3aXRoIG5ldyB0b2tlblxuICBNZXRlb3IuX2Vuc3VyZSh1c2VyLCAnc2VydmljZXMnLCAnZW1haWwnKTtcbiAgaWYgKCF1c2VyLnNlcnZpY2VzLmVtYWlsLnZlcmlmaWNhdGlvblRva2Vucykge1xuICAgIHVzZXIuc2VydmljZXMuZW1haWwudmVyaWZpY2F0aW9uVG9rZW5zID0gW107XG4gIH1cbiAgdXNlci5zZXJ2aWNlcy5lbWFpbC52ZXJpZmljYXRpb25Ub2tlbnMucHVzaCh0b2tlblJlY29yZCk7XG5cbiAgcmV0dXJuIHtlbWFpbCwgdXNlciwgdG9rZW59O1xufTtcblxuXG4vLyBzZW5kIHRoZSB1c2VyIGFuIGVtYWlsIHdpdGggYSBsaW5rIHRoYXQgd2hlbiBvcGVuZWQgYWxsb3dzIHRoZSB1c2VyXG4vLyB0byBzZXQgYSBuZXcgcGFzc3dvcmQsIHdpdGhvdXQgdGhlIG9sZCBwYXNzd29yZC5cblxuLyoqXG4gKiBAc3VtbWFyeSBTZW5kIGFuIGVtYWlsIGFzeW5jaHJvbm91c2x5IHdpdGggYSBsaW5rIHRoZSB1c2VyIGNhbiB1c2UgdG8gcmVzZXQgdGhlaXIgcGFzc3dvcmQuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge1N0cmluZ30gdXNlcklkIFRoZSBpZCBvZiB0aGUgdXNlciB0byBzZW5kIGVtYWlsIHRvLlxuICogQHBhcmFtIHtTdHJpbmd9IFtlbWFpbF0gT3B0aW9uYWwuIFdoaWNoIGFkZHJlc3Mgb2YgdGhlIHVzZXIncyB0byBzZW5kIHRoZSBlbWFpbCB0by4gVGhpcyBhZGRyZXNzIG11c3QgYmUgaW4gdGhlIHVzZXIncyBgZW1haWxzYCBsaXN0LiBEZWZhdWx0cyB0byB0aGUgZmlyc3QgZW1haWwgaW4gdGhlIGxpc3QuXG4gKiBAcGFyYW0ge09iamVjdH0gW2V4dHJhVG9rZW5EYXRhXSBPcHRpb25hbCBhZGRpdGlvbmFsIGRhdGEgdG8gYmUgYWRkZWQgaW50byB0aGUgdG9rZW4gcmVjb3JkLlxuICogQHBhcmFtIHtPYmplY3R9IFtleHRyYVBhcmFtc10gT3B0aW9uYWwgYWRkaXRpb25hbCBwYXJhbXMgdG8gYmUgYWRkZWQgdG8gdGhlIHJlc2V0IHVybC5cbiAqIEByZXR1cm5zIHtQcm9taXNlPE9iamVjdD59IFByb21pc2Ugb2YgYW4gb2JqZWN0IHdpdGgge2VtYWlsLCB1c2VyLCB0b2tlbiwgdXJsLCBvcHRpb25zfSB2YWx1ZXMuXG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgYWNjb3VudHMtYmFzZVxuICovXG5BY2NvdW50cy5zZW5kUmVzZXRQYXNzd29yZEVtYWlsID1cbiAgYXN5bmMgKHVzZXJJZCwgZW1haWwsIGV4dHJhVG9rZW5EYXRhLCBleHRyYVBhcmFtcykgPT4ge1xuICAgIGNvbnN0IHsgZW1haWw6IHJlYWxFbWFpbCwgdXNlciwgdG9rZW4gfSA9XG4gICAgICBhd2FpdCBBY2NvdW50cy5nZW5lcmF0ZVJlc2V0VG9rZW4odXNlcklkLCBlbWFpbCwgJ3Jlc2V0UGFzc3dvcmQnLCBleHRyYVRva2VuRGF0YSk7XG4gICAgY29uc3QgdXJsID0gQWNjb3VudHMudXJscy5yZXNldFBhc3N3b3JkKHRva2VuLCBleHRyYVBhcmFtcyk7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGF3YWl0IEFjY291bnRzLmdlbmVyYXRlT3B0aW9uc0ZvckVtYWlsKHJlYWxFbWFpbCwgdXNlciwgdXJsLCAncmVzZXRQYXNzd29yZCcpO1xuICAgIGF3YWl0IEVtYWlsLnNlbmRBc3luYyhvcHRpb25zKTtcblxuICAgIGlmIChNZXRlb3IuaXNEZXZlbG9wbWVudCkge1xuICAgICAgY29uc29sZS5sb2coYFxcblJlc2V0IHBhc3N3b3JkIFVSTDogJHsgdXJsIH1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHsgZW1haWw6IHJlYWxFbWFpbCwgdXNlciwgdG9rZW4sIHVybCwgb3B0aW9ucyB9O1xuICB9O1xuXG4vLyBzZW5kIHRoZSB1c2VyIGFuIGVtYWlsIGluZm9ybWluZyB0aGVtIHRoYXQgdGhlaXIgYWNjb3VudCB3YXMgY3JlYXRlZCwgd2l0aFxuLy8gYSBsaW5rIHRoYXQgd2hlbiBvcGVuZWQgYm90aCBtYXJrcyB0aGVpciBlbWFpbCBhcyB2ZXJpZmllZCBhbmQgZm9yY2VzIHRoZW1cbi8vIHRvIGNob29zZSB0aGVpciBwYXNzd29yZC4gVGhlIGVtYWlsIG11c3QgYmUgb25lIG9mIHRoZSBhZGRyZXNzZXMgaW4gdGhlXG4vLyB1c2VyJ3MgZW1haWxzIGZpZWxkLCBvciB1bmRlZmluZWQgdG8gcGljayB0aGUgZmlyc3QgZW1haWwgYXV0b21hdGljYWxseS5cbi8vXG4vLyBUaGlzIGlzIG5vdCBjYWxsZWQgYXV0b21hdGljYWxseS4gSXQgbXVzdCBiZSBjYWxsZWQgbWFudWFsbHkgaWYgeW91XG4vLyB3YW50IHRvIHVzZSBlbnJvbGxtZW50IGVtYWlscy5cblxuLyoqXG4gKiBAc3VtbWFyeSBTZW5kIGFuIGVtYWlsIGFzeW5jaHJvbm91c2x5IHdpdGggYSBsaW5rIHRoZSB1c2VyIGNhbiB1c2UgdG8gc2V0IHRoZWlyIGluaXRpYWwgcGFzc3dvcmQuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge1N0cmluZ30gdXNlcklkIFRoZSBpZCBvZiB0aGUgdXNlciB0byBzZW5kIGVtYWlsIHRvLlxuICogQHBhcmFtIHtTdHJpbmd9IFtlbWFpbF0gT3B0aW9uYWwuIFdoaWNoIGFkZHJlc3Mgb2YgdGhlIHVzZXIncyB0byBzZW5kIHRoZSBlbWFpbCB0by4gVGhpcyBhZGRyZXNzIG11c3QgYmUgaW4gdGhlIHVzZXIncyBgZW1haWxzYCBsaXN0LiBEZWZhdWx0cyB0byB0aGUgZmlyc3QgZW1haWwgaW4gdGhlIGxpc3QuXG4gKiBAcGFyYW0ge09iamVjdH0gW2V4dHJhVG9rZW5EYXRhXSBPcHRpb25hbCBhZGRpdGlvbmFsIGRhdGEgdG8gYmUgYWRkZWQgaW50byB0aGUgdG9rZW4gcmVjb3JkLlxuICogQHBhcmFtIHtPYmplY3R9IFtleHRyYVBhcmFtc10gT3B0aW9uYWwgYWRkaXRpb25hbCBwYXJhbXMgdG8gYmUgYWRkZWQgdG8gdGhlIGVucm9sbG1lbnQgdXJsLlxuICogQHJldHVybnMge1Byb21pc2U8T2JqZWN0Pn0gUHJvbWlzZSBvZiBhbiBvYmplY3Qge2VtYWlsLCB1c2VyLCB0b2tlbiwgdXJsLCBvcHRpb25zfSB2YWx1ZXMuXG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgYWNjb3VudHMtYmFzZVxuICovXG5BY2NvdW50cy5zZW5kRW5yb2xsbWVudEVtYWlsID1cbiAgYXN5bmMgKHVzZXJJZCwgZW1haWwsIGV4dHJhVG9rZW5EYXRhLCBleHRyYVBhcmFtcykgPT4ge1xuXG4gICAgY29uc3QgeyBlbWFpbDogcmVhbEVtYWlsLCB1c2VyLCB0b2tlbiB9ID1cbiAgICAgIGF3YWl0IEFjY291bnRzLmdlbmVyYXRlUmVzZXRUb2tlbih1c2VySWQsIGVtYWlsLCAnZW5yb2xsQWNjb3VudCcsIGV4dHJhVG9rZW5EYXRhKTtcblxuICAgIGNvbnN0IHVybCA9IEFjY291bnRzLnVybHMuZW5yb2xsQWNjb3VudCh0b2tlbiwgZXh0cmFQYXJhbXMpO1xuXG4gICAgY29uc3Qgb3B0aW9ucyA9XG4gICAgICBhd2FpdCBBY2NvdW50cy5nZW5lcmF0ZU9wdGlvbnNGb3JFbWFpbChyZWFsRW1haWwsIHVzZXIsIHVybCwgJ2Vucm9sbEFjY291bnQnKTtcblxuICAgIGF3YWl0IEVtYWlsLnNlbmRBc3luYyhvcHRpb25zKTtcbiAgICBpZiAoTWV0ZW9yLmlzRGV2ZWxvcG1lbnQpIHtcbiAgICAgIGNvbnNvbGUubG9nKGBcXG5FbnJvbGxtZW50IGVtYWlsIFVSTDogJHsgdXJsIH1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHsgZW1haWw6IHJlYWxFbWFpbCwgdXNlciwgdG9rZW4sIHVybCwgb3B0aW9ucyB9O1xuICB9O1xuXG5cbi8vIFRha2UgdG9rZW4gZnJvbSBzZW5kUmVzZXRQYXNzd29yZEVtYWlsIG9yIHNlbmRFbnJvbGxtZW50RW1haWwsIGNoYW5nZVxuLy8gdGhlIHVzZXJzIHBhc3N3b3JkLCBhbmQgbG9nIHRoZW0gaW4uXG5NZXRlb3IubWV0aG9kcyhcbiAge1xuICAgIHJlc2V0UGFzc3dvcmQ6XG4gICAgICBhc3luYyBmdW5jdGlvbiAoLi4uYXJncykge1xuICAgICAgICBjb25zdCB0b2tlbiA9IGFyZ3NbMF07XG4gICAgICAgIGNvbnN0IG5ld1Bhc3N3b3JkID0gYXJnc1sxXTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IEFjY291bnRzLl9sb2dpbk1ldGhvZChcbiAgICAgICAgICB0aGlzLFxuICAgICAgICAgIFwicmVzZXRQYXNzd29yZFwiLFxuICAgICAgICAgIGFyZ3MsXG4gICAgICAgICAgXCJwYXNzd29yZFwiLFxuICAgICAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGNoZWNrKHRva2VuLCBTdHJpbmcpO1xuICAgICAgICAgICAgY2hlY2sobmV3UGFzc3dvcmQsIHBhc3N3b3JkVmFsaWRhdG9yKTtcbiAgICAgICAgICAgIGxldCB1c2VyID0gYXdhaXQgTWV0ZW9yLnVzZXJzLmZpbmRPbmVBc3luYyhcbiAgICAgICAgICAgICAgeyBcInNlcnZpY2VzLnBhc3N3b3JkLnJlc2V0LnRva2VuXCI6IHRva2VuIH0sXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBmaWVsZHM6IHtcbiAgICAgICAgICAgICAgICAgIHNlcnZpY2VzOiAxLFxuICAgICAgICAgICAgICAgICAgZW1haWxzOiAxLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgbGV0IGlzRW5yb2xsID0gZmFsc2U7XG4gICAgICAgICAgICAvLyBpZiB0b2tlbiBpcyBpbiBzZXJ2aWNlcy5wYXNzd29yZC5yZXNldCBkYiBmaWVsZCBpbXBsaWVzXG4gICAgICAgICAgICAvLyB0aGlzIG1ldGhvZCBpcyB3YXMgbm90IGNhbGxlZCBmcm9tIGVucm9sbCBhY2NvdW50IHdvcmtmbG93XG4gICAgICAgICAgICAvLyBlbHNlIHRoaXMgbWV0aG9kIGlzIGNhbGxlZCBmcm9tIGVucm9sbCBhY2NvdW50IHdvcmtmbG93XG4gICAgICAgICAgICBpZiAoIXVzZXIpIHtcbiAgICAgICAgICAgICAgdXNlciA9IGF3YWl0IE1ldGVvci51c2Vycy5maW5kT25lQXN5bmMoXG4gICAgICAgICAgICAgICAgeyBcInNlcnZpY2VzLnBhc3N3b3JkLmVucm9sbC50b2tlblwiOiB0b2tlbiB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIGZpZWxkczoge1xuICAgICAgICAgICAgICAgICAgICBzZXJ2aWNlczogMSxcbiAgICAgICAgICAgICAgICAgICAgZW1haWxzOiAxLFxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgaXNFbnJvbGwgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCF1c2VyKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIlRva2VuIGV4cGlyZWRcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgdG9rZW5SZWNvcmQgPSB7fTtcbiAgICAgICAgICAgIGlmIChpc0Vucm9sbCkge1xuICAgICAgICAgICAgICB0b2tlblJlY29yZCA9IHVzZXIuc2VydmljZXMucGFzc3dvcmQuZW5yb2xsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdG9rZW5SZWNvcmQgPSB1c2VyLnNlcnZpY2VzLnBhc3N3b3JkLnJlc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgeyB3aGVuLCBlbWFpbCB9ID0gdG9rZW5SZWNvcmQ7XG4gICAgICAgICAgICBsZXQgdG9rZW5MaWZldGltZU1zID0gQWNjb3VudHMuX2dldFBhc3N3b3JkUmVzZXRUb2tlbkxpZmV0aW1lTXMoKTtcbiAgICAgICAgICAgIGlmIChpc0Vucm9sbCkge1xuICAgICAgICAgICAgICB0b2tlbkxpZmV0aW1lTXMgPSBBY2NvdW50cy5fZ2V0UGFzc3dvcmRFbnJvbGxUb2tlbkxpZmV0aW1lTXMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRUaW1lTXMgPSBEYXRlLm5vdygpO1xuICAgICAgICAgICAgaWYgKChjdXJyZW50VGltZU1zIC0gd2hlbikgPiB0b2tlbkxpZmV0aW1lTXMpXG4gICAgICAgICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIlRva2VuIGV4cGlyZWRcIik7XG4gICAgICAgICAgICBpZiAoIShwbHVja0FkZHJlc3Nlcyh1c2VyLmVtYWlscykuaW5jbHVkZXMoZW1haWwpKSlcbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB1c2VySWQ6IHVzZXIuX2lkLFxuICAgICAgICAgICAgICAgIGVycm9yOiBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJUb2tlbiBoYXMgaW52YWxpZCBlbWFpbCBhZGRyZXNzXCIpXG4gICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGNvbnN0IGhhc2hlZCA9IGF3YWl0IGhhc2hQYXNzd29yZChuZXdQYXNzd29yZCk7XG5cbiAgICAgICAgICAgIC8vIE5PVEU6IFdlJ3JlIGFib3V0IHRvIGludmFsaWRhdGUgdG9rZW5zIG9uIHRoZSB1c2VyLCB3aG8gd2UgbWlnaHQgYmVcbiAgICAgICAgICAgIC8vIGxvZ2dlZCBpbiBhcy4gTWFrZSBzdXJlIHRvIGF2b2lkIGxvZ2dpbmcgb3Vyc2VsdmVzIG91dCBpZiB0aGlzXG4gICAgICAgICAgICAvLyBoYXBwZW5zLiBCdXQgYWxzbyBtYWtlIHN1cmUgbm90IHRvIGxlYXZlIHRoZSBjb25uZWN0aW9uIGluIGEgc3RhdGVcbiAgICAgICAgICAgIC8vIG9mIGhhdmluZyBhIGJhZCB0b2tlbiBzZXQgaWYgdGhpbmdzIGZhaWwuXG4gICAgICAgICAgICBjb25zdCBvbGRUb2tlbiA9IEFjY291bnRzLl9nZXRMb2dpblRva2VuKHRoaXMuY29ubmVjdGlvbi5pZCk7XG4gICAgICAgICAgICBBY2NvdW50cy5fc2V0TG9naW5Ub2tlbih1c2VyLl9pZCwgdGhpcy5jb25uZWN0aW9uLCBudWxsKTtcbiAgICAgICAgICAgIGNvbnN0IHJlc2V0VG9PbGRUb2tlbiA9ICgpID0+XG4gICAgICAgICAgICAgIEFjY291bnRzLl9zZXRMb2dpblRva2VuKHVzZXIuX2lkLCB0aGlzLmNvbm5lY3Rpb24sIG9sZFRva2VuKTtcblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSB1c2VyIHJlY29yZCBieTpcbiAgICAgICAgICAgICAgLy8gLSBDaGFuZ2luZyB0aGUgcGFzc3dvcmQgdG8gdGhlIG5ldyBvbmVcbiAgICAgICAgICAgICAgLy8gLSBGb3JnZXR0aW5nIGFib3V0IHRoZSByZXNldCB0b2tlbiBvciBlbnJvbGwgdG9rZW4gdGhhdCB3YXMganVzdCB1c2VkXG4gICAgICAgICAgICAgIC8vIC0gVmVyaWZ5aW5nIHRoZWlyIGVtYWlsLCBzaW5jZSB0aGV5IGdvdCB0aGUgcGFzc3dvcmQgcmVzZXQgdmlhIGVtYWlsLlxuICAgICAgICAgICAgICBsZXQgYWZmZWN0ZWRSZWNvcmRzID0ge307XG4gICAgICAgICAgICAgIC8vIGlmIHJlYXNvbiBpcyBlbnJvbGwgdGhlbiBjaGVjayBzZXJ2aWNlcy5wYXNzd29yZC5lbnJvbGwudG9rZW4gZmllbGQgZm9yIGFmZmVjdGVkIHJlY29yZHNcbiAgICAgICAgICAgICAgaWYgKGlzRW5yb2xsKSB7XG4gICAgICAgICAgICAgICAgYWZmZWN0ZWRSZWNvcmRzID0gYXdhaXQgTWV0ZW9yLnVzZXJzLnVwZGF0ZUFzeW5jKFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBfaWQ6IHVzZXIuX2lkLFxuICAgICAgICAgICAgICAgICAgICAnZW1haWxzLmFkZHJlc3MnOiBlbWFpbCxcbiAgICAgICAgICAgICAgICAgICAgJ3NlcnZpY2VzLnBhc3N3b3JkLmVucm9sbC50b2tlbic6IHRva2VuXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAkc2V0OiB7XG4gICAgICAgICAgICAgICAgICAgICAgJ3NlcnZpY2VzLnBhc3N3b3JkLmJjcnlwdCc6IGhhc2hlZCxcbiAgICAgICAgICAgICAgICAgICAgICAnZW1haWxzLiQudmVyaWZpZWQnOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICR1bnNldDogeyAnc2VydmljZXMucGFzc3dvcmQuZW5yb2xsJzogMSB9XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhZmZlY3RlZFJlY29yZHMgPSBhd2FpdCBNZXRlb3IudXNlcnMudXBkYXRlQXN5bmMoXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIF9pZDogdXNlci5faWQsXG4gICAgICAgICAgICAgICAgICAgICdlbWFpbHMuYWRkcmVzcyc6IGVtYWlsLFxuICAgICAgICAgICAgICAgICAgICAnc2VydmljZXMucGFzc3dvcmQucmVzZXQudG9rZW4nOiB0b2tlblxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgJHNldDoge1xuICAgICAgICAgICAgICAgICAgICAgICdzZXJ2aWNlcy5wYXNzd29yZC5iY3J5cHQnOiBoYXNoZWQsXG4gICAgICAgICAgICAgICAgICAgICAgJ2VtYWlscy4kLnZlcmlmaWVkJzogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAkdW5zZXQ6IHsgJ3NlcnZpY2VzLnBhc3N3b3JkLnJlc2V0JzogMSB9XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoYWZmZWN0ZWRSZWNvcmRzICE9PSAxKVxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICB1c2VySWQ6IHVzZXIuX2lkLFxuICAgICAgICAgICAgICAgICAgZXJyb3I6IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIkludmFsaWQgZW1haWxcIilcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgIHJlc2V0VG9PbGRUb2tlbigpO1xuICAgICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFJlcGxhY2UgYWxsIHZhbGlkIGxvZ2luIHRva2VucyB3aXRoIG5ldyBvbmVzIChjaGFuZ2luZ1xuICAgICAgICAgICAgLy8gcGFzc3dvcmQgc2hvdWxkIGludmFsaWRhdGUgZXhpc3Rpbmcgc2Vzc2lvbnMpLlxuICAgICAgICAgICAgYXdhaXQgQWNjb3VudHMuX2NsZWFyQWxsTG9naW5Ub2tlbnModXNlci5faWQpO1xuXG4gICAgICAgICAgICBpZiAoQWNjb3VudHMuX2NoZWNrMmZhRW5hYmxlZD8uKHVzZXIpKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdXNlcklkOiB1c2VyLl9pZCxcbiAgICAgICAgICBlcnJvcjogQWNjb3VudHMuX2hhbmRsZUVycm9yKFxuICAgICAgICAgICAgJ0NoYW5nZWQgcGFzc3dvcmQsIGJ1dCB1c2VyIG5vdCBsb2dnZWQgaW4gYmVjYXVzZSAyRkEgaXMgZW5hYmxlZCcsXG4gICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAgICcyZmEtZW5hYmxlZCdcbiAgICAgICAgICApLFxuICAgICAgICB9O1xuICAgICAgfXJldHVybiB7IHVzZXJJZDogdXNlci5faWQgfTtcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICB9XG4gIH1cbik7XG5cbi8vL1xuLy8vIEVNQUlMIFZFUklGSUNBVElPTlxuLy8vXG5cblxuLy8gc2VuZCB0aGUgdXNlciBhbiBlbWFpbCB3aXRoIGEgbGluayB0aGF0IHdoZW4gb3BlbmVkIG1hcmtzIHRoYXRcbi8vIGFkZHJlc3MgYXMgdmVyaWZpZWRcblxuLyoqXG4gKiBAc3VtbWFyeSBTZW5kIGFuIGVtYWlsIGFzeW5jaHJvbm91c2x5IHdpdGggYSBsaW5rIHRoZSB1c2VyIGNhbiB1c2UgdmVyaWZ5IHRoZWlyIGVtYWlsIGFkZHJlc3MuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge1N0cmluZ30gdXNlcklkIFRoZSBpZCBvZiB0aGUgdXNlciB0byBzZW5kIGVtYWlsIHRvLlxuICogQHBhcmFtIHtTdHJpbmd9IFtlbWFpbF0gT3B0aW9uYWwuIFdoaWNoIGFkZHJlc3Mgb2YgdGhlIHVzZXIncyB0byBzZW5kIHRoZSBlbWFpbCB0by4gVGhpcyBhZGRyZXNzIG11c3QgYmUgaW4gdGhlIHVzZXIncyBgZW1haWxzYCBsaXN0LiBEZWZhdWx0cyB0byB0aGUgZmlyc3QgdW52ZXJpZmllZCBlbWFpbCBpbiB0aGUgbGlzdC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbZXh0cmFUb2tlbkRhdGFdIE9wdGlvbmFsIGFkZGl0aW9uYWwgZGF0YSB0byBiZSBhZGRlZCBpbnRvIHRoZSB0b2tlbiByZWNvcmQuXG4gKiBAcGFyYW0ge09iamVjdH0gW2V4dHJhUGFyYW1zXSBPcHRpb25hbCBhZGRpdGlvbmFsIHBhcmFtcyB0byBiZSBhZGRlZCB0byB0aGUgdmVyaWZpY2F0aW9uIHVybC5cbiAqIEByZXR1cm5zIHtQcm9taXNlPE9iamVjdD59IFByb21pc2Ugb2YgYW4gb2JqZWN0IHdpdGgge2VtYWlsLCB1c2VyLCB0b2tlbiwgdXJsLCBvcHRpb25zfSB2YWx1ZXMuXG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgYWNjb3VudHMtYmFzZVxuICovXG5BY2NvdW50cy5zZW5kVmVyaWZpY2F0aW9uRW1haWwgPVxuICBhc3luYyAodXNlcklkLCBlbWFpbCwgZXh0cmFUb2tlbkRhdGEsIGV4dHJhUGFyYW1zKSA9PiB7XG4gICAgLy8gWFhYIEFsc28gZ2VuZXJhdGUgYSBsaW5rIHVzaW5nIHdoaWNoIHNvbWVvbmUgY2FuIGRlbGV0ZSB0aGlzXG4gICAgLy8gYWNjb3VudCBpZiB0aGV5IG93biBzYWlkIGFkZHJlc3MgYnV0IHdlcmVuJ3QgdGhvc2Ugd2hvIGNyZWF0ZWRcbiAgICAvLyB0aGlzIGFjY291bnQuXG5cbiAgICBjb25zdCB7IGVtYWlsOiByZWFsRW1haWwsIHVzZXIsIHRva2VuIH0gPVxuICAgICAgYXdhaXQgQWNjb3VudHMuZ2VuZXJhdGVWZXJpZmljYXRpb25Ub2tlbih1c2VySWQsIGVtYWlsLCBleHRyYVRva2VuRGF0YSk7XG4gICAgY29uc3QgdXJsID0gQWNjb3VudHMudXJscy52ZXJpZnlFbWFpbCh0b2tlbiwgZXh0cmFQYXJhbXMpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBhd2FpdCBBY2NvdW50cy5nZW5lcmF0ZU9wdGlvbnNGb3JFbWFpbChyZWFsRW1haWwsIHVzZXIsIHVybCwgJ3ZlcmlmeUVtYWlsJyk7XG4gICAgYXdhaXQgRW1haWwuc2VuZEFzeW5jKG9wdGlvbnMpO1xuICAgIGlmIChNZXRlb3IuaXNEZXZlbG9wbWVudCkge1xuICAgICAgY29uc29sZS5sb2coYFxcblZlcmlmaWNhdGlvbiBlbWFpbCBVUkw6ICR7IHVybCB9YCk7XG4gICAgfVxuICAgIHJldHVybiB7IGVtYWlsOiByZWFsRW1haWwsIHVzZXIsIHRva2VuLCB1cmwsIG9wdGlvbnMgfTtcbiAgfTtcblxuLy8gVGFrZSB0b2tlbiBmcm9tIHNlbmRWZXJpZmljYXRpb25FbWFpbCwgbWFyayB0aGUgZW1haWwgYXMgdmVyaWZpZWQsXG4vLyBhbmQgbG9nIHRoZW0gaW4uXG5NZXRlb3IubWV0aG9kcyhcbiAge1xuICAgIHZlcmlmeUVtYWlsOiBhc3luYyBmdW5jdGlvbiAoLi4uYXJncykge1xuICAgICAgY29uc3QgdG9rZW4gPSBhcmdzWzBdO1xuICAgICAgcmV0dXJuIGF3YWl0IEFjY291bnRzLl9sb2dpbk1ldGhvZChcbiAgICAgICAgdGhpcyxcbiAgICAgICAgXCJ2ZXJpZnlFbWFpbFwiLFxuICAgICAgICBhcmdzLFxuICAgICAgICBcInBhc3N3b3JkXCIsXG4gICAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgICBjaGVjayh0b2tlbiwgU3RyaW5nKTtcblxuICAgICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNZXRlb3IudXNlcnMuZmluZE9uZUFzeW5jKFxuICAgICAgICAgICAgeyAnc2VydmljZXMuZW1haWwudmVyaWZpY2F0aW9uVG9rZW5zLnRva2VuJzogdG9rZW4gfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgZmllbGRzOiB7XG4gICAgICAgICAgICAgICAgc2VydmljZXM6IDEsXG4gICAgICAgICAgICAgICAgZW1haWxzOiAxLFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgKTtcbiAgICAgICAgICBpZiAoIXVzZXIpXG4gICAgICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJWZXJpZnkgZW1haWwgbGluayBleHBpcmVkXCIpO1xuXG4gICAgICAgICAgY29uc3QgdG9rZW5SZWNvcmQgPVxuICAgICAgICAgICAgYXdhaXQgdXNlclxuICAgICAgICAgICAgICAuc2VydmljZXMuZW1haWwudmVyaWZpY2F0aW9uVG9rZW5zLmZpbmQodCA9PiB0LnRva2VuID09IHRva2VuKTtcblxuICAgICAgICAgIGlmICghdG9rZW5SZWNvcmQpXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICB1c2VySWQ6IHVzZXIuX2lkLFxuICAgICAgICAgICAgICBlcnJvcjogbmV3IE1ldGVvci5FcnJvcig0MDMsIFwiVmVyaWZ5IGVtYWlsIGxpbmsgZXhwaXJlZFwiKVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgIGNvbnN0IGVtYWlsc1JlY29yZCA9XG4gICAgICAgICAgICB1c2VyLmVtYWlscy5maW5kKGUgPT4gZS5hZGRyZXNzID09IHRva2VuUmVjb3JkLmFkZHJlc3MpO1xuXG4gICAgICAgICAgaWYgKCFlbWFpbHNSZWNvcmQpXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICB1c2VySWQ6IHVzZXIuX2lkLFxuICAgICAgICAgICAgICBlcnJvcjogbmV3IE1ldGVvci5FcnJvcig0MDMsIFwiVmVyaWZ5IGVtYWlsIGxpbmsgaXMgZm9yIHVua25vd24gYWRkcmVzc1wiKVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIEJ5IGluY2x1ZGluZyB0aGUgYWRkcmVzcyBpbiB0aGUgcXVlcnksIHdlIGNhbiB1c2UgJ2VtYWlscy4kJyBpbiB0aGVcbiAgICAgICAgICAvLyBtb2RpZmllciB0byBnZXQgYSByZWZlcmVuY2UgdG8gdGhlIHNwZWNpZmljIG9iamVjdCBpbiB0aGUgZW1haWxzXG4gICAgICAgICAgLy8gYXJyYXkuIFNlZVxuICAgICAgICAgIC8vIGh0dHA6Ly93d3cubW9uZ29kYi5vcmcvZGlzcGxheS9ET0NTL1VwZGF0aW5nLyNVcGRhdGluZy1UaGUlMjRwb3NpdGlvbmFsb3BlcmF0b3IpXG4gICAgICAgICAgLy8gaHR0cDovL3d3dy5tb25nb2RiLm9yZy9kaXNwbGF5L0RPQ1MvVXBkYXRpbmcjVXBkYXRpbmctJTI0cHVsbFxuICAgICAgICAgIGF3YWl0IE1ldGVvci51c2Vycy51cGRhdGVBc3luYyhcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgX2lkOiB1c2VyLl9pZCxcbiAgICAgICAgICAgICAgJ2VtYWlscy5hZGRyZXNzJzogdG9rZW5SZWNvcmQuYWRkcmVzc1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgJHNldDogeyAnZW1haWxzLiQudmVyaWZpZWQnOiB0cnVlIH0sXG4gICAgICAgICAgICAgICRwdWxsOiB7ICdzZXJ2aWNlcy5lbWFpbC52ZXJpZmljYXRpb25Ub2tlbnMnOiB7IGFkZHJlc3M6IHRva2VuUmVjb3JkLmFkZHJlc3MgfSB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgIGlmIChBY2NvdW50cy5fY2hlY2syZmFFbmFibGVkPy4odXNlcikpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB1c2VySWQ6IHVzZXIuX2lkLFxuICAgICAgICAgIGVycm9yOiBBY2NvdW50cy5faGFuZGxlRXJyb3IoXG4gICAgICAgICAgICAnRW1haWwgdmVyaWZpZWQsIGJ1dCB1c2VyIG5vdCBsb2dnZWQgaW4gYmVjYXVzZSAyRkEgaXMgZW5hYmxlZCcsXG4gICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAgICcyZmEtZW5hYmxlZCdcbiAgICAgICAgICApLFxuICAgICAgICB9O1xuICAgICAgfXJldHVybiB7IHVzZXJJZDogdXNlci5faWQgfTtcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9XG4gIH0pO1xuXG4vKipcbiAqIEBzdW1tYXJ5IEFzeW5jaHJvbm91c2x5IGFkZCBhbiBlbWFpbCBhZGRyZXNzIGZvciBhIHVzZXIuIFVzZSB0aGlzIGluc3RlYWQgb2YgZGlyZWN0bHlcbiAqIHVwZGF0aW5nIHRoZSBkYXRhYmFzZS4gVGhlIG9wZXJhdGlvbiB3aWxsIGZhaWwgaWYgdGhlcmUgaXMgYSBkaWZmZXJlbnQgdXNlclxuICogd2l0aCBhbiBlbWFpbCBvbmx5IGRpZmZlcmluZyBpbiBjYXNlLiBJZiB0aGUgc3BlY2lmaWVkIHVzZXIgaGFzIGFuIGV4aXN0aW5nXG4gKiBlbWFpbCBvbmx5IGRpZmZlcmluZyBpbiBjYXNlIGhvd2V2ZXIsIHdlIHJlcGxhY2UgaXQuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge1N0cmluZ30gdXNlcklkIFRoZSBJRCBvZiB0aGUgdXNlciB0byB1cGRhdGUuXG4gKiBAcGFyYW0ge1N0cmluZ30gbmV3RW1haWwgQSBuZXcgZW1haWwgYWRkcmVzcyBmb3IgdGhlIHVzZXIuXG4gKiBAcGFyYW0ge0Jvb2xlYW59IFt2ZXJpZmllZF0gT3B0aW9uYWwgLSB3aGV0aGVyIHRoZSBuZXcgZW1haWwgYWRkcmVzcyBzaG91bGRcbiAqIGJlIG1hcmtlZCBhcyB2ZXJpZmllZC4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgYWNjb3VudHMtYmFzZVxuICovXG5BY2NvdW50cy5hZGRFbWFpbEFzeW5jID0gYXN5bmMgKHVzZXJJZCwgbmV3RW1haWwsIHZlcmlmaWVkKSA9PiB7XG4gIGNoZWNrKHVzZXJJZCwgTm9uRW1wdHlTdHJpbmcpO1xuICBjaGVjayhuZXdFbWFpbCwgTm9uRW1wdHlTdHJpbmcpO1xuICBjaGVjayh2ZXJpZmllZCwgTWF0Y2guT3B0aW9uYWwoQm9vbGVhbikpO1xuXG4gIGlmICh2ZXJpZmllZCA9PT0gdm9pZCAwKSB7XG4gICAgdmVyaWZpZWQgPSBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBnZXRVc2VyQnlJZCh1c2VySWQsIHsgZmllbGRzOiB7IGVtYWlsczogMSB9IH0pO1xuICBpZiAoIXVzZXIpIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIlVzZXIgbm90IGZvdW5kXCIpO1xuXG4gIC8vIEFsbG93IHVzZXJzIHRvIGNoYW5nZSB0aGVpciBvd24gZW1haWwgdG8gYSB2ZXJzaW9uIHdpdGggYSBkaWZmZXJlbnQgY2FzZVxuXG4gIC8vIFdlIGRvbid0IGhhdmUgdG8gY2FsbCBjaGVja0ZvckNhc2VJbnNlbnNpdGl2ZUR1cGxpY2F0ZXMgdG8gZG8gYSBjYXNlXG4gIC8vIGluc2Vuc2l0aXZlIGNoZWNrIGFjcm9zcyBhbGwgZW1haWxzIGluIHRoZSBkYXRhYmFzZSBoZXJlIGJlY2F1c2U6ICgxKSBpZlxuICAvLyB0aGVyZSBpcyBubyBjYXNlLWluc2Vuc2l0aXZlIGR1cGxpY2F0ZSBiZXR3ZWVuIHRoaXMgdXNlciBhbmQgb3RoZXIgdXNlcnMsXG4gIC8vIHRoZW4gd2UgYXJlIE9LIGFuZCAoMikgaWYgdGhpcyB3b3VsZCBjcmVhdGUgYSBjb25mbGljdCB3aXRoIG90aGVyIHVzZXJzXG4gIC8vIHRoZW4gdGhlcmUgd291bGQgYWxyZWFkeSBiZSBhIGNhc2UtaW5zZW5zaXRpdmUgZHVwbGljYXRlIGFuZCB3ZSBjYW4ndCBmaXhcbiAgLy8gdGhhdCBpbiB0aGlzIGNvZGUgYW55d2F5LlxuICBjb25zdCBjYXNlSW5zZW5zaXRpdmVSZWdFeHAgPSBuZXcgUmVnRXhwKFxuICAgIGBeJHtNZXRlb3IuX2VzY2FwZVJlZ0V4cChuZXdFbWFpbCl9JGAsXG4gICAgXCJpXCJcbiAgKTtcblxuICAvLyBUT0RPOiBUaGlzIGlzIGEgbGluZWFyIHNlYXJjaC4gSWYgd2UgaGF2ZSBhIGxvdCBvZiBlbWFpbHMuXG4gIC8vICB3ZSBzaG91bGQgY29uc2lkZXIgdXNpbmcgYSBkaWZmZXJlbnQgZGF0YSBzdHJ1Y3R1cmUuXG4gIGNvbnN0IHVwZGF0ZWRFbWFpbCA9IGFzeW5jIChlbWFpbHMgPSBbXSwgX2lkKSA9PiB7XG4gICAgbGV0IHVwZGF0ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGNvbnN0IGVtYWlsIG9mIGVtYWlscykge1xuICAgICAgaWYgKGNhc2VJbnNlbnNpdGl2ZVJlZ0V4cC50ZXN0KGVtYWlsLmFkZHJlc3MpKSB7XG4gICAgICAgIGF3YWl0IE1ldGVvci51c2Vycy51cGRhdGVBc3luYyhcbiAgICAgICAgICB7XG4gICAgICAgICAgICBfaWQ6IF9pZCxcbiAgICAgICAgICAgIFwiZW1haWxzLmFkZHJlc3NcIjogZW1haWwuYWRkcmVzcyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgICRzZXQ6IHtcbiAgICAgICAgICAgICAgXCJlbWFpbHMuJC5hZGRyZXNzXCI6IG5ld0VtYWlsLFxuICAgICAgICAgICAgICBcImVtYWlscy4kLnZlcmlmaWVkXCI6IHZlcmlmaWVkLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICAgIHVwZGF0ZWQgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdXBkYXRlZDtcbiAgfTtcbiAgY29uc3QgZGlkVXBkYXRlT3duRW1haWwgPSBhd2FpdCB1cGRhdGVkRW1haWwodXNlci5lbWFpbHMsIHVzZXIuX2lkKTtcblxuICAvLyBJbiB0aGUgb3RoZXIgdXBkYXRlcyBiZWxvdywgd2UgaGF2ZSB0byBkbyBhbm90aGVyIGNhbGwgdG9cbiAgLy8gY2hlY2tGb3JDYXNlSW5zZW5zaXRpdmVEdXBsaWNhdGVzIHRvIG1ha2Ugc3VyZSB0aGF0IG5vIGNvbmZsaWN0aW5nIHZhbHVlc1xuICAvLyB3ZXJlIGFkZGVkIHRvIHRoZSBkYXRhYmFzZSBpbiB0aGUgbWVhbnRpbWUuIFdlIGRvbid0IGhhdmUgdG8gZG8gdGhpcyBmb3JcbiAgLy8gdGhlIGNhc2Ugd2hlcmUgdGhlIHVzZXIgaXMgdXBkYXRpbmcgdGhlaXIgZW1haWwgYWRkcmVzcyB0byBvbmUgdGhhdCBpcyB0aGVcbiAgLy8gc2FtZSBhcyBiZWZvcmUsIGJ1dCBvbmx5IGRpZmZlcmVudCBiZWNhdXNlIG9mIGNhcGl0YWxpemF0aW9uLiBSZWFkIHRoZVxuICAvLyBiaWcgY29tbWVudCBhYm92ZSB0byB1bmRlcnN0YW5kIHdoeS5cblxuICBpZiAoZGlkVXBkYXRlT3duRW1haWwpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBQZXJmb3JtIGEgY2FzZSBpbnNlbnNpdGl2ZSBjaGVjayBmb3IgZHVwbGljYXRlcyBiZWZvcmUgdXBkYXRlXG4gIGF3YWl0IEFjY291bnRzLl9jaGVja0ZvckNhc2VJbnNlbnNpdGl2ZUR1cGxpY2F0ZXMoXG4gICAgXCJlbWFpbHMuYWRkcmVzc1wiLFxuICAgIFwiRW1haWxcIixcbiAgICBuZXdFbWFpbCxcbiAgICB1c2VyLl9pZFxuICApO1xuXG4gIGF3YWl0IE1ldGVvci51c2Vycy51cGRhdGVBc3luYyhcbiAgICB7XG4gICAgICBfaWQ6IHVzZXIuX2lkLFxuICAgIH0sXG4gICAge1xuICAgICAgJGFkZFRvU2V0OiB7XG4gICAgICAgIGVtYWlsczoge1xuICAgICAgICAgIGFkZHJlc3M6IG5ld0VtYWlsLFxuICAgICAgICAgIHZlcmlmaWVkOiB2ZXJpZmllZCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfVxuICApO1xuXG4gIC8vIFBlcmZvcm0gYW5vdGhlciBjaGVjayBhZnRlciB1cGRhdGUsIGluIGNhc2UgYSBtYXRjaGluZyB1c2VyIGhhcyBiZWVuXG4gIC8vIGluc2VydGVkIGluIHRoZSBtZWFudGltZVxuICB0cnkge1xuICAgIGF3YWl0IEFjY291bnRzLl9jaGVja0ZvckNhc2VJbnNlbnNpdGl2ZUR1cGxpY2F0ZXMoXG4gICAgICBcImVtYWlscy5hZGRyZXNzXCIsXG4gICAgICBcIkVtYWlsXCIsXG4gICAgICBuZXdFbWFpbCxcbiAgICAgIHVzZXIuX2lkXG4gICAgKTtcbiAgfSBjYXRjaCAoZXgpIHtcbiAgICAvLyBVbmRvIHVwZGF0ZSBpZiB0aGUgY2hlY2sgZmFpbHNcbiAgICBhd2FpdCBNZXRlb3IudXNlcnMudXBkYXRlQXN5bmMoXG4gICAgICB7IF9pZDogdXNlci5faWQgfSxcbiAgICAgIHsgJHB1bGw6IHsgZW1haWxzOiB7IGFkZHJlc3M6IG5ld0VtYWlsIH0gfSB9XG4gICAgKTtcbiAgICB0aHJvdyBleDtcbiAgfVxufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZW1vdmUgYW4gZW1haWwgYWRkcmVzcyBhc3luY2hyb25vdXNseSBmb3IgYSB1c2VyLiBVc2UgdGhpcyBpbnN0ZWFkIG9mIHVwZGF0aW5nXG4gKiB0aGUgZGF0YWJhc2UgZGlyZWN0bHkuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge1N0cmluZ30gdXNlcklkIFRoZSBJRCBvZiB0aGUgdXNlciB0byB1cGRhdGUuXG4gKiBAcGFyYW0ge1N0cmluZ30gZW1haWwgVGhlIGVtYWlsIGFkZHJlc3MgdG8gcmVtb3ZlLlxuICogQGltcG9ydEZyb21QYWNrYWdlIGFjY291bnRzLWJhc2VcbiAqL1xuQWNjb3VudHMucmVtb3ZlRW1haWwgPVxuICBhc3luYyAodXNlcklkLCBlbWFpbCkgPT4ge1xuICAgIGNoZWNrKHVzZXJJZCwgTm9uRW1wdHlTdHJpbmcpO1xuICAgIGNoZWNrKGVtYWlsLCBOb25FbXB0eVN0cmluZyk7XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgZ2V0VXNlckJ5SWQodXNlcklkLCB7IGZpZWxkczogeyBfaWQ6IDEgfSB9KTtcbiAgICBpZiAoIXVzZXIpXG4gICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJVc2VyIG5vdCBmb3VuZFwiKTtcblxuICAgIGF3YWl0IE1ldGVvci51c2Vycy51cGRhdGVBc3luYyh7IF9pZDogdXNlci5faWQgfSxcbiAgICAgIHsgJHB1bGw6IHsgZW1haWxzOiB7IGFkZHJlc3M6IGVtYWlsIH0gfSB9KTtcbiAgfVxuXG4vLy9cbi8vLyBDUkVBVElORyBVU0VSU1xuLy8vXG5cbi8vIFNoYXJlZCBjcmVhdGVVc2VyIGZ1bmN0aW9uIGNhbGxlZCBmcm9tIHRoZSBjcmVhdGVVc2VyIG1ldGhvZCwgYm90aFxuLy8gaWYgb3JpZ2luYXRlcyBpbiBjbGllbnQgb3Igc2VydmVyIGNvZGUuIENhbGxzIHVzZXIgcHJvdmlkZWQgaG9va3MsXG4vLyBkb2VzIHRoZSBhY3R1YWwgdXNlciBpbnNlcnRpb24uXG4vL1xuLy8gcmV0dXJucyB0aGUgdXNlciBpZFxuY29uc3QgY3JlYXRlVXNlciA9XG4gIGFzeW5jIG9wdGlvbnMgPT4ge1xuICAgIC8vIFVua25vd24ga2V5cyBhbGxvd2VkLCBiZWNhdXNlIGEgb25DcmVhdGVVc2VySG9vayBjYW4gdGFrZSBhcmJpdHJhcnlcbiAgICAvLyBvcHRpb25zLlxuICAgIGNoZWNrKG9wdGlvbnMsIE1hdGNoLk9iamVjdEluY2x1ZGluZyh7XG4gICAgICB1c2VybmFtZTogTWF0Y2guT3B0aW9uYWwoU3RyaW5nKSxcbiAgICAgIGVtYWlsOiBNYXRjaC5PcHRpb25hbChTdHJpbmcpLFxuICAgICAgcGFzc3dvcmQ6IE1hdGNoLk9wdGlvbmFsKHBhc3N3b3JkVmFsaWRhdG9yKVxuICAgIH0pKTtcblxuICAgIGNvbnN0IHsgdXNlcm5hbWUsIGVtYWlsLCBwYXNzd29yZCB9ID0gb3B0aW9ucztcbiAgICBpZiAoIXVzZXJuYW1lICYmICFlbWFpbClcbiAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAwLCBcIk5lZWQgdG8gc2V0IGEgdXNlcm5hbWUgb3IgZW1haWxcIik7XG5cbiAgICBjb25zdCB1c2VyID0geyBzZXJ2aWNlczoge30gfTtcbiAgICBpZiAocGFzc3dvcmQpIHtcbiAgICAgIGNvbnN0IGhhc2hlZCA9IGF3YWl0IGhhc2hQYXNzd29yZChwYXNzd29yZCk7XG4gICAgICB1c2VyLnNlcnZpY2VzLnBhc3N3b3JkID0geyBiY3J5cHQ6IGhhc2hlZCB9O1xuICAgIH1cblxuICAgIHJldHVybiBhd2FpdCBBY2NvdW50cy5fY3JlYXRlVXNlckNoZWNraW5nRHVwbGljYXRlcyh7IHVzZXIsIGVtYWlsLCB1c2VybmFtZSwgb3B0aW9ucyB9KTtcbiAgfTtcblxuLy8gbWV0aG9kIGZvciBjcmVhdGUgdXNlci4gUmVxdWVzdHMgY29tZSBmcm9tIHRoZSBjbGllbnQuXG5NZXRlb3IubWV0aG9kcyhcbiAge1xuICAgIGNyZWF0ZVVzZXI6IGFzeW5jIGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgICBjb25zdCBvcHRpb25zID0gYXJnc1swXTtcbiAgICAgIHJldHVybiBhd2FpdCBBY2NvdW50cy5fbG9naW5NZXRob2QoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIFwiY3JlYXRlVXNlclwiLFxuICAgICAgICBhcmdzLFxuICAgICAgICBcInBhc3N3b3JkXCIsXG4gICAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAvLyBjcmVhdGVVc2VyKCkgYWJvdmUgZG9lcyBtb3JlIGNoZWNraW5nLlxuICAgICAgICAgIGNoZWNrKG9wdGlvbnMsIE9iamVjdCk7XG4gICAgICAgICAgaWYgKEFjY291bnRzLl9vcHRpb25zLmZvcmJpZENsaWVudEFjY291bnRDcmVhdGlvbilcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIGVycm9yOiBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJTaWdudXBzIGZvcmJpZGRlblwiKVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgIGNvbnN0IHVzZXJJZCA9IGF3YWl0IEFjY291bnRzLmNyZWF0ZVVzZXJWZXJpZnlpbmdFbWFpbChvcHRpb25zKTtcblxuICAgICAgICAgIC8vIGNsaWVudCBnZXRzIGxvZ2dlZCBpbiBhcyB0aGUgbmV3IHVzZXIgYWZ0ZXJ3YXJkcy5cbiAgICAgICAgICByZXR1cm4geyB1c2VySWQ6IHVzZXJJZCB9O1xuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cbiAgfSk7XG5cbi8qKlxuICogQHN1bW1hcnkgQ3JlYXRlcyBhbiB1c2VyIGFzeW5jaHJvbm91c2x5IGFuZCBzZW5kcyBhbiBlbWFpbCBpZiBgb3B0aW9ucy5lbWFpbGAgaXMgaW5mb3JtZWQuXG4gKiBUaGVuIGlmIHRoZSBgc2VuZFZlcmlmaWNhdGlvbkVtYWlsYCBvcHRpb24gZnJvbSB0aGUgYEFjY291bnRzYCBwYWNrYWdlIGlzXG4gKiBlbmFibGVkLCB5b3UnbGwgc2VuZCBhIHZlcmlmaWNhdGlvbiBlbWFpbCBpZiBgb3B0aW9ucy5wYXNzd29yZGAgaXMgaW5mb3JtZWQsXG4gKiBvdGhlcndpc2UgeW91J2xsIHNlbmQgYW4gZW5yb2xsbWVudCBlbWFpbC5cbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIFRoZSBvcHRpb25zIG9iamVjdCB0byBiZSBwYXNzZWQgZG93biB3aGVuIGNyZWF0aW5nXG4gKiB0aGUgdXNlclxuICogQHBhcmFtIHtTdHJpbmd9IG9wdGlvbnMudXNlcm5hbWUgQSB1bmlxdWUgbmFtZSBmb3IgdGhpcyB1c2VyLlxuICogQHBhcmFtIHtTdHJpbmd9IG9wdGlvbnMuZW1haWwgVGhlIHVzZXIncyBlbWFpbCBhZGRyZXNzLlxuICogQHBhcmFtIHtTdHJpbmd9IG9wdGlvbnMucGFzc3dvcmQgVGhlIHVzZXIncyBwYXNzd29yZC4gVGhpcyBpcyBfX25vdF9fIHNlbnQgaW4gcGxhaW4gdGV4dCBvdmVyIHRoZSB3aXJlLlxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMucHJvZmlsZSBUaGUgdXNlcidzIHByb2ZpbGUsIHR5cGljYWxseSBpbmNsdWRpbmcgdGhlIGBuYW1lYCBmaWVsZC5cbiAqIEBpbXBvcnRGcm9tUGFja2FnZSBhY2NvdW50cy1iYXNlXG4gKiAqL1xuQWNjb3VudHMuY3JlYXRlVXNlclZlcmlmeWluZ0VtYWlsID1cbiAgYXN5bmMgKG9wdGlvbnMpID0+IHtcbiAgICBvcHRpb25zID0geyAuLi5vcHRpb25zIH07XG4gICAgLy8gQ3JlYXRlIHVzZXIuIHJlc3VsdCBjb250YWlucyBpZCBhbmQgdG9rZW4uXG4gICAgY29uc3QgdXNlcklkID0gYXdhaXQgY3JlYXRlVXNlcihvcHRpb25zKTtcbiAgICAvLyBzYWZldHkgYmVsdC4gY3JlYXRlVXNlciBpcyBzdXBwb3NlZCB0byB0aHJvdyBvbiBlcnJvci4gc2VuZCA1MDAgZXJyb3JcbiAgICAvLyBpbnN0ZWFkIG9mIHNlbmRpbmcgYSB2ZXJpZmljYXRpb24gZW1haWwgd2l0aCBlbXB0eSB1c2VyaWQuXG4gICAgaWYgKCF1c2VySWQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJjcmVhdGVVc2VyIGZhaWxlZCB0byBpbnNlcnQgbmV3IHVzZXJcIik7XG5cbiAgICAvLyBJZiBgQWNjb3VudHMuX29wdGlvbnMuc2VuZFZlcmlmaWNhdGlvbkVtYWlsYCBpcyBzZXQsIHJlZ2lzdGVyXG4gICAgLy8gYSB0b2tlbiB0byB2ZXJpZnkgdGhlIHVzZXIncyBwcmltYXJ5IGVtYWlsLCBhbmQgc2VuZCBpdCB0b1xuICAgIC8vIHRoYXQgYWRkcmVzcy5cbiAgICBpZiAob3B0aW9ucy5lbWFpbCAmJiBBY2NvdW50cy5fb3B0aW9ucy5zZW5kVmVyaWZpY2F0aW9uRW1haWwpIHtcbiAgICAgIGlmIChvcHRpb25zLnBhc3N3b3JkKSB7XG4gICAgICAgIGF3YWl0IEFjY291bnRzLnNlbmRWZXJpZmljYXRpb25FbWFpbCh1c2VySWQsIG9wdGlvbnMuZW1haWwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXdhaXQgQWNjb3VudHMuc2VuZEVucm9sbG1lbnRFbWFpbCh1c2VySWQsIG9wdGlvbnMuZW1haWwpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB1c2VySWQ7XG4gIH07XG5cbi8vIENyZWF0ZSB1c2VyIGRpcmVjdGx5IG9uIHRoZSBzZXJ2ZXIuXG4vL1xuLy8gVW5saWtlIHRoZSBjbGllbnQgdmVyc2lvbiwgdGhpcyBkb2VzIG5vdCBsb2cgeW91IGluIGFzIHRoaXMgdXNlclxuLy8gYWZ0ZXIgY3JlYXRpb24uXG4vL1xuLy8gcmV0dXJucyBQcm9taXNlPHVzZXJJZD4gb3IgdGhyb3dzIGFuIGVycm9yIGlmIGl0IGNhbid0IGNyZWF0ZVxuLy9cbi8vIFhYWCBhZGQgYW5vdGhlciBhcmd1bWVudCAoXCJzZXJ2ZXIgb3B0aW9uc1wiKSB0aGF0IGdldHMgc2VudCB0byBvbkNyZWF0ZVVzZXIsXG4vLyB3aGljaCBpcyBhbHdheXMgZW1wdHkgd2hlbiBjYWxsZWQgZnJvbSB0aGUgY3JlYXRlVXNlciBtZXRob2Q/IGVnLCBcImFkbWluOlxuLy8gdHJ1ZVwiLCB3aGljaCB3ZSB3YW50IHRvIHByZXZlbnQgdGhlIGNsaWVudCBmcm9tIHNldHRpbmcsIGJ1dCB3aGljaCBhIGN1c3RvbVxuLy8gbWV0aG9kIGNhbGxpbmcgQWNjb3VudHMuY3JlYXRlVXNlciBjb3VsZCBzZXQ/XG4vL1xuXG5BY2NvdW50cy5jcmVhdGVVc2VyQXN5bmMgPSBjcmVhdGVVc2VyXG5cbi8vIENyZWF0ZSB1c2VyIGRpcmVjdGx5IG9uIHRoZSBzZXJ2ZXIuXG4vL1xuLy8gVW5saWtlIHRoZSBjbGllbnQgdmVyc2lvbiwgdGhpcyBkb2VzIG5vdCBsb2cgeW91IGluIGFzIHRoaXMgdXNlclxuLy8gYWZ0ZXIgY3JlYXRpb24uXG4vL1xuLy8gcmV0dXJucyB1c2VySWQgb3IgdGhyb3dzIGFuIGVycm9yIGlmIGl0IGNhbid0IGNyZWF0ZVxuLy9cbi8vIFhYWCBhZGQgYW5vdGhlciBhcmd1bWVudCAoXCJzZXJ2ZXIgb3B0aW9uc1wiKSB0aGF0IGdldHMgc2VudCB0byBvbkNyZWF0ZVVzZXIsXG4vLyB3aGljaCBpcyBhbHdheXMgZW1wdHkgd2hlbiBjYWxsZWQgZnJvbSB0aGUgY3JlYXRlVXNlciBtZXRob2Q/IGVnLCBcImFkbWluOlxuLy8gdHJ1ZVwiLCB3aGljaCB3ZSB3YW50IHRvIHByZXZlbnQgdGhlIGNsaWVudCBmcm9tIHNldHRpbmcsIGJ1dCB3aGljaCBhIGN1c3RvbVxuLy8gbWV0aG9kIGNhbGxpbmcgQWNjb3VudHMuY3JlYXRlVXNlciBjb3VsZCBzZXQ/XG4vL1xuXG5BY2NvdW50cy5jcmVhdGVVc2VyID0gQWNjb3VudHMuY3JlYXRlVXNlckFzeW5jO1xuXG4vLy9cbi8vLyBQQVNTV09SRC1TUEVDSUZJQyBJTkRFWEVTIE9OIFVTRVJTXG4vLy9cbmF3YWl0IE1ldGVvci51c2Vycy5jcmVhdGVJbmRleEFzeW5jKCdzZXJ2aWNlcy5lbWFpbC52ZXJpZmljYXRpb25Ub2tlbnMudG9rZW4nLFxuICB7IHVuaXF1ZTogdHJ1ZSwgc3BhcnNlOiB0cnVlIH0pO1xuYXdhaXQgTWV0ZW9yLnVzZXJzLmNyZWF0ZUluZGV4QXN5bmMoJ3NlcnZpY2VzLnBhc3N3b3JkLnJlc2V0LnRva2VuJyxcbiAgeyB1bmlxdWU6IHRydWUsIHNwYXJzZTogdHJ1ZSB9KTtcbmF3YWl0IE1ldGVvci51c2Vycy5jcmVhdGVJbmRleEFzeW5jKCdzZXJ2aWNlcy5wYXNzd29yZC5lbnJvbGwudG9rZW4nLFxuICB7IHVuaXF1ZTogdHJ1ZSwgc3BhcnNlOiB0cnVlIH0pO1xuXG4iXX0=
