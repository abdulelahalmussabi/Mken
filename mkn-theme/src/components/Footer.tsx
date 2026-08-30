"use client";

import Link from "next/link";
import { MapPin, Phone, Mail, Sparkles, Heart } from "lucide-react";
import { useOccasion } from "@/context/OccasionContext";
import NeonSocialRow from "@/components/social/NeonSocialRow";
import { PlatformMark } from "@/components/PlatformMark";

export default function Footer() {
  const { activeOccasion, occasionDetails, openModal } = useOccasion();

  return (
    <footer className="bg-background border-t border-line pt-16 pb-12 text-muted text-sm relative overflow-hidden">
      {/* Decorative Top Occasion Accent Bar */}
      <div
        className="absolute top-0 inset-x-0 h-1 transition-colors duration-500"
        style={{ backgroundColor: occasionDetails.accentColor }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-3">
              <PlatformMark
                className="w-9 h-9"
                fallback={
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-lg text-slate-950 shadow-md transition-colors"
                    style={{ backgroundColor: occasionDetails.accentColor }}
                  >
                    م
                  </div>
                }
              />
              <span className="font-extrabold text-2xl text-foreground">مكّن</span>
            </Link>
            <p className="text-muted text-sm leading-relaxed">
              المنصة السعودية الأولى والمتخصصة في تمكين المحلات والمتاجر المحلية من التصدر في نتائج البحث الموقعي وخرائط Google.
            </p>
            <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full w-fit border ${occasionDetails.badgeBg}`}>
              <Sparkles className="w-3.5 h-3.5" />
              <span>{occasionDetails.slogan}</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-foreground font-bold text-base">روابط سريعة</h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/" className="hover:text-amber-400 transition-colors">
                  الرئيسية
                </Link>
              </li>
              <li>
                <Link href="/#services" className="hover:text-amber-400 transition-colors">
                  خدمات تحسين المحلات
                </Link>
              </li>
              <li>
                <button
                  onClick={openModal}
                  className="hover:text-amber-400 transition-colors text-amber-400 font-semibold flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>دراسة حزمة المناسبات السعودية</span>
                </button>
              </li>
              <li>
                <Link href="/auth" className="hover:text-amber-400 transition-colors">
                  تسجيل الدخول / إنشاء حساب
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-amber-400 transition-colors">
                  لوحة تحكم الطلبات
                </Link>
              </li>
            </ul>
          </div>

          {/* Services Scope */}
          <div className="space-y-4">
            <h4 className="text-foreground font-bold text-base">خدماتنا في المناسبات</h4>
            <ul className="space-y-2.5 text-xs leading-relaxed text-muted">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: occasionDetails.accentColor }}></span>
                تحسين وتأكيد نشاطك على خرائط Google
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: occasionDetails.accentColor }}></span>
                حملات العروض الموسمية ({occasionDetails.shortName})
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: occasionDetails.accentColor }}></span>
                إدارة التقييمات وزيادة زيارات الخريطة
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: occasionDetails.accentColor }}></span>
                خصومات خاصة بكود الخصم: <code className="font-mono text-amber-700 font-bold ml-1">{occasionDetails.couponCode}</code>
              </li>
            </ul>
          </div>

          {/* Contact Details */}
          <div className="space-y-4">
            <h4 className="text-foreground font-bold text-base">تواصل معنا</h4>
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                <span>المملكة العربية السعودية - الرياض / جدة / الخبر</span>
              </div>
              <div className="flex items-center gap-2.5 dir-ltr justify-end">
                <span>+966 55 123 4567</span>
                <Phone className="w-4 h-4 text-amber-400 shrink-0" />
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                <span>support@mkn-seo.sa</span>
              </div>
            </div>
          </div>
        </div>

        {/* Neon Social Media Strip */}
        <div className="py-6 border-t border-line flex flex-col items-center justify-center gap-3">
          <p className="text-xs font-bold text-muted">تابع منصة مكّن عبر قنوات التواصل الرسمية</p>
          <NeonSocialRow
            socialLinks={{
              x: "https://x.com/mkenalkhayal",
              tiktok: "https://tiktok.com/@mkenalkhayal",
              instagram: "https://instagram.com/mkenalkhayal",
              snapchat: "https://snapchat.com/add/mkenalkhayal",
              whatsapp: "https://wa.me/966543530333",
              youtube: "https://youtube.com/@mkenalkhayal",
            }}
            size="md"
          />
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
          <p className="flex items-center gap-1">
            <span>© {new Date().getFullYear()} منصة مكّن. صُمم بحب للمملكة العربية السعودية</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 inline fill-rose-500" />
          </p>
          <div className="flex items-center gap-4">
            <span>ثيم المناسبة النشط: <strong className="text-amber-700">{occasionDetails.shortName}</strong></span>
            <span>•</span>
            <span>السعودية 🇸🇦</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
