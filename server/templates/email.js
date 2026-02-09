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

export const pinResetEmailTemplate = (resetLink, username) => `
<!DOCTYPE html>
<html>
<head>
  <title>Reset Your PIN</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #4F46E5;
      margin-bottom: 10px;
    }
    .content {
      margin-bottom: 30px;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background: linear-gradient(to right, #4F46E5, #3B82F6);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      text-align: center;
      margin: 20px 0;
    }
    .button:hover {
      opacity: 0.9;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      font-size: 14px;
      color: #666;
      text-align: center;
    }
    .warning {
      background-color: #FEF3C7;
      border-left: 4px solid #F59E0B;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Reset Your PIN</h1>
    </div>
    <div class="content">
      <p>Hello ${username || 'User'},</p>
      <p>We received a request to reset your PIN for MIEWeb Auth. Click the button below to set a new PIN:</p>
      <div style="text-align: center;">
        <a href="${resetLink}" class="button">Reset PIN</a>
      </div>
      <div class="warning">
        <strong>⚠️ Security Notice:</strong>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>This link will expire in 24 hours</li>
          <li>If you didn't request this, please ignore this email</li>
          <li>Your current PIN will remain active until you complete the reset</li>
        </ul>
      </div>
      <p>For security reasons, this link can only be used once. If you need another reset link, please request a new one from the app.</p>
    </div>
    <div class="footer">
      <p>This is an automated message from MIEWeb Auth.</p>
      <p>If you have questions, please contact your system administrator.</p>
    </div>
  </div>
</body>
</html>
`;

export const pinResetSuccessTemplate = () => `
<!DOCTYPE html>
<html>
<head>
  <title>PIN Reset Successful</title>
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
    <h1>✓ PIN Reset Successful</h1>
    <p>Your PIN has been successfully updated.</p>
    <p>You can now use your new PIN to sign in to the app.</p>
    <p>Please close this window and return to the app to continue.</p>
  </div>
</body>
</html>
`;