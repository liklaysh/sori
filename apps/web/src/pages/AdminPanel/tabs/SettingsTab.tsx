import React, { useEffect, useState } from "react";
import { useAdminApi } from "../../../hooks/useAdminApi";
import { toast } from "sonner";
import { 
  Settings, 
  Save, 
  ShieldCheck, 
  Globe, 
  Server, 
  Cpu,
  RefreshCcw,
  Activity,
  Edit2
} from "lucide-react";

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose
} from "@sori/ui";
import { Button } from "@sori/ui";

export default function SettingsTab() {
  const [serverName, setServerName] = useState("");
  const [tempServerName, setTempServerName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const api = useAdminApi();

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const res = await api.getSettings();
        if (res.data) {
          const name = res.data.ServerName || res.data.server_name || "Sori Sanctuary";
          setServerName(name);
          setTempServerName(name);
        }
      } catch (e) { 
        console.error(e); 
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.updateSetting("ServerName", tempServerName);
      setServerName(tempServerName);
      toast.success("Settings saved successfully!");
      document.title = tempServerName;
      setIsDialogOpen(false);
    } catch (e) {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-sori-accent-danger pl-6 py-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-sori-accent-danger rounded-lg">
              <Settings className="h-5 w-5 text-sori-text-on-accent" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-sori-text-strong uppercase">Core Logic</h1>
          </div>
          <p className="text-sori-text-muted text-[10px] font-medium tracking-wide uppercase">Platform-wide behavioral constants.</p>
        </div>
      </div>

      <div className="max-w-3xl">
        {/* Main Settings Panel */}
        <div className="bg-sori-surface-main border border-sori-border-subtle p-6 rounded-3xl shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 text-sori-text-strong">
            <Server className="h-16 w-16" />
          </div>
          
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="h-4 w-4 text-sori-accent-danger" />
              <h2 className="text-[9px] font-black uppercase text-sori-text-muted tracking-[0.2em]">Identity Design</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between bg-sori-surface-base p-4 rounded-2xl border border-sori-border-subtle">
                <div className="space-y-0.5">
                  <label className="text-[9px] font-black text-sori-text-muted uppercase tracking-widest">Platform Alias</label>
                  <p className="text-lg font-black text-sori-text-strong">{isLoading ? "Syncing..." : serverName}</p>
                </div>
                
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="p-2.5 rounded-lg bg-sori-surface-danger-subtle text-sori-accent-danger hover:bg-sori-accent-danger hover:text-sori-text-on-accent transition-all shadow-md active:scale-95"
                      disabled={isLoading}
                    >
                      <Edit2 className="h-3 w-3" />
                      Modify
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-sori-surface-main border-sori-border-subtle text-sori-text-strong shadow-2xl">
                    <DialogHeader>
                      <DialogTitle>Modify Alias</DialogTitle>
                      <DialogDescription className="text-sori-text-muted">
                        Input a new designation for your Sori platform.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <input 
                        type="text" 
                        value={tempServerName}
                        onChange={(e) => setTempServerName(e.target.value)}
                        className="w-full bg-sori-surface-panel border border-sori-border-subtle rounded-xl px-4 py-3 text-sori-text-strong focus:border-sori-accent-danger outline-none transition-all font-bold"
                        placeholder="e.g., Sori Sanctuary"
                      />
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="ghost" className="text-sori-text-muted hover:text-sori-text-strong uppercase text-[10px] font-black tracking-widest">Abort</Button>
                      </DialogClose>
                      <Button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="bg-sori-accent-danger hover:brightness-110 text-sori-text-on-accent font-black uppercase text-[10px] tracking-widest"
                      >
                        {isSaving ? "Syncing..." : "Commit Changes"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              
              <p className="text-[10px] text-sori-text-dim leading-relaxed font-medium">
                This value overrides the "Sori" designation across system headers, metadata, and local broadcasts.
              </p>
            </div>

            <div className="pt-4 border-t border-sori-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2 text-[8px] text-sori-text-dim font-black uppercase tracking-widest italic">
                <Activity className="h-2.5 w-2.5" />
                Latest sync operation successful
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


