import React from "react";
import { useNavigate } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";
import { Layout } from "./components/Layout";
import { Button } from "@mieweb/ui";
import { usePageTitle } from "../hooks/usePageTitle";

export const NotFoundPage = () => {
  const navigate = useNavigate();
  usePageTitle("Page Not Found");

  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <p className="text-sm font-bold text-primary tracking-widest uppercase mb-4">
          404
        </p>
        <h1 className="text-4xl font-black text-foreground tracking-tight mb-4">
          Page not found
        </h1>
        <p className="text-muted-foreground mb-10">
          Sorry, we couldn't find the page you're looking for.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => navigate("/")}
            leftIcon={<Home className="h-4 w-4" />}
          >
            Go Home
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            leftIcon={<ArrowLeft className="h-4 w-4" />}
          >
            Go Back
          </Button>
        </div>
      </div>
    </Layout>
  );
};
