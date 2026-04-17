import api from "../lib/api";

export function useAdminApi() {
  const request = async (method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", endpoint: string, data?: any) => {
    try {
      const url = `/admin${endpoint}`;
      const res = await api({ method, url, data });
      return { data: res.data, error: null };
    } catch (e: any) {
      return { data: null, error: e.response?.data?.error || e.message };
    }
  };

  return {
    // Dashboard Stats
    getStats: () => request("GET", "/stats"),
    getHealth: () => request("GET", "/health"),
    getCalls: () => request("GET", "/calls"),
    
    // System Settings
    getSettings: () => request("GET", "/settings"),
    updateSetting: (key: string, value: string) => request("PATCH", "/settings", { key, value }),

    // Users
    getUsers: (page = 1, limit = 50) => request("GET", `/users?page=${page}&limit=${limit}`),
    createUser: (email: string) => request("POST", "/users", { email }),
    deleteUser: (id: string) => request("DELETE", `/users/${id}`),
    resetUserPassword: (id: string) => request("POST", `/users/${id}/reset_pwd`),

    // Channels
    getChannels: () => request("GET", "/channels"),
    createChannel: (data: any) => request("POST", "/channels", data),
    updateChannel: (id: string, updates: any) => request("PATCH", `/channels/${id}`, updates),
    deleteChannel: (id: string) => request("DELETE", `/channels/${id}`),

    // Audit and Backups
    getAuditLogs: () => request("GET", "/audit_logs"),
    cleanupAuditLogs: () => request("POST", "/audit_logs/cleanup"),
    getBackups: () => request("GET", "/backup"),
    
    // Storage
    getStorageStats: () => request("GET", "/storage/stats"),
    getStorageFiles: () => request("GET", "/storage/files"),
    deleteStorageFile: (key: string) => request("DELETE", `/storage/files/${encodeURIComponent(key)}`),
  };
}
