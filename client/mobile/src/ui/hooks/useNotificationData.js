import { useState, useMemo } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { NotificationHistory } from "../../../../../utils/api/notificationHistory";
import { DeviceDetails } from "../../../../../utils/api/deviceDetails";

const PAGE_SIZE = 5;

export const useNotificationData = (userId) => {
  const [filter, setFilter] = useState("all"); // e.g., 'all', 'pending', 'approved', 'rejected'
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Real-time reactive data via Meteor subscriptions
  const { allNotifications, isLoading } = useTracker(() => {
    if (!userId) {
      return { allNotifications: [], isLoading: false };
    }

    const notifHandle = Meteor.subscribe("notificationHistory.byUser", userId);
    const deviceHandle = Meteor.subscribe("deviceDetails.byUser", userId);

    const isLoading = !notifHandle.ready() || !deviceHandle.ready();

    // Reactively query Minimongo — automatically re-runs when data changes
    const notifications = NotificationHistory.find(
      { userId },
      { sort: { createdAt: -1 }, limit: 50 },
    ).fetch();

    // Get device details from Minimongo for enrichment
    const userDeviceDoc = DeviceDetails.findOne({ userId });
    const devices = userDeviceDoc?.devices || [];

    const deviceInfoMap = {};
    devices.forEach((device) => {
      if (device.appId) {
        deviceInfoMap[device.appId] = {
          deviceModel: device.deviceModel || "Unknown",
          devicePlatform: device.devicePlatform || "Unknown",
        };
      }
    });

    // Enrich notifications with device info
    const enrichedNotifications = notifications.map((notification) => ({
      ...notification,
      deviceModel: deviceInfoMap[notification.appId]?.deviceModel || "Unknown",
      devicePlatform:
        deviceInfoMap[notification.appId]?.devicePlatform || "Unknown",
    }));

    return { allNotifications: enrichedNotifications, isLoading };
  }, [userId]);

  const filteredNotifications = useMemo(() => {
    return allNotifications.filter((notification) => {
      // Filter by status
      if (filter !== "all" && notification.status !== filter) {
        return false;
      }
      // Filter by search term (case-insensitive)
      if (searchTerm) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        const matchesTitle = notification.title
          ?.toLowerCase()
          .includes(lowerSearchTerm);
        const matchesBody = notification.body
          ?.toLowerCase()
          .includes(lowerSearchTerm);
        if (!matchesTitle && !matchesBody) {
          return false;
        }
      }
      return true;
    });
  }, [allNotifications, filter, searchTerm]);

  // Pagination logic
  const paginatedNotifications = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredNotifications.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredNotifications, currentPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredNotifications.length / PAGE_SIZE);
  }, [filteredNotifications.length]);

  // Calculate today's activity count
  const todaysActivityCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allNotifications.filter((n) => new Date(n.createdAt) >= today)
      .length;
  }, [allNotifications]);

  // Calculate counts per status
  const statusCounts = useMemo(() => {
    const counts = {
      pending: 0,
      approve: 0,
      reject: 0,
      total: allNotifications.length,
    };
    allNotifications.forEach((n) => {
      if (n.status === "pending") counts.pending++;
      else if (n.status === "approve") counts.approve++;
      else if (n.status === "reject") counts.reject++;
    });
    return counts;
  }, [allNotifications]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setCurrentPage(1); // Reset to first page on filter change
  };

  const handleSearchChange = (newSearchTerm) => {
    setSearchTerm(newSearchTerm);
    setCurrentPage(1); // Reset to first page on search change
  };

  return {
    notifications: paginatedNotifications,
    isLoading,
    filter,
    searchTerm,
    currentPage,
    totalPages,
    todaysActivityCount,
    statusCounts,
    handleFilterChange,
    handleSearchChange,
    handlePageChange,
  };
};
