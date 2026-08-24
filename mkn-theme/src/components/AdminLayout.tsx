"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { useAdmin } from "@/context/AdminContext";
import {
  LayoutDashboard,
  Users,
  Palette,
  Settings,
  Building2,
  CalendarDays,
  Inbox,
  LayoutGrid,
  LogOut,
  MessageCircle,
  Receipt,
  UsersRound,
  Package,
  KeyRound,
  ChevronLeft,
  Shield,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session, authLoading, isSuperAdmin, logoutAdmin, saas } = useAdmin();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isLogin = pathname === "/admin/login" || pathname.startsWith("/admin/login/");

  React.useEffect(() => {
    if (isLogin) return;
    if (!authLoading && !session) {
      router.push("/admin/login");
    }
  }, [authLoading, session, router, isLogin]);

  if (isLogin) return <>{children}</>;
  if (!session) return null;

  const operationsLinks = [
    { name: "المواعيد والتقويم", href: "/admin/appointments" as Route, icon: CalendarDays },
    { name: "الطلبات الواردة", href: "/admin/orders" as Route, icon: Inbox },
    { name: "الخدمات والكتالوج", href: "/admin/services" as Route, icon: LayoutGrid },
    { name: "الرسائل والواتساب", href: "/admin/messages" as Route, icon: MessageCircle, feature: "whatsapp" as const },
    { name: "الفواتير", href: "/admin/invoices" as Route, icon: Receipt, feature: "invoices" as const },
    { name: "الموظفون والمناوبات", href: "/admin/staff" as Route, icon: UsersRound },
    { name: "المخزون", href: "/admin/inventory" as Route, icon: Package, feature: "invoices" as const },
  ].filter((link) => {
    if (isSuperAdmin || !link.feature) return true;
    if (link.feature === "whatsapp") return saas.hasWhatsApp;
    if (link.feature === "invoices") return saas.hasInvoices;
    return true;
  });

  const superAdminGroups = [
    {
      title: "الإدارة المركزية",
      links: [
        { name: "لوحة التحكم", href: "/admin" as Route, icon: LayoutDashboard },
        { name: "ثيمات العملاء", href: "/admin#clients" as Route, icon: Palette },
        { name: "إدارة العملاء", href: "/admin#manage" as Route, icon: Users },
        { name: "تراخيص Mken Lite", href: "/admin/licenses" as Route, icon: KeyRound },
        { name: "إعدادات النظام", href: "/admin#settings" as Route, icon: Settings },
      ],
    },
    {
      title: "العمليات التشغيلية",
      links: operationsLinks,
    },
    {
      title: "الإعدادات والتهيئة",
      links: [{ name: "إعدادات المنشأة", href: "/admin/settings" as Route, icon: Building2 }],
    },
  ];

  const clientAdminGroups = [
    {
      title: "العمليات التشغيلية",
      links: operationsLinks,
    },
    {
      title: "الإعدادات والتهيئة",
      links: [
        { name: "إعدادات المنشأة", href: "/admin/settings" as Route, icon: Building2 },
        { name: "إعدادات العميل", href: "/admin/client" as Route, icon: LayoutDashboard },
        { name: "تخصيص الثيم", href: "/admin/client#theme" as Route, icon: Palette },
      ],
    },
  ];

  const groups = isSuperAdmin ? superAdminGroups : clientAdminGroups;

  const handleLogout = async () => {
    await logoutAdmin();
    router.push("/admin/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Admin Top Bar */}
      <div className="sticky top-0 z-50 bg-slate-950/95 border-b border-amber-500/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo + Admin Badge */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link href={isSuperAdmin ? "/admin" : "/admin/client"} className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center font-black text-slate-950 text-lg shadow-lg">
                م
              </div>
              <div>
                <span className="font-extrabold text-lg text-white">مكّن</span>
                <span className="text-xs text-amber-400 font-bold mr-1.5">/ Admin</span>
              </div>
            </Link>
          </div>

          {/* Admin Mode Badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold
            bg-amber-500/10 border-amber-500/30 text-amber-300">
            {isSuperAdmin ? (
              <><ShieldCheck className="w-3.5 h-3.5" /> سوبر أدمن</>
            ) : (
              <><Shield className="w-3.5 h-3.5" /> أدمن عميل: {session.clientSlug}</>
            )}
          </div>

          {/* User + Logout */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-slate-400 truncate max-w-[180px]">
              {session.email}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-950/40 border border-rose-800/50 hover:bg-rose-900/50 text-rose-400 rounded-xl text-xs font-bold transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sidebar */}
          <aside className={`lg:col-span-3 ${sidebarOpen ? "block" : "hidden lg:block"}`}>
            <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-2 sticky top-24">
              {/* Admin Info */}
              <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center font-extrabold text-slate-950 text-lg shadow-md">
                  {isSuperAdmin ? "🔐" : "👤"}
                </div>
                <div className="flex-1 truncate">
                  <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                    {isSuperAdmin ? "Super Admin" : `Client Admin`}
                  </p>
                  <p className="text-xs font-bold text-slate-200 truncate">{session.email}</p>
                </div>
              </div>

              {/* Nav Links */}
              <nav className="space-y-4">
                {groups.map((group) => (
                  <div key={group.title} className="space-y-1">
                    <p className="px-4 pt-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {group.title}
                    </p>
                    {group.links.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                            isActive
                              ? "bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow-lg shadow-amber-500/20"
                              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="w-4 h-4" />
                            <span>{item.name}</span>
                          </div>
                          <ChevronLeft className="w-3.5 h-3.5 opacity-50" />
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>

              {/* Back to Site */}
              <div className="pt-4 border-t border-slate-800">
                <Link
                  href="/"
                  className="flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-all"
                >
                  ← العودة للموقع
                </Link>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <section className="lg:col-span-9 space-y-6">{children}</section>
        </div>
      </div>
    </div>
  );
}
