import { Meteor } from "meteor/meteor";
import { DeviceDetails } from "../../utils/api/deviceDetails.js";
import { Invites, normalizeInviteUsername } from "../../utils/api/invites.js";

/**
 * Resolve a Duo "user" to the underlying MIEAuth identity.
 *
 * Duo callers reference users in two ways:
 *   - user_id : the opaque id we returned from /enroll. In our scheme this is
 *               either an Invite._id (pre-registration) or a Meteor user _id.
 *   - username: the MIEAuth username or email.
 *
 * Returns a normalized subject:
 *   {
 *     found: boolean,
 *     meteorUserId: string|null,   // Meteor users._id once registered
 *     username: string|null,       // canonical username used for device lookup
 *     displayName: string|null,
 *     deviceDoc: Object|null,      // DeviceDetails document, if any
 *     invite: Object|null,         // matched invite, if user_id was an invite
 *   }
 */

const emptySubject = () => ({
  found: false,
  meteorUserId: null,
  username: null,
  displayName: null,
  deviceDoc: null,
  invite: null,
});

const displayNameFor = (user, deviceDoc) => {
  const first = user?.profile?.firstName || deviceDoc?.firstName || "";
  const last = user?.profile?.lastName || deviceDoc?.lastName || "";
  const full = `${first} ${last}`.trim();
  return full || null;
};

const subjectFromMeteorUser = async (user) => {
  const username = user.username || user.emails?.[0]?.address || null;
  const deviceDoc =
    (await DeviceDetails.findOneAsync({ userId: user._id })) ||
    (username ? await DeviceDetails.findOneAsync({ username }) : null);
  return {
    found: true,
    meteorUserId: user._id,
    username: deviceDoc?.username || username,
    displayName: displayNameFor(user, deviceDoc),
    deviceDoc: deviceDoc || null,
    invite: null,
  };
};

const subjectFromInvite = async (invite) => {
  // If the invite has been consumed, follow it to the real Meteor user.
  if (invite.consumedByUserId) {
    const user = await Meteor.users.findOneAsync({
      _id: invite.consumedByUserId,
    });
    if (user) {
      const subject = await subjectFromMeteorUser(user);
      subject.invite = invite;
      return subject;
    }
  }
  // Not yet consumed: we know the intended identity but there are no devices.
  return {
    found: true,
    meteorUserId: invite.consumedByUserId || null,
    username: invite.username || invite.email || null,
    displayName:
      `${invite.firstName || ""} ${invite.lastName || ""}`.trim() || null,
    deviceDoc: null,
    invite,
  };
};

/** Resolve by Duo user_id (invite._id or Meteor user _id). */
export const resolveByUserId = async (userId) => {
  if (!userId) {
    return emptySubject();
  }
  const invite = await Invites.findOneAsync({ _id: userId });
  if (invite) {
    return subjectFromInvite(invite);
  }
  const user = await Meteor.users.findOneAsync({ _id: userId });
  if (user) {
    return subjectFromMeteorUser(user);
  }
  // Fall back to a DeviceDetails doc keyed by this userId.
  const deviceDoc = await DeviceDetails.findOneAsync({ userId });
  if (deviceDoc) {
    return {
      found: true,
      meteorUserId: deviceDoc.userId,
      username: deviceDoc.username,
      displayName:
        `${deviceDoc.firstName || ""} ${deviceDoc.lastName || ""}`.trim() ||
        null,
      deviceDoc,
      invite: null,
    };
  }
  return emptySubject();
};

/** Resolve by Duo username (MIEAuth username or email). */
export const resolveByUsername = async (username) => {
  if (!username) {
    return emptySubject();
  }
  const normalized = normalizeInviteUsername(username);

  // Try Meteor users by username, then by email.
  let user = await Meteor.users.findOneAsync({ username });
  if (!user) {
    user = await Meteor.users.findOneAsync({ username: normalized });
  }
  if (!user) {
    user = await Meteor.users.findOneAsync({
      "emails.address": username,
    });
  }
  if (user) {
    return subjectFromMeteorUser(user);
  }

  // Try device details directly by username.
  const deviceDoc = await DeviceDetails.findOneAsync({ username });
  if (deviceDoc) {
    return {
      found: true,
      meteorUserId: deviceDoc.userId,
      username: deviceDoc.username,
      displayName:
        `${deviceDoc.firstName || ""} ${deviceDoc.lastName || ""}`.trim() ||
        null,
      deviceDoc,
      invite: null,
    };
  }

  return emptySubject();
};

/**
 * Resolve a subject from whichever identifier the caller supplied,
 * preferring user_id over username (Duo's documented precedence).
 */
export const resolveDuoUser = async ({ userId, username } = {}) => {
  if (userId) {
    const byId = await resolveByUserId(userId);
    if (byId.found) {
      return byId;
    }
  }
  if (username) {
    return resolveByUsername(username);
  }
  return emptySubject();
};

/** Approved devices for a resolved subject (empty array if none). */
export const approvedDevices = (subject) => {
  const devices = subject?.deviceDoc?.devices || [];
  return devices.filter((d) => d.deviceRegistrationStatus === "approved");
};
