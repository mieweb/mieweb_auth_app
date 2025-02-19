Package["core-runtime"].queue("null",function () {/* Imports for global scope */

MongoInternals = Package.mongo.MongoInternals;
Mongo = Package.mongo.Mongo;
ReactiveVar = Package['reactive-var'].ReactiveVar;
ECMAScript = Package.ecmascript.ECMAScript;
HTTP = Package.http.HTTP;
HTTPInternals = Package.http.HTTPInternals;
Accounts = Package['accounts-base'].Accounts;
check = Package.check.check;
Match = Package.check.Match;
SHA256 = Package.sha.SHA256;
Meteor = Package.meteor.Meteor;
global = Package.meteor.global;
meteorEnv = Package.meteor.meteorEnv;
EmitterPromise = Package.meteor.EmitterPromise;
WebApp = Package.webapp.WebApp;
WebAppInternals = Package.webapp.WebAppInternals;
main = Package.webapp.main;
DDP = Package['ddp-client'].DDP;
DDPServer = Package['ddp-server'].DDPServer;
LaunchScreen = Package['launch-screen'].LaunchScreen;
meteorInstall = Package.modules.meteorInstall;
Promise = Package.promise.Promise;
Autoupdate = Package.autoupdate.Autoupdate;

var require = meteorInstall({"imports":{"api":{"deviceLogs.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// imports/api/deviceLogs.js                                                                                    //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      DeviceLogs: () => DeviceLogs
    });
    let Mongo;
    module.link("meteor/mongo", {
      Mongo(v) {
        Mongo = v;
      }
    }, 0);
    let check;
    module.link("meteor/check", {
      check(v) {
        check = v;
      }
    }, 1);
    let SHA256;
    module.link("meteor/sha", {
      SHA256(v) {
        SHA256 = v;
      }
    }, 2);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const DeviceLogs = new Mongo.Collection('deviceLogs');
    // Add generateAppId utility function
    const generateAppId = (deviceUUID, email, creationTime) => {
      const combinedString = "".concat(deviceUUID, ":").concat(email, ":").concat(creationTime);
      return SHA256(combinedString).substring(0, 32);
    };

    // Create indexes for better query performance
    if (Meteor.isServer) {
      Meteor.startup(() => {
        DeviceLogs.createIndex({
          userId: 1
        });
        DeviceLogs.createIndex({
          deviceUUID: 1
        });
        DeviceLogs.createIndex({
          email: 1
        });
        DeviceLogs.createIndex({
          appId: 1
        });
      });
    }

    // Define methods for DeviceLogs
    Meteor.methods({
      'deviceLogs.upsert': async function (data) {
        check(data, {
          userId: String,
          email: String,
          deviceUUID: String,
          fcmToken: String,
          deviceInfo: Object
        });
        const creationTime = new Date().toISOString();
        const appId = generateAppId(data.deviceUUID, data.email, creationTime);
        console.log('Generated appId during upsert:', appId); // Add this log

        return DeviceLogs.upsertAsync({
          userId: data.userId,
          deviceUUID: data.deviceUUID
        }, {
          $set: {
            email: data.email,
            fcmToken: data.fcmToken,
            appId: appId,
            lastUpdated: new Date()
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        });
      },
      'deviceLogs.updateToken'(userId, deviceUUID, fcmToken) {
        check(userId, String);
        check(deviceUUID, String);
        check(fcmToken, String);
        return DeviceLogs.updateAsync({
          userId: userId,
          deviceUUID: deviceUUID
        }, {
          $set: {
            fcmToken: fcmToken,
            lastUpdated: new Date()
          }
        });
      },
      'deviceLogs.getFCMTokenByAppId': async function (appId) {
        check(appId, String);
        const deviceLog = await DeviceLogs.findOneAsync({
          appId: appId
        });
        if (!deviceLog) {
          throw new Meteor.Error('invalid-app-id', 'No device found with this App ID');
        }
        return deviceLog.fcmToken;
      },
      'deviceLogs.getFCMTokenByDeviceId': async function (deviceUUID) {
        check(deviceUUID, String);
        const deviceLog = await DeviceLogs.findOneAsync({
          deviceUUID: deviceUUID
        });
        if (!deviceLog) {
          throw new Meteor.Error('invalid-app-id', 'No device found with this Device ID');
        }
        return deviceLog.fcmToken;
      },
      // Also fix the debug method
      'deviceLogs.getByAppId': async function (appId) {
        check(appId, String);
        const result = await DeviceLogs.findOneAsync({
          appId
        });
        console.log('Looking for appId:', appId);
        console.log('Found device log:', result);
        return result;
      }
    });

    // Publish device logs
    if (Meteor.isServer) {
      Meteor.publish('deviceLogs.byUser', function (userId) {
        check(userId, String);
        return DeviceLogs.find({
          userId: userId
        });
      });
      Meteor.publish('deviceLogs.byDevice', function (deviceUUID) {
        check(deviceUUID, String);
        return DeviceLogs.find({
          deviceUUID: deviceUUID
        });
      });
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
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"notificationHistory.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// imports/api/notificationHistory.js                                                                           //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      NotificationHistory: () => NotificationHistory
    });
    let Mongo;
    module.link("meteor/mongo", {
      Mongo(v) {
        Mongo = v;
      }
    }, 0);
    let check;
    module.link("meteor/check", {
      check(v) {
        check = v;
      }
    }, 1);
    let Random;
    module.link("meteor/random", {
      Random(v) {
        Random = v;
      }
    }, 2);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const NotificationHistory = new Mongo.Collection('notificationHistory');
    // Create indexes for better query performance
    if (Meteor.isServer) {
      Meteor.startup(() => {
        NotificationHistory.createIndex({
          userId: 1
        });
        NotificationHistory.createIndex({
          appId: 1
        });
        NotificationHistory.createIndex({
          notificationId: 1
        });
        NotificationHistory.createIndex({
          status: 1
        });
      });
    }
    Meteor.methods({
      // Insert a new notification into the history
      'notificationHistory.insert': function (data) {
        check(data, {
          userId: String,
          appId: String,
          title: String,
          body: String
        });

        // Dynamically generate a unique notificationId
        const notificationId = Random.id();
        return NotificationHistory.insertAsync({
          userId: data.userId,
          appId: data.appId,
          notificationId: notificationId,
          title: data.title,
          body: data.body,
          status: 'pending',
          createdAt: new Date()
        });
      },
      // Update the status of a notification
      'notificationHistory.updateStatus': function (notificationId, status) {
        check(notificationId, String);
        check(status, String);
        if (!['pending', 'approved', 'rejected'].includes(status)) {
          throw new Meteor.Error('invalid-status', 'Status must be pending, accepted, or rejected');
        }
        return NotificationHistory.updateAsync({
          notificationId
        }, {
          $set: {
            status: status,
            updatedAt: new Date() // Timestamp for status update
          }
        });
      },
      // Fetch the last notification ID for a specific user
      'notificationHistory.getLastIdByUser': function (userId) {
        check(userId, String);
        return NotificationHistory.findOneAsync({
          userId
        }, {
          sort: {
            createdAt: -1
          },
          fields: {
            notificationId: 1
          }
        }).then(lastNotification => {
          return lastNotification ? lastNotification.notificationId : null;
        }).catch(error => {
          console.error("Error fetching last notification:", error);
          throw new Meteor.Error("database-error", "Failed to fetch last notification");
        });
      },
      // Fetch all notifications for a user
      'notificationHistory.getByUser': function (userId) {
        check(userId, String);
        return NotificationHistory.find({
          userId
        }).fetch();
      },
      // Fetch notifications by their status
      'notificationHistory.getByStatus': function (status) {
        check(status, String);
        if (!['pending', 'accepted', 'rejected'].includes(status)) {
          throw new Meteor.Error('invalid-status', 'Status must be pending, accepted, or rejected');
        }
        return NotificationHistory.find({
          status
        }).fetch();
      }
    });
    if (Meteor.isServer) {
      Meteor.publish('notificationHistory.byUser', function (userId) {
        check(userId, String);
        return NotificationHistory.find({
          userId
        });
      });
      Meteor.publish('notificationHistory.byStatus', function (status) {
        check(status, String);
        return NotificationHistory.find({
          status
        });
      });
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
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"server":{"firebase.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// server/firebase.js                                                                                           //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      sendNotification: () => sendNotification
    });
    let admin;
    module.link("firebase-admin", {
      default(v) {
        admin = v;
      }
    }, 0);
    let serviceAccount;
    module.link("../server/private/miewebauthapp-b76936fb6ccc.json", {
      default(v) {
        serviceAccount = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    /**
     * Sends a push notification to a specific device.
     * @param {string} registrationToken - The target device token.
     * @param {string} title - The notification title.
     * @param {string} body - The notification body.
     * @param {Array} actions - The actions to include in the notification.
     */
    const sendNotification = async (registrationToken, title, body, actions) => {
      const message = {
        token: registrationToken,
        data: {
          title,
          body,
          appId: registrationToken,
          actions: JSON.stringify(actions),
          messageFrom: 'mie',
          notificationType: 'approval',
          content_available: '1',
          notId: '10'
          // surveyID: "ewtawgreg-gragrag-rgarhthgbad"
        },
        android: {
          priority: 'high'
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title,
                body
              },
              badge: 1,
              sound: "default",
              category: "APPROVAL",
              content_available: 1,
              mutable_content: true
            }
          }
        }
      };
      try {
        const response = await admin.messaging().send(message);
        console.log('Push notification sent successfully:', response);
        return response;
      } catch (error) {
        console.error('Error sending push notification:', error);
        throw error;
      }
    };
    module.exportDefault(admin);
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"main.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// server/main.js                                                                                               //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 0);
    let WebApp;
    module.link("meteor/webapp", {
      WebApp(v) {
        WebApp = v;
      }
    }, 1);
    let sendNotification;
    module.link("./firebase", {
      sendNotification(v) {
        sendNotification = v;
      }
    }, 2);
    let Accounts;
    module.link("meteor/accounts-base", {
      Accounts(v) {
        Accounts = v;
      }
    }, 3);
    module.link("../imports/api/deviceLogs.js");
    let check;
    module.link("meteor/check", {
      check(v) {
        check = v;
      }
    }, 4);
    let DeviceLogs;
    module.link("../imports/api/deviceLogs.js", {
      DeviceLogs(v) {
        DeviceLogs = v;
      }
    }, 5);
    let NotificationHistory;
    module.link("../imports/api/notificationHistory", {
      NotificationHistory(v) {
        NotificationHistory = v;
      }
    }, 6);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    // Create a Map to store pending notifications
    const pendingNotifications = new Map();
    const responsePromises = new Map();
    const saveUserNotificationHistory = async notification => {
      const {
        appId,
        title,
        body
      } = notification;
      const deviceLog = await DeviceLogs.findOneAsync({
        appId
      });
      if (!deviceLog) {
        console.error("No user found for appId:", appId);
        return;
      }
      const userId = deviceLog.userId;
      const data = {
        userId,
        appId,
        title,
        body
      };
      Meteor.call("notificationHistory.insert", data, (error, result) => {
        if (error) {
          console.error("Error inserting notification:", error);
        } else {
          console.log("Notification inserted successfully:", result);
        }
      });
    };
    WebApp.connectHandlers.use("/send-notification", async (req, res) => {
      let body = "";
      req.on("data", chunk => {
        body += chunk;
      });
      req.on("end", async () => {
        try {
          const requestBody = JSON.parse(body);
          console.log("Received request body:", requestBody);
          const {
            appId,
            title,
            body: messageBody,
            actions
          } = requestBody;
          if (!appId || !title || !messageBody || !actions) {
            throw new Error("Missing required fields");
          }

          // Get FCM token
          const fcmToken = await new Promise((resolve, reject) => {
            Meteor.call("deviceLogs.getFCMTokenByAppId", appId, (error, result) => {
              if (error) reject(error);else resolve(result);
            });
          });

          // Send notification
          await sendNotification(fcmToken, title, messageBody, actions);
          console.log("Notification sent successfully");
          saveUserNotificationHistory({
            appId,
            title,
            body: messageBody
          });

          // Create promise for user response
          const userResponsePromise = new Promise(resolve => {
            // Store the FCM token as the appId since that's what we'll get back
            console.log("FCM tokennnnnnnnnnnnn", fcmToken);
            responsePromises.set(fcmToken, resolve);

            // Add timeout
            setTimeout(() => {
              if (responsePromises.has(fcmToken)) {
                resolve("timeout");
                responsePromises.delete(fcmToken);
              }
            }, 300000); // 5 minute timeout
          });

          // Wait for user response
          const userResponse = await userResponsePromise;
          console.log("USER RESPONSE", userResponse);

          // Send final response
          res.writeHead(200, {
            "Content-Type": "application/json"
          });
          res.end(JSON.stringify({
            success: true,
            action: userResponse
          }));
        } catch (error) {
          console.error("Error in /send-notification:", error);
          res.writeHead(400, {
            "Content-Type": "application/json"
          });
          res.end(JSON.stringify({
            success: false,
            error: error.message
          }));
        }
      });
    });

    // Meteor methods
    Meteor.methods({
      async "notifications.handleResponse"(appId, action) {
        check(appId, String);
        check(action, String);
        console.log("Handling notification response for appId: ".concat(appId, ", action: ").concat(action));
        console.log("Response promises", responsePromises);

        // If we have a pending promise for this notification, resolve it
        if (responsePromises.has(appId)) {
          const resolve = responsePromises.get(appId);
          resolve(action);
          responsePromises.delete(appId);
          return {
            success: true,
            message: "Response ".concat(action, " processed successfully")
          };
        } else {
          console.log("No pending promise found for appId:", appId);
          return {
            success: false,
            message: "No pending notification found"
          };
        }
      },
      async userAction(action, requestId) {
        let replyText = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
        check(action, String);
        check(requestId, String);
        if (replyText) check(replyText, String);
        const validActions = ["approve", "reject", "reply"];
        if (!validActions.includes(action)) {
          throw new Meteor.Error("invalid-action", "Invalid action performed by the user.");
        }
        const pendingNotification = pendingNotifications.get(requestId);
        if (pendingNotification) {
          clearTimeout(pendingNotification.timeout);
          pendingNotification.resolve({
            action,
            replyText
          });
          pendingNotifications.delete(requestId);
          return {
            success: true,
            action,
            replyText
          };
        } else {
          throw new Meteor.Error("invalid-request", "No pending notification found for this request.");
        }
      },
      async "users.register"(userDetails) {
        check(userDetails, {
          email: String,
          pin: String,
          firstName: String,
          lastName: String,
          sessionDeviceInfo: {
            model: String,
            platform: String,
            uuid: String,
            version: String,
            manufacturer: String
          },
          fcmDeviceToken: String
        });
        const {
          email,
          pin,
          firstName,
          lastName,
          sessionDeviceInfo
        } = userDetails;
        const fcmToken = userDetails.fcmDeviceToken;

        // Check if user exists
        if (await Meteor.users.findOneAsync({
          "emails.address": email
        })) {
          throw new Meteor.Error("user-exists", "User already exists with this email");
        }
        try {
          // Create user in Meteor users collection
          const userId = await Accounts.createUser({
            email,
            password: pin,
            profile: {
              firstName,
              lastName,
              deviceInfo: sessionDeviceInfo,
              deviceToken: fcmToken
            }
          });
          if (userId) {
            console.log("user id in server is: ".concat(userId));

            // Ensure userId is passed as a string
            await Meteor.call("deviceLogs.upsert", {
              userId: userId.toString(),
              email,
              deviceUUID: sessionDeviceInfo.uuid,
              fcmToken,
              deviceInfo: sessionDeviceInfo
            });
          }
          return {
            success: true,
            userId,
            message: "Registration successful"
          };
        } catch (error) {
          console.error("Error during registration:", error);
          throw new Meteor.Error("registration-failed", error.message);
        }
      },
      async getUserDetails(email) {
        var _user$profile, _user$profile2;
        if (!email) {
          throw new Meteor.Error("Email is required");
        }
        const user = await Meteor.users.findOneAsync({
          "emails.address": email
        });
        if (!user) {
          throw new Meteor.Error("User not found");
        }
        return {
          firstName: ((_user$profile = user.profile) === null || _user$profile === void 0 ? void 0 : _user$profile.firstName) || "",
          lastName: ((_user$profile2 = user.profile) === null || _user$profile2 === void 0 ? void 0 : _user$profile2.lastName) || "",
          email: user.emails[0].address || ""
        };
      },
      async "users.checkRegistration"(fcmToken) {
        check(fcmToken, String);
        const user = Meteor.users.findOneAsync({
          "profile.fcmToken": fcmToken
        });
        if (!user) {
          throw new Meteor.Error("device-deregistered", "This device is deregistered. Please register again.");
        }
        return user._id;
      },
      async updateUserProfile(_ref) {
        let {
          firstName,
          lastName,
          email
        } = _ref;
        check(firstName, String);
        check(lastName, String);
        check(email, String);
        console.log("Updating profile for user:", firstName, lastName, email);
        if (!this.userId) {
          throw new Meteor.Error("not-authorized", "You must be logged in to update your profile");
        }
        try {
          // Update the user's profile in the database
          Meteor.users.updateAsync(this.userId, {
            $set: {
              "profile.firstName": firstName,
              "profile.lastName": lastName,
              "emails.0.address": email
            }
          });
          return {
            success: true,
            message: "Profile updated successfully"
          };
        } catch (error) {
          console.error("Error updating profile:", error);
          throw new Meteor.Error("update-failed", "Failed to update profile", error);
        }
      },
      async "users.mapFCMTokenToUser"(userId, fcmToken) {
        check(userId, String);
        check(fcmToken, String);
        if (!this.userId) {
          throw new Meteor.Error("not-authorized", "User must be logged in");
        }
        const user = Meteor.users.findOne(userId);
        if (!user) {
          throw new Meteor.Error("user-not-found", "User not found");
        }

        // Map token to the user
        Meteor.users.update(userId, {
          $set: {
            "profile.fcmToken": fcmToken
          }
        });
      },
      async checkUsersExist() {
        try {
          const userCount = await Meteor.users.find().countAsync();
          console.log("User count:", userCount);
          return userCount > 0;
        } catch (error) {
          console.error("Error in checkUsersExist:", error);
          throw new Meteor.Error("server-error", "Failed to check user existence");
        }
      }
    });
    Meteor.startup(() => {
      // Meteor.publish('deviceLogs', function (deviceUuid) {
      //   console.log("Publishing deviceLogs for UUID:", deviceUuid);
      //   if (!deviceUuid) {
      //     console.log("No UUID provided, returning empty set");
      //     return this.ready();
      //   }
      //   const query = { deviceUUID: deviceUuid };
      //   console.log("MongoDB query:", query);
      //   const records = DeviceLogs.find(query, {
      //     fields: {
      //       deviceUUID: 1,
      //       email: 1,
      //       fcmToken: 1
      //     }
      //   });
      //   console.log("Found records count:", records.countAsync());
      //   return records;
      // });
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
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"private":{"miewebauthapp-b76936fb6ccc.json":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// server/private/miewebauthapp-b76936fb6ccc.json                                                               //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
module.exports = {
  "type": "service_account",
  "project_id": "miewebauthapp",
  "private_key_id": "b76936fb6ccc4f8977a3bcd3ce2bf5322a8598aa",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDIyAZSRKQEzaFT\nD8Ouz+hsBL1eV+Qi6w9Z1s5/Q5EL5WwXsNyxtqdu+EMDtdLLzIP5sM/xuMY+2mt0\nizZz0H0I7xADfe7gpeR2qT3/3yLuLCyX8U+9l9sA5uooAzR6YhWpYAH8FBLPPPJm\nNjKc0R/tLwX/pYNXfwgZjJvgYF+aqt9y90GgAkxNPdkxat1KGJLUeqyEoYYF+LiA\n9pVfEplTxmlPxsP02nOz/EO08sCfl1wgCHUZSQtI6fM9LmQtp6Db/8utmdde/PMh\nNfAn76TskSGLsEjRDzfY0ONrXbqJsH9cH088lTejx4TTcYywwrDxQr0UjFf71rgy\nT5C3i/LjAgMBAAECggEACFMthUEOAUT6vhRBQNZOBMHi4tkyFGCQBQxAXkvRj8oL\nbqVeq9+u7DhO+bBoSnBIaJSe3/Q8BA8lCsgFkffAYhvHcN2f3KCu6wdJaCU7BYpq\nBELKfkn1mAFQZChTMgqEa2ltAPlew55Qo/xLTO/pgE7FfjwWngzJATDbUF+ulx27\nuThneJH1Kl/uF5ZPpI8kycgHKxka+h7r9cerWVV7T1J1VTxovjF+sHdQ10+47FVm\nhVHTbPnVEjRmn/As3r4OS0QKkXUe5Zw3R6vkqOAnO4yZmTqrbsNUiimbwxXxCqT5\nf8O7zo/F0OS0ILnA7+aOTR/tkLq6QhISe3wnAiDjgQKBgQD7z39W/vLAdJ/RIpAK\nFS6qhHjq+XgJTOJYmVEE//j6Bn4rFuAvCXsETpaAsC4iRIqmAsobkivbg8lykPRS\nyVtqEV5irjVfhk0ScMvXSTeLHk61ORQ4UcSbH/a4YZGNSe27HKJUSpayDM2My/Tk\nlE80uN/Ggh0Y6fDrZl4m3X+pWQKBgQDMHy9/g8ipldA7muAsX3w+5gm0sBEMXzh4\nlaf4SOn0RDJzQojQNwhNS7WHWyMOxjrrXoejQAYh0s5F+rj8pFYKMywKRQL1dCeA\n21OUxych/6Qq9QCeTirl0GQJLtGQ7kyNCLrysJba8a7hqTmsejTZFCAieYkXrYBg\nv4Kji2x6mwKBgFYqqO6CC1tkDRQpeZSZrwBWmHH/r92u231p6VmGphIYirAAAfLW\nkavloIakwwSi47bvGW3Z1Pwm2pZDl/eEQ63GB8BI0KbBdDotMvOWcFVAp7pHr+2d\nvWM/ytNJP99TPvBaWgnyBCMlUmktmb1mKrxlzt1ExOQzmWdT/j/aZ8bxAoGBALFC\nI61Ic+lRABPC2wmtoee9PJB8lVF5H0EYNVWXfBNzZZxSGx01rS/ynyF8M2WRH3lm\nDcPmxWx59EcxA5Ph4hXZelUwuPEOfX+Y92wrxf/wUFA9ktvmZbpMzZJr5fFF/5Q6\nEJ7QWzCm0IeGvV7agSpCH+XQRQ0aznE13ezIFtwhAoGBALVLpDyN4/4cCZWzoJmn\nmRoR+fKOmhIYJo3h3lVaAD+QoCbFdjdJ4EQ9R3sCHfu8Kt5Pqkvq6P5qWrUMgbyq\nNNSDAcW/6jeYXTC9vFbAR+dWgNzDvI/u9CN1yBIyquXYdjYMQ/mi0fNUuVyIrAmj\nPS6dyf4pdr9y2FKg8jdfzSXQ\n-----END PRIVATE KEY-----\n",
  "client_email": "miewebauth@miewebauthapp.iam.gserviceaccount.com",
  "client_id": "118099088806649443889",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/miewebauth%40miewebauthapp.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}},{
  "extensions": [
    ".js",
    ".json",
    ".ts",
    ".mjs",
    ".jsx"
  ]
});


/* Exports */
return {
  require: require,
  eagerModulePaths: [
    "/server/main.js"
  ]
}});

//# sourceURL=meteor://💻app/app/app.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvaW1wb3J0cy9hcGkvZGV2aWNlTG9ncy5qcyIsIm1ldGVvcjovL/CfkrthcHAvaW1wb3J0cy9hcGkvbm90aWZpY2F0aW9uSGlzdG9yeS5qcyIsIm1ldGVvcjovL/CfkrthcHAvc2VydmVyL2ZpcmViYXNlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9zZXJ2ZXIvbWFpbi5qcyJdLCJuYW1lcyI6WyJtb2R1bGUiLCJleHBvcnQiLCJEZXZpY2VMb2dzIiwiTW9uZ28iLCJsaW5rIiwidiIsImNoZWNrIiwiU0hBMjU2IiwiX19yZWlmeVdhaXRGb3JEZXBzX18iLCJDb2xsZWN0aW9uIiwiZ2VuZXJhdGVBcHBJZCIsImRldmljZVVVSUQiLCJlbWFpbCIsImNyZWF0aW9uVGltZSIsImNvbWJpbmVkU3RyaW5nIiwiY29uY2F0Iiwic3Vic3RyaW5nIiwiTWV0ZW9yIiwiaXNTZXJ2ZXIiLCJzdGFydHVwIiwiY3JlYXRlSW5kZXgiLCJ1c2VySWQiLCJhcHBJZCIsIm1ldGhvZHMiLCJkZXZpY2VMb2dzLnVwc2VydCIsImRhdGEiLCJTdHJpbmciLCJmY21Ub2tlbiIsImRldmljZUluZm8iLCJPYmplY3QiLCJEYXRlIiwidG9JU09TdHJpbmciLCJjb25zb2xlIiwibG9nIiwidXBzZXJ0QXN5bmMiLCIkc2V0IiwibGFzdFVwZGF0ZWQiLCIkc2V0T25JbnNlcnQiLCJjcmVhdGVkQXQiLCJkZXZpY2VMb2dzLnVwZGF0ZVRva2VuIiwidXBkYXRlQXN5bmMiLCJkZXZpY2VMb2dzLmdldEZDTVRva2VuQnlBcHBJZCIsImRldmljZUxvZyIsImZpbmRPbmVBc3luYyIsIkVycm9yIiwiZGV2aWNlTG9ncy5nZXRGQ01Ub2tlbkJ5RGV2aWNlSWQiLCJkZXZpY2VMb2dzLmdldEJ5QXBwSWQiLCJyZXN1bHQiLCJwdWJsaXNoIiwiZmluZCIsIl9fcmVpZnlfYXN5bmNfcmVzdWx0X18iLCJfcmVpZnlFcnJvciIsInNlbGYiLCJhc3luYyIsIk5vdGlmaWNhdGlvbkhpc3RvcnkiLCJSYW5kb20iLCJub3RpZmljYXRpb25JZCIsInN0YXR1cyIsIm5vdGlmaWNhdGlvbkhpc3RvcnkuaW5zZXJ0IiwidGl0bGUiLCJib2R5IiwiaWQiLCJpbnNlcnRBc3luYyIsIm5vdGlmaWNhdGlvbkhpc3RvcnkudXBkYXRlU3RhdHVzIiwiaW5jbHVkZXMiLCJ1cGRhdGVkQXQiLCJub3RpZmljYXRpb25IaXN0b3J5LmdldExhc3RJZEJ5VXNlciIsInNvcnQiLCJmaWVsZHMiLCJ0aGVuIiwibGFzdE5vdGlmaWNhdGlvbiIsImNhdGNoIiwiZXJyb3IiLCJub3RpZmljYXRpb25IaXN0b3J5LmdldEJ5VXNlciIsImZldGNoIiwibm90aWZpY2F0aW9uSGlzdG9yeS5nZXRCeVN0YXR1cyIsInNlbmROb3RpZmljYXRpb24iLCJhZG1pbiIsImRlZmF1bHQiLCJzZXJ2aWNlQWNjb3VudCIsImluaXRpYWxpemVBcHAiLCJjcmVkZW50aWFsIiwiY2VydCIsInJlZ2lzdHJhdGlvblRva2VuIiwiYWN0aW9ucyIsIm1lc3NhZ2UiLCJ0b2tlbiIsIkpTT04iLCJzdHJpbmdpZnkiLCJtZXNzYWdlRnJvbSIsIm5vdGlmaWNhdGlvblR5cGUiLCJjb250ZW50X2F2YWlsYWJsZSIsIm5vdElkIiwiYW5kcm9pZCIsInByaW9yaXR5IiwiYXBucyIsInBheWxvYWQiLCJhcHMiLCJhbGVydCIsImJhZGdlIiwic291bmQiLCJjYXRlZ29yeSIsIm11dGFibGVfY29udGVudCIsInJlc3BvbnNlIiwibWVzc2FnaW5nIiwic2VuZCIsImV4cG9ydERlZmF1bHQiLCJXZWJBcHAiLCJBY2NvdW50cyIsInBlbmRpbmdOb3RpZmljYXRpb25zIiwiTWFwIiwicmVzcG9uc2VQcm9taXNlcyIsInNhdmVVc2VyTm90aWZpY2F0aW9uSGlzdG9yeSIsIm5vdGlmaWNhdGlvbiIsImNhbGwiLCJjb25uZWN0SGFuZGxlcnMiLCJ1c2UiLCJyZXEiLCJyZXMiLCJvbiIsImNodW5rIiwicmVxdWVzdEJvZHkiLCJwYXJzZSIsIm1lc3NhZ2VCb2R5IiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJ1c2VyUmVzcG9uc2VQcm9taXNlIiwic2V0Iiwic2V0VGltZW91dCIsImhhcyIsImRlbGV0ZSIsInVzZXJSZXNwb25zZSIsIndyaXRlSGVhZCIsImVuZCIsInN1Y2Nlc3MiLCJhY3Rpb24iLCJub3RpZmljYXRpb25zLmhhbmRsZVJlc3BvbnNlIiwiZ2V0IiwidXNlckFjdGlvbiIsInJlcXVlc3RJZCIsInJlcGx5VGV4dCIsImFyZ3VtZW50cyIsImxlbmd0aCIsInVuZGVmaW5lZCIsInZhbGlkQWN0aW9ucyIsInBlbmRpbmdOb3RpZmljYXRpb24iLCJjbGVhclRpbWVvdXQiLCJ0aW1lb3V0IiwidXNlcnMucmVnaXN0ZXIiLCJ1c2VyRGV0YWlscyIsInBpbiIsImZpcnN0TmFtZSIsImxhc3ROYW1lIiwic2Vzc2lvbkRldmljZUluZm8iLCJtb2RlbCIsInBsYXRmb3JtIiwidXVpZCIsInZlcnNpb24iLCJtYW51ZmFjdHVyZXIiLCJmY21EZXZpY2VUb2tlbiIsInVzZXJzIiwiY3JlYXRlVXNlciIsInBhc3N3b3JkIiwicHJvZmlsZSIsImRldmljZVRva2VuIiwidG9TdHJpbmciLCJnZXRVc2VyRGV0YWlscyIsIl91c2VyJHByb2ZpbGUiLCJfdXNlciRwcm9maWxlMiIsInVzZXIiLCJlbWFpbHMiLCJhZGRyZXNzIiwidXNlcnMuY2hlY2tSZWdpc3RyYXRpb24iLCJfaWQiLCJ1cGRhdGVVc2VyUHJvZmlsZSIsIl9yZWYiLCJ1c2Vycy5tYXBGQ01Ub2tlblRvVXNlciIsImZpbmRPbmUiLCJ1cGRhdGUiLCJjaGVja1VzZXJzRXhpc3QiLCJ1c2VyQ291bnQiLCJjb3VudEFzeW5jIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBQUFBLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDO01BQUNDLFVBQVUsRUFBQ0EsQ0FBQSxLQUFJQTtJQUFVLENBQUMsQ0FBQztJQUFDLElBQUlDLEtBQUs7SUFBQ0gsTUFBTSxDQUFDSSxJQUFJLENB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TzdHLEtBQUssRUFBRTtVQUNkeEMsT0FBTyxDQUFDd0MsS0FBSyxDQUFDLDJCQUEyQixFQUFFQSxLQUFLLENBQUM7VUFDakQsTUFBTSxJQUFJdkQsTUFBTSxDQUFDMkIsS0FBSyxDQUFDLGNBQWMsRUFBRSxnQ0FBZ0MsQ0FBQztRQUMxRTtNQUNGO0lBQ0YsQ0FBQyxDQUFDO0lBRUYzQixNQUFNLENBQUNFLE9BQU8sQ0FBQyxNQUFNO01BQ25CO01BQ0E7TUFDQTtNQUNBO01BQ0E7TUFDQTtNQUNBO01BQ0E7TUFDQTtNQUNBO01BQ0E7TUFDQTtNQUNBO01BQ0E7TUFDQTtNQUNBO01BQ0E7TUFDQTtJQUFBLENBQ0QsQ0FBQztJQUFDK0Isc0JBQUE7RUFBQSxTQUFBQyxXQUFBO0lBQUEsT0FBQUQsc0JBQUEsQ0FBQUMsV0FBQTtFQUFBO0VBQUFELHNCQUFBO0FBQUE7RUFBQUUsSUFBQTtFQUFBQyxLQUFBO0FBQUEsRyIsImZpbGUiOiIvYXBwLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTW9uZ28gfSBmcm9tICdtZXRlb3IvbW9uZ28nO1xuaW1wb3J0IHsgY2hlY2sgfSBmcm9tICdtZXRlb3IvY2hlY2snO1xuaW1wb3J0IHsgU0hBMjU2IH0gZnJvbSAnbWV0ZW9yL3NoYSc7IFxuXG5leHBvcnQgY29uc3QgRGV2aWNlTG9ncyA9IG5ldyBNb25nby5Db2xsZWN0aW9uKCdkZXZpY2VMb2dzJyk7XG5cblxuXG4vLyBBZGQgZ2VuZXJhdGVBcHBJZCB1dGlsaXR5IGZ1bmN0aW9uXG5jb25zdCBnZW5lcmF0ZUFwcElkID0gKGRldmljZVVVSUQsIGVtYWlsLCBjcmVhdGlvblRpbWUpID0+IHtcbiAgICBjb25zdCBjb21iaW5lZFN0cmluZyA9IGAke2RldmljZVVVSUR9OiR7ZW1haWx9OiR7Y3JlYXRpb25UaW1lfWA7XG4gICAgcmV0dXJuIFNIQTI1Nihjb21iaW5lZFN0cmluZykuc3Vic3RyaW5nKDAsIDMyKTtcbiAgfTtcbiAgXG5cbi8vIENyZWF0ZSBpbmRleGVzIGZvciBiZXR0ZXIgcXVlcnkgcGVyZm9ybWFuY2VcbmlmIChNZXRlb3IuaXNTZXJ2ZXIpIHtcbiAgTWV0ZW9yLnN0YXJ0dXAoKCkgPT4ge1xuICAgIERldmljZUxvZ3MuY3JlYXRlSW5kZXgoeyB1c2VySWQ6IDEgfSk7XG4gICAgRGV2aWNlTG9ncy5jcmVhdGVJbmRleCh7IGRldmljZVVVSUQ6IDEgfSk7XG4gICAgRGV2aWNlTG9ncy5jcmVhdGVJbmRleCh7IGVtYWlsOiAxIH0pO1xuICAgIERldmljZUxvZ3MuY3JlYXRlSW5kZXgoeyBhcHBJZDogMSB9KTtcbiAgfSk7XG59XG5cbi8vIERlZmluZSBtZXRob2RzIGZvciBEZXZpY2VMb2dzXG5NZXRlb3IubWV0aG9kcyh7XG4gICAgJ2RldmljZUxvZ3MudXBzZXJ0JzogYXN5bmMgZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICBjaGVjayhkYXRhLCB7XG4gICAgICAgICAgdXNlcklkOiBTdHJpbmcsXG4gICAgICAgICAgZW1haWw6IFN0cmluZyxcbiAgICAgICAgICBkZXZpY2VVVUlEOiBTdHJpbmcsXG4gICAgICAgICAgZmNtVG9rZW46IFN0cmluZyxcbiAgICAgICAgICBkZXZpY2VJbmZvOiBPYmplY3QsXG4gICAgICAgIH0pO1xuICAgICAgXG4gICAgICAgIGNvbnN0IGNyZWF0aW9uVGltZSA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgICAgICAgY29uc3QgYXBwSWQgPSBnZW5lcmF0ZUFwcElkKGRhdGEuZGV2aWNlVVVJRCwgZGF0YS5lbWFpbCwgY3JlYXRpb25UaW1lKTtcbiAgICAgICAgY29uc29sZS5sb2coJ0dlbmVyYXRlZCBhcHBJZCBkdXJpbmcgdXBzZXJ0OicsIGFwcElkKTsgLy8gQWRkIHRoaXMgbG9nXG4gICAgICAgIFxuICAgICAgICByZXR1cm4gRGV2aWNlTG9ncy51cHNlcnRBc3luYyhcbiAgICAgICAgICB7XG4gICAgICAgICAgICB1c2VySWQ6IGRhdGEudXNlcklkLFxuICAgICAgICAgICAgZGV2aWNlVVVJRDogZGF0YS5kZXZpY2VVVUlELFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgJHNldDoge1xuICAgICAgICAgICAgICBlbWFpbDogZGF0YS5lbWFpbCxcbiAgICAgICAgICAgICAgZmNtVG9rZW46IGRhdGEuZmNtVG9rZW4sXG4gICAgICAgICAgICAgIGFwcElkOiBhcHBJZCxcbiAgICAgICAgICAgICAgbGFzdFVwZGF0ZWQ6IG5ldyBEYXRlKCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgJHNldE9uSW5zZXJ0OiB7XG4gICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgfSxcbiAgJ2RldmljZUxvZ3MudXBkYXRlVG9rZW4nKHVzZXJJZCwgZGV2aWNlVVVJRCwgZmNtVG9rZW4pIHtcbiAgICBjaGVjayh1c2VySWQsIFN0cmluZyk7XG4gICAgY2hlY2soZGV2aWNlVVVJRCwgU3RyaW5nKTtcbiAgICBjaGVjayhmY21Ub2tlbiwgU3RyaW5nKTtcblxuICAgIHJldHVybiBEZXZpY2VMb2dzLnVwZGF0ZUFzeW5jKFxuICAgICAgeyBcbiAgICAgICAgdXNlcklkOiB1c2VySWQsXG4gICAgICAgIGRldmljZVVVSUQ6IGRldmljZVVVSUQgXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICAkc2V0OiB7XG4gICAgICAgICAgZmNtVG9rZW46IGZjbVRva2VuLFxuICAgICAgICAgIGxhc3RVcGRhdGVkOiBuZXcgRGF0ZSgpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICApO1xuICB9LFxuICAnZGV2aWNlTG9ncy5nZXRGQ01Ub2tlbkJ5QXBwSWQnOiBhc3luYyBmdW5jdGlvbihhcHBJZCkge1xuICAgIGNoZWNrKGFwcElkLCBTdHJpbmcpO1xuICAgIFxuICAgIGNvbnN0IGRldmljZUxvZyA9IGF3YWl0IERldmljZUxvZ3MuZmluZE9uZUFzeW5jKHsgYXBwSWQ6IGFwcElkIH0pO1xuICAgIFxuICAgIGlmICghZGV2aWNlTG9nKSB7XG4gICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdpbnZhbGlkLWFwcC1pZCcsICdObyBkZXZpY2UgZm91bmQgd2l0aCB0aGlzIEFwcCBJRCcpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZGV2aWNlTG9nLmZjbVRva2VuO1xuICB9LFxuICAnZGV2aWNlTG9ncy5nZXRGQ01Ub2tlbkJ5RGV2aWNlSWQnOiBhc3luYyBmdW5jdGlvbihkZXZpY2VVVUlEKSB7XG4gICAgY2hlY2soZGV2aWNlVVVJRCwgU3RyaW5nKTtcbiAgICBcbiAgICBjb25zdCBkZXZpY2VMb2cgPSBhd2FpdCBEZXZpY2VMb2dzLmZpbmRPbmVBc3luYyh7IGRldmljZVVVSUQ6IGRldmljZVVVSUQgfSk7XG4gICAgXG4gICAgaWYgKCFkZXZpY2VMb2cpIHtcbiAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2ludmFsaWQtYXBwLWlkJywgJ05vIGRldmljZSBmb3VuZCB3aXRoIHRoaXMgRGV2aWNlIElEJyk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBkZXZpY2VMb2cuZmNtVG9rZW47XG4gIH0sXG4gIFxuICAvLyBBbHNvIGZpeCB0aGUgZGVidWcgbWV0aG9kXG4gICdkZXZpY2VMb2dzLmdldEJ5QXBwSWQnOiBhc3luYyBmdW5jdGlvbihhcHBJZCkge1xuICAgIGNoZWNrKGFwcElkLCBTdHJpbmcpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IERldmljZUxvZ3MuZmluZE9uZUFzeW5jKHsgYXBwSWQgfSk7XG4gICAgY29uc29sZS5sb2coJ0xvb2tpbmcgZm9yIGFwcElkOicsIGFwcElkKTtcbiAgICBjb25zb2xlLmxvZygnRm91bmQgZGV2aWNlIGxvZzonLCByZXN1bHQpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn0pO1xuXG4vLyBQdWJsaXNoIGRldmljZSBsb2dzXG5pZiAoTWV0ZW9yLmlzU2VydmVyKSB7XG4gIE1ldGVvci5wdWJsaXNoKCdkZXZpY2VMb2dzLmJ5VXNlcicsIGZ1bmN0aW9uKHVzZXJJZCkge1xuICAgIGNoZWNrKHVzZXJJZCwgU3RyaW5nKTtcbiAgICByZXR1cm4gRGV2aWNlTG9ncy5maW5kKHsgdXNlcklkOiB1c2VySWQgfSk7XG4gIH0pO1xuXG4gIE1ldGVvci5wdWJsaXNoKCdkZXZpY2VMb2dzLmJ5RGV2aWNlJywgZnVuY3Rpb24oZGV2aWNlVVVJRCkge1xuICAgIGNoZWNrKGRldmljZVVVSUQsIFN0cmluZyk7XG4gICAgcmV0dXJuIERldmljZUxvZ3MuZmluZCh7IGRldmljZVVVSUQ6IGRldmljZVVVSUQgfSk7XG4gIH0pO1xufSIsImltcG9ydCB7IE1vbmdvIH0gZnJvbSAnbWV0ZW9yL21vbmdvJztcbmltcG9ydCB7IGNoZWNrIH0gZnJvbSAnbWV0ZW9yL2NoZWNrJztcbmltcG9ydCB7IFJhbmRvbSB9IGZyb20gJ21ldGVvci9yYW5kb20nO1xuXG5leHBvcnQgY29uc3QgTm90aWZpY2F0aW9uSGlzdG9yeSA9IG5ldyBNb25nby5Db2xsZWN0aW9uKCdub3RpZmljYXRpb25IaXN0b3J5Jyk7XG5cbi8vIENyZWF0ZSBpbmRleGVzIGZvciBiZXR0ZXIgcXVlcnkgcGVyZm9ybWFuY2VcbmlmIChNZXRlb3IuaXNTZXJ2ZXIpIHtcbiAgTWV0ZW9yLnN0YXJ0dXAoKCkgPT4ge1xuICAgIE5vdGlmaWNhdGlvbkhpc3RvcnkuY3JlYXRlSW5kZXgoeyB1c2VySWQ6IDEgfSk7XG4gICAgTm90aWZpY2F0aW9uSGlzdG9yeS5jcmVhdGVJbmRleCh7IGFwcElkOiAxIH0pO1xuICAgIE5vdGlmaWNhdGlvbkhpc3RvcnkuY3JlYXRlSW5kZXgoeyBub3RpZmljYXRpb25JZDogMSB9KTtcbiAgICBOb3RpZmljYXRpb25IaXN0b3J5LmNyZWF0ZUluZGV4KHsgc3RhdHVzOiAxIH0pO1xuICB9KTtcbn1cblxuTWV0ZW9yLm1ldGhvZHMoe1xuICAvLyBJbnNlcnQgYSBuZXcgbm90aWZpY2F0aW9uIGludG8gdGhlIGhpc3RvcnlcbiAgJ25vdGlmaWNhdGlvbkhpc3RvcnkuaW5zZXJ0JzogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICBjaGVjayhkYXRhLCB7XG4gICAgICB1c2VySWQ6IFN0cmluZyxcbiAgICAgIGFwcElkOiBTdHJpbmcsXG4gICAgICB0aXRsZTogU3RyaW5nLFxuICAgICAgYm9keTogU3RyaW5nLFxuICAgIH0pO1xuXG4gICAgLy8gRHluYW1pY2FsbHkgZ2VuZXJhdGUgYSB1bmlxdWUgbm90aWZpY2F0aW9uSWRcbiAgICBjb25zdCBub3RpZmljYXRpb25JZCA9IFJhbmRvbS5pZCgpO1xuXG4gICAgcmV0dXJuIE5vdGlmaWNhdGlvbkhpc3RvcnkuaW5zZXJ0QXN5bmMoe1xuICAgICAgdXNlcklkOiBkYXRhLnVzZXJJZCxcbiAgICAgIGFwcElkOiBkYXRhLmFwcElkLFxuICAgICAgbm90aWZpY2F0aW9uSWQ6IG5vdGlmaWNhdGlvbklkLFxuICAgICAgdGl0bGU6IGRhdGEudGl0bGUsXG4gICAgICBib2R5OiBkYXRhLmJvZHksXG4gICAgICBzdGF0dXM6ICdwZW5kaW5nJyxcbiAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKVxuICAgIH0pO1xuICB9LFxuXG4gIC8vIFVwZGF0ZSB0aGUgc3RhdHVzIG9mIGEgbm90aWZpY2F0aW9uXG4gICdub3RpZmljYXRpb25IaXN0b3J5LnVwZGF0ZVN0YXR1cyc6IGZ1bmN0aW9uIChub3RpZmljYXRpb25JZCwgc3RhdHVzKSB7XG4gICAgY2hlY2sobm90aWZpY2F0aW9uSWQsIFN0cmluZyk7XG4gICAgY2hlY2soc3RhdHVzLCBTdHJpbmcpO1xuXG4gICAgaWYgKCFbJ3BlbmRpbmcnLCAnYXBwcm92ZWQnLCAncmVqZWN0ZWQnXS5pbmNsdWRlcyhzdGF0dXMpKSB7XG4gICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdpbnZhbGlkLXN0YXR1cycsICdTdGF0dXMgbXVzdCBiZSBwZW5kaW5nLCBhY2NlcHRlZCwgb3IgcmVqZWN0ZWQnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gTm90aWZpY2F0aW9uSGlzdG9yeS51cGRhdGVBc3luYyhcbiAgICAgIHsgbm90aWZpY2F0aW9uSWQgfSxcbiAgICAgIHtcbiAgICAgICAgJHNldDoge1xuICAgICAgICAgIHN0YXR1czogc3RhdHVzLFxuICAgICAgICAgIHVwZGF0ZWRBdDogbmV3IERhdGUoKSwgLy8gVGltZXN0YW1wIGZvciBzdGF0dXMgdXBkYXRlXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgKTtcbiAgfSxcblxuLy8gRmV0Y2ggdGhlIGxhc3Qgbm90aWZpY2F0aW9uIElEIGZvciBhIHNwZWNpZmljIHVzZXJcbidub3RpZmljYXRpb25IaXN0b3J5LmdldExhc3RJZEJ5VXNlcic6IGZ1bmN0aW9uICh1c2VySWQpIHtcbiAgY2hlY2sodXNlcklkLCBTdHJpbmcpO1xuXG4gIHJldHVybiBOb3RpZmljYXRpb25IaXN0b3J5LmZpbmRPbmVBc3luYyhcbiAgICB7IHVzZXJJZCB9LFxuICAgIHsgc29ydDogeyBjcmVhdGVkQXQ6IC0xIH0sIGZpZWxkczogeyBub3RpZmljYXRpb25JZDogMSB9IH1cbiAgKS50aGVuKChsYXN0Tm90aWZpY2F0aW9uKSA9PiB7XG4gICAgcmV0dXJuIGxhc3ROb3RpZmljYXRpb24gPyBsYXN0Tm90aWZpY2F0aW9uLm5vdGlmaWNhdGlvbklkIDogbnVsbDtcbiAgfSkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgY29uc29sZS5lcnJvcihcIkVycm9yIGZldGNoaW5nIGxhc3Qgbm90aWZpY2F0aW9uOlwiLCBlcnJvcik7XG4gICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcihcImRhdGFiYXNlLWVycm9yXCIsIFwiRmFpbGVkIHRvIGZldGNoIGxhc3Qgbm90aWZpY2F0aW9uXCIpO1xuICB9KTtcbn0sXG5cbiAgLy8gRmV0Y2ggYWxsIG5vdGlmaWNhdGlvbnMgZm9yIGEgdXNlclxuICAnbm90aWZpY2F0aW9uSGlzdG9yeS5nZXRCeVVzZXInOiBmdW5jdGlvbiAodXNlcklkKSB7XG4gICAgY2hlY2sodXNlcklkLCBTdHJpbmcpO1xuICAgIHJldHVybiBOb3RpZmljYXRpb25IaXN0b3J5LmZpbmQoeyB1c2VySWQgfSkuZmV0Y2goKTtcbiAgfSxcblxuICAvLyBGZXRjaCBub3RpZmljYXRpb25zIGJ5IHRoZWlyIHN0YXR1c1xuICAnbm90aWZpY2F0aW9uSGlzdG9yeS5nZXRCeVN0YXR1cyc6IGZ1bmN0aW9uIChzdGF0dXMpIHtcbiAgICBjaGVjayhzdGF0dXMsIFN0cmluZyk7XG5cbiAgICBpZiAoIVsncGVuZGluZycsICdhY2NlcHRlZCcsICdyZWplY3RlZCddLmluY2x1ZGVzKHN0YXR1cykpIHtcbiAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2ludmFsaWQtc3RhdHVzJywgJ1N0YXR1cyBtdXN0IGJlIHBlbmRpbmcsIGFjY2VwdGVkLCBvciByZWplY3RlZCcpO1xuICAgIH1cblxuICAgIHJldHVybiBOb3RpZmljYXRpb25IaXN0b3J5LmZpbmQoeyBzdGF0dXMgfSkuZmV0Y2goKTtcbiAgfSxcbn0pO1xuXG5pZiAoTWV0ZW9yLmlzU2VydmVyKSB7XG4gIE1ldGVvci5wdWJsaXNoKCdub3RpZmljYXRpb25IaXN0b3J5LmJ5VXNlcicsIGZ1bmN0aW9uICh1c2VySWQpIHtcbiAgICBjaGVjayh1c2VySWQsIFN0cmluZyk7XG4gICAgcmV0dXJuIE5vdGlmaWNhdGlvbkhpc3RvcnkuZmluZCh7IHVzZXJJZCB9KTtcbiAgfSk7XG5cbiAgTWV0ZW9yLnB1Ymxpc2goJ25vdGlmaWNhdGlvbkhpc3RvcnkuYnlTdGF0dXMnLCBmdW5jdGlvbiAoc3RhdHVzKSB7XG4gICAgY2hlY2soc3RhdHVzLCBTdHJpbmcpO1xuICAgIHJldHVybiBOb3RpZmljYXRpb25IaXN0b3J5LmZpbmQoeyBzdGF0dXMgfSk7XG4gIH0pO1xufVxuXG5cbiIsImltcG9ydCBhZG1pbiBmcm9tICdmaXJlYmFzZS1hZG1pbic7XG5pbXBvcnQgc2VydmljZUFjY291bnQgZnJvbSAnLi4vc2VydmVyL3ByaXZhdGUvbWlld2ViYXV0aGFwcC1iNzY5MzZmYjZjY2MuanNvbic7XG5cblxuYWRtaW4uaW5pdGlhbGl6ZUFwcCh7XG4gIGNyZWRlbnRpYWw6IGFkbWluLmNyZWRlbnRpYWwuY2VydChzZXJ2aWNlQWNjb3VudClcbn0pO1xuLyoqXG4gKiBTZW5kcyBhIHB1c2ggbm90aWZpY2F0aW9uIHRvIGEgc3BlY2lmaWMgZGV2aWNlLlxuICogQHBhcmFtIHtzdHJpbmd9IHJlZ2lzdHJhdGlvblRva2VuIC0gVGhlIHRhcmdldCBkZXZpY2UgdG9rZW4uXG4gKiBAcGFyYW0ge3N0cmluZ30gdGl0bGUgLSBUaGUgbm90aWZpY2F0aW9uIHRpdGxlLlxuICogQHBhcmFtIHtzdHJpbmd9IGJvZHkgLSBUaGUgbm90aWZpY2F0aW9uIGJvZHkuXG4gKiBAcGFyYW0ge0FycmF5fSBhY3Rpb25zIC0gVGhlIGFjdGlvbnMgdG8gaW5jbHVkZSBpbiB0aGUgbm90aWZpY2F0aW9uLlxuICovXG5leHBvcnQgY29uc3Qgc2VuZE5vdGlmaWNhdGlvbiA9IGFzeW5jIChyZWdpc3RyYXRpb25Ub2tlbiwgdGl0bGUsIGJvZHksIGFjdGlvbnMpID0+IHtcbiAgY29uc3QgbWVzc2FnZSA9IHtcbiAgICB0b2tlbjogcmVnaXN0cmF0aW9uVG9rZW4sXG4gICAgZGF0YToge1xuICAgICAgdGl0bGUsXG4gICAgICBib2R5LFxuICAgICAgYXBwSWQ6IHJlZ2lzdHJhdGlvblRva2VuLFxuICAgICAgYWN0aW9uczogSlNPTi5zdHJpbmdpZnkoYWN0aW9ucyksXG4gICAgICBtZXNzYWdlRnJvbTogJ21pZScsXG4gICAgICBub3RpZmljYXRpb25UeXBlOiAnYXBwcm92YWwnLFxuICAgICAgY29udGVudF9hdmFpbGFibGU6ICcxJyxcbiAgICAgIG5vdElkOiAnMTAnLFxuICAgICAgLy8gc3VydmV5SUQ6IFwiZXd0YXdncmVnLWdyYWdyYWctcmdhcmh0aGdiYWRcIlxuICAgIH0sXG4gICAgYW5kcm9pZDoge1xuICAgICAgcHJpb3JpdHk6ICdoaWdoJyxcbiAgICB9LFxuICAgIGFwbnM6IHtcbiAgICAgIHBheWxvYWQ6IHtcbiAgICAgICAgYXBzOiB7XG4gICAgICAgICAgYWxlcnQ6IHtcbiAgICAgICAgICAgIHRpdGxlLFxuICAgICAgICAgICAgYm9keVxuICAgICAgICAgIH0sXG4gICAgICAgICAgYmFkZ2U6IDEsXG4gICAgICAgICAgc291bmQ6IFwiZGVmYXVsdFwiLFxuICAgICAgICAgIGNhdGVnb3J5OiBcIkFQUFJPVkFMXCIsXG4gICAgICAgICAgY29udGVudF9hdmFpbGFibGU6IDEsXG4gICAgICAgICAgbXV0YWJsZV9jb250ZW50OiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgdHJ5IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGFkbWluLm1lc3NhZ2luZygpLnNlbmQobWVzc2FnZSk7XG4gICAgY29uc29sZS5sb2coJ1B1c2ggbm90aWZpY2F0aW9uIHNlbnQgc3VjY2Vzc2Z1bGx5OicsIHJlc3BvbnNlKTtcbiAgICByZXR1cm4gcmVzcG9uc2U7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyb3Igc2VuZGluZyBwdXNoIG5vdGlmaWNhdGlvbjonLCBlcnJvcik7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn07XG5leHBvcnQgZGVmYXVsdCBhZG1pbjsiLCJpbXBvcnQgeyBNZXRlb3IgfSBmcm9tIFwibWV0ZW9yL21ldGVvclwiO1xuaW1wb3J0IHsgV2ViQXBwIH0gZnJvbSBcIm1ldGVvci93ZWJhcHBcIjtcbmltcG9ydCB7IHNlbmROb3RpZmljYXRpb24gfSBmcm9tIFwiLi9maXJlYmFzZVwiO1xuaW1wb3J0IHsgQWNjb3VudHMgfSBmcm9tIFwibWV0ZW9yL2FjY291bnRzLWJhc2VcIjtcbmltcG9ydCBcIi4uL2ltcG9ydHMvYXBpL2RldmljZUxvZ3MuanNcIjtcbmltcG9ydCB7IGNoZWNrIH0gZnJvbSBcIm1ldGVvci9jaGVja1wiO1xuaW1wb3J0IHsgRGV2aWNlTG9ncyB9IGZyb20gXCIuLi9pbXBvcnRzL2FwaS9kZXZpY2VMb2dzLmpzXCI7XG5pbXBvcnQgeyBOb3RpZmljYXRpb25IaXN0b3J5IH0gZnJvbSBcIi4uL2ltcG9ydHMvYXBpL25vdGlmaWNhdGlvbkhpc3RvcnlcIjtcblxuLy8gQ3JlYXRlIGEgTWFwIHRvIHN0b3JlIHBlbmRpbmcgbm90aWZpY2F0aW9uc1xuY29uc3QgcGVuZGluZ05vdGlmaWNhdGlvbnMgPSBuZXcgTWFwKCk7XG5jb25zdCByZXNwb25zZVByb21pc2VzID0gbmV3IE1hcCgpO1xuXG5jb25zdCBzYXZlVXNlck5vdGlmaWNhdGlvbkhpc3RvcnkgPSBhc3luYyAobm90aWZpY2F0aW9uKSA9PiB7XG4gIGNvbnN0IHsgYXBwSWQsIHRpdGxlLCBib2R5IH0gPSBub3RpZmljYXRpb247XG5cbiAgY29uc3QgZGV2aWNlTG9nID0gYXdhaXQgRGV2aWNlTG9ncy5maW5kT25lQXN5bmMoeyBhcHBJZCB9KTtcbiAgaWYgKCFkZXZpY2VMb2cpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiTm8gdXNlciBmb3VuZCBmb3IgYXBwSWQ6XCIsIGFwcElkKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCB1c2VySWQgPSBkZXZpY2VMb2cudXNlcklkO1xuXG4gIGNvbnN0IGRhdGEgPSB7XG4gICAgdXNlcklkLFxuICAgIGFwcElkLFxuICAgIHRpdGxlLFxuICAgIGJvZHksXG4gIH07XG5cbiAgTWV0ZW9yLmNhbGwoXCJub3RpZmljYXRpb25IaXN0b3J5Lmluc2VydFwiLCBkYXRhLCAoZXJyb3IsIHJlc3VsdCkgPT4ge1xuICAgIGlmIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluc2VydGluZyBub3RpZmljYXRpb246XCIsIGVycm9yKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coXCJOb3RpZmljYXRpb24gaW5zZXJ0ZWQgc3VjY2Vzc2Z1bGx5OlwiLCByZXN1bHQpO1xuICAgIH1cbiAgfSk7XG59O1xuXG5XZWJBcHAuY29ubmVjdEhhbmRsZXJzLnVzZShcIi9zZW5kLW5vdGlmaWNhdGlvblwiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgbGV0IGJvZHkgPSBcIlwiO1xuXG4gIHJlcS5vbihcImRhdGFcIiwgKGNodW5rKSA9PiB7XG4gICAgYm9keSArPSBjaHVuaztcbiAgfSk7XG5cbiAgcmVxLm9uKFwiZW5kXCIsIGFzeW5jICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVxdWVzdEJvZHkgPSBKU09OLnBhcnNlKGJvZHkpO1xuICAgICAgY29uc29sZS5sb2coXCJSZWNlaXZlZCByZXF1ZXN0IGJvZHk6XCIsIHJlcXVlc3RCb2R5KTtcblxuICAgICAgY29uc3QgeyBhcHBJZCwgdGl0bGUsIGJvZHk6IG1lc3NhZ2VCb2R5LCBhY3Rpb25zIH0gPSByZXF1ZXN0Qm9keTtcblxuICAgICAgaWYgKCFhcHBJZCB8fCAhdGl0bGUgfHwgIW1lc3NhZ2VCb2R5IHx8ICFhY3Rpb25zKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk1pc3NpbmcgcmVxdWlyZWQgZmllbGRzXCIpO1xuICAgICAgfVxuXG4gICAgICAvLyBHZXQgRkNNIHRva2VuXG4gICAgICBjb25zdCBmY21Ub2tlbiA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgTWV0ZW9yLmNhbGwoXCJkZXZpY2VMb2dzLmdldEZDTVRva2VuQnlBcHBJZFwiLCBhcHBJZCwgKGVycm9yLCByZXN1bHQpID0+IHtcbiAgICAgICAgICBpZiAoZXJyb3IpIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgZWxzZSByZXNvbHZlKHJlc3VsdCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIFNlbmQgbm90aWZpY2F0aW9uXG4gICAgICBhd2FpdCBzZW5kTm90aWZpY2F0aW9uKGZjbVRva2VuLCB0aXRsZSwgbWVzc2FnZUJvZHksIGFjdGlvbnMpO1xuICAgICAgY29uc29sZS5sb2coXCJOb3RpZmljYXRpb24gc2VudCBzdWNjZXNzZnVsbHlcIik7XG4gICAgICBzYXZlVXNlck5vdGlmaWNhdGlvbkhpc3RvcnkoeyBhcHBJZCwgdGl0bGUsIGJvZHk6IG1lc3NhZ2VCb2R5IH0pO1xuXG4gICAgICAvLyBDcmVhdGUgcHJvbWlzZSBmb3IgdXNlciByZXNwb25zZVxuICAgICAgY29uc3QgdXNlclJlc3BvbnNlUHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgIC8vIFN0b3JlIHRoZSBGQ00gdG9rZW4gYXMgdGhlIGFwcElkIHNpbmNlIHRoYXQncyB3aGF0IHdlJ2xsIGdldCBiYWNrXG4gICAgICAgIGNvbnNvbGUubG9nKFwiRkNNIHRva2Vubm5ubm5ubm5ubm5uXCIsIGZjbVRva2VuKTtcbiAgICAgICAgcmVzcG9uc2VQcm9taXNlcy5zZXQoZmNtVG9rZW4sIHJlc29sdmUpO1xuXG4gICAgICAgIC8vIEFkZCB0aW1lb3V0XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgIGlmIChyZXNwb25zZVByb21pc2VzLmhhcyhmY21Ub2tlbikpIHtcbiAgICAgICAgICAgIHJlc29sdmUoXCJ0aW1lb3V0XCIpO1xuICAgICAgICAgICAgcmVzcG9uc2VQcm9taXNlcy5kZWxldGUoZmNtVG9rZW4pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgMzAwMDAwKTsgLy8gNSBtaW51dGUgdGltZW91dFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFdhaXQgZm9yIHVzZXIgcmVzcG9uc2VcbiAgICAgIGNvbnN0IHVzZXJSZXNwb25zZSA9IGF3YWl0IHVzZXJSZXNwb25zZVByb21pc2U7XG4gICAgICBjb25zb2xlLmxvZyhcIlVTRVIgUkVTUE9OU0VcIiwgdXNlclJlc3BvbnNlKTtcblxuICAgICAgLy8gU2VuZCBmaW5hbCByZXNwb25zZVxuICAgICAgcmVzLndyaXRlSGVhZCgyMDAsIHsgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSk7XG4gICAgICByZXMuZW5kKFxuICAgICAgICBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICBhY3Rpb246IHVzZXJSZXNwb25zZSxcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiAvc2VuZC1ub3RpZmljYXRpb246XCIsIGVycm9yKTtcbiAgICAgIHJlcy53cml0ZUhlYWQoNDAwLCB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0pO1xuICAgICAgcmVzLmVuZChcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgIGVycm9yOiBlcnJvci5tZXNzYWdlLFxuICAgICAgICB9KVxuICAgICAgKTtcbiAgICB9XG4gIH0pO1xufSk7XG5cbi8vIE1ldGVvciBtZXRob2RzXG5NZXRlb3IubWV0aG9kcyh7XG4gIGFzeW5jIFwibm90aWZpY2F0aW9ucy5oYW5kbGVSZXNwb25zZVwiKGFwcElkLCBhY3Rpb24pIHtcbiAgICBjaGVjayhhcHBJZCwgU3RyaW5nKTtcbiAgICBjaGVjayhhY3Rpb24sIFN0cmluZyk7XG5cbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBIYW5kbGluZyBub3RpZmljYXRpb24gcmVzcG9uc2UgZm9yIGFwcElkOiAke2FwcElkfSwgYWN0aW9uOiAke2FjdGlvbn1gXG4gICAgKTtcbiAgICBjb25zb2xlLmxvZyhcIlJlc3BvbnNlIHByb21pc2VzXCIsIHJlc3BvbnNlUHJvbWlzZXMpO1xuXG4gICAgLy8gSWYgd2UgaGF2ZSBhIHBlbmRpbmcgcHJvbWlzZSBmb3IgdGhpcyBub3RpZmljYXRpb24sIHJlc29sdmUgaXRcbiAgICBpZiAocmVzcG9uc2VQcm9taXNlcy5oYXMoYXBwSWQpKSB7XG4gICAgICBjb25zdCByZXNvbHZlID0gcmVzcG9uc2VQcm9taXNlcy5nZXQoYXBwSWQpO1xuICAgICAgcmVzb2x2ZShhY3Rpb24pO1xuICAgICAgcmVzcG9uc2VQcm9taXNlcy5kZWxldGUoYXBwSWQpO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgbWVzc2FnZTogYFJlc3BvbnNlICR7YWN0aW9ufSBwcm9jZXNzZWQgc3VjY2Vzc2Z1bGx5YCxcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiTm8gcGVuZGluZyBwcm9taXNlIGZvdW5kIGZvciBhcHBJZDpcIiwgYXBwSWQpO1xuICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6IFwiTm8gcGVuZGluZyBub3RpZmljYXRpb24gZm91bmRcIiB9O1xuICAgIH1cbiAgfSxcblxuICBhc3luYyB1c2VyQWN0aW9uKGFjdGlvbiwgcmVxdWVzdElkLCByZXBseVRleHQgPSBudWxsKSB7XG4gICAgY2hlY2soYWN0aW9uLCBTdHJpbmcpO1xuICAgIGNoZWNrKHJlcXVlc3RJZCwgU3RyaW5nKTtcbiAgICBpZiAocmVwbHlUZXh0KSBjaGVjayhyZXBseVRleHQsIFN0cmluZyk7XG5cbiAgICBjb25zdCB2YWxpZEFjdGlvbnMgPSBbXCJhcHByb3ZlXCIsIFwicmVqZWN0XCIsIFwicmVwbHlcIl07XG4gICAgaWYgKCF2YWxpZEFjdGlvbnMuaW5jbHVkZXMoYWN0aW9uKSkge1xuICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcihcbiAgICAgICAgXCJpbnZhbGlkLWFjdGlvblwiLFxuICAgICAgICBcIkludmFsaWQgYWN0aW9uIHBlcmZvcm1lZCBieSB0aGUgdXNlci5cIlxuICAgICAgKTtcbiAgICB9XG5cbiAgICBjb25zdCBwZW5kaW5nTm90aWZpY2F0aW9uID0gcGVuZGluZ05vdGlmaWNhdGlvbnMuZ2V0KHJlcXVlc3RJZCk7XG4gICAgaWYgKHBlbmRpbmdOb3RpZmljYXRpb24pIHtcbiAgICAgIGNsZWFyVGltZW91dChwZW5kaW5nTm90aWZpY2F0aW9uLnRpbWVvdXQpO1xuICAgICAgcGVuZGluZ05vdGlmaWNhdGlvbi5yZXNvbHZlKHsgYWN0aW9uLCByZXBseVRleHQgfSk7XG4gICAgICBwZW5kaW5nTm90aWZpY2F0aW9ucy5kZWxldGUocmVxdWVzdElkKTtcbiAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGFjdGlvbiwgcmVwbHlUZXh0IH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoXG4gICAgICAgIFwiaW52YWxpZC1yZXF1ZXN0XCIsXG4gICAgICAgIFwiTm8gcGVuZGluZyBub3RpZmljYXRpb24gZm91bmQgZm9yIHRoaXMgcmVxdWVzdC5cIlxuICAgICAgKTtcbiAgICB9XG4gIH0sXG5cbiAgYXN5bmMgXCJ1c2Vycy5yZWdpc3RlclwiKHVzZXJEZXRhaWxzKSB7XG4gICAgY2hlY2sodXNlckRldGFpbHMsIHtcbiAgICAgIGVtYWlsOiBTdHJpbmcsXG4gICAgICBwaW46IFN0cmluZyxcbiAgICAgIGZpcnN0TmFtZTogU3RyaW5nLFxuICAgICAgbGFzdE5hbWU6IFN0cmluZyxcbiAgICAgIHNlc3Npb25EZXZpY2VJbmZvOiB7XG4gICAgICAgIG1vZGVsOiBTdHJpbmcsXG4gICAgICAgIHBsYXRmb3JtOiBTdHJpbmcsXG4gICAgICAgIHV1aWQ6IFN0cmluZyxcbiAgICAgICAgdmVyc2lvbjogU3RyaW5nLFxuICAgICAgICBtYW51ZmFjdHVyZXI6IFN0cmluZyxcbiAgICAgIH0sXG4gICAgICBmY21EZXZpY2VUb2tlbjogU3RyaW5nLFxuICAgIH0pO1xuXG4gICAgY29uc3QgeyBlbWFpbCwgcGluLCBmaXJzdE5hbWUsIGxhc3ROYW1lLCBzZXNzaW9uRGV2aWNlSW5mbyB9ID0gdXNlckRldGFpbHM7XG4gICAgY29uc3QgZmNtVG9rZW4gPSB1c2VyRGV0YWlscy5mY21EZXZpY2VUb2tlbjtcblxuICAgIC8vIENoZWNrIGlmIHVzZXIgZXhpc3RzXG4gICAgaWYgKGF3YWl0IE1ldGVvci51c2Vycy5maW5kT25lQXN5bmMoeyBcImVtYWlscy5hZGRyZXNzXCI6IGVtYWlsIH0pKSB7XG4gICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKFxuICAgICAgICBcInVzZXItZXhpc3RzXCIsXG4gICAgICAgIFwiVXNlciBhbHJlYWR5IGV4aXN0cyB3aXRoIHRoaXMgZW1haWxcIlxuICAgICAgKTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgLy8gQ3JlYXRlIHVzZXIgaW4gTWV0ZW9yIHVzZXJzIGNvbGxlY3Rpb25cbiAgICAgIGNvbnN0IHVzZXJJZCA9IGF3YWl0IEFjY291bnRzLmNyZWF0ZVVzZXIoe1xuICAgICAgICBlbWFpbCxcbiAgICAgICAgcGFzc3dvcmQ6IHBpbixcbiAgICAgICAgcHJvZmlsZToge1xuICAgICAgICAgIGZpcnN0TmFtZSxcbiAgICAgICAgICBsYXN0TmFtZSxcbiAgICAgICAgICBkZXZpY2VJbmZvOiBzZXNzaW9uRGV2aWNlSW5mbyxcbiAgICAgICAgICBkZXZpY2VUb2tlbjogZmNtVG9rZW4sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKHVzZXJJZCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgdXNlciBpZCBpbiBzZXJ2ZXIgaXM6ICR7dXNlcklkfWApO1xuXG4gICAgICAgIC8vIEVuc3VyZSB1c2VySWQgaXMgcGFzc2VkIGFzIGEgc3RyaW5nXG4gICAgICAgIGF3YWl0IE1ldGVvci5jYWxsKFwiZGV2aWNlTG9ncy51cHNlcnRcIiwge1xuICAgICAgICAgIHVzZXJJZDogdXNlcklkLnRvU3RyaW5nKCksXG4gICAgICAgICAgZW1haWwsXG4gICAgICAgICAgZGV2aWNlVVVJRDogc2Vzc2lvbkRldmljZUluZm8udXVpZCxcbiAgICAgICAgICBmY21Ub2tlbixcbiAgICAgICAgICBkZXZpY2VJbmZvOiBzZXNzaW9uRGV2aWNlSW5mbyxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgbWVzc2FnZTogXCJSZWdpc3RyYXRpb24gc3VjY2Vzc2Z1bFwiLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGR1cmluZyByZWdpc3RyYXRpb246XCIsIGVycm9yKTtcbiAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoXCJyZWdpc3RyYXRpb24tZmFpbGVkXCIsIGVycm9yLm1lc3NhZ2UpO1xuICAgIH1cbiAgfSxcblxuICBhc3luYyBnZXRVc2VyRGV0YWlscyhlbWFpbCkge1xuICAgIGlmICghZW1haWwpIHtcbiAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoXCJFbWFpbCBpcyByZXF1aXJlZFwiKTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgTWV0ZW9yLnVzZXJzLmZpbmRPbmVBc3luYyh7IFwiZW1haWxzLmFkZHJlc3NcIjogZW1haWwgfSk7XG5cbiAgICBpZiAoIXVzZXIpIHtcbiAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoXCJVc2VyIG5vdCBmb3VuZFwiKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgZmlyc3ROYW1lOiB1c2VyLnByb2ZpbGU/LmZpcnN0TmFtZSB8fCBcIlwiLFxuICAgICAgbGFzdE5hbWU6IHVzZXIucHJvZmlsZT8ubGFzdE5hbWUgfHwgXCJcIixcbiAgICAgIGVtYWlsOiB1c2VyLmVtYWlsc1swXS5hZGRyZXNzIHx8IFwiXCIsXG4gICAgfTtcbiAgfSxcblxuICBhc3luYyBcInVzZXJzLmNoZWNrUmVnaXN0cmF0aW9uXCIoZmNtVG9rZW4pIHtcbiAgICBjaGVjayhmY21Ub2tlbiwgU3RyaW5nKTtcblxuICAgIGNvbnN0IHVzZXIgPSBNZXRlb3IudXNlcnMuZmluZE9uZUFzeW5jKHsgXCJwcm9maWxlLmZjbVRva2VuXCI6IGZjbVRva2VuIH0pO1xuICAgIGlmICghdXNlcikge1xuICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcihcbiAgICAgICAgXCJkZXZpY2UtZGVyZWdpc3RlcmVkXCIsXG4gICAgICAgIFwiVGhpcyBkZXZpY2UgaXMgZGVyZWdpc3RlcmVkLiBQbGVhc2UgcmVnaXN0ZXIgYWdhaW4uXCJcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiB1c2VyLl9pZDtcbiAgfSxcblxuICBhc3luYyB1cGRhdGVVc2VyUHJvZmlsZSh7IGZpcnN0TmFtZSwgbGFzdE5hbWUsIGVtYWlsIH0pIHtcbiAgICBjaGVjayhmaXJzdE5hbWUsIFN0cmluZyk7XG4gICAgY2hlY2sobGFzdE5hbWUsIFN0cmluZyk7XG4gICAgY2hlY2soZW1haWwsIFN0cmluZyk7XG5cbiAgICBjb25zb2xlLmxvZyhcIlVwZGF0aW5nIHByb2ZpbGUgZm9yIHVzZXI6XCIsIGZpcnN0TmFtZSwgbGFzdE5hbWUsIGVtYWlsKTtcblxuICAgIGlmICghdGhpcy51c2VySWQpIHtcbiAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoXG4gICAgICAgIFwibm90LWF1dGhvcml6ZWRcIixcbiAgICAgICAgXCJZb3UgbXVzdCBiZSBsb2dnZWQgaW4gdG8gdXBkYXRlIHlvdXIgcHJvZmlsZVwiXG4gICAgICApO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAvLyBVcGRhdGUgdGhlIHVzZXIncyBwcm9maWxlIGluIHRoZSBkYXRhYmFzZVxuICAgICAgTWV0ZW9yLnVzZXJzLnVwZGF0ZUFzeW5jKHRoaXMudXNlcklkLCB7XG4gICAgICAgICRzZXQ6IHtcbiAgICAgICAgICBcInByb2ZpbGUuZmlyc3ROYW1lXCI6IGZpcnN0TmFtZSxcbiAgICAgICAgICBcInByb2ZpbGUubGFzdE5hbWVcIjogbGFzdE5hbWUsXG4gICAgICAgICAgXCJlbWFpbHMuMC5hZGRyZXNzXCI6IGVtYWlsLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIG1lc3NhZ2U6IFwiUHJvZmlsZSB1cGRhdGVkIHN1Y2Nlc3NmdWxseVwiIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciB1cGRhdGluZyBwcm9maWxlOlwiLCBlcnJvcik7XG4gICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKFxuICAgICAgICBcInVwZGF0ZS1mYWlsZWRcIixcbiAgICAgICAgXCJGYWlsZWQgdG8gdXBkYXRlIHByb2ZpbGVcIixcbiAgICAgICAgZXJyb3JcbiAgICAgICk7XG4gICAgfVxuICB9LFxuXG4gIGFzeW5jIFwidXNlcnMubWFwRkNNVG9rZW5Ub1VzZXJcIih1c2VySWQsIGZjbVRva2VuKSB7XG4gICAgY2hlY2sodXNlcklkLCBTdHJpbmcpO1xuICAgIGNoZWNrKGZjbVRva2VuLCBTdHJpbmcpO1xuXG4gICAgaWYgKCF0aGlzLnVzZXJJZCkge1xuICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcihcIm5vdC1hdXRob3JpemVkXCIsIFwiVXNlciBtdXN0IGJlIGxvZ2dlZCBpblwiKTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyID0gTWV0ZW9yLnVzZXJzLmZpbmRPbmUodXNlcklkKTtcbiAgICBpZiAoIXVzZXIpIHtcbiAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoXCJ1c2VyLW5vdC1mb3VuZFwiLCBcIlVzZXIgbm90IGZvdW5kXCIpO1xuICAgIH1cblxuICAgIC8vIE1hcCB0b2tlbiB0byB0aGUgdXNlclxuICAgIE1ldGVvci51c2Vycy51cGRhdGUodXNlcklkLCB7XG4gICAgICAkc2V0OiB7XG4gICAgICAgIFwicHJvZmlsZS5mY21Ub2tlblwiOiBmY21Ub2tlbixcbiAgICAgIH0sXG4gICAgfSk7XG4gIH0sXG4gIGFzeW5jIGNoZWNrVXNlcnNFeGlzdCgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdXNlckNvdW50ID0gYXdhaXQgTWV0ZW9yLnVzZXJzLmZpbmQoKS5jb3VudEFzeW5jKCk7XG4gICAgICBjb25zb2xlLmxvZyhcIlVzZXIgY291bnQ6XCIsIHVzZXJDb3VudCk7XG4gICAgICByZXR1cm4gdXNlckNvdW50ID4gMDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIGNoZWNrVXNlcnNFeGlzdDpcIiwgZXJyb3IpO1xuICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcihcInNlcnZlci1lcnJvclwiLCBcIkZhaWxlZCB0byBjaGVjayB1c2VyIGV4aXN0ZW5jZVwiKTtcbiAgICB9XG4gIH0sXG59KTtcblxuTWV0ZW9yLnN0YXJ0dXAoKCkgPT4ge1xuICAvLyBNZXRlb3IucHVibGlzaCgnZGV2aWNlTG9ncycsIGZ1bmN0aW9uIChkZXZpY2VVdWlkKSB7XG4gIC8vICAgY29uc29sZS5sb2coXCJQdWJsaXNoaW5nIGRldmljZUxvZ3MgZm9yIFVVSUQ6XCIsIGRldmljZVV1aWQpO1xuICAvLyAgIGlmICghZGV2aWNlVXVpZCkge1xuICAvLyAgICAgY29uc29sZS5sb2coXCJObyBVVUlEIHByb3ZpZGVkLCByZXR1cm5pbmcgZW1wdHkgc2V0XCIpO1xuICAvLyAgICAgcmV0dXJuIHRoaXMucmVhZHkoKTtcbiAgLy8gICB9XG4gIC8vICAgY29uc3QgcXVlcnkgPSB7IGRldmljZVVVSUQ6IGRldmljZVV1aWQgfTtcbiAgLy8gICBjb25zb2xlLmxvZyhcIk1vbmdvREIgcXVlcnk6XCIsIHF1ZXJ5KTtcbiAgLy8gICBjb25zdCByZWNvcmRzID0gRGV2aWNlTG9ncy5maW5kKHF1ZXJ5LCB7XG4gIC8vICAgICBmaWVsZHM6IHtcbiAgLy8gICAgICAgZGV2aWNlVVVJRDogMSxcbiAgLy8gICAgICAgZW1haWw6IDEsXG4gIC8vICAgICAgIGZjbVRva2VuOiAxXG4gIC8vICAgICB9XG4gIC8vICAgfSk7XG4gIC8vICAgY29uc29sZS5sb2coXCJGb3VuZCByZWNvcmRzIGNvdW50OlwiLCByZWNvcmRzLmNvdW50QXN5bmMoKSk7XG4gIC8vICAgcmV0dXJuIHJlY29yZHM7XG4gIC8vIH0pO1xufSk7XG4iXX0=
