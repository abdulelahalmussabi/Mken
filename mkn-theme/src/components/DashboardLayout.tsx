"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import NewOrderModal from "@/components/NewOrderModal";
import { useApp } from "@/context/AppContext";
import {
  LayoutDashboard,
  Store,
  MessageSquare,
  User,
  Plus,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  Palette,
  UsersRound,
} from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  if (!user) {
    if (typeof window !== "undefined") {
      router.push("/login");
    }
    return null;
  }

  const sidebarLinks: { name: string; href: Route; icon: typeof LayoutDashboard }[] = [
    { name: "نظرة عامة", href: "/dashboard", icon: LayoutDashboard },
    { name: "طلبات الأنشطة التجارية", href: "/dashboard/requests", icon: Store },
    { name: "الطابور", href: "/queue" as Route, icon: UsersRound },
    { name: "موقع المحروسة للشقق المفروشة 🏢", href: "/subscriber/almahrusa" as Route, icon: Store },
    { name: "صفحة حجز المواعيد 📅", href: "/book?tenant=almahrusa" as Route, icon: Palette },
    { name: "مركز الرسائل", href: "/dashboard/messages", icon: MessageSquare },
    { name: "الملف الشخصي", href: "/dashboard/profile", icon: User },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-theme-main text-foreground font-sans transition-colors duration-500">
      <Navbar />

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mobile Header Bar */}
        <div className="lg:hidden flex items-center justify-between p-4 mb-6 bg-surface border border-line rounded-2xl">
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="flex items-center gap-2 px-3 py-2 bg-surface-2 text-foreground rounded-xl text-xs font-bold"
          >
            {mobileSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            قائمة اللوحة
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            طلب جديد
          </button>
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sidebar Navigation */}
          <aside
            className={`lg:col-span-3 space-y-4 ${
              mobileSidebarOpen ? "block" : "hidden lg:block"
            }`}
          >
            <div className="p-6 rounded-3xl bg-surface border border-line shadow-xl space-y-6">
              {/* User Profile Card */}
              <div className="flex items-center gap-3 border-b border-line pb-4">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-extrabold text-lg shadow-md shadow-emerald-500/20">
                  {user.full_name.charAt(0)}
                </div>
                <div className="flex-1 truncate">
                  <p className="text-xs text-muted font-medium">حساب العميل</p>
                  <h3 className="font-extrabold text-foreground text-sm truncate">{user.full_name}</h3>
                </div>
              </div>

              {/* Nav Links */}
              <nav className="space-y-1.5">
                {sidebarLinks.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileSidebarOpen(false)}
                      className={`flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                          : "text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-surface-2"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        <span>{item.name}</span>
                      </div>
                      <ChevronLeft className="w-3.5 h-3.5 opacity-60" />
                    </Link>
                  );
                })}
              </nav>

              {/* Quick Action Button */}
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-surface-2 hover:bg-emerald-600 hover:text-white text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold text-xs rounded-2xl transition-all cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                تقديم طلب جديد
              </button>

              {/* Logout Button */}
              <div className="pt-4 border-t border-line">
                <button
                  onClick={logout}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  تسجيل الخروج
                </button>
              </div>
            </div>
          </aside>

          {/* Main Dashboard Content Area */}
          <section className="lg:col-span-9 space-y-6">
            {children}
          </section>
        </div>
      </div>

      {/* New Order Modal */}
      <NewOrderModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <Footer />
    </div>
  );
}
