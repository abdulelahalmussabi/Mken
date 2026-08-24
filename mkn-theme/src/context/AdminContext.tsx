"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ClientRecord } from "@/types/database";
import type { OccasionId } from "@/context/OccasionContext";
import {
  SAAS_FEATURES_LOCKED,
  SAAS_FEATURES_UNLIMITED,
  type SaasFeatures,
} from "@/lib/mken/saas";

// ─── Types ──────────────────────────────────────────────────────────────────
export type AdminRole = "super" | "client" | null;

export interface AdminSession {
  email: string;
  role: AdminRole;
  clientSlug?: string;
}

interface AdminContextType {
  // Auth
  session: AdminSession | null;
  authLoading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loginAdmin: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logoutAdmin: () => Promise<void>;
  saas: SaasFeatures;

  // Global Platform Theme (Super Admin only)
  globalTheme: OccasionId;
  setGlobalTheme: (id: OccasionId) => Promise<SaveResult>;

  // Per-Client Themes
  getClientTheme: (slug: string) => OccasionId | null;
  setClientTheme: (slug: string, theme: OccasionId) => Promise<SaveResult>;

  // Clients Management
  clients: ClientRecord[];
  clientsLoading: boolean;
  addClient: (client: ClientRecord) => Promise<SaveResult>;
  updateClient: (slug: string, updates: Partial<ClientRecord>) => Promise<SaveResult>;
  removeClient: (slug: string) => void;
}

export interface SaveResult {
  success: boolean;
  message?: string;
}

// ─── Context ────────────────────────────────────────────────────────────────
const AdminContext = createContext<AdminContextType | undefined>(undefined);

