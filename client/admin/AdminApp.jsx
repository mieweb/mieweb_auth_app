import React, { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Spinner } from "@mieweb/ui";
import {
  api,
  clearToken,
  getToken,
  isSessionError,
  setUnauthorizedHandler,
} from "./api";
import { clearResources } from "./resources";
import { AdminProvider } from "./AdminContext";
import { AdminShell } from "./components/AdminShell";
import { LoginPage } from "./LoginPage";
import { UsersSection } from "./sections/UsersSection";
import { DevicesSection } from "./sections/DevicesSection";
import { ApiKeysSection } from "./sections/ApiKeysSection";
import { DuoSection } from "./sections/DuoSection";
import { EmailsSection } from "./sections/EmailsSection";
import { DiagnosticsSection } from "./sections/DiagnosticsSection";

const SESSION_EXPIRED = "Your session has expired. Please sign in again.";
// Absolute: relative targets inside the /admin/* splat route resolve against
// the current URL and would compound (/admin/users/users/...).
const DEFAULT_SECTION = "/admin/users";

/** Admin console at /admin/* (web only). Auth is the LDAP-backed REST session. */
export const AdminApp = () => {
  const [session, setSession] = useState(() => ({
    status: getToken() ? "checking" : "signed-out",
  }));

  const endSession = useCallback((notice = null) => {
    clearToken();
    clearResources();
    setSession({ status: "signed-out", notice });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => endSession(SESSION_EXPIRED));
    return () => setUnauthorizedHandler(() => {});
  }, [endSession]);

  useEffect(() => {
    if (!getToken()) return;
    api("/api/admin/verify")
      .then((res) =>
        setSession({ status: "signed-in", username: res.username }),
      )
      .catch((err) => {
        // Session errors are already handled by the unauthorized handler; keep
        // the token on network errors so a retry after reconnecting works.
        if (!isSessionError(err))
          setSession({ status: "signed-out", notice: err.message });
      });
  }, []);

  const signOut = () => {
    const token = getToken();
    endSession();
    // Best effort: the local session is already gone even if this fails.
    fetch("/api/admin/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  };

  if (session.status === "checking") {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background"
        aria-busy="true"
      >
        <Spinner size="lg" />
      </div>
    );
  }

  if (session.status === "signed-out") {
    return (
      <LoginPage
        notice={session.notice}
        onSignedIn={(username) => setSession({ status: "signed-in", username })}
      />
    );
  }

  return (
    <AdminProvider>
      <Routes>
        <Route
          element={
            <AdminShell username={session.username} onSignOut={signOut} />
          }
        >
          <Route index element={<Navigate to={DEFAULT_SECTION} replace />} />
          <Route path="users" element={<UsersSection />} />
          <Route path="devices" element={<DevicesSection />} />
          <Route path="api-keys" element={<ApiKeysSection />} />
          <Route path="duo" element={<DuoSection />} />
          <Route path="emails" element={<EmailsSection />} />
          <Route path="diagnostics" element={<DiagnosticsSection />} />
          <Route path="*" element={<Navigate to={DEFAULT_SECTION} replace />} />
        </Route>
      </Routes>
    </AdminProvider>
  );
};

export default AdminApp;
