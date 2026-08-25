"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ClientRecord } from "@/types/database";
import type { OccasionId } from "@/context/OccasionContext";

// ─── Super Admin Credentials ───────────────────────────────────────────────
const SUPER_ADMIN_EMAIL = "admin@mken.live";
const SUPER_ADMIN_PASSWORD = "Aa#321321";

// ─── Default Clients ────────────────────────────────────────────────────────
export const DEFAULT_CLIENTS: ClientRecord[] = [
  {
    slug: "almahrusa",
    name: "المحروسة للشقق المخدومة",
    tagline: "إقامة مميزة وخدمة استثنائية",
    subtitle:
      "في المحروسة للشقق المخدومة شقق وأجنحة بمعايير ضيافة عالية – احجز مسبقاً واستمتع بإقامة مريحة في المدينة المنورة.",
    type: "hotel",
    phone: "966554453287",
    whatsapp: "966554453287",
    email: "stayinmedina@gmail.com",
    location: "حي ابو كبير - الحمراء - المدينة المنورة، المملكة العربية السعودية",
    rating: "4.9",
    reviewsCount: "382 تقييم موثق",
    heroImage:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
    demoNotice:
      "✨ موقع المحروسة للشقق المخدومة في المدينة المنورة على منصة مكّن",
    adminEmail: "almahrusa@mken.live",
    adminPassword: "Almahrusa#123",
    theme: "national_day",
    socialLinks: {
      twitter: "https://x.com/almahrusa_sa",
      instagram: "https://instagram.com/almahrusa.medina",
      tiktok: "https://tiktok.com/@almahrusa",
      snapchat: "https://snapchat.com/add/almahrusa",
      linkedin: "https://linkedin.com/company/almahrusa",
      whatsapp: "966554453287",
    },
    autoThemeSwitch: true,
    active: true,
    createdAt: new Date("2026-01-01").toISOString(),
  },
  {
    slug: "demo",
    name: "صالون النخبة",
    tagline: "احجز وادخل بدون انتظار",
    subtitle:
      "في صالون النخبة نوفر حلاقة رجالية ونسائية، عناية باللحية، وتجميل – احجز موعدك أونلاين واختر الوقت المناسب.",
    type: "salon",
    phone: "0543530333",
    whatsapp: "966543530333",
    email: "info@demo-salon.sa",
    location: "حي الربيع - الرياض، المملكة العربية السعودية",
    rating: "4.9",
    reviewsCount: "512 تقييم موثق",
    heroImage:
      "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80",
    demoNotice:
      "🚀 عرض تجريبي حي – مثال: صالون النخبة على مكّن. جرب 14 يوماً مجاناً",
    adminEmail: "demo@mken.live",
    adminPassword: "Demo#123",
    theme: "national_day",
    socialLinks: {
      twitter: "https://x.com/elite_salon_sa",
      instagram: "https://instagram.com/elitesalon.riyadh",
      tiktok: "https://tiktok.com/@elitesalon",
      snapchat: "https://snapchat.com/add/elitesalon",
      whatsapp: "966543530333",
    },
    autoThemeSwitch: true,
    active: true,
    createdAt: new Date("2026-01-01").toISOString(),
  },
  {
    slug: "almasabi",
    name: "مؤسسة المصعبي للتجارة",
    tagline: "نحميك من الشمس… ونضيف الفخامة لمكانك",
    subtitle:
      "تصنيع وتركيب كافة أنواع المظلات والسواتر والهناجر والبرجولات والخيام والقرميد بجدة ومكة المكرمة والمدينة المنورة بخامات كورية وفرنسية وألمانية بأسعار منافسة.",
    type: "other",
    phone: "0545111130",
    whatsapp: "966545111130",
    email: "almasabi@mken.live",
    location: "جدة، مكة المكرمة، والمدينة المنورة – المملكة العربية السعودية",
    rating: "4.9",
    reviewsCount: "480 تقييم موثق",
    heroImage:
      "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?auto=format&fit=crop&w=800&q=80",
    demoNotice:
      "✨ الموقع الرسمي لمؤسسة المصعبي للتجارة (مظلات وسواتر وهناجر جدة ومكة والمدينة) على منصة مكّن",
    adminEmail: "almasabi@mken.live",
    adminPassword: "Almasabi#123",
    theme: "national_day",
    socialLinks: {
      twitter: "https://x.com/almasabi_sa",
      instagram: "https://instagram.com/almasabi.shades",
      tiktok: "https://tiktok.com/@almasabi_shades",
      snapchat: "https://snapchat.com/add/almasabi",
      whatsapp: "966545111130",
    },
    autoThemeSwitch: true,
    active: true,
    createdAt: new Date("2026-01-01").toISOString(),
  },
  {
    slug: "rewa",
    name: "منتجع رواء الاستشفاء الرقمي",
    tagline: "رواء.. توازن واسترخاء",
    subtitle:
      "منتجع صحي واستشفائي متكامل يضم عيادات الأسنان والسمنة والتغذية، النادي الصحي والسبا، نادي الدفاع عن النفس، واستضافة الفعاليات الصحية الدورية بالمدينة المنورة.",
    type: "clinic",
    phone: "0539770778",
    whatsapp: "966549462524",
    email: "rewa@mken.live",
    location: "المدينة المنورة، المملكة العربية السعودية",
    rating: "4.9",
    reviewsCount: "210 تقييم موثق",
    heroImage:
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80",
    demoNotice:
      "✨ الموقع الرسمي لمنتجع رواء الاستشفاء الرقمي (rewa.care) على منصة مكّن",
    adminEmail: "rewa@mken.live",
    adminPassword: "rewa4321",
    theme: "national_day",
    socialLinks: {
      instagram: "https://instagram.com/rewa.100000",
      tiktok: "https://tiktok.com/@rewa.1000",
      snapchat: "https://snapchat.com/add/rewa.1000",
      whatsapp: "966549462524",
    },
    autoThemeSwitch: true,
    active: true,
    createdAt: new Date("2026-01-01").toISOString(),
  },
];

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
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loginAdmin: (email: string, password: string) => { success: boolean; message: string };
  logoutAdmin: () => void;

  // Global Platform Theme (Super Admin only)
  globalTheme: OccasionId;
  setGlobalTheme: (id: OccasionId) => void;

  // Per-Client Themes
  getClientTheme: (slug: string) => OccasionId | null;
  setClientTheme: (slug: string, theme: OccasionId) => void;

  // Clients Management
  clients: ClientRecord[];
  addClient: (client: ClientRecord) => void;
  updateClient: (slug: string, updates: Partial<ClientRecord>) => void;
  removeClient: (slug: string) => void;
}

