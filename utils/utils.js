import { ApprovalTokens } from "./api/approvalTokens";
import { TIMEOUT_DURATION_MS } from "./constants";

export const formatDateTime = (isoString) => {
    if (!isoString) return "";
  
    const date = new Date(isoString);
    
    // Extracting date in YYYY-MM-DD format
    const formattedDate = date.toISOString().split("T")[0];
  
    // Extracting time in HH:MM format
    const formattedTime = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  
    return `${formattedDate} ${formattedTime}`;
  };

  /**
   * Check if a notification has expired based on its creation time
   * @param {Date|String|Number} createdAt - Notification creation timestamp
   * @returns {Boolean} true if notification is expired
   */
  export const isNotificationExpired = (createdAt) => {
    if (!createdAt) return true;
    
    let createdAtMs = createdAt;
    
    // Convert to milliseconds if needed
    if (typeof createdAt === 'string' || typeof createdAt === 'object') {
      createdAtMs = new Date(createdAt).getTime();
    } else if (typeof createdAt === 'number' && createdAt < 1e13) {
      // If it's likely a Unix timestamp in seconds, convert to milliseconds
      createdAtMs = createdAt * 1000;
    }
    
    const expiryTime = createdAtMs + TIMEOUT_DURATION_MS;
    return Date.now() >= expiryTime;
  };

  export const isValidToken = async (userId, token) => {
    // Look up the token
    const tokenRecord = await ApprovalTokens.findOneAsync({
      userId,
      token,
      expiresAt: { $gt: new Date() },
      used: false
    });

    return tokenRecord;
  };

  export const determineTokenErrorReason = async (userId, token) => {
    // Check if token exists at all
    const tokenRecord = await ApprovalTokens.findOneAsync({
      userId,
      token
    });

    if (tokenRecord) {
      // Token exists, check if it's expired
      // Use <= to align with isValidToken's $gt boundary check
      if (tokenRecord.expiresAt <= new Date()) {
        return 'expired';
      } else {
        // Token is not expired, check if user exists
        const user = await Meteor.users.findOneAsync({ _id: userId });
        if (!user) {
          return 'user_not_found';
        }
        // Token is valid and user exists - this shouldn't happen if isValidToken returned false
        // but return unknown as a safe fallback
        return 'unknown';
      }
    } else {
      // Token doesn't exist, check if user exists
      const user = await Meteor.users.findOneAsync({ _id: userId });
      if (user) {
        return 'invalid_token';
      } else {
        return 'user_not_found';
      }
    }
  };