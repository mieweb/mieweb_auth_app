import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, Github, Menu, X } from 'lucide-react';
import { useState } from 'react';

export const Layout = ({ children }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path) => {
    return location.pathname === path ? 'text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-900 font-medium';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.location.href = '/'}>
              <img src="/logo.png" alt="Mieweb Auth Logo" className="w-14 h-14 rounded-lg" />
              <span className="text-lg font-bold text-gray-900">MIEWeb Auth</span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8">
              <Link to="/" className={isActive('/')}>Home</Link>
              <Link to="/send-notification" className={isActive('/send-notification')}>Test it now</Link>
              <Link to="/privacy-policy" className={isActive('/privacy-policy')}>Privacy Policy</Link>
              <Link to="/support" className={isActive('/support')}>Support</Link>
            </nav>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-gray-500 hover:text-gray-900 focus:outline-none"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <Link 
                to="/" 
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link 
                to="/send-notification" 
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Test it now
              </Link>
              <Link 
                to="/privacy-policy" 
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Privacy Policy
              </Link>
              <Link 
                to="/support" 
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Support
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <img src="/logo.png" alt="Mieweb Auth Logo" className="w-12 h-12 rounded-md" />
                <span className="text-xl font-bold">MIEWeb Auth</span>
              </div>
              <p className="text-gray-400 text-sm">
                Secure, seamless, and privacy-focused authentication for your applications.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase mb-4">Resources</h3>
              <ul className="space-y-3">
                <li><Link to="/privacy-policy" className="text-base text-gray-300 hover:text-white">Privacy Policy</Link></li>
                <li><Link to="/support" className="text-base text-gray-300 hover:text-white">Support</Link></li>
                <li><a href="https://github.com/mieweb/mieweb_auth_app" target="_blank" rel="noopener noreferrer" className="text-base text-gray-300 hover:text-white">GitHub</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase mb-4">Connect</h3>
              <div className="flex space-x-6">
                <a href="https://github.com/mieweb/mieweb_auth_app" className="text-gray-400 hover:text-white">
                  <span className="sr-only">GitHub</span>
                  <Github className="h-6 w-6" />
                </a>
              </div>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-800 pt-8 md:flex md:items-center md:justify-between">
            <p className="text-base text-gray-400">
              &copy; {new Date().getFullYear()} MIEWeb Auth. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
