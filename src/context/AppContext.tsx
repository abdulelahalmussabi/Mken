"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Order, Message, Profile } from "@/types/database";
import {
  isLegacyMockVisitor,
  profileFromAuthUser,
} from "@/lib/auth/visitor-oauth";

interface AppContextType {
  user: Profile | null;
  setUser: (user: Profile | null) => void;
  orders: Order[];
  addOrder: (storeName: string, mapsUrl: string, notes?: string) => Promise<Order>;
  getOrderById: (id: string) => Order | undefined;
  messages: Record<string, Message[]>; // order_id -> Message[]
  addMessage: (orderId: string, content: string) => Promise<Message>;
  addContactMessage: (name: string, email: string, message: string) => Promise<void>;
  logout: () => void;
  loginMockUser: (email: string, fullName?: string, phone?: string) => void;
  toast: { message: string; type: "success" | "error" | "info" } | null;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Initial Mock User
const INITIAL_USER: Profile = {
  id: "usr-sa-101",
  full_name: "عبدالرحمن الشمري",
  phone: "0551234567",
  created_at: new Date().toISOString(),
};

// Initial Mock Orders
const INITIAL_ORDERS: Order[] = [
  {
    id: "ord-8801",
    user_id: "usr-sa-101",
    store_name: "مخبز ومحمصة الأجواد - العليا، الرياض",
    maps_url: "https://maps.app.goo.gl/example123456789",
    notes: "نحتاج تحسين الظهور في الخرائط لمصطلح 'أفضل مخبز حساوي بالرياض'.",
    status: "in_progress",
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    user_name: "عبدالرحمن الشمري",
  },
  {
    id: "ord-8802",
    user_id: "usr-sa-101",
    store_name: "مغسلة السحاب الأوتوماتيكية - حي الصفا، جدة",
    maps_url: "https://maps.app.goo.gl/example987654321",
    notes: "تركيز على تحسين التقييمات وإزالة البلاغات الوهمية.",
    status: "pending",
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    user_name: "عبدالرحمن الشمري",
  },
  {
    id: "ord-8803",
    user_id: "usr-sa-101",
    store_name: "مطبخ وتجهيزات المذاق التراثي - الخبر",
    maps_url: "https://maps.google.com/?q=26.217,50.197",
    notes: "تم إكمال تحسين الكلمات المفتاحية وربط حساب خرائط قوقل بنجاح.",
    status: "completed",
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    user_name: "عبدالرحمن الشمري",
  },
];

// Initial Messages
const INITIAL_MESSAGES: Record<string, Message[]> = {
  "ord-8801": [
    {
      id: "msg-101",
      order_id: "ord-8801",
      sender_id: "usr-sa-101",
      sender_name: "عبدالرحمن الشمري",
      content: "أهلاً بفريق مكّن، متى يتوقع بدء تحسين موقع المحل على الخريطة؟",
      created_at: new Date(Date.now() - 86400000 * 2.5).toISOString(),
    },
    {
      id: "msg-102",
      order_id: "ord-8801",
      sender_id: "admin-team",
      sender_name: "فريق الدعم والتحسين (مكّن)",
      content: "أهلاً بك أستاذ عبدالرحمن! قمنا بدراسة الكلمات المفتاحية لمحيط حي العليا، وسنبدأ اليوم بإضافة البيانات المحسّنة وصور المحل.",
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: "msg-103",
      order_id: "ord-8801",
      sender_id: "usr-sa-101",
      sender_name: "عبدالرحمن الشمري",
      content: "ممتاز جداً! أضفت أيضاً صوراً جديدة للواجهة في الملاحظات.",
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
  ],
  "ord-8802": [
    {
      id: "msg-201",
      order_id: "ord-8802",
      sender_id: "usr-sa-101",
      sender_name: "عبدالرحمن الشمري",
      content: "السلام عليكم، تم تقديم الطلب لمغسلة جدة، يرجى التأكيد.",
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
  ],
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Lazy initial state avoiding set-state-in-effect
  const [user, setUser] = useState<Profile | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const savedUser = localStorage.getItem("mkn_user");
      if (!savedUser) return null;
      const parsed = JSON.parse(savedUser) as Profile;
      return isLegacyMockVisitor(parsed) ? null : parsed;
    } catch {
      return null;
    }
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    if (typeof window === "undefined") return INITIAL_ORDERS;
    try {
      const savedOrders = localStorage.getItem("mkn_orders");
      return savedOrders ? JSON.parse(savedOrders) : INITIAL_ORDERS;
    } catch {
      return INITIAL_ORDERS;
    }
  });

