import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@sori/ui";
import { useTranslation } from "react-i18next";
import { useUserStore } from "./store/useUserStore";

const Login = lazy(() => import("./pages/Login"));
const Chat = lazy(() => import("./pages/Chat"));
const AdminPanel = lazy(() => import("./pages/AdminPanel/AdminPanel"));

const RouteLoader = () => {
  const { t } = useTranslation("common");

  return (
    <div className="bg-sori-surface-base min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-sori-accent-primary font-headline text-2xl">{t("loading.sync")}</div>
    </div>
  );
};

function App() {
  const { t } = useTranslation("common");
  const { fetchMe, isLoading, isAuthenticated, user } = useUserStore();

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const isAdmin = user?.role === "adminpanel";

  if (isLoading) {
    return (
      <div className="bg-sori-surface-base min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-sori-accent-primary font-headline text-2xl">{t("loading.sync")}</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoader />}>
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
      </Suspense>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
