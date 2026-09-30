import React from "react";
import { useTracker } from "meteor/react-meteor-data";
import { Session } from "meteor/session";
import { Button, Modal, ModalBody } from "@mieweb/ui";
import { APP_UPDATE_SESSION_KEY } from "../../../app-update";
import { useStoreUrls } from "../../../../hooks/useStoreUrls";
import { openExternal } from "../../../../../utils/openExternal";

const dismiss = () => Session.set(APP_UPDATE_SESSION_KEY, false);

// Centered modal rather than a banner so it stays visible on builds whose
// header/footer are drawn under the system bars.
export const AppUpdatePrompt = () => {
  const updateAvailable = useTracker(
    () => Session.get(APP_UPDATE_SESSION_KEY),
    [],
  );
  const { appStoreUrl, playStoreUrl } = useStoreUrls();

  if (!updateAvailable) return null;

  const storeUrl =
    window.cordova?.platformId === "ios" ? appStoreUrl : playStoreUrl;

  const handleUpdate = () => {
    openExternal(storeUrl);
    dismiss();
  };

  return (
    <Modal open onOpenChange={(open) => !open && dismiss()}>
      <ModalBody>
        <div className="space-y-4 p-1">
          <h3 className="text-base font-semibold text-foreground">
            Update available
          </h3>
          <p className="text-sm text-muted-foreground">
            A new version of MIE Auth is available. Update from the store to get
            the latest fixes and improvements.
          </p>
          <Button className="w-full" onClick={handleUpdate}>
            Update now
          </Button>
          <Button variant="ghost" className="w-full" onClick={dismiss}>
            Later
          </Button>
        </div>
      </ModalBody>
    </Modal>
  );
};
