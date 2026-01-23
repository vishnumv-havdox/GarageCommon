import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Car, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8">
        <div className="space-y-4">
          <Car className="h-24 w-24 text-primary mx-auto animate-bounce" />
          <h1 className="text-6xl font-bold text-foreground">404</h1>
          <h2 className="text-2xl font-semibold text-foreground">Page Not Found</h2>
          <p className="text-muted-foreground max-w-md">
            Oops! The page you're looking for seems to have driven away. 
            Let's get you back to the garage.
          </p>
        </div>
        
        <div className="space-y-4">
          <Button 
            asChild 
            className="bg-gradient-primary text-primary-foreground hover:shadow-glow"
          >
            <a href="/">
              <Home className="h-4 w-4 mr-2" />
              Return to Dashboard
            </a>
          </Button>
          
          <p className="text-sm text-muted-foreground">
            If you believe this is an error, please contact support.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;