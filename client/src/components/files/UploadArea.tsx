import { useState, useRef } from "react";
import { UploadCloud, File as FileIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UploadAreaProps {
  onUpload: (file: File) => void;
  isUploading: boolean;
}

export function UploadArea({ onUpload, isUploading }: UploadAreaProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUpload(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
    }
  };

  return (
    <div 
      className={`relative w-full border-2 border-dashed rounded-2xl p-10 transition-all duration-300 flex flex-col items-center justify-center text-center
        ${dragActive ? 'border-primary bg-primary/5' : 'border-white/20 bg-card hover:border-primary/50 hover:bg-white/[0.02]'}
        ${isUploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
      `}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input 
        ref={inputRef}
        type="file" 
        className="hidden" 
        onChange={handleChange}
        disabled={isUploading}
      />
      
      <div className="p-4 bg-black/5 rounded-full mb-4 ring-8 ring-white/5">
        {isUploading ? (
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        ) : (
          <UploadCloud className={`w-8 h-8 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
        )}
      </div>
      
      <h3 className="text-lg font-semibold mb-1">
        {isUploading ? "Chiffrement et transfert en cours..." : "Cliquez ou glissez un fichier ici"}
      </h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Votre fichier sera chiffré localement avec une clé RSA forte avant d'être stocké dans notre coffre-fort.
      </p>
      
      <Button 
        variant="secondary" 
        className="pointer-events-none"
        disabled={isUploading}
      >
        <FileIcon className="w-4 h-4 mr-2" />
        Sélectionner un fichier
      </Button>
    </div>
  );
}
