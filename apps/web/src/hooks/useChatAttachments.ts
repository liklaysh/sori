import React, { useState, useRef } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { MAX_UPLOAD_SIZE_MB } from "../config";

export interface PendingAttachment {
  id: string;
  file: File;
  url: string;
  progress: number;
  isUploading: boolean;
  result?: {
    fileUrl: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  };
}

export const useChatAttachments = () => {
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const MAX_SIZE = MAX_UPLOAD_SIZE_MB * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error(`File ${file.name} too large! Max is ${MAX_UPLOAD_SIZE_MB}MB.`);
      return;
    }

    if (pendingAttachments.length > 0) {
      clearAttachments();
      toast.info("Only one attachment is supported right now. Previous file was replaced.");
    }

    const attachmentId = Math.random().toString(36).substring(7);
    const previewUrl = URL.createObjectURL(file);
    
    const newAttachment: PendingAttachment = {
      id: attachmentId,
      file,
      url: previewUrl,
      progress: 0,
      isUploading: true
    };

    setPendingAttachments(prev => [...prev, newAttachment]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/upload", formData, {
        headers: { 
          "Content-Type": "multipart/form-data"
        },
        onUploadProgress: (progressEvent: any) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || progressEvent.loaded));
          setPendingAttachments(prev => 
            prev.map(a => a.id === attachmentId ? { ...a, progress: percentCompleted } : a)
          );
        }
      } as any);

      setPendingAttachments(prev => 
        prev.map(a => a.id === attachmentId ? { 
          ...a, 
          isUploading: false, 
          progress: 100,
          result: (res.data as { attachment: { fileUrl: string; fileName: string; fileSize: number; fileType: string; } }).attachment
        } : a)
      );
      
    } catch (err: any) {
      console.error("[Attachments] Upload failed", err);
      toast.error(`Failed to upload: ${file.name}`);
      setPendingAttachments(prev => prev.filter(a => a.id !== attachmentId));
      URL.revokeObjectURL(previewUrl);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removePendingAttachment = (id: string) => {
    setPendingAttachments(prev => {
      const attachment = prev.find(a => a.id === id);
      if (attachment?.url) URL.revokeObjectURL(attachment.url);
      return prev.filter(a => a.id !== id);
    });
  };

  const clearAttachments = () => {
    pendingAttachments.forEach(a => URL.revokeObjectURL(a.url));
    setPendingAttachments([]);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return {
    pendingAttachments,
    dragActive,
    fileInputRef,
    handleFileUpload,
    removePendingAttachment,
    clearAttachments,
    handleDrag,
    handleDrop,
    setDragActive
  };
};
