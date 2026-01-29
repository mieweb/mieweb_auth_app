import React, { useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { Layout } from './components/Layout';
import { AlertCircle, CheckCircle, Trash2 } from 'lucide-react';

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
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });
    setIsSubmitting(true);

    try {
      await Meteor.callAsync('users.requestAccountDeletion', formData);
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
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <div className="flex items-center">
              <Trash2 className="h-6 w-6 text-red-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Delete Your Account</h1>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Request permanent deletion of your account and associated data
            </p>
          </div>

          <div className="px-4 py-5 sm:p-6">
            {status.message && (
              <div
                className={`mb-6 p-4 rounded-md flex items-start ${
                  status.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {status.type === 'success' ? (
                  <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm">{status.message}</p>
              </div>
            )}

            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <h3 className="text-sm font-medium text-yellow-800 mb-2">Important Information</h3>
              <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                <li>Account deletion is permanent and cannot be undone</li>
                <li>All your data, including notification history, will be deleted</li>
                <li>You will receive a confirmation email before deletion</li>
                <li>Processing may take up to 30 days</li>
              </ul>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="your.email@example.com"
                />
                <p className="mt-1 text-xs text-gray-500">
                  The email address associated with your account
                </p>
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Your username"
                />
              </div>

              <div>
                <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
                  Reason for Deletion (Optional)
                </label>
                <textarea
                  id="reason"
                  name="reason"
                  rows="4"
                  value={formData.reason}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Please tell us why you're deleting your account (optional)"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Your feedback helps us improve our service
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <a
                  href="/"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </a>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Submitting...' : 'Request Account Deletion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
};
