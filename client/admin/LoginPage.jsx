import React, { useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Input,
} from "@mieweb/ui";
import { Lock } from "lucide-react";
import { api, setToken } from "./api";
import { usePageTitle } from "../hooks/usePageTitle";

// Encrypt the password with the server's ephemeral RSA key so it never
// appears in plaintext in request logs or the browser network panel.
const encryptPassword = async (plaintext) => {
  const { publicKey } = await api("/api/admin/pubkey", { auth: false });
  const pemBody = publicKey
    .replace(/-----[A-Z ]+-----/g, "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "spki",
    der,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    key,
    new TextEncoder().encode(plaintext),
  );
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
};

export const LoginPage = ({ notice, onSignedIn }) => {
  usePageTitle("Admin sign in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (loading || !username.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await api("/api/admin/auth", {
        method: "POST",
        auth: false,
        body: {
          username: username.trim(),
          encryptedPassword: await encryptPassword(password),
        },
      });
      setToken(res.token);
      onSignedIn(res.username);
    } catch (err) {
      setError(err.message || "Authentication failed");
      setPassword("");
      setLoading(false);
    }
  };

  const message = error || notice;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4 dark:bg-background">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6">
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-2 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Lock className="h-5 w-5" aria-hidden="true" />
              </span>
              <h1 className="text-lg font-semibold text-foreground">
                MIEAuth Admin
              </h1>
              <p className="text-sm text-muted-foreground">
                Sign in with your LDAP account
              </p>
            </div>
            {message && (
              <Alert variant={error ? "danger" : "warning"}>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
            <Input
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <Button
              type="submit"
              fullWidth
              isLoading={loading}
              loadingText="Signing in…"
              disabled={!username.trim() || !password}
            >
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
