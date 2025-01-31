import React, { useState, useEffect } from 'react';
import { Shield, LogOut, User, Mail, CheckCircle, XCircle, Clock, Smartphone, Edit, Filter, Search, BellRing, Moon, Sun } from 'lucide-react';
import { Session } from 'meteor/session';
import { Meteor } from 'meteor/meteor';
import ActionsModal from './Modal/ActionsModal';
import ResultModal from './Modal/ResultModal';
import { Tracker } from 'meteor/tracker';
import { formatDateTime } from '../../utils/utils';

export const LandingPage = () => {
  const userProfile = Session.get('userProfile') || {};
  const capturedDeviceInfo = Session.get('capturedDeviceInfo') || {};
  const [notificationActivities, setNotificationActivities] = useState([]);
  const [notificationHistory, setNotificationHistory] = useState([]);

  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: userProfile.email || '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [hasFetchedData, setHasFetchedData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isActionsModalOpen, setIsActionsModalOpen] = useState(false)
  const [isResultModalOpen, setIsResultModalOpen] = useState(false)
  const [notificationId, setNotificationId] = useState(null);

  const [deviceInfo, setDeviceInfo] = useState({
    model: capturedDeviceInfo.model || '',
    platform: capturedDeviceInfo.platform || '',
  });

  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    console.log("Initializing Tracker");
  
    const tracker = Tracker.autorun(async () => {
      const newNotification = Session.get("notificationReceivedId");
  
      console.log("Tracker detected change:", newNotification?.appId);
  
      if (!newNotification) return;
  
      setNotificationId(newNotification.appId);
  
      if (newNotification.status === "pending") {
        setIsActionsModalOpen(true);
      } else {
        try {
          const notfId = await getNotificationId();
          if (notfId) {
            console.log("Resolved Notification ID:", notfId);
            await handleStatusUpdate(notfId, newNotification.status);
            fetchNotificationHistory();
          } else {
            console.warn("No notification ID found.");
          }
        } catch (error) {
          console.error("Error fetching notification ID:", error);
        }
      }
    });
  
    return () => {
      console.log("Stopping Tracker");
      tracker.stop();
    };
  }, []);

  // Dark mode persistence
  useEffect(() => {
    const darkModePreference = localStorage.getItem('darkMode') === 'true';
    setIsDarkMode(darkModePreference);
    if (darkModePreference) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);


  const getNotificationId = async () => {
    const notificationId = await Meteor.callAsync("notificationHistory.getLastIdByUser", Meteor.userId());
    return notificationId;
  };

  const handleStatusUpdate = async(id, newStatus) => {
    if (!id) {
      return;
    }

    await Meteor.call("notificationHistory.updateStatus", id, newStatus, (error, result) => {
      if (error) {
        console.error("Error updating status:", error);
      } else {
        console.log("Status updated successfully!");
      }
    });
  };

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('darkMode', newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    fetchNotificationHistory();
  }, [])

  const fetchNotificationHistory = async () => {
    const response = await Meteor.callAsync('notificationHistory.getByUser', Meteor.userId());
    setNotificationHistory(response)
  }

  // User profile data fetching
  useEffect(() => {
    let isMounted = true;

    const fetchUserDetails = async () => {
      if (!hasFetchedData && userProfile.email) {
        try {
          const result = await Meteor.callAsync('getUserDetails', userProfile.email);
          if (isMounted) {
            setProfile({
              firstName: result.firstName || '',
              lastName: result.lastName || '',
              email: result.email || '',
            });
            setHasFetchedData(true);
          }
        } catch (err) {
          console.error('Error fetching user details:', err);
        }
      }
    };

    fetchUserDetails();

    if (capturedDeviceInfo) {
      setDeviceInfo({
        model: capturedDeviceInfo.model || '',
        platform: capturedDeviceInfo.platform || '',
      });
    }

    return () => {
      isMounted = false;
    };
  }, [userProfile.email, hasFetchedData]);

  // Handle profile updates
  const handleProfileUpdate = async () => {
    if (!Meteor.userId()) {
      alert('Please login to perform this action');
      return;
    }

    setIsSaving(true);
    try {
      await Meteor.callAsync('updateUserProfile', {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email
      });
      setIsEditing(false);
      // Update session
      Session.set('userProfile', { ...userProfile, ...profile });
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    Meteor.logout((error) => {
      if (error) {
        console.error('Logout error:', error);
        alert('Failed to logout. Please try again.');
      } else {
        // Clear session data
        Session.clear();
        // Redirect to login page (assuming you're using React Router)
        window.location.href = '/login';
      }
    });
  };

  const [requests, setRequests] = useState([
    {
      id: 1,
      app: 'MyApp Dashboard',
      timestamp: '2025-01-03 14:30',
      location: 'San Francisco, CA',
      device: 'Chrome on MacOS',
      status: 'pending'
    },
    {
      id: 2,
      app: 'MyApp Admin',
      timestamp: '2025-01-03 14:25',
      location: 'San Francisco, CA',
      device: 'Firefox on Windows',
      status: 'approved'
    },
    {
      id: 3,
      app: 'MyApp Mobile',
      timestamp: '2025-01-03 14:20',
      location: 'New York, NY',
      device: 'Safari on iOS',
      status: 'rejected'
    }
  ]);

  const handleResponse = (id, response) => {
    if (!Meteor.userId()) {
      alert('Please login to perform this action');
      return;
    }

    Meteor.call('storeNotificationActivity', {
      notificationId: id,
      action: response,
      timestamp: new Date(),
      notificationData: requests.find(req => req.id === id),
      userId: Meteor.userId()
    }, (error) => {
      if (error) {
        console.error('Error storing notification activity:', error);
        alert('Failed to process request. Please try again.');
        return;
      }

      setRequests(requests.map(req =>
        req.id === id ? { ...req, status: response } : req
      ));

      // Update notification activities
      const newActivity = {
        _id: new Meteor.Collection.ObjectID()._str,
        userId: Meteor.userId(),
        notificationId: id,
        action: response,
        timestamp: new Date(),
        notificationData: requests.find(req => req.id === id)
      };
      setNotificationActivities([newActivity, ...notificationActivities]);
    });
  };

  const filteredRequests = requests.filter(req => {
    if (searchTerm && !req.app.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filter === 'pending') return req.status === 'pending';
    if (filter === 'approved') return req.status === 'approved';
    if (filter === 'rejected') return req.status === 'rejected';
    return true;
  });

  const newRequests = filteredRequests.filter(req => req.status === 'pending');
  const historyRequests = filteredRequests.filter(req => req.status !== 'pending');

  // Modified profile editing section in the JSX
  const renderProfileSection = () => (
    <div className="flex-1">
      {isEditing ? (
        <div className="space-y-2">
          <input
            type="text"
            value={profile.firstName}
            onChange={e => setProfile({ ...profile, firstName: e.target.value })}
            className="w-full px-2 py-1 rounded border dark:bg-gray-700 dark:border-gray-600"
            placeholder="First Name"
          />
          <input
            type="text"
            value={profile.lastName}
            onChange={e => setProfile({ ...profile, lastName: e.target.value })}
            className="w-full px-2 py-1 rounded border dark:bg-gray-700 dark:border-gray-600"
            placeholder="Last Name"
          />
          <div className="flex space-x-2 mt-2">
            <button
              onClick={handleProfileUpdate}
              disabled={isSaving}
              className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
              className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center justify-between">
          {`${profile.firstName} ${profile.lastName}`}
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          >
            <Edit className="h-4 w-4 text-gray-500" />
          </button>
        </h2>
      )}
      <p className="text-gray-600 dark:text-gray-300 flex items-center">
        <Mail className="h-4 w-4 mr-2" />
        {profile.email}
      </p>

    </div>
  );

  const sendUserAction = (appId, action) => {
    console.log(`Sending user action: ${action} for appId: ${appId}`);

    Meteor.call('notifications.handleResponse', appId, action, (error, result) => {
      if (error) {
        console.error('Error sending notification response:', error);
      } else {
        console.log('Server processed action:', result);
        setNotificationId(null)
        Session.set('notificationReceivedId', null);
      }
    });
  }

  const handleCloseResultModal = () => {
    setIsResultModalOpen(false)
  }

  const handleApprove = async() => {
    sendUserAction(notificationId, "approve")

    const notfId = await getNotificationId();
    await handleStatusUpdate(notfId, "approved");
    setIsResultModalOpen(true)
    setIsActionsModalOpen(false)
    fetchNotificationHistory();
  }

  const handleReject = async() => {
    sendUserAction(notificationId, "reject")
    const notfId = await getNotificationId();
    
    await handleStatusUpdate(notfId, "rejected");
    setIsActionsModalOpen(false)
    fetchNotificationHistory();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header section */}
      <header className="bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 shadow-lg sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">MieSecure</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleDarkMode}
                className="flex items-center justify-center p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                aria-label="Toggle Night Mode"
              >
                {isDarkMode ? (
                  <Sun className="h-6 w-6 text-yellow-400" />
                ) : (
                  <Moon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                )}
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 rounded-2xl shadow-lg p-6">
              <div className="flex items-center space-x-4 mb-6">
                <div className="h-16 w-16 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 flex items-center justify-center">
                  <User className="h-8 w-8 text-white" />
                </div>
                {renderProfileSection()}
              </div>

              {/* Rest of the profile card content remains the same */}
              <div className="space-y-4">
                <div className="border-t dark:border-gray-700 pt-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Device Information
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Model</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {deviceInfo.model || "iPhone 13 Pro"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Platform</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {deviceInfo.platform || "iOS 15.0"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="border-t dark:border-gray-700 pt-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Activity Summary
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Pending</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {requests.filter(r => r.status === 'pending').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Today's Activity</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {requests.filter(r => r.status !== 'pending').length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Authentication Requests */}
          <div className="lg:col-span-2 space-y-6">
            {/* Filters */}
            <div className="bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 rounded-2xl shadow-lg p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search requests..."
                      className="w-full pl-10 pr-4 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <select
                    className="bg-transparent border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
            </div>

            {/* New Notifications */}
            {newRequests.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <BellRing className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    New Notifications ({newRequests.length})
                  </h2>
                </div>
                {newRequests.map(request => (
                  <div
                    key={request.id}
                    className="bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 rounded-2xl shadow-lg p-6"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                          {request.app}
                        </h3>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
                            <Clock className="h-4 w-4 mr-2" />
                            {request.timestamp}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
                            <Smartphone className="h-4 w-4 mr-2" />
                            {request.device}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleResponse(request.id, 'approved')}
                          className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
                        >
                          <CheckCircle className="h-6 w-6" />
                        </button>
                        <button
                          onClick={() => handleResponse(request.id, 'rejected')}
                          className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        >
                          <XCircle className="h-6 w-6" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* History */}
            {historyRequests.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    History
                  </h2>
                </div>
                {[...notificationHistory].reverse().map(notification => (
                  <div
                    key={notification._id}
                    className="bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 rounded-2xl shadow-lg p-6"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                          {notification.title}
                        </h3>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
                            <Clock className="h-4 w-4 mr-2" />
                            {formatDateTime(notification.createdAt)}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
                            <Smartphone className="h-4 w-4 mr-2" />
                            Iphone 16
                          </p>
                        </div>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${notification.status === "approved"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : notification.status === "rejected"
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" // Corrected Pending Case
                          }`}
                      >
                        {notification.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <ActionsModal isOpen={isActionsModalOpen} onApprove={handleApprove} onReject={handleReject} />
      <ResultModal isOpen={isResultModalOpen} onClose={handleCloseResultModal} />
    </div>
  );
};