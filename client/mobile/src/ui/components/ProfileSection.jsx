import React from "react";
import SuccessToaster from "../Toasters/SuccessToaster";
import {
  Input,
  Button,
  Modal,
  ModalHeader,
  ModalTitle,
  ModalClose,
  ModalBody,
  ModalFooter,
} from "@mieweb/ui";

export const ProfileSection = ({
  profile,
  isEditing,
  isSaving,
  successMessage,
  errorMessage,
  handleProfileChange,
  handleProfileUpdate,
  toggleEdit,
  setSuccessMessage,
}) => {
  const handleSave = async () => {
    await handleProfileUpdate();
  };

  return (
    <>
      <SuccessToaster
        message={successMessage}
        onClose={() => setSuccessMessage("")}
      />

      <Modal
        open={isEditing}
        onOpenChange={(open) => {
          if (!open) toggleEdit();
        }}
        size="sm"
      >
        <ModalHeader>
          <ModalTitle>Edit Profile</ModalTitle>
          <ModalClose />
        </ModalHeader>
        <ModalBody>
          {errorMessage && (
            <p className="text-sm text-destructive mb-3">{errorMessage}</p>
          )}
          <div className="space-y-3">
            <Input
              type="text"
              name="firstName"
              value={profile.firstName || ""}
              onChange={handleProfileChange}
              placeholder="First Name"
              label="First Name"
            />
            <Input
              type="text"
              name="lastName"
              value={profile.lastName || ""}
              onChange={handleProfileChange}
              placeholder="Last Name"
              label="Last Name"
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            onClick={toggleEdit}
            disabled={isSaving}
            variant="secondary"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
            isLoading={isSaving}
            loadingText="Saving..."
          >
            Save
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};
