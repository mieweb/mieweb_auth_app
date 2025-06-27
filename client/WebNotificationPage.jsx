import React, { useState } from 'react';

export const WebNotificationPage = () => {
  const [username, setUsername] = useState('aabrol');
  const [status, setStatus] = useState(null);
  const [userAction, setUserAction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [waitingForAction, setWaitingForAction] = useState(false);
  const [showDownloadInfo, setShowDownloadInfo] = useState(false);

  const handleSendNotification = async () => {
    if (!username.trim()) {
      setStatus({ type: 'error', message: 'Username is required' });
      return;
    }

    setIsLoading(true);
    setStatus(null);
    setUserAction(null);
    setWaitingForAction(false);

    try {
      console.log('Sending notification request...');

      const response = await fetch(`${process.env.ROOT_URL}/send-notification`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          username: username.trim(),
          title: "MIE Sudo Security Alert",
          body: "Please review and respond to your pending MIE request in the app",
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

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      // Parse response as JSON regardless of status
      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        // If JSON parsing fails, get text response
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      if (!response.ok) {
        // Handle server error with proper JSON error response
        const errorMessage = result.error || result.message || `HTTP ${response.status}: ${response.statusText}`;
        console.error('Server error response:', result);
        throw new Error(errorMessage);
      }

      console.log('Notification response:', result);
      
      // First show notification sent
      setStatus({ type: 'success', message: result.message || 'Notification sent successfully!' });
      setIsLoading(false);
      
      // If the response includes user action, show it after a brief delay
      if (result.action) {
        setWaitingForAction(true);
        
        // Map action to user-friendly message and type
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
        
        // Show waiting state briefly, then show the user action
        setTimeout(() => {
          setUserAction({ 
            type: actionType, 
            message: actionMessage
          });
          setWaitingForAction(false);
        }, 1500); // Show waiting for 1.5 seconds before revealing action
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      setStatus({ 
        type: 'error', 
        message: `Failed to send notification: ${error.message}` 
      });
    } finally {
      if (!waitingForAction) {
        setIsLoading(false);
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSendNotification();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white shadow-lg rounded-xl max-w-md w-full p-8 space-y-6">
        <h2 className="text-2xl font-bold text-center text-gray-800">
          Send Notification
        </h2>

        {/* Download APK Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-blue-800">📱 Download Mobile App</h3>
            <button
              onClick={() => setShowDownloadInfo(!showDownloadInfo)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              {showDownloadInfo ? 'Hide' : 'Show Instructions'}
            </button>
          </div>
          
          {showDownloadInfo && (
            <div className="space-y-3 text-sm text-blue-700">
              <p>To receive notifications on your mobile device, download the latest APK:</p>
              
              <div className="bg-white rounded-lg p-3 border border-blue-300">
                <div className="space-y-2">
                  <p className="font-medium">📥 Download Steps:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Click the download link below</li>
                    <li>Sign in to GitHub if prompted</li>
                    <li>Download the APK file</li>
                    <li>Enable "Install from Unknown Sources" on your Android device</li>
                    <li>Install the APK and set up your username</li>
                  </ol>
                </div>
              </div>

              <a
                href="https://github.com/mieweb/mieweb_auth_app/actions"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                🚀 Download Latest APK from GitHub Actions
              </a>
              
              <p className="text-xs text-blue-600">
                💡 <strong>Note:</strong>
                The APK will be in the latest successful workflow run under "Artifacts".
              </p>
            </div>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={handleKeyPress}
            className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
            placeholder="Enter username"
            required
            autoFocus
          />
        </div>

        <div className="text-sm text-gray-500 space-y-1 bg-gray-50 p-4 rounded-lg">
          <div><strong className="text-gray-700">Title:</strong> MIE Sudo Security Alert</div>
          <div><strong className="text-gray-700">Body:</strong> Please review and respond to your pending MIE request in the app</div>
          <div><strong className="text-gray-700">Device Type:</strong> primary</div>
          <div><strong className="text-gray-700">MetaData:</strong> server name, ip, source, etc</div>
          <div><strong className="text-gray-700">Actions:</strong> Approve / Reject</div>
        </div>

        <button
          onClick={handleSendNotification}
          disabled={isLoading}
          className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
              Sending...
            </>
          ) : (
            'Send Notification'
          )}
        </button>

        {status && (
          <div
            className={`text-center text-sm p-3 rounded-lg transition-all duration-200 ${
              status.type === 'success' 
                ? 'text-green-700 bg-green-50 border border-green-200' 
                : 'text-red-700 bg-red-50 border border-red-200'
            }`}
          >
            {status.message}
          </div>
        )}

        {waitingForAction && (
          <div className="text-center text-sm p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent mr-2"></div>
              Waiting for user response...
            </div>
          </div>
        )}

        {userAction && (
          <div
            className={`text-center text-sm p-3 rounded-lg transition-all duration-200 ${
              userAction.type === 'success' 
                ? 'text-green-700 bg-green-50 border border-green-200' 
                : userAction.type === 'error'
                ? 'text-red-700 bg-red-50 border border-red-200'
                : userAction.type === 'warning'
                ? 'text-orange-700 bg-orange-50 border border-orange-200'
                : 'text-blue-700 bg-blue-50 border border-blue-200'
            }`}
          >
            {userAction.message}
          </div>
        )}
      </div>
    </div>
  );
};