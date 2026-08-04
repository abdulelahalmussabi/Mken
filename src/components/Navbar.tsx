"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import {
  Menu,
  X,
  LayoutDashboard,
  LogOut,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const { user, logout } = useApp();
  const pathname = usePathname();

  const navLinks = [
    { name: "الرئيسية", href: "/" },
    { name: "خدماتنا", href: "/#services" },
    { name: "لماذا مكّن؟", href: "/#features" },
    { name: "تواصل معنا", href: "/#contact" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#090d16]/90 backdrop-blur-xl border-b border-slate-800/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 via-amber-500 to-orange-400 flex items-center justify-center font-extrabold text-xl text-white shadow-lg shadow-orange-500/25 group-hover:scale-105 transition-transform">
            م
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-2xl tracking-tight text-slate-100 flex items-center gap-1.5">
              مكّن
              <span className="inline-block w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            </span>
            <span className="text-[10px] font-medium text-slate-400 -mt-1 tracking-wide">
              Local SEO Saudi
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1.5 rounded-full border border-slate-800/80">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                  isActive
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-700/80 hover:border-orange-500/50 rounded-xl text-sm font-medium text-slate-200 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              >
                <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-xs">
                  {user.full_name.charAt(0)}
                </div>
                <span>{user.full_name}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 space-y-1 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-2 border-b border-slate-800 mb-1">
                    <p className="text-xs text-slate-400">حساب العميل</p>
                    <p className="text-sm font-bold text-slate-200 truncate">{user.full_name}</p>
                  </div>
                  <Link
                    href="/dashboard"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-orange-500/10 hover:text-orange-400 rounded-xl transition-all"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    لوحة التحكم والطلبات
                  </Link>
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-rose-400 hover:bg-rose-950/30 rounded-xl transition-all text-right cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    تسجيل الخروج
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/auth"
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                تسجيل الدخول
              </Link>
              <Link
                href="/auth"
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all"
              >
                <span>ابدأ الآن</span>
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="md:hidden flex items-center gap-2">
          {user && (
            <Link
              href="/dashboard"
              className="p-2 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-xl text-xs font-bold flex items-center gap-1"
            >
              <LayoutDashboard className="w-4 h-4" />
            </Link>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            aria-label="القائمة"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-800 bg-[#090d16] px-4 pt-2 pb-6 space-y-4 animate-in slide-in-from-top duration-200">
          <nav className="space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-base font-medium rounded-xl text-slate-300 hover:bg-slate-900 hover:text-orange-400 transition-colors"
              >
                {link.name}
              </Link>
            ))}
          </nav>

          <div className="pt-4 border-t border-slate-800/80 space-y-2">
            {user ? (
              <>
                <div className="px-4 py-2 text-xs text-slate-400">
                  مرحباً، <span className="font-bold text-slate-200">{user.full_name}</span>
                </div>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  لوحة تحكم العميل
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full py-2.5 text-center text-sm font-semibold text-rose-400 bg-rose-950/20 border border-rose-900/40 rounded-xl"
                >
                  تسجيل الخروج
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/auth"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-3 text-center text-sm font-bold text-slate-300 bg-slate-900 border border-slate-800 rounded-xl"
                >
                  تسجيل الدخول
                </Link>
                <Link
                  href="/auth"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-3 text-center text-sm font-bold text-white bg-orange-500 rounded-xl shadow-md shadow-orange-500/20"
                >
                  حساب جديد
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
