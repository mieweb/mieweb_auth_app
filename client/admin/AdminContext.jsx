import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { isSessionError } from "./api";
import { invalidate } from "./resources";
import { Toaster } from "./components/Toaster";
import { ConfirmDialog, SecretDialog } from "./components/Dialogs";

const AdminContext = createContext(null);
let nextToastId = 0;

/**
 * Shared admin UI services:
 * - toast(message, variant)
 * - confirm({ title, description, confirmLabel, danger }) → Promise<boolean>
 * - revealSecret({ title, fields, note, warning }) for one-time credentials
 * - run(key, action, { success, invalidates }) executes a mutation once per
 *   key at a time (double clicks / repeated submits are ignored), reports
 *   the outcome, and always refetches affected resources so the UI converges
 *   on server state even after a failure.
 */
export const AdminProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmRequest, setConfirmRequest] = useState(null);
  const [secret, setSecret] = useState(null);
  const [pendingKeys, setPendingKeys] = useState(() => new Set());
  const pendingRef = useRef(new Set());

  const dismissToast = useCallback(
    (id) => setToasts((list) => list.filter((t) => t.id !== id)),
    [],
  );

  const toast = useCallback((message, variant = "success") => {
    nextToastId += 1;
    const id = nextToastId;
    setToasts((list) => [...list.slice(-2), { id, message, variant }]);
  }, []);

  const confirm = useCallback(
    (request) =>
      new Promise((resolve) => setConfirmRequest({ ...request, resolve })),
    [],
  );

  const closeConfirm = (confirmed) => {
    confirmRequest?.resolve(confirmed);
    setConfirmRequest(null);
  };

  const setPending = (key, active) => {
    if (active) pendingRef.current.add(key);
    else pendingRef.current.delete(key);
    setPendingKeys(new Set(pendingRef.current));
  };

  const run = useCallback(
    async (key, action, { success, invalidates = [] } = {}) => {
      if (pendingRef.current.has(key)) return { ok: false, skipped: true };
      setPending(key, true);
      try {
        const result = await action();
        const message =
          typeof success === "function" ? success(result) : success;
        if (message) toast(message);
        return { ok: true, result };
      } catch (error) {
        if (!isSessionError(error)) toast(error.message, "danger");
        return { ok: false, error };
      } finally {
        // Keep the action busy until the UI shows post-mutation server state.
        await invalidate(...invalidates);
        setPending(key, false);
      }
    },
    [toast],
  );

  const value = useMemo(
    () => ({
      toast,
      confirm,
      run,
      revealSecret: setSecret,
      isPending: (key) => pendingKeys.has(key),
    }),
    [toast, confirm, run, pendingKeys],
  );

  return (
    <AdminContext.Provider value={value}>
      {children}
      <ConfirmDialog request={confirmRequest} onClose={closeConfirm} />
      <SecretDialog secret={secret} onClose={() => setSecret(null)} />
      <Toaster toasts={toasts} onDismiss={dismissToast} />
    </AdminContext.Provider>
  );
};

export const useAdmin = () => useContext(AdminContext);
