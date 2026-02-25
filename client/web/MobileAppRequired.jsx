import { Card, CardContent, CardHeader, CardTitle, Button } from "@mieweb/ui";
import { Smartphone, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { usePageTitle } from "../../hooks/usePageTitle";
import { AppStoreButtons } from "./components/AppStoreButtons";
import Layout from "./components/Layout";

const MobileAppRequired = ({ mode = "login" }) => {
  usePageTitle(
    mode === "login"
      ? "Login — Mobile App Required"
      : "Register — Mobile App Required",
  );

  const title =
    mode === "login"
      ? "Login Available on Mobile Only"
      : "Registration Available on Mobile Only";

  const description =
    mode === "login"
      ? "To log in to MIE Auth, please use our mobile app. The login feature requires biometric authentication which is only available on mobile devices."
      : "To register for MIE Auth, please download our mobile app. Registration requires device-level security features only available on mobile.";

  return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Smartphone className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-center text-muted-foreground">{description}</p>
            <AppStoreButtons className="justify-center" />
            <div className="text-center">
              <Link to="/">
                <Button variant="ghost" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default MobileAppRequired;
