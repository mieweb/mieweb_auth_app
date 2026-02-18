import React, { useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { Layout } from './components/Layout';
import { Trash2 } from 'lucide-react';
import { Input, Textarea, Button, Alert, AlertDescription, Card, CardHeader, CardTitle, CardContent } from '@mieweb/ui';

export const DeleteAccountPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    reason: ''
  });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Don't trim on keystroke - it removes spaces while typing, confusing users
    // Trimming is done in handleSubmit before API call
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!formData.email || !emailRegex.test(formData.email)) {
      setStatus({
        type: 'error',
        message: 'Please enter a valid email address.'
      });
      return false;
    }
    
    if (formData.email.length < 3 || formData.email.length > 254) {
      setStatus({
        type: 'error',
        message: 'Email must be between 3 and 254 characters.'
      });
      return false;
    }
    
    if (!formData.username || formData.username.length < 1 || formData.username.length > 100) {
      setStatus({
        type: 'error',
        message: 'Username must be between 1 and 100 characters.'
      });
      return false;
    }
    
    if (formData.reason && formData.reason.length > 1000) {
      setStatus({
        type: 'error',
        message: 'Reason must be less than 1000 characters.'
      });
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);

    // Trim email and username before sending to API
    const trimmedData = {
      email: formData.email.trim(),
      username: formData.username.trim(),
      reason: formData.reason
    };

    try {
      await Meteor.callAsync('users.requestAccountDeletion', trimmedData);
      setStatus({
        type: 'success',
        message: 'Account deletion request submitted successfully. You will receive a confirmation email shortly.'
      });
      setFormData({ email: '', username: '', reason: '' });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error.reason || 'Failed to submit deletion request. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Trash2 className="h-6 w-6 text-red-600 mr-3" />
              <CardTitle>Delete Your Account</CardTitle>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Request permanent deletion of your account and associated data
            </p>
          </CardHeader>

          <CardContent>
            {status.message && (
              <div className="mb-6">
                <Alert variant={status.type === 'success' ? 'success' : 'danger'}>
                  <AlertDescription>{status.message}</AlertDescription>
                </Alert>
              </div>
            )}

            <div className="mb-6">
              <Alert variant="warning">
                <AlertDescription>
                  <h3 className="text-sm font-medium mb-2">Important Information</h3>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>Account deletion is permanent and cannot be undone</li>
                    <li>All your data, including notification history, will be deleted</li>
                    <li>You will receive a confirmation email before deletion</li>
                    <li>Processing may take up to 30 days</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="Email Address"
                type="email"
                id="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="your.email@example.com"
                helperText="The email address associated with your account"
              />

              <Input
                label="Username"
                type="text"
                id="username"
                name="username"
                required
                value={formData.username}
                onChange={handleChange}
                placeholder="Your username"
              />

              <Textarea
                label="Reason for Deletion (Optional)"
                id="reason"
                name="reason"
                rows={4}
                value={formData.reason}
                onChange={handleChange}
                placeholder="Please tell us why you're deleting your account (optional)"
                helperText="Your feedback helps us improve our service"
              />

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <Button variant="ghost" onClick={() => window.location.href = '/'} type="button">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  disabled={isSubmitting}
                  isLoading={isSubmitting}
                  loadingText="Submitting..."
                  leftIcon={<Trash2 className="h-4 w-4" />}
                >
                  Request Account Deletion
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};
