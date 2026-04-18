import React, { useEffect, useState } from "react";
import { useAdminApi } from "../../../hooks/useAdminApi";
import { toast } from "sonner";
import { 
  Plus, 
  X, 
  Hash, 
  Volume2, 
  Trash2, 
  Layers, 
  ChevronDown,
  Activity,
  Network,
  Search
} from "lucide-react";
import { Channel } from "../../../types/chat";
import { 
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sori/ui";

import { API_URL } from "../../../config";

export default function ChannelsTab() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [filter, setFilter] = useState<"all" | "text" | "voice">("all");
  
  const [isCreating, setIsCreating] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<"text" | "voice">("text");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const api = useAdminApi();

  const fetchChannels = async () => {
    setIsLoading(true);
    try {
      const res = await api.getChannels();
      if (res.data) setChannels(res.data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load network nodes");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const handleCreate = async () => {
    if (!newChannelName) return;
    try {
      await api.createChannel({
        name: newChannelName,
        type: newChannelType
      });
      setNewChannelName("");
      setIsCreating(false);
      fetchChannels();
      toast.success("Network node established");
    } catch (e) { 
      toast.error("Failed to create node"); 
    }
  };

  const handleDelete = async (id: string) => {
    if(!confirm("Are you sure you want to terminate this node? All data streams within it will be purged.")) return;
    try {
      await api.deleteChannel(id);
      fetchChannels();
      toast.success("Node disconnected");
    } catch (e) { 
      toast.error("Termination failed"); 
    }
  };

  const filteredChannels = channels.filter(c => {
    const matchesFilter = filter === "all" ? true : c.type === filter;
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         c.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-sori-accent-danger pl-6 py-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-sori-accent-danger rounded-lg">
              <Network className="h-5 w-5 text-sori-text-on-accent" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-sori-text-strong uppercase">Network Nodes</h1>
          </div>
          <p className="text-sori-text-muted text-[10px] font-medium tracking-wide uppercase">Define and monitor communication frequencies.</p>
        </div>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className={`
            px-6 py-3 rounded-xl flex items-center gap-2 font-black transition-all active:scale-95 shadow-lg
            ${isCreating 
              ? 'bg-sori-surface-main text-sori-text-muted border border-sori-border-subtle hover:bg-sori-surface-hover' 
              : 'bg-sori-accent-danger text-sori-text-on-accent hover:brightness-110 shadow-lg'}
            text-[10px] uppercase tracking-widest
          `}
        >
          {isCreating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {isCreating ? "Cancel" : "New Node"}
        </button>
      </div>

      {isCreating && (
        <div className="bg-sori-surface-main border border-sori-border-subtle p-6 rounded-3xl shadow-xl animate-in zoom-in-95 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 text-sori-text-strong opacity-5">
            <Layers className="h-24 w-24" />
          </div>
          
          <div className="flex flex-col md:flex-row gap-5 items-end relative z-10">
            <div className="flex-1 w-full">
              <label className="text-[9px] font-black uppercase text-sori-text-muted tracking-[0.2em] ml-1 block mb-2">Node Identity</label>
              <div className="relative group/input">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-sori-text-dim group-focus-within/input:text-sori-accent-danger transition-colors" />
                <input 
                  type="text" 
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="w-full bg-sori-surface-panel border border-sori-border-subtle rounded-xl pl-12 pr-5 py-3 text-sm text-sori-text-strong outline-none focus:border-sori-accent-danger transition-all placeholder:text-sori-text-dim font-medium"
                  placeholder="e.g., general-ops"
                />
              </div>
            </div>
            <div className="w-full md:w-56">
              <label className="text-[9px] font-black uppercase text-sori-text-muted tracking-[0.2em] ml-1 block mb-2">Frequency Type</label>
              <Select value={newChannelType} onValueChange={(v: any) => setNewChannelType(v)}>
                <SelectTrigger className="w-full h-[46px] bg-sori-surface-panel border-sori-border-subtle rounded-xl text-sori-text-strong focus:ring-sori-accent-danger focus:border-sori-accent-danger text-sm font-medium">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-sori-surface-main border-sori-border-subtle text-sori-text-strong">
                  <SelectGroup>
                    <SelectItem value="text" className="focus:bg-sori-accent-danger focus:text-sori-text-on-accent transition-colors">
                      <div className="flex items-center gap-2">
                        <Hash className="h-3.5 w-3.5" />
                        <span>Text Node</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="voice" className="focus:bg-sori-accent-danger focus:text-sori-text-on-accent transition-colors">
                      <div className="flex items-center gap-2">
                        <Volume2 className="h-3.5 w-3.5" />
                        <span>Voice Node</span>
                      </div>
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <button 
              onClick={handleCreate} 
              className="w-full md:w-auto bg-sori-accent-danger text-sori-text-on-accent font-black px-8 py-3.5 rounded-xl hover:brightness-110 shadow-lg active:scale-95 transition-all text-xs uppercase tracking-widest"
            >
              Initialize
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-2 px-1 overflow-x-auto no-scrollbar flex-1">
            {(["all", "text", "voice"] as const).map(t => (
              <button 
                key={t} 
                onClick={() => setFilter(t)}
                className={`
                  px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border
                  ${filter === t 
                    ? 'bg-sori-surface-danger-subtle border-sori-accent-danger text-sori-accent-danger shadow-lg' 
                    : 'bg-sori-surface-active border-transparent text-sori-text-muted hover:text-sori-text-strong hover:bg-sori-surface-hover'}
                `}
              >
                {t === "all" ? "All Channels" : t === "text" ? "Textual" : "Voice"}
              </button>
            ))}
          </div>
          
          <div className="w-full md:w-64 relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sori-text-dim group-focus-within:text-sori-accent-danger transition-colors" />
            <input 
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-sori-surface-main border border-sori-border-subtle rounded-xl pl-10 pr-4 py-2 text-[10px] font-bold text-sori-text-strong outline-none focus:border-sori-accent-danger transition-all placeholder:text-sori-text-dim uppercase tracking-widest"
            />
          </div>
        </div>

        <div className="bg-sori-surface-main border border-sori-border-subtle rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[600px] text-left">
              <thead className="bg-sori-surface-active">
                <tr>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-text-muted">Medium</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-text-muted">Identity</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-text-muted">Node ID</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-text-muted text-right">Ops</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sori-border-subtle">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-sori-text-muted">
                        <Activity className="h-6 w-6 animate-spin text-sori-accent-danger" />
                        <p className="text-[10px] font-bold animate-pulse uppercase tracking-widest">Scanning network...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredChannels.map(c => (
                  <tr key={c.id} className="hover:bg-sori-surface-hover transition-colors group">
                    <td className="px-6 py-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        c.type === 'voice' 
                          ? 'bg-sori-surface-accent-subtle border border-sori-accent-secondary text-sori-accent-secondary' 
                          : 'bg-sori-surface-danger-subtle border border-sori-accent-danger text-sori-accent-danger'
                      }`}>
                        {c.type === 'voice' ? <Volume2 className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-sori-text-strong group-hover:text-sori-accent-danger transition-all flex items-center gap-2 text-sm">
                        {c.name}
                        {c.type === 'voice' && <div className="w-1.5 h-1.5 rounded-full bg-sori-accent-secondary animate-pulse shadow-lg"></div>}
                      </div>
                      <p className="text-[8px] text-sori-text-muted uppercase font-black tracking-widest mt-0.5">{c.type} frequency</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] text-sori-text-muted font-mono bg-sori-surface-base px-2 py-1 rounded-md border border-sori-border-subtle">
                        {c.id}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDelete(c.id)} 
                        className="p-2.5 rounded-lg bg-sori-surface-active hover:bg-sori-surface-danger-subtle hover:text-sori-accent-danger border border-transparent hover:border-sori-accent-danger transition-all invisible group-hover:visible transform translate-x-2 group-hover:translate-x-0"
                        title="Delete Channel"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!isLoading && filteredChannels.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center text-sori-text-muted font-bold text-[10px] uppercase tracking-widest">
                      Zero nodes identified
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

