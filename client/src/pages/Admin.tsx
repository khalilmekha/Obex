import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Shield, Users, FileText, Trash2, HardDrive,
  Search, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Edit2, Check, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatBytes } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

interface AdminUser {
  id: number;
  email: string;
  quotaTotal: number;
  quotaUsed: number;
  isAdmin: boolean;
  createdAt: string;
}

interface AdminFile {
  id: number;
  userId: number;
  originalName: string;
  storedUuid: string;
  sizeBytes: number;
  uploadDate: string;
}

export default function Admin() {
  const { user, isLoadingUser } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [files, setFiles] = useState<AdminFile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [activeTab, setActiveTab] = useState<"users" | "files">("users");
  const [searchUser, setSearchUser] = useState("");
  const [searchFile, setSearchFile] = useState("");
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [editingQuota, setEditingQuota] = useState<number | null>(null);
  const [quotaInput, setQuotaInput] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) throw new Error();
      setUsers(await res.json());
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les utilisateurs", variant: "destructive" });
    } finally {
      setIsLoadingUsers(false);
    }
  }, [toast]);

  const fetchFiles = useCallback(async () => {
    setIsLoadingFiles(true);
    try {
      const res = await fetch("/api/admin/files", { credentials: "include" });
      if (!res.ok) throw new Error();
      setFiles(await res.json());
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les fichiers", variant: "destructive" });
    } finally {
      setIsLoadingFiles(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isLoadingUser) {
      if (!user) return setLocation("/login");
      if (!user.isAdmin) return setLocation("/");
      fetchUsers();
      fetchFiles();
    }
  }, [user, isLoadingUser, setLocation, fetchUsers, fetchFiles]);

  const handleDeleteUser = async (userId: number) => {
    if (!confirm("Supprimer cet utilisateur et tous ses fichiers ?")) return;
    setDeletingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast({ title: "Succès", description: "Utilisateur supprimé" });
      setUsers(u => u.filter(x => x.id !== userId));
      setFiles(f => f.filter(x => x.userId !== userId));
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    if (!confirm("Supprimer ce fichier définitivement ?")) return;
    setDeletingId(fileId);
    try {
      const res = await fetch(`/api/admin/files/${fileId}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast({ title: "Succès", description: "Fichier supprimé" });
      const deleted = files.find(f => f.id === fileId);
      setFiles(f => f.filter(x => x.id !== fileId));
      if (deleted) {
        setUsers(u => u.map(x => x.id === deleted.userId
          ? { ...x, quotaUsed: Math.max(0, x.quotaUsed - deleted.sizeBytes) }
          : x
        ));
      }
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveQuota = async (userId: number) => {
    const gb = parseFloat(quotaInput);
    if (isNaN(gb) || gb <= 0) {
      toast({ title: "Erreur", description: "Valeur invalide (entrez des Go)", variant: "destructive" });
      return;
    }
    const bytes = Math.round(gb * 1024 * 1024 * 1024);
    try {
      const res = await fetch(`/api/admin/users/${userId}/quota`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotaTotal: bytes }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast({ title: "Succès", description: "Quota mis à jour" });
      setUsers(u => u.map(x => x.id === userId ? { ...x, quotaTotal: bytes } : x));
      setEditingQuota(null);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchUser.toLowerCase())
  );
  const filteredFiles = files.filter(f =>
    f.originalName.toLowerCase().includes(searchFile.toLowerCase()) ||
    String(f.userId).includes(searchFile)
  );

  const totalStorage = users.reduce((a, u) => a + u.quotaUsed, 0);
  const totalFiles = files.length;

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background vault-pattern">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-display font-bold text-foreground mb-1">
                Panneau <span className="text-primary">Admin</span>
              </h1>
              <p className="text-muted-foreground">Gestion des utilisateurs et des fichiers chiffrés</p>
            </div>
            <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-lg px-4 py-2">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-primary">Accès Administrateur</span>
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              { icon: Users, label: "Utilisateurs", value: users.length, color: "text-blue-400" },
              { icon: FileText, label: "Fichiers chiffrés", value: totalFiles, color: "text-emerald-400" },
              { icon: HardDrive, label: "Stockage utilisé", value: formatBytes(totalStorage), color: "text-amber-400" },
            ].map(({ icon: Icon, label, value, color }) => (
              <Card key={label} className="bg-black/5 border-black/10">
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className="p-3 bg-black/5 rounded-xl">
                    <Icon className={`w-6 h-6 ${color}`} />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">{label}</p>
                    <p className="text-2xl font-display font-bold">{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 bg-black/5 border border-black/10 p-1 rounded-lg w-fit">
            {(["users", "files"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "users" ? (
                  <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Utilisateurs</span>
                ) : (
                  <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> Fichiers</span>
                )}
              </button>
            ))}
          </div>

          {/* Users Tab */}
          <AnimatePresence mode="wait">
            {activeTab === "users" && (
              <motion.div key="users" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <Card className="bg-black/5 border-black/10">
                  <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div>
                      <CardTitle>Utilisateurs enregistrés</CardTitle>
                      <CardDescription>{filteredUsers.length} utilisateur(s)</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Rechercher..."
                          value={searchUser}
                          onChange={e => setSearchUser(e.target.value)}
                          className="pl-9 bg-black/30 border-black/10 w-48 focus:border-primary"
                        />
                      </div>
                      <Button variant="ghost" size="sm" onClick={fetchUsers} className="hover:bg-black/5">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoadingUsers ? (
                      <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                    ) : filteredUsers.length === 0 ? (
                      <p className="text-center text-muted-foreground py-10">Aucun utilisateur trouvé</p>
                    ) : (
                      <div className="space-y-2">
                        {filteredUsers.map(u => {
                          const pct = Math.min(100, (u.quotaUsed / u.quotaTotal) * 100);
                          const isExpanded = expandedUser === u.id;
                          const userFiles = files.filter(f => f.userId === u.id);
                          return (
                            <motion.div key={u.id} layout className="rounded-lg border border-black/10 overflow-hidden">
                              {/* Row */}
                              <div className="flex items-center gap-4 px-4 py-3 bg-black/20 hover:bg-black/5 transition-colors">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm truncate">{u.email}</span>
                                    {u.isAdmin && (
                                      <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Admin</Badge>
                                    )}
                                  </div>
                                  {/* Quota bar */}
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden max-w-32">
                                      <div
                                        className={`h-full rounded-full transition-all ${pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-400" : "bg-primary"}`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      {formatBytes(u.quotaUsed)} / {formatBytes(u.quotaTotal)}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground hidden sm:flex">
                                  <span>{userFiles.length} fichier(s)</span>
                                  <span>·</span>
                                  <span>{new Date(u.createdAt).toLocaleDateString("fr-FR")}</span>
                                </div>

                                {/* Edit quota */}
                                {editingQuota === u.id ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      value={quotaInput}
                                      onChange={e => setQuotaInput(e.target.value)}
                                      placeholder="Go"
                                      className="w-20 h-7 text-xs bg-black/50 border-white/20"
                                      autoFocus
                                    />
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-primary hover:bg-primary/10"
                                      onClick={() => handleSaveQuota(u.id)}>
                                      <Check className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-black/5"
                                      onClick={() => setEditingQuota(null)}>
                                      <X className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                    onClick={() => { setEditingQuota(u.id); setQuotaInput(String((u.quotaTotal / 1024 / 1024 / 1024).toFixed(1))); }}>
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}

                                {/* Expand */}
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-black/5"
                                  onClick={() => setExpandedUser(isExpanded ? null : u.id)}>
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </Button>

                                {/* Delete user */}
                                {!u.isAdmin && (
                                  <Button size="sm" variant="ghost"
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                                    disabled={deletingId === u.id}
                                    onClick={() => handleDeleteUser(u.id)}>
                                    {deletingId === u.id
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : <Trash2 className="w-3.5 h-3.5" />}
                                  </Button>
                                )}
                              </div>

                              {/* Expanded files list */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="border-t border-black/10 bg-black/30 overflow-hidden"
                                  >
                                    {userFiles.length === 0 ? (
                                      <p className="text-center text-muted-foreground text-sm py-4">Aucun fichier</p>
                                    ) : (
                                      <div className="p-3 space-y-1">
                                        {userFiles.map(f => (
                                          <div key={f.id} className="flex items-center justify-between px-3 py-2 rounded-md bg-black/5 hover:bg-black/5 transition-colors">
                                            <div className="flex items-center gap-3 min-w-0">
                                              <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                                              <span className="text-sm truncate">{f.originalName}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                                              <span>{formatBytes(f.sizeBytes)}</span>
                                              <span className="hidden sm:block">{new Date(f.uploadDate).toLocaleDateString("fr-FR")}</span>
                                              <Button size="sm" variant="ghost"
                                                className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                                                disabled={deletingId === f.id}
                                                onClick={() => handleDeleteFile(f.id)}>
                                                {deletingId === f.id
                                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                                  : <Trash2 className="w-3 h-3" />}
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Files Tab */}
            {activeTab === "files" && (
              <motion.div key="files" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <Card className="bg-black/5 border-black/10">
                  <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div>
                      <CardTitle>Tous les fichiers chiffrés</CardTitle>
                      <CardDescription>{filteredFiles.length} fichier(s) au total</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Nom ou userId..."
                          value={searchFile}
                          onChange={e => setSearchFile(e.target.value)}
                          className="pl-9 bg-black/30 border-black/10 w-48 focus:border-primary"
                        />
                      </div>
                      <Button variant="ghost" size="sm" onClick={fetchFiles} className="hover:bg-black/5">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoadingFiles ? (
                      <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                    ) : filteredFiles.length === 0 ? (
                      <p className="text-center text-muted-foreground py-10">Aucun fichier trouvé</p>
                    ) : (
                      <div className="space-y-2">
                        {filteredFiles.map(f => {
                          const owner = users.find(u => u.id === f.userId);
                          return (
                            <div key={f.id} className="flex items-center gap-4 px-4 py-3 rounded-lg border border-black/10 bg-black/20 hover:bg-black/5 transition-colors">
                              <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                                <FileText className="w-4 h-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{f.originalName}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {owner ? owner.email : `User #${f.userId}`} · {formatBytes(f.sizeBytes)} · {new Date(f.uploadDate).toLocaleDateString("fr-FR")}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Badge variant="outline" className="text-xs border-black/10 text-muted-foreground hidden sm:flex">
                                  chiffré
                                </Badge>
                                <Button size="sm" variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                                  disabled={deletingId === f.id}
                                  onClick={() => handleDeleteFile(f.id)}>
                                  {deletingId === f.id
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Trash2 className="w-3.5 h-3.5" />}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Warning */}
                <div className="mt-4 flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-200/80">
                    Les fichiers sont chiffrés avec RSA+AES. La suppression est <strong>irréversible</strong> — l'administrateur ne peut pas lire leur contenu.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
}