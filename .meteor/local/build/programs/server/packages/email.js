Package["core-runtime"].queue("email",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var Log = Package.logging.Log;
var Hook = Package['callback-hook'].Hook;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var Email, EmailInternals, EmailTest;

var require = meteorInstall({"node_modules":{"meteor":{"email":{"email.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/email/email.js                                                                                            //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
    module1.export({
      Email: () => Email,
      EmailTest: () => EmailTest,
      EmailInternals: () => EmailInternals
    });
    let Meteor;
    module1.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 0);
    let Log;
    module1.link("meteor/logging", {
      Log(v) {
        Log = v;
      }
    }, 1);
    let Hook;
    module1.link("meteor/callback-hook", {
      Hook(v) {
        Hook = v;
      }
    }, 2);
    let url;
    module1.link("url", {
      default(v) {
        url = v;
      }
    }, 3);
    let nodemailer;
    module1.link("nodemailer", {
      default(v) {
        nodemailer = v;
      }
    }, 4);
    let wellKnow;
    module1.link("nodemailer/lib/well-known", {
      default(v) {
        wellKnow = v;
      }
    }, 5);
    let openpgpEncrypt;
    module1.link("nodemailer-openpgp", {
      openpgpEncrypt(v) {
        openpgpEncrypt = v;
      }
    }, 6);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const Email = {};
    const EmailTest = {};
    const EmailInternals = {
      NpmModules: {
        mailcomposer: {
          version: Npm.require('nodemailer/package.json').version,
          module: Npm.require('nodemailer/lib/mail-composer')
        },
        nodemailer: {
          version: Npm.require('nodemailer/package.json').version,
          module: Npm.require('nodemailer')
        }
      }
    };
    const MailComposer = EmailInternals.NpmModules.mailcomposer.module;
    const makeTransport = function (mailUrlString, options) {
      const mailUrl = new URL(mailUrlString);
      if (mailUrl.protocol !== 'smtp:' && mailUrl.protocol !== 'smtps:') {
        throw new Error('Email protocol in $MAIL_URL (' + mailUrlString + ") must be 'smtp' or 'smtps'");
      }
      if (mailUrl.protocol === 'smtp:' && mailUrl.port === '465') {
        Log.debug("The $MAIL_URL is 'smtp://...:465'.  " + "You probably want 'smtps://' (The 's' enables TLS/SSL) " + "since '465' is typically a secure port.");
      }

      // Allow overriding pool setting, but default to true.
      if (!mailUrl.query) {
        mailUrl.query = {};
      }
      if (!mailUrl.query.pool) {
        mailUrl.query.pool = 'true';
      }
      const transport = nodemailer.createTransport(url.format(mailUrl));
      if (options !== null && options !== void 0 && options.encryptionKeys || options !== null && options !== void 0 && options.shouldSign) {
        transport.use('stream', openpgpEncrypt(options));
      }
      return transport;
    };

    // More info: https://nodemailer.com/smtp/well-known/
    const knownHostsTransport = function () {
      let settings = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : undefined;
      let url = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : undefined;
      let options = arguments.length > 2 ? arguments[2] : undefined;
      let service, user, password;
      const hasSettings = settings && Object.keys(settings).length;
      if (url && !hasSettings) {
        let host = url.split(':')[0];
        const urlObject = new URL(url);
        if (host === 'http' || host === 'https') {
          // Look to hostname for service
          host = urlObject.hostname;
          user = urlObject.username;
          password = urlObject.password;
        } else if (urlObject.protocol && urlObject.username && urlObject.password) {
          // We have some data from urlObject
          host = urlObject.protocol.split(':')[0];
          user = urlObject.username;
          password = urlObject.password;
        } else {
          var _urlObject$pathname$s;
          // We need to disect the URL ourselves to get the data
          // First get rid of the leading '//' and split to username and the rest
          const temp = (_urlObject$pathname$s = urlObject.pathname.substring(2)) === null || _urlObject$pathname$s === void 0 ? void 0 : _urlObject$pathname$s.split(':');
          user = temp[0];
          // Now we split by '@' to get password and hostname
          const temp2 = temp[1].split('@');
          password = temp2[0];
          host = temp2[1];
        }
        service = host;
      }
      if (!wellKnow((settings === null || settings === void 0 ? void 0 : settings.service) || service)) {
        throw new Error('Could not recognize e-mail service. See list at https://nodemailer.com/smtp/well-known/ for services that we can configure for you.');
      }
      const transport = nodemailer.createTransport({
        service: (settings === null || settings === void 0 ? void 0 : settings.service) || service,
        auth: {
          user: (settings === null || settings === void 0 ? void 0 : settings.user) || user,
          pass: (settings === null || settings === void 0 ? void 0 : settings.password) || password
        }
      });
      if (options !== null && options !== void 0 && options.encryptionKeys || options !== null && options !== void 0 && options.shouldSign) {
        transport.use('stream', openpgpEncrypt(options));
      }
      return transport;
    };
    EmailTest.knowHostsTransport = knownHostsTransport;
    const getTransport = function (options) {
      var _Meteor$settings$pack;
      const packageSettings = ((_Meteor$settings$pack = Meteor.settings.packages) === null || _Meteor$settings$pack === void 0 ? void 0 : _Meteor$settings$pack.email) || {};
      // We delay this check until the first call to Email.send, in case someone
      // set process.env.MAIL_URL in startup code. Then we store in a cache until
      // process.env.MAIL_URL changes.
      const url = process.env.MAIL_URL;
      if (globalThis.cacheKey === undefined || globalThis.cacheKey !== url || globalThis.cacheKey !== packageSettings.service || globalThis.cacheKey !== 'settings') {
        if (packageSettings.service && wellKnow(packageSettings.service) || url && wellKnow(new URL(url).hostname) || wellKnow((url === null || url === void 0 ? void 0 : url.split(':')[0]) || '')) {
          globalThis.cacheKey = packageSettings.service || 'settings';
          globalThis.cache = knownHostsTransport(packageSettings, url, options);
        } else {
          globalThis.cacheKey = url;
          globalThis.cache = url ? makeTransport(url, options) : null;
        }
      }
      return globalThis.cache;
    };
    let nextDevModeMailId = 0;
    EmailTest._getAndIncNextDevModeMailId = function () {
      return nextDevModeMailId++;
    };

    // Testing hooks
    EmailTest.resetNextDevModeMailId = function () {
      nextDevModeMailId = 0;
    };
    const devModeSendAsync = function (mail, options) {
      const stream = (options === null || options === void 0 ? void 0 : options.stream) || process.stdout;
      return new Promise((resolve, reject) => {
        let devModeMailId = EmailTest._getAndIncNextDevModeMailId();

        // This approach does not prevent other writers to stdout from interleaving.
        const output = ['====== BEGIN MAIL #' + devModeMailId + ' ======\n'];
        output.push('(Mail not sent; to enable sending, set the MAIL_URL ' + 'environment variable.)\n');
        const readStream = new MailComposer(mail).compile().createReadStream();
        readStream.on('data', buffer => {
          output.push(buffer.toString());
        });
        readStream.on('end', function () {
          output.push('====== END MAIL #' + devModeMailId + ' ======\n');
          stream.write(output.join(''), () => resolve());
        });
        readStream.on('error', err => reject(err));
      });
    };
    const sendHooks = new Hook();

    /**
     * @summary Hook that runs before email is sent.
     * @locus Server
     *
     * @param f {function} receives the arguments to Email.send and should return true to go
     * ahead and send the email (or at least, try subsequent hooks), or
     * false to skip sending.
     * @returns {{ stop: function, callback: function }}
     */
    Email.hookSend = function (f) {
      return sendHooks.register(f);
    };

    /**
     * @summary Overrides sending function with your own.
     * @locus Server
     * @since 2.2
     * @param f {function} function that will receive options from the send function and under `packageSettings` will
     * include the package settings from Meteor.settings.packages.email for your custom transport to access.
     */
    Email.customTransport = undefined;

    /**
     * @summary Send an email with asyncronous method. Capture  Throws an `Error` on failure to contact mail server
     * or if mail server returns an error. All fields should match
     * [RFC5322](http://tools.ietf.org/html/rfc5322) specification.
     *
     * If the `MAIL_URL` environment variable is set, actually sends the email.
     * Otherwise, prints the contents of the email to standard out.
     *
     * Note that this package is based on **nodemailer**, so make sure to refer to
     * [the documentation](http://nodemailer.com/)
     * when using the `attachments` or `mailComposer` options.
     *
     * @locus Server
     * @return {Promise}
     * @param {Object} options
     * @param {String} options.from "From:" address (required)
     * @param {String|String[]} options.to,cc,bcc,replyTo
     *   "To:", "Cc:", "Bcc:", and "Reply-To:" addresses
     * @param {String} [options.inReplyTo] Message-ID this message is replying to
     * @param {String|String[]} [options.references] Array (or space-separated string) of Message-IDs to refer to
     * @param {String} [options.messageId] Message-ID for this message; otherwise, will be set to a random value
     * @param {String} [options.subject]  "Subject:" line
     * @param {String} [options.text|html] Mail body (in plain text and/or HTML)
     * @param {String} [options.watchHtml] Mail body in HTML specific for Apple Watch
     * @param {String} [options.icalEvent] iCalendar event attachment
     * @param {Object} [options.headers] Dictionary of custom headers - e.g. `{ "header name": "header value" }`. To set an object under a header name, use `JSON.stringify` - e.g. `{ "header name": JSON.stringify({ tracking: { level: 'full' } }) }`.
     * @param {Object[]} [options.attachments] Array of attachment objects, as
     * described in the [nodemailer documentation](https://nodemailer.com/message/attachments/).
     * @param {MailComposer} [options.mailComposer] A [MailComposer](https://nodemailer.com/extras/mailcomposer/#e-mail-message-fields)
     * object representing the message to be sent.  Overrides all other options.
     * You can create a `MailComposer` object via
     * `new EmailInternals.NpmModules.mailcomposer.module`.
     */
    Email.sendAsync = async function (options) {
      var _Meteor$settings$pack3;
      const email = options.mailComposer ? options.mailComposer.mail : options;
      let send = true;
      await sendHooks.forEachAsync(async sendHook => {
        send = await sendHook(email);
        return send;
      });
      if (!send) {
        return;
      }
      if (Email.customTransport) {
        var _Meteor$settings$pack2;
        const packageSettings = ((_Meteor$settings$pack2 = Meteor.settings.packages) === null || _Meteor$settings$pack2 === void 0 ? void 0 : _Meteor$settings$pack2.email) || {};
        return Email.customTransport(_objectSpread({
          packageSettings
        }, email));
      }
      const mailUrlEnv = process.env.MAIL_URL;
      const mailUrlSettings = (_Meteor$settings$pack3 = Meteor.settings.packages) === null || _Meteor$settings$pack3 === void 0 ? void 0 : _Meteor$settings$pack3.email;
      if (Meteor.isProduction && !mailUrlEnv && !mailUrlSettings) {
        // This check is mostly necessary when using the flag --production when running locally.
        // And it works as a reminder to properly set the mail URL when running locally.
        throw new Error('You have not provided a mail URL. You can provide it by using the environment variable MAIL_URL or your settings. You can read more about it here: https://docs.meteor.com/api/email.html.');
      }
      if (mailUrlEnv || mailUrlSettings) {
        return getTransport().sendMail(email);
      }
      return devModeSendAsync(email, options);
    };

    /**
     * @deprecated
     * @summary Send an email with asyncronous method. Capture  Throws an `Error` on failure to contact mail server
     * or if mail server returns an error. All fields should match
     * [RFC5322](http://tools.ietf.org/html/rfc5322) specification.
     *
     * If the `MAIL_URL` environment variable is set, actually sends the email.
     * Otherwise, prints the contents of the email to standard out.
     *
     * Note that this package is based on **nodemailer**, so make sure to refer to
     * [the documentation](http://nodemailer.com/)
     * when using the `attachments` or `mailComposer` options.
     *
     * @locus Server
     * @return {Promise}
     * @param {Object} options
     * @param {String} options.from "From:" address (required)
     * @param {String|String[]} options.to,cc,bcc,replyTo
     *   "To:", "Cc:", "Bcc:", and "Reply-To:" addresses
     * @param {String} [options.inReplyTo] Message-ID this message is replying to
     * @param {String|String[]} [options.references] Array (or space-separated string) of Message-IDs to refer to
     * @param {String} [options.messageId] Message-ID for this message; otherwise, will be set to a random value
     * @param {String} [options.subject]  "Subject:" line
     * @param {String} [options.text|html] Mail body (in plain text and/or HTML)
     * @param {String} [options.watchHtml] Mail body in HTML specific for Apple Watch
     * @param {String} [options.icalEvent] iCalendar event attachment
     * @param {Object} [options.headers] Dictionary of custom headers - e.g. `{ "header name": "header value" }`. To set an object under a header name, use `JSON.stringify` - e.g. `{ "header name": JSON.stringify({ tracking: { level: 'full' } }) }`.
     * @param {Object[]} [options.attachments] Array of attachment objects, as
     * described in the [nodemailer documentation](https://nodemailer.com/message/attachments/).
     * @param {MailComposer} [options.mailComposer] A [MailComposer](https://nodemailer.com/extras/mailcomposer/#e-mail-message-fields)
     * object representing the message to be sent.  Overrides all other options.
     * You can create a `MailComposer` object via
     * `new EmailInternals.NpmModules.mailcomposer.module`.
     * @param {String} [options.encryptionKeys] An array that holds the public keys used to encrypt.
     * @param {String} [options.shouldSign] Enables you to allow or disallow email signing.
    */
    Email.send = function (options) {
      Email.sendAsync(options).then(() => console.warn("Email.send is no longer recommended, you should use Email.sendAsync")).catch(e => console.error("Email.send is no longer recommended and an error happened", e));
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
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"nodemailer":{"package.json":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// node_modules/meteor/email/node_modules/nodemailer/package.json                                                     //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.exports = {
  "name": "nodemailer",
  "version": "6.9.10",
  "main": "lib/nodemailer.js"
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"lib":{"nodemailer.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// node_modules/meteor/email/node_modules/nodemailer/lib/nodemailer.js                                                //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.useNode();
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"well-known":{"index.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// node_modules/meteor/email/node_modules/nodemailer/lib/well-known/index.js                                          //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.useNode();
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}},"nodemailer-openpgp":{"package.json":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// node_modules/meteor/email/node_modules/nodemailer-openpgp/package.json                                             //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.exports = {
  "name": "nodemailer-openpgp",
  "version": "2.2.0",
  "main": "lib/nodemailer-openpgp"
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"lib":{"nodemailer-openpgp.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// node_modules/meteor/email/node_modules/nodemailer-openpgp/lib/nodemailer-openpgp.js                                //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.useNode();
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      Email: Email,
      EmailInternals: EmailInternals,
      EmailTest: EmailTest
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/email/email.js"
  ],
  mainModulePath: "/node_modules/meteor/email/email.js"
}});

//# sourceURL=meteor://💻app/packages/email.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZW1haWwvZW1haWwuanMiXSwibmFtZXMiOlsiX29iamVjdFNwcmVhZCIsIm1vZHVsZTEiLCJsaW5rIiwiZGVmYXVsdCIsInYiLCJleHBvcnQiLCJFbWFpbCIsIkVtYWlsVGVzdCIsIkVtYWlsSW50ZXJuYWxzIiwiTWV0ZW9yIiwiTG9nIiwiSG9vayIsInVybCIsIm5vZGVtYWlsZXIiLCJ3ZWxsS25vdyIsIm9wZW5wZ3BFbmNyeXB0IiwiX19yZWlmeVdhaXRGb3JEZXBzX18iLCJOcG1Nb2R1bGVzIiwibWFpbGNvbXBvc2VyIiwidmVyc2lvbiIsIk5wbSIsInJlcXVpcmUiLCJtb2R1bGUiLCJNYWlsQ29tcG9zZXIiLCJtYWtlVHJhbnNwb3J0IiwibWFpbFVybFN0cmluZyIsIm9wdGlvbnMiLCJtYWlsVXJsIiwiVVJMIiwicHJvdG9jb2wiLCJFcnJvciIsInBvcnQiLCJkZWJ1ZyIsInF1ZXJ5IiwicG9vbCIsInRyYW5zcG9ydCIsImNyZWF0ZVRyYW5zcG9ydCIsImZvcm1hdCIsImVuY3J5cHRpb25LZXlzIiwic2hvdWxkU2lnbiIsInVzZSIsImtub3duSG9zdHNUcmFuc3BvcnQiLCJzZXR0aW5ncyIsImFyZ3VtZW50cyIsImxlbmd0aCIsInVuZGVmaW5lZCIsInNlcnZpY2UiLCJ1c2VyIiwicGFzc3dvcmQiLCJoYXNTZXR0aW5ncyIsIk9iamVjdCIsImtleXMiLCJob3N0Iiwic3BsaXQiLCJ1cmxPYmplY3QiLCJob3N0bmFtZSIsInVzZXJuYW1lIiwiX3VybE9iamVjdCRwYXRobmFtZSRzIiwidGVtcCIsInBhdGhuYW1lIiwic3Vic3RyaW5nIiwidGVtcDIiLCJhdXRoIiwicGFzcyIsImtub3dIb3N0c1RyYW5zcG9ydCIsImdldFRyYW5zcG9ydCIsIl9NZXRlb3Ikc2V0dGluZ3MkcGFjayIsInBhY2thZ2VTZXR0aW5ncyIsInBhY2thZ2VzIiwiZW1haWwiLCJwcm9jZXNzIiwiZW52IiwiTUFJTF9VUkwiLCJnbG9iYWxUaGlzIiwiY2FjaGVLZXkiLCJjYWNoZSIsIm5leHREZXZNb2RlTWFpbElkIiwiX2dldEFuZEluY05leHREZXZNb2RlTWFpbElkIiwicmVzZXROZXh0RGV2TW9kZU1haWxJZCIsImRldk1vZGVTZW5kQXN5bmMiLCJtYWlsIiwic3RyZWFtIiwic3Rkb3V0IiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJkZXZNb2RlTWFpbElkIiwib3V0cHV0IiwicHVzaCIsInJlYWRTdHJlYW0iLCJjb21waWxlIiwiY3JlYXRlUmVhZFN0cmVhbSIsIm9uIiwiYnVmZmVyIiwidG9TdHJpbmciLCJ3cml0ZSIsImpvaW4iLCJlcnIiLCJzZW5kSG9va3MiLCJob29rU2VuZCIsImYiLCJyZWdpc3RlciIsImN1c3RvbVRyYW5zcG9ydCIsInNlbmRBc3luYyIsIl9NZXRlb3Ikc2V0dGluZ3MkcGFjazMiLCJtYWlsQ29tcG9zZXIiLCJzZW5kIiwiZm9yRWFjaEFzeW5jIiwic2VuZEhvb2siLCJfTWV0ZW9yJHNldHRpbmdzJHBhY2syIiwibWFpbFVybEVudiIsIm1haWxVcmxTZXR0aW5ncyIsImlzUHJvZHVjdGlvbiIsInNlbmRNYWlsIiwidGhlbiIsImNvbnNvbGUiLCJ3YXJuIiwiY2F0Y2giLCJlIiwiZXJyb3IiLCJfX3JlaWZ5X2FzeW5jX3Jlc3VsdF9fIiwiX3JlaWZ5RXJyb3IiLCJzZWxmIiwiYXN5bmMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFBQSxJQUFJQSxhQUFhO0lBQUNDLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLHNDQUFzQyxFQUFDO01BQUNDLE9BQU9BLENBQUNDLENBQUMsRUFBQztRQUFDSixhQUFhLEdBQUNJLENBQUM7TUFBQTtJQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBdEdILE9BQU8sQ0FBQ0ksTUFBTSxDQUFDO01BQUNDLEtBQUssRUFBQ0EsQ0FBQSxLQUFJQSxLQUFLO01BQUNDLFNBQVMsRUFBQ0EsQ0FBQSxLQUFJQSxTQUFTO01BQUNDLGNBQWMsRUFBQ0Es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LEdBQUcsVUFBU2hGLE9BQU8sRUFBRTtNQUM3QnBCLEtBQUssQ0FBQ2lHLFNBQVMsQ0FBQzdFLE9BQU8sQ0FBQyxDQUNyQndGLElBQUksQ0FBQyxNQUNKQyxPQUFPLENBQUNDLElBQUksc0VBRVosQ0FDRixDQUFDLENBQ0FDLEtBQUssQ0FBQ0MsQ0FBQyxJQUNOSCxPQUFPLENBQUNJLEtBQUssOERBRVhELENBQ0YsQ0FDRixDQUFDO0lBQ0wsQ0FBQztJQUFDRSxzQkFBQTtFQUFBLFNBQUFDLFdBQUE7SUFBQSxPQUFBRCxzQkFBQSxDQUFBQyxXQUFBO0VBQUE7RUFBQUQsc0JBQUE7QUFBQTtFQUFBRSxJQUFBO0VBQUFDLEtBQUE7QUFBQSxHIiwiZmlsZSI6Ii9wYWNrYWdlcy9lbWFpbC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuaW1wb3J0IHsgTG9nIH0gZnJvbSAnbWV0ZW9yL2xvZ2dpbmcnO1xuaW1wb3J0IHsgSG9vayB9IGZyb20gJ21ldGVvci9jYWxsYmFjay1ob29rJztcblxuaW1wb3J0IHVybCBmcm9tICd1cmwnO1xuaW1wb3J0IG5vZGVtYWlsZXIgZnJvbSAnbm9kZW1haWxlcic7XG5pbXBvcnQgd2VsbEtub3cgZnJvbSAnbm9kZW1haWxlci9saWIvd2VsbC1rbm93bic7XG5pbXBvcnQgeyBvcGVucGdwRW5jcnlwdCB9IGZyb20gJ25vZGVtYWlsZXItb3BlbnBncCc7XG5cbmV4cG9ydCBjb25zdCBFbWFpbCA9IHt9O1xuZXhwb3J0IGNvbnN0IEVtYWlsVGVzdCA9IHt9O1xuXG5leHBvcnQgY29uc3QgRW1haWxJbnRlcm5hbHMgPSB7XG4gIE5wbU1vZHVsZXM6IHtcbiAgICBtYWlsY29tcG9zZXI6IHtcbiAgICAgIHZlcnNpb246IE5wbS5yZXF1aXJlKCdub2RlbWFpbGVyL3BhY2thZ2UuanNvbicpLnZlcnNpb24sXG4gICAgICBtb2R1bGU6IE5wbS5yZXF1aXJlKCdub2RlbWFpbGVyL2xpYi9tYWlsLWNvbXBvc2VyJyksXG4gICAgfSxcbiAgICBub2RlbWFpbGVyOiB7XG4gICAgICB2ZXJzaW9uOiBOcG0ucmVxdWlyZSgnbm9kZW1haWxlci9wYWNrYWdlLmpzb24nKS52ZXJzaW9uLFxuICAgICAgbW9kdWxlOiBOcG0ucmVxdWlyZSgnbm9kZW1haWxlcicpLFxuICAgIH0sXG4gIH0sXG59O1xuXG5jb25zdCBNYWlsQ29tcG9zZXIgPSBFbWFpbEludGVybmFscy5OcG1Nb2R1bGVzLm1haWxjb21wb3Nlci5tb2R1bGU7XG5cbmNvbnN0IG1ha2VUcmFuc3BvcnQgPSBmdW5jdGlvbiAobWFpbFVybFN0cmluZywgb3B0aW9ucykge1xuICBjb25zdCBtYWlsVXJsID0gbmV3IFVSTChtYWlsVXJsU3RyaW5nKTtcblxuICBpZiAobWFpbFVybC5wcm90b2NvbCAhPT0gJ3NtdHA6JyAmJiBtYWlsVXJsLnByb3RvY29sICE9PSAnc210cHM6Jykge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICdFbWFpbCBwcm90b2NvbCBpbiAkTUFJTF9VUkwgKCcgK1xuICAgICAgICBtYWlsVXJsU3RyaW5nICtcbiAgICAgICAgXCIpIG11c3QgYmUgJ3NtdHAnIG9yICdzbXRwcydcIlxuICAgICk7XG4gIH1cblxuICBpZiAobWFpbFVybC5wcm90b2NvbCA9PT0gJ3NtdHA6JyAmJiBtYWlsVXJsLnBvcnQgPT09ICc0NjUnKSB7XG4gICAgTG9nLmRlYnVnKFxuICAgICAgXCJUaGUgJE1BSUxfVVJMIGlzICdzbXRwOi8vLi4uOjQ2NScuICBcIiArXG4gICAgICAgIFwiWW91IHByb2JhYmx5IHdhbnQgJ3NtdHBzOi8vJyAoVGhlICdzJyBlbmFibGVzIFRMUy9TU0wpIFwiICtcbiAgICAgICAgXCJzaW5jZSAnNDY1JyBpcyB0eXBpY2FsbHkgYSBzZWN1cmUgcG9ydC5cIlxuICAgICk7XG4gIH1cblxuICAvLyBBbGxvdyBvdmVycmlkaW5nIHBvb2wgc2V0dGluZywgYnV0IGRlZmF1bHQgdG8gdHJ1ZS5cbiAgaWYgKCFtYWlsVXJsLnF1ZXJ5KSB7XG4gICAgbWFpbFVybC5xdWVyeSA9IHt9O1xuICB9XG5cbiAgaWYgKCFtYWlsVXJsLnF1ZXJ5LnBvb2wpIHtcbiAgICBtYWlsVXJsLnF1ZXJ5LnBvb2wgPSAndHJ1ZSc7XG4gIH1cblxuICBjb25zdCB0cmFuc3BvcnQgPSBub2RlbWFpbGVyLmNyZWF0ZVRyYW5zcG9ydCh1cmwuZm9ybWF0KG1haWxVcmwpKTtcbiAgaWYgKG9wdGlvbnM/LmVuY3J5cHRpb25LZXlzIHx8IG9wdGlvbnM/LnNob3VsZFNpZ24pIHtcbiAgICB0cmFuc3BvcnQudXNlKCdzdHJlYW0nLCBvcGVucGdwRW5jcnlwdChvcHRpb25zKSk7XG4gIH1cbiAgcmV0dXJuIHRyYW5zcG9ydDtcbn07XG5cbi8vIE1vcmUgaW5mbzogaHR0cHM6Ly9ub2RlbWFpbGVyLmNvbS9zbXRwL3dlbGwta25vd24vXG5jb25zdCBrbm93bkhvc3RzVHJhbnNwb3J0ID0gZnVuY3Rpb24gKHNldHRpbmdzID0gdW5kZWZpbmVkLCB1cmwgPSB1bmRlZmluZWQsIG9wdGlvbnMpIHtcbiAgbGV0IHNlcnZpY2UsIHVzZXIsIHBhc3N3b3JkO1xuXG4gIGNvbnN0IGhhc1NldHRpbmdzID0gc2V0dGluZ3MgJiYgT2JqZWN0LmtleXMoc2V0dGluZ3MpLmxlbmd0aDtcblxuICBpZiAodXJsICYmICFoYXNTZXR0aW5ncykge1xuICAgIGxldCBob3N0ID0gdXJsLnNwbGl0KCc6JylbMF07XG4gICAgY29uc3QgdXJsT2JqZWN0ID0gbmV3IFVSTCh1cmwpO1xuICAgIGlmIChob3N0ID09PSAnaHR0cCcgfHwgaG9zdCA9PT0gJ2h0dHBzJykge1xuICAgICAgLy8gTG9vayB0byBob3N0bmFtZSBmb3Igc2VydmljZVxuICAgICAgaG9zdCA9IHVybE9iamVjdC5ob3N0bmFtZTtcbiAgICAgIHVzZXIgPSB1cmxPYmplY3QudXNlcm5hbWU7XG4gICAgICBwYXNzd29yZCA9IHVybE9iamVjdC5wYXNzd29yZDtcbiAgICB9IGVsc2UgaWYgKHVybE9iamVjdC5wcm90b2NvbCAmJiB1cmxPYmplY3QudXNlcm5hbWUgJiYgdXJsT2JqZWN0LnBhc3N3b3JkKSB7XG4gICAgICAvLyBXZSBoYXZlIHNvbWUgZGF0YSBmcm9tIHVybE9iamVjdFxuICAgICAgaG9zdCA9IHVybE9iamVjdC5wcm90b2NvbC5zcGxpdCgnOicpWzBdO1xuICAgICAgdXNlciA9IHVybE9iamVjdC51c2VybmFtZTtcbiAgICAgIHBhc3N3b3JkID0gdXJsT2JqZWN0LnBhc3N3b3JkO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBXZSBuZWVkIHRvIGRpc2VjdCB0aGUgVVJMIG91cnNlbHZlcyB0byBnZXQgdGhlIGRhdGFcbiAgICAgIC8vIEZpcnN0IGdldCByaWQgb2YgdGhlIGxlYWRpbmcgJy8vJyBhbmQgc3BsaXQgdG8gdXNlcm5hbWUgYW5kIHRoZSByZXN0XG4gICAgICBjb25zdCB0ZW1wID0gdXJsT2JqZWN0LnBhdGhuYW1lLnN1YnN0cmluZygyKT8uc3BsaXQoJzonKTtcbiAgICAgIHVzZXIgPSB0ZW1wWzBdO1xuICAgICAgLy8gTm93IHdlIHNwbGl0IGJ5ICdAJyB0byBnZXQgcGFzc3dvcmQgYW5kIGhvc3RuYW1lXG4gICAgICBjb25zdCB0ZW1wMiA9IHRlbXBbMV0uc3BsaXQoJ0AnKTtcbiAgICAgIHBhc3N3b3JkID0gdGVtcDJbMF07XG4gICAgICBob3N0ID0gdGVtcDJbMV07XG4gICAgfVxuICAgIHNlcnZpY2UgPSBob3N0O1xuICB9XG5cbiAgaWYgKCF3ZWxsS25vdyhzZXR0aW5ncz8uc2VydmljZSB8fCBzZXJ2aWNlKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICdDb3VsZCBub3QgcmVjb2duaXplIGUtbWFpbCBzZXJ2aWNlLiBTZWUgbGlzdCBhdCBodHRwczovL25vZGVtYWlsZXIuY29tL3NtdHAvd2VsbC1rbm93bi8gZm9yIHNlcnZpY2VzIHRoYXQgd2UgY2FuIGNvbmZpZ3VyZSBmb3IgeW91LidcbiAgICApO1xuICB9XG5cbiAgY29uc3QgdHJhbnNwb3J0ID0gbm9kZW1haWxlci5jcmVhdGVUcmFuc3BvcnQoe1xuICAgIHNlcnZpY2U6IHNldHRpbmdzPy5zZXJ2aWNlIHx8IHNlcnZpY2UsXG4gICAgYXV0aDoge1xuICAgICAgdXNlcjogc2V0dGluZ3M/LnVzZXIgfHwgdXNlcixcbiAgICAgIHBhc3M6IHNldHRpbmdzPy5wYXNzd29yZCB8fCBwYXNzd29yZCxcbiAgICB9LFxuICB9KTtcblxuICBpZiAob3B0aW9ucz8uZW5jcnlwdGlvbktleXMgfHwgb3B0aW9ucz8uc2hvdWxkU2lnbikge1xuICAgIHRyYW5zcG9ydC51c2UoJ3N0cmVhbScsIG9wZW5wZ3BFbmNyeXB0KG9wdGlvbnMpKTtcbiAgfVxuICByZXR1cm4gdHJhbnNwb3J0O1xufTtcbkVtYWlsVGVzdC5rbm93SG9zdHNUcmFuc3BvcnQgPSBrbm93bkhvc3RzVHJhbnNwb3J0O1xuXG5jb25zdCBnZXRUcmFuc3BvcnQgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICBjb25zdCBwYWNrYWdlU2V0dGluZ3MgPSBNZXRlb3Iuc2V0dGluZ3MucGFja2FnZXM/LmVtYWlsIHx8IHt9O1xuICAvLyBXZSBkZWxheSB0aGlzIGNoZWNrIHVudGlsIHRoZSBmaXJzdCBjYWxsIHRvIEVtYWlsLnNlbmQsIGluIGNhc2Ugc29tZW9uZVxuICAvLyBzZXQgcHJvY2Vzcy5lbnYuTUFJTF9VUkwgaW4gc3RhcnR1cCBjb2RlLiBUaGVuIHdlIHN0b3JlIGluIGEgY2FjaGUgdW50aWxcbiAgLy8gcHJvY2Vzcy5lbnYuTUFJTF9VUkwgY2hhbmdlcy5cbiAgY29uc3QgdXJsID0gcHJvY2Vzcy5lbnYuTUFJTF9VUkw7XG4gIGlmIChcbiAgICBnbG9iYWxUaGlzLmNhY2hlS2V5ID09PSB1bmRlZmluZWQgfHxcbiAgICBnbG9iYWxUaGlzLmNhY2hlS2V5ICE9PSB1cmwgfHxcbiAgICBnbG9iYWxUaGlzLmNhY2hlS2V5ICE9PSBwYWNrYWdlU2V0dGluZ3Muc2VydmljZSB8fFxuICAgIGdsb2JhbFRoaXMuY2FjaGVLZXkgIT09ICdzZXR0aW5ncydcbiAgKSB7XG4gICAgaWYgKFxuICAgICAgKHBhY2thZ2VTZXR0aW5ncy5zZXJ2aWNlICYmIHdlbGxLbm93KHBhY2thZ2VTZXR0aW5ncy5zZXJ2aWNlKSkgfHxcbiAgICAgICh1cmwgJiYgd2VsbEtub3cobmV3IFVSTCh1cmwpLmhvc3RuYW1lKSkgfHxcbiAgICAgIHdlbGxLbm93KHVybD8uc3BsaXQoJzonKVswXSB8fCAnJylcbiAgICApIHtcbiAgICAgIGdsb2JhbFRoaXMuY2FjaGVLZXkgPSBwYWNrYWdlU2V0dGluZ3Muc2VydmljZSB8fCAnc2V0dGluZ3MnO1xuICAgICAgZ2xvYmFsVGhpcy5jYWNoZSA9IGtub3duSG9zdHNUcmFuc3BvcnQocGFja2FnZVNldHRpbmdzLCB1cmwsIG9wdGlvbnMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBnbG9iYWxUaGlzLmNhY2hlS2V5ID0gdXJsO1xuICAgICAgZ2xvYmFsVGhpcy5jYWNoZSA9IHVybCA/IG1ha2VUcmFuc3BvcnQodXJsLCBvcHRpb25zKSA6IG51bGw7XG4gICAgfVxuICB9XG4gIHJldHVybiBnbG9iYWxUaGlzLmNhY2hlO1xufTtcblxubGV0IG5leHREZXZNb2RlTWFpbElkID0gMDtcblxuRW1haWxUZXN0Ll9nZXRBbmRJbmNOZXh0RGV2TW9kZU1haWxJZCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIG5leHREZXZNb2RlTWFpbElkKys7XG59O1xuXG4vLyBUZXN0aW5nIGhvb2tzXG5FbWFpbFRlc3QucmVzZXROZXh0RGV2TW9kZU1haWxJZCA9IGZ1bmN0aW9uICgpIHtcbiAgbmV4dERldk1vZGVNYWlsSWQgPSAwO1xufTtcblxuY29uc3QgZGV2TW9kZVNlbmRBc3luYyA9IGZ1bmN0aW9uIChtYWlsLCBvcHRpb25zKSB7XG4gIGNvbnN0IHN0cmVhbSA9IG9wdGlvbnM/LnN0cmVhbSB8fCBwcm9jZXNzLnN0ZG91dDtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBsZXQgZGV2TW9kZU1haWxJZCA9IEVtYWlsVGVzdC5fZ2V0QW5kSW5jTmV4dERldk1vZGVNYWlsSWQoKTtcblxuICAgIC8vIFRoaXMgYXBwcm9hY2ggZG9lcyBub3QgcHJldmVudCBvdGhlciB3cml0ZXJzIHRvIHN0ZG91dCBmcm9tIGludGVybGVhdmluZy5cbiAgICBjb25zdCBvdXRwdXQgPSBbJz09PT09PSBCRUdJTiBNQUlMICMnICsgZGV2TW9kZU1haWxJZCArICcgPT09PT09XFxuJ107XG4gICAgb3V0cHV0LnB1c2goXG4gICAgICAnKE1haWwgbm90IHNlbnQ7IHRvIGVuYWJsZSBzZW5kaW5nLCBzZXQgdGhlIE1BSUxfVVJMICcgK1xuICAgICAgJ2Vudmlyb25tZW50IHZhcmlhYmxlLilcXG4nXG4gICAgKTtcbiAgICBjb25zdCByZWFkU3RyZWFtID0gbmV3IE1haWxDb21wb3NlcihtYWlsKS5jb21waWxlKCkuY3JlYXRlUmVhZFN0cmVhbSgpO1xuICAgIHJlYWRTdHJlYW0ub24oJ2RhdGEnLCBidWZmZXIgPT4ge1xuICAgICAgb3V0cHV0LnB1c2goYnVmZmVyLnRvU3RyaW5nKCkpO1xuICAgIH0pO1xuICAgIHJlYWRTdHJlYW0ub24oJ2VuZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgIG91dHB1dC5wdXNoKCc9PT09PT0gRU5EIE1BSUwgIycgKyBkZXZNb2RlTWFpbElkICsgJyA9PT09PT1cXG4nKTtcbiAgICAgIHN0cmVhbS53cml0ZShvdXRwdXQuam9pbignJyksICgpID0+IHJlc29sdmUoKSk7XG4gICAgfSk7XG4gICAgcmVhZFN0cmVhbS5vbignZXJyb3InLCAoZXJyKSA9PiByZWplY3QoZXJyKSk7XG4gIH0pO1xufTtcblxuY29uc3Qgc2VuZEhvb2tzID0gbmV3IEhvb2soKTtcblxuLyoqXG4gKiBAc3VtbWFyeSBIb29rIHRoYXQgcnVucyBiZWZvcmUgZW1haWwgaXMgc2VudC5cbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqXG4gKiBAcGFyYW0gZiB7ZnVuY3Rpb259IHJlY2VpdmVzIHRoZSBhcmd1bWVudHMgdG8gRW1haWwuc2VuZCBhbmQgc2hvdWxkIHJldHVybiB0cnVlIHRvIGdvXG4gKiBhaGVhZCBhbmQgc2VuZCB0aGUgZW1haWwgKG9yIGF0IGxlYXN0LCB0cnkgc3Vic2VxdWVudCBob29rcyksIG9yXG4gKiBmYWxzZSB0byBza2lwIHNlbmRpbmcuXG4gKiBAcmV0dXJucyB7eyBzdG9wOiBmdW5jdGlvbiwgY2FsbGJhY2s6IGZ1bmN0aW9uIH19XG4gKi9cbkVtYWlsLmhvb2tTZW5kID0gZnVuY3Rpb24gKGYpIHtcbiAgcmV0dXJuIHNlbmRIb29rcy5yZWdpc3RlcihmKTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgT3ZlcnJpZGVzIHNlbmRpbmcgZnVuY3Rpb24gd2l0aCB5b3VyIG93bi5cbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBzaW5jZSAyLjJcbiAqIEBwYXJhbSBmIHtmdW5jdGlvbn0gZnVuY3Rpb24gdGhhdCB3aWxsIHJlY2VpdmUgb3B0aW9ucyBmcm9tIHRoZSBzZW5kIGZ1bmN0aW9uIGFuZCB1bmRlciBgcGFja2FnZVNldHRpbmdzYCB3aWxsXG4gKiBpbmNsdWRlIHRoZSBwYWNrYWdlIHNldHRpbmdzIGZyb20gTWV0ZW9yLnNldHRpbmdzLnBhY2thZ2VzLmVtYWlsIGZvciB5b3VyIGN1c3RvbSB0cmFuc3BvcnQgdG8gYWNjZXNzLlxuICovXG5FbWFpbC5jdXN0b21UcmFuc3BvcnQgPSB1bmRlZmluZWQ7XG5cbi8qKlxuICogQHN1bW1hcnkgU2VuZCBhbiBlbWFpbCB3aXRoIGFzeW5jcm9ub3VzIG1ldGhvZC4gQ2FwdHVyZSAgVGhyb3dzIGFuIGBFcnJvcmAgb24gZmFpbHVyZSB0byBjb250YWN0IG1haWwgc2VydmVyXG4gKiBvciBpZiBtYWlsIHNlcnZlciByZXR1cm5zIGFuIGVycm9yLiBBbGwgZmllbGRzIHNob3VsZCBtYXRjaFxuICogW1JGQzUzMjJdKGh0dHA6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzUzMjIpIHNwZWNpZmljYXRpb24uXG4gKlxuICogSWYgdGhlIGBNQUlMX1VSTGAgZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgc2V0LCBhY3R1YWxseSBzZW5kcyB0aGUgZW1haWwuXG4gKiBPdGhlcndpc2UsIHByaW50cyB0aGUgY29udGVudHMgb2YgdGhlIGVtYWlsIHRvIHN0YW5kYXJkIG91dC5cbiAqXG4gKiBOb3RlIHRoYXQgdGhpcyBwYWNrYWdlIGlzIGJhc2VkIG9uICoqbm9kZW1haWxlcioqLCBzbyBtYWtlIHN1cmUgdG8gcmVmZXIgdG9cbiAqIFt0aGUgZG9jdW1lbnRhdGlvbl0oaHR0cDovL25vZGVtYWlsZXIuY29tLylcbiAqIHdoZW4gdXNpbmcgdGhlIGBhdHRhY2htZW50c2Agb3IgYG1haWxDb21wb3NlcmAgb3B0aW9ucy5cbiAqXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcmV0dXJuIHtQcm9taXNlfVxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEBwYXJhbSB7U3RyaW5nfSBvcHRpb25zLmZyb20gXCJGcm9tOlwiIGFkZHJlc3MgKHJlcXVpcmVkKVxuICogQHBhcmFtIHtTdHJpbmd8U3RyaW5nW119IG9wdGlvbnMudG8sY2MsYmNjLHJlcGx5VG9cbiAqICAgXCJUbzpcIiwgXCJDYzpcIiwgXCJCY2M6XCIsIGFuZCBcIlJlcGx5LVRvOlwiIGFkZHJlc3Nlc1xuICogQHBhcmFtIHtTdHJpbmd9IFtvcHRpb25zLmluUmVwbHlUb10gTWVzc2FnZS1JRCB0aGlzIG1lc3NhZ2UgaXMgcmVwbHlpbmcgdG9cbiAqIEBwYXJhbSB7U3RyaW5nfFN0cmluZ1tdfSBbb3B0aW9ucy5yZWZlcmVuY2VzXSBBcnJheSAob3Igc3BhY2Utc2VwYXJhdGVkIHN0cmluZykgb2YgTWVzc2FnZS1JRHMgdG8gcmVmZXIgdG9cbiAqIEBwYXJhbSB7U3RyaW5nfSBbb3B0aW9ucy5tZXNzYWdlSWRdIE1lc3NhZ2UtSUQgZm9yIHRoaXMgbWVzc2FnZTsgb3RoZXJ3aXNlLCB3aWxsIGJlIHNldCB0byBhIHJhbmRvbSB2YWx1ZVxuICogQHBhcmFtIHtTdHJpbmd9IFtvcHRpb25zLnN1YmplY3RdICBcIlN1YmplY3Q6XCIgbGluZVxuICogQHBhcmFtIHtTdHJpbmd9IFtvcHRpb25zLnRleHR8aHRtbF0gTWFpbCBib2R5IChpbiBwbGFpbiB0ZXh0IGFuZC9vciBIVE1MKVxuICogQHBhcmFtIHtTdHJpbmd9IFtvcHRpb25zLndhdGNoSHRtbF0gTWFpbCBib2R5IGluIEhUTUwgc3BlY2lmaWMgZm9yIEFwcGxlIFdhdGNoXG4gKiBAcGFyYW0ge1N0cmluZ30gW29wdGlvbnMuaWNhbEV2ZW50XSBpQ2FsZW5kYXIgZXZlbnQgYXR0YWNobWVudFxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLmhlYWRlcnNdIERpY3Rpb25hcnkgb2YgY3VzdG9tIGhlYWRlcnMgLSBlLmcuIGB7IFwiaGVhZGVyIG5hbWVcIjogXCJoZWFkZXIgdmFsdWVcIiB9YC4gVG8gc2V0IGFuIG9iamVjdCB1bmRlciBhIGhlYWRlciBuYW1lLCB1c2UgYEpTT04uc3RyaW5naWZ5YCAtIGUuZy4gYHsgXCJoZWFkZXIgbmFtZVwiOiBKU09OLnN0cmluZ2lmeSh7IHRyYWNraW5nOiB7IGxldmVsOiAnZnVsbCcgfSB9KSB9YC5cbiAqIEBwYXJhbSB7T2JqZWN0W119IFtvcHRpb25zLmF0dGFjaG1lbnRzXSBBcnJheSBvZiBhdHRhY2htZW50IG9iamVjdHMsIGFzXG4gKiBkZXNjcmliZWQgaW4gdGhlIFtub2RlbWFpbGVyIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vbm9kZW1haWxlci5jb20vbWVzc2FnZS9hdHRhY2htZW50cy8pLlxuICogQHBhcmFtIHtNYWlsQ29tcG9zZXJ9IFtvcHRpb25zLm1haWxDb21wb3Nlcl0gQSBbTWFpbENvbXBvc2VyXShodHRwczovL25vZGVtYWlsZXIuY29tL2V4dHJhcy9tYWlsY29tcG9zZXIvI2UtbWFpbC1tZXNzYWdlLWZpZWxkcylcbiAqIG9iamVjdCByZXByZXNlbnRpbmcgdGhlIG1lc3NhZ2UgdG8gYmUgc2VudC4gIE92ZXJyaWRlcyBhbGwgb3RoZXIgb3B0aW9ucy5cbiAqIFlvdSBjYW4gY3JlYXRlIGEgYE1haWxDb21wb3NlcmAgb2JqZWN0IHZpYVxuICogYG5ldyBFbWFpbEludGVybmFscy5OcG1Nb2R1bGVzLm1haWxjb21wb3Nlci5tb2R1bGVgLlxuICovXG5FbWFpbC5zZW5kQXN5bmMgPSBhc3luYyBmdW5jdGlvbiAob3B0aW9ucykge1xuICBjb25zdCBlbWFpbCA9IG9wdGlvbnMubWFpbENvbXBvc2VyID8gb3B0aW9ucy5tYWlsQ29tcG9zZXIubWFpbCA6IG9wdGlvbnM7XG5cbiAgbGV0IHNlbmQgPSB0cnVlO1xuICBhd2FpdCBzZW5kSG9va3MuZm9yRWFjaEFzeW5jKGFzeW5jIChzZW5kSG9vaykgPT4ge1xuICAgIHNlbmQgPSBhd2FpdCBzZW5kSG9vayhlbWFpbCk7XG4gICAgcmV0dXJuIHNlbmQ7XG4gIH0pO1xuICBpZiAoIXNlbmQpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAoRW1haWwuY3VzdG9tVHJhbnNwb3J0KSB7XG4gICAgY29uc3QgcGFja2FnZVNldHRpbmdzID0gTWV0ZW9yLnNldHRpbmdzLnBhY2thZ2VzPy5lbWFpbCB8fCB7fTtcbiAgICByZXR1cm4gRW1haWwuY3VzdG9tVHJhbnNwb3J0KHsgcGFja2FnZVNldHRpbmdzLCAuLi5lbWFpbCB9KTtcbiAgfVxuXG4gIGNvbnN0IG1haWxVcmxFbnYgPSBwcm9jZXNzLmVudi5NQUlMX1VSTDtcbiAgY29uc3QgbWFpbFVybFNldHRpbmdzID0gTWV0ZW9yLnNldHRpbmdzLnBhY2thZ2VzPy5lbWFpbDtcblxuICBpZiAoTWV0ZW9yLmlzUHJvZHVjdGlvbiAmJiAhbWFpbFVybEVudiAmJiAhbWFpbFVybFNldHRpbmdzKSB7XG4gICAgLy8gVGhpcyBjaGVjayBpcyBtb3N0bHkgbmVjZXNzYXJ5IHdoZW4gdXNpbmcgdGhlIGZsYWcgLS1wcm9kdWN0aW9uIHdoZW4gcnVubmluZyBsb2NhbGx5LlxuICAgIC8vIEFuZCBpdCB3b3JrcyBhcyBhIHJlbWluZGVyIHRvIHByb3Blcmx5IHNldCB0aGUgbWFpbCBVUkwgd2hlbiBydW5uaW5nIGxvY2FsbHkuXG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ1lvdSBoYXZlIG5vdCBwcm92aWRlZCBhIG1haWwgVVJMLiBZb3UgY2FuIHByb3ZpZGUgaXQgYnkgdXNpbmcgdGhlIGVudmlyb25tZW50IHZhcmlhYmxlIE1BSUxfVVJMIG9yIHlvdXIgc2V0dGluZ3MuIFlvdSBjYW4gcmVhZCBtb3JlIGFib3V0IGl0IGhlcmU6IGh0dHBzOi8vZG9jcy5tZXRlb3IuY29tL2FwaS9lbWFpbC5odG1sLidcbiAgICApO1xuICB9XG5cbiAgaWYgKG1haWxVcmxFbnYgfHwgbWFpbFVybFNldHRpbmdzKSB7XG4gICAgcmV0dXJuIGdldFRyYW5zcG9ydCgpLnNlbmRNYWlsKGVtYWlsKTtcbiAgfVxuXG4gIHJldHVybiBkZXZNb2RlU2VuZEFzeW5jKGVtYWlsLCBvcHRpb25zKTtcbn07XG5cbi8qKlxuICogQGRlcHJlY2F0ZWRcbiAqIEBzdW1tYXJ5IFNlbmQgYW4gZW1haWwgd2l0aCBhc3luY3Jvbm91cyBtZXRob2QuIENhcHR1cmUgIFRocm93cyBhbiBgRXJyb3JgIG9uIGZhaWx1cmUgdG8gY29udGFjdCBtYWlsIHNlcnZlclxuICogb3IgaWYgbWFpbCBzZXJ2ZXIgcmV0dXJucyBhbiBlcnJvci4gQWxsIGZpZWxkcyBzaG91bGQgbWF0Y2hcbiAqIFtSRkM1MzIyXShodHRwOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmM1MzIyKSBzcGVjaWZpY2F0aW9uLlxuICpcbiAqIElmIHRoZSBgTUFJTF9VUkxgIGVudmlyb25tZW50IHZhcmlhYmxlIGlzIHNldCwgYWN0dWFsbHkgc2VuZHMgdGhlIGVtYWlsLlxuICogT3RoZXJ3aXNlLCBwcmludHMgdGhlIGNvbnRlbnRzIG9mIHRoZSBlbWFpbCB0byBzdGFuZGFyZCBvdXQuXG4gKlxuICogTm90ZSB0aGF0IHRoaXMgcGFja2FnZSBpcyBiYXNlZCBvbiAqKm5vZGVtYWlsZXIqKiwgc28gbWFrZSBzdXJlIHRvIHJlZmVyIHRvXG4gKiBbdGhlIGRvY3VtZW50YXRpb25dKGh0dHA6Ly9ub2RlbWFpbGVyLmNvbS8pXG4gKiB3aGVuIHVzaW5nIHRoZSBgYXR0YWNobWVudHNgIG9yIGBtYWlsQ29tcG9zZXJgIG9wdGlvbnMuXG4gKlxuICogQGxvY3VzIFNlcnZlclxuICogQHJldHVybiB7UHJvbWlzZX1cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5mcm9tIFwiRnJvbTpcIiBhZGRyZXNzIChyZXF1aXJlZClcbiAqIEBwYXJhbSB7U3RyaW5nfFN0cmluZ1tdfSBvcHRpb25zLnRvLGNjLGJjYyxyZXBseVRvXG4gKiAgIFwiVG86XCIsIFwiQ2M6XCIsIFwiQmNjOlwiLCBhbmQgXCJSZXBseS1UbzpcIiBhZGRyZXNzZXNcbiAqIEBwYXJhbSB7U3RyaW5nfSBbb3B0aW9ucy5pblJlcGx5VG9dIE1lc3NhZ2UtSUQgdGhpcyBtZXNzYWdlIGlzIHJlcGx5aW5nIHRvXG4gKiBAcGFyYW0ge1N0cmluZ3xTdHJpbmdbXX0gW29wdGlvbnMucmVmZXJlbmNlc10gQXJyYXkgKG9yIHNwYWNlLXNlcGFyYXRlZCBzdHJpbmcpIG9mIE1lc3NhZ2UtSURzIHRvIHJlZmVyIHRvXG4gKiBAcGFyYW0ge1N0cmluZ30gW29wdGlvbnMubWVzc2FnZUlkXSBNZXNzYWdlLUlEIGZvciB0aGlzIG1lc3NhZ2U7IG90aGVyd2lzZSwgd2lsbCBiZSBzZXQgdG8gYSByYW5kb20gdmFsdWVcbiAqIEBwYXJhbSB7U3RyaW5nfSBbb3B0aW9ucy5zdWJqZWN0XSAgXCJTdWJqZWN0OlwiIGxpbmVcbiAqIEBwYXJhbSB7U3RyaW5nfSBbb3B0aW9ucy50ZXh0fGh0bWxdIE1haWwgYm9keSAoaW4gcGxhaW4gdGV4dCBhbmQvb3IgSFRNTClcbiAqIEBwYXJhbSB7U3RyaW5nfSBbb3B0aW9ucy53YXRjaEh0bWxdIE1haWwgYm9keSBpbiBIVE1MIHNwZWNpZmljIGZvciBBcHBsZSBXYXRjaFxuICogQHBhcmFtIHtTdHJpbmd9IFtvcHRpb25zLmljYWxFdmVudF0gaUNhbGVuZGFyIGV2ZW50IGF0dGFjaG1lbnRcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5oZWFkZXJzXSBEaWN0aW9uYXJ5IG9mIGN1c3RvbSBoZWFkZXJzIC0gZS5nLiBgeyBcImhlYWRlciBuYW1lXCI6IFwiaGVhZGVyIHZhbHVlXCIgfWAuIFRvIHNldCBhbiBvYmplY3QgdW5kZXIgYSBoZWFkZXIgbmFtZSwgdXNlIGBKU09OLnN0cmluZ2lmeWAgLSBlLmcuIGB7IFwiaGVhZGVyIG5hbWVcIjogSlNPTi5zdHJpbmdpZnkoeyB0cmFja2luZzogeyBsZXZlbDogJ2Z1bGwnIH0gfSkgfWAuXG4gKiBAcGFyYW0ge09iamVjdFtdfSBbb3B0aW9ucy5hdHRhY2htZW50c10gQXJyYXkgb2YgYXR0YWNobWVudCBvYmplY3RzLCBhc1xuICogZGVzY3JpYmVkIGluIHRoZSBbbm9kZW1haWxlciBkb2N1bWVudGF0aW9uXShodHRwczovL25vZGVtYWlsZXIuY29tL21lc3NhZ2UvYXR0YWNobWVudHMvKS5cbiAqIEBwYXJhbSB7TWFpbENvbXBvc2VyfSBbb3B0aW9ucy5tYWlsQ29tcG9zZXJdIEEgW01haWxDb21wb3Nlcl0oaHR0cHM6Ly9ub2RlbWFpbGVyLmNvbS9leHRyYXMvbWFpbGNvbXBvc2VyLyNlLW1haWwtbWVzc2FnZS1maWVsZHMpXG4gKiBvYmplY3QgcmVwcmVzZW50aW5nIHRoZSBtZXNzYWdlIHRvIGJlIHNlbnQuICBPdmVycmlkZXMgYWxsIG90aGVyIG9wdGlvbnMuXG4gKiBZb3UgY2FuIGNyZWF0ZSBhIGBNYWlsQ29tcG9zZXJgIG9iamVjdCB2aWFcbiAqIGBuZXcgRW1haWxJbnRlcm5hbHMuTnBtTW9kdWxlcy5tYWlsY29tcG9zZXIubW9kdWxlYC5cbiAqIEBwYXJhbSB7U3RyaW5nfSBbb3B0aW9ucy5lbmNyeXB0aW9uS2V5c10gQW4gYXJyYXkgdGhhdCBob2xkcyB0aGUgcHVibGljIGtleXMgdXNlZCB0byBlbmNyeXB0LlxuICogQHBhcmFtIHtTdHJpbmd9IFtvcHRpb25zLnNob3VsZFNpZ25dIEVuYWJsZXMgeW91IHRvIGFsbG93IG9yIGRpc2FsbG93IGVtYWlsIHNpZ25pbmcuXG4qL1xuRW1haWwuc2VuZCA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgRW1haWwuc2VuZEFzeW5jKG9wdGlvbnMpXG4gICAgLnRoZW4oKCkgPT5cbiAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgYEVtYWlsLnNlbmQgaXMgbm8gbG9uZ2VyIHJlY29tbWVuZGVkLCB5b3Ugc2hvdWxkIHVzZSBFbWFpbC5zZW5kQXN5bmNgXG4gICAgICApXG4gICAgKVxuICAgIC5jYXRjaChlID0+XG4gICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICBgRW1haWwuc2VuZCBpcyBubyBsb25nZXIgcmVjb21tZW5kZWQgYW5kIGFuIGVycm9yIGhhcHBlbmVkYCxcbiAgICAgICAgZVxuICAgICAgKVxuICAgICk7XG59O1xuIl19
