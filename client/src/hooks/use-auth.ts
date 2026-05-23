import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type LoginInput = z.infer<typeof api.auth.login.input>;
type RegisterInput = z.infer<typeof api.auth.register.input>;

export function useAuth() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: [api.auth.profile.path],
    queryFn: async () => {
      const res = await fetch(api.auth.profile.path, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Erreur lors de la récupération du profil");
      const data = await res.json();
      return api.auth.profile.responses[200].parse(data);
    },
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginInput) => {
      const validated = api.auth.login.input.parse(credentials);
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) throw new Error("Identifiants incorrects");
        throw new Error(data.message || "Erreur de connexion");
      }
      return api.auth.login.responses[200].parse(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.profile.path] });
      toast({ title: "Accès autorisé", description: "Bienvenue dans votre coffre-fort." });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({ title: "Échec de l'accès", description: error.message, variant: "destructive" });
    }
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterInput) => {
      const validated = api.auth.register.input.parse(credentials);
      const res = await fetch(api.auth.register.path, {
        method: api.auth.register.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400) throw new Error(data.message || "Données invalides");
        throw new Error("Erreur d'inscription");
      }
      return api.auth.register.responses[201].parse(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.profile.path] });
    },
    onError: (error: Error) => {
      toast({ title: "Échec de l'inscription", description: error.message, variant: "destructive" });
    }
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.auth.logout.path, {
        method: api.auth.logout.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erreur de déconnexion");
      return res.json();
    },
    onSuccess: () => {
      queryClient.setQueryData([api.auth.profile.path], null);
      toast({ title: "Déconnecté", description: "Votre session a été fermée en toute sécurité." });
      setLocation("/login");
    },
  });

  return {
    user,
    isLoadingUser,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutateAsync, // Using mutateAsync to handle privateKey in component
    isRegistering: registerMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}