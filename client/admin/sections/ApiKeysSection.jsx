import React, { useState } from "react";
import {
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@mieweb/ui";
import { KeyRound, Trash2 } from "lucide-react";
import { api, RESOURCES } from "../api";
import { useResource } from "../resources";
import { useAdmin } from "../AdminContext";
import {
  CreateForm,
  EmptyState,
  Mono,
  PageHeader,
  Panel,
  RefreshButton,
  ResourceView,
  TimeAgo,
  cellClass,
  dangerGhostClass,
  headClass,
} from "../components/ui";

export const ApiKeysSection = () => {
  const keys = useResource(RESOURCES.apiKeys);
  const { run, confirm, isPending, revealSecret } = useAdmin();
  const [clientId, setClientId] = useState("");
  const list = keys.data?.keys || [];

  const create = async () => {
    const id = clientId.trim();
    const { ok, result } = await run(
      "apikey:create",
      () =>
        api("/api/admin/api-keys/create", {
          method: "POST",
          body: { clientId: id },
        }),
      {
        success: `API key created for ${id}`,
        invalidates: [RESOURCES.apiKeys],
      },
    );
    if (!ok) return;
    setClientId("");
    revealSecret({
      title: `API key for ${id}`,
      fields: [{ label: "API key", value: result.apiKey }],
    });
  };

  const remove = async (key) => {
    const confirmed = await confirm({
      title: "Delete API key",
      description: `Delete the API key for "${key.clientId}"? Requests using it will be rejected immediately. This cannot be undone.`,
      confirmLabel: "Delete key",
      danger: true,
    });
    if (!confirmed) return;
    await run(
      `apikey:${key.clientId}:delete`,
      () =>
        api("/api/admin/api-keys/delete", {
          method: "DELETE",
          body: { clientId: key.clientId },
        }),
      { success: "API key deleted", invalidates: [RESOURCES.apiKeys] },
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="API Keys"
        description="Credentials for client applications that send sign-in requests through the MIEAuth API. Keys are shown once at creation."
        actions={<RefreshButton resource={keys} />}
      />

      <Panel title="Create key">
        <CreateForm
          onSubmit={create}
          submitLabel="Create key"
          isLoading={isPending("apikey:create")}
          disabled={!clientId.trim()}
        >
          <div className="flex-1">
            <Input
              label="Client ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="e.g. ldap.example.com"
              maxLength={200}
            />
          </div>
        </CreateForm>
      </Panel>

      <Panel
        title="Client keys"
        description={`${list.length} key${list.length === 1 ? "" : "s"}`}
      >
        <ResourceView resource={keys} skeletonColumns={4}>
          {list.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title="No API keys yet"
              description="Create a key for each client application that needs to call the API."
            />
          ) : (
            <Table responsive={false}>
              <TableHeader>
                <TableRow>
                  <TableHead className={headClass}>Client</TableHead>
                  <TableHead className={`${headClass} hidden sm:table-cell`}>
                    Key
                  </TableHead>
                  <TableHead className={`${headClass} hidden md:table-cell`}>
                    Created
                  </TableHead>
                  <TableHead className={headClass}>Last used</TableHead>
                  <TableHead className={`${headClass} text-right`}>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((key) => {
                  const deleting = isPending(`apikey:${key.clientId}:delete`);
                  return (
                    <TableRow
                      key={key.clientId}
                      className={`${deleting ? "opacity-50" : ""} transition-opacity`}
                    >
                      <TableCell
                        className={`${cellClass} font-medium text-foreground`}
                      >
                        {key.clientId}
                      </TableCell>
                      <TableCell
                        className={`${cellClass} hidden sm:table-cell`}
                      >
                        <Mono aria-label="Key prefix (rest hidden)">
                          {key.keyPrefix}••••••••
                        </Mono>
                      </TableCell>
                      <TableCell
                        className={`${cellClass} hidden text-muted-foreground md:table-cell`}
                      >
                        <TimeAgo value={key.createdAt} />
                      </TableCell>
                      <TableCell
                        className={`${cellClass} text-muted-foreground`}
                      >
                        <TimeAgo value={key.lastUsed} />
                      </TableCell>
                      <TableCell className={`${cellClass} text-right`}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={dangerGhostClass}
                          leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                          isLoading={deleting}
                          onClick={() => remove(key)}
                          aria-label={`Delete API key for ${key.clientId}`}
                        >
                          <span className="hidden sm:inline">Delete</span>
                        </Button>
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

export default ApiKeysSection;
