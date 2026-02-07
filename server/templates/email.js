// HTML templates for approval/rejection responses

export const successTemplate = () => `
<!DOCTYPE html>
<html>
<head>
  <title>User Approved</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      text-align: center;
    }
    .success-message {
      background-color: #4CAF50;
      color: white;
      padding: 20px;
      border-radius: 5px;
      margin-top: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      margin-bottom: 10px;
    }
    p {
      font-size: 16px;
    }
  </style>
</head>
<body>
  <div class="success-message">
    <h1>Approval Successful</h1>
    <p>User has been approved.</p>
    <p>Their device is now activated and they can use the application.</p>
    <p>Thank you for your response.</p>
  </div>
</body>
</html>
`;

export const errorTemplate = (reason = 'unknown') => {
  // Map reason codes to user-friendly messages
  const errorMessages = {
    'expired': {
      title: 'Token Expired',
      message: 'The approval token has expired.',
      details: 'Please request a new approval link from the system administrator.'
    },
    'user_not_found': {
      title: 'User Not Found',
      message: 'The user associated with this approval token was not found.',
      details: 'This may occur if the user registered a new account after this link was generated. Please contact the system administrator for assistance.'
    },
    'invalid_token': {
      title: 'Invalid Token',
      message: 'The approval token is invalid or does not exist.',
      details: 'Please contact the system administrator for a new approval link.'
    },
    'server_error': {
      title: 'Internal Server Error',
      message: 'An internal server error occurred while processing your request.',
      details: 'Please try again later or contact the system administrator for assistance.'
    },
    'unknown': {
      title: 'Invalid Request',
      message: 'This link is invalid or has expired.',
      details: 'Please contact the system administrator for assistance.'
    }
  };

  const error = errorMessages[reason] || errorMessages['unknown'];

  return `
<!DOCTYPE html>
<html>
<head>
  <title>${error.title}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      text-align: center;
    }
    .error-message {
      background-color: #f44336;
      color: white;
      padding: 20px;
      border-radius: 5px;
      margin-top: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      margin-bottom: 10px;
    }
    p {
      font-size: 16px;
      margin: 10px 0;
    }
    .error-details {
      font-size: 14px;
      margin-top: 15px;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="error-message">
    <h1>${error.title}</h1>
    <p><strong>${error.message}</strong></p>
    <p class="error-details">${error.details}</p>
  </div>
</body>
</html>
`;
};

export const rejectionTemplate = () => `
<!DOCTYPE html>
<html>
<head>
  <title>User Rejected</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      text-align: center;
    }
    .reject-message {
      background-color: #f44336;
      color: white;
      padding: 20px;
      border-radius: 5px;
      margin-top: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      margin-bottom: 10px;
    }
    p {
      font-size: 16px;
    }
  </style>
</head>
<body>
  <div class="reject-message">
    <h1>User Rejected</h1>
    <p>User's device has been rejected.</p>
    <p>They will not be able to use the application with this device.</p>
    <p>Thank you for your response.</p>
  </div>
</body>
</html>
`;

export const previouslyUsedTemplate = () => `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Action Already Taken</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              text-align: center;
            }
            .info-message {
              background-color: #2196F3;
              color: white;
              padding: 20px;
              border-radius: 5px;
              margin-top: 30px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 {
              margin-bottom: 10px;
            }
            p {
              font-size: 16px;
            }
          </style>
        </head>
        <body>
          <div class="info-message">
            <h1>Action Already Taken</h1>
            <p>This approval/rejection link has already been used.</p>
            <p>The user's status was previously set. </strong></p>
            <p>No further action is needed.</p>
          </div>
        </body>
        </html>
      `;