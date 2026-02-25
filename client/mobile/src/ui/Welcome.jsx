import React from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, UserPlus, ShieldCheck } from "lucide-react";
import { Button } from "@mieweb/ui";

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
            MIE Auth
          </h1>
          <p className="text-indigo-300/80 text-sm">
            Your secure mobile companion
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={() => navigate("/login")}
            className="w-full gap-2 py-3.5 text-base font-semibold rounded-2xl shadow-lg shadow-indigo-500/30 active:scale-[0.98]"
          >
            <LogIn className="h-5 w-5" /> Sign In
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate("/register")}
            className="w-full gap-2 py-3.5 text-base font-semibold rounded-2xl text-indigo-300 border-indigo-400/30 bg-white/5 backdrop-blur-sm hover:bg-white/10 active:scale-[0.98]"
          >
            <UserPlus className="h-5 w-5" /> Create Account
          </Button>
        </div>
      </div>
    </div>
  );
};
