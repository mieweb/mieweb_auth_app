import React, { useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { Layout } from './web/components/Layout';
import { Send, Bell, CheckCircle, AlertCircle, Clock, User, Smartphone, Info, AlertTriangle } from 'lucide-react';

export const WebNotificationPage = () => {
  const [formData, setFormData] = useState({
    username: 'your_username',
    title: 'Test Push Notification',
    body: 'This is a test notification from Mieweb Auth.'
  });
  const [status, setStatus] = useState(null);
  const [userAction, setUserAction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [waitingForAction, setWaitingForAction] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSendNotification = async () => {
    if (!formData.username.trim()) {
      setStatus({ type: 'error', message: 'Username is required' });
      return;
    }

    setIsLoading(true);
    setStatus(null);
    setUserAction(null);
    setWaitingForAction(false);

    try {
      console.log('Sending notification request...');

      const response = await fetch(Meteor.absoluteUrl('send-notification'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          username: formData.username.trim(),
          title: formData.title,
          body: formData.body,
          timeout: "",
          restriction: "",
          deviceType: "primary",
          metaData: "server name, ip, source, etc",
          actions: [
            { icon: "approve", title: "Approve", callback: "approve" },
            { icon: "reject", title: "Reject", callback: "reject" }
          ]
        })
      });

      // Parse response as JSON regardless of status
      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      if (!response.ok) {
        const errorMessage = result.error || result.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      console.log('Notification response:', result);
      
      setStatus({ type: 'success', message: result.message || 'Notification sent successfully!' });
      setIsLoading(false);
      
      if (result.action) {
        setWaitingForAction(true);
        
        let actionMessage = '';
        let actionType = 'info';
        
        switch (result.action.toLowerCase()) {
          case 'approve':
            actionMessage = 'User approved the request ✅';
            actionType = 'success';
            break;
          case 'reject':
            actionMessage = 'User rejected the request ❌';
            actionType = 'error';
            break;
          case 'timeout':
            actionMessage = 'Request timed out ⏰';
            actionType = 'warning';
            break;
          default:
            actionMessage = `User action: ${result.action}`;
            actionType = 'info';
        }
        
        setTimeout(() => {
          setWaitingForAction(false);
          setUserAction({ type: actionType, message: actionMessage });
        }, 2000);
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      setStatus({ type: 'error', message: error.message || 'Failed to send notification' });
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Instructions & Info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Info className="w-5 h-5 mr-2 text-blue-600" />
                MIEAuth Test Instructions
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Test your Auth app, a professional two-factor authentication app using push notifications.
              </p>
              
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2">What to Test</h3>
              <ul className="text-sm text-gray-600 space-y-2 mb-6 list-disc pl-4">
                <li>Push notification delivery and reliability</li>
                <li>Login approval/denial flow</li>
                <li>Device registration process</li>
                <li>Biometric authentication (Face ID/Touch ID)</li>
                <li>Dark mode interface</li>
                <li>Notification history tracking</li>
              </ul>

              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2">Known Issues</h3>
              <ul className="text-sm text-gray-600 space-y-2 mb-6 list-disc pl-4">
                <li>Occasional notification delay in background mode</li>
                <li>UI refinements in progress</li>
              </ul>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Feedback</h3>
              <p className="text-sm text-gray-600 mb-4">
                Your feedback is crucial! Please report bugs or suggestions to <a href="mailto:devopsalerts@mieweb.com" className="text-blue-600 hover:underline">devopsalerts@mieweb.com</a>
              </p>
              <p className="text-sm text-gray-500 italic">
                Thank you for helping us build a more secure authentication experience!
              </p>
            </div>
          </div>

          {/* Right Column: Testing Interface */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <Bell className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Test Mieweb Auth</h1>
                    <p className="mt-1 text-sm text-gray-500">
                      Send a test push notification to your registered device.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 space-y-8">
                {/* Prerequisite Note & Download Links */}
                <div className="bg-blue-50 rounded-md p-4 border border-blue-100">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-blue-800">
                        <strong>Prerequisite:</strong> You need to install the app and register your device to receive notifications.
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {/* App Store - Small */}
                      <a href="https://apps.apple.com/us/app/mie-auth-open-source/id6756409072" className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-black hover:bg-gray-800 shadow-sm transition-colors">
                        <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.11-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                        </svg>
                        App Store
                      </a>
                      {/* Play Store - Small */}
                      <a href="https://play.google.com/store/apps/details?id=com.mieweb.mieauth" className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-black hover:bg-gray-800 shadow-sm transition-colors">
                        <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                        </svg>
                        Google Play
                      </a>
                    </div>
                  </div>
                </div>

                {/* Status Messages */}
                {status && (
                  <div className={`rounded-md p-4 ${status.type === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="flex">
                      <div className="flex-shrink-0">
                        {status.type === 'success' ? (
                          <CheckCircle className="h-5 w-5 text-green-400" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-400" />
                        )}
                      </div>
                      <div className="ml-3">
                        <h3 className={`text-sm font-medium ${status.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                          {status.type === 'success' ? 'Success' : 'Error'}
                        </h3>
                        <div className={`mt-2 text-sm ${status.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                          <p>{status.message}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* User Action Result */}
                {waitingForAction && (
                  <div className="rounded-md bg-blue-50 p-4 animate-pulse">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <Clock className="h-5 w-5 text-blue-400" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-blue-800">Waiting for response...</h3>
                        <div className="mt-2 text-sm text-blue-700">
                          <p>Please check your device and approve/reject the request.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {userAction && (
                  <div className={`rounded-md p-4 ${
                    userAction.type === 'success' ? 'bg-green-50' : 
                    userAction.type === 'error' ? 'bg-red-50' : 'bg-yellow-50'
                  }`}>
                    <div className="flex">
                      <div className="flex-shrink-0">
                        {userAction.type === 'success' ? (
                          <CheckCircle className="h-5 w-5 text-green-400" />
                        ) : userAction.type === 'error' ? (
                          <AlertCircle className="h-5 w-5 text-red-400" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-400" />
                        )}
                      </div>
                      <div className="ml-3">
                        <h3 className={`text-sm font-medium ${
                          userAction.type === 'success' ? 'text-green-800' : 
                          userAction.type === 'error' ? 'text-red-800' : 'text-yellow-800'
                        }`}>
                          Response Received
                        </h3>
                        <div className={`mt-2 text-sm ${
                          userAction.type === 'success' ? 'text-green-700' : 
                          userAction.type === 'error' ? 'text-red-700' : 'text-yellow-700'
                        }`}>
                          <p>{userAction.message}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Form */}
                <div className="space-y-6">
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                      Target Username
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        name="username"
                        id="username"
                        className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-3 border"
                        placeholder="Enter username"
                        value={formData.username}
                        onChange={handleChange}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Enter the username of the registered device you want to test.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                        Notification Title
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="title"
                          id="title"
                          className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                          value={formData.title}
                          onChange={handleChange}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="body" className="block text-sm font-medium text-gray-700">
                        Notification Body
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="body"
                          id="body"
                          className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                          value={formData.body}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                      <Smartphone className="w-4 h-4 mr-2 text-gray-500" />
                      Preview
                    </h4>
                    <div className="bg-white p-3 rounded border border-gray-200 shadow-sm">
                      <p className="font-semibold text-gray-900">{formData.title || 'Notification Title'}</p>
                      <p className="text-sm text-gray-600">{formData.body || 'Notification body text...'}</p>
                    </div>
                  </div>

                  <button
                    onClick={handleSendNotification}
                    disabled={isLoading || waitingForAction}
                    className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                      (isLoading || waitingForAction) ? 'opacity-75 cursor-not-allowed' : ''
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" />
                        Send Notification
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
