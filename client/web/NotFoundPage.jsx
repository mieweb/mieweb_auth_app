import { Button } from "@mieweb/ui";
import { Home, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { usePageTitle } from "../../hooks/usePageTitle";
import Layout from "./components/Layout";

const NotFoundPage = () => {
  usePageTitle("Page Not Found");

  return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <AlertTriangle className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Page Not Found
          </h2>
          <p className="text-muted-foreground mb-8">
            The page you&apos;re looking for doesn&apos;t exist or has been
            moved.
          </p>
          <Link to="/">
            <Button className="gap-2">
              <Home className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default NotFoundPage;