  const [messages, setMessages] = useState<Record<string, Message[]>>(() => {
    if (typeof window === "undefined") return INITIAL_MESSAGES;
    try {
      const savedMessages = localStorage.getItem("mkn_messages");
      return savedMessages ? JSON.parse(savedMessages) : INITIAL_MESSAGES;
    } catch {
      return INITIAL_MESSAGES;
    }
  });

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void import("@/lib/supabase/client")
      .then(async ({ supabase }) => {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session?.user) setUser(profileFromAuthUser(data.session.user));
        const sub = supabase.auth.onAuthStateChange((event, session) => {
          if (session?.user) setUser(profileFromAuthUser(session.user));
          else if (event === "SIGNED_OUT") setUser(null);
        });
        unsubscribe = () => sub.data.subscription.unsubscribe();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (user && !isLegacyMockVisitor(user)) localStorage.setItem("mkn_user", JSON.stringify(user));
    else localStorage.removeItem("mkn_user");
  }, [user]);

  useEffect(() => {
    if (orders.length > 0) localStorage.setItem("mkn_orders", JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    if (Object.keys(messages).length > 0) localStorage.setItem("mkn_messages", JSON.stringify(messages));
  }, [messages]);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loginMockUser = (email: string, fullName?: string, phone?: string) => {
    // Email form remains local until password auth is wired. Google/Apple use
    // Supabase Auth and must not mint mkn_admin_session — see P-07.
    const newUser: Profile = {
      id: user?.id || `usr-${Date.now().toString().slice(-4)}`,
      full_name: fullName || email.split("@")[0],
      phone: phone || "0500000000",
      email,
      provider: "email",
      created_at: new Date().toISOString(),
    };
    setUser(newUser);
    showToast(`مرحباً بك ${newUser.full_name}! تم تسجيل الدخول بنجاح.`, "success");
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("mkn_user");
    void import("@/lib/supabase/client")
      .then(({ supabase }) => supabase.auth.signOut())
      .catch(() => undefined);
    showToast("تم تسجيل الخروج بنجاح.", "info");
  };

  const addOrder = async (storeName: string, mapsUrl: string, notes?: string): Promise<Order> => {
    const newOrder: Order = {
      id: `ord-${Math.floor(1000 + Math.random() * 9000)}`,
      user_id: user?.id || "usr-sa-101",
      store_name: storeName,
      maps_url: mapsUrl,
      notes: notes || "",
      status: "pending",
      created_at: new Date().toISOString(),
      user_name: user?.full_name || "عميل مكّن",
    };

    setOrders((prev) => [newOrder, ...prev]);
    showToast("تم إرسال طلبك بنجاح! سيتم مراجعته من قبل فريق التحسين.", "success");
    return newOrder;
  };

  const getOrderById = (id: string) => {
    return orders.find((o) => o.id === id);
  };

  const addMessage = async (orderId: string, content: string): Promise<Message> => {
    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      order_id: orderId,
      sender_id: user?.id || "usr-sa-101",
      sender_name: user?.full_name || "أنت",
      content,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => ({
      ...prev,
      [orderId]: [...(prev[orderId] || []), newMsg],
    }));

    setTimeout(() => {
      const adminReply: Message = {
        id: `msg-admin-${Date.now()}`,
        order_id: orderId,
        sender_id: "admin-team",
        sender_name: "فريق العمل (مكّن)",
        content: "تم استلام استفسارك وسيتم الرد عليك في أقرب وقت.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => ({
        ...prev,
        [orderId]: [...(prev[orderId] || []), adminReply],
      }));
    }, 2500);

    return newMsg;
  };

  const addContactMessage = async (_name: string, _email: string, _message: string) => {
    showToast("تم إرسال رسالتك بنجاح! سيتواصل معك فريق مكّن قريبًا.", "success");
  };

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        orders,
        addOrder,
        getOrderById,
        messages,
        addMessage,
        addContactMessage,
        logout,
        loginMockUser,
        toast,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within an AppProvider");
  return context;
};
