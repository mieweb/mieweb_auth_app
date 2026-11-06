import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Avatar,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@mieweb/ui";
import {
  Copy,
  Hourglass,
  KeyRound,
  Stethoscope,
  Trash2,
  UserCheck,
  Users as UsersIcon,
} from "lucide-react";
import { api, RESOURCES } from "../api";
import { useResource } from "../resources";
import { useAdmin } from "../AdminContext";
import { useUserActions, userActionKey } from "../userActions";
import { CooldownButton } from "../components/CooldownButton";
import {
  EmptyState,
  FilterTabs,
  PageHeader,
  Pager,
  Panel,
  RefreshButton,
  ResourceView,
  RowMenu,
  SearchInput,
  StatusBadge,
  TimeAgo,
  cellClass,
  headClass,
} from "../components/ui";
import {
  cooldownDeadline,
  countBy,
  formatDateTime,
  matchesQuery,
  paginate,
} from "../../../utils/adminHelpers";

const PAGE_SIZE = 25;

const fullName = (user) =>
  [user.firstName, user.lastName].filter(Boolean).join(" ");

const pendingFirstThenNewest = (a, b) =>
  (b.registrationStatus === "pending") - (a.registrationStatus === "pending") ||
  new Date(b.createdAt || 0) - new Date(a.createdAt || 0);

