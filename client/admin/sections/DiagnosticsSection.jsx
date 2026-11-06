import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Input,
  Progress,
} from "@mieweb/ui";
import { AlertTriangle, Bell, Search, Send, Smartphone } from "lucide-react";
import { api, diagnosticsPath, RESOURCES } from "../api";
import { useResource } from "../resources";
import { useAdmin } from "../AdminContext";
import {
  CopyButton,
  EmptyState,
  Mono,
  PageHeader,
  Panel,
  RefreshButton,
  ResourceView,
  StatusBadge,
  TimeAgo,
} from "../components/ui";
import { formatDateTime } from "../../../utils/adminHelpers";

const ENFORCEMENT_THRESHOLD = 90;

const Stat = ({ label, value, hint }) => (
  <div className="rounded-lg border border-border bg-background px-3 py-2.5">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
      {value}
      {hint && (
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          {hint}
        </span>
      )}
    </p>
  </div>
);

const Field = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="mt-0.5 truncate text-sm text-foreground">{children}</dd>
  </div>
);

const MigrationPanel = () => {
  const migration = useResource(RESOURCES.migration);
  const stats = migration.data?.devices;
  const failures = migration.data?.recentFailures || [];
  const coverage = stats?.activeLast30d
    ? Math.round((100 * stats.v2ActiveLast30d) / stats.activeLast30d)
    : 0;
  const proofs = Object.entries(stats?.byProof || {});

  return (
    <Panel
      title="Identity migration (v1 → v2)"
      description={`Enforcement requires more than ${ENFORCEMENT_THRESHOLD}% of devices active in the last 30 days to be on v2.`}
      actions={<RefreshButton resource={migration} />}
    >
      <ResourceView resource={migration} skeletonColumns={4}>
        {stats && (
          <div className="space-y-4 p-4 sm:px-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Devices" value={stats.total} />
              <Stat
                label="Migrated to v2"
                value={stats.v2}
                hint={`/ ${stats.v1} on v1`}
              />
              <Stat label="Active in 30 days" value={stats.activeLast30d} />
              <Stat
                label="By proof"
                value={
                  proofs.length
                    ? proofs.map(([k, v]) => `${k}: ${v}`).join(" · ")
                    : "—"
                }
              />
            </div>
            <Progress
              value={coverage}
              label="30-day active coverage"
              showValue
              variant={coverage > ENFORCEMENT_THRESHOLD ? "success" : "warning"}
              size="sm"
            />
            {failures.length > 0 && (
              <details className="group rounded-lg border border-border">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  Recent failures ({failures.length})
                </summary>
                <ul className="divide-y divide-border border-t border-border text-xs">
                  {failures.map((failure, index) => (
                    <li
                      key={index}
                      className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2"
                    >
                      <Mono>{failure.action}</Mono>
                      <span className="font-medium text-foreground">
                        {failure.outcome}
                      </span>
                      {failure.message && (
                        <span className="text-muted-foreground">
                          {failure.message}
                        </span>
                      )}
                      <span className="ml-auto text-muted-foreground">
                        <TimeAgo value={failure.createdAt} />
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </ResourceView>
    </Panel>
  );
};

const DeviceDiagnostics = ({ userId, device }) => {
  const { run, isPending } = useAdmin();
  const [result, setResult] = useState(null);
  const key = `push:${userId}:${device.deviceUUID}`;

  const sendTestPush = async () => {
    const outcome = await run(
      key,
      () =>
        api("/api/admin/diagnostics/test-push", {
          method: "POST",
          body: { userId, deviceUUID: device.deviceUUID },
        }),
      { success: (res) => (res.success ? "Test push accepted by FCM" : null) },
    );
    if (outcome.ok) setResult(outcome.result);
  };

  return (
    <li className="space-y-2 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">
              {device.customName || device.deviceModel || "Unknown device"}
              {device.devicePlatform && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {device.devicePlatform}
                </span>
              )}
            </p>
            <StatusBadge status={device.status} />
            {device.isPrimary && (
              <Badge size="sm" variant="outline">
                Primary
              </Badge>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            UUID <Mono>{device.deviceUUID}</Mono>
            <CopyButton value={device.deviceUUID} label="device UUID" />
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Send className="h-3.5 w-3.5" />}
          isLoading={isPending(key)}
          disabled={!device.fcmToken.present}
          title={device.fcmToken.present ? undefined : "No FCM token stored"}
          onClick={sendTestPush}
        >
          Send test push
        </Button>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="FCM token">
          {device.fcmToken.present ? (
            <span
              title={`sha256 ${device.fcmToken.sha256} · ${device.fcmToken.length} chars`}
            >
              <Mono>{device.fcmToken.preview}</Mono>
            </span>
          ) : (
            <span className="font-medium text-red-600 dark:text-red-400">
              Missing
            </span>
          )}
        </Field>
        <Field label="Token fingerprint">
          {device.fcmToken.present ? (
            <Mono>{device.fcmToken.sha256}</Mono>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Biometric secret">
          {device.hasBiometricSecret ? "Stored" : "Missing"}
        </Field>
        <Field label="Last used">
          <TimeAgo value={device.lastUsed} />
        </Field>
      </dl>
      {result && (
        <Alert
          variant={result.success ? "success" : "danger"}
          className="py-2 text-xs"
        >
          <AlertDescription>
            <strong>
              {result.success ? "Sent" : result.fcmErrorCode || result.result}
            </strong>{" "}
            — {result.message}
          </AlertDescription>
        </Alert>
      )}
    </li>
  );
};

const LookupResult = ({ data }) => (
  <>
    {data.warnings.length > 0 && (
      <Alert variant="warning" icon={<AlertTriangle className="h-4 w-4" />}>
        <AlertDescription>
          <ul className="list-disc space-y-0.5 pl-4">
            {data.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    )}

    <Panel title="Account">
      {data.account ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 sm:px-5 lg:grid-cols-3">
          <Field label="Username">{data.account.username}</Field>
          <Field label="Email">{data.account.email || "—"}</Field>
          <Field label="Status">
            <StatusBadge status={data.account.registrationStatus} />
          </Field>
          <Field label="User ID">
            <span className="inline-flex items-center gap-1">
              <Mono>{data.account.userId}</Mono>
              <CopyButton value={data.account.userId} label="user ID" />
            </span>
          </Field>
          <Field label="Active sessions">
            {data.account.activeSessionCount}
          </Field>
          <Field label="Created">
            {formatDateTime(data.account.createdAt)}
          </Field>
        </dl>
      ) : (
        <p className="p-4 text-sm text-red-600 dark:text-red-400">
          No user account found — the device record is orphaned.
        </p>
      )}
    </Panel>

    <Panel
      title="Devices & push tokens"
      description={
        data.deviceRecord?.lastUpdated &&
        `Record updated ${formatDateTime(data.deviceRecord.lastUpdated)}`
      }
    >
      {data.deviceRecord?.devices.length ? (
        <ul className="divide-y divide-border">
          {data.deviceRecord.devices.map((device) => (
            <DeviceDiagnostics
              key={device.deviceUUID}
              userId={data.deviceRecord.userId}
              device={device}
            />
          ))}
        </ul>
      ) : (
        <EmptyState icon={Smartphone} title="No devices registered" />
      )}
    </Panel>

    <Panel title="Recent notifications" description="Latest 15">
      {data.notifications.length ? (
        <ul className="divide-y divide-border">
          {data.notifications.map((notification) => (
            <li
              key={notification.notificationId}
              className="flex items-center justify-between gap-4 px-4 py-2.5 sm:px-5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">
                  {notification.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  <TimeAgo value={notification.createdAt} />
                  {notification.clientId && ` · ${notification.clientId}`}
                </p>
              </div>
              <StatusBadge status={notification.status} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Bell} title="No notification history" />
      )}
    </Panel>
  </>
);

export const DiagnosticsSection = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeQuery = searchParams.get("q") || "";
  const [input, setInput] = useState(activeQuery);
  const lookup = useResource(diagnosticsPath(activeQuery));

  // Follow external navigation (e.g. "Open diagnostics" from Users).
  useEffect(() => setInput(activeQuery), [activeQuery]);

  const submit = (e) => {
    e.preventDefault();
    const query = input.trim();
    if (!query) return;
    if (query === activeQuery) lookup.refresh();
    else setSearchParams({ q: query });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Diagnostics"
        description="Inspect a user's account, devices, push-token state and recent notifications — e.g. to troubleshoot pushes that are not delivered."
      />

      <MigrationPanel />

      <Panel title="User lookup">
        <form
          onSubmit={submit}
          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:px-5"
        >
          <div className="flex-1">
            <Input
              label="Username, email or user ID"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. jdoe or jdoe@example.com"
            />
          </div>
          <Button
            type="submit"
            leftIcon={<Search className="h-4 w-4" />}
            isLoading={!!activeQuery && lookup.refreshing && !lookup.data}
            disabled={!input.trim()}
          >
            Look up
          </Button>
        </form>
      </Panel>

      {activeQuery && (
        <div className="space-y-5" aria-live="polite">
          <ResourceView resource={lookup} skeletonColumns={3}>
            {lookup.data && (
              <LookupResult key={activeQuery} data={lookup.data} />
            )}
          </ResourceView>
        </div>
      )}
    </div>
  );
};

export default DiagnosticsSection;
