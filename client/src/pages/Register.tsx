import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldPlus, Loader2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { PrivateKeyModal } from "@/components/auth/PrivateKeyModal";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  
  const { register, isRegistering, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // If user is already logged in and we aren't showing the modal, redirect
    if (user && !generatedKey) {
      setLocation("/");
    }
  }, [user, generatedKey, setLocation]);

  if (user && !generatedKey) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await register({ email, password });
      // Show the modal with the private key!
      setGeneratedKey(result.privateKey);
    } catch (err) {
      // Error is handled by toast in the hook
    }
  };

  const handleModalClose = () => {
    setGeneratedKey(null);
    setLocation("/");
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background vault-pattern bg-background">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md p-8 glass-panel rounded-2xl relative z-10 mx-4 border-t-primary/30"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-primary/20">
              <ShieldPlus className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-display font-bold text-center text-foreground">
              Initialisation du <span className="text-primary text-glow">Coffre</span>
            </h1>
            <p className="text-muted-foreground text-center mt-2">
              Créez votre espace de stockage à chiffrement de bout en bout.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Adresse email sécurisée</Label>
              <Input 
                id="email" 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@vault.com"
                required
                className="bg-white border-black/20 focus:border-primary transition-all"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe maître</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 caractères"
                required
                minLength={8}
                className="bg-white border-black/20 focus:border-primary transition-all"
              />
            </div>

            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-xs text-primary/80 leading-relaxed">
                <strong className="block mb-1">Architecture Zero-Knowledge:</strong>
                Une paire de clés RSA sera générée. La clé publique chiffrera vos fichiers. La clé privée vous sera remise UNE SEULE FOIS pour le déchiffrement.
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 h-12 text-lg"
              disabled={isRegistering}
            >
              {isRegistering ? <Loader2 className="w-5 h-5 animate-spin" /> : "Générer les clés"}
            </Button>
          </form>

          <div className="mt-8 text-center border-t border-black/10 pt-6">
            <Link href="/login" className="inline-flex items-center text-muted-foreground hover:text-foreground text-sm transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1" /> Retour à l'identification
            </Link>
          </div>
        </motion.div>
      </div>

      <PrivateKeyModal 
        privateKey={generatedKey} 
        onClose={handleModalClose} 
      />
    </>
  );
}
