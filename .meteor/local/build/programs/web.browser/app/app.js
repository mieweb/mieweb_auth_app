var require = meteorInstall({"imports":{"ui":{"Modal":{"ActionsModal.jsx":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// imports/ui/Modal/ActionsModal.jsx                                                                                  //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!function (module1) {
  let React;
  module1.link("react", {
    default(v) {
      React = v;
    }
  }, 0);
  ___INIT_METEOR_FAST_REFRESH(module);
  const ActionsModal = _ref => {
    let {
      isOpen,
      onApprove,
      onReject,
      onClose
    } = _ref;
    if (!isOpen) return null;
    return /*#__PURE__*/React.createElement("div", {
      className: "fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    }, /*#__PURE__*/React.createElement("div", {
      className: "bg-white rounded-lg shadow-lg w-11/12 max-w-md"
    }, /*#__PURE__*/React.createElement("div", {
      className: "p-4 border-b"
    }, /*#__PURE__*/React.createElement("h2", {
      className: "text-lg font-bold text-center"
    }, "Authenticate?")), /*#__PURE__*/React.createElement("div", {
      className: "p-4 flex flex-col items-center space-y-4"
    }, /*#__PURE__*/React.createElement("button", {
      className: "w-full py-2 text-white bg-green-500 rounded-lg hover:bg-green-600",
      onClick: onApprove
    }, "Approve"), /*#__PURE__*/React.createElement("button", {
      className: "w-full py-2 text-white bg-red-500 rounded-lg hover:bg-red-600",
      onClick: onReject
    }, "Reject")), /*#__PURE__*/React.createElement("button", {
      className: "absolute top-2 right-2 text-gray-500 hover:text-gray-700",
      onClick: onClose
    }, "\u2715")));
  };
  _c = ActionsModal;
  module1.exportDefault(ActionsModal);
  var _c;
  $RefreshReg$(_c, "ActionsModal");
}.call(this, module);
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"ResultModal.jsx":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// imports/ui/Modal/ResultModal.jsx                                                                                   //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!function (module1) {
  let React, useEffect;
  module1.link("react", {
    default(v) {
      React = v;
    },
    useEffect(v) {
      useEffect = v;
    }
  }, 0);
  let CheckCircle;
  module1.link("lucide-react", {
    CheckCircle(v) {
      CheckCircle = v;
    }
  }, 1);
  ___INIT_METEOR_FAST_REFRESH(module);
  var _s = $RefreshSig$();
  const ResultModal = _ref => {
    let {
      isOpen,
      onClose
    } = _ref;
    _s();
    useEffect(() => {
      if (isOpen) {
        const timer = setTimeout(() => {
          onClose();
        }, 3000);
        return () => clearTimeout(timer);
      }
    }, [isOpen, onClose]);
    if (!isOpen) return null;
    return /*#__PURE__*/React.createElement("div", {
      className: "fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    }, /*#__PURE__*/React.createElement("div", {
      className: "bg-white rounded-lg shadow-lg w-11/12 max-w-md p-6 text-center"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex justify-center mb-4"
    }, /*#__PURE__*/React.createElement("div", {
      className: "w-16 h-16 flex items-center justify-center bg-green-100 rounded-full"
    }, /*#__PURE__*/React.createElement(CheckCircle, {
      className: "h-10 w-10 text-green-500"
    }))), /*#__PURE__*/React.createElement("h2", {
      className: "text-lg font-bold text-gray-800 mb-4"
    }, "You have been successfully authenticated."), /*#__PURE__*/React.createElement("button", {
      className: "w-full py-2 mt-4 text-white bg-blue-500 rounded-lg hover:bg-blue-600",
      onClick: onClose
    }, "Close")));
  };
  _s(ResultModal, "OD7bBpZva5O2jO+Puf00hKivP7c=");
  _c = ResultModal;
  module1.exportDefault(ResultModal);
  var _c;
  $RefreshReg$(_c, "ResultModal");
}.call(this, module);
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"Pagination":{"Pagination.jsx":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// imports/ui/Pagination/Pagination.jsx                                                                               //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!function (module1) {
  let React;
  module1.link("react", {
    default(v) {
      React = v;
    }
  }, 0);
  ___INIT_METEOR_FAST_REFRESH(module);
  const Pagination = _ref => {
    let {
      currentPage,
      totalPages,
      onPageChange
    } = _ref;
    if (totalPages <= 1) return null;
    const handlePrev = () => {
      if (currentPage > 1) onPageChange(currentPage - 1);
    };
    const handleNext = () => {
      if (currentPage < totalPages) onPageChange(currentPage + 1);
    };
    return /*#__PURE__*/React.createElement("div", {
      className: "flex justify-center items-center mt-4 w-full"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: handlePrev,
      disabled: currentPage === 1,
      className: "px-3 py-1 bg-gray-300 dark:bg-gray-600/80 dark:text-gray-400 rounded disabled:bg-gray-400"
    }, "Prev"), /*#__PURE__*/React.createElement("span", {
      className: "px-2 dark:text-gray-300"
    }, "Page ", currentPage, " of ", totalPages), /*#__PURE__*/React.createElement("button", {
      onClick: handleNext,
      disabled: currentPage === totalPages,
      className: "px-3 py-1 bg-gray-300 dark:bg-gray-600/80 dark:text-gray-400 rounded disabled:bg-gray-400"
    }, "Next"));
  };
  _c = Pagination;
  module1.exportDefault(Pagination);
  var _c;
  $RefreshReg$(_c, "Pagination");
}.call(this, module);
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"Toasters":{"SuccessToaster.jsx":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// imports/ui/Toasters/SuccessToaster.jsx                                                                             //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!function (module1) {
  let React, useEffect;
  module1.link("react", {
    default(v) {
      React = v;
    },
    useEffect(v) {
      useEffect = v;
    }
  }, 0);
  let motion, AnimatePresence;
  module1.link("framer-motion", {
    motion(v) {
      motion = v;
    },
    AnimatePresence(v) {
      AnimatePresence = v;
    }
  }, 1);
  ___INIT_METEOR_FAST_REFRESH(module);
  var _s = $RefreshSig$();
  const SuccessToaster = _ref => {
    let {
      message,
      onClose
    } = _ref;
    _s();
    useEffect(() => {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }, [onClose]);
    return /*#__PURE__*/React.createElement(AnimatePresence, null, message && /*#__PURE__*/React.createElement(motion.div, {
      initial: {
        x: "100%"
      },
      animate: {
        x: 0
      },
      exit: {
        x: "150%"
      },
      transition: {
        duration: 0.5,
        ease: "easeInOut"
      },
      className: "fixed top-5 right-5 bg-green-500 text-white px-4 py-2 rounded shadow-lg"
    }, message));
  };
  _s(SuccessToaster, "OD7bBpZva5O2jO+Puf00hKivP7c=");
  _c = SuccessToaster;
  module1.exportDefault(SuccessToaster);
  var _c;
  $RefreshReg$(_c, "SuccessToaster");
}.call(this, module);
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"App.jsx":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// imports/ui/App.jsx                                                                                                 //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!function (module1) {
  module1.export({
    App: () => App
  });
  let React, useEffect, useState;
  module1.link("react", {
    default(v) {
      React = v;
    },
    useEffect(v) {
      useEffect = v;
    },
    useState(v) {
      useState = v;
    }
  }, 0);
  let Router, Routes, Route, Navigate;
  module1.link("react-router-dom", {
    BrowserRouter(v) {
      Router = v;
    },
    Routes(v) {
      Routes = v;
    },
    Route(v) {
      Route = v;
    },
    Navigate(v) {
      Navigate = v;
    }
  }, 1);
  let Meteor;
  module1.link("meteor/meteor", {
    Meteor(v) {
      Meteor = v;
    }
  }, 2);
  let DeviceLogs;
  module1.link("../api/deviceLogs", {
    DeviceLogs(v) {
      DeviceLogs = v;
    }
  }, 3);
  let Session;
  module1.link("meteor/session", {
    Session(v) {
      Session = v;
    }
  }, 4);
  let Tracker;
  module1.link("meteor/tracker", {
    Tracker(v) {
      Tracker = v;
    }
  }, 5);
  let LoginPage;
  module1.link("./Login", {
    LoginPage(v) {
      LoginPage = v;
    }
  }, 6);
  let RegistrationPage;
  module1.link("./Registration", {
    RegistrationPage(v) {
      RegistrationPage = v;
    }
  }, 7);
  let WelcomePage;
  module1.link("./Welcome", {
    WelcomePage(v) {
      WelcomePage = v;
    }
  }, 8);
  let LandingPage;
  module1.link("./LandingPage", {
    LandingPage(v) {
      LandingPage = v;
    }
  }, 9);
  ___INIT_METEOR_FAST_REFRESH(module);
  var _s = $RefreshSig$();
  const App = () => {
    _s();
    const [capturedDeviceUuid, setCapturedDeviceUuid] = useState(null);
    const [boolRegisteredDevice, setBoolRegisteredDevice] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
      console.log('Initializing App component...');

      // Setup Tracker autorun for Session changes
      const sessionTracker = Tracker.autorun(() => {
        const deviceInfo = Session.get('capturedDeviceInfo');
        console.log('Session deviceInfo:', deviceInfo);
        if (!deviceInfo || !deviceInfo.uuid) {
          console.log('No valid device info in session');
          setCapturedDeviceUuid(null);
          setBoolRegisteredDevice(false);
          setIsLoading(false);
          return;
        }
        setCapturedDeviceUuid(deviceInfo.uuid);

        // Subscribe to deviceLogs
        const subscriber = Meteor.subscribe('deviceLogs.byDevice', deviceInfo.uuid, {
          onStop: error => {
            if (error) {
              console.error('Subscription error:', error);
            }
          },
          onReady: () => {
            console.log('Subscription is ready');
            // Query the collection
            const storedDeviceInfo = DeviceLogs.find({
              deviceUUID: deviceInfo.uuid
            }).fetch();
            console.log('Fetched Device Info:', JSON.stringify({
              storedDeviceInfo
            }));
            setBoolRegisteredDevice(storedDeviceInfo.length > 0);
            setIsLoading(false);
          }
        });

        // Cleanup function
        return () => {
          console.log('Cleaning up subscription...');
          if (subscriber) {
            subscriber.stop();
          }
        };
      });

      // Cleanup function for the effect
      return () => {
        console.log('Cleaning up session tracker...');
        sessionTracker.stop();
      };
    }, []); // Empty dependency array - only run on mount

    // Debug logging for state changes
    useEffect(() => {
      console.log('State updated:', {
        capturedDeviceUuid,
        boolRegisteredDevice,
        isLoading
      });
    }, [capturedDeviceUuid, boolRegisteredDevice, isLoading]);

    // Show loading spinner while checking registration
    if (isLoading) {
      return /*#__PURE__*/React.createElement("div", {
        className: "flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50"
      }, /*#__PURE__*/React.createElement("div", {
        className: "animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500"
      }), /*#__PURE__*/React.createElement("p", {
        className: "mt-4 text-lg font-semibold text-blue-600"
      }, "Checking device registration..."));
    }

    // Main routing logic
    return /*#__PURE__*/React.createElement("div", {
      className: "min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50"
    }, /*#__PURE__*/React.createElement(Router, null, /*#__PURE__*/React.createElement(Routes, null, /*#__PURE__*/React.createElement(Route, {
      path: "/",
      element: boolRegisteredDevice ? /*#__PURE__*/React.createElement(Navigate, {
        to: "/login",
        replace: true
      }) : /*#__PURE__*/React.createElement(Navigate, {
        to: "/register",
        replace: true
      })
    }), /*#__PURE__*/React.createElement(Route, {
      path: "/login",
      element: /*#__PURE__*/React.createElement(LoginPage, {
        deviceDetails: capturedDeviceUuid
      })
    }), /*#__PURE__*/React.createElement(Route, {
      path: "/register",
      element: /*#__PURE__*/React.createElement(RegistrationPage, {
        deviceDetails: capturedDeviceUuid
      })
    }), /*#__PURE__*/React.createElement(Route, {
      path: "/dashboard",
      element: /*#__PURE__*/React.createElement(LandingPage, {
        deviceDetails: capturedDeviceUuid
      })
    }), /*#__PURE__*/React.createElement(Route, {
      path: "/welcome",
      element: /*#__PURE__*/React.createElement(WelcomePage, {
        deviceDetails: capturedDeviceUuid
      })
    }))));
  };
  _s(App, "RbQzJ8kJ4BhIkaRRQCNz8/GWKDU=");
  _c = App;
  var _c;
  $RefreshReg$(_c, "App");
}.call(this, module);
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"LandingPage.jsx":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// imports/ui/LandingPage.jsx                                                                                         //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!function (module1) {
  let _objectSpread;
  module1.link("@babel/runtime/helpers/objectSpread2", {
    default(v) {
      _objectSpread = v;
    }
  }, 0);
  module1.export({
    LandingPage: () => LandingPage
  });
  let React, useState, useEffect;
  module1.link("react", {
    default(v) {
      React = v;
    },
    useState(v) {
      useState = v;
    },
    useEffect(v) {
      useEffect = v;
    }
  }, 0);
  let Shield, LogOut, User, Mail, CheckCircle, XCircle, Clock, Smartphone, Edit, Filter, Search, BellRing, Moon, Sun, RotateCcw;
  module1.link("lucide-react", {
    Shield(v) {
      Shield = v;
    },
    LogOut(v) {
      LogOut = v;
    },
    User(v) {
      User = v;
    },
    Mail(v) {
      Mail = v;
    },
    CheckCircle(v) {
      CheckCircle = v;
    },
    XCircle(v) {
      XCircle = v;
    },
    Clock(v) {
      Clock = v;
    },
    Smartphone(v) {
      Smartphone = v;
    },
    Edit(v) {
      Edit = v;
    },
    Filter(v) {
      Filter = v;
    },
    Search(v) {
      Search = v;
    },
    BellRing(v) {
      BellRing = v;
    },
    Moon(v) {
      Moon = v;
    },
    Sun(v) {
      Sun = v;
    },
    RotateCcw(v) {
      RotateCcw = v;
    }
  }, 1);
  let Session;
  module1.link("meteor/session", {
    Session(v) {
      Session = v;
    }
  }, 2);
  let Meteor;
  module1.link("meteor/meteor", {
    Meteor(v) {
      Meteor = v;
    }
  }, 3);
  let ActionsModal;
  module1.link("./Modal/ActionsModal", {
    default(v) {
      ActionsModal = v;
    }
  }, 4);
  let ResultModal;
  module1.link("./Modal/ResultModal", {
    default(v) {
      ResultModal = v;
    }
  }, 5);
  let Tracker;
  module1.link("meteor/tracker", {
    Tracker(v) {
      Tracker = v;
    }
  }, 6);
  let formatDateTime;
  module1.link("../../utils/utils", {
    formatDateTime(v) {
      formatDateTime = v;
    }
  }, 7);
  let SuccessToaster;
  module1.link("./Toasters/SuccessToaster", {
    default(v) {
      SuccessToaster = v;
    }
  }, 8);
  let Pagination;
  module1.link("./Pagination/Pagination", {
    default(v) {
      Pagination = v;
    }
  }, 9);
  let PAGE_SIZE;
  module1.link("../../utils/constants", {
    PAGE_SIZE(v) {
      PAGE_SIZE = v;
    }
  }, 10);
  ___INIT_METEOR_FAST_REFRESH(module);
  var _s = $RefreshSig$();
  const LandingPage = () => {
    _s();
    const userProfile = Session.get("userProfile") || {};
    const capturedDeviceInfo = Session.get("capturedDeviceInfo") || {};
    const [notificationHistory, setNotificationHistory] = useState([]);
    const [successMessage, setSuccessMessage] = useState("");
    const [profile, setProfile] = useState({
      firstName: "",
      lastName: "",
      email: userProfile.email || ""
    });
    const [isEditing, setIsEditing] = useState(false);
    const [filter, setFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [hasFetchedData, setHasFetchedData] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isActionsModalOpen, setIsActionsModalOpen] = useState(false);
    const [isResultModalOpen, setIsResultModalOpen] = useState(false);
    const [notificationId, setNotificationId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [deviceInfo, setDeviceInfo] = useState({
      model: capturedDeviceInfo.model || "",
      platform: capturedDeviceInfo.platform || ""
    });
    const [isDarkMode, setIsDarkMode] = useState(false);
    useEffect(() => {
      console.log("Initializing Tracker");
      const tracker = Tracker.autorun(async () => {
        const newNotification = Session.get("notificationReceivedId");
        console.log("Tracker detected change:", newNotification === null || newNotification === void 0 ? void 0 : newNotification.appId);
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
      const darkModePreference = localStorage.getItem("darkMode") === "true";
      setIsDarkMode(darkModePreference);
      if (darkModePreference) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }, []);
    const getNotificationId = async () => {
      const notificationId = await Meteor.callAsync("notificationHistory.getLastIdByUser", Meteor.userId());
      return notificationId;
    };
    const handleStatusUpdate = async (id, newStatus) => {
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
      localStorage.setItem("darkMode", newMode);
      if (newMode) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };
    useEffect(() => {
      fetchNotificationHistory();
    }, []);
    const fetchNotificationHistory = async () => {
      const response = await Meteor.callAsync("notificationHistory.getByUser", Meteor.userId());
      setNotificationHistory(response);
    };

    // User profile data fetching
    useEffect(() => {
      let isMounted = true;
      const fetchUserDetails = async () => {
        if (!hasFetchedData && userProfile.email) {
          try {
            const result = await Meteor.callAsync("getUserDetails", userProfile.email);
            if (isMounted) {
              setProfile({
                firstName: result.firstName || "",
                lastName: result.lastName || "",
                email: result.email || ""
              });
              setHasFetchedData(true);
            }
          } catch (err) {
            console.error("Error fetching user details:", err);
          }
        }
      };
      fetchUserDetails();
      if (capturedDeviceInfo) {
        setDeviceInfo({
          model: capturedDeviceInfo.model || "",
          platform: capturedDeviceInfo.platform || ""
        });
      }
      return () => {
        isMounted = false;
      };
    }, [userProfile.email, hasFetchedData]);

    // Handle profile updates
    const handleProfileUpdate = async () => {
      if (!Meteor.userId()) {
        alert("Please login to perform this action");
        return;
      }
      setIsSaving(true);
      try {
        await Meteor.callAsync("updateUserProfile", {
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email
        });
        setIsEditing(false);
        // Update session
        Session.set("userProfile", _objectSpread(_objectSpread({}, userProfile), profile));
        setSuccessMessage("Profile updated successfully!");
        setTimeout(() => setSuccessMessage(""), 3000);
      } catch (error) {
        console.error("Error updating profile:", error);
        alert("Failed to update profile. Please try again.");
      } finally {
        setIsSaving(false);
      }
    };

    // Handle logout
    const handleLogout = () => {
      Meteor.logout(error => {
        if (error) {
          console.error("Logout error:", error);
          alert("Failed to logout. Please try again.");
        } else {
          // Clear session data
          Session.clear();
          // Redirect to login page (assuming you're using React Router)
          window.location.href = "/login";
        }
      });
    };

    // Modified profile editing section in the JSX
    const renderProfileSection = () => /*#__PURE__*/React.createElement("div", {
      className: "flex-1"
    }, isEditing ? /*#__PURE__*/React.createElement("div", {
      className: "space-y-2"
    }, /*#__PURE__*/React.createElement("input", {
      type: "text",
      value: profile.firstName,
      onChange: e => setProfile(_objectSpread(_objectSpread({}, profile), {}, {
        firstName: e.target.value
      })),
      className: "w-full px-2 py-1 rounded border dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600",
      placeholder: "First Name"
    }), /*#__PURE__*/React.createElement("input", {
      type: "text",
      value: profile.lastName,
      onChange: e => setProfile(_objectSpread(_objectSpread({}, profile), {}, {
        lastName: e.target.value
      })),
      className: "w-full px-2 py-1 rounded border dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600",
      placeholder: "Last Name"
    }), /*#__PURE__*/React.createElement("div", {
      className: "flex space-x-2 mt-2"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: handleProfileUpdate,
      disabled: isSaving,
      className: "px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
    }, isSaving ? "Saving..." : "Save"), /*#__PURE__*/React.createElement("button", {
      onClick: () => setIsEditing(false),
      disabled: isSaving,
      className: "px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
    }, "Cancel"))) : /*#__PURE__*/React.createElement("h2", {
      className: "text-xl font-semibold text-gray-900 dark:text-white flex items-center justify-between"
    }, "".concat(profile.firstName, " ").concat(profile.lastName), /*#__PURE__*/React.createElement("button", {
      onClick: () => setIsEditing(true),
      className: "p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
    }, /*#__PURE__*/React.createElement(Edit, {
      className: "h-4 w-4 text-gray-500"
    }))), /*#__PURE__*/React.createElement("p", {
      className: "text-gray-600 dark:text-gray-300 flex items-center"
    }, /*#__PURE__*/React.createElement(Mail, {
      className: "h-4 w-4 mr-2"
    }), profile.email));
    const sendUserAction = (appId, action) => {
      console.log("Sending user action: ".concat(action, " for appId: ").concat(appId));
      Meteor.call("notifications.handleResponse", appId, action, (error, result) => {
        if (error) {
          console.error("Error sending notification response:", error);
        } else {
          console.log("Server processed action:", result);
          setNotificationId(null);
          Session.set("notificationReceivedId", null);
        }
      });
    };
    const handleCloseResultModal = () => {
      setIsResultModalOpen(false);
    };
    const handleCloseActionModal = () => {
      setIsActionsModalOpen(false);
    };
    const handleApprove = async () => {
      sendUserAction(notificationId, "approve");
      const notfId = await getNotificationId();
      await handleStatusUpdate(notfId, "approved");
      setIsResultModalOpen(true);
      setIsActionsModalOpen(false);
      fetchNotificationHistory();
    };
    const handleReject = async () => {
      sendUserAction(notificationId, "reject");
      const notfId = await getNotificationId();
      await handleStatusUpdate(notfId, "rejected");
      setIsActionsModalOpen(false);
      fetchNotificationHistory();
    };
    const filteredNotifications = notificationHistory.filter(notification => {
      var _notification$message, _notification$title;
      const matchesFilter = filter === "all" || notification.status === filter;
      const normalizedSearchTerm = searchTerm.toLowerCase().trim();
      const matchesSearch = normalizedSearchTerm === "" || ((_notification$message = notification.message) === null || _notification$message === void 0 ? void 0 : _notification$message.toLowerCase().includes(normalizedSearchTerm)) || ((_notification$title = notification.title) === null || _notification$title === void 0 ? void 0 : _notification$title.toLowerCase().includes(normalizedSearchTerm));
      return matchesFilter && matchesSearch;
    });
    const totalPages = Math.ceil((filteredNotifications === null || filteredNotifications === void 0 ? void 0 : filteredNotifications.length) / PAGE_SIZE);
    const paginatedNotifications = filteredNotifications.reverse().slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    console.log("paginatedNotifications:", paginatedNotifications);
    const handlePageChange = newPage => {
      setCurrentPage(newPage);
    };
    const today = new Date().toISOString().split("T")[0];
    const todayCount = filteredNotifications.filter(notification => {
      const createdAtDate = notification.createdAt instanceof Date ? notification.createdAt.toISOString().split("T")[0] : String(notification.createdAt).split("T")[0];
      return createdAtDate === today;
    }).length;
    return /*#__PURE__*/React.createElement("div", {
      className: "min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-gray-900 dark:to-gray-800"
    }, /*#__PURE__*/React.createElement("header", {
      className: "bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 shadow-lg sticky top-0 z-10"
    }, /*#__PURE__*/React.createElement("div", {
      className: "max-w-7xl mx-auto px-4 py-4"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex justify-between items-center"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-3"
    }, /*#__PURE__*/React.createElement(Shield, {
      className: "h-8 w-8 text-indigo-600 dark:text-indigo-400"
    }), /*#__PURE__*/React.createElement("h1", {
      className: "text-xl font-bold text-gray-900 dark:text-white"
    }, "MieSecure")), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-4"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: toggleDarkMode,
      className: "flex items-center justify-center p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition",
      "aria-label": "Toggle Night Mode"
    }, isDarkMode ? /*#__PURE__*/React.createElement(Sun, {
      className: "h-6 w-6 text-yellow-400"
    }) : /*#__PURE__*/React.createElement(Moon, {
      className: "h-6 w-6 text-gray-600 dark:text-gray-400"
    })), /*#__PURE__*/React.createElement("button", {
      onClick: handleLogout,
      className: "flex items-center space-x-2 px-4 py-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
    }, /*#__PURE__*/React.createElement(LogOut, {
      className: "h-4 w-4"
    }), /*#__PURE__*/React.createElement("span", null, "Logout")))))), /*#__PURE__*/React.createElement("main", {
      className: "max-w-7xl mx-auto px-4 py-6"
    }, /*#__PURE__*/React.createElement("div", {
      className: "grid grid-cols-1 lg:grid-cols-3 gap-6"
    }, /*#__PURE__*/React.createElement("div", {
      className: "lg:col-span-1"
    }, /*#__PURE__*/React.createElement("div", {
      className: "bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 rounded-2xl shadow-lg p-6"
    }, /*#__PURE__*/React.createElement(SuccessToaster, {
      message: successMessage,
      onClose: () => setSuccessMessage("")
    }), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-4 mb-6"
    }, /*#__PURE__*/React.createElement("div", {
      className: "h-16 w-16 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 flex items-center justify-center"
    }, /*#__PURE__*/React.createElement(User, {
      className: "h-8 w-8 text-white"
    })), renderProfileSection()), /*#__PURE__*/React.createElement("div", {
      className: "space-y-4"
    }, /*#__PURE__*/React.createElement("div", {
      className: "border-t dark:border-gray-700 pt-4"
    }, /*#__PURE__*/React.createElement("h3", {
      className: "text-sm font-medium text-gray-500 dark:text-gray-400 mb-2"
    }, "Device Information"), /*#__PURE__*/React.createElement("div", {
      className: "space-y-2"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-gray-600 dark:text-gray-300"
    }, "Model"), /*#__PURE__*/React.createElement("span", {
      className: "font-medium text-gray-900 dark:text-white"
    }, deviceInfo.model || "iPhone 13 Pro")), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-gray-600 dark:text-gray-300"
    }, "Platform"), /*#__PURE__*/React.createElement("span", {
      className: "font-medium text-gray-900 dark:text-white"
    }, deviceInfo.platform || "iOS 15.0")))), /*#__PURE__*/React.createElement("div", {
      className: "border-t dark:border-gray-700 pt-4"
    }, /*#__PURE__*/React.createElement("h3", {
      className: "text-sm font-medium text-gray-500 dark:text-gray-400 mb-2"
    }, "Activity Summary"), /*#__PURE__*/React.createElement("div", {
      className: "space-y-2"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between dark:text-gray-300"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-gray-600 dark:text-gray-300"
    }, "Today's Activity"), todayCount)))))), /*#__PURE__*/React.createElement("div", {
      className: "lg:col-span-2 space-y-6"
    }, filteredNotifications.length > 0 ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 rounded-2xl shadow-lg p-4"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex flex-wrap gap-4"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex-1"
    }, /*#__PURE__*/React.createElement("div", {
      className: "relative"
    }, /*#__PURE__*/React.createElement(Search, {
      className: "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"
    }), /*#__PURE__*/React.createElement("input", {
      type: "text",
      placeholder: "Search requests...",
      className: "w-full pl-10 pr-4 py-2 text-gray-400 rounded-lg border dark:bg-gray-700 dark:border-gray-600",
      value: searchTerm,
      onChange: e => setSearchTerm(e.target.value)
    }))), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-2"
    }, /*#__PURE__*/React.createElement(Filter, {
      className: "h-4 w-4 text-gray-500"
    }), /*#__PURE__*/React.createElement("select", {
      className: "bg-transparent text-gray-400 border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600",
      value: filter,
      onChange: e => setFilter(e.target.value)
    }, /*#__PURE__*/React.createElement("option", {
      value: "all"
    }, "All"), /*#__PURE__*/React.createElement("option", {
      value: "pending"
    }, "Pending"), /*#__PURE__*/React.createElement("option", {
      value: "approved"
    }, "Approved"), /*#__PURE__*/React.createElement("option", {
      value: "rejected"
    }, "Rejected"))))), /*#__PURE__*/React.createElement("div", {
      className: "space-y-4"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-2"
    }, /*#__PURE__*/React.createElement(Clock, {
      className: "h-5 w-5 text-indigo-600 dark:text-indigo-400"
    }), /*#__PURE__*/React.createElement("h2", {
      className: "text-lg font-semibold text-gray-900 dark:text-white"
    }, "History")), paginatedNotifications.map(notification => /*#__PURE__*/React.createElement("div", {
      key: notification._id,
      className: "bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 rounded-2xl shadow-lg p-6"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex justify-between items-start mb-4"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
      className: "text-lg font-semibold text-gray-900 dark:text-white mb-1"
    }, notification.title), /*#__PURE__*/React.createElement("div", {
      className: "space-y-1"
    }, /*#__PURE__*/React.createElement("p", {
      className: "text-sm text-gray-600 dark:text-gray-300 flex items-center"
    }, /*#__PURE__*/React.createElement(Clock, {
      className: "h-4 w-4 mr-2"
    }), formatDateTime(notification.createdAt)), /*#__PURE__*/React.createElement("p", {
      className: "text-sm text-gray-600 dark:text-gray-300 flex items-center"
    }, /*#__PURE__*/React.createElement(Smartphone, {
      className: "h-4 w-4 mr-2"
    }), "Iphone 16"))), /*#__PURE__*/React.createElement("div", {
      className: "px-3 py-1 rounded-full text-sm font-medium capitalize ".concat(notification.status === "approved" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : notification.status === "rejected" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200")
    }, notification.status)))), /*#__PURE__*/React.createElement(Pagination, {
      currentPage: currentPage,
      totalPages: totalPages,
      onPageChange: handlePageChange
    }))) : /*#__PURE__*/React.createElement("div", {
      className: "bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 rounded-2xl shadow-lg p-6 min-h-[100px] flex items-center justify-center text-center flex-col"
    }, /*#__PURE__*/React.createElement(RotateCcw, {
      className: "h-10 w-10 mt-4 text-gray-600"
    }), /*#__PURE__*/React.createElement("p", null, "No Notification History."))))), /*#__PURE__*/React.createElement(ActionsModal, {
      isOpen: isActionsModalOpen,
      onApprove: handleApprove,
      onReject: handleReject,
      onClose: handleCloseActionModal
    }), /*#__PURE__*/React.createElement(ResultModal, {
      isOpen: isResultModalOpen,
      onClose: handleCloseResultModal
    }));
  };
  _s(LandingPage, "CZLYOWEuYi2XYp/A8E+aHWeKMNY=");
  _c = LandingPage;
  var _c;
  $RefreshReg$(_c, "LandingPage");
}.call(this, module);
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"Login.jsx":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// imports/ui/Login.jsx                                                                                               //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!function (module1) {
  module1.export({
    LoginPage: () => LoginPage
  });
  let React, useState, useEffect;
  module1.link("react", {
    default(v) {
      React = v;
    },
    useState(v) {
      useState = v;
    },
    useEffect(v) {
      useEffect = v;
    }
  }, 0);
  let useNavigate;
  module1.link("react-router-dom", {
    useNavigate(v) {
      useNavigate = v;
    }
  }, 1);
  let FiMail, FiLock;
  module1.link("react-icons/fi", {
    FiMail(v) {
      FiMail = v;
    },
    FiLock(v) {
      FiLock = v;
    }
  }, 2);
  let Meteor;
  module1.link("meteor/meteor", {
    Meteor(v) {
      Meteor = v;
    }
  }, 3);
  let Session;
  module1.link("meteor/session", {
    Session(v) {
      Session = v;
    }
  }, 4);
  ___INIT_METEOR_FAST_REFRESH(module);
  var _s = $RefreshSig$();
  const LoginPage = _ref => {
    let {
      deviceDetails
    } = _ref;
    _s();
    const [email, setEmail] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const navigate = useNavigate();
    useEffect(() => {
      // Check for device details on component mount
      if (!deviceDetails) {
        console.warn('No device details available');
      }

      // Check for Meteor connection
      const connectionCheck = setInterval(() => {
        if (!Meteor.status().connected) {
          setError('Connection to server lost. Attempting to reconnect...');
        } else if (error.includes('Connection to server lost')) {
          setError('');
        }
      }, 3000);
      return () => clearInterval(connectionCheck);
    }, [deviceDetails, error]);
    const handleLogin = async e => {
      e.preventDefault();

      // Validate device details
      if (!deviceDetails) {
        setError('Device information not available. Please refresh the page.');
        return;
      }

      // Validate connection
      if (!Meteor.status().connected) {
        setError('Unable to connect to server. Please check your connection.');
        return;
      }
      setIsLoggingIn(true);
      setError('');
      try {
        await new Promise((resolve, reject) => {
          Meteor.loginWithPassword(email, pin, err => {
            if (err) {
              console.error('Login Error:', err);
              reject(err);
            } else {
              resolve();
            }
          });
        });
        Session.set('userProfile', {
          email: email
        });
        navigate('/dashboard');
      } catch (err) {
        setError(err.reason || 'Login failed. Please try again.');
      } finally {
        setIsLoggingIn(false);
      }
    };
    return /*#__PURE__*/React.createElement("div", {
      className: "min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50"
    }, /*#__PURE__*/React.createElement("div", {
      className: "max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-lg"
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-center"
    }, /*#__PURE__*/React.createElement("h2", {
      className: "text-3xl font-bold text-gray-900"
    }, "Welcome Back"), /*#__PURE__*/React.createElement("p", {
      className: "mt-2 text-gray-600"
    }, "Sign in to your account")), /*#__PURE__*/React.createElement("form", {
      onSubmit: handleLogin,
      className: "space-y-6"
    }, error && /*#__PURE__*/React.createElement("div", {
      className: "text-red-600 text-sm text-center bg-red-100 p-3 rounded-lg"
    }, error), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
      htmlFor: "email",
      className: "block text-sm font-medium text-gray-700"
    }, "Email"), /*#__PURE__*/React.createElement("div", {
      className: "mt-1 relative"
    }, /*#__PURE__*/React.createElement(FiMail, {
      className: "absolute top-3 left-3 text-gray-400"
    }), /*#__PURE__*/React.createElement("input", {
      id: "email",
      type: "email",
      required: true,
      value: email,
      onChange: e => setEmail(e.target.value),
      className: "w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
      placeholder: "Enter your email",
      autoComplete: "email"
    }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
      htmlFor: "pin",
      className: "block text-sm font-medium text-gray-700"
    }, "PIN"), /*#__PURE__*/React.createElement("div", {
      className: "mt-1 relative"
    }, /*#__PURE__*/React.createElement(FiLock, {
      className: "absolute top-3 left-3 text-gray-400"
    }), /*#__PURE__*/React.createElement("input", {
      id: "pin",
      type: "password",
      required: true,
      value: pin,
      onChange: e => setPin(e.target.value),
      className: "w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
      placeholder: "Enter your PIN",
      maxLength: 6,
      minLength: 4,
      pattern: "[0-9]*",
      inputMode: "numeric",
      autoComplete: "current-password"
    }))), /*#__PURE__*/React.createElement("button", {
      type: "submit",
      disabled: isLoggingIn,
      className: "w-full py-3 px-4 rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ease-in-out transform hover:scale-[1.02]"
    }, isLoggingIn ? /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-center"
    }, /*#__PURE__*/React.createElement("svg", {
      className: "animate-spin -ml-1 mr-3 h-5 w-5 text-white",
      xmlns: "http://www.w3.org/2000/svg",
      fill: "none",
      viewBox: "0 0 24 24"
    }, /*#__PURE__*/React.createElement("circle", {
      className: "opacity-25",
      cx: "12",
      cy: "12",
      r: "10",
      stroke: "currentColor",
      strokeWidth: "4"
    }), /*#__PURE__*/React.createElement("path", {
      className: "opacity-75",
      fill: "currentColor",
      d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    })), "Signing In...") : 'Sign In'))));
  };
  _s(LoginPage, "MtfjbUFJrqs2dfV48S4oXboFhcY=", false, function () {
    return [useNavigate];
  });
  _c = LoginPage;
  var _c;
  $RefreshReg$(_c, "LoginPage");
}.call(this, module);
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"Registration.jsx":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// imports/ui/Registration.jsx                                                                                        //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!function (module1) {
  let _extends;
  module1.link("@babel/runtime/helpers/extends", {
    default(v) {
      _extends = v;
    }
  }, 0);
  let _objectSpread;
  module1.link("@babel/runtime/helpers/objectSpread2", {
    default(v) {
      _objectSpread = v;
    }
  }, 1);
  module1.export({
    RegistrationPage: () => RegistrationPage
  });
  let React, useState;
  module1.link("react", {
    default(v) {
      React = v;
    },
    useState(v) {
      useState = v;
    }
  }, 0);
  let useNavigate;
  module1.link("react-router-dom", {
    useNavigate(v) {
      useNavigate = v;
    }
  }, 1);
  let FiUser, FiMail, FiLock;
  module1.link("react-icons/fi", {
    FiUser(v) {
      FiUser = v;
    },
    FiMail(v) {
      FiMail = v;
    },
    FiLock(v) {
      FiLock = v;
    }
  }, 2);
  let motion;
  module1.link("framer-motion", {
    motion(v) {
      motion = v;
    }
  }, 3);
  let Meteor;
  module1.link("meteor/meteor", {
    Meteor(v) {
      Meteor = v;
    }
  }, 4);
  let Session;
  module1.link("meteor/session", {
    Session(v) {
      Session = v;
    }
  }, 5);
  ___INIT_METEOR_FAST_REFRESH(module);
  var _s = $RefreshSig$();
  const RegistrationPage = _ref => {
    let {
      deviceDetails
    } = _ref;
    _s();
    const [formData, setFormData] = useState({
      email: '',
      firstName: '',
      lastName: '',
      pin: ''
    });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const handleSubmit = async e => {
      e.preventDefault();
      if (!deviceDetails) {
        alert('Device information not available');
        return;
      }
      setLoading(true);
      const sessionDeviceInfo = Session.get('capturedDeviceInfo');
      const fcmDeviceToken = Session.get('deviceToken'); // Get FCM token from session

      if (sessionDeviceInfo.uuid === deviceDetails) {
        try {
          // First register the user with deviceInfo
          await new Promise((resolve, reject) => {
            Meteor.call('users.register', _objectSpread(_objectSpread({}, formData), {}, {
              sessionDeviceInfo,
              fcmDeviceToken
            }), (err, result) => {
              if (err) {
                console.error("Registration error:", err);
                reject(err);
              } else {
                console.log("Registration success:", result);
                resolve(result);
              }
            });
          });

          // Navigate to login after successful registration
          navigate('/login');
        } catch (err) {
          console.error('Registration failed:', err);
          alert(err.reason || 'Registration failed. Please try again.');
        } finally {
          setLoading(false);
        }
      } else {
        alert('Registration failed. Device uuid is not matched or tampered.');
        setLoading(false);
      }
    };
    const inputFields = [{
      name: 'email',
      icon: FiMail,
      type: 'email',
      placeholder: 'Enter your email'
    }, {
      name: 'firstName',
      icon: FiUser,
      type: 'text',
      placeholder: 'First Name'
    }, {
      name: 'lastName',
      icon: FiUser,
      type: 'text',
      placeholder: 'Last Name'
    }, {
      name: 'pin',
      icon: FiLock,
      type: 'password',
      placeholder: 'Create a PIN (4-6 digits)',
      minLength: "4",
      maxLength: "6",
      pattern: "\\d*"
    }];
    return /*#__PURE__*/React.createElement(motion.div, {
      initial: {
        opacity: 0
      },
      animate: {
        opacity: 1
      },
      className: "min-h-screen flex flex-col items-center justify-center p-4"
    }, /*#__PURE__*/React.createElement(motion.div, {
      initial: {
        y: 20,
        opacity: 0
      },
      animate: {
        y: 0,
        opacity: 1
      },
      transition: {
        delay: 0.2
      },
      className: "max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-lg"
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-center space-y-2"
    }, /*#__PURE__*/React.createElement(motion.h2, {
      initial: {
        y: -20
      },
      animate: {
        y: 0
      },
      className: "text-3xl font-bold text-gray-900"
    }, "Create Account"), /*#__PURE__*/React.createElement("p", {
      className: "text-gray-600"
    }, "Join our community today")), /*#__PURE__*/React.createElement("form", {
      onSubmit: handleSubmit,
      className: "space-y-6"
    }, /*#__PURE__*/React.createElement("div", {
      className: "grid grid-cols-1 md:grid-cols-2 gap-4"
    }, inputFields.map((field, index) => /*#__PURE__*/React.createElement(motion.div, {
      key: field.name,
      initial: {
        x: -20,
        opacity: 0
      },
      animate: {
        x: 0,
        opacity: 1
      },
      transition: {
        delay: index * 0.1
      },
      className: field.name === 'email' ? 'md:col-span-2' : ''
    }, /*#__PURE__*/React.createElement("label", {
      className: "text-sm font-medium text-gray-700"
    }, field.name.charAt(0).toUpperCase() + field.name.slice(1)), /*#__PURE__*/React.createElement("div", {
      className: "mt-1 relative"
    }, /*#__PURE__*/React.createElement(field.icon, {
      className: "absolute top-3 left-3 text-gray-400"
    }), /*#__PURE__*/React.createElement("input", _extends({}, field, {
      required: true,
      value: formData[field.name],
      onChange: e => setFormData(prev => _objectSpread(_objectSpread({}, prev), {}, {
        [e.target.name]: e.target.value
      })),
      className: "w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500"
    })))))), /*#__PURE__*/React.createElement(motion.button, {
      whileHover: {
        scale: 1.02
      },
      whileTap: {
        scale: 0.98
      },
      type: "submit",
      disabled: loading,
      className: "w-full py-3 px-4 rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-colors"
    }, loading ? 'Creating Account...' : 'Create Account'))));
  };
  _s(RegistrationPage, "fH7r+AjIZkvWjag6Zube6/X3748=", false, function () {
    return [useNavigate];
  });
  _c = RegistrationPage;
  var _c;
  $RefreshReg$(_c, "RegistrationPage");
}.call(this, module);
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"Welcome.jsx":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// imports/ui/Welcome.jsx                                                                                             //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!function (module1) {
  module1.export({
    WelcomePage: () => WelcomePage
  });
  let React;
  module1.link("react", {
    default(v) {
      React = v;
    }
  }, 0);
  let useNavigate;
  module1.link("react-router-dom", {
    useNavigate(v) {
      useNavigate = v;
    }
  }, 1);
  let FiLogIn, FiUserPlus;
  module1.link("react-icons/fi", {
    FiLogIn(v) {
      FiLogIn = v;
    },
    FiUserPlus(v) {
      FiUserPlus = v;
    }
  }, 2);
  ___INIT_METEOR_FAST_REFRESH(module);
  var _s = $RefreshSig$();
  const WelcomePage = () => {
    _s();
    const navigate = useNavigate();
    return /*#__PURE__*/React.createElement("div", {
      className: "min-h-screen flex items-center justify-center p-4"
    }, /*#__PURE__*/React.createElement("div", {
      className: "max-w-md w-full space-y-8"
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-center"
    }, /*#__PURE__*/React.createElement("h1", {
      className: "text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600"
    }, "MieSecure"), /*#__PURE__*/React.createElement("p", {
      className: "mt-4 text-gray-600"
    }, "Your secure mobile companion")), /*#__PURE__*/React.createElement("div", {
      className: "mt-12 space-y-4"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => navigate('/login'),
      className: "group relative w-full flex justify-center items-center px-4 py-3 border border-transparent text-lg font-medium rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform transition hover:scale-105"
    }, /*#__PURE__*/React.createElement(FiLogIn, {
      className: "mr-2"
    }), " Sign In"), /*#__PURE__*/React.createElement("button", {
      onClick: () => navigate('/register'),
      className: "group relative w-full flex justify-center items-center px-4 py-3 border-2 border-blue-600 text-lg font-medium rounded-xl text-blue-600 bg-transparent hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform transition hover:scale-105"
    }, /*#__PURE__*/React.createElement(FiUserPlus, {
      className: "mr-2"
    }), " Create Account"))));
  };
  _s(WelcomePage, "CzcTeTziyjMsSrAVmHuCCb6+Bfg=", false, function () {
    return [useNavigate];
  });
  _c = WelcomePage;
  var _c;
  $RefreshReg$(_c, "WelcomePage");
}.call(this, module);
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"api":{"deviceLogs.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// imports/api/deviceLogs.js                                                                                          //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!function (module1) {
  module1.export({
    DeviceLogs: () => DeviceLogs
  });
  let Mongo;
  module1.link("meteor/mongo", {
    Mongo(v) {
      Mongo = v;
    }
  }, 0);
  let check;
  module1.link("meteor/check", {
    check(v) {
      check = v;
    }
  }, 1);
  let SHA256;
  module1.link("meteor/sha", {
    SHA256(v) {
      SHA256 = v;
    }
  }, 2);
  ___INIT_METEOR_FAST_REFRESH(module);
  const DeviceLogs = new Mongo.Collection('deviceLogs');
  // Add generateAppId utility function
  const generateAppId = (deviceUUID, email, creationTime) => {
    const combinedString = "".concat(deviceUUID, ":").concat(email, ":").concat(creationTime);
    return SHA256(combinedString).substring(0, 32);
  };

  // Create indexes for better query performance
  if (Meteor.isServer) {
    Meteor.startup(() => {
      DeviceLogs.createIndex({
        userId: 1
      });
      DeviceLogs.createIndex({
        deviceUUID: 1
      });
      DeviceLogs.createIndex({
        email: 1
      });
      DeviceLogs.createIndex({
        appId: 1
      });
    });
  }

  // Define methods for DeviceLogs
  Meteor.methods({
    'deviceLogs.upsert': async function (data) {
      check(data, {
        userId: String,
        email: String,
        deviceUUID: String,
        fcmToken: String,
        deviceInfo: Object
      });
      const creationTime = new Date().toISOString();
      const appId = generateAppId(data.deviceUUID, data.email, creationTime);
      console.log('Generated appId during upsert:', appId); // Add this log

      return DeviceLogs.upsertAsync({
        userId: data.userId,
        deviceUUID: data.deviceUUID
      }, {
        $set: {
          email: data.email,
          fcmToken: data.fcmToken,
          appId: appId,
          lastUpdated: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      });
    },
    'deviceLogs.updateToken'(userId, deviceUUID, fcmToken) {
      check(userId, String);
      check(deviceUUID, String);
      check(fcmToken, String);
      return DeviceLogs.updateAsync({
        userId: userId,
        deviceUUID: deviceUUID
      }, {
        $set: {
          fcmToken: fcmToken,
          lastUpdated: new Date()
        }
      });
    },
    'deviceLogs.getFCMTokenByAppId': async function (appId) {
      check(appId, String);
      const deviceLog = await DeviceLogs.findOneAsync({
        appId: appId
      });
      if (!deviceLog) {
        throw new Meteor.Error('invalid-app-id', 'No device found with this App ID');
      }
      return deviceLog.fcmToken;
    },
    'deviceLogs.getFCMTokenByDeviceId': async function (deviceUUID) {
      check(deviceUUID, String);
      const deviceLog = await DeviceLogs.findOneAsync({
        deviceUUID: deviceUUID
      });
      if (!deviceLog) {
        throw new Meteor.Error('invalid-app-id', 'No device found with this Device ID');
      }
      return deviceLog.fcmToken;
    },
    // Also fix the debug method
    'deviceLogs.getByAppId': async function (appId) {
      check(appId, String);
      const result = await DeviceLogs.findOneAsync({
        appId
      });
      console.log('Looking for appId:', appId);
      console.log('Found device log:', result);
      return result;
    }
  });

  // Publish device logs
  if (Meteor.isServer) {
    Meteor.publish('deviceLogs.byUser', function (userId) {
      check(userId, String);
      return DeviceLogs.find({
        userId: userId
      });
    });
    Meteor.publish('deviceLogs.byDevice', function (deviceUUID) {
      check(deviceUUID, String);
      return DeviceLogs.find({
        deviceUUID: deviceUUID
      });
    });
  }
}.call(this, module);
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"utils":{"constants.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// utils/constants.js                                                                                                 //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!function (module1) {
  module1.export({
    PAGE_SIZE: () => PAGE_SIZE
  });
  ___INIT_METEOR_FAST_REFRESH(module);
  const PAGE_SIZE = 5;
}.call(this, module);
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"utils.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// utils/utils.js                                                                                                     //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!function (module1) {
  module1.export({
    formatDateTime: () => formatDateTime
  });
  ___INIT_METEOR_FAST_REFRESH(module);
  const formatDateTime = isoString => {
    if (!isoString) return "";
    const date = new Date(isoString);

    // Extracting date in YYYY-MM-DD format
    const formattedDate = date.toISOString().split("T")[0];

    // Extracting time in HH:MM format
    const formattedTime = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
    return "".concat(formattedDate, " ").concat(formattedTime);
  };
}.call(this, module);
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"client":{"main.css":function module(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// client/main.css                                                                                                    //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
// These styles have already been applied to the document.

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"main.jsx":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// client/main.jsx                                                                                                    //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!function (module1) {
  let React, useEffect;
  module1.link("react", {
    default(v) {
      React = v;
    },
    useEffect(v) {
      useEffect = v;
    }
  }, 0);
  let createRoot;
  module1.link("react-dom/client", {
    createRoot(v) {
      createRoot = v;
    }
  }, 1);
  let Meteor;
  module1.link("meteor/meteor", {
    Meteor(v) {
      Meteor = v;
    }
  }, 2);
  module1.link("./main.css");
  module1.link("../imports/api/deviceLogs");
  let App;
  module1.link("../imports/ui/App", {
    App(v) {
      App = v;
    }
  }, 3);
  let Session;
  module1.link("meteor/session", {
    Session(v) {
      Session = v;
    }
  }, 4);
  ___INIT_METEOR_FAST_REFRESH(module);
  const sendUserAction = (appId, action) => {
    console.log("Sending user action: ".concat(action, " for appId: ").concat(appId));
    Meteor.call('notifications.handleResponse', appId, action, (error, result) => {
      if (error) {
        console.error('Error sending notification response:', error);
      } else {
        console.log('Server processed action:', result);
      }
    });
  };
  Meteor.startup(() => {
    const container = document.getElementById('react-target');
    const root = createRoot(container);
    if (Meteor.isCordova) {
      if (device.cordova) {
        Session.set('capturedDeviceInfo', {
          model: device.model,
          platform: device.platform,
          uuid: device.uuid,
          version: device.version,
          manufacturer: device.manufacturer
        });
      }
    }
    if (Meteor.isCordova) {
      document.addEventListener('deviceready', () => {
        console.log("Cordova device is ready");

        // Create notification channel
        PushNotification.createChannel(() => {
          console.log('Channel created successfully');
        }, () => {
          console.error('Channel creation failed');
        }, {
          id: 'default',
          description: 'Default channel',
          importance: 4,
          vibration: true,
          sound: 'default'
        });
        const push = PushNotification.init({
          android: {
            forceShow: true,
            clearNotifications: false,
            icon: "ic_launcher",
            iconColor: "#4CAF50",
            actions: [{
              id: 'approve',
              title: 'Approve'
            }, {
              id: 'reject',
              title: 'Reject'
            }],
            priority: "high",
            sound: true,
            vibrate: true,
            channel: {
              id: "default",
              importance: "high",
              sound: "default",
              vibration: true
            }
          },
          ios: {
            alert: true,
            badge: true,
            sound: true,
            priority: "high",
            foreground: true
          }
        });
        try {
          // Handle registration
          push.on('registration', data => {
            console.log("Registration handler attached");
            console.log('Registration data:', data);
            Session.set('deviceToken', data.registrationId);
          });
          push.on('notification', notification => {
            console.log('Notification received:', notification);

            // Handle cold start (app launched from notification)
            if (notification.additionalData.coldstart) {
              // Process action from cold start here
              const action = notification.additionalData.action;
              if (action) {
                sendUserAction(notification.additionalData.appId, action);
              }
            }

            // Handle foreground/background processing
            if (notification.additionalData.appId) {
              Session.set('notificationReceivedId', {
                appId: notification.additionalData.appId,
                status: "pending"
              });
            }
          });
          push.on('reject', notification => {
            if (notification.additionalData) {
              const {
                appId
              } = notification.additionalData;
              if (Session.get("userProfile")) {
                sendUserAction(appId, 'reject');
                Session.set('notificationReceivedId', {
                  appId,
                  status: "rejected"
                });
              } else {
                Session.set('notificationReceivedId', {
                  appId,
                  status: "pending"
                });
              }
            }
          });
          push.on('approve', notification => {
            if (notification.additionalData) {
              const {
                appId
              } = notification.additionalData;
              if (Session.get("userProfile")) {
                sendUserAction(appId, 'approve');
                Session.set('notificationReceivedId', {
                  appId,
                  status: "approved"
                });
              } else {
                Session.set('notificationReceivedId', {
                  appId,
                  status: "pending"
                });
              }
            }
          });

          // Handle errors
          push.on('error', error => {
            console.log("Error handler attached");
            console.error('Push notification error:', error);
          });
          console.log("All handlers attached successfully");
        } catch (error) {
          console.error("Error attaching push notification handlers:", error);
        }
      }, false);
    }
    root.render(/*#__PURE__*/React.createElement(App, null));
  });
}.call(this, module);
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},{
  "extensions": [
    ".js",
    ".json",
    ".html",
    ".ts",
    ".css",
    ".mjs",
    ".jsx"
  ]
});

require("/client/main.jsx");