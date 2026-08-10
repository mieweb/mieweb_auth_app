import { useCallback } from "react";
import { useTracker } from "meteor/react-meteor-data";
import { Session } from "meteor/session";
import {
  PUSH_PERMISSION_SESSION_KEY,
  checkNotificationPermission,
  openAppSettings,
} from "../../../notification-permissions";

/**
 * Reactive access to the OS-level push notification permission state.
 *
 * `isEnabled` is:
 *   true  -> notifications enabled
 *   false -> notifications disabled/denied
 *   null  -> unknown (web / non-Cordova, or status undeterminable)
 */
export const useNotificationPermission = () => {
  const isEnabled = useTracker(
    () => Session.get(PUSH_PERMISSION_SESSION_KEY),
    [],
  );

  const recheck = useCallback(() => checkNotificationPermission(), []);
  const openSettings = useCallback(() => openAppSettings(), []);

  return { isEnabled, recheck, openSettings };
};
