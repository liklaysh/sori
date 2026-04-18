import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../config";
import { User, Mail, Lock, Eye, EyeOff } from "lucide-react";

const Register: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await axios.post(`${API_URL}/auth/register`, {
        username,
        email,
        password,
      });
      navigate("/login");
    } catch (err: any) {
      setError(err.response?.data?.error || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-sori-surface-base text-sori-text-primary font-body min-h-screen relative overflow-hidden flex items-center justify-center p-6">
      <main className="relative z-10 w-full max-w-md">
        <div className="bg-sori-surface-main rounded-[2rem] p-10 shadow-2xl shadow-black border border-sori-border-subtle animate-in fade-in zoom-in-95 duration-500">
          <div className="flex flex-col items-center mb-10">
            <img src="/logo.png" alt="Sori Logo" className="w-20 h-20 mb-4 object-contain shadow-2xl" />
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-sori-text-strong mb-2">Protocol Start</h1>
            <p className="text-sori-text-muted font-label text-sm uppercase tracking-widest font-bold">Create your identity</p>
          </div>

          <form className="space-y-6" onSubmit={handleRegister}>
            {error && (
              <div className="bg-sori-surface-danger-subtle border border-sori-accent-danger text-sori-accent-danger p-4 rounded-xl text-xs text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-black uppercase tracking-widest text-sori-text-muted ml-2">Username</label>
              <div className="group relative transition-all duration-300">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sori-text-muted group-focus-within:text-sori-accent-primary transition-colors pointer-events-none">
                  <User className="h-5 w-5" />
                </div>
                <input
                  className="w-full bg-sori-surface-panel border border-sori-border-subtle rounded-xl py-4 pl-12 pr-4 text-sori-text-strong placeholder:text-sori-text-dim focus:ring-1 focus:ring-sori-accent-primary outline-none font-bold"
                  placeholder="Sanctuary handle"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black uppercase tracking-widest text-sori-text-muted ml-2">Email Address</label>
              <div className="group relative transition-all duration-300">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sori-text-muted group-focus-within:text-sori-accent-primary transition-colors pointer-events-none">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  className="w-full bg-sori-surface-panel border border-sori-border-subtle rounded-xl py-4 pl-12 pr-4 text-sori-text-strong placeholder:text-sori-text-dim focus:ring-1 focus:ring-sori-accent-primary outline-none font-bold"
                  placeholder="contact@relay.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black uppercase tracking-widest text-sori-accent-secondary ml-2">Security Key</label>
              <div className="group relative transition-all duration-300">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sori-text-muted group-focus-within:text-sori-accent-secondary transition-colors pointer-events-none">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  className="w-full bg-sori-surface-panel border border-sori-border-subtle rounded-xl py-4 pl-12 pr-12 text-sori-text-strong placeholder:text-sori-text-dim focus:ring-1 focus:ring-sori-accent-secondary outline-none font-bold tracking-widest"
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

          <p className="mt-8 text-center text-xs text-sori-text-muted font-medium">
            Already have an active link? 
            <button 
              onClick={() => navigate('/login')} 
              className="ml-2 text-sori-accent-primary font-black hover:underline underline-offset-4"
            >
              Access Protocol
            </button>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Register;
