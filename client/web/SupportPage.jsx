import React from 'react';
import { Github } from 'lucide-react';
import { Layout } from './components/Layout';

export const SupportPage = () => {
  const GITHUB_REPO_URL = 'https://github.com/mieweb/mieweb_auth_app';
  const GITHUB_NEW_ISSUE_URL = `${GITHUB_REPO_URL}/issues/new`;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h1 className="text-2xl font-bold text-gray-900">Support</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              To request help or report a bug, please open an issue on our GitHub repository.
            </p>
          </div>
          
          <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Opening an issue helps us track progress and respond publicly. Please include steps to reproduce and any relevant screenshots.
              </p>

              <a
                href={GITHUB_NEW_ISSUE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Github className="w-5 h-5 mr-2" />
                Open a GitHub Issue
              </a>

              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 rounded-md border border-gray-200 bg-gray-50 p-3 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white border border-gray-200">
                    <Github className="h-5 w-5 text-gray-700" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900">Repository</div>
                    <div className="text-xs text-gray-500 truncate">{GITHUB_REPO_URL}</div>
                  </div>
                </div>
                <div className="text-sm font-medium text-blue-600 shrink-0">View</div>
              </a>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Account Management</h3>
              <p className="text-sm text-gray-600 mb-4">
                Need to delete your account? You can request account deletion and we'll process your request within 30 days.
              </p>
              <a
                href="/delete-account"
                className="text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Request Account Deletion →
              </a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
