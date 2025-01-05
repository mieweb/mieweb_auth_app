// import React, { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { FiMail, FiLock, FiArrowLeft } from 'react-icons/fi';

// export const LoginPage = () => {
//   const [email, setEmail] = useState('');
//   const [pin, setPin] = useState('');
//   const [deviceInfo, setDeviceInfo] = useState(null);
//   const navigate = useNavigate();

//   useEffect(() => {
//     if (window.device) {
//       setDeviceInfo({
//         model: window.device.model,
//         platform: window.device.platform,
//         uuid: window.device.uuid,
//         version: window.device.version,
//       });
//     }
//   }, []);

//   const handleLogin = async () => {
//     if (!deviceInfo) {
//       alert('Device information not available');
//       return;
//     }

//     try {
//       await new Promise((resolve, reject) => {
//         Meteor.loginWithPassword(email, pin, (err) => {
//           if (err) reject(err);
//           else resolve();
//         });
//       });
//       alert('Login successful!');
//       navigate('/dashboard');
//     } catch (err) {
//       console.error('Login Error:', err);
//       alert(`Login failed: ${err.reason}`);
//     }
//   };

//   return (
//     <div className="min-h-screen flex flex-col items-center justify-center p-4">
//       <button
//         onClick={() => navigate('/')}
//         className="absolute top-4 left-4 flex items-center text-gray-600 hover:text-blue-600 transition-colors"
//       >
//         <FiArrowLeft className="mr-1" /> Back
//       </button>

//       <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-lg">
//         <div>
//           <h2 className="text-3xl font-bold text-center text-gray-900">Welcome Back</h2>
//           <p className="mt-2 text-center text-gray-600">Sign in to your account</p>
//         </div>

//         <div className="space-y-6">
//           <div>
//             <label className="text-sm font-medium text-gray-700">Email</label>
//             <div className="mt-1 relative">
//               <FiMail className="absolute top-3 left-3 text-gray-400" />
//               <input
//                 type="email"
//                 value={email}
//                 onChange={(e) => setEmail(e.target.value)}
//                 className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
//                 placeholder="Enter your email"
//               />
//             </div>
//           </div>

//           <div>
//             <label className="text-sm font-medium text-gray-700">PIN</label>
//             <div className="mt-1 relative">
//               <FiLock className="absolute top-3 left-3 text-gray-400" />
//               <input
//                 type="password"
//                 value={pin}
//                 onChange={(e) => setPin(e.target.value)}
//                 className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
//                 placeholder="Enter your PIN"
//               />
//             </div>
//           </div>

//           <button
//             onClick={handleLogin}
//             className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform transition hover:scale-105"
//           >
//             Sign In
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };


import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiArrowLeft } from 'react-icons/fi';
import { Meteor } from 'meteor/meteor';

export const LoginPage = ({ deviceDetails }) => {
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

  const handleLogin = async (e) => {
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
        Meteor.loginWithPassword(email, pin, (err) => {
          if (err) {
            console.error('Login Error:', err);
            reject(err);
          } else {
            resolve();
          }
        });
      });

      // // Store device details in user's profile if needed
      // await Meteor.callAsync('users.updateDeviceDetails', {
      //   deviceId: deviceDetails,
      //   lastLogin: new Date()
      // });

      navigate('/dashboard');
    } catch (err) {
      setError(err.reason || 'Login failed. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <button
        onClick={() => navigate('/')}
        className="absolute top-4 left-4 flex items-center text-gray-600 hover:text-blue-600 transition-colors"
      >
        <FiArrowLeft className="mr-1" /> Back
      </button>

      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Welcome Back</h2>
          <p className="mt-2 text-gray-600">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="text-red-600 text-sm text-center bg-red-100 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <div className="mt-1 relative">
              <FiMail className="absolute top-3 left-3 text-gray-400" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your email"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label htmlFor="pin" className="block text-sm font-medium text-gray-700">
              PIN
            </label>
            <div className="mt-1 relative">
              <FiLock className="absolute top-3 left-3 text-gray-400" />
              <input
                id="pin"
                type="password"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your PIN"
                maxLength={6}
                minLength={4}
                pattern="[0-9]*"
                inputMode="numeric"
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full py-3 px-4 rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ease-in-out transform hover:scale-[1.02]"
          >
            {isLoggingIn ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing In...
              </div>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
