import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
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
      toast.success("Identity profile generated");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Confirm permanent deletion of this citizen profile? This operation is irreversible.")) return;
    
    const { error } = await api.deleteUser(id);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Profile terminated");
      fetchUsers(true);
    }
  };

  const handleResetPass = async (id: string) => {
    if (!confirm("Regenerate security credentials for this user?")) return;
    
    const { data, error } = await api.resetUserPassword(id);
    if (error) {
      toast.error(error);
    } else if (data) {
      setGeneratedAuth({ email: users.find((u: User) => u.id === id)?.email || "User", pass: data.temporaryPassword });
      toast.success("Security keys rotated");
    }
  };

  const copyAuth = () => {
    if (generatedAuth) {
      navigator.clipboard.writeText(generatedAuth.pass);
      toast.success("Password secured to clipboard");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-l-4 border-sori-error pl-6 py-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-sori-error rounded-lg shadow-[0_0_15px_rgba(237,66,69,0.3)]">
              <Users className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-white uppercase">User Registry</h1>
          </div>
          <p className="text-gray-400 text-[10px] font-medium tracking-wide uppercase opacity-70">Provision identities and manage access levels.</p>
        </div>
      </div>

      {/* Provision New Account */}
      <div className="bg-sori-sidebar border border-white/5 p-6 rounded-3xl shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-6 opacity-[0.02] text-white">
          <UserPlus className="h-24 w-24" />
        </div>
        
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-4 w-4 text-sori-error" />
          <h2 className="text-[9px] font-black uppercase text-gray-500 tracking-[0.2em]">Generate New Identity</h2>
        </div>
        
        <form onSubmit={handleCreateUser} className="flex flex-col md:flex-row gap-3 relative z-10">
          <div className="flex-1 relative group/input">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within/input:text-sori-error transition-colors" />
            <input 
              type="email" 
              placeholder="Citizen Email Address" 
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full bg-black/40 border border-white/5 rounded-xl pl-12 pr-5 py-3 text-sm text-white hover:border-sori-error/30 focus:border-sori-error outline-none transition-all placeholder:text-gray-600 font-medium"
            />
          </div>
          <button 
            type="submit" 
            className="bg-sori-error text-white font-black px-8 py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-sori-error/10 text-xs uppercase tracking-widest"
          >
            Generate
          </button>
        </form>

        {generatedAuth && (
          <div className="mt-6 bg-black/40 border-l-2 border-sori-error/50 p-4 rounded-xl relative animate-in zoom-in-95">
            <button 
              onClick={() => setGeneratedAuth(null)}
              className="absolute top-3 right-3 text-gray-500 hover:text-white transition-all transform hover:rotate-90"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-3 w-3 text-sori-error" />
              <h3 className="text-sori-error font-black uppercase tracking-widest text-[8px]">Security Credentials</h3>
            </div>
            <p className="text-[10px] font-medium mb-3 text-gray-400">Save this immediately. Keys are not stored in plain text.</p>
            
            <div className="flex items-center gap-3">
              <div className="flex-1 font-mono text-sm bg-black/60 p-3 rounded-lg select-all tracking-wider text-green-400 border border-white/5 flex items-center justify-between">
                <span>{generatedAuth.pass}</span>
                <button onClick={copyAuth} className="text-gray-500 hover:text-sori-error transition-colors">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <button 
                onClick={copyAuth} 
                className="text-[9px] bg-sori-error text-white font-black px-4 py-3 rounded-lg flex items-center gap-2 hover:brightness-110 shadow-lg shadow-sori-error/10 uppercase tracking-widest"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search & Filter row */}
      <div className="flex justify-end mb-6">
        <div className="w-full md:w-80 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within/input:text-sori-error transition-colors" />
          <input 
            type="text"
            placeholder="Search citizen registry..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-sori-sidebar border border-white/5 rounded-xl pl-12 pr-5 py-3 text-xs font-bold text-white outline-none focus:border-sori-error transition-all placeholder:text-gray-600 uppercase tracking-widest"
          />
        </div>
      </div>

      {/* Users List */}
      <div className="bg-sori-sidebar border border-white/5 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[600px] text-left">
            <thead className="bg-white/5">
              <tr>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-500">Avatar</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-500">Identity</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-500">Role</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-500 text-right">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((u: User, index: number) => (
                <tr 
                  key={u.id} 
                  ref={index === filteredUsers.length - 1 ? lastUserElementRef : null}
                  className="hover:bg-white/[0.02] transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="w-10 h-10 rounded-xl bg-sori-error/10 flex items-center justify-center font-black overflow-hidden border border-sori-error/20 text-sori-error shadow-md transition-transform group-hover:scale-105">
                      {u.avatarUrl ? (
                         <img src={u.avatarUrl} className="w-full h-full object-cover" /> 
                      ) : (
                         (u.username?.[0] || u.email?.[0] || "?").toUpperCase()
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-white text-sm group-hover:text-sori-error transition-colors">{u.username}</div>
                    <div className="text-[10px] text-gray-500">{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[8px] px-2 py-1 rounded-md font-black uppercase tracking-widest border transition-all ${
                      u.role === 'adminpanel' 
                        ? 'bg-sori-error/10 border-sori-error/30 text-sori-error shadow-[0_0_10px_rgba(237,66,69,0.1)]' 
                        : 'bg-white/5 border-white/10 text-gray-500'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleResetPass(u.id)} 
                        className="p-2.5 rounded-lg bg-white/5 hover:bg-green-400/10 hover:text-green-400 border border-transparent hover:border-green-400/20 transition-all font-sans" 
                        title="Rotate Keys"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(u.id)} 
                        className="p-2.5 rounded-lg bg-white/5 hover:bg-sori-error/10 hover:text-sori-error border border-transparent hover:border-sori-error/20 transition-all group/btn font-sans" 
                        title="Terminate Profile"
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
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                      <Loader2 className="h-6 w-6 animate-spin text-sori-error" />
                      <p className="text-[10px] font-bold animate-pulse uppercase tracking-[0.2em]">Syncing citizens...</p>
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-gray-600 font-bold uppercase tracking-widest text-[10px]">
                    No records identified
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