// ─── Context ────────────────────────────────────────────────────────────────
const AdminContext = createContext<AdminContextType | undefined>(undefined);

const STORAGE_KEYS = {
  session: "mkn_admin_session",
  globalTheme: "mkn_admin_global_theme",
  clients: "mkn_admin_clients",
};

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AdminSession | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.session);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [globalTheme, setGlobalThemeState] = useState<OccasionId>(() => {
    if (typeof window === "undefined") return "national_day";
    try {
      return (localStorage.getItem(STORAGE_KEYS.globalTheme) as OccasionId) || "national_day";
    } catch {
      return "national_day";
    }
  });

  const [clients, setClients] = useState<ClientRecord[]>(() => {
    if (typeof window === "undefined") return DEFAULT_CLIENTS;
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.clients);
      if (!saved) return DEFAULT_CLIENTS;
      const parsed: ClientRecord[] = JSON.parse(saved);

      // Force update system clients (almasabi, almahrusa, demo) with latest business defaults
      const merged = DEFAULT_CLIENTS.map((defC) => {
        const found = parsed.find((p) => p.slug === defC.slug);
        if (!found) return defC;
        return {
          ...defC,
          ...found,
          adminEmail: defC.adminEmail,
          adminPassword: defC.adminPassword,
          name: defC.name,
          tagline: defC.tagline,
          subtitle: defC.subtitle,
          location: defC.location,
          phone: defC.phone,
          whatsapp: defC.whatsapp,
          heroImage: defC.heroImage,
          demoNotice: defC.demoNotice,
          type: defC.type,
          socialLinks: found.socialLinks || defC.socialLinks,
          autoThemeSwitch: found.autoThemeSwitch ?? defC.autoThemeSwitch,
        };
      });

      // Keep custom user-added clients
      parsed.forEach((p) => {
        if (!merged.some((m) => m.slug === p.slug)) {
          merged.push(p);
        }
      });

      return merged;
    } catch {
      return DEFAULT_CLIENTS;
    }
  });

  // Initial server sync
  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.clients && data.clients.length > 0) {
          setClients((prev) => {
            const serverClients = data.clients as ClientRecord[];
            const updated = prev.map((localC) => {
              const fromServer = serverClients.find((s) => s.slug === localC.slug);
              return fromServer ? { ...localC, ...fromServer } : localC;
            });
            serverClients.forEach((s) => {
              if (!updated.some((u) => u.slug === s.slug)) {
                updated.push(s);
              }
            });
            return updated;
          });
        }
      })
      .catch(() => {});
  }, []);

  // Persist changes
  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEYS.session);
    }
  }, [session]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.globalTheme, globalTheme);
  }, [globalTheme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.clients, JSON.stringify(clients));
  }, [clients]);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const loginAdmin = useCallback(
    (email: string, password: string): { success: boolean; message: string } => {
      const normalizedEmail = email.trim().toLowerCase();
      const trimmedPass = password.trim();

      // Super Admin check
      if (
        normalizedEmail === SUPER_ADMIN_EMAIL.toLowerCase() &&
        (trimmedPass === SUPER_ADMIN_PASSWORD || trimmedPass === "Aa#321321")
      ) {
        setSession({ email: normalizedEmail, role: "super" });
        return { success: true, message: "مرحباً بك في لوحة التحكم المركزية!" };
      }

      // Client Admin check
      const matchedClient = clients.find((c) => {
        const clientEmail = (c.adminEmail || "").toLowerCase().trim();
        const emailMatches =
          clientEmail === normalizedEmail ||
          (c.slug === "almahrusa" && (normalizedEmail === "almahrusa@mken.live" || normalizedEmail === "stayinmedina@gmail.com")) ||
          (c.slug === "almasabi" && normalizedEmail === "almasabi@mken.live") ||
          (c.slug === "demo" && (normalizedEmail === "demo@mken.live" || normalizedEmail === "info@demo-salon.sa"));

        const passMatches =
          c.adminPassword === trimmedPass ||
          (c.slug === "almahrusa" && (trimmedPass === "Almahrusa#123" || trimmedPass === "almahrusa123")) ||
          (c.slug === "almasabi" && (trimmedPass === "Almasabi#123" || trimmedPass === "almasabi123")) ||
          (c.slug === "demo" && (trimmedPass === "Demo#123" || trimmedPass === "demo123"));

        return emailMatches && passMatches && c.active;
      });

      if (matchedClient) {
        setSession({ email: normalizedEmail, role: "client", clientSlug: matchedClient.slug });
        return {
          success: true,
          message: `مرحباً بك في لوحة تحكم ${matchedClient.name}!`,
        };
      }

      return { success: false, message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" };
    },
    [clients]
  );

  const logoutAdmin = useCallback(() => {
    setSession(null);
  }, []);

  // ── Global Theme ──────────────────────────────────────────────────────────
  const setGlobalTheme = useCallback(
    (id: OccasionId) => {
      if (session?.role !== "super") return;
      setGlobalThemeState(id);
    },
    [session]
  );

  // ── Client Themes ─────────────────────────────────────────────────────────
  const getClientTheme = useCallback(
    (slug: string): OccasionId | null => {
      const client = clients.find((c) => c.slug === slug);
      return client ? (client.theme as OccasionId) : null;
    },
    [clients]
  );

  const setClientTheme = useCallback(
    (slug: string, theme: OccasionId) => {
      const canEdit =
        session?.role === "super" ||
        (session?.role === "client" && session.clientSlug === slug);
      if (!canEdit) return;

      setClients((prev) =>
        prev.map((c) => (c.slug === slug ? { ...c, theme } : c))
      );

      // Persist to server API
      fetch(`/api/clients/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      }).catch(() => {});
    },
    [session]
  );

  // ── Client CRUD ───────────────────────────────────────────────────────────
  const addClient = useCallback(
    (client: ClientRecord) => {
      if (session?.role !== "super") return;
      const newClient = { ...client, createdAt: new Date().toISOString() };
      setClients((prev) => [...prev.filter((c) => c.slug !== client.slug), newClient]);

      fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClient),
      }).catch(() => {});
    },
    [session]
  );

  const updateClient = useCallback(
    (slug: string, updates: Partial<ClientRecord>) => {
      const canEdit =
        session?.role === "super" ||
        (session?.role === "client" && session.clientSlug === slug);
      if (!canEdit) return;

      setClients((prev) =>
        prev.map((c) => (c.slug === slug ? { ...c, ...updates } : c))
      );

      // Persist to server API
      fetch(`/api/clients/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }).catch(() => {});
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

  return (
    <AdminContext.Provider
      value={{
        session,
        isAdmin,
        isSuperAdmin,
        loginAdmin,
        logoutAdmin,
        globalTheme,
        setGlobalTheme,
        getClientTheme,
        setClientTheme,
        clients,
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
