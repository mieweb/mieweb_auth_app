import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { openSupportLink } from '../../../../utils/openExternal';
import { User } from 'lucide-react';
import { motion } from 'framer-motion';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import BiometricRegistrationModal from './Modal/BiometricRegistrationModal';
import { Random } from 'meteor/random';
import { Input, Button, Alert, AlertDescription } from '@mieweb/ui';

export const RegistrationPage = ({ deviceDetails }) => {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    firstName: '',
    lastName: '',
    pin: ''
  });
  const [loading, setLoading] = useState(false);
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [registeredUser, setRegisteredUser] = useState(null);
  const [error, setError] = useState(null);
  const [registrationStatus, setRegistrationStatus] = useState(null);
  const [showPendingScreen, setShowPendingScreen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    console.log('### Log Step 4 : RegistrationPage mounted');
    return () => console.log('### Log: RegistrationPage unmounted');
  }, []);

  const inputFields = useMemo(() => [
    { name: 'email', type: 'email', label: 'Email', placeholder: 'Enter your email' },
    { name: 'username', type: 'text', label: 'Username', placeholder: 'Enter your username', autoCapitalize: 'none' },
    { name: 'firstName', type: 'text', label: 'First Name', placeholder: 'First Name' },
    { name: 'lastName', type: 'text', label: 'Last Name', placeholder: 'Last Name' },
    { 
      name: 'pin', 
      type: 'password', 
      label: 'PIN',
      placeholder: 'Create a PIN (4-6 digits)',
      minLength: "4",
      maxLength: "6",
      pattern: "[0-9]*",
      inputMode: "numeric"
    }
  ], []);

 const handleSubmit = async (e) => {
  e.preventDefault();
  console.log('### Log Step 4.1 : Form submission initiated');
  
  if (loading) return;

  setError(null);
  setLoading(true);

  try {
    const sessionDeviceInfo = Session.get('capturedDeviceInfo');
    const fcmDeviceToken = Session.get('deviceToken');
    console.log('### Log Step 4.2: Session data:', JSON.stringify({
      sessionDeviceInfo,
      fcmDeviceToken
    }));

    if (!sessionDeviceInfo?.uuid || !fcmDeviceToken) {
      throw new Error('Device information or FCM token not available');
    }

    if (sessionDeviceInfo.uuid !== deviceDetails) {
      throw new Error('Device UUID mismatch');
    }

    const biometricSecret = Random.secret(32);
    console.log('### Log Step 4.3: Generated biometric secret');

    console.log('### Log Step 4.4: Calling users.register method...');
    const registerUser = await Meteor.callAsync('users.register', {
      ...formData,
      sessionDeviceInfo,
      fcmDeviceToken,
      biometricSecret
    });

    console.log('### Log Step 4.5: Registration response:', JSON.stringify(registerUser));

    // Handle secondary device approval flow
    if (registerUser?.userAction && registerUser.isSecondaryDevice) {
      console.log('### Log Step 4.5.1: Secondary device registration, userAction:', registerUser.userAction);

      if (registerUser.userAction === 'approve') {
        // Approved by primary device - proceed biometric modal or app flow
        const userPayload = {
          userId: registerUser.userId,
          email: formData.email,
          username: formData.username,
          biometricSecret,
          isFirstDevice: false,
          registrationStatus: 'approved'
        };
        setRegisteredUser(userPayload);

        setTimeout(() => {
          console.log('### Opening biometric modal for secondary device after approval');
          setShowBiometricModal(true);
        }, 0);

      } else if (registerUser.userAction === 'reject') {
        setError('Your secondary device registration was rejected by the primary device.');
      } else if (registerUser.userAction === 'timeout') {
        setError('Secondary device approval request timed out. Please try again later.');
      }
      // Stop further flow here
      return;
    }

    // Handle first device / regular flow
    if (registerUser?.userId) {
      console.log('### Log Step 4.6: Registration successful');

      const userPayload = {
        userId: registerUser.userId,
        email: formData.email,
        username: formData.username,
        biometricSecret,
        isFirstDevice: registerUser.isFirstDevice,
        registrationStatus: registerUser.registrationStatus
      };

      setRegisteredUser(userPayload);

      // Open biometric modal immediately after successful registration
      setTimeout(() => {
        console.log('### Opening biometric modal for first device');
        setShowBiometricModal(true);
      }, 0);

    } else if (registerUser?.registrationStatus) {
      const regStatus = registerUser.registrationStatus;

      if (regStatus === 'pending') {
        console.log('### Log Step 4.8: First device registration pending approval');
        setRegistrationStatus('pending');
        setShowPendingScreen(true);

      } else if (regStatus === 'approved') {
        console.log('### Log Step 4.9: Registration fully completed, redirecting to login');
        navigate('/login');

      } else if (regStatus === 'rejected') {
        console.log('### Log Step 4.10: Registration rejected, redirecting to rejection screen or showing error');
        setError('Your registration has been rejected. Please contact support.');
        // Optionally navigate('/rejectedRegistration');

      } else {
        // Fallback if user data is missing or unknown status
        console.log('### Log Step 4.11: Unknown registration status, redirecting to login');
        navigate('/login');
      }
    } else {
      // Fallback if no userId or registrationStatus at all
      console.log('### Log Step 4.12: No valid user data found after registration, redirecting to login');
      navigate('/login');
    }

  } catch (err) {
    console.error('### Log Step ERROR:', err);
    setError(err.reason || err.message || 'Registration failed');
  } finally {
    setLoading(false);
  }
};




  const handleBiometricComplete = useCallback((wasSuccessful) => {
  console.log('### Log Step 4.7: Biometric completion:', wasSuccessful);
  setShowBiometricModal(false);
 
    //Now check registration status after biometric handling is done
  if (registeredUser) {
    if (registeredUser.isFirstDevice && registeredUser.registrationStatus === 'pending') {
      console.log('### Log Step 4.8: First device registration pending approval');
        setRegistrationStatus('pending');
        setShowPendingScreen(true);
      } else {
        console.log('### Log Step 4.9: Registration fully completed, redirecting to login');
        navigate('/login');
      }
    } else {
      // Fallback if user data is missing
      console.log('### Log Step 4.10: No user data found, redirecting to login');
      navigate('/login');
    }
  }, [navigate, registeredUser]);

  const goToLogin = useCallback(() => {
    navigate('/login');
  }, [navigate]);

  // If showing the pending screen
  if (showPendingScreen) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }}
        className="min-h-screen flex flex-col items-center justify-center p-4"
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="max-w-md w-full space-y-8 bg-card text-card-foreground p-8 rounded-2xl shadow-lg"
        >
          <div className="text-center space-y-4">
            <motion.h2 
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              className="text-3xl font-bold text-foreground"
            >
              Registration Pending
            </motion.h2>
            <div className="flex justify-center">
              <div className="animate-pulse w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="text-3xl text-primary" />
              </div>
            </div>
            <p className="text-muted-foreground">
              Since this is your first device registered with us, your account needs to be approved by an administrator.
            </p>
            <p className="text-muted-foreground">
              You will receive a notification once your registration has been processed.
            </p>
          </div>

          <Button
            onClick={goToLogin}
            fullWidth
          >
            Back to Login
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  // Regular registration form
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col items-center justify-center p-4"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="max-w-md w-full space-y-8 bg-card text-card-foreground p-8 rounded-2xl shadow-lg"
      >
        <div className="text-center space-y-2">
          <motion.h2 
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            className="text-3xl font-bold text-foreground"
          >
            Create Account
          </motion.h2>
          <p className="text-muted-foreground">Join our community today</p>
        </div>

        {error && (
          <Alert variant="danger">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inputFields.map((field, index) => (
              <motion.div
                key={field.name}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className={field.name === 'email' ? 'md:col-span-2' : ''}
              >
                <Input
                  name={field.name}
                  type={field.type}
                  placeholder={field.placeholder}
                  required
                  value={formData[field.name]}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    [e.target.name]: e.target.value
                  }))}
                  label={field.label}
                  pattern={field.pattern}
                  inputMode={field.inputMode}
                  minLength={field.minLength}
                  maxLength={field.maxLength}
                  autoCapitalize={field.autoCapitalize}
                />
              </motion.div>
            ))}
          </div>

          <Button
            type="submit"
            disabled={loading}
            fullWidth
            isLoading={loading}
            loadingText="Creating Account..."
          >
            Create Account
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Need help?{' '}
            <Button
              variant="link"
              type="button"
              onClick={() => openSupportLink()}
            >
              Contact Support
            </Button>
          </div>
        </form>
      </motion.div>

      {showBiometricModal && (
        <BiometricRegistrationModal
          key={Date.now()}
          isOpen={showBiometricModal}
          onClose={() => setShowBiometricModal(false)}
          userData={registeredUser}
          onComplete={handleBiometricComplete}
        />
      )}
    </motion.div>
  );
};