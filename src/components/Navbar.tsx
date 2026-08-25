"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { useOccasion } from "@/context/OccasionContext";
import { OccasionThemeSelector } from "@/components/occasions/OccasionThemeSelector";
import {
  Menu,
  X,
  LayoutDashboard,
  LogOut,
  ArrowLeft,
  ChevronDown,
  Sparkles,
} from "lucide-react";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const { user, logout } = useApp();
  const { activeOccasion, occasionDetails } = useOccasion();
  const pathname = usePathname();

  const navLinks = [
    { name: "الرئيسية", href: "/" },
    { name: "الاشتراكات 🎟️", href: "/subscriptions" },
    { name: "الحجوزات 📅", href: "/bookings" },
    { name: "الثيمات والمناسبات 🇸🇦", href: "/themes" },
    { name: "خدماتنا", href: "/#services" },
    { name: "تواصل معنا", href: "/#contact" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#090d16]/95 backdrop-blur-xl border-b border-slate-800/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-2">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-xl text-white shadow-lg transition-transform group-hover:scale-105"
            style={{ backgroundColor: occasionDetails.accentColor }}
          >
            م
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-2xl tracking-tight text-slate-100 flex items-center gap-1.5">
              مكّن
              <span
                className="inline-block w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: occasionDetails.accentColor }}
              />
            </span>
            <span className="text-[10px] font-medium text-slate-400 -mt-1 tracking-wide">
              Local SEO Saudi
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden xl:flex items-center gap-1 bg-slate-900/60 p-1.5 rounded-full border border-slate-800/80">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all ${
                  isActive
                    ? "bg-slate-800 text-white shadow-md border border-slate-700 font-bold"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* Left Side: Social Media Icons + Theme Selector + User Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Social Media Links on Left */}
          <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-slate-800 text-slate-400">
            <a
              href="https://x.com/mken_live"
              target="_blank"
              rel="noreferrer"
              title="منصة مكّن على X / تويتر"
              className="w-8 h-8 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 hover:text-white flex items-center justify-center text-xs transition-all"
            >
              𝕏
            </a>
            <a
              href="https://instagram.com/mken.live"
              target="_blank"
              rel="noreferrer"
              title="إنستغرام"
              className="w-8 h-8 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-pink-500/50 hover:text-pink-400 flex items-center justify-center text-xs transition-all"
            >
              📸
            </a>
            <a
              href="https://tiktok.com/@mken.live"
              target="_blank"
              rel="noreferrer"
              title="تيك توك"
              className="w-8 h-8 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 hover:text-cyan-400 flex items-center justify-center text-xs transition-all"
            >
              🎵
            </a>
            <a
              href="https://snapchat.com/add/mken.live"
              target="_blank"
              rel="noreferrer"
              title="سناب شات"
              className="w-8 h-8 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-yellow-500/50 hover:text-yellow-400 flex items-center justify-center text-xs transition-all"
            >
              👻
            </a>
            <a
              href="https://wa.me/966554453287"
              target="_blank"
              rel="noreferrer"
              title="تواصل واتساب المباشر"
              className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-800/60 hover:bg-emerald-900/80 text-emerald-400 flex items-center justify-center text-xs transition-all"
            >
              💬
            </a>
          </div>

          {/* Occasion Theme Selector */}
          <OccasionThemeSelector />

          {/* User Auth Buttons */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-700/80 hover:border-amber-500/50 rounded-xl text-xs font-medium text-slate-200 transition-all cursor-pointer focus:outline-none"
                >
                  <div
                    className="w-6 h-6 rounded-lg text-slate-950 flex items-center justify-center font-bold text-xs"
                    style={{ backgroundColor: occasionDetails.accentColor }}
                  >
                    {user.full_name.charAt(0)}
                  </div>
                  <span className="max-w-[100px] truncate">{user.full_name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
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
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
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
                  href="/login"
                  className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  تسجيل الدخول
                </Link>
                <Link
                  href="/register"
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold text-sm rounded-xl shadow-lg transition-all active:scale-95"
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
                className="p-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1"
              >
                <LayoutDashboard className="w-4 h-4" />
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
              aria-label="القائمة"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
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
                className="block px-4 py-3 text-base font-medium rounded-xl text-slate-300 hover:bg-slate-900 hover:text-amber-400 transition-colors"
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
                  className="flex items-center justify-center gap-2 w-full py-3 bg-amber-500 text-slate-950 font-bold rounded-xl shadow-lg"
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
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-3 text-center text-sm font-bold text-slate-300 bg-slate-900 border border-slate-800 rounded-xl"
                >
                  تسجيل الدخول
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-3 text-center text-sm font-bold text-slate-950 bg-amber-500 rounded-xl shadow-md"
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
