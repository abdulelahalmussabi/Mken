import Link from "next/link";
import { MapPin, Phone, Mail, Sparkles } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#060911] border-t border-slate-800/80 pt-16 pb-12 text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center font-extrabold text-lg text-white shadow-md shadow-orange-500/20">
                م
              </div>
              <span className="font-extrabold text-2xl text-slate-100">مكّن</span>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed">
              المنصة السعودية الأولى والمتخصصة في تمكين المحلات والمتاجر المحلية من التصدر في نتائج البحث الموقعي وخرائط Google.
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-orange-400 bg-orange-950/40 border border-orange-800/40 px-3 py-1.5 rounded-full w-fit">
              <Sparkles className="w-3.5 h-3.5" />
              خدمة سريعة ونتائج مضمونة 100%
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-slate-100 font-bold text-base">روابط سريعة</h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/" className="hover:text-orange-400 transition-colors">
                  الرئيسية
                </Link>
              </li>
              <li>
                <Link href="/#services" className="hover:text-orange-400 transition-colors">
                  خدمات تحسين المحلات
                </Link>
              </li>
              <li>
                <Link href="/#features" className="hover:text-orange-400 transition-colors">
                  لماذا تختار منصة مكّن؟
                </Link>
              </li>
              <li>
                <Link href="/auth" className="hover:text-orange-400 transition-colors">
                  تسجيل الدخول / إنشاء حساب
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-orange-400 transition-colors">
                  لوحة تحكم الطلبات
                </Link>
              </li>
            </ul>
          </div>

          {/* Services Scope */}
          <div className="space-y-4">
            <h4 className="text-slate-100 font-bold text-base">خدماتنا الرئيسية</h4>
            <ul className="space-y-2.5 text-xs leading-relaxed text-slate-400">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                تحسين وتأكيد نشاطك على خرائط Google
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                استهداف الكلمات المفتاحية لمحيط محلّك
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                إدارة وبناء سمعة التقييمات الإيجابية
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                تقرير أسبوعي مفصل بزيارات الخريطة
              </li>
            </ul>
          </div>

          {/* Contact Details */}
          <div className="space-y-4">
            <h4 className="text-slate-100 font-bold text-base">تواصل معنا</h4>
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-orange-400 shrink-0" />
                <span>المملكة العربية السعودية - الرياض / جدة</span>
              </div>
              <div className="flex items-center gap-2.5 dir-ltr justify-end">
                <span>+966 55 123 4567</span>
                <Phone className="w-4 h-4 text-orange-400 shrink-0" />
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-orange-400 shrink-0" />
                <span>support@mkn-seo.sa</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} منصة مكّن (Mkn). جميع الحقوق محفوظة.</p>
          <div className="flex items-center gap-4">
            <span>سياسة الخصوصية</span>
            <span>•</span>
            <span>شروط الخدمة</span>
            <span>•</span>
            <span>السعودية 🇸🇦</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
