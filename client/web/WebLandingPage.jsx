import React from 'react';
import { Github, Shield, Smartphone, Lock, Zap, CheckCircle } from 'lucide-react';
import { Layout } from './components/Layout';

export const WebLandingPage = () => {
  return (
    <Layout>
      {/* Hero Section */}
      <div className="relative bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="relative z-10 pb-8 bg-white sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
            <svg
              className="hidden lg:block absolute right-0 inset-y-0 h-full w-48 text-white transform translate-x-1/2"
              fill="currentColor"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polygon points="50,0 100,0 50,100 0,100" />
            </svg>

            <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
              <div className="sm:text-center lg:text-left">
                <h1 className="text-2xl tracking-tight font-extrabold text-gray-900 sm:text-3xl md:text-4xl">
                  <span className="block xl:inline">Secure Authentication</span>{' '}
                  <span className="block text-blue-600 xl:inline">at your fingertips</span>
                </h1>
                <p className="mt-3 text-sm text-gray-500 sm:mt-5 sm:text-base sm:max-w-xl sm:mx-auto md:mt-5 md:text-lg lg:mx-0">
                  Experience the next generation of security with the Mieweb Auth mobile app. 
                  Biometric verification, push notifications, and seamless login management all in one place.
                </p>
                
                <div className="mt-8 sm:mt-10">
                  <p className="text-sm font-semibold text-gray-500 tracking-wider uppercase mb-4">
                    Download the App
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 sm:justify-center lg:justify-start">
                    {/* App Store Button */}
                    <a href="#" className="flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-black hover:bg-gray-800 transition-colors md:py-4 md:text-lg md:px-8 shadow-lg">
                      <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.11-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                      <div className="text-left">
                        <div className="text-xs">Download on the</div>
                        <div className="text-sm font-bold font-sans -mt-1">App Store</div>
                      </div>
                    </a>

                    {/* Play Store Button */}
                    <a href="#" className="flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-black hover:bg-gray-800 transition-colors md:py-4 md:text-lg md:px-8 shadow-lg">
                      <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                      </svg>
                      <div className="text-left">
                        <div className="text-xs">GET IT ON</div>
                        <div className="text-sm font-bold font-sans -mt-1">Google Play</div>
                      </div>
                    </a>
                  </div>
                  
                  <div className="mt-6 flex items-center sm:justify-center lg:justify-start space-x-4">
                    <a href="https://github.com/mieweb/mieweb_auth_app" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-gray-900 flex items-center transition-colors">
                      <Github className="w-4 h-4 mr-1" />
                      View Source Code
                    </a>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
        <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2 bg-gray-50 flex items-center justify-center">
          {/* Abstract Phone Mockup / Illustration */}
          <div className="relative w-full h-64 sm:h-72 md:h-96 lg:h-full flex items-center justify-center">
             <div className="w-64 h-96 bg-gray-900 rounded-[3rem] border-8 border-gray-800 shadow-2xl flex flex-col overflow-hidden relative transform rotate-[-5deg] hover:rotate-0 transition-transform duration-500">
                <div className="absolute top-0 w-full h-6 bg-gray-800 z-20 flex justify-center">
                   <div className="w-20 h-4 bg-black rounded-b-xl"></div>
                </div>
                <div className="flex-1 bg-white relative overflow-hidden">
                   {/* Mock App UI */}
                   <div className="p-6 flex flex-col h-full">
                      <div className="mt-8 mb-6">
                         <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4 overflow-hidden">
                            <img src="/logo.png" alt="App Logo" className="w-12 h-12" />
                         </div>
                         <h3 className="text-xl font-bold text-gray-900">Welcome Back</h3>
                         <p className="text-sm text-gray-500">Please authenticate to continue</p>
                      </div>
                      <div className="space-y-4">
                         <div className="h-12 bg-gray-100 rounded-lg w-full animate-pulse"></div>
                         <div className="h-12 bg-blue-600 rounded-lg w-full shadow-lg flex items-center justify-center text-white font-medium">
                            Login
                         </div>
                      </div>
                      <div className="mt-auto flex justify-center">
                         <div className="w-12 h-12 border-2 border-blue-500 rounded-full flex items-center justify-center">
                            <Smartphone className="w-6 h-6 text-blue-500" />
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-gray-50 overflow-hidden lg:py-24">
        <div className="relative max-w-xl mx-auto px-4 sm:px-6 lg:px-8 lg:max-w-7xl">
          <div className="relative">
            <h2 className="text-center text-xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-2xl">
              Why Choose Mieweb Auth?
            </h2>
            <p className="mt-4 max-w-3xl mx-auto text-center text-base text-gray-500">
              A complete authentication solution designed for modern mobile applications.
            </p>
          </div>

          <div className="relative mt-12 lg:mt-24 lg:grid lg:grid-cols-3 lg:gap-8">
            <div className="mt-10 lg:mt-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white mx-auto">
                <Lock className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="mt-5 text-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Bank-Grade Security</h3>
                <p className="mt-2 text-base text-gray-500">
                  Your data is protected with state-of-the-art encryption and security protocols.
                </p>
              </div>
            </div>

            <div className="mt-10 lg:mt-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white mx-auto">
                <Zap className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="mt-5 text-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Lightning Fast</h3>
                <p className="mt-2 text-base text-gray-500">
                  Optimized performance ensures your users never have to wait to log in.
                </p>
              </div>
            </div>

            <div className="mt-10 lg:mt-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white mx-auto">
                <CheckCircle className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="mt-5 text-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Easy Integration</h3>
                <p className="mt-2 text-base text-gray-500">
                  Simple API and SDKs make it easy to add authentication to any app.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
