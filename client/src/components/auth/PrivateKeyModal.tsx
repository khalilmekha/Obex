import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Copy, CheckCheck, FileText, FileDown } from "lucide-react";
import { useState } from "react";

interface PrivateKeyModalProps {
  privateKey: string | null;
  onClose: () => void;
}

export function PrivateKeyModal({ privateKey, onClose }: PrivateKeyModalProps) {
  const [copied, setCopied] = useState(false);

  if (!privateKey) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(privateKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownloadTxt = () => {
    const content = [
      "================================================",
      "  COFFRE-FORT RSA — CLÉ PRIVÉE DE DÉCHIFFREMENT",
      "================================================",
      "",
      "AVERTISSEMENT : Ce fichier contient votre clé privée RSA.",
      "Conservez-le dans un endroit sécurisé. Ne le partagez jamais.",
      "Sans cette clé, vos fichiers chiffrés seront irrécupérables.",
      "",
      "------------------------------------------------",
      privateKey,
      "------------------------------------------------",
      "",
      `Généré le : ${new Date().toLocaleString("fr-FR")}`,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cle_privee_rsa.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    const date = new Date().toLocaleString("fr-FR");
    const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Clé Privée — Obex</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Inter:wght@400;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #fff; color: #111; padding: 40px; }
    .header { border-bottom: 3px solid #dc2626; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { font-size: 22px; font-weight: 700; letter-spacing: 2px; color: #111; }
    .logo span { color: #22c55e; }
    .title { font-size: 18px; font-weight: 600; margin-top: 8px; color: #333; }
    .warning-box { background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .warning-title { font-weight: 700; color: #dc2626; font-size: 14px; margin-bottom: 6px; }
    .warning-text { color: #7f1d1d; font-size: 13px; line-height: 1.6; }
    .key-section { margin-bottom: 24px; }
    .key-label { font-size: 12px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
    .key-box { background: #f8f8f8; border: 1px solid #ddd; border-radius: 6px; padding: 16px; }
    .key-text { font-family: 'Courier Prime', 'Courier New', monospace; font-size: 11px; word-break: break-all; line-height: 1.7; color: #1a1a2e; }
    .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #eee; display: flex; justify-content: space-between; font-size: 11px; color: #888; }
    .stamp { display: inline-block; border: 2px solid #dc2626; color: #dc2626; font-weight: 700; font-size: 11px; padding: 4px 12px; border-radius: 4px; letter-spacing: 2px; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">OB<span>EX</span></div>
    <div class="title">Certificat de Clé Privée de Déchiffrement</div>
  </div>
  <div class="warning-box">
    <div class="warning-title">⚠ CONFIDENTIEL — NE PAS PARTAGER</div>
    <div class="warning-text">
      Ce document contient votre clé privée RSA unique. Elle est nécessaire pour déchiffrer vos fichiers stockés dans Obex.
      Si vous perdez ce document, l'accès à vos fichiers chiffrés sera définitivement impossible.
      Conservez ce document dans un endroit sécurisé, à l'abri des accès non autorisés.
    </div>
  </div>
  <div class="key-section">
    <div class="key-label">Clé Privée RSA-2048 (Format PKCS#8 / PEM)</div>
    <div class="key-box">
      <div class="key-text">${privateKey.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")}</div>
    </div>
  </div>
  <div class="footer">
    <div>Généré le : ${date}</div>
    <div class="stamp">CONFIDENTIEL</div>
  </div>
  <script>
    window.onload = function() { window.print(); };
  <\/script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      // Fallback si le popup est bloqué — télécharger le HTML directement
      const a = document.createElement("a");
      a.href = url;
      a.download = "cle_privee_rsa.html";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  return (
    <Dialog open={!!privateKey} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-lg border-destructive/50 bg-background/98 backdrop-blur-xl shadow-2xl shadow-destructive/20"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-destructive/20 rounded-full">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <DialogTitle className="text-xl text-destructive-foreground">
              Clé Privée Générée — Sauvegardez-la !
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm font-medium text-foreground/80 leading-relaxed">
            Cette clé est votre <strong className="text-foreground">unique moyen de déchiffrer vos fichiers</strong>.
            Elle <strong className="text-destructive">ne sera jamais stockée</strong> sur nos serveurs.
            Téléchargez-la maintenant avant de continuer.
          </DialogDescription>
        </DialogHeader>

        {/* Key preview */}
        <div className="p-3 bg-black/60 border border-black/10 rounded-lg max-h-32 overflow-y-auto">
          <code className="text-primary/80 font-mono text-xs break-all leading-relaxed">
            {privateKey}
          </code>
        </div>

        {/* Download buttons */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Télécharger la clé
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="border-white/20 hover:bg-black/5 flex items-center gap-2 h-11"
              onClick={handleDownloadTxt}
              data-testid="button-download-txt"
            >
              <FileText className="w-4 h-4 text-primary" />
              <span className="font-semibold">Fichier .txt</span>
            </Button>
            <Button
              variant="outline"
              className="border-white/20 hover:bg-black/5 flex items-center gap-2 h-11"
              onClick={handleDownloadPdf}
              data-testid="button-download-pdf"
            >
              <FileDown className="w-4 h-4 text-destructive" />
              <span className="font-semibold">Fichier PDF</span>
            </Button>
          </div>
        </div>

        {/* Copy button */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full border border-black/10 text-muted-foreground hover:text-foreground"
          onClick={handleCopy}
          data-testid="button-copy-key"
        >
          {copied ? (
            <><CheckCheck className="w-4 h-4 mr-2 text-green-400" />Clé copiée dans le presse-papiers</>
          ) : (
            <><Copy className="w-4 h-4 mr-2" />Copier dans le presse-papiers</>
          )}
        </Button>

        <DialogFooter className="mt-2">
          <Button
            onClick={onClose}
            className="w-full bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20"
            data-testid="button-confirm-key-saved"
          >
            J'ai sauvegardé ma clé — Accéder au coffre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
