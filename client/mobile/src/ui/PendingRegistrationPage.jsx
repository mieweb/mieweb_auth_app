export const PendingRegistrationPage = () => {
    return (
      <div className="pending-registration-container">
        <h1>Registration Pending</h1>
        <p>
          Since this is your first device registration, your account needs to be approved by an administrator.
          You will receive a notification once your registration has been processed.
        </p>
        <p>
          Thank you for your patience.
        </p>
        <button onClick={() => navigate('/login')}>
          Back to Login
        </button>
      </div>
    );
  };