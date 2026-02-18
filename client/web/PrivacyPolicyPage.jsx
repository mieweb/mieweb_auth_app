import React from 'react';
import { Layout } from './components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '@mieweb/ui';

export const PrivacyPolicyPage = () => {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Privacy Policy</CardTitle>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>
          </CardHeader>
          <CardContent className="space-y-8">
            
            <section>
              <h2 className="text-lg font-medium text-gray-900 mb-3">Overview</h2>
              <p className="text-gray-600">
                We safeguard user privacy while maintaining the ability to identify individuals who use our Services. We do not support anonymous use of our systems.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium text-gray-900 mb-3">Anonymity</h2>
              <div className="space-y-3 text-gray-600">
                <p>
                  When you use our Services, we may take reasonable steps to determine your identity or, if you are operating through an automated agent, the identity of the individual controlling that agent.
                </p>
                <p>
                  We may deny access to our Services if you or your agents engage in conduct that is harmful to our interests. If your actions violate applicable law (U.S. law by default, others considered as appropriate), we may cooperate with authorities in accordance with the Privacy and Confidentiality provisions below.
                </p>
                <p>
                  Deliberate efforts to obscure identity—including aliases, VPNs, multiple identities, or hidden services—may be treated as misuse and may result in blocking, as such behavior suggests an intent to avoid accountability and creates unacceptable risk.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-medium text-gray-900 mb-3">Privacy and Confidentiality</h2>
              <p className="text-gray-600">
                Once identity is established, the protection of your personal information is a priority. We will not disclose data linked to your identity without your direction, unless required by a valid court order and subject to your opportunity to contest that order.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium text-gray-900 mb-3">Ownership of Data</h2>
              <div className="space-y-3 text-gray-600">
                <p>
                  Data you submit to our Services remains your property. We do not claim ownership and will not use it without your permission.
                </p>
                <p>
                  Metadata generated through your use of our Services is owned by us and is handled in accordance with the Privacy and Confidentiality provisions above.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-medium text-gray-900 mb-3">Account Deletion</h2>
              <div className="space-y-3 text-gray-600">
                <p>
                  You have the right to request deletion of your account and associated data at any time.
                </p>
                <p>
                  To request account deletion, please visit our{' '}
                  <a href="/delete-account" className="text-blue-600 hover:text-blue-800 underline">
                    account deletion page
                  </a>
                  . Your request will be processed within 30 days, and you will receive confirmation when complete.
                </p>
              </div>
            </section>

          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};
