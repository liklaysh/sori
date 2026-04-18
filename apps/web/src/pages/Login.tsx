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
    <div className="bg-sori-surface-base text-sori-text-primary font-body min-h-screen relative overflow-hidden flex items-center justify-center p-6">
      <main className="relative z-10 w-full max-w-md">
        <div className="bg-sori-surface-main rounded-[2rem] p-10 shadow-2xl shadow-black border border-sori-border-subtle animate-in fade-in zoom-in-95 duration-500">
          {/* Logo and Header */}
          <div className="flex flex-col items-center mb-10">
            <img src="/logo.png" alt="Sori Logo" className="w-20 h-20 mb-4 object-contain shadow-2xl" />
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-sori-text-strong mb-2">Sori</h1>
            <p className="text-sori-text-muted font-label text-sm uppercase tracking-widest font-bold">Protocol Access</p>
          </div>

          {/* Login Form */}
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-sori-surface-danger-subtle border border-sori-accent-danger text-sori-accent-danger p-4 rounded-xl text-xs text-center animate-in shake-in duration-300">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label className="block text-xs font-black uppercase tracking-widest text-sori-accent-secondary ml-2" htmlFor="identity">
                Email or Username
              </label>
              <div className="group relative transition-all duration-300">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sori-text-muted group-focus-within:text-primary transition-colors pointer-events-none">
                  <User className="h-5 w-5" />
                </div>
                <input
                  className="w-full bg-sori-surface-panel border border-sori-border-subtle rounded-xl py-4 pl-12 pr-4 text-sori-text-strong placeholder:text-sori-text-dim focus:ring-1 focus:ring-primary transition-all outline-none font-bold"
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
                <label className="block text-xs font-black uppercase tracking-widest text-sori-accent-secondary ml-2" htmlFor="password">
                  Password
                </label>
              </div>
              <div className="group relative transition-all duration-300">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sori-text-muted group-focus-within:text-secondary transition-colors pointer-events-none">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  className="w-full bg-sori-surface-panel border border-sori-border-subtle rounded-xl py-4 pl-12 pr-12 text-sori-text-strong placeholder:text-sori-text-dim focus:ring-1 focus:ring-secondary transition-all outline-none font-bold tracking-widest"
                  id="password"
                  placeholder="••••••••••••"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-sori-text-muted hover:text-sori-text-strong transition-colors p-1"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              className="w-full bg-sori-accent-primary text-sori-text-on-primary font-headline font-black py-4 rounded-xl shadow-lg active:scale-[0.98] transition-all duration-300 disabled:bg-sori-surface-active"
              type="submit"
              disabled={loading}
            >
              {loading ? "Establishing Link..." : "Initialize Profile"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default Login;
