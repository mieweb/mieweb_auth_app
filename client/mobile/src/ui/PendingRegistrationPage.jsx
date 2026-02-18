import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { openSupportLink } from '../../../../utils/openExternal';
import { Card, CardContent, Button } from '@mieweb/ui';

const PendingRegistrationPage = () => {
  const location = useLocation();
  const { message, approvalType } = location.state || {
    message: 'Your registration is pending approval.',
    approvalType: 'admin'
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="text-center space-y-6">
          <h2 className="text-2xl font-bold">Registration Pending</h2>
        
          <div>
            {approvalType === 'admin' ? (
              <svg 
                className="mx-auto h-16 w-16 text-yellow-500" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
            ) : (
              <svg 
                className="mx-auto h-16 w-16 text-blue-500" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" 
                />
              </svg>
            )}
          </div>
        
          <p className="text-muted-foreground">{message}</p>
        
          <p className="text-sm text-muted-foreground">
            {approvalType === 'admin' 
              ? 'An administrator will review your request shortly.' 
              : 'Your email verification is being processed.'}
          </p>
        
          <div className="border-t border-border pt-4">
            <div className="flex flex-col space-y-3">
              <Button variant="link" as={Link} to="/login">
                Return to Home
              </Button>
            
              <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
                Refresh Status
              </Button>
            
              <Button variant="ghost" size="sm" onClick={() => openSupportLink()}>
                Contact Support
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-8 text-sm text-muted-foreground">
        <p>
          If you believe this is an error, please contact our support team.
        </p>
      </div>
    </div>
  );
};

export default PendingRegistrationPage;