import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiAlertCircle } from 'react-icons/fi';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { Fingerprint as FingerprintIcon } from 'lucide-react';

export const LoginPage = ({ deviceDetails }) => {
  const [email, setEmail] = useState(() => localStorage.getItem('lastLoggedInEmail') || '');
  const [isReturningUser, setIsReturningUser] = useState(() => !!localStorage.getItem('lastLoggedInEmail'));
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const navigate = useNavigate();
  const isBiometricAvailable = true;
  console.log(`biometrics in login page ${isBiometricAvailable}`);

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

  // Function to check registration status
  const checkRegistrationStatus = async (userId, emailAddress) => {
    setCheckingStatus(true);

    try {
      console.log('### Log: Checking registration status for user');
      const result = await Meteor.callAsync('users.checkRegistrationStatus', {
        userId,
        email: emailAddress
      });

      console.log('### Log: Registration status result:', result);

      if (!result || !result.status) {
        throw new Error('Failed to retrieve registration status');
      }

      console.log(result)
      if (result.status !== 'approved') {
        console.log('### Log: User registration is pending approval');
        setError('Your account is pending approval by an administrator.');
        navigate('/pending-registration');
        return false;
      }

      console.log('### Log: User registration is approved');
      return true;
    } catch (err) {
      console.error('### Log ERROR: Registration status check failed', err);
      setError(err.reason || err.message || 'Failed to verify account status');
      return false;
    } finally {
      setCheckingStatus(false);
    }
  };

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
      // First attempt login to get user credentials
      let userId;
      try {
        await new Promise((resolve, reject) => {
          Meteor.loginWithPassword(email, pin, (err) => {
            if (err) {
              console.error('Login Error:', err);
              reject(err);
            } else {
              userId = Meteor.userId();
              resolve();
            }
          });
        });
      } catch (err) {
        setError(err.reason || 'Login failed. Please try again.');
        setIsLoggingIn(false);
        return;
      }

      // Now check registration status
      const isApproved = await checkRegistrationStatus(userId, email);

      if (isApproved) {
        // Set user profile in session and proceed to dashboard
        Session.set('userProfile', {
          email: email,
          _id: userId
        });

        localStorage.setItem('lastLoggedInEmail', email);
        navigate('/dashboard');
      } else {
        // If not approved, logout the user since we don't want them to remain logged in
        Meteor.logout();
      }
    } catch (err) {
      console.error('### Log ERROR during login flow:', err);
      setError(err.reason || err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleBiometricLogin = async () => {
    console.log("handle with biometric")
    const biometricUserId = localStorage.getItem('biometricUserId');
    console.log("biometric id", biometricUserId)
    if (!biometricUserId) {
      console.log("no biometric")
      setError('No biometric credentials found. Please register first.');
      navigate('/biometricModal');
      return;
    }

    console.log("yes biopmrtri")

    setIsLoggingIn(true);
    setError('');

    try {
      console.log("inside try")
      if (Fingerprint) {
        console.log("fingerprint")

        await new Promise((resolve, reject) => {
          Fingerprint.loadBiometricSecret(
            {
              description: 'Scan your fingerprint to login',
              disableBackup: true,
            },
            async () => {
              try {
                // Use the retrieved secret to login
                const result = await Meteor.callAsync('users.loginWithBiometric', biometricUserId);

                if (!result || !result._id) {
                  throw new Error('Biometric authentication failed');
                }

                // Check registration status
                const isApproved = await checkRegistrationStatus(result._id, result.email);

                console.log("is approved", isApproved)

                if (isApproved) {
                  // Set user profile in session
                  Session.set('userProfile', {
                    email: result.email,
                    username: result.username,
                    _id: result._id,
                  });

                  navigate('/dashboard');
                }
                resolve();
              } catch (err) {
                reject(err);
              }
            },
            (err) => {
              reject(err || new Error('Fingerprint authentication failed'));
            }
          );
        });
      } else {
        throw new Error('Fingerprint authentication is not available.');
      }
    } catch (err) {
      console.error('### Log ERROR during biometric login:', err);
      setError(err.message || err.reason || 'Biometric login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            {isReturningUser ? 'Welcome Back!' : 'Welcome Back'}
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {isReturningUser ? email : 'Sign in to your account'}
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="flex items-center text-red-700 dark:text-red-300 text-sm text-center bg-red-100 dark:bg-red-900/30 p-4 rounded-xl border border-red-300 dark:border-red-800">
              <FiAlertCircle className="mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <div className="mt-1 relative">
              <FiMail className="absolute top-3 left-3 text-blue-600 dark:text-blue-400" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 focus:border-blue-500 dark:focus:border-blue-400 transition-all"
                placeholder="Enter your email"
                autoComplete="email"
                disabled={isLoggingIn || checkingStatus}
              />
            </div>
            {isReturningUser && (
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('lastLoggedInEmail');
                  setEmail('');
                  setIsReturningUser(false);
                }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 font-medium"
              >
                Not you? Use a different account
              </button>
            )}
          </div>

          <div>
            <label htmlFor="pin" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              PIN
            </label>
            <div className="mt-1 relative">
              <FiLock className="absolute top-3 left-3 text-blue-600 dark:text-blue-400" />
              <input
                id="pin"
                type="password"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 focus:border-blue-500 dark:focus:border-blue-400 transition-all"
                placeholder="Enter your PIN"
                maxLength={6}
                minLength={4}
                pattern="[0-9]*"
                inputMode="numeric"
                autoComplete="current-password"
                disabled={isLoggingIn || checkingStatus}
              />
            </div>
          </div>

          {isBiometricAvailable && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={isLoggingIn || checkingStatus}
                className="flex items-center space-x-2 py-3 px-6 rounded-xl text-white font-semibold bg-green-600 hover:bg-green-700 active:bg-green-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-98"
              >
                <FingerprintIcon />
                <span>Login with Biometrics</span>
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoggingIn || checkingStatus}
            className="w-full py-3 px-4 rounded-xl text-white font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ease-in-out shadow-lg hover:shadow-xl active:scale-98"
          >
            {isLoggingIn || checkingStatus ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {checkingStatus ? 'Verifying Account...' : 'Signing In...'}
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