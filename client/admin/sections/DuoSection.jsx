import React, { useState } from "react";
import {
  Badge,
  Input,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@mieweb/ui";
import { RotateCw, ShieldCheck, Trash2 } from "lucide-react";
import { api, RESOURCES } from "../api";
import { useResource } from "../resources";
import { useAdmin } from "../AdminContext";
import {
  CopyButton,
  CreateForm,
  EmptyState,
  Mono,
  PageHeader,
  Panel,
  RefreshButton,
  ResourceView,
  RowMenu,
  TimeAgo,
  cellClass,
  headClass,
} from "../components/ui";

const TYPE_OPTIONS = [
  { value: "auth", label: "Auth API" },
  { value: "admin", label: "Admin API" },
];

const credentialFields = (result) => [
  { label: "Integration key (ikey)", value: result.ikey },
  { label: "Secret key (skey)", value: result.skey },
];

export const DuoSection = () => {
  const integrations = useResource(RESOURCES.duo);
  const { run, confirm, isPending, revealSecret } = useAdmin();
  const [name, setName] = useState("");
  const [type, setType] = useState("auth");
  const list = integrations.data?.integrations || [];

  const post = (path, body) => api(path, { method: "POST", body });
  const keyFor = (integration, action) => `duo:${integration.name}:${action}`;

  const create = async () => {
    const trimmed = name.trim();
    const { ok, result } = await run(
      "duo:create",
      () => post("/api/admin/duo/create", { name: trimmed, type }),
      { success: `Created ${trimmed}`, invalidates: [RESOURCES.duo] },
    );
    if (!ok) return;
    setName("");
    revealSecret({
      title: `Credentials for ${result.name}`,
      fields: credentialFields(result),
    });
  };

  const setEnabled = (integration, enabled) =>
    run(
      keyFor(integration, "toggle"),
      () =>
        post("/api/admin/duo/set-enabled", { name: integration.name, enabled }),
      {
        success: `${integration.name} ${enabled ? "enabled" : "disabled"}`,
        invalidates: [RESOURCES.duo],
      },
    );

  const rotate = async (integration) => {
    const confirmed = await confirm({
      title: "Rotate credentials",
      description: `Generate a new ikey/skey for "${integration.name}"? The current credentials stop working immediately, so update the client right away.`,
      confirmLabel: "Rotate credentials",
      danger: true,
    });
    if (!confirmed) return;
    const { ok, result } = await run(
      keyFor(integration, "rotate"),
      () => post("/api/admin/duo/regenerate", { name: integration.name }),
      { success: "Credentials rotated", invalidates: [RESOURCES.duo] },
    );
    if (ok)
      revealSecret({
        title: `New credentials for ${result.name}`,
        fields: credentialFields(result),
      });
  };

  const remove = async (integration) => {
    const confirmed = await confirm({
      title: "Delete integration",
      description: `Delete "${integration.name}"? Clients using it will be rejected immediately. This cannot be undone.`,
      confirmLabel: "Delete integration",
      danger: true,
    });
    if (!confirmed) return;
    await run(
      keyFor(integration, "delete"),
      () =>
        api("/api/admin/duo/delete", {
          method: "DELETE",
          body: { name: integration.name },
        }),
      { success: "Integration deleted", invalidates: [RESOURCES.duo] },
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Duo Integrations"
        description="Duo-compatible credentials for identity providers (e.g. Authentik) that call the /auth/v2 and /admin/v1 APIs."
        actions={<RefreshButton resource={integrations} />}
      />

      <Panel title="Create integration">
        <CreateForm
          onSubmit={create}
          submitLabel="Create"
          isLoading={isPending("duo:create")}
          disabled={!name.trim()}
        >
          <div className="flex-1">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. authentik-prod"
              maxLength={100}
            />
          </div>
          <div className="sm:w-44">
            <Select
              label="Type"
              options={TYPE_OPTIONS}
              value={type}
              onValueChange={setType}
            />
          </div>
        </CreateForm>
      </Panel>

      <Panel
        title="Integrations"
        description={`${list.length} integration${list.length === 1 ? "" : "s"}`}
      >
        <ResourceView resource={integrations} skeletonColumns={4}>
          {list.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No Duo integrations yet"
              description="Create one for each identity provider that uses MIEAuth as its Duo backend."
            />
          ) : (
            <Table responsive={false}>
              <TableHeader>
                <TableRow>
                  <TableHead className={headClass}>Integration</TableHead>
                  <TableHead className={`${headClass} hidden md:table-cell`}>
                    Integration key
                  </TableHead>
                  <TableHead className={`${headClass} hidden lg:table-cell`}>
                    Last used
                  </TableHead>
                  <TableHead className={headClass}>Enabled</TableHead>
                  <TableHead className={`${headClass} text-right`}>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((integration) => {
                  const busy = ["toggle", "rotate", "delete"].some((action) =>
                    isPending(keyFor(integration, action)),
                  );
                  return (
                    <TableRow
                      key={integration.name}
                      className={`${isPending(keyFor(integration, "delete")) ? "opacity-50" : ""} transition-opacity`}
                    >
                      <TableCell className={cellClass}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {integration.name}
                          </span>
                          <Badge
                            size="sm"
                            variant={
                              integration.type === "admin"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {integration.type === "admin"
                              ? "Admin API"
                              : "Auth API"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Created <TimeAgo value={integration.createdAt} />
                        </p>
                      </TableCell>
                      <TableCell
                        className={`${cellClass} hidden md:table-cell`}
                      >
                        <div className="flex items-center gap-1">
                          <Mono>{integration.ikey}</Mono>
                          <CopyButton
                            value={integration.ikey}
                            label="integration key"
                          />
                        </div>
                      </TableCell>
                      <TableCell
                        className={`${cellClass} hidden text-muted-foreground lg:table-cell`}
                      >
                        <TimeAgo value={integration.lastUsed} />
                      </TableCell>
                      <TableCell className={cellClass}>
                        <Switch
                          size="sm"
                          checked={!!integration.enabled}
                          disabled={busy}
                          onCheckedChange={(enabled) =>
                            setEnabled(integration, enabled)
                          }
                          aria-label={`${integration.enabled ? "Disable" : "Enable"} ${integration.name}`}
                        />
                      </TableCell>
                      <TableCell className={`${cellClass} text-right`}>
                        <RowMenu
                          label={`More actions for ${integration.name}`}
                          items={[
                            {
                              label: "Rotate credentials",
                              icon: RotateCw,
                              disabled: busy,
                              onSelect: () => rotate(integration),
                            },
                            "separator",
                            {
                              label: "Delete integration",
                              icon: Trash2,
                              danger: true,
                              disabled: busy,
                              onSelect: () => remove(integration),
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </ResourceView>
      </Panel>
    </div>
  );
};

export default DuoSection;
