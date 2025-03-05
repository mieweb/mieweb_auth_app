import React, { useState } from 'react';
import { Fingerprint as FingerprintIcon, XCircle, CheckCircle } from 'lucide-react';

const BiometricRegistrationModal = ({ isOpen, onClose, userData, onComplete }) => {
  const [status, setStatus] = useState('prompt'); // prompt, success, error
  const [errorMessage, setErrorMessage] = useState('');

  const registerBiometrics = () => {
    setStatus('processing');
    
    // Get unique identifier from user data
    
    const biometricSecret = userData.biometricSecret;
    console.log(`secret used for Biometrics is : ${biometricSecret}`);
    
    Fingerprint.registerBiometricSecret({
      description: "Secure login for your account",
      secret: biometricSecret,
      invalidateOnEnrollment: true,
      disableBackup: true, // always disabled on Android
    }, 
    () => {
      // Success callback
      console.log('biometric success');
      setStatus('success');
      localStorage.setItem('biometricsEnabled', 'true');
      localStorage.setItem('biometricUserId', biometricSecret);
      
      // Auto close after success
      setTimeout(() => {
        onClose();
        onComplete(true);
      }, 3000);
    }, 
    (error) => {
      // Error callback
      setStatus('error');
      setErrorMessage(error.message || "Unable to register biometrics");
      console.error("Biometric registration error:", error);
    });
  };

  const handleSkip = () => {
    onClose();
    onComplete(false);
  };

  const handleRetry = () => {
    setStatus('prompt');
    setErrorMessage('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg w-11/12 max-w-md p-6 text-center">
        {status === 'prompt' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 flex items-center justify-center bg-blue-100 rounded-full">
                <FingerprintIcon className="h-10 w-10 text-blue-500" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">
              Set Up Biometric Login
            </h2>
            <p className="text-gray-600 mb-4">
              Enable fingerprint or face recognition for faster and more secure login
            </p>
            <button
              className="w-full py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600"
              onClick={registerBiometrics}
            >
              Set Up Now
            </button>
            <button
              className="w-full py-2 mt-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              onClick={handleSkip}
            >
              Skip for Now
            </button>
          </>
        )}

        {status === 'processing' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 flex items-center justify-center bg-blue-100 rounded-full animate-pulse">
                <FingerprintIcon className="h-10 w-10 text-blue-500" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              Follow the prompts on your device
            </h2>
            <p className="text-gray-600">
              Please complete the biometric verification on your device
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 flex items-center justify-center bg-green-100 rounded-full">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              Biometric Login Enabled
            </h2>
            <p className="text-gray-600">
              You can now log in using your fingerprint or face recognition
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 flex items-center justify-center bg-red-100 rounded-full">
                <XCircle className="h-10 w-10 text-red-500" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">
              Registration Failed
            </h2>
            <p className="text-gray-600 mb-4">
              {errorMessage}
            </p>
            <button
              className="w-full py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600"
              onClick={handleRetry}
            >
              Try Again
            </button>
            <button
              className="w-full py-2 mt-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              onClick={handleSkip}
            >
              Skip for Now
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default BiometricRegistrationModal;