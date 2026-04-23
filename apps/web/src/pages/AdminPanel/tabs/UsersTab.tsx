import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAdminApi } from "../../../hooks/useAdminApi";
import { toast } from "sonner";
import { 
  UserPlus, 
  X, 
  Copy, 
  KeyRound, 
  Trash2, 
  Mail,
  AlertCircle,
  Loader2,
  Users,
  Search
} from "lucide-react";
import { User } from "../../../types/chat";

export default function UsersTab() {
  const { t } = useTranslation(["admin"]);
  const [users, setUsers] = useState<User[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [generatedAuth, setGeneratedAuth] = useState<{ email: string, pass: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const api = useAdminApi();
  const observer = useRef<IntersectionObserver | null>(null);

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.username?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  const fetchUsers = useCallback(async (isInitial = false) => {
    if (isLoading || (!hasMore && !isInitial)) return;
    
    setIsLoading(true);
    const currentPage = isInitial ? 1 : page;
    const { data, error } = await api.getUsers(currentPage, 30);
    
    if (!error && data) {
      if (isInitial) {
        setUsers(data);
        setPage(2);
        setHasMore(data.length === 30);
      } else {
        setUsers(prev => [...prev, ...data]);
        setPage(prev => prev + 1);
        setHasMore(data.length === 30);
      }
    }
    setIsLoading(false);
  }, [isLoading, hasMore, page, api]);

  useEffect(() => {
    fetchUsers(true);
  }, []);

  const lastUserElementRef = useCallback((node: any) => {
    if (isLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchUsers();
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, hasMore, fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    
    const { data, error } = await api.createUser(newEmail);
    if (error) {
      toast.error(error);
    } else if (data) {
      setGeneratedAuth({ email: data.user.email, pass: data.temporaryPassword });
      setNewEmail("");
      fetchUsers(true);
      toast.success(t("admin:users.toasts.identityGenerated"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("admin:users.confirmDelete"))) return;
    
    const { error } = await api.deleteUser(id);
    if (error) {
      toast.error(error);
    } else {
      toast.success(t("admin:users.toasts.profileTerminated"));
      fetchUsers(true);
    }
  };

  const handleResetPass = async (id: string) => {
    if (!confirm(t("admin:users.confirmReset"))) return;
    
    const { data, error } = await api.resetUserPassword(id);
    if (error) {
      toast.error(error);
    } else if (data) {
      setGeneratedAuth({ email: users.find((u: User) => u.id === id)?.email || "User", pass: data.temporaryPassword });
      toast.success(t("admin:users.toasts.securityRotated"));
    }
  };

  const copyAuth = () => {
    if (generatedAuth) {
      navigator.clipboard.writeText(generatedAuth.pass);
      toast.success(t("admin:users.toasts.passwordCopied"));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-l-4 border-sori-accent-danger pl-6 py-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-sori-accent-danger rounded-lg">
              <Users className="h-5 w-5 text-sori-text-on-accent" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-sori-text-strong uppercase">{t("admin:users.title")}</h1>
          </div>
          <p className="text-sori-text-muted text-[10px] font-medium tracking-wide uppercase">{t("admin:users.description")}</p>
        </div>
      </div>

      {/* Provision New Account */}
      <div className="bg-sori-surface-main border border-sori-border-subtle p-6 rounded-3xl shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-6 text-sori-text-strong opacity-5">
          <UserPlus className="h-24 w-24" />
        </div>
        
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-4 w-4 text-sori-accent-danger" />
          <h2 className="text-[9px] font-black uppercase text-sori-text-muted tracking-[0.2em]">{t("admin:users.generateIdentity")}</h2>
        </div>
        
        <form onSubmit={handleCreateUser} className="flex flex-col md:flex-row gap-3 relative z-10">
          <div className="flex-1 relative group/input">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-sori-text-dim group-focus-within/input:text-sori-accent-danger transition-colors" />
            <input 
              type="email" 
              placeholder={t("admin:users.emailPlaceholder")} 
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full bg-sori-surface-panel border border-sori-border-subtle rounded-xl pl-12 pr-5 py-3 text-sm text-sori-text-strong hover:border-sori-accent-danger focus:border-sori-accent-danger outline-none transition-all placeholder:text-sori-text-dim font-medium"
            />
          </div>
          <button 
            type="submit" 
            className="bg-sori-accent-danger text-sori-text-on-accent font-black px-8 py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-lg text-xs uppercase tracking-widest"
          >
            {t("admin:users.generate")}
          </button>
        </form>

        {generatedAuth && (
          <div className="mt-6 bg-sori-surface-danger-subtle border-l-2 border-sori-accent-danger p-4 rounded-xl relative animate-in zoom-in-95">
            <button 
              onClick={() => setGeneratedAuth(null)}
              className="absolute top-3 right-3 text-sori-text-muted hover:text-sori-text-strong transition-all transform hover:rotate-90"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-3 w-3 text-sori-accent-danger" />
              <h3 className="text-sori-accent-danger font-black uppercase tracking-widest text-[8px]">{t("admin:users.securityCredentials")}</h3>
            </div>
            <p className="text-[10px] font-medium mb-3 text-sori-text-muted">{t("admin:users.securityHint")}</p>
            
            <div className="flex items-center gap-3">
              <div className="flex-1 font-mono text-sm bg-sori-surface-base p-3 rounded-lg select-all tracking-wider text-sori-accent-secondary border border-sori-border-subtle flex items-center justify-between">
                <span>{generatedAuth.pass}</span>
                <button onClick={copyAuth} className="text-sori-text-dim hover:text-sori-accent-danger transition-colors">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <button 
                onClick={copyAuth} 
                className="text-[9px] bg-sori-accent-danger text-sori-text-on-accent font-black px-4 py-3 rounded-lg flex items-center gap-2 hover:brightness-110 shadow-lg uppercase tracking-widest"
              >
                <Copy className="h-3 w-3" /> {t("admin:users.copy")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search & Filter row */}
      <div className="flex justify-end mb-6">
        <div className="w-full md:w-80 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-sori-text-dim group-focus-within/input:text-sori-accent-danger transition-colors" />
          <input 
            type="text"
            placeholder={t("admin:users.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-sori-surface-main border border-sori-border-subtle rounded-xl pl-12 pr-5 py-3 text-xs font-bold text-sori-text-strong outline-none focus:border-sori-accent-danger transition-all placeholder:text-sori-text-dim uppercase tracking-widest"
          />
        </div>
      </div>

      {/* Users List */}
      <div className="bg-sori-surface-main border border-sori-border-subtle rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[600px] text-left">
            <thead className="bg-sori-surface-active">
              <tr>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-text-muted">{t("admin:users.table.avatar")}</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-text-muted">{t("admin:users.table.identity")}</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-text-muted">{t("admin:users.table.role")}</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-text-muted text-right">{t("admin:users.table.operations")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sori-border-subtle">
              {filteredUsers.map((u: User, index: number) => (
                <tr 
                  key={u.id} 
                  ref={index === filteredUsers.length - 1 ? lastUserElementRef : null}
                  className="hover:bg-sori-surface-hover transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="w-10 h-10 rounded-xl bg-sori-surface-danger-subtle flex items-center justify-center font-black overflow-hidden border border-sori-accent-danger text-sori-accent-danger shadow-md transition-transform group-hover:scale-105">
                      {u.avatarUrl ? (
                         <img src={u.avatarUrl} className="w-full h-full object-cover" /> 
                      ) : (
                         (u.username?.[0] || u.email?.[0] || "?").toUpperCase()
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-sori-text-strong text-sm group-hover:text-sori-accent-danger transition-colors">{u.username}</div>
                    <div className="text-[10px] text-sori-text-muted">{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[8px] px-2 py-1 rounded-md font-black uppercase tracking-widest border transition-all ${
                      u.role === 'adminpanel' 
                        ? 'bg-sori-surface-danger-subtle border-sori-accent-danger text-sori-accent-danger shadow-sm' 
                        : 'bg-sori-surface-active border-sori-border-strong text-sori-text-muted'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleResetPass(u.id)} 
                        className="p-2.5 rounded-lg bg-sori-surface-active hover:bg-sori-surface-accent-subtle hover:text-sori-accent-secondary border border-transparent hover:border-sori-accent-secondary transition-all font-sans" 
                        title={t("admin:users.tooltips.rotateKeys")}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(u.id)} 
                        className="p-2.5 rounded-lg bg-sori-surface-active hover:bg-sori-surface-danger-subtle hover:text-sori-accent-danger border border-transparent hover:border-sori-accent-danger transition-all group/btn font-sans" 
                        title={t("admin:users.tooltips.terminateProfile")}
                      >
                        <Trash2 className="h-3.5 w-3.5 group-hover/btn:rotate-12 transition-transform" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-sori-text-muted">
                      <Loader2 className="h-6 w-6 animate-spin text-sori-accent-danger" />
                      <p className="text-[10px] font-bold animate-pulse uppercase tracking-[0.2em]">{t("admin:users.loading")}</p>
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-sori-text-dim font-bold uppercase tracking-widest text-[10px]">
                    {t("admin:users.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
