// Example of using the Mieweb Auth Package in a new Meteor app
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Meteor } from 'meteor/meteor';
import { initializeMiewebAuth } from 'meteor/mieweb:auth';

// Option 1: Use the complete packaged app
Meteor.startup(() => {
  // This will render the complete Mieweb Auth app
  initializeMiewebAuth('auth-container');
});

// Option 2: Custom integration with individual components
import { 
  MiewebAuthApp,
  LoginComponent,
  RegistrationComponent,
  useDeviceRegistration,
  captureDeviceInfo
} from 'meteor/mieweb:auth';

const CustomApp = () => {
  const { isRegistered, registrationStatus } = useDeviceRegistration();
  
  React.useEffect(() => {
    if (Meteor.isCordova) {
      captureDeviceInfo();
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold text-center mb-8">
          My App with Mieweb Auth
        </h1>
        
        {registrationStatus === 'registered' ? (
          <MiewebAuthApp />
        ) : registrationStatus === 'pending' ? (
          <div className="text-center">
            <h2 className="text-xl mb-4">Registration Pending</h2>
            <p>Please wait for approval...</p>
          </div>
        ) : (
          <div className="max-w-md mx-auto">
            <RegistrationComponent 
              onSuccess={() => console.log('Registration started')}
              onError={(error) => console.error('Registration error:', error)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Alternative startup for custom app
// Meteor.startup(() => {
//   const container = document.getElementById('react-target');
//   const root = createRoot(container);
//   root.render(<CustomApp />);
// });
