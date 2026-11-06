import React, { useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  Input,
  Pagination,
  SkeletonTable,
} from "@mieweb/ui";
import {
  AlertTriangle,
  Check,
  Copy,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  formatDateTime,
  formatRelativeTime,
} from "../../../utils/adminHelpers";

export const PageHeader = ({ title, description, actions }) => (
  <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      {description && (
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {description}
        </p>
      )}
    </div>
    {actions && (
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    )}
  </header>
);

export const Panel = ({
  title,
  description,
  actions,
  children,
  className = "",
}) => (
  <section
    className={`rounded-xl border border-border bg-card shadow-sm ${className}`}
  >
    {(title || actions) && (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="min-w-0">
          {title && (
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          )}
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions}
      </div>
    )}
    {children}
  </section>
);

export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
    {Icon && (
      <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
    )}
    <p className="text-sm font-medium text-foreground">{title}</p>
    {description && (
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    )}
    {action}
  </div>
);

const STATUS_VARIANTS = {
  approved: "success",
  approve: "success",
  sent: "success",
  enabled: "success",
  pending: "warning",
  rejected: "danger",
  reject: "danger",
  failed: "danger",
  revoked: "danger",
  deleted: "secondary",
  disabled: "secondary",
};

export const StatusBadge = ({ status }) => (
  <Badge
    size="sm"
    variant={STATUS_VARIANTS[status] || "secondary"}
    className="capitalize"
  >
    {status || "unknown"}
  </Badge>
);

export const Mono = ({ children, className = "" }) => (
  <code
    className={`rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground ${className}`}
  >
    {children}
  </code>
);

export const CopyButton = ({ value, label = "value", className = "" }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); the value stays selectable.
    }
  };

  const Icon = copied ? Check : Copy;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={copy}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
      className={`h-7 w-7 shrink-0 ${className}`}
    >
      <Icon
        className={`h-3.5 w-3.5 ${copied ? "text-green-600 dark:text-green-400" : ""}`}
        aria-hidden="true"
      />
    </Button>
  );
};

export const SearchInput = ({
  value,
  onChange,
  placeholder,
  label = "Search",
}) => (
  <div className="relative w-full sm:max-w-xs">
    <Search
      className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden="true"
    />
    <Input
      type="search"
      size="sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      label={label}
      hideLabel
      className="pl-9"
    />
  </div>
);

/** Segmented filter control; `options` = [{ value, label, count?, attention? }]. */
export const FilterTabs = ({ options, value, onChange, label }) => (
  <div
    role="group"
    aria-label={label}
    className="inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1"
  >
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(option.value)}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
            active
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
          {option.count !== undefined && (
            <span
              className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                option.attention && option.count > 0
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                  : "bg-background/60 text-muted-foreground"
              }`}
            >
              {option.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

/** Refresh control showing when the resource was last synced with the server. */
export const RefreshButton = ({ resource }) => (
  <Button
    type="button"
    variant="outline"
    size="sm"
    onClick={resource.refresh}
    disabled={resource.refreshing}
    title={
      resource.fetchedAt
        ? `Last updated ${formatDateTime(resource.fetchedAt)}`
        : undefined
    }
    leftIcon={
      <RefreshCw
        className={`h-3.5 w-3.5 ${resource.refreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
        aria-hidden="true"
      />
    }
  >
    Refresh
  </Button>
);

/**
 * Loading / error wrapper for a resource. Keeps showing the last good data
 * when a background refresh fails, with an inline warning.
 */
export const ResourceView = ({ resource, skeletonColumns = 4, children }) => {
  if (resource.loading) {
    return (
      <div className="p-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading…</span>
        <SkeletonTable rows={5} columns={skeletonColumns} />
      </div>
    );
  }
  if (resource.error && !resource.data) {
    return (
      <div className="p-4">
        <Alert variant="danger" icon={<AlertTriangle className="h-4 w-4" />}>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{resource.error.message}</span>
            <Button size="sm" variant="outline" onClick={resource.refresh}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  return (
    <>
      {resource.error && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          Couldn&apos;t refresh — showing data from{" "}
          {formatRelativeTime(resource.fetchedAt)}.
          <button
            type="button"
            onClick={resource.refresh}
            className="font-medium underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}
      {children}
    </>
  );
};

export const Pager = ({ page, totalPages, onPageChange, total, pageSize }) => {
  if (totalPages <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t border-border px-4 py-3 sm:flex-row">
      <p className="text-xs text-muted-foreground tabular-nums">
        {first}–{last} of {total}
      </p>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        size="sm"
      />
    </div>
  );
};

/** Overflow "⋯" menu for row actions. Items: { label, icon, onSelect, danger?, disabled? } | "separator". */
export const RowMenu = ({ label, items }) => {
  const [open, setOpen] = useState(false);
  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          className="h-8 w-8"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      }
    >
      <DropdownContent className="p-1">
        {items.filter(Boolean).map((item, index) =>
          item === "separator" ? (
            <DropdownSeparator key={`sep-${index}`} />
          ) : (
            <DropdownItem
              key={item.label}
              icon={
                item.icon && (
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                )
              }
              variant={item.danger ? "danger" : "default"}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </DropdownItem>
          ),
        )}
      </DropdownContent>
    </Dropdown>
  );
};

/** Inline create form (fields + submit) used for issuing new credentials. */
export const CreateForm = ({
  onSubmit,
  submitLabel,
  isLoading,
  disabled,
  children,
}) => (
  <form
    onSubmit={(e) => {
      e.preventDefault();
      if (!disabled && !isLoading) onSubmit();
    }}
    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:px-5"
  >
    {children}
    <Button
      type="submit"
      isLoading={isLoading}
      disabled={disabled}
      leftIcon={<Plus className="h-4 w-4" />}
      className="shrink-0"
    >
      {submitLabel}
    </Button>
  </form>
);

/** Relative timestamp with the absolute time available on hover. */
export const TimeAgo = ({ value }) =>
  value ? (
    <time
      dateTime={new Date(value).toISOString()}
      title={formatDateTime(value)}
    >
      {formatRelativeTime(value)}
    </time>
  ) : (
    <span className="text-muted-foreground">Never</span>
  );

/** Compact table cell / header class overrides (mieweb/ui defaults are roomy). */
export const cellClass = "px-4 py-2.5";
export const headClass =
  "h-9 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground";
/** Low-emphasis destructive button (row-level delete/revoke). */
export const dangerGhostClass =
  "text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40";
