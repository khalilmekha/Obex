import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Shield, LogOut, Database, Settings, ShieldAlert } from "lucide-react";
import { formatBytes } from "@/lib/format";

export function Navbar() {
  const { user, logout, isLoggingOut } = useAuth();

  return (
    <nav className="border-b border-black/10 bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <Shield className="w-8 h-8 text-primary" />
            <span className="font-display font-bold text-xl tracking-wider text-foreground">
              OB<span className="text-primary">EX</span>
            </span>
          </Link>

          {user && (
            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground bg-black/5 px-3 py-1.5 rounded-full border border-black/10">
                <Database className="w-4 h-4" />
                <span>
                  {formatBytes(user.quotaUsed)} / {formatBytes(user.quotaTotal)}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium hidden sm:block">{user.email}</span>
                {user.isAdmin && (
                  <Link href="/admin">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-primary hover:bg-primary/10 transition-colors border border-primary/20"
                    >
                      <ShieldAlert className="w-4 h-4 mr-2" />
                      Admin
                    </Button>
                  </Link>
                )}
                <Link href="/profile">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors"
                    data-testid="button-profile"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Paramètres
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => logout()}
                  disabled={isLoggingOut}
                  className="text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors"
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Déconnexion
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
