var require = meteorInstall({"imports":{"ui":{"Modal":{"ActionsModal.jsx":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/ui/Modal/ActionsModal.jsx                                                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!function (module1) {
  var React;
  module1.link("react", {
    "default": function (v) {
      React = v;
    }
  }, 0);
  ___INIT_METEOR_FAST_REFRESH(module);
  var ActionsModal = function (_ref) {
    var isOpen = _ref.isOpen,
      onApprove = _ref.onApprove,
      onReject = _ref.onReject,
      onClose = _ref.onClose;
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"ResultModal.jsx":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/ui/Modal/ResultModal.jsx                                                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!function (module1) {
  var React, useEffect;
  module1.link("react", {
    "default": function (v) {
      React = v;
    },
    useEffect: function (v) {
      useEffect = v;
    }
  }, 0);
  var CheckCircle;
  module1.link("lucide-react", {
    CheckCircle: function (v) {
      CheckCircle = v;
    }
  }, 1);
  ___INIT_METEOR_FAST_REFRESH(module);
  var _s = $RefreshSig$();
  var ResultModal = function (_ref) {
    var isOpen = _ref.isOpen,
      onClose = _ref.onClose;
    _s();
    useEffect(function () {
      if (isOpen) {
        var timer = setTimeout(function () {
          onClose();
        }, 3000);
        return function () {
          return clearTimeout(timer);
        };
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"Pagination":{"Pagination.jsx":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/ui/Pagination/Pagination.jsx                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!function (module1) {
  var React;
  module1.link("react", {
    "default": function (v) {
      React = v;
    }
  }, 0);
  ___INIT_METEOR_FAST_REFRESH(module);
  var Pagination = function (_ref) {
    var currentPage = _ref.currentPage,
      totalPages = _ref.totalPages,
      onPageChange = _ref.onPageChange;
    if (totalPages <= 1) return null;
    var handlePrev = function () {
      if (currentPage > 1) onPageChange(currentPage - 1);
    };
    var handleNext = function () {
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"Toasters":{"SuccessToaster.jsx":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/ui/Toasters/SuccessToaster.jsx                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!function (module1) {
  var React, useEffect;
  module1.link("react", {
    "default": function (v) {
      React = v;
    },
    useEffect: function (v) {
      useEffect = v;
    }
  }, 0);
  var motion, AnimatePresence;
  module1.link("framer-motion", {
    motion: function (v) {
      motion = v;
    },
    AnimatePresence: function (v) {
      AnimatePresence = v;
    }
  }, 1);
  ___INIT_METEOR_FAST_REFRESH(module);
  var _s = $RefreshSig$();
  var SuccessToaster = function (_ref) {
    var message = _ref.message,
      onClose = _ref.onClose;
    _s();
    useEffect(function () {
      var timer = setTimeout(function () {
        onClose();
      }, 3000);
      return function () {
        return clearTimeout(timer);
      };
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"App.jsx":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/ui/App.jsx                                                                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!function (module1) {
  var _slicedToArray;
  module1.link("@babel/runtime/helpers/slicedToArray", {
    default: function (v) {
      _slicedToArray = v;
    }
  }, 0);
  module1.export({
    App: function () {
      return App;
    }
  });
  var React, useEffect, useState;
  module1.link("react", {
    "default": function (v) {
      React = v;
    },
    useEffect: function (v) {
      useEffect = v;
    },
    useState: function (v) {
      useState = v;
    }
  }, 0);
  var Router, Routes, Route, Navigate;
  module1.link("react-router-dom", {
    BrowserRouter: function (v) {
      Router = v;
    },
    Routes: function (v) {
      Routes = v;
    },
    Route: function (v) {
      Route = v;
    },
    Navigate: function (v) {
      Navigate = v;
    }
  }, 1);
  var Meteor;
  module1.link("meteor/meteor", {
    Meteor: function (v) {
      Meteor = v;
    }
  }, 2);
  var DeviceLogs;
  module1.link("../api/deviceLogs", {
    DeviceLogs: function (v) {
      DeviceLogs = v;
    }
  }, 3);
  var Session;
  module1.link("meteor/session", {
    Session: function (v) {
      Session = v;
    }
  }, 4);
  var Tracker;
  module1.link("meteor/tracker", {
    Tracker: function (v) {
      Tracker = v;
    }
  }, 5);
  var LoginPage;
  module1.link("./Login", {
    LoginPage: function (v) {
      LoginPage = v;
    }
  }, 6);
  var RegistrationPage;
  module1.link("./Registration", {
    RegistrationPage: function (v) {
      RegistrationPage = v;
    }
  }, 7);
  var WelcomePage;
  module1.link("./Welcome", {
    WelcomePage: function (v) {
      WelcomePage = v;
    }
  }, 8);
  var LandingPage;
  module1.link("./LandingPage", {
    LandingPage: function (v) {
      LandingPage = v;
    }
  }, 9);
  ___INIT_METEOR_FAST_REFRESH(module);
  var _s = $RefreshSig$();
  var App = function () {
    _s();
    var _useState = useState(null),
      _useState2 = _slicedToArray(_useState, 2),
      capturedDeviceUuid = _useState2[0],
      setCapturedDeviceUuid = _useState2[1];
    var _useState3 = useState(null),
      _useState4 = _slicedToArray(_useState3, 2),
      boolRegisteredDevice = _useState4[0],
      setBoolRegisteredDevice = _useState4[1];
    var _useState5 = useState(true),
      _useState6 = _slicedToArray(_useState5, 2),
      isLoading = _useState6[0],
      setIsLoading = _useState6[1];
    useEffect(function () {
      console.log('Initializing App component...');

      // Setup Tracker autorun for Session changes
      var sessionTracker = Tracker.autorun(function () {
        var deviceInfo = Session.get('capturedDeviceInfo');
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
        var subscriber = Meteor.subscribe('deviceLogs.byDevice', deviceInfo.uuid, {
          onStop: function (error) {
            if (error) {
              console.error('Subscription error:', error);
            }
          },
          onReady: function () {
            console.log('Subscription is ready');
            // Query the collection
            var storedDeviceInfo = DeviceLogs.find({
              deviceUUID: deviceInfo.uuid
            }).fetch();
            console.log('Fetched Device Info:', JSON.stringify({
              storedDeviceInfo: storedDeviceInfo
            }));
            setBoolRegisteredDevice(storedDeviceInfo.length > 0);
            setIsLoading(false);
          }
        });

        // Cleanup function
        return function () {
          console.log('Cleaning up subscription...');
          if (subscriber) {
            subscriber.stop();
          }
        };
      });

      // Cleanup function for the effect
      return function () {
        console.log('Cleaning up session tracker...');
        sessionTracker.stop();
      };
    }, []); // Empty dependency array - only run on mount

    // Debug logging for state changes
    useEffect(function () {
      console.log('State updated:', {
        capturedDeviceUuid: capturedDeviceUuid,
        boolRegisteredDevice: boolRegisteredDevice,
        isLoading: isLoading
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"LandingPage.jsx":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/ui/LandingPage.jsx                                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!function (module1) {
  var _regeneratorRuntime;
  module1.link("@babel/runtime/regenerator", {
    default: function (v) {
      _regeneratorRuntime = v;
    }
  }, 0);
  var _objectSpread;
  module1.link("@babel/runtime/helpers/objectSpread2", {
    default: function (v) {
      _objectSpread = v;
    }
  }, 1);
  var _slicedToArray;
  module1.link("@babel/runtime/helpers/slicedToArray", {
    default: function (v) {
      _slicedToArray = v;
    }
  }, 2);
  module1.export({
    LandingPage: function () {
      return LandingPage;
    }
  });
  var React, useState, useEffect;
  module1.link("react", {
    "default": function (v) {
      React = v;
    },
    useState: function (v) {
      useState = v;
    },
    useEffect: function (v) {
      useEffect = v;
    }
  }, 0);
  var Shield, LogOut, User, Mail, CheckCircle, XCircle, Clock, Smartphone, Edit, Filter, Search, BellRing, Moon, Sun, RotateCcw;
  module1.link("lucide-react", {
    Shield: function (v) {
      Shield = v;
    },
    LogOut: function (v) {
      LogOut = v;
    },
    User: function (v) {
      User = v;
    },
    Mail: function (v) {
      Mail = v;
    },
    CheckCircle: function (v) {
      CheckCircle = v;
    },
    XCircle: function (v) {
      XCircle = v;
    },
    Clock: function (v) {
      Clock = v;
    },
    Smartphone: function (v) {
      Smartphone = v;
    },
    Edit: function (v) {
      Edit = v;
    },
    Filter: function (v) {
      Filter = v;
    },
    Search: function (v) {
      Search = v;
    },
    BellRing: function (v) {
      BellRing = v;
    },
    Moon: function (v) {
      Moon = v;
    },
    Sun: function (v) {
      Sun = v;
    },
    RotateCcw: function (v) {
      RotateCcw = v;
    }
  }, 1);
  var Session;
  module1.link("meteor/session", {
    Session: function (v) {
      Session = v;
    }
  }, 2);
  var Meteor;
  module1.link("meteor/meteor", {
    Meteor: function (v) {
      Meteor = v;
    }
  }, 3);
  var ActionsModal;
  module1.link("./Modal/ActionsModal", {
    "default": function (v) {
      ActionsModal = v;
    }
  }, 4);
  var ResultModal;
  module1.link("./Modal/ResultModal", {
    "default": function (v) {
      ResultModal = v;
    }
  }, 5);
  var Tracker;
  module1.link("meteor/tracker", {
    Tracker: function (v) {
      Tracker = v;
    }
  }, 6);
  var formatDateTime;
  module1.link("../../utils/utils", {
    formatDateTime: function (v) {
      formatDateTime = v;
    }
  }, 7);
  var SuccessToaster;
  module1.link("./Toasters/SuccessToaster", {
    "default": function (v) {
      SuccessToaster = v;
    }
  }, 8);
  var Pagination;
  module1.link("./Pagination/Pagination", {
    "default": function (v) {
      Pagination = v;
    }
  }, 9);
  var PAGE_SIZE;
  module1.link("../../utils/constants", {
    PAGE_SIZE: function (v) {
      PAGE_SIZE = v;
    }
  }, 10);
  ___INIT_METEOR_FAST_REFRESH(module);
  var _s = $RefreshSig$();
  var LandingPage = function () {
    _s();
    var userProfile = Session.get("userProfile") || {};
    var capturedDeviceInfo = Session.get("capturedDeviceInfo") || {};
    var _useState = useState([]),
      _useState2 = _slicedToArray(_useState, 2),
      notificationHistory = _useState2[0],
      setNotificationHistory = _useState2[1];
    var _useState3 = useState(""),
      _useState4 = _slicedToArray(_useState3, 2),
      successMessage = _useState4[0],
      setSuccessMessage = _useState4[1];
    var _useState5 = useState({
        firstName: "",
        lastName: "",
        email: userProfile.email || ""
      }),
      _useState6 = _slicedToArray(_useState5, 2),
      profile = _useState6[0],
      setProfile = _useState6[1];
    var _useState7 = useState(false),
      _useState8 = _slicedToArray(_useState7, 2),
      isEditing = _useState8[0],
      setIsEditing = _useState8[1];
    var _useState9 = useState("all"),
      _useState10 = _slicedToArray(_useState9, 2),
      filter = _useState10[0],
      setFilter = _useState10[1];
    var _useState11 = useState(""),
      _useState12 = _slicedToArray(_useState11, 2),
      searchTerm = _useState12[0],
      setSearchTerm = _useState12[1];
    var _useState13 = useState(false),
      _useState14 = _slicedToArray(_useState13, 2),
      hasFetchedData = _useState14[0],
      setHasFetchedData = _useState14[1];
    var _useState15 = useState(false),
      _useState16 = _slicedToArray(_useState15, 2),
      isSaving = _useState16[0],
      setIsSaving = _useState16[1];
    var _useState17 = useState(false),
      _useState18 = _slicedToArray(_useState17, 2),
      isActionsModalOpen = _useState18[0],
      setIsActionsModalOpen = _useState18[1];
    var _useState19 = useState(false),
      _useState20 = _slicedToArray(_useState19, 2),
      isResultModalOpen = _useState20[0],
      setIsResultModalOpen = _useState20[1];
    var _useState21 = useState(null),
      _useState22 = _slicedToArray(_useState21, 2),
      notificationId = _useState22[0],
      setNotificationId = _useState22[1];
    var _useState23 = useState(1),
      _useState24 = _slicedToArray(_useState23, 2),
      currentPage = _useState24[0],
      setCurrentPage = _useState24[1];
    var _useState25 = useState({
        model: capturedDeviceInfo.model || "",
        platform: capturedDeviceInfo.platform || ""
      }),
      _useState26 = _slicedToArray(_useState25, 2),
      deviceInfo = _useState26[0],
      setDeviceInfo = _useState26[1];
    var _useState27 = useState(false),
      _useState28 = _slicedToArray(_useState27, 2),
      isDarkMode = _useState28[0],
      setIsDarkMode = _useState28[1];
    useEffect(function () {
      console.log("Initializing Tracker");
      var tracker = Tracker.autorun(function () {
        function _callee() {
          var newNotification, notfId;
          return _regeneratorRuntime.async(function () {
            function _callee$(_context) {
              while (1) switch (_context.prev = _context.next) {
                case 0:
                  newNotification = Session.get("notificationReceivedId");
                  console.log("Tracker detected change:", newNotification === null || newNotification === void 0 ? void 0 : newNotification.appId);
                  if (newNotification) {
                    _context.next = 4;
                    break;
                  }
                  return _context.abrupt("return");
                case 4:
                  setNotificationId(newNotification.appId);
                  if (!(newNotification.status === "pending")) {
                    _context.next = 9;
                    break;
                  }
                  setIsActionsModalOpen(true);
                  _context.next = 26;
                  break;
                case 9:
                  _context.prev = 9;
                  _context.next = 12;
                  return _regeneratorRuntime.awrap(getNotificationId());
                case 12:
                  notfId = _context.sent;
                  if (!notfId) {
                    _context.next = 20;
                    break;
                  }
                  console.log("Resolved Notification ID:", notfId);
                  _context.next = 17;
                  return _regeneratorRuntime.awrap(handleStatusUpdate(notfId, newNotification.status));
                case 17:
                  fetchNotificationHistory();
                  _context.next = 21;
                  break;
                case 20:
                  console.warn("No notification ID found.");
                case 21:
                  _context.next = 26;
                  break;
                case 23:
                  _context.prev = 23;
                  _context.t0 = _context["catch"](9);
                  console.error("Error fetching notification ID:", _context.t0);
                case 26:
                case "end":
                  return _context.stop();
              }
            }
            return _callee$;
          }(), null, null, [[9, 23]], Promise);
        }
        return _callee;
      }());
      return function () {
        console.log("Stopping Tracker");
        tracker.stop();
      };
    }, []);

    // Dark mode persistence
    useEffect(function () {
      var darkModePreference = localStorage.getItem("darkMode") === "true";
      setIsDarkMode(darkModePreference);
      if (darkModePreference) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }, []);
    var getNotificationId = function () {
      function _callee2() {
        var notificationId;
        return _regeneratorRuntime.async(function () {
          function _callee2$(_context2) {
            while (1) switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return _regeneratorRuntime.awrap(Meteor.callAsync("notificationHistory.getLastIdByUser", Meteor.userId()));
              case 2:
                notificationId = _context2.sent;
                return _context2.abrupt("return", notificationId);
              case 4:
              case "end":
                return _context2.stop();
            }
          }
          return _callee2$;
        }(), null, null, null, Promise);
      }
      return _callee2;
    }();
    var handleStatusUpdate = function () {
      function _callee3(id, newStatus) {
        return _regeneratorRuntime.async(function () {
          function _callee3$(_context3) {
            while (1) switch (_context3.prev = _context3.next) {
              case 0:
                if (id) {
                  _context3.next = 2;
                  break;
                }
                return _context3.abrupt("return");
              case 2:
                _context3.next = 4;
                return _regeneratorRuntime.awrap(Meteor.call("notificationHistory.updateStatus", id, newStatus, function (error, result) {
                  if (error) {
                    console.error("Error updating status:", error);
                  } else {
                    console.log("Status updated successfully!");
                  }
                }));
              case 4:
              case "end":
                return _context3.stop();
            }
          }
          return _callee3$;
        }(), null, null, null, Promise);
      }
      return _callee3;
    }();
    var toggleDarkMode = function () {
      var newMode = !isDarkMode;
      setIsDarkMode(newMode);
      localStorage.setItem("darkMode", newMode);
      if (newMode) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };
    useEffect(function () {
      fetchNotificationHistory();
    }, []);
    var fetchNotificationHistory = function () {
      function _callee4() {
        var response;
        return _regeneratorRuntime.async(function () {
          function _callee4$(_context4) {
            while (1) switch (_context4.prev = _context4.next) {
              case 0:
                _context4.next = 2;
                return _regeneratorRuntime.awrap(Meteor.callAsync("notificationHistory.getByUser", Meteor.userId()));
              case 2:
                response = _context4.sent;
                setNotificationHistory(response);
              case 4:
              case "end":
                return _context4.stop();
            }
          }
          return _callee4$;
        }(), null, null, null, Promise);
      }
      return _callee4;
    }();

    // User profile data fetching
    useEffect(function () {
      var isMounted = true;
      var fetchUserDetails = function () {
        function _callee5() {
          var result;
          return _regeneratorRuntime.async(function () {
            function _callee5$(_context5) {
              while (1) switch (_context5.prev = _context5.next) {
                case 0:
                  if (!(!hasFetchedData && userProfile.email)) {
                    _context5.next = 11;
                    break;
                  }
                  _context5.prev = 1;
                  _context5.next = 4;
                  return _regeneratorRuntime.awrap(Meteor.callAsync("getUserDetails", userProfile.email));
                case 4:
                  result = _context5.sent;
                  if (isMounted) {
                    setProfile({
                      firstName: result.firstName || "",
                      lastName: result.lastName || "",
                      email: result.email || ""
                    });
                    setHasFetchedData(true);
                  }
                  _context5.next = 11;
                  break;
                case 8:
                  _context5.prev = 8;
                  _context5.t0 = _context5["catch"](1);
                  console.error("Error fetching user details:", _context5.t0);
                case 11:
                case "end":
                  return _context5.stop();
              }
            }
            return _callee5$;
          }(), null, null, [[1, 8]], Promise);
        }
        return _callee5;
      }();
      fetchUserDetails();
      if (capturedDeviceInfo) {
        setDeviceInfo({
          model: capturedDeviceInfo.model || "",
          platform: capturedDeviceInfo.platform || ""
        });
      }
      return function () {
        isMounted = false;
      };
    }, [userProfile.email, hasFetchedData]);

    // Handle profile updates
    var handleProfileUpdate = function () {
      function _callee6() {
        return _regeneratorRuntime.async(function () {
          function _callee6$(_context6) {
            while (1) switch (_context6.prev = _context6.next) {
              case 0:
                if (Meteor.userId()) {
                  _context6.next = 3;
                  break;
                }
                alert("Please login to perform this action");
                return _context6.abrupt("return");
              case 3:
                setIsSaving(true);
                _context6.prev = 4;
                _context6.next = 7;
                return _regeneratorRuntime.awrap(Meteor.callAsync("updateUserProfile", {
                  firstName: profile.firstName,
                  lastName: profile.lastName,
                  email: profile.email
                }));
              case 7:
                setIsEditing(false);
                // Update session
                Session.set("userProfile", _objectSpread(_objectSpread({}, userProfile), profile));
                setSuccessMessage("Profile updated successfully!");
                setTimeout(function () {
                  return setSuccessMessage("");
                }, 3000);
                _context6.next = 17;
                break;
              case 13:
                _context6.prev = 13;
                _context6.t0 = _context6["catch"](4);
                console.error("Error updating profile:", _context6.t0);
                alert("Failed to update profile. Please try again.");
              case 17:
                _context6.prev = 17;
                setIsSaving(false);
                return _context6.finish(17);
              case 20:
              case "end":
                return _context6.stop();
            }
          }
          return _callee6$;
        }(), null, null, [[4, 13, 17, 20]], Promise);
      }
      return _callee6;
    }();

    // Handle logout
    var handleLogout = function () {
      Meteor.logout(function (error) {
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
    var renderProfileSection = function () {
      return /*#__PURE__*/React.createElement("div", {
        className: "flex-1"
      }, isEditing ? /*#__PURE__*/React.createElement("div", {
        className: "space-y-2"
      }, /*#__PURE__*/React.createElement("input", {
        type: "text",
        value: profile.firstName,
        onChange: function (e) {
          return setProfile(_objectSpread(_objectSpread({}, profile), {}, {
            firstName: e.target.value
          }));
        },
        className: "w-full px-2 py-1 rounded border dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600",
        placeholder: "First Name"
      }), /*#__PURE__*/React.createElement("input", {
        type: "text",
        value: profile.lastName,
        onChange: function (e) {
          return setProfile(_objectSpread(_objectSpread({}, profile), {}, {
            lastName: e.target.value
          }));
        },
        className: "w-full px-2 py-1 rounded border dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600",
        placeholder: "Last Name"
      }), /*#__PURE__*/React.createElement("div", {
        className: "flex space-x-2 mt-2"
      }, /*#__PURE__*/React.createElement("button", {
        onClick: handleProfileUpdate,
        disabled: isSaving,
        className: "px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
      }, isSaving ? "Saving..." : "Save"), /*#__PURE__*/React.createElement("button", {
        onClick: function () {
          return setIsEditing(false);
        },
        disabled: isSaving,
        className: "px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
      }, "Cancel"))) : /*#__PURE__*/React.createElement("h2", {
        className: "text-xl font-semibold text-gray-900 dark:text-white flex items-center justify-between"
      }, profile.firstName + " " + profile.lastName, /*#__PURE__*/React.createElement("button", {
        onClick: function () {
          return setIsEditing(true);
        },
        className: "p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
      }, /*#__PURE__*/React.createElement(Edit, {
        className: "h-4 w-4 text-gray-500"
      }))), /*#__PURE__*/React.createElement("p", {
        className: "text-gray-600 dark:text-gray-300 flex items-center"
      }, /*#__PURE__*/React.createElement(Mail, {
        className: "h-4 w-4 mr-2"
      }), profile.email));
    };
    var sendUserAction = function (appId, action) {
      console.log("Sending user action: " + action + " for appId: " + appId);
      Meteor.call("notifications.handleResponse", appId, action, function (error, result) {
        if (error) {
          console.error("Error sending notification response:", error);
        } else {
          console.log("Server processed action:", result);
          setNotificationId(null);
          Session.set("notificationReceivedId", null);
        }
      });
    };
    var handleCloseResultModal = function () {
      setIsResultModalOpen(false);
    };
    var handleCloseActionModal = function () {
      setIsActionsModalOpen(false);
    };
    var handleApprove = function () {
      function _callee7() {
        var notfId;
        return _regeneratorRuntime.async(function () {
          function _callee7$(_context7) {
            while (1) switch (_context7.prev = _context7.next) {
              case 0:
                sendUserAction(notificationId, "approve");
                _context7.next = 3;
                return _regeneratorRuntime.awrap(getNotificationId());
              case 3:
                notfId = _context7.sent;
                _context7.next = 6;
                return _regeneratorRuntime.awrap(handleStatusUpdate(notfId, "approved"));
              case 6:
                setIsResultModalOpen(true);
                setIsActionsModalOpen(false);
                fetchNotificationHistory();
              case 9:
              case "end":
                return _context7.stop();
            }
          }
          return _callee7$;
        }(), null, null, null, Promise);
      }
      return _callee7;
    }();
    var handleReject = function () {
      function _callee8() {
        var notfId;
        return _regeneratorRuntime.async(function () {
          function _callee8$(_context8) {
            while (1) switch (_context8.prev = _context8.next) {
              case 0:
                sendUserAction(notificationId, "reject");
                _context8.next = 3;
                return _regeneratorRuntime.awrap(getNotificationId());
              case 3:
                notfId = _context8.sent;
                _context8.next = 6;
                return _regeneratorRuntime.awrap(handleStatusUpdate(notfId, "rejected"));
              case 6:
                setIsActionsModalOpen(false);
                fetchNotificationHistory();
              case 8:
              case "end":
                return _context8.stop();
            }
          }
          return _callee8$;
        }(), null, null, null, Promise);
      }
      return _callee8;
    }();
    var filteredNotifications = notificationHistory.filter(function (notification) {
      var _notification$message, _notification$title;
      var matchesFilter = filter === "all" || notification.status === filter;
      var normalizedSearchTerm = searchTerm.toLowerCase().trim();
      var matchesSearch = normalizedSearchTerm === "" || ((_notification$message = notification.message) === null || _notification$message === void 0 ? void 0 : _notification$message.toLowerCase().includes(normalizedSearchTerm)) || ((_notification$title = notification.title) === null || _notification$title === void 0 ? void 0 : _notification$title.toLowerCase().includes(normalizedSearchTerm));
      return matchesFilter && matchesSearch;
    });
    var totalPages = Math.ceil((filteredNotifications === null || filteredNotifications === void 0 ? void 0 : filteredNotifications.length) / PAGE_SIZE);
    var paginatedNotifications = filteredNotifications.reverse().slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    console.log("paginatedNotifications:", paginatedNotifications);
    var handlePageChange = function (newPage) {
      setCurrentPage(newPage);
    };
    var today = new Date().toISOString().split("T")[0];
    var todayCount = filteredNotifications.filter(function (notification) {
      var createdAtDate = notification.createdAt instanceof Date ? notification.createdAt.toISOString().split("T")[0] : String(notification.createdAt).split("T")[0];
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
      onClose: function () {
        return setSuccessMessage("");
      }
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
      onChange: function (e) {
        return setSearchTerm(e.target.value);
      }
    }))), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-2"
    }, /*#__PURE__*/React.createElement(Filter, {
      className: "h-4 w-4 text-gray-500"
    }), /*#__PURE__*/React.createElement("select", {
      className: "bg-transparent text-gray-400 border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600",
      value: filter,
      onChange: function (e) {
        return setFilter(e.target.value);
      }
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
    }, "History")), paginatedNotifications.map(function (notification) {
      return /*#__PURE__*/React.createElement("div", {
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
        className: "px-3 py-1 rounded-full text-sm font-medium capitalize " + (notification.status === "approved" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : notification.status === "rejected" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200")
      }, notification.status)));
    }), /*#__PURE__*/React.createElement(Pagination, {
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"Login.jsx":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/ui/Login.jsx                                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!function (module1) {
  var _regeneratorRuntime;
  module1.link("@babel/runtime/regenerator", {
    default: function (v) {
      _regeneratorRuntime = v;
    }
  }, 0);
  var _slicedToArray;
  module1.link("@babel/runtime/helpers/slicedToArray", {
    default: function (v) {
      _slicedToArray = v;
    }
  }, 1);
  module1.export({
    LoginPage: function () {
      return LoginPage;
    }
  });
  var React, useState, useEffect;
  module1.link("react", {
    "default": function (v) {
      React = v;
    },
    useState: function (v) {
      useState = v;
    },
    useEffect: function (v) {
      useEffect = v;
    }
  }, 0);
  var useNavigate;
  module1.link("react-router-dom", {
    useNavigate: function (v) {
      useNavigate = v;
    }
  }, 1);
  var FiMail, FiLock;
  module1.link("react-icons/fi", {
    FiMail: function (v) {
      FiMail = v;
    },
    FiLock: function (v) {
      FiLock = v;
    }
  }, 2);
  var Meteor;
  module1.link("meteor/meteor", {
    Meteor: function (v) {
      Meteor = v;
    }
  }, 3);
  var Session;
  module1.link("meteor/session", {
    Session: function (v) {
      Session = v;
    }
  }, 4);
  ___INIT_METEOR_FAST_REFRESH(module);
  var _s = $RefreshSig$();
  var LoginPage = function (_ref) {
    var deviceDetails = _ref.deviceDetails;
    _s();
    var _useState = useState(''),
      _useState2 = _slicedToArray(_useState, 2),
      email = _useState2[0],
      setEmail = _useState2[1];
    var _useState3 = useState(''),
      _useState4 = _slicedToArray(_useState3, 2),
      pin = _useState4[0],
      setPin = _useState4[1];
    var _useState5 = useState(''),
      _useState6 = _slicedToArray(_useState5, 2),
      error = _useState6[0],
      setError = _useState6[1];
    var _useState7 = useState(false),
      _useState8 = _slicedToArray(_useState7, 2),
      isLoggingIn = _useState8[0],
      setIsLoggingIn = _useState8[1];
    var navigate = useNavigate();
    useEffect(function () {
      // Check for device details on component mount
      if (!deviceDetails) {
        console.warn('No device details available');
      }

      // Check for Meteor connection
      var connectionCheck = setInterval(function () {
        if (!Meteor.status().connected) {
          setError('Connection to server lost. Attempting to reconnect...');
        } else if (error.includes('Connection to server lost')) {
          setError('');
        }
      }, 3000);
      return function () {
        return clearInterval(connectionCheck);
      };
    }, [deviceDetails, error]);
    var handleLogin = function () {
      function _callee(e) {
        return _regeneratorRuntime.async(function () {
          function _callee$(_context) {
            while (1) switch (_context.prev = _context.next) {
              case 0:
                e.preventDefault();

                // Validate device details
                if (deviceDetails) {
                  _context.next = 4;
                  break;
                }
                setError('Device information not available. Please refresh the page.');
                return _context.abrupt("return");
              case 4:
                if (Meteor.status().connected) {
                  _context.next = 7;
                  break;
                }
                setError('Unable to connect to server. Please check your connection.');
                return _context.abrupt("return");
              case 7:
                setIsLoggingIn(true);
                setError('');
                _context.prev = 9;
                _context.next = 12;
                return _regeneratorRuntime.awrap(new Promise(function (resolve, reject) {
                  Meteor.loginWithPassword(email, pin, function (err) {
                    if (err) {
                      console.error('Login Error:', err);
                      reject(err);
                    } else {
                      resolve();
                    }
                  });
                }));
              case 12:
                Session.set('userProfile', {
                  email: email
                });
                navigate('/dashboard');
                _context.next = 19;
                break;
              case 16:
                _context.prev = 16;
                _context.t0 = _context["catch"](9);
                setError(_context.t0.reason || 'Login failed. Please try again.');
              case 19:
                _context.prev = 19;
                setIsLoggingIn(false);
                return _context.finish(19);
              case 22:
              case "end":
                return _context.stop();
            }
          }
          return _callee$;
        }(), null, null, [[9, 16, 19, 22]], Promise);
      }
      return _callee;
    }();
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
      onChange: function (e) {
        return setEmail(e.target.value);
      },
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
      onChange: function (e) {
        return setPin(e.target.value);
      },
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"Registration.jsx":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/ui/Registration.jsx                                                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!function (module1) {
  var _regeneratorRuntime;
  module1.link("@babel/runtime/regenerator", {
    default: function (v) {
      _regeneratorRuntime = v;
    }
  }, 0);
  var _extends;
  module1.link("@babel/runtime/helpers/extends", {
    default: function (v) {
      _extends = v;
    }
  }, 1);
  var _objectSpread;
  module1.link("@babel/runtime/helpers/objectSpread2", {
    default: function (v) {
      _objectSpread = v;
    }
  }, 2);
  var _slicedToArray;
  module1.link("@babel/runtime/helpers/slicedToArray", {
    default: function (v) {
      _slicedToArray = v;
    }
  }, 3);
  module1.export({
    RegistrationPage: function () {
      return RegistrationPage;
    }
  });
  var React, useState;
  module1.link("react", {
    "default": function (v) {
      React = v;
    },
    useState: function (v) {
      useState = v;
    }
  }, 0);
  var useNavigate;
  module1.link("react-router-dom", {
    useNavigate: function (v) {
      useNavigate = v;
    }
  }, 1);
  var FiUser, FiMail, FiLock;
  module1.link("react-icons/fi", {
    FiUser: function (v) {
      FiUser = v;
    },
    FiMail: function (v) {
      FiMail = v;
    },
    FiLock: function (v) {
      FiLock = v;
    }
  }, 2);
  var motion;
  module1.link("framer-motion", {
    motion: function (v) {
      motion = v;
    }
  }, 3);
  var Meteor;
  module1.link("meteor/meteor", {
    Meteor: function (v) {
      Meteor = v;
    }
  }, 4);
  var Session;
  module1.link("meteor/session", {
    Session: function (v) {
      Session = v;
    }
  }, 5);
  ___INIT_METEOR_FAST_REFRESH(module);
  var _s = $RefreshSig$();
  var RegistrationPage = function (_ref) {
    var deviceDetails = _ref.deviceDetails;
    _s();
    var _useState = useState({
        email: '',
        firstName: '',
        lastName: '',
        pin: ''
      }),
      _useState2 = _slicedToArray(_useState, 2),
      formData = _useState2[0],
      setFormData = _useState2[1];
    var _useState3 = useState(false),
      _useState4 = _slicedToArray(_useState3, 2),
      loading = _useState4[0],
      setLoading = _useState4[1];
    var navigate = useNavigate();
    var handleSubmit = function () {
      function _callee(e) {
        var sessionDeviceInfo, fcmDeviceToken;
        return _regeneratorRuntime.async(function () {
          function _callee$(_context) {
            while (1) switch (_context.prev = _context.next) {
              case 0:
                e.preventDefault();
                if (deviceDetails) {
                  _context.next = 4;
                  break;
                }
                alert('Device information not available');
                return _context.abrupt("return");
              case 4:
                setLoading(true);
                sessionDeviceInfo = Session.get('capturedDeviceInfo');
                fcmDeviceToken = Session.get('deviceToken'); // Get FCM token from session
                if (!(sessionDeviceInfo.uuid === deviceDetails)) {
                  _context.next = 23;
                  break;
                }
                _context.prev = 8;
                _context.next = 11;
                return _regeneratorRuntime.awrap(new Promise(function (resolve, reject) {
                  Meteor.call('users.register', _objectSpread(_objectSpread({}, formData), {}, {
                    sessionDeviceInfo: sessionDeviceInfo,
                    fcmDeviceToken: fcmDeviceToken
                  }), function (err, result) {
                    if (err) {
                      console.error("Registration error:", err);
                      reject(err);
                    } else {
                      console.log("Registration success:", result);
                      resolve(result);
                    }
                  });
                }));
              case 11:
                // Navigate to login after successful registration
                navigate('/login');
                _context.next = 18;
                break;
              case 14:
                _context.prev = 14;
                _context.t0 = _context["catch"](8);
                console.error('Registration failed:', _context.t0);
                alert(_context.t0.reason || 'Registration failed. Please try again.');
              case 18:
                _context.prev = 18;
                setLoading(false);
                return _context.finish(18);
              case 21:
                _context.next = 25;
                break;
              case 23:
                alert('Registration failed. Device uuid is not matched or tampered.');
                setLoading(false);
              case 25:
              case "end":
                return _context.stop();
            }
          }
          return _callee$;
        }(), null, null, [[8, 14, 18, 21]], Promise);
      }
      return _callee;
    }();
    var inputFields = [{
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
    }, inputFields.map(function (field, index) {
      return /*#__PURE__*/React.createElement(motion.div, {
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
        onChange: function (e) {
          return setFormData(function (prev) {
            var _objectSpread2;
            return _objectSpread(_objectSpread({}, prev), {}, (_objectSpread2 = {}, _objectSpread2[e.target.name] = e.target.value, _objectSpread2));
          });
        },
        className: "w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500"
      }))));
    })), /*#__PURE__*/React.createElement(motion.button, {
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"Welcome.jsx":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/ui/Welcome.jsx                                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!function (module1) {
  module1.export({
    WelcomePage: function () {
      return WelcomePage;
    }
  });
  var React;
  module1.link("react", {
    "default": function (v) {
      React = v;
    }
  }, 0);
  var useNavigate;
  module1.link("react-router-dom", {
    useNavigate: function (v) {
      useNavigate = v;
    }
  }, 1);
  var FiLogIn, FiUserPlus;
  module1.link("react-icons/fi", {
    FiLogIn: function (v) {
      FiLogIn = v;
    },
    FiUserPlus: function (v) {
      FiUserPlus = v;
    }
  }, 2);
  ___INIT_METEOR_FAST_REFRESH(module);
  var _s = $RefreshSig$();
  var WelcomePage = function () {
    _s();
    var navigate = useNavigate();
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
      onClick: function () {
        return navigate('/login');
      },
      className: "group relative w-full flex justify-center items-center px-4 py-3 border border-transparent text-lg font-medium rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform transition hover:scale-105"
    }, /*#__PURE__*/React.createElement(FiLogIn, {
      className: "mr-2"
    }), " Sign In"), /*#__PURE__*/React.createElement("button", {
      onClick: function () {
        return navigate('/register');
      },
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"api":{"deviceLogs.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// imports/api/deviceLogs.js                                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!function (module1) {
  var _regeneratorRuntime;
  module1.link("@babel/runtime/regenerator", {
    default: function (v) {
      _regeneratorRuntime = v;
    }
  }, 0);
  module1.export({
    DeviceLogs: function () {
      return DeviceLogs;
    }
  });
  var Mongo;
  module1.link("meteor/mongo", {
    Mongo: function (v) {
      Mongo = v;
    }
  }, 0);
  var check;
  module1.link("meteor/check", {
    check: function (v) {
      check = v;
    }
  }, 1);
  var SHA256;
  module1.link("meteor/sha", {
    SHA256: function (v) {
      SHA256 = v;
    }
  }, 2);
  ___INIT_METEOR_FAST_REFRESH(module);
  var DeviceLogs = new Mongo.Collection('deviceLogs');
  // Add generateAppId utility function
  var generateAppId = function (deviceUUID, email, creationTime) {
    var combinedString = deviceUUID + ":" + email + ":" + creationTime;
    return SHA256(combinedString).substring(0, 32);
  };

  // Create indexes for better query performance
  if (Meteor.isServer) {
    Meteor.startup(function () {
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
    'deviceLogs.upsert': function () {
      function _callee(data) {
        var creationTime, appId;
        return _regeneratorRuntime.async(function () {
          function _callee$(_context) {
            while (1) switch (_context.prev = _context.next) {
              case 0:
                check(data, {
                  userId: String,
                  email: String,
                  deviceUUID: String,
                  fcmToken: String,
                  deviceInfo: Object
                });
                creationTime = new Date().toISOString();
                appId = generateAppId(data.deviceUUID, data.email, creationTime);
                console.log('Generated appId during upsert:', appId); // Add this log
                return _context.abrupt("return", DeviceLogs.upsertAsync({
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
                }));
              case 5:
              case "end":
                return _context.stop();
            }
          }
          return _callee$;
        }(), null, null, null, Promise);
      }
      return _callee;
    }(),
    'deviceLogs.updateToken': function (userId, deviceUUID, fcmToken) {
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
    'deviceLogs.getFCMTokenByAppId': function () {
      function _callee2(appId) {
        var deviceLog;
        return _regeneratorRuntime.async(function () {
          function _callee2$(_context2) {
            while (1) switch (_context2.prev = _context2.next) {
              case 0:
                check(appId, String);
                _context2.next = 3;
                return _regeneratorRuntime.awrap(DeviceLogs.findOneAsync({
                  appId: appId
                }));
              case 3:
                deviceLog = _context2.sent;
                if (deviceLog) {
                  _context2.next = 6;
                  break;
                }
                throw new Meteor.Error('invalid-app-id', 'No device found with this App ID');
              case 6:
                return _context2.abrupt("return", deviceLog.fcmToken);
              case 7:
              case "end":
                return _context2.stop();
            }
          }
          return _callee2$;
        }(), null, null, null, Promise);
      }
      return _callee2;
    }(),
    'deviceLogs.getFCMTokenByDeviceId': function () {
      function _callee3(deviceUUID) {
        var deviceLog;
        return _regeneratorRuntime.async(function () {
          function _callee3$(_context3) {
            while (1) switch (_context3.prev = _context3.next) {
              case 0:
                check(deviceUUID, String);
                _context3.next = 3;
                return _regeneratorRuntime.awrap(DeviceLogs.findOneAsync({
                  deviceUUID: deviceUUID
                }));
              case 3:
                deviceLog = _context3.sent;
                if (deviceLog) {
                  _context3.next = 6;
                  break;
                }
                throw new Meteor.Error('invalid-app-id', 'No device found with this Device ID');
              case 6:
                return _context3.abrupt("return", deviceLog.fcmToken);
              case 7:
              case "end":
                return _context3.stop();
            }
          }
          return _callee3$;
        }(), null, null, null, Promise);
      }
      return _callee3;
    }(),
    // Also fix the debug method
    'deviceLogs.getByAppId': function () {
      function _callee4(appId) {
        var result;
        return _regeneratorRuntime.async(function () {
          function _callee4$(_context4) {
            while (1) switch (_context4.prev = _context4.next) {
              case 0:
                check(appId, String);
                _context4.next = 3;
                return _regeneratorRuntime.awrap(DeviceLogs.findOneAsync({
                  appId: appId
                }));
              case 3:
                result = _context4.sent;
                console.log('Looking for appId:', appId);
                console.log('Found device log:', result);
                return _context4.abrupt("return", result);
              case 7:
              case "end":
                return _context4.stop();
            }
          }
          return _callee4$;
        }(), null, null, null, Promise);
      }
      return _callee4;
    }()
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"utils":{"constants.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// utils/constants.js                                                                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!function (module1) {
  module1.export({
    PAGE_SIZE: function () {
      return PAGE_SIZE;
    }
  });
  ___INIT_METEOR_FAST_REFRESH(module);
  var PAGE_SIZE = 5;
}.call(this, module);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"utils.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// utils/utils.js                                                                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!function (module1) {
  module1.export({
    formatDateTime: function () {
      return formatDateTime;
    }
  });
  ___INIT_METEOR_FAST_REFRESH(module);
  var formatDateTime = function (isoString) {
    if (!isoString) return "";
    var date = new Date(isoString);

    // Extracting date in YYYY-MM-DD format
    var formattedDate = date.toISOString().split("T")[0];

    // Extracting time in HH:MM format
    var formattedTime = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
    return formattedDate + " " + formattedTime;
  };
}.call(this, module);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"client":{"main.css":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// client/main.css                                                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// These styles have already been applied to the document.

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"main.jsx":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// client/main.jsx                                                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!function (module1) {
  var React, useEffect;
  module1.link("react", {
    "default": function (v) {
      React = v;
    },
    useEffect: function (v) {
      useEffect = v;
    }
  }, 0);
  var createRoot;
  module1.link("react-dom/client", {
    createRoot: function (v) {
      createRoot = v;
    }
  }, 1);
  var Meteor;
  module1.link("meteor/meteor", {
    Meteor: function (v) {
      Meteor = v;
    }
  }, 2);
  module1.link("./main.css");
  module1.link("../imports/api/deviceLogs");
  var App;
  module1.link("../imports/ui/App", {
    App: function (v) {
      App = v;
    }
  }, 3);
  var Session;
  module1.link("meteor/session", {
    Session: function (v) {
      Session = v;
    }
  }, 4);
  ___INIT_METEOR_FAST_REFRESH(module);
  var sendUserAction = function (appId, action) {
    console.log("Sending user action: " + action + " for appId: " + appId);
    Meteor.call('notifications.handleResponse', appId, action, function (error, result) {
      if (error) {
        console.error('Error sending notification response:', error);
      } else {
        console.log('Server processed action:', result);
      }
    });
  };
  Meteor.startup(function () {
    var container = document.getElementById('react-target');
    var root = createRoot(container);
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
      document.addEventListener('deviceready', function () {
        console.log("Cordova device is ready");

        // Create notification channel
        PushNotification.createChannel(function () {
          console.log('Channel created successfully');
        }, function () {
          console.error('Channel creation failed');
        }, {
          id: 'default',
          description: 'Default channel',
          importance: 4,
          vibration: true,
          sound: 'default'
        });
        var push = PushNotification.init({
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
          push.on('registration', function (data) {
            console.log("Registration handler attached");
            console.log('Registration data:', data);
            Session.set('deviceToken', data.registrationId);
          });
          push.on('notification', function (notification) {
            console.log('Notification received:', notification);

            // Handle cold start (app launched from notification)
            if (notification.additionalData.coldstart) {
              // Process action from cold start here
              var action = notification.additionalData.action;
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
          push.on('reject', function (notification) {
            if (notification.additionalData) {
              var appId = notification.additionalData.appId;
              if (Session.get("userProfile")) {
                sendUserAction(appId, 'reject');
                Session.set('notificationReceivedId', {
                  appId: appId,
                  status: "rejected"
                });
              } else {
                Session.set('notificationReceivedId', {
                  appId: appId,
                  status: "pending"
                });
              }
            }
          });
          push.on('approve', function (notification) {
            if (notification.additionalData) {
              var appId = notification.additionalData.appId;
              if (Session.get("userProfile")) {
                sendUserAction(appId, 'approve');
                Session.set('notificationReceivedId', {
                  appId: appId,
                  status: "approved"
                });
              } else {
                Session.set('notificationReceivedId', {
                  appId: appId,
                  status: "pending"
                });
              }
            }
          });

          // Handle errors
          push.on('error', function (error) {
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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