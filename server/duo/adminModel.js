import { Meteor } from "meteor/meteor";
import { DeviceDetails } from "../../utils/api/deviceDetails.js";
import { Invites } from "../../utils/api/invites.js";

/**
 * Mapping layer between MIEAuth's data model (Meteor users + DeviceDetails +
 * Invites) and the object shapes returned by the Duo Admin API.
 *
 * Duo Admin API objects this module produces:
 *   - User object  : https://duo.com/docs/adminapi#users
 *   - Phone object : https://duo.com/docs/adminapi#phones
 *
 * We expose the fields real Duo Admin API consumers (e.g. duo_client,
 * Authentik directory import) rely on; fields that have no MIEAuth equivalent
 * are returned as sensible empty defaults.
 */

const epoch = (date) =>
  date instanceof Date ? Math.floor(date.getTime() / 1000) : null;

/** Map a MIEAuth device platform string to a Duo phone platform label. */
const duoPlatform = (devicePlatform) => {
  const p = String(devicePlatform || "").toLowerCase();
  if (p.includes("android")) return "Google Android";
  if (p.includes("ios") || p.includes("iphone") || p.includes("apple")) {
    return "Apple iOS";
  }
  return "Generic Smartphone";
};

/** Duo user status derived from MIEAuth registration status. */
const duoStatus = (registrationStatus) =>
  registrationStatus === "approved" ? "active" : "disabled";

const fullName = (first, last) => `${first || ""} ${last || ""}`.trim();

/** A compact user summary embedded inside phone.users[]. */
const userSummary = (meteorUser, deviceDoc) => ({
  user_id: meteorUser?._id || deviceDoc?.userId || null,
  username:
    meteorUser?.username ||
    deviceDoc?.username ||
    meteorUser?.emails?.[0]?.address ||
    null,
  realname:
    fullName(meteorUser?.profile?.firstName, meteorUser?.profile?.lastName) ||
    fullName(deviceDoc?.firstName, deviceDoc?.lastName) ||
    null,
  email: meteorUser?.emails?.[0]?.address || deviceDoc?.email || null,
});

/**
 * Build a Duo phone object from a MIEAuth device sub-document.
 * @param {Object} device     a DeviceDetails.devices[] entry
 * @param {Array}  users      embedded user summaries
 */
export const buildDuoPhone = (device, users = []) => ({
  phone_id: device.appId || device.deviceUUID,
  number: "",
  name: device.deviceModel || "",
  extension: "",
  postdelay: null,
  predelay: null,
  type: "Mobile",
  platform: duoPlatform(device.devicePlatform),
  activated: device.deviceRegistrationStatus === "approved",
  sms_passcodes_sent: false,
  model: device.deviceModel || "",
  capabilities: ["push"],
  encrypted: "Unknown",
  fingerprint: "Unknown",
  tampered: "Unknown",
  last_seen: device.lastUpdated ? epoch(device.lastUpdated) : null,
  users,
});

/**
 * Build a Duo user object.
 * @param {Object} meteorUser  a Meteor users document (may be null for invites)
 * @param {Object} deviceDoc   the user's DeviceDetails document (may be null)
 * @param {Object} opts
 * @param {boolean} opts.withPhones include the phones array (default true)
 */
export const buildDuoUser = (
  meteorUser,
  deviceDoc,
  { withPhones = true } = {},
) => {
  const summary = userSummary(meteorUser, deviceDoc);
  const devices = deviceDoc?.devices || [];
  const phones = withPhones
    ? devices.map((d) => buildDuoPhone(d, [summary]))
    : [];
  return {
    user_id: summary.user_id,
    username: summary.username,
    realname: summary.realname,
    email: summary.email,
    status: duoStatus(meteorUser?.profile?.registrationStatus),
    is_enrolled: devices.some((d) => d.deviceRegistrationStatus === "approved"),
    created: epoch(meteorUser?.createdAt || deviceDoc?.createdAt),
    last_login: null,
    notes: "",
    phones,
    tokens: [],
    groups: [],
    aliases: {},
  };
};