export const UsersSection = () => {
  const navigate = useNavigate();
  const users = useResource(RESOURCES.users);
  const { run, isPending, revealSecret, toast, confirm } = useAdmin();
  const { approve, remove } = useUserActions();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  // Cooldown deadlines from our own reset responses, so the countdown starts
  // immediately instead of waiting for the next list refresh.
  const [localDeadlines, setLocalDeadlines] = useState({});

  const list = useMemo(() => users.data?.users || [], [users.data]);
  const cooldownTotalMs = users.data?.pinResetCooldownTotalMs;
  const counts = useMemo(
    () => countBy(list, (u) => u.registrationStatus),
    [list],
  );
  const filtered = useMemo(
    () =>
      list
        .filter(
          (u) =>
            (status === "all" || u.registrationStatus === status) &&
            matchesQuery(query, u.username, u.email, fullName(u)),
        )
        .sort(pendingFirstThenNewest),
    [list, status, query],
  );
  const current = paginate(filtered, page, PAGE_SIZE);

  const filters = [
    { value: "all", label: "All", count: list.length },
    {
      value: "pending",
      label: "Pending",
      count: counts.pending || 0,
      attention: true,
    },
    { value: "approved", label: "Approved", count: counts.approved || 0 },
    counts.rejected && {
      value: "rejected",
      label: "Rejected",
      count: counts.rejected,
    },
  ].filter(Boolean);

  const updateFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const deadlineFor = (user) =>
    Math.max(
      localDeadlines[user._id] || 0,
      cooldownDeadline(users.fetchedAt, user.pinResetCooldownMs),
    );

  const resetPin = async (user, isResend) => {
    const confirmed = await confirm({
      title: isResend ? "Resend temporary PIN" : "Reset PIN",
      description: `Issue a new temporary PIN for "${user.username}"? Their current PIN${
        isResend ? " and the previous temporary PIN" : ""
      } will stop working and they will be signed out on every device.`,
      confirmLabel: isResend ? "Resend PIN" : "Reset PIN",
      danger: true,
    });
    if (!confirmed) return;

    // Time the server answered, taken before run() waits for the list refresh,
    // so the local countdown isn't stretched by the refetch duration.
    let answeredAt = 0;
    const { ok, result, error } = await run(
      userActionKey(user._id, "pin"),
      () =>
        api("/api/admin/users/reset-pin", {
          method: "POST",
          body: { userId: user._id },
        }).finally(() => {
          answeredAt = Date.now();
        }),
      {
        success: `Temporary PIN issued for ${user.username}`,
        invalidates: [RESOURCES.users, RESOURCES.emails],
      },
    );

    // Start the countdown only from a server answer: success or a rate-limit.
    const cooldownMs = ok ? result.cooldownMs : error?.retryAfterMs;
    if (cooldownMs) {
      setLocalDeadlines((prev) => ({
        ...prev,
        [user._id]: answeredAt + cooldownMs,
      }));
    }
    if (!ok) return;

    revealSecret({
      title: `Temporary PIN for ${user.username}`,
      fields: [{ label: "Temporary PIN", value: result.tempPin, large: true }],
      note: `Single use, expires ${formatDateTime(result.expiresAt)}.${
        result.emailSent ? " It was also emailed to the user." : ""
      }`,
      warning: result.emailSent
        ? null
        : "The email could not be sent — share this PIN with the user over a secure channel.",
    });
  };

  const copyUserId = async (user) => {
    try {
      await navigator.clipboard.writeText(user._id);
      toast("User ID copied");
    } catch {
      toast("Couldn't access the clipboard", "danger");
    }
  };

  const hasFilters = query || status !== "all";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        description="Approve registrations, issue temporary PINs and remove accounts."
        actions={<RefreshButton resource={users} />}
      />

      {counts.pending > 0 && status !== "pending" && (
        <button
          type="button"
          onClick={() => updateFilter(setStatus)("pending")}
          className="flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900 transition-colors hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/70"
        >
          <Hourglass className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">
            <strong className="font-semibold">{counts.pending}</strong>{" "}
            {counts.pending === 1 ? "registration is" : "registrations are"}{" "}
            awaiting approval
          </span>
          <span className="font-medium underline underline-offset-2">
            Review
          </span>
        </button>
      )}

      <Panel>
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <FilterTabs
            label="Filter by status"
            options={filters}
            value={status}
            onChange={updateFilter(setStatus)}
          />
          <SearchInput
            value={query}
            onChange={updateFilter(setQuery)}
            placeholder="Search name, username or email"
            label="Search users"
          />
        </div>

        <ResourceView resource={users} skeletonColumns={4}>
          {filtered.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              title={
                hasFilters ? "No users match your filters" : "No users yet"
              }
              description={
                hasFilters
                  ? "Try a different search or status."
                  : "Users appear here once they register in the mobile app."
              }
              action={
                hasFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQuery("");
                      updateFilter(setStatus)("all");
                    }}
                  >
                    Clear filters
                  </Button>
                )
              }
            />
          ) : (
            <Table responsive={false}>
              <TableHeader>
                <TableRow>
                  <TableHead className={headClass}>User</TableHead>
                  <TableHead className={`${headClass} hidden md:table-cell`}>
                    Email
                  </TableHead>
                  <TableHead className={headClass}>Status</TableHead>
                  <TableHead className={`${headClass} hidden lg:table-cell`}>
                    Registered
                  </TableHead>
                  <TableHead className={`${headClass} text-right`}>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {current.items.map((user) => {
                  const name = fullName(user);
                  const isPendingUser = user.registrationStatus === "pending";
                  const isApproved = user.registrationStatus === "approved";
                  const hasActiveReset =
                    user.pinResetExpiresAt &&
                    new Date(user.pinResetExpiresAt) > new Date();
                  const deleting = isPending(userActionKey(user._id, "delete"));
                  return (
                    <TableRow
                      key={user._id}
                      className={`${isPendingUser ? "bg-amber-50/50 dark:bg-amber-950/20" : ""} ${
                        deleting ? "opacity-50" : ""
                      } transition-opacity`}
                    >
                      <TableCell className={cellClass}>
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar size="sm" name={name || user.username} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {user.username}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {name || "—"}
                              <span className="md:hidden"> · {user.email}</span>
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell
                        className={`${cellClass} hidden max-w-[16rem] truncate text-muted-foreground md:table-cell`}
                      >
                        {user.email || "—"}
                      </TableCell>
                      <TableCell className={cellClass}>
                        <StatusBadge status={user.registrationStatus} />
                      </TableCell>
                      <TableCell
                        className={`${cellClass} hidden text-muted-foreground lg:table-cell`}
                      >
                        <TimeAgo value={user.createdAt} />
                      </TableCell>
                      <TableCell className={cellClass}>
                        <div className="flex items-center justify-end gap-1.5">
                          {isPendingUser && (
                            <Button
                              size="sm"
                              leftIcon={<UserCheck className="h-3.5 w-3.5" />}
                              isLoading={isPending(
                                userActionKey(user._id, "approve"),
                              )}
                              disabled={deleting}
                              onClick={() =>
                                approve({
                                  userId: user._id,
                                  username: user.username,
                                })
                              }
                            >
                              Approve
                            </Button>
                          )}
                          {isApproved && (
                            <CooldownButton
                              deadline={deadlineFor(user)}
                              totalMs={cooldownTotalMs}
                              isLoading={isPending(
                                userActionKey(user._id, "pin"),
                              )}
                              onClick={() => resetPin(user, hasActiveReset)}
                            >
                              <KeyRound
                                className="mr-1.5 h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              {hasActiveReset ? "Resend PIN" : "Reset PIN"}
                            </CooldownButton>
                          )}
                          <RowMenu
                            label={`More actions for ${user.username}`}
                            items={[
                              {
                                label: "Copy user ID",
                                icon: Copy,
                                onSelect: () => copyUserId(user),
                              },
                              {
                                label: "Open diagnostics",
                                icon: Stethoscope,
                                onSelect: () =>
                                  navigate(
                                    `/admin/diagnostics?q=${encodeURIComponent(user.username)}`,
                                  ),
                              },
                              "separator",
                              {
                                label: isPendingUser
                                  ? "Reject and delete"
                                  : "Delete user",
                                icon: Trash2,
                                danger: true,
                                disabled: deleting,
                                onSelect: () =>
                                  remove(
                                    {
                                      userId: user._id,
                                      username: user.username,
                                    },
                                    { reject: isPendingUser },
                                  ),
                              },
                            ]}
                          />
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

export default UsersSection;
