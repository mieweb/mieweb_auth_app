import { useState, useMemo, useCallback } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { NotificationHistory } from "../../../../../utils/api/notificationHistory.js";

const PAGE_SIZE = 5;

export const useNotificationData = (userId) => {
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Reactive subscription + query via useTracker
  const { allNotifications, isLoading } = useTracker(() => {
    if (!userId) return { allNotifications: [], isLoading: false };

    const handle = Meteor.subscribe("notificationHistory.byUser", userId);

    return {
      isLoading: !handle.ready(),
      allNotifications: handle.ready()
        ? NotificationHistory.find(
            { userId },
            { sort: { createdAt: -1 } },
          ).fetch()
        : [],
    };
  }, [userId]);

  const filteredNotifications = useMemo(() => {
    return allNotifications.filter((notification) => {
      if (filter !== "all" && notification.status !== filter) return false;
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        const matchesTitle = notification.title?.toLowerCase().includes(lower);
        const matchesBody = notification.body?.toLowerCase().includes(lower);
        if (!matchesTitle && !matchesBody) return false;
      }
      return true;
    });
  }, [allNotifications, filter, searchTerm]);

  // Pagination
  const paginatedNotifications = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredNotifications.slice(start, start + PAGE_SIZE);
  }, [filteredNotifications, currentPage]);

  const totalPages = useMemo(
    () => Math.ceil(filteredNotifications.length / PAGE_SIZE),
    [filteredNotifications.length],
  );

  // Today's activity count
  const todaysActivityCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allNotifications.filter((n) => new Date(n.createdAt) >= today)
      .length;
  }, [allNotifications]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const handleSearchChange = (newSearchTerm) => {
    setSearchTerm(newSearchTerm);
    setCurrentPage(1);
  };

  // Keep fetchNotificationHistory as a no-op for callers that still reference it.
  // With reactive subscriptions the data auto-updates — no manual refetch needed.
  const fetchNotificationHistory = useCallback(() => {}, []);

  return {
    notifications: paginatedNotifications,
    isLoading,
    error: null,
    filter,
    searchTerm,
    currentPage,
    totalPages,
    todaysActivityCount,
    fetchNotificationHistory,
    handleFilterChange,
    handleSearchChange,
    handlePageChange,
  };
};
