# Account Deletion Information

## For Google Play Console Configuration

When configuring the Google Play Console under "Data safety" → "Account deletion", use the following URL:

**Delete Account URL:**
```
https://your-domain.com/delete-account
```

Replace `your-domain.com` with your actual production domain.

## Features

The account deletion page provides:

1. **User-Friendly Interface**: A web form where users can request account deletion
2. **Email Notifications**: 
   - Admin notification with user details and deletion request
   - User confirmation email acknowledging the request
3. **Data Transparency**: Clear information about what data will be deleted
4. **Processing Timeline**: 30-day processing window as per Google Play requirements

## What Gets Deleted

When an account deletion request is processed, the following data is permanently removed:

- User account and profile information
- Device details and FCM tokens
- Notification history
- Approval tokens
- All associated personal data

## User Access

Users can access the delete account page from:

1. **Direct URL**: `/delete-account`
2. **Privacy Policy Page**: Link in the "Account Deletion" section
3. **Support Page**: Link in the "Account Management" section
4. **Mobile App Profile**: Link in the profile section (for Cordova users)

## Required Information

To request account deletion, users must provide:

- Email address (required)
- Username (required)
- Reason for deletion (optional)

The system verifies that the user exists before processing the deletion request.

## Admin Processing

Admins receive an email notification with all necessary details to process the deletion manually. The email includes:

- Username and email
- User ID
- Reason for deletion (if provided)
- Timestamp of request
- List of data to be deleted

## Notes

- This is a **request** system - actual deletion must be performed manually by admins
- Email configuration (`EMAIL_ADMIN` and `EMAIL_FROM` environment variables) must be set up
- The user receives confirmation that their request has been received
- Processing time: up to 30 days as per Google Play requirements
