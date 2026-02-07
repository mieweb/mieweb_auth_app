import { ApprovalTokens } from "./api/approvalTokens";

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

  export const isValidToken = async(userId, token) => {
    // Look up the token
    const tokenRecord = await ApprovalTokens.findOneAsync({
      userId,
      token,
      expiresAt: { $gt: new Date() },
      used: false
    });

    return tokenRecord;
  };

  export const determineTokenErrorReason = async(userId, token) => {
    // Check if token exists at all
    const tokenRecord = await ApprovalTokens.findOneAsync({
      userId,
      token
    });

    if (tokenRecord) {
      // Token exists, check if it's expired
      if (tokenRecord.expiresAt < new Date()) {
        return 'expired';
      } else {
        // Token is valid but user doesn't exist
        const user = await Meteor.users.findOneAsync({ _id: userId });
        if (!user) {
          return 'user_not_found';
        }
      }
    } else {
      // Check if user exists but token is invalid
      const user = await Meteor.users.findOneAsync({ _id: userId });
      if (user) {
        return 'invalid_token';
      } else {
        return 'user_not_found';
      }
    }

    return 'unknown';
  };