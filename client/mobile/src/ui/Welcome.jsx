import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLogIn, FiUserPlus } from 'react-icons/fi';
import { ShieldCheck } from 'lucide-react';

export const WelcomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-gray-900 via-indigo-950 to-gray-900">
      <div className="max-w-sm w-full space-y-10">
        {/* Brand */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-indigo-500/20 rounded-3xl flex items-center justify-center backdrop-blur-sm border border-indigo-400/20">
            <ShieldCheck className="h-10 w-10 text-indigo-300" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            MieSecure
          </h1>
          <p className="text-indigo-300/80 text-sm">Your secure mobile companion</p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/login')}
            className="group w-full flex justify-center items-center gap-2 px-4 py-3.5 text-base font-semibold rounded-2xl text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-500/30 transition-all active:scale-[0.98]"
          >
            <FiLogIn className="h-5 w-5" /> Sign In
          </button>

          <button
            onClick={() => navigate('/register')}
            className="group w-full flex justify-center items-center gap-2 px-4 py-3.5 text-base font-semibold rounded-2xl text-indigo-300 border border-indigo-400/30 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all active:scale-[0.98]"
          >
            <FiUserPlus className="h-5 w-5" /> Create Account
          </button>
        </div>
      </div>
    </div>
  );
};
