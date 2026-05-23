import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2, AlertCircle } from "lucide-react";
import type { File as FileType } from "@shared/schema";

interface DownloadDialogProps {
  file: FileType | null;
  onClose: () => void;
  onConfirm: (privateKey: string) => Promise<void>;
  isDownloading: boolean;
}

export function DownloadDialog({ file, onClose, onConfirm, isDownloading }: DownloadDialogProps) {
  const [privateKey, setPrivateKey] = useState("");
  const [error, setError] = useState("");

  if (!file) return null;

  const isValidPem = privateKey.trim().includes("-----BEGIN") && privateKey.trim().includes("-----END");

  const handleConfirm = async () => {
    if (!privateKey.trim()) {
      setError("La clé privée est requise");
      return;
    }
    if (!isValidPem) {
      setError("Format invalide — collez votre clé PEM complète (BEGIN … END)");
      return;
    }
    try {
      await onConfirm(privateKey.trim());
      setPrivateKey("");
      setError("");
      onClose();
    } catch (err) {
      setPrivateKey("");
    }
  };

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-card border-black/10 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/20 rounded-full">
              <KeyRound className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle>Déchiffrement requis</DialogTitle>
          </div>
          <DialogDescription>
            Pour télécharger <strong className="text-foreground">{file.originalName}</strong>,
            collez votre clé privée RSA complète ci-dessous.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Label htmlFor="private-key-input" className="text-sm text-muted-foreground">
            Clé privée RSA (format PEM — <code className="text-xs bg-black/40 px-1 rounded">-----BEGIN PRIVATE KEY-----</code> …)
          </Label>
          <Textarea
            id="private-key-input"
            placeholder={"-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEF...\n-----END PRIVATE KEY-----"}
            value={privateKey}
            onChange={(e) => {
              setPrivateKey(e.target.value);
              setError("");
            }}
            rows={8}
            className="font-mono text-xs bg-black/50 border-white/20 focus:border-primary transition-colors resize-none leading-relaxed"
            data-testid="textarea-private-key"
            spellCheck={false}
          />

          {/* Validation indicator */}
          {privateKey.trim().length > 0 && (
            <div className={`flex items-center gap-2 text-xs ${isValidPem ? "text-green-400" : "text-amber-400"}`}>
              <AlertCircle className="w-3 h-3" />
              {isValidPem ? "Format PEM valide détecté" : "Collez la clé complète avec les lignes BEGIN et END"}
            </div>
          )}

          {error && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isDownloading}>
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isDownloading || !privateKey.trim() || !isValidPem}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
            data-testid="button-confirm-download"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <KeyRound className="w-4 h-4 mr-2" />
            )}
            {isDownloading ? "Déchiffrement..." : "Autoriser l'accès"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
