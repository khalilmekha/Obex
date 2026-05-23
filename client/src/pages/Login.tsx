import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2, ArrowRight, Fingerprint } from "lucide-react";
import { motion } from "framer-motion";
import { isBiometricAvailable, loginWithBiometric } from "@/lib/webauthn";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const { login, isLoggingIn, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const checkBiometric = async () => {
      const available = await isBiometricAvailable();
      setBiometricAvailable(available);
    };
    checkBiometric();
  }, []);

  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  if (user) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password });
  };

  const handleBiometric = async () => {
    if (!email) {
      toast({ title: "Email requis", description: "Veuillez entrer votre email pour utiliser la biométrie", variant: "destructive" });
      return;
    }

    setIsBiometricLoading(true);
    try {
      await loginWithBiometric(email);
      await queryClient.invalidateQueries({ queryKey: [api.auth.profile.path] });
      toast({ title: "Accès autorisé", description: "Authentification biométrique réussie" });
      setLocation("/");
    } catch (error: any) {
      toast({ title: "Erreur biométrique", description: error.message, variant: "destructive" });
    } finally {
      setIsBiometricLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background vault-pattern bg-background">
      {/* Decorative ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md p-8 glass-panel rounded-2xl relative z-10 mx-4"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-black/5 border border-black/10 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-black/50">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-bold text-center text-foreground">
            Accès au <span className="text-primary text-glow">Coffre</span>
          </h1>
          <p className="text-muted-foreground text-center mt-2">
            Identifiez-vous pour accéder à vos fichiers chiffrés.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Adresse email</Label>
            <Input 
              id="email" 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@vault.com"
              required
              className="bg-white border-black/20 focus:border-primary transition-all"
              data-testid="input-email"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe d'accès</Label>
            <Input 
              id="password" 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="bg-white border-black/20 focus:border-primary transition-all"
              data-testid="input-password"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 h-12 text-lg"
            disabled={isLoggingIn || isBiometricLoading}
            data-testid="button-login"
          >
            {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : "Déverrouiller"}
          </Button>
        </form>

        {biometricAvailable && (
          <div className="mt-6 pt-6 border-t border-black/10">
            <p className="text-muted-foreground text-sm text-center mb-3">
              Ou utilisez la biométrie
            </p>
            <Button 
              type="button"
              variant="outline"
              className="w-full border-white/20 hover:bg-black/5"
              onClick={handleBiometric}
              disabled={isBiometricLoading || !email}
              data-testid="button-biometric"
            >
              {isBiometricLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Fingerprint className="w-5 h-5 mr-2" />}
              {isBiometricLoading ? "Vérification..." : "Empreinte/Visage"}
            </Button>
          </div>
        )}

        <div className="mt-8 text-center border-t border-black/10 pt-6">
          <p className="text-muted-foreground text-sm">
            Nouveau agent de sécurité ?
          </p>
          <Link href="/register" className="inline-flex items-center text-primary hover:text-primary/80 font-medium mt-2 transition-colors">
            Créer un coffre-fort <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}