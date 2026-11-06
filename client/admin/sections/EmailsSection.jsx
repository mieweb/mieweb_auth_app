import React, { useMemo, useState } from "react";
import { Badge, Button } from "@mieweb/ui";
import { Check, Mail, X } from "lucide-react";
import { RESOURCES } from "../api";
import { useResource } from "../resources";
import { useAdmin } from "../AdminContext";
import { useUserActions, userActionKey } from "../userActions";
import {
  EmptyState,
  FilterTabs,
  PageHeader,
  Pager,
  Panel,
  RefreshButton,
  ResourceView,
  SearchInput,
  StatusBadge,
  TimeAgo,
  dangerGhostClass,
} from "../components/ui";
import { matchesQuery, paginate } from "../../../utils/adminHelpers";

const PAGE_SIZE = 25;

const TYPE_LABELS = {
  registration_approval: "Registration",
  support_request: "Support",
  account_deletion_admin: "Deletion (admin)",
  account_deletion_user: "Deletion (user)",
  pin_reset_temp: "Temporary PIN",
  pin_reset_request: "PIN reset request",
};

const FILTERS = [
  { value: "all", label: "All", test: () => true },
  {
    value: "registration",
    label: "Registration",
    test: (e) => e.type === "registration_approval",
  },
  {
    value: "pin",
    label: "PIN reset",
    test: (e) => e.type?.startsWith("pin_reset"),
  },
  {
    value: "support",
    label: "Support",
    test: (e) => e.type === "support_request",
  },
  {
    value: "deletion",
    label: "Deletion",
    test: (e) => e.type?.startsWith("account_deletion"),
  },
  {
    value: "failed",
    label: "Failed",
    test: (e) => e.status === "failed",
    attention: true,
  },
];

const isActionable = (email) =>
  email.type === "registration_approval" &&
  email.registrationStatus === "pending" &&
  email.userId;

export const EmailsSection = () => {
  const emails = useResource(RESOURCES.emails);
  const { isPending } = useAdmin();
  const { approve, remove } = useUserActions();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const list = useMemo(() => emails.data?.emails || [], [emails.data]);
  const filtered = useMemo(() => {
    const { test } = FILTERS.find((f) => f.value === filter);
    return list.filter(
      (e) =>
        test(e) && matchesQuery(query, e.subject, e.to, e.username, e.email),
    );
  }, [list, filter, query]);
  const current = paginate(filtered, page, PAGE_SIZE);

  const options = FILTERS.map(({ value, label, test, attention }) => ({
    value,
    label,
    attention,
    count: list.filter(test).length,
  }));

  const updateFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Emails"
        description="Outgoing email log (latest 200, kept for 90 days). Addresses and usernames are masked. Pending registrations can be handled inline."
        actions={<RefreshButton resource={emails} />}
      />

      <Panel>
        <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:items-center lg:justify-between lg:px-4">
          <FilterTabs
            label="Filter by type"
            options={options}
            value={filter}
            onChange={updateFilter(setFilter)}
          />
          <SearchInput
            value={query}
            onChange={updateFilter(setQuery)}
            placeholder="Search subject or recipient"
            label="Search emails"
          />
        </div>

        <ResourceView resource={emails} skeletonColumns={3}>
          {filtered.length === 0 ? (
            <EmptyState
              icon={Mail}
              title={
                list.length
                  ? "No emails match your filters"
                  : "No emails sent yet"
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {current.items.map((email) => {
                const target = {
                  userId: email.userId,
                  username: email.username,
                };
                return (
                  <li
                    key={email._id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge size="sm" variant="secondary">
                          {TYPE_LABELS[email.type] || email.type}
                        </Badge>
                        {email.status === "failed" && (
                          <StatusBadge status="failed" />
                        )}
                        {email.registrationStatus && (
                          <StatusBadge status={email.registrationStatus} />
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-foreground">
                        {email.subject}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        To {email.to}
                        {email.username && ` · ${email.username}`}
                        {" · "}
                        <TimeAgo value={email.createdAt} />
                      </p>
                      {email.error && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {email.error}
                        </p>
                      )}
                    </div>
                    {isActionable(email) && (
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          size="sm"
                          leftIcon={<Check className="h-3.5 w-3.5" />}
                          isLoading={isPending(
                            userActionKey(email.userId, "approve"),
                          )}
                          onClick={() => approve(target)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={dangerGhostClass}
                          leftIcon={<X className="h-3.5 w-3.5" />}
                          isLoading={isPending(
                            userActionKey(email.userId, "delete"),
                          )}
                          onClick={() => remove(target, { reject: true })}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
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

export default EmailsSection;
