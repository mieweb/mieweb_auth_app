import React, { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@mieweb/ui";
import { Check, Smartphone, Trash2 } from "lucide-react";
import { api, RESOURCES } from "../api";
import { useResource } from "../resources";
import { useAdmin } from "../AdminContext";
import {
  CopyButton,
  EmptyState,
  FilterTabs,
  Mono,
  PageHeader,
  Pager,
  Panel,
  RefreshButton,
  ResourceView,
  SearchInput,
  StatusBadge,
  TimeAgo,
  cellClass,
  dangerGhostClass,
  headClass,
} from "../components/ui";
import { countBy, matchesQuery, paginate } from "../../../utils/adminHelpers";

const PAGE_SIZE = 25;

const deviceName = (device) =>
  `${device.deviceModel || "Unknown device"}${
    device.devicePlatform ? ` · ${device.devicePlatform}` : ""
  }`;

const pendingFirstThenOwner = (a, b) =>
  (b.status === "pending") - (a.status === "pending") ||
  (a.username || "").localeCompare(b.username || "");

export const DevicesSection = () => {
  const devices = useResource(RESOURCES.devices);
  const { run, confirm, isPending } = useAdmin();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const list = useMemo(() => devices.data?.devices || [], [devices.data]);
  const counts = useMemo(() => countBy(list, (d) => d.status), [list]);
  const ownerCount = useMemo(
    () => new Set(list.map((d) => d.userId)).size,
    [list],
  );
  const filtered = useMemo(
    () =>
      list
        .filter(
          (d) =>
            (status === "all" || d.status === status) &&
            matchesQuery(
              query,
              d.username,
              d.email,
              d.deviceModel,
              d.devicePlatform,
              d.deviceUUID,
            ),
        )
        .sort(pendingFirstThenOwner),
    [list, status, query],
  );
  const current = paginate(filtered, page, PAGE_SIZE);

  const updateFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const keyFor = (device, action) =>
    `device:${device.userId}:${device.deviceUUID}:${action}`;

  const mutate = (device, action, path, success) =>
    run(
      keyFor(device, action),
      () =>
        api(path, {
          method: "POST",
          body: { userId: device.userId, deviceUUID: device.deviceUUID },
        }),
      { success, invalidates: [RESOURCES.devices] },
    );

  const approve = async (device) => {
    const confirmed = await confirm({
      title: "Approve device",
      description: `Approve ${deviceName(device)} for "${device.username}"? It will be able to receive and answer sign-in requests.`,
      confirmLabel: "Approve",
    });
    if (confirmed)
      await mutate(
        device,
        "approve",
        "/api/admin/devices/approve",
        "Device approved",
      );
  };

  const revoke = async (device) => {
    const confirmed = await confirm({
      title: "Revoke device",
      description: `Remove ${deviceName(device)} from "${device.username}"?${
        device.isPrimary ? " This is their primary device." : ""
      } The user will have to register it again.`,
      confirmLabel: "Revoke device",
      danger: true,
    });
    if (confirmed)
      await mutate(
        device,
        "revoke",
        "/api/admin/devices/revoke",
        "Device revoked",
      );
  };

  const hasFilters = query || status !== "all";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Devices"
        description={`${list.length} registered device${list.length === 1 ? "" : "s"} across ${ownerCount} user${ownerCount === 1 ? "" : "s"}.`}
        actions={<RefreshButton resource={devices} />}
      />

      <Panel>
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <FilterTabs
            label="Filter by status"
            value={status}
            onChange={updateFilter(setStatus)}
            options={[
              { value: "all", label: "All", count: list.length },
              {
                value: "pending",
                label: "Pending",
                count: counts.pending || 0,
                attention: true,
              },
              {
                value: "approved",
                label: "Approved",
                count: counts.approved || 0,
              },
            ]}
          />
          <SearchInput
            value={query}
            onChange={updateFilter(setQuery)}
            placeholder="Search user, model or UUID"
            label="Search devices"
          />
        </div>

        <ResourceView resource={devices} skeletonColumns={5}>
          {filtered.length === 0 ? (
            <EmptyState
              icon={Smartphone}
              title={
                hasFilters
                  ? "No devices match your filters"
                  : "No devices registered"
              }
              description={
                hasFilters ? "Try a different search or status." : undefined
              }
            />
          ) : (
            <Table responsive={false}>
              <TableHeader>
                <TableRow>
                  <TableHead className={headClass}>Device</TableHead>
                  <TableHead className={`${headClass} hidden md:table-cell`}>
                    Owner
                  </TableHead>
                  <TableHead className={headClass}>Status</TableHead>
                  <TableHead className={`${headClass} hidden lg:table-cell`}>
                    UUID
                  </TableHead>
                  <TableHead className={`${headClass} hidden xl:table-cell`}>
                    Updated
                  </TableHead>
                  <TableHead className={`${headClass} text-right`}>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {current.items.map((device) => {
                  const revoking = isPending(keyFor(device, "revoke"));
                  return (
                    <TableRow
                      key={`${device.userId}:${device.deviceUUID}`}
                      className={`${device.status === "pending" ? "bg-amber-50/50 dark:bg-amber-950/20" : ""} ${
                        revoking ? "opacity-50" : ""
                      } transition-opacity`}
                    >
                      <TableCell className={cellClass}>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">
                            {deviceName(device)}
                          </p>
                          {device.isPrimary && (
                            <Badge size="sm" variant="outline">
                              Primary
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground md:hidden">
                          {device.username}
                        </p>
                      </TableCell>
                      <TableCell
                        className={`${cellClass} hidden md:table-cell`}
                      >
                        <p className="text-foreground">
                          {device.username || "—"}
                        </p>
                        <p className="max-w-[14rem] truncate text-xs text-muted-foreground">
                          {device.email}
                        </p>
                      </TableCell>
                      <TableCell className={cellClass}>
                        <StatusBadge status={device.status} />
                      </TableCell>
                      <TableCell
                        className={`${cellClass} hidden lg:table-cell`}
                      >
                        <div className="flex items-center gap-1">
                          <Mono className="inline-block max-w-[11rem] truncate align-middle">
                            {device.deviceUUID}
                          </Mono>
                          <CopyButton
                            value={device.deviceUUID}
                            label="device UUID"
                          />
                        </div>
                      </TableCell>
                      <TableCell
                        className={`${cellClass} hidden text-muted-foreground xl:table-cell`}
                      >
                        <TimeAgo value={device.lastUpdated} />
                      </TableCell>
                      <TableCell className={cellClass}>
                        <div className="flex items-center justify-end gap-1.5">
                          {device.status === "pending" && (
                            <Button
                              size="sm"
                              leftIcon={<Check className="h-3.5 w-3.5" />}
                              isLoading={isPending(keyFor(device, "approve"))}
                              disabled={revoking}
                              onClick={() => approve(device)}
                            >
                              Approve
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className={dangerGhostClass}
                            leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                            isLoading={revoking}
                            onClick={() => revoke(device)}
                            aria-label={`Revoke ${deviceName(device)} for ${device.username}`}
                          >
                            <span className="hidden sm:inline">Revoke</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <Pager
            page={current.page}
            totalPages={current.totalPages}
            onPageChange={setPage}
            total={filtered.length}
            pageSize={PAGE_SIZE}
          />
        </ResourceView>
      </Panel>
    </div>
  );
};

export default DevicesSection;