const PLATFORM_DEFAULT: OccasionId = "national_day";

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // The session lives in an HttpOnly cookie; the browser only mirrors what the server reports.
  const [session, setSession] = useState<AdminSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [saas, setSaas] = useState<SaasFeatures | null>(null);

  const [globalTheme, setGlobalThemeState] = useState<OccasionId>(PLATFORM_DEFAULT);

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);

  // Hydrate the session from the signed cookie
  useEffect(() => {
    fetch("/api/admin/session")
      .then((res) => res.json())
      .then((data) => {
        setSession(data.session ?? null);
        setSaas(data.features ?? null);
      })
      .catch(() => {
        setSession(null);
        setSaas(null);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  // Directory is admin-only. Visitors never receive or cache the full tenant list.
  useEffect(() => {
    try {
      localStorage.removeItem("mkn_admin_clients");
    } catch {
      // ignore
    }

    if (authLoading) return;
    if (!session) {
      setClients([]);
      setClientsLoading(false);
      return;
    }

    let cancelled = false;
    setClientsLoading(true);
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setClients(data.success && Array.isArray(data.clients) ? data.clients : []);
      })
      .catch(() => {
        if (!cancelled) setClients([]);
      })
      .finally(() => {
        if (!cancelled) setClientsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, session]);

  useEffect(() => {
    try {
      localStorage.removeItem("mkn_admin_global_theme");
    } catch {
      // ignore
    }

    let cancelled = false;
    fetch("/api/platform/theme")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data?.success) return;
        if (typeof data.theme === "string") setGlobalThemeState(data.theme as OccasionId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const loginAdmin = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
      try {
        let res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });

        // Dual fallback to /api/v1/auth/admin-login
        if (!res.ok) {
          try {
            const fallbackRes = await fetch("/api/v1/auth/admin-login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: email.trim(), password }),
            });
            if (fallbackRes.ok) {
              res = fallbackRes;
            }
          } catch {
            // ignore fallback error
          }
        }

        const data = await res.json();

        if (!res.ok || !data.success) {
          return { success: false, message: data.message || "تعذّر تسجيل الدخول" };
        }

        setSession({ email: data.email, role: data.role, clientSlug: data.clientSlug });
        setSaas(data.features ?? null);
        return { success: true, message: data.message };
      } catch {
        return { success: false, message: "تعذّر الاتصال بالخادم" };
      }
    },
    []
  );

  const logoutAdmin = useCallback(async () => {
    await fetch("/api/admin/session", { method: "DELETE" }).catch(() => {});
    setSession(null);
    setSaas(null);
    setClients([]);
  }, []);

  // ── Global Theme ──────────────────────────────────────────────────────────
  const setGlobalTheme = useCallback(
    async (id: OccasionId): Promise<SaveResult> => {
      if (session?.role !== "super") return { success: false, message: "غير مصرح" };

      const previous = globalTheme;
      setGlobalThemeState(id);

      try {
        const res = await fetch("/api/platform/theme", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme: id }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setGlobalThemeState(previous);
          return { success: false, message: data.message || "تعذّر حفظ الثيم" };
        }
        try {
          window.dispatchEvent(new CustomEvent("mken-platform-theme", { detail: id }));
        } catch {
          // ignore
        }
        return { success: true };
      } catch {
        setGlobalThemeState(previous);
        return { success: false, message: "تعذّر الاتصال بالخادم" };
      }
    },
    [session, globalTheme]
  );

  // ── Client Themes ─────────────────────────────────────────────────────────
  const getClientTheme = useCallback(
    (slug: string): OccasionId | null => {
      const client = clients.find((c) => c.slug === slug);
      return client ? (client.theme as OccasionId) : null;
    },
    [clients]
  );

  // ── Client CRUD ───────────────────────────────────────────────────────────
  /** Local state follows the server: nothing is shown as saved until it is. */
  const updateClient = useCallback(
    async (slug: string, updates: Partial<ClientRecord>): Promise<SaveResult> => {
      const canEdit =
        session?.role === "super" ||
        (session?.role === "client" && session.clientSlug === slug);
      if (!canEdit) return { success: false, message: "غير مصرح بتعديل هذه المنشأة" };

      try {
        const res = await fetch(`/api/clients/${slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          return { success: false, message: data.message || "تعذّر حفظ التغييرات" };
        }

        setClients((prev) =>
          prev.map((c) => (c.slug === slug ? { ...c, ...data.client } : c))
        );
        return { success: true };
      } catch {
        return { success: false, message: "تعذّر الاتصال بالخادم" };
      }
    },
    [session]
  );

  const setClientTheme = useCallback(
    (slug: string, theme: OccasionId) => updateClient(slug, { theme }),
    [updateClient]
  );

  const addClient = useCallback(
    async (client: ClientRecord): Promise<SaveResult> => {
      if (session?.role !== "super") return { success: false, message: "غير مصرح" };

      try {
        const res = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(client),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          return { success: false, message: data.message || "تعذّر إضافة المنشأة" };
        }

        setClients((prev) => [...prev.filter((c) => c.slug !== data.client.slug), data.client]);
        return { success: true };
      } catch {
        return { success: false, message: "تعذّر الاتصال بالخادم" };
      }
    },
    [session]
  );

  const removeClient = useCallback(
    (slug: string) => {
      if (session?.role !== "super") return;
      setClients((prev) => prev.filter((c) => c.slug !== slug));
    },
    [session]
  );

  const isAdmin = !!session;
  const isSuperAdmin = session?.role === "super";
  const saasFeatures = saas ?? (isSuperAdmin ? SAAS_FEATURES_UNLIMITED : SAAS_FEATURES_LOCKED);

  return (
    <AdminContext.Provider
      value={{
        session,
        authLoading,
        isAdmin,
        isSuperAdmin,
        loginAdmin,
        logoutAdmin,
        saas: saasFeatures,
        globalTheme,
        setGlobalTheme,
        getClientTheme,
        setClientTheme,
        clients,
        clientsLoading,
        addClient,
        updateClient,
        removeClient,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) throw new Error("useAdmin must be used within an AdminProvider");
  return context;
};
