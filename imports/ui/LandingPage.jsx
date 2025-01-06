import React, { useState } from 'react';
import { 
  Shield, 
  LogOut,
  User,
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  Smartphone,
  Edit,
  Filter,
  Search,
  BellRing
} from 'lucide-react';

export const LandingPage = () =>{
  const [profile, setProfile] = useState({
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com"
  });
  const [isEditing, setIsEditing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [deviceInfo, setDeviceInfo] = useState({});

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
    setRequests(requests.map(req => 
      req.id === id ? { ...req, status: response } : req
    ));
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 shadow-lg sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">MieSecure</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button className="flex items-center space-x-2 px-4 py-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors">
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
                <div className="flex-1">
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={profile.firstName}
                        onChange={e => setProfile({...profile, firstName: e.target.value})}
                        className="w-full px-2 py-1 rounded border dark:bg-gray-700 dark:border-gray-600"
                      />
                      <input
                        type="text"
                        value={profile.lastName}
                        onChange={e => setProfile({...profile, lastName: e.target.value})}
                        className="w-full px-2 py-1 rounded border dark:bg-gray-700 dark:border-gray-600"
                      />
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
              </div>
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
                {historyRequests.map(request => (
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
                      <div className={`px-3 py-1 rounded-full ${
                        request.status === 'approved' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
