import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Trash2, FileLock2, AlertTriangle } from "lucide-react";
import { formatBytes, formatDate } from "@/lib/format";
import type { File as FileType } from "@shared/schema";

interface FileTableProps {
  files: FileType[];
  currentKeyId: string | null;
  onDownload: (file: FileType) => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}

export function FileTable({ files, currentKeyId, onDownload, onDelete, isDeleting }: FileTableProps) {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-card/50 rounded-xl border border-black/10">
        <FileLock2 className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-medium text-foreground">Aucun fichier sécurisé</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Téléversez des fichiers ci-dessus pour commencer à remplir votre coffre-fort.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-black/10 bg-card overflow-hidden">
      <Table>
        <TableHeader className="bg-black/5">
          <TableRow className="border-black/10 hover:bg-transparent">
            <TableHead className="font-display tracking-wider">Nom du fichier</TableHead>
            <TableHead className="font-display tracking-wider">Taille</TableHead>
            <TableHead className="font-display tracking-wider hidden md:table-cell">Date d'ajout</TableHead>
            <TableHead className="text-right font-display tracking-wider">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => {
            const isOldKey = currentKeyId !== null && (file as any).keyId !== currentKeyId;
            return (
              <TableRow key={file.id} className={`border-black/10 hover:bg-black/5 transition-colors ${isOldKey ? "bg-amber-500/5" : ""}`}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <FileLock2 className={`w-4 h-4 flex-shrink-0 ${isOldKey ? "text-amber-400" : "text-primary"}`} />
                    <span className="truncate max-w-[150px] sm:max-w-[250px]" title={file.originalName}>
                      {file.originalName}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatBytes(file.sizeBytes)}</TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">
                  {formatDate(file.uploadDate!)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDownload(file)}
                      className={`transition-colors ${isOldKey ? "hover:text-amber-400 hover:bg-amber-500/10" : "hover:text-primary hover:bg-primary/10"}`}
                      title={isOldKey ? "Nécessite l'ancienne clé privée" : "Télécharger et déchiffrer"}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Êtes-vous sûr de vouloir supprimer définitivement ce fichier ?")) {
                          onDelete(file.id);
                        }
                      }}
                      disabled={isDeleting}
                      className="hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Détruire"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}