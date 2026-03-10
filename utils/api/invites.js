import { Mongo } from "meteor/mongo";
import { Meteor } from "meteor/meteor";
import crypto from "crypto";
import { hashApiKeyAsync, verifyApiKeyAsync } from "./apiKeys";

export const INVITE_TOKEN_EXPIRY_MS = 48 * 60 * 60 * 1000;
const INVITE_TOKEN_PREFIX_LENGTH = 8;

export const Invites = new Mongo.Collection("invites");

export const normalizeInviteEmail = (email = "") => email.trim().toLowerCase();

export const normalizeInviteUsername = (username = "") =>
  username.trim().toLowerCase();

export const normalizeInviteName = (value = "") => value.trim();

export const createInviteToken = () => crypto.randomBytes(32).toString("hex");

export const getInviteTokenPrefix = (token = "") =>
  token.slice(0, INVITE_TOKEN_PREFIX_LENGTH);

export const buildInviteLockFields = (invite) => ({
  email: true,
  username: Boolean(invite?.username),
  firstName: Boolean(invite?.firstName),
  lastName: Boolean(invite?.lastName),
});

export const createInviteRecord = async ({
  email,
  username = "",
  firstName = "",
  lastName = "",
  createdByClientId = null,
}) => {
  const token = createInviteToken();
  const { hashedKey, salt } = await hashApiKeyAsync(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_TOKEN_EXPIRY_MS);

  const inviteDoc = {
    email: email.trim(),
    normalizedEmail: normalizeInviteEmail(email),
    username: username.trim(),
    normalizedUsername: normalizeInviteUsername(username),
    firstName: normalizeInviteName(firstName),
    lastName: normalizeInviteName(lastName),
    hashedToken: hashedKey,
    salt,
    tokenPrefix: getInviteTokenPrefix(token),
    createdByClientId,
    createdAt: now,
    expiresAt,
    usedAt: null,
    consumedByUserId: null,
    consumedByDeviceUUID: null,
  };

  inviteDoc._id = await Invites.insertAsync(inviteDoc);

  return { token, inviteDoc };
};

const getCandidateInvites = async (token) => {
  const tokenPrefix = getInviteTokenPrefix(token);
  const candidates = await Invites.find({ tokenPrefix }).fetchAsync();

  if (candidates.length > 0) {
    return candidates;
  }

  return Invites.find({}).fetchAsync();
};

export const findInviteByToken = async (token) => {
  if (!token) {
    return null;
  }

  const candidates = await getCandidateInvites(token);

  for (const invite of candidates) {
    if (await verifyApiKeyAsync(token, invite.hashedToken, invite.salt)) {
      return invite;
    }
  }

  return null;
};

export const getInviteTokenStatus = async (token) => {
  const invite = await findInviteByToken(token);

  if (!invite) {
    return { status: "invalid", invite: null };
  }

  if (invite.usedAt) {
    return { status: "used", invite };
  }

  if (invite.expiresAt <= new Date()) {
    return { status: "expired", invite };
  }

  return { status: "valid", invite };
};

export const markInviteConsumed = async ({ inviteId, userId, deviceUUID }) =>
  Invites.updateAsync(
    {
      _id: inviteId,
      usedAt: null,
    },
    {
      $set: {
        usedAt: new Date(),
        consumedByUserId: userId,
        consumedByDeviceUUID: deviceUUID,
      },
    },
  );

if (Meteor.isServer) {
  Meteor.startup(async () => {
    try {
      const raw = Invites.rawCollection();
      await raw.createIndex({ tokenPrefix: 1 });
      await raw.createIndex({ normalizedEmail: 1, createdAt: -1 });
      await raw.createIndex({ expiresAt: 1 });
      await raw.createIndex({ usedAt: 1 });
    } catch (error) {
      console.error("Failed to create Invite indexes:", error);
    }
  });
}