/** Build a Duo user object from an unconsumed invite (pre-registration). */
export const buildDuoUserFromInvite = (invite) => ({
  user_id: invite._id,
  username: invite.username || invite.email || invite._id,
  realname: fullName(invite.firstName, invite.lastName) || null,
  email: invite.email || null,
  status: "disabled",
  is_enrolled: false,
  created: epoch(invite.createdAt),
  last_login: null,
  notes: "Pending enrollment (invite not yet completed)",
  phones: [],
  tokens: [],
  groups: [],
  aliases: {},
});

/**
 * List all Duo users (Meteor users joined to their DeviceDetails), optionally
 * filtered by an exact username (Duo Admin API `username` query param).
 */
export const listDuoUsers = async ({ username } = {}) => {
  const selector = {};
  if (username) {
    selector.$or = [{ username }, { "emails.address": username }];
  }
  const users = await Meteor.users
    .find(selector, {
      fields: { username: 1, emails: 1, profile: 1, createdAt: 1 },
    })
    .fetchAsync();

  const deviceDocs = await DeviceDetails.find({}).fetchAsync();
  const byUserId = new Map();
  const byUsername = new Map();
  for (const doc of deviceDocs) {
    if (doc.userId) byUserId.set(doc.userId, doc);
    if (doc.username) byUsername.set(doc.username, doc);
  }

  return users.map((u) => {
    const deviceDoc =
      byUserId.get(u._id) ||
      (u.username ? byUsername.get(u.username) : null) ||
      null;
    return buildDuoUser(u, deviceDoc);
  });
};

/** Get a single Duo user by user_id (Meteor user _id, or invite _id). */
export const getDuoUserById = async (userId) => {
  if (!userId) return null;
  const user = await Meteor.users.findOneAsync(
    { _id: userId },
    { fields: { username: 1, emails: 1, profile: 1, createdAt: 1 } },
  );
  if (user) {
    const deviceDoc =
      (await DeviceDetails.findOneAsync({ userId })) ||
      (user.username
        ? await DeviceDetails.findOneAsync({ username: user.username })
        : null);
    return buildDuoUser(user, deviceDoc);
  }
  const invite = await Invites.findOneAsync({ _id: userId });
  if (invite) {
    return buildDuoUserFromInvite(invite);
  }
  return null;
};

/** Get the phones for a single Duo user. */
export const getDuoUserPhones = async (userId) => {
  const user = await getDuoUserById(userId);
  return user ? user.phones : null;
};

/**
 * List all Duo phones across every user (one phone per registered device).
 */
export const listDuoPhones = async () => {
  const deviceDocs = await DeviceDetails.find({}).fetchAsync();
  const userIds = deviceDocs.map((d) => d.userId).filter(Boolean);
  const users = await Meteor.users
    .find(
      { _id: { $in: userIds } },
      { fields: { username: 1, emails: 1, profile: 1 } },
    )
    .fetchAsync();
  const userMap = new Map(users.map((u) => [u._id, u]));

  const phones = [];
  for (const doc of deviceDocs) {
    const summary = userSummary(userMap.get(doc.userId), doc);
    for (const device of doc.devices || []) {
      phones.push(buildDuoPhone(device, [summary]));
    }
  }
  return phones;
};

/** Get a single Duo phone by phone_id (device appId or deviceUUID). */
export const getDuoPhoneById = async (phoneId) => {
  if (!phoneId) return null;
  const doc = await DeviceDetails.findOneAsync({
    $or: [{ "devices.appId": phoneId }, { "devices.deviceUUID": phoneId }],
  });
  if (!doc) return null;
  const device = (doc.devices || []).find(
    (d) => d.appId === phoneId || d.deviceUUID === phoneId,
  );
  if (!device) return null;
  const user = doc.userId
    ? await Meteor.users.findOneAsync(
        { _id: doc.userId },
        { fields: { username: 1, emails: 1, profile: 1 } },
      )
    : null;
  return buildDuoPhone(device, [userSummary(user, doc)]);
};

/** Aggregate counts for GET /admin/v1/info/summary. */
export const adminSummary = async () => {
  const userCount = await Meteor.users.find({}).countAsync();
  const deviceDocs = await DeviceDetails.find(
    {},
    { fields: { devices: 1 } },
  ).fetchAsync();
  let phoneCount = 0;
  for (const doc of deviceDocs) {
    phoneCount += (doc.devices || []).length;
  }
  return {
    user_count: userCount,
    phone_count: phoneCount,
    telephony_credits_remaining: 0,
  };
};
