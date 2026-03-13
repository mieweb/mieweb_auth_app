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
            Secure, open-source two-factor authentication
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={() => navigate("/login")}
            size="lg"
            fullWidth
            leftIcon={<LogIn className="h-5 w-5" />}
          >
            Sign In
          </Button>

          <Button
            onClick={() => navigate("/register")}
            variant="outline"
            size="lg"
            fullWidth
            leftIcon={<UserPlus className="h-5 w-5" />}
          >
            Create Account
          </Button>
        </div>
      </div>
    </div>
  );
};
