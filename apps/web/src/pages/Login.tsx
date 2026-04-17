import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api"; // Updated to use centralized api
import { useUserStore } from "../store/useUserStore"; // Added user store
import { User, Lock, Eye, EyeOff } from "lucide-react";

const Login: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const setUser = useUserStore(s => s.setUser);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await api.post(`/auth/login`, {
        email,
        password,
      });

      const data = response.data as { user: any };
      // Token is now in HttpOnly cookie, we only store user in Zustand
      setUser(data.user);
      
      if (data.user.role === "adminpanel") {
        navigate("/admin");
      } else {
        navigate("/chat");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to login. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-sori-server text-on-background font-body min-h-screen selection:bg-secondary/30 relative overflow-hidden flex items-center justify-center p-6">
      <main className="relative z-10 w-full max-w-md">
        <div className="bg-sori-chat rounded-[2rem] p-10 shadow-2xl shadow-black/50 border border-white/5 animate-in fade-in zoom-in-95 duration-500">
          {/* Logo and Header */}
          <div className="flex flex-col items-center mb-10">
            <img src="/logo.png" alt="Sori Logo" className="w-20 h-20 mb-4 object-contain shadow-2xl" />
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-white mb-2">Sori</h1>
            <p className="text-on-surface-variant font-label text-sm opacity-60">Authentication Required</p>
          </div>

          {/* Login Form */}
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-sori-error/10 border border-sori-error/20 text-sori-error p-4 rounded-xl text-xs text-center animate-in shake-in duration-300">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label className="block text-xs font-black uppercase tracking-widest text-primary/60 ml-2" htmlFor="identity">
                Email or Username
              </label>
              <div className="group relative transition-all duration-300">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors pointer-events-none">
                  <User className="h-5 w-5" />
                </div>
                <input
                  className="w-full bg-sori-server border border-white/5 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-white/10 focus:ring-1 focus:ring-primary/50 transition-all outline-none font-bold"
                  id="identity"
                  placeholder="Enter email or username"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-2">
                <label className="block text-xs font-black uppercase tracking-widest text-secondary/60" htmlFor="password">
                  Password
                </label>
              </div>
              <div className="group relative transition-all duration-300">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-secondary transition-colors pointer-events-none">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  className="w-full bg-sori-server border border-white/5 rounded-xl py-4 pl-12 pr-12 text-white placeholder:text-white/10 focus:ring-1 focus:ring-secondary/50 transition-all outline-none font-bold tracking-widest"
                  id="password"
                  placeholder="••••••••••••"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-white transition-colors p-1"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              className="w-full bg-primary text-white font-headline font-black py-4 rounded-xl shadow-[0_0_20px_rgba(147,150,255,0.2)] hover:shadow-primary/30 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
              type="submit"
              disabled={loading}
            >
              <span className="relative z-10">{loading ? "Synchronizing..." : "Login"}</span>
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default Login;
