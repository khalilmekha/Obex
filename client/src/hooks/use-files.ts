import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useFiles() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const filesQuery = useQuery({
    queryKey: [api.files.list.path],
    queryFn: async () => {
      const res = await fetch(api.files.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Impossible de charger les fichiers");
      const data = await res.json();
      // La réponse est maintenant { files: [...], currentKeyId: "..." }
      return data as { files: any[]; currentKeyId: string | null };
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(api.files.upload.path, {
        method: api.files.upload.method,
        body: formData,
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 507) throw new Error("Espace de stockage insuffisant");
        throw new Error(data.message || "Erreur lors du téléversement");
      }
      return api.files.upload.responses[201].parse(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.files.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.auth.profile.path] }); // Update quota
      toast({ title: "Fichier sécurisé", description: "Le fichier a été chiffré et sauvegardé avec succès." });
    },
    onError: (error: Error) => {
      toast({ title: "Échec du transfert", description: error.message, variant: "destructive" });
    }
  });

  const downloadMutation = useMutation({
    mutationFn: async ({ id, privateKey, filename }: { id: number, privateKey: string, filename: string }) => {
      const url = buildUrl(api.files.download.path, { id });
      const validated = api.files.download.input.parse({ privateKey });
      
      const res = await fetch(url, {
        method: api.files.download.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 403) throw new Error("Clé privée incorrecte");
        if (res.status === 404) throw new Error("Fichier introuvable");
        const errData = await res.json();
        throw new Error(errData.message || "Erreur de déchiffrement");
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    },
    onSuccess: () => {
      toast({ title: "Déchiffrement réussi", description: "Le téléchargement a commencé." });
    },
    onError: (error: Error) => {
      toast({ title: "Échec de l'accès", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.files.delete.path, { id });
      const res = await fetch(url, {
        method: api.files.delete.method,
        credentials: "include",
      });

      if (!res.ok) throw new Error("Impossible de supprimer le fichier");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.files.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.auth.profile.path] }); // Update quota
      toast({ title: "Fichier détruit", description: "Le fichier a été supprimé définitivement." });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  });

  return {
    files: filesQuery.data?.files || [],
    currentKeyId: filesQuery.data?.currentKeyId ?? null,
    isLoadingFiles: filesQuery.isLoading,
    upload: uploadMutation.mutate,
    isUploading: uploadMutation.isPending,
    download: downloadMutation.mutateAsync,
    isDownloading: downloadMutation.isPending,
    deleteFile: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}