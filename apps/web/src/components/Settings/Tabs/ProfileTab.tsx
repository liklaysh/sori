import React, { useState, useRef } from "react";
import { toast } from "sonner";
import { useUserStore } from "../../../store/useUserStore";
import { 
  User as UserIcon, 
  Camera, 
  Loader2, 
  Edit2, 
  Mail, 
  Shield 
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter, 
  DialogTrigger, 
  DialogClose, 
  Button 
} from "@sori/ui";
import { API_URL } from "../../../config";
import api from "../../../lib/api";
import { getAvatarUrl } from "../../../utils/avatar";

export const ProfileTab: React.FC = () => {
  const { user, setUser } = useUserStore();
  const [tempNickname, setTempNickname] = useState(user?.username || "");
  const [tempEmail, setTempEmail] = useState(user?.email || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("File is too large! Maximum 50MB.");
      return;
    }

    setIsUploadingAvatar(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      // Step 1: Upload to general upload endpoint
      const uploadRes = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const uploadData = uploadRes.data as { fileUrl: string };
      const newAvatarUrl = uploadData.fileUrl;
      
      // Step 2: Update user profile with new URL
      const updateRes = await api.patch("/users/me", { avatarUrl: newAvatarUrl });
      setUser(updateRes.data as any);
      toast.success("Avatar updated!");
    } catch (err) {
      toast.error("Failed to upload avatar.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async () => {
    setIsUpdating(true);
    try {
      const res = await api.patch("/users/me", { username: tempNickname, email: tempEmail });
      setUser(res.data as any);
      toast.success("Profile updated!");
      setIsProfileDialogOpen(false);
    } catch (err) {
      toast.error("Update failed.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-8 md:space-y-12 animate-in slide-in-from-bottom-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-white mb-2">My Account</h1>
        <p className="text-gray-400 text-sm">Manage your identity in Sanctuary.</p>
      </div>

      <div className="bg-sori-sidebar rounded-[2.5rem] p-6 md:p-10 border border-white/5 space-y-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-[0.02] text-white">
          <UserIcon className="h-48 w-48" />
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-8 relative z-10">
          <input type="file" className="hidden" ref={fileInputRef} accept="image/*" onChange={handleAvatarUpload} />
          <div className="relative group cursor-pointer shrink-0" onClick={() => fileInputRef.current?.click()}>
             <div className="w-32 h-32 rounded-[2.5rem] bg-sori-primary/20 flex items-center justify-center text-5xl font-black text-sori-primary shadow-2xl overflow-hidden border border-sori-primary/20 transition-transform group-hover:scale-95 duration-500">
                {isUploadingAvatar ? (
                  <Loader2 className="h-10 w-10 animate-spin" />
                ) : getAvatarUrl(user.avatarUrl) ? (
                  <img src={getAvatarUrl(user.avatarUrl)!} className="w-full h-full object-cover" />
                ) : (
                  user.username?.[0]?.toUpperCase()
                )}
             </div>
             <div className="absolute inset-0 bg-sori-bg/80 opacity-0 group-hover:opacity-100 rounded-[2.5rem] flex items-center justify-center transition-all duration-500 border border-sori-primary/40">
                <Camera className="h-8 w-8 text-white animate-bounce" />
             </div>
          </div>

          <div className="flex-1 w-full space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-3 w-3 text-sori-primary" />
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Username</label>
                </div>
                <p className="text-xl font-black text-white tracking-tight">{user.username}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="h-3 w-3 text-sori-secondary" />
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Email</label>
                </div>
                <p className="text-xl font-black text-white tracking-tight">{user.email || "Not specified"}</p>
              </div>
            </div>

            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-sori-primary hover:bg-sori-primary/90 text-white font-black px-8 py-4 rounded-2xl shadow-lg shadow-sori-primary/20 active:scale-95 transition-all text-xs gap-2">
                  <Edit2 className="h-3.5 w-3.5" />
                  Edit Profile
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-sori-sidebar border-white/5 text-white max-w-md rounded-[2.5rem] p-8 z-[2001]">
                <DialogHeader className="mb-6">
                  <DialogTitle className="text-xl">Personal Information</DialogTitle>
                  <DialogDescription className="text-gray-400">Visibility: Residents Only.</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">New Username</label>
                    <input type="text" value={tempNickname} onChange={(e) => setTempNickname(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl px-5 py-3.5 text-white focus:border-sori-primary outline-none transition-all font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Email Address</label>
                    <input type="email" value={tempEmail} onChange={(e) => setTempEmail(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl px-5 py-3.5 text-white focus:border-sori-secondary outline-none transition-all font-bold" />
                  </div>
                </div>
                <DialogFooter className="mt-8 flex flex-col sm:flex-row gap-3">
                  <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                  <Button onClick={handleUpdateProfile} disabled={isUpdating}>{isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
};
