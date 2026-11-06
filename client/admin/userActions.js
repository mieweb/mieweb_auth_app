import { api, RESOURCES } from "./api";
import { useAdmin } from "./AdminContext";

// User mutations change the users list, the device list (approval cascades
// to devices, deletion removes them) and the email log's registration status.
const USER_RESOURCES = [RESOURCES.users, RESOURCES.devices, RESOURCES.emails];

export const userActionKey = (userId, action) => `user:${userId}:${action}`;

/** Approve / delete users with confirmation; shared by Users and Emails. */
export const useUserActions = () => {
  const { run, confirm } = useAdmin();

  const approve = async ({ userId, username }) => {
    const confirmed = await confirm({
      title: "Approve user",
      description: `Approve "${username}"? They and all of their registered devices will be able to sign in.`,
      confirmLabel: "Approve",
    });
    if (!confirmed) return;
    await run(
      userActionKey(userId, "approve"),
      () =>
        api("/api/admin/users/approve", { method: "POST", body: { userId } }),
      { success: `Approved ${username}`, invalidates: USER_RESOURCES },
    );
  };

  const remove = async ({ userId, username }, { reject = false } = {}) => {
    const confirmed = await confirm({
      title: reject ? "Reject registration" : "Delete user",
      description: `Permanently delete "${username}" with all of their devices and data? This cannot be undone.`,
      confirmLabel: reject ? "Reject and delete" : "Delete user",
      danger: true,
    });
    if (!confirmed) return;
    await run(
      userActionKey(userId, "delete"),
      () =>
        api("/api/admin/users/delete", { method: "POST", body: { userId } }),
      {
        success: reject ? `Rejected ${username}` : `Deleted ${username}`,
        invalidates: USER_RESOURCES,
      },
    );
  };

  return { approve, remove };
};
