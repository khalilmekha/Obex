import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Shield, Mail, Calendar, HardDrive, Fingerprint, CheckCircle2, Key, Eye, EyeOff, Copy } from "lucide-react";
import { motion } from "framer-motion";
import { formatBytes } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { isBiometricAvailable, registerBiometric } from "@/lib/webauthn";

export default function Profile() {
  const { user, isLoadingUser } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isRegisteringBiometric, setIsRegisteringBiometric] = useState(false);
  const [biometricRegistered, setBiometricRegistered] = useState(false);

  // Private key reveal
  const [revealPassword, setRevealPassword] = useState("");
  const [isRevealingKey, setIsRevealingKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [showRevealPassword, setShowRevealPassword] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(setBiometricAvailable);
  }, []);

  useEffect(() => {
    if (!isLoadingUser && !user) {
      setLocation("/login");
    }
  }, [user, isLoadingUser, setLocation]);

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleRevealKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRevealingKey(true);
    try {
      const res = await fetch("/api/auth/private-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: revealPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Erreur", description: data.message, variant: "destructive" });
        return;
      }
      setRevealedKey(data.privateKey);
      setRevealPassword("");
    } catch {
      toast({ title: "Erreur", description: "Erreur réseau", variant: "destructive" });
    } finally {
      setIsRevealingKey(false);
    }
  };

  const handleCopyKey = async () => {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  const handleRegisterBiometric = async () => {
    setIsRegisteringBiometric(true);
    try {
      await registerBiometric();
      setBiometricRegistered(true);
      toast({ title: "Biométrie enregistrée", description: "Vous pouvez maintenant vous connecter avec votre visage ou empreinte." });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsRegisteringBiometric(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({ title: "Erreur", description: "Les mots de passe ne correspondent pas", variant: "destructive" });
      return;
    }

    if (newPassword.length < 8) {
      toast({ title: "Erreur", description: "Le nouveau mot de passe doit contenir au moins 8 caractères", variant: "destructive" });
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch(api.auth.updatePassword.path, {
        method: api.auth.updatePassword.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ title: "Erreur", description: data.message || "Erreur lors de la mise à jour", variant: "destructive" });
        return;
      }

      toast({
  title: "Succès",
  description: "Mot de passe mis à jour. Une nouvelle clé privée RSA a été générée.",
});

if (data.privateKey) {
  setRevealedKey(data.privateKey);
}

setCurrentPassword("");
setNewPassword("");
setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const quotaPercentage = (user.quotaUsed / user.quotaTotal) * 100;
  const formattedDate = new Date(user.createdAt).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background vault-pattern">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8">
            <h1 className="text-4xl font-display font-bold text-foreground mb-2">
              Paramètres de <span className="text-primary">Compte</span>
            </h1>
            <p className="text-muted-foreground">Gérez vos informations personnelles et votre sécurité</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Profile Info */}
            <div className="lg:col-span-1">
              <Card className="bg-black/5 border-black/10 overflow-hidden">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Informations du Compte</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Email */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Mail className="w-4 h-4" />
                      <span className="text-sm font-medium">Email</span>
                    </div>
                    <div className="bg-black/30 border border-black/10 rounded-lg p-3">
                      <p className="text-foreground font-mono text-sm break-all">{user.email}</p>
                    </div>
                  </div>

                  {/* Member Since */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm font-medium">Membre depuis</span>
                    </div>
                    <div className="bg-black/30 border border-black/10 rounded-lg p-3">
                      <p className="text-foreground text-sm">{formattedDate}</p>
                    </div>
                  </div>

                  {/* Quota */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <HardDrive className="w-4 h-4" />
                      <span className="text-sm font-medium">Espace utilisé</span>
                    </div>
                    <div className="bg-black/30 border border-black/10 rounded-lg p-3">
                      <p className="text-foreground text-sm font-mono">
                        {formatBytes(user.quotaUsed)} / {formatBytes(user.quotaTotal)}
                      </p>
                      <p className="text-muted-foreground text-xs mt-1">
                        {quotaPercentage.toFixed(1)}% utilisé
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Password Change */}
            <div className="lg:col-span-2">
              <Card className="bg-black/5 border-black/10">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Sécurité du Compte</CardTitle>
                      <CardDescription>Modifiez votre mot de passe maître</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordChange} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Mot de passe actuel</Label>
                      <Input
                        id="current-password"
                        type="password"
                        placeholder="Entrez votre mot de passe actuel"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        disabled={isUpdating}
                        className="bg-black/50 border-black/10 focus:border-primary"
                        data-testid="input-current-password"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-password">Nouveau mot de passe</Label>
                      <Input
                        id="new-password"
                        type="password"
                        placeholder="Minimum 8 caractères"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={8}
                        disabled={isUpdating}
                        className="bg-black/50 border-black/10 focus:border-primary"
                        data-testid="input-new-password"
                      />
                      <p className="text-xs text-muted-foreground">
                        Minimum 8 caractères pour la sécurité
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="Confirmez votre nouveau mot de passe"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={isUpdating}
                        className="bg-black/50 border-black/10 focus:border-primary"
                        data-testid="input-confirm-password"
                      />
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                      <p className="text-sm text-amber-300">
                        <strong>⚠️ Important :</strong> Changer votre mot de passe changera également votre clé privée RSA. Tous vos fichiers chiffrés actuels ne seront plus accessibles. Téléchargez vos fichiers avant de changer votre mot de passe.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20"
                      disabled={isUpdating || !currentPassword || !newPassword || !confirmPassword}
                      data-testid="button-update-password"
                    >
                      {isUpdating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                      {isUpdating ? "Mise à jour..." : "Mettre à jour le mot de passe"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Private Key Recovery */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-8"
          >
            <Card className="bg-black/5 border-black/10">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Key className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Clé Privée RSA</CardTitle>
                    <CardDescription>Confirmez votre mot de passe pour afficher votre clé privée</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {revealedKey ? (
                  <div className="space-y-3">
                    <div className="relative bg-black/50 border border-black/10 rounded-lg p-4">
                      <pre className="text-xs text-primary font-mono break-all whitespace-pre-wrap leading-relaxed">
                        {revealedKey}
                      </pre>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCopyKey}
                        variant="outline"
                        className="border-white/20 hover:bg-black/5 flex-1"
                      >
                        {keyCopied
                          ? <><CheckCircle2 className="w-4 h-4 mr-2 text-green-400" />Copié !</>
                          : <><Copy className="w-4 h-4 mr-2" />Copier la clé</>
                        }
                      </Button>
                      <Button
                        onClick={() => setRevealedKey(null)}
                        variant="outline"
                        className="border-white/20 hover:bg-black/5"
                      >
                        <EyeOff className="w-4 h-4 mr-2" />
                        Masquer
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ⚠️ Conservez cette clé en lieu sûr. Elle est nécessaire pour déchiffrer vos fichiers.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleRevealKey} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reveal-password">Mot de passe</Label>
                      <div className="relative">
                        <Input
                          id="reveal-password"
                          type={showRevealPassword ? "text" : "password"}
                          placeholder="Entrez votre mot de passe pour confirmer"
                          value={revealPassword}
                          onChange={(e) => setRevealPassword(e.target.value)}
                          required
                          disabled={isRevealingKey}
                          className="bg-black/50 border-black/10 focus:border-primary pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRevealPassword(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showRevealPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      variant="outline"
                      className="border-white/20 hover:bg-black/5 w-full"
                      disabled={isRevealingKey || !revealPassword}
                    >
                      {isRevealingKey
                        ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Vérification...</>
                        : <><Eye className="w-4 h-4 mr-2" />Afficher ma clé privée</>
                      }
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Biometric Registration */}
          {biometricAvailable && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="mt-8"
            >
              <Card className="bg-black/5 border-black/10">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Fingerprint className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Authentification Biométrique</CardTitle>
                      <CardDescription>Enregistrez votre visage ou empreinte digitale pour vous connecter sans mot de passe</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {biometricRegistered ? (
                    <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                      <p className="text-sm text-green-300">Biométrie enregistrée avec succès. Vous pouvez désormais vous connecter depuis la page de login.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Votre appareil supporte l'authentification biométrique (Face ID, Touch ID ou Windows Hello). 
                        Enregistrez-la maintenant pour accélérer vos futures connexions.
                      </p>
                      <Button
                        onClick={handleRegisterBiometric}
                        disabled={isRegisteringBiometric}
                        variant="outline"
                        className="border-white/20 hover:bg-black/5"
                        data-testid="button-register-biometric"
                      >
                        {isRegisteringBiometric
                          ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Enregistrement...</>
                          : <><Fingerprint className="w-4 h-4 mr-2" />Enregistrer ma biométrie</>
                        }
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
}