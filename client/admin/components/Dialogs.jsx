import React from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@mieweb/ui";
import { ShieldAlert } from "lucide-react";
import { CopyButton } from "./ui";

/** Promise-driven confirmation dialog; rendered once by AdminProvider. */
export const ConfirmDialog = ({ request, onClose }) => {
  if (!request) return null;
  const { title, description, confirmLabel = "Confirm", danger } = request;
  return (
    <Modal open onOpenChange={(open) => !open && onClose(false)} size="sm">
      <ModalHeader>
        <ModalTitle>{title}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <p className="text-sm text-muted-foreground">{description}</p>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="outline"
          onClick={() => onClose(false)}
          autoFocus={danger}
        >
          Cancel
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          onClick={() => onClose(true)}
          autoFocus={!danger}
        >
          {confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

/**
 * One-time reveal for credentials (API keys, Duo skeys, temporary PINs).
 * The values live only in this dialog's props and are dropped when it closes.
 */
export const SecretDialog = ({ secret, onClose }) => {
  if (!secret) return null;
  const { title, fields, note, warning } = secret;
  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      size="md"
      closeOnOverlayClick={false}
    >
      <ModalHeader>
        <ModalTitle>{title}</ModalTitle>
      </ModalHeader>
      <ModalBody className="space-y-4">
        <Alert variant="warning" icon={<ShieldAlert className="h-4 w-4" />}>
          <AlertDescription>
            Copy this now and store it securely — it won&apos;t be shown again.
          </AlertDescription>
        </Alert>
        {fields.map((field) => (
          <div key={field.label}>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {field.label}
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
              <code
                className={`flex-1 font-mono break-all select-all text-foreground ${
                  field.large ? "text-2xl tracking-[0.3em]" : "text-sm"
                }`}
              >
                {field.value}
              </code>
              <CopyButton value={field.value} label={field.label} />
            </div>
          </div>
        ))}
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
        {warning && (
          <Alert variant="danger">
            <AlertDescription>{warning}</AlertDescription>
          </Alert>
        )}
      </ModalBody>
      <ModalFooter>
        <Button onClick={onClose}>Done</Button>
      </ModalFooter>
    </Modal>
  );
};
