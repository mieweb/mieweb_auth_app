import { Mongo } from "meteor/mongo";
import { check } from "meteor/check";

// Guard against double-instantiation (Meteor + rspack both load this module)
export const PendingResponses = (globalThis.__collections_pendingResponses ??=
  new Mongo.Collection("pendingResponses"));

// Create indexes for better query performance
if (Meteor.isServer) {
  Meteor.startup(() => {
    PendingResponses.createIndex({ username: 1 });
    PendingResponses.createIndex({ requestId: 1 });
    PendingResponses.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  });
}

Meteor.methods({
  /**
   * Create a pending response entry
   * @param {String} username - Username
   * @param {String} requestId - Unique request identifier
   * @param {Number} timeoutMs - Timeout in milliseconds
   * @returns {String} The request ID
   */
  "pendingResponses.create": async function (
    username,
    requestId,
    timeoutMs = 25000,
  ) {
    check(username, String);
    check(requestId, String);
    check(timeoutMs, Number);

    const expiresAt = new Date(Date.now() + timeoutMs);

    // Remove any existing pending response for this user
    await PendingResponses.removeAsync({ username });

    // Create new pending response
    await PendingResponses.insertAsync({
      username,
      requestId,
      status: "pending",
      createdAt: new Date(),
      expiresAt,
    });

    console.log(
      `Created pending response for ${username} with ID ${requestId}, expires at ${expiresAt}`,
    );
    return requestId;
  },

  /**
   * Resolve a pending response
   * @param {String} username - Username
   * @param {String} action - User action (approve/reject/timeout)
   * @returns {Object} Resolution result
   */
  "pendingResponses.resolve": async function (username, action) {
    check(username, String);
    check(action, String);

    console.log(
      `Attempting to resolve pending response for ${username} with action: ${action}`,
    );

    const pendingResponse = await PendingResponses.findOneAsync({
      username,
      status: "pending",
    });

    if (!pendingResponse) {
      console.log(`No pending response found for ${username}`);
      return { success: false, message: "No pending response found" };
    }

    // Update the response with the action
    await PendingResponses.updateAsync(
      { _id: pendingResponse._id },
      {
        $set: {
          status: "resolved",
          action,
          resolvedAt: new Date(),
        },
      },
    );

    console.log(
      `Resolved pending response for ${username} with action: ${action}`,
    );
    return {
      success: true,
      requestId: pendingResponse.requestId,
      action,
    };
  },

  /**
   * Check if there's a pending response for a user
   * @param {String} username - Username
   * @returns {Object|null} Pending response or null
   */
  "pendingResponses.getPending": async function (username) {
    check(username, String);

    return await PendingResponses.findOneAsync({
      username,
      status: "pending",
    });
  },

  /**
   * Wait for a response with polling
   * @param {String} username - Username
   * @param {String} requestId - Request ID to wait for
   * @param {Number} timeoutMs - Timeout in milliseconds
   * @returns {String} The action taken by user or 'timeout'
   */
  "pendingResponses.waitForResponse": async function (
    username,
    requestId,
    timeoutMs = 25000,
  ) {
    check(username, String);
    check(requestId, String);
    check(timeoutMs, Number);

    const startTime = Date.now();
    const pollInterval = 500; // Poll every 500ms

    return new Promise((resolve) => {
      const pollForResponse = async () => {
        try {
          // Check if we've exceeded timeout
          if (Date.now() - startTime >= timeoutMs) {
            console.log(`Timeout waiting for response from ${username}`);

            // Mark as timeout in database
            await PendingResponses.updateAsync(
              { username, requestId, status: "pending" },
              {
                $set: {
                  status: "timeout",
                  action: "timeout",
                  resolvedAt: new Date(),
                },
              },
            );

            resolve("timeout");
            return;
          }

          // Check for response
          const response = await PendingResponses.findOneAsync({
            username,
            requestId,
            status: "resolved",
          });

          if (response) {
            console.log(
              `Response received for ${username}: ${response.action}`,
            );
            resolve(response.action);
            return;
          }

          // Continue polling
          setTimeout(pollForResponse, pollInterval);
        } catch (error) {
          console.error("Error polling for response:", error);
          resolve("timeout");
        }
      };

      pollForResponse();
    });
  },

  /**
   * Clean up expired pending responses
   * @returns {Number} Number of cleaned up responses
   */
  "pendingResponses.cleanup": async function () {
    const result = await PendingResponses.removeAsync({
      expiresAt: { $lt: new Date() },
      status: "pending",
    });

    console.log(`Cleaned up ${result} expired pending responses`);
    return result;
  },

  /**
   * Get all pending responses (for monitoring)
   * @returns {Array} All pending responses
   */
  "pendingResponses.getAll": async function () {
    return await PendingResponses.find(
      {},
      {
        sort: { createdAt: -1 },
        limit: 100,
      },
    ).fetch();
  },
});

if (Meteor.isServer) {
  // Clean up expired responses every minute
  Meteor.setInterval(() => {
    Meteor.call("pendingResponses.cleanup");
  }, 60000);

  Meteor.publish("pendingResponses.byUser", function (username) {
    check(username, String);
    return PendingResponses.find({ username });
  });
}
