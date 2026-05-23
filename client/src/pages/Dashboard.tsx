import { useAuth } from "@/hooks/use-auth";
import { useFiles } from "@/hooks/use-files";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { UploadArea } from "@/components/files/UploadArea";
import { FileTable } from "@/components/files/FileTable";
import { DownloadDialog } from "@/components/files/DownloadDialog";
import { useState, useEffect } from "react";
import { Loader2, HardDrive, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/format";
import type { File as FileType } from "@shared/schema";

export default function Dashboard() {
  const { user, isLoadingUser } = useAuth();
  const { files, currentKeyId, isLoadingFiles, upload, isUploading, download, isDownloading, deleteFile, isDeleting } = useFiles();
  const [, setLocation] = useLocation();
  const [selectedFile, setSelectedFile] = useState<FileType | null>(null);

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

  const quotaPercentage = (user.quotaUsed / user.quotaTotal) * 100;
  const isNearQuota = quotaPercentage > 90;

  return (
    <div className="min-h-screen bg-background vault-pattern">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col md:flex-row gap-6"
        >
          {/* Quota Card */}
          <div className="glass-panel p-6 rounded-2xl flex-1 flex flex-col justify-center relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 opacity-5">
              <HardDrive className="w-32 h-32" />
            </div>
            <div className="flex justify-between items-end mb-4 relative z-10">
              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">État du stockage</h2>
                <div className="text-3xl font-display font-bold">
                  {formatBytes(user.quotaUsed)} <span className="text-lg text-muted-foreground">/ {formatBytes(user.quotaTotal)}</span>
                </div>
              </div>
              <div className={`text-xl font-display font-bold ${isNearQuota ? 'text-destructive text-glow' : 'text-primary'}`}>
                {quotaPercentage.toFixed(1)}%
              </div>
            </div>
            <Progress value={quotaPercentage} className={`h-2 relative z-10 ${isNearQuota ? 'bg-destructive/20 [&>div]:bg-destructive' : 'bg-primary/20 [&>div]:bg-primary'}`} />
          </div>

          {/* Security Status Card */}
          <div className="glass-panel p-6 rounded-2xl md:w-1/3 flex items-center gap-4 border-l-4 border-l-primary">
            <div className="p-3 bg-primary/10 rounded-xl">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Chiffrement Actif</h2>
              <p className="text-sm text-muted-foreground">Tous les fichiers utilisent un algorithme RSA asymétrique de bout en bout.</p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-1"
          >
            <h2 className="font-display text-xl font-semibold mb-4 text-white/90">Importer</h2>
            <UploadArea onUpload={upload} isUploading={isUploading} />
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-xl font-semibold text-white/90">Contenu du coffre ({files.length})</h2>
            </div>
            
            {isLoadingFiles ? (
              <div className="flex justify-center p-12 glass-panel rounded-xl border border-black/10">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : (
              <FileTable 
                files={files} 
                currentKeyId={currentKeyId}
                onDownload={setSelectedFile} 
                onDelete={deleteFile}
                isDeleting={isDeleting}
              />
            )}
          </motion.div>
        </div>
      </main>

      <DownloadDialog 
        file={selectedFile} 
        onClose={() => setSelectedFile(null)} 
        onConfirm={(pk) => download({ id: selectedFile!.id, privateKey: pk, filename: selectedFile!.originalName })}
        isDownloading={isDownloading}
      />
    </div>
  );
}