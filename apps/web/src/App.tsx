import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Chat from "./pages/Chat";
import AdminPanel from "./pages/AdminPanel/AdminPanel";
import { Toaster } from "@sori/ui";
import { useUserStore } from "./store/useUserStore";

function App() {
  const { fetchMe, isLoading, isAuthenticated, user } = useUserStore();

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const isAdmin = user?.role === "adminpanel";

  if (isLoading) {
    return (
      <div className="bg-sori-surface-base min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-sori-accent-primary font-headline text-2xl">Synchronizing Sori...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={
            isAuthenticated 
              ? <Navigate to={isAdmin ? "/admin" : "/chat"} replace /> 
              : <Login />
          } 
        />
        <Route 
          path="/chat" 
          element={
            isAuthenticated 
              ? (isAdmin ? <Navigate to="/admin" replace /> : <Chat />)
              : <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/admin" 
          element={
            isAuthenticated 
              ? (isAdmin ? <AdminPanel /> : <Navigate to="/chat" replace />)
              : <Navigate to="/login" replace />
          } 
        />
        <Route path="/" element={<Navigate to={isAuthenticated ? (isAdmin ? "/admin" : "/chat") : "/login"} replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
