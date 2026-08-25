"use client";

import React, { useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import { useAdmin } from "@/context/AdminContext";
import { useApp } from "@/context/AppContext";
import { SAUDI_OCCASIONS, OccasionId } from "@/context/OccasionContext";
import {
  Palette,
  Check,
  ExternalLink,
  Gift,
  Info,
  ShieldCheck,
  Building2,
  Phone,
  MessageCircle,
  MapPin,
  Save,
  Tag,
  Stethoscope,
  Users,
  CalendarCheck,
  Dumbbell,
  Megaphone,
  CreditCard,
  Package,
  Layers,
  Clock,
  Plus,
  Trash2,
  Edit,
  Search,
  CheckCircle2,
  AlertTriangle,
  Send,
  Globe,
  Share2,
  TrendingUp,
  RefreshCw,
  QrCode,
  FileCheck2,
  Sparkles,
  Zap,
  UserCheck,
  ChevronLeft
} from "lucide-react";
import type {
  ClinicRecord,
  StaffRecord,
  StaffBookingRecord,
  SubscriptionPackageRecord,
  SubscriberMemberRecord,
  AdBannerRecord
} from "@/types/database";

const occasionsList = Object.values(SAUDI_OCCASIONS);

// ─── Initial Mock Data for System Clinics, Staff, Bookings, Subscriptions, Ads ──
const INITIAL_CLINICS: ClinicRecord[] = [
  {
    id: "cl-1",
    tenantSlug: "almahrusa",
    name: "عيادة طب الأسنان التخصصية",
    specialty: "طب وجراحة الأسنان",
    branch: "الفرع الرئيسي - المدينة المنورة",
    capacityPerDay: 25,
    workingDays: "السبت - الخميس",
    morningShift: "09:00 ص - 01:00 م",
    eveningShift: "04:30 م - 10:00 م",
    assignedStaffIds: ["st-1", "st-2"],
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: "cl-2",
    tenantSlug: "almahrusa",
    name: "مركز الجلدية والعناية بالبشرة والليز",
    specialty: "جلدية وتجميل",
    branch: "فرع سلطانة",
    capacityPerDay: 30,
    workingDays: "يومياً عدا الجمعة",
    morningShift: "10:00 ص - 02:00 م",
    eveningShift: "05:00 م - 11:00 م",
    assignedStaffIds: ["st-3"],
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: "cl-3",
    tenantSlug: "almahrusa",
    name: "عيادة التغذية واللياقة والعلاج الطبيعي",
    specialty: "علاج طبيعي وتغذية علاجية",
    branch: "مجمع المحروسة الطبي",
    capacityPerDay: 20,
    workingDays: "الأحد - الخميس",
    morningShift: "08:30 ص - 12:30 م",
    eveningShift: "04:00 م - 09:30 م",
    assignedStaffIds: ["st-4"],
    active: true,
    createdAt: new Date().toISOString()
  }
];

const INITIAL_STAFF: StaffRecord[] = [
  {
    id: "st-1",
    tenantSlug: "almahrusa",
    name: "د. إبراهيم الخالدي",
    role: "doctor",
    roleTitle: "استشاري طب وجراحة الأسنان",
    specialty: "زراعة وابتسامة هوليود",
    email: "i.khalidi@almahrusa.sa",
    phone: "0551122334",
    assignedClinicId: "cl-1",
    permissions: ["إدارة المواعيد", "كتابة الوصفات", "تعديل الجدول"],
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: "st-2",
    tenantSlug: "almahrusa",
    name: "د. ريم المهيدب",
    role: "doctor",
    roleTitle: "أخصائية علاج العصب والحشوات التجميلية",
    specialty: "طب الأسنان التحفظي",
    email: "reem.m@almahrusa.sa",
    phone: "0554433221",
    assignedClinicId: "cl-1",
    permissions: ["إدارة المواعيد", "استقبال الكشوفات"],
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: "st-3",
    tenantSlug: "almahrusa",
    name: "د. نورة السديري",
    role: "doctor",
    roleTitle: "استشارية الجلدية والليزر",
    specialty: "حقن ونضارة وليزر",
    email: "noura.s@almahrusa.sa",
    phone: "0559988776",
    assignedClinicId: "cl-2",
    permissions: ["كامل صلاحيات الجلدية", "إدارة جلسات الليزر"],
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: "st-4",
    tenantSlug: "almahrusa",
    name: "كابتن زياد القحطاني",
    role: "trainer",
    roleTitle: "مدرب لياقة بدنية وتأهيل حركي",
    specialty: "تدريب شخصي وتأهيل رياضي",
    email: "ziad.fit@almahrusa.sa",
    phone: "0553322110",
    assignedClinicId: "cl-3",
    permissions: ["إدارة الحصص التدريبية", "جداول التمارين"],
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: "st-5",
    tenantSlug: "almahrusa",
    name: "سارة الغامدي",
    role: "receptionist",
    roleTitle: "مشرفة الاستقبال وتنسيق المواعيد",
    email: "reception@almahrusa.sa",
    phone: "0557766554",
    permissions: ["تأكيد المواعيد", "إرسال رسائل الواتساب", "تسجيل العملاء"],
    active: true,
    createdAt: new Date().toISOString()
  }
];

const INITIAL_BOOKINGS: StaffBookingRecord[] = [
  {
    id: "bk-1",
    tenantSlug: "almahrusa",
    staffId: "st-1",
    staffName: "د. إبراهيم الخالدي",
    customerName: "سعد بن فيصل الشمري",
    customerPhone: "0501234567",
    serviceName: "استشارة كشف وتبييض أسنان ليزر",
    date: "2026-08-25",
    time: "05:30 م",
    status: "confirmed",
    notes: "خصم اليوم الوطني 96 مطبق",
    createdAt: new Date().toISOString()
  },
  {
    id: "bk-2",
    tenantSlug: "almahrusa",
    staffId: "st-3",
    staffName: "د. نورة السديري",
    customerName: "منيرة عبدالرحمن الفهد",
    customerPhone: "0559876543",
    serviceName: "جلسة هيدرافيشل ملكي ونضارة",
    date: "2026-08-25",
    time: "07:00 م",
    status: "confirmed",
    createdAt: new Date().toISOString()
  },
  {
    id: "bk-3",
    tenantSlug: "almahrusa",
    staffId: "st-4",
    staffName: "كابتن زياد القحطاني",
    customerName: "خالد بن الوليد العتيبي",
    customerPhone: "0543210987",
    serviceName: "جلسة تقييم وتدريب شخصي 1-on-1",
    date: "2026-08-26",
    time: "04:00 م",
    status: "pending",
    notes: "مشترك في باقة الـ 16 حصة",
    createdAt: new Date().toISOString()
  }
];

const INITIAL_PACKAGES: SubscriptionPackageRecord[] = [
  {
    id: "pkg-1",
    tenantSlug: "almahrusa",
    category: "sessions",
    categoryTitle: "حصص تدريبية",
    title: "باقة 16 حصة تدريب شخصي وتغذية مكثفة",
    price: "1,490 ر.س",
    period: "شهرياً",
    description: "4 حصص أسبوعياً مع كابتن خاص، قياسات حيوية، وتحدي خسارة دهون وبناء عضلات.",
    trainerName: "كابتن زياد القحطاني",
    features: ["16 جلسة خاصة 60 دقيقة", "جدول دايت مخصص", "متابعة يومية بالواتساب"],
    badge: "الأكثر طلباً 🌟",
    popular: true,
    active: true
  },
  {
    id: "pkg-2",
    tenantSlug: "almahrusa",
    category: "meals",
    categoryTitle: "وجبات صحية",
    title: "باقة الدايت والكيتو المتكاملة (24 يوم)",
    price: "1,450 ر.س",
    period: "شهرياً",
    description: "3 وجبات صحية طازجة + سناك بروتين يومياً مع توصيل مبرد لباب المنزل.",
    mealsPerDay: 3,
    features: ["3 وجبات يومية محسوبة الماكروز", "توصيل صباحي مبرد", "استشارة تغذية أسبوعية"],
    badge: "تغذية صحية 🥗",
    active: true
  },
  {
    id: "pkg-3",
    tenantSlug: "almahrusa",
    category: "gym",
    categoryTitle: "اشتراك نادي",
    title: "العضوية الذهبية VIP الشاملة للمرافق",
    price: "699 ر.س",
    period: "3 أشهر",
    description: "دخول غير محدود لصالة الحديد، الكارديو، المسبح والجاكوزي، وكافة الحصص الجماعية.",
    features: ["دخول 24/7", "المسبح والساونا", "كافة الكلاسات الجماعية"],
    badge: "نادي رياضي 🏋️",
    active: true
  },
  {
    id: "pkg-4",
    tenantSlug: "almahrusa",
    category: "exhibitions",
    categoryTitle: "معارض ومؤتمرات",
    title: "بطاقة الـ VIP لحضور الملتقيات والمعارض السنوية",
    price: "1,200 ر.س",
    period: "للمؤتمر الكامل",
    description: "مقاعد الصف الأول، دخول صالة الـ VIP، واجتماعات ثنائية B2B مع الرعاة.",
    features: ["دخول VIP Lounge", "مقاعد محجوزة مسبقاً", "شهادة حضور معتمدة"],
    badge: "VIP للأعمال 💼",
    active: true
  }
];

const INITIAL_SUBSCRIBERS: SubscriberMemberRecord[] = [
  {
    id: "sub-1",
    tenantSlug: "almahrusa",
    customerName: "عبدالله السبيعي",
    customerPhone: "0554411223",
    packageId: "pkg-1",
    packageName: "باقة 16 حصة تدريب شخصي",
    category: "sessions",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    status: "active",
    paidAmount: "1,490 ر.س"
  },
  {
    id: "sub-2",
    tenantSlug: "almahrusa",
    customerName: "هند بنت ناصر المطيري",
    customerPhone: "0509988112",
    packageId: "pkg-2",
    packageName: "باقة الدايت والكيتو (24 يوم)",
    category: "meals",
    startDate: "2026-08-10",
    endDate: "2026-09-10",
    status: "active",
    paidAmount: "1,450 ر.س"
  },
  {
    id: "sub-3",
    tenantSlug: "almahrusa",
    customerName: "تركي بن عبدالعزيز المقرن",
    customerPhone: "0567788990",
    packageId: "pkg-3",
    packageName: "العضوية الذهبية VIP (3 أشهر)",
    category: "gym",
    startDate: "2026-06-01",
    endDate: "2026-08-30",
    status: "expiring_soon",
    paidAmount: "699 ر.س"
  }
];

const INITIAL_ADS: AdBannerRecord[] = [
  {
    id: "ad-1",
    tenantSlug: "almahrusa",
    title: "عرض اليوم الوطني 96: خصم 45% حصري",
    subtitle: "استفد من كود الخصم الوطني لجميع خدمات الإقامة والعيادات والحجوزات",
    linkUrl: "/subscriber/almahrusa",
    type: "hero_banner",
    active: true
  },
  {
    id: "ad-2",
    tenantSlug: "almahrusa",
    title: "ثبت تطبيق المنشأة على هاتفك الآن",
    subtitle: "احصل على تأكيد فوري لمواعيدك وإشعارات التذكير الذكية",
    type: "popup",
    active: true
  }
];

export default function ClientAdminPage() {
  const {
    session,
    clients,
    getClientTheme,
    setClientTheme,
    updateClient,
    isSuperAdmin,
    ads,
    addAd,
    deleteAd,
    toggleAdActive
  } = useAdmin();
  const { showToast } = useApp();

  // Active Main Navigation Section (Right Sidebar)
  const [activeSection, setActiveSection] = useState<
    | "client_settings"
    | "google_seo"
    | "clinics"
    | "staff"
    | "appointments"
    | "subscriptions"
    | "ads"
    | "customers"
    | "inventory"
    | "integrations"
  >("client_settings");

  // Active Horizontal Sub-Tabs
  const [subTab, setSubTab] = useState<string>("facility");

  // Client Data
  const myClient = clients.find((c) => c.slug === (session?.clientSlug || "almahrusa")) || clients[0];
  const currentTheme = getClientTheme(myClient?.slug || "") || "national_day";
  const currentOcc = SAUDI_OCCASIONS[currentTheme];

  // Editable Form State
  const [name, setName] = useState(myClient?.name || "");
  const [tagline, setTagline] = useState(myClient?.tagline || "");
  const [subtitle, setSubtitle] = useState(myClient?.subtitle || "");
  const [phone, setPhone] = useState(myClient?.phone || "");
  const [whatsapp, setWhatsapp] = useState(myClient?.whatsapp || "");
  const [email, setEmail] = useState(myClient?.email || "");
  const [location, setLocation] = useState(myClient?.location || "");
  const [couponCode, setCouponCode] = useState(myClient?.couponCode || currentOcc.couponCode);
  const [discountText, setDiscountText] = useState(myClient?.discountText || currentOcc.discountText);
  const [discountEnabled, setDiscountEnabled] = useState(myClient?.discountEnabled ?? true);
  const [autoThemeSwitch, setAutoThemeSwitch] = useState(myClient?.autoThemeSwitch ?? true);

  // Social Links State
  const [twitter, setTwitter] = useState(myClient?.socialLinks?.twitter || "https://x.com/almahrusa_sa");
  const [instagram, setInstagram] = useState(myClient?.socialLinks?.instagram || "https://instagram.com/almahrusa.medina");
  const [tiktok, setTiktok] = useState(myClient?.socialLinks?.tiktok || "https://tiktok.com/@almahrusa");
  const [snapchat, setSnapchat] = useState(myClient?.socialLinks?.snapchat || "https://snapchat.com/add/almahrusa");
  const [linkedin, setLinkedin] = useState(myClient?.socialLinks?.linkedin || "https://linkedin.com/company/almahrusa");
  const [youtube, setYoutube] = useState(myClient?.socialLinks?.youtube || "");

  // Dynamic Collections State
  const [clinics, setClinics] = useState<ClinicRecord[]>(INITIAL_CLINICS);
  const [staffList, setStaffList] = useState<StaffRecord[]>(INITIAL_STAFF);
  const [bookings, setBookings] = useState<StaffBookingRecord[]>(INITIAL_BOOKINGS);
  const [packages, setPackages] = useState<SubscriptionPackageRecord[]>(INITIAL_PACKAGES);
  const [subscribers, setSubscribers] = useState<SubscriberMemberRecord[]>(INITIAL_SUBSCRIBERS);

  // New Ad Form State
  const [newAdTitle, setNewAdTitle] = useState("");
  const [newAdSubtitle, setNewAdSubtitle] = useState("");
  const [newAdLink, setNewAdLink] = useState("");

  // New Clinic Form State
  const [newClinicName, setNewClinicName] = useState("");
  const [newClinicSpec, setNewClinicSpec] = useState("طب الأسنان");
  const [newClinicCapacity, setNewClinicCapacity] = useState(25);
  const [newClinicBranch, setNewClinicBranch] = useState("الفرع الرئيسي");

  // New Staff Form State
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffRole, setNewStaffRole] = useState("doctor");
  const [newStaffTitle, setNewStaffTitle] = useState("");
  const [newStaffPhone, setNewStaffPhone] = useState("");
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffClinic, setNewStaffClinic] = useState("cl-1");

  // Saving indicator
  const [isSaving, setIsSaving] = useState(false);

  if (isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="text-center py-20 space-y-4">
          <ShieldCheck className="w-12 h-12 text-amber-400 mx-auto" />
          <p className="text-slate-300 font-bold">أنت سوبر أدمن، استخدم</p>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-2xl transition-all shadow-lg"
          >
            لوحة التحكم الرئيسية
          </Link>
        </div>
      </AdminLayout>
    );
  }

  if (!myClient) {
    return (
      <AdminLayout>
        <div className="text-center py-20 text-slate-400">
          <p>لم يتم العثور على بيانات المنشأة.</p>
        </div>
      </AdminLayout>
    );
  }

  // Handle Switch Section & Set Default Sub-Tab
  const handleSelectSection = (sectionKey: typeof activeSection) => {
    setActiveSection(sectionKey);
    switch (sectionKey) {
      case "client_settings":
        setSubTab("facility");
        break;
      case "google_seo":
        setSubTab("gmb_sync");
        break;
      case "clinics":
        setSubTab("clinics_list");
        break;
      case "staff":
        setSubTab("staff_report");
        break;
      case "appointments":
        setSubTab("all_bookings");
        break;
      case "subscriptions":
        setSubTab("trainer_sessions");
        break;
      case "ads":
        setSubTab("visitor_content");
        break;
      case "customers":
        setSubTab("customer_list");
        break;
      case "inventory":
        setSubTab("stock_catalog");
        break;
      case "integrations":
        setSubTab("zatca");
        break;
    }
  };

  // Save Settings & Social Links
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    setTimeout(() => {
      updateClient(myClient.slug, {
        name,
        tagline,
        subtitle,
        phone,
        whatsapp,
        email,
        location,
        couponCode,
        discountText,
        discountEnabled,
        autoThemeSwitch,
        socialLinks: {
          twitter,
          instagram,
          tiktok,
          snapchat,
          linkedin,
          whatsapp,
          youtube
        }
      });
      setIsSaving(false);
      showToast("تم حفظ وتحديث بيانات المنشأة وصفحات السوشال ميديا بنجاح ✨", "success");
    }, 600);
  };

  // Add Clinic
  const handleAddClinic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClinicName.trim()) return;

    const newC: ClinicRecord = {
      id: "cl-" + Date.now(),
      tenantSlug: myClient.slug,
      name: newClinicName,
      specialty: newClinicSpec,
      branch: newClinicBranch,
      capacityPerDay: Number(newClinicCapacity),
      workingDays: "السبت - الخميس",
      morningShift: "09:00 ص - 01:00 م",
      eveningShift: "04:30 م - 10:00 م",
      assignedStaffIds: [],
      active: true,
      createdAt: new Date().toISOString()
    };

    setClinics((prev) => [...prev, newC]);
    setNewClinicName("");
    showToast("تم تسجيل العيادة الجديدة بنجاح ✨", "success");
    setSubTab("clinics_list");
  };

  // Add Staff
  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;

    const newS: StaffRecord = {
      id: "st-" + Date.now(),
      tenantSlug: myClient.slug,
      name: newStaffName,
      role: newStaffRole as any,
      roleTitle: newStaffTitle || "طبيب / أخصائي",
      phone: newStaffPhone,
      email: newStaffEmail,
      assignedClinicId: newStaffClinic,
      permissions: ["إدارة المواعيد", "تسجيل الكشوفات"],
      active: true,
      createdAt: new Date().toISOString()
    };

    setStaffList((prev) => [...prev, newS]);
    setNewStaffName("");
    setNewStaffTitle("");
    setNewStaffPhone("");
    setNewStaffEmail("");
    showToast("تم تسجيل الموظف الجديد وتعيين صلاحياته بنجاح ✨", "success");
    setSubTab("staff_report");
  };

  // Send WhatsApp to booking customer
  const handleSendWhatsApp = (booking: StaffBookingRecord) => {
    const text = encodeURIComponent(
      `السلام عليكم ${booking.customerName}، نؤكد لكم موعدكم في *${myClient.name}*:
` +
        `• الخدمة: ${booking.serviceName}
` +
        `• الممارس/الموظف المسؤول: ${booking.staffName}
` +
        `• التاريخ والوقت: ${booking.date} الساعة ${booking.time}
` +
        `نتشرف بزيارتكم!`
    );
    window.open(`https://wa.me/${booking.customerPhone}?text=${text}`, "_blank");
  };

  return (
    <AdminLayout>
      <div className="space-y-8 text-right font-sans">
        {/* Top Header Card */}
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>لوحة إدارة المنشأة والموظفين الموحدة</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">{myClient.name}</h1>
              <p className="text-slate-400 text-xs">
                إيميل الإدارة: <code className="text-blue-400 font-mono">{session?.email}</code>
                {" · "}
                المسار العام: <code className="text-slate-300 font-mono">/subscriber/{myClient.slug}</code>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/subscriber/${myClient.slug}`}
                target="_blank"
                className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span>معاينة صفحة الزوار</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Main Layout: Right Side Menu + Top Sub-Tabs + Content ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Right Main Navigation Menu */}
          <div className="lg:col-span-4 space-y-2">
            <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-1.5 sticky top-24">
              <div className="px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-800 mb-2">
                قوائم الخدمات والأنظمة
              </div>

              {[
                { id: "client_settings", name: "إعدادات العميل", icon: Building2, count: "3 أقسام" },
                { id: "google_seo", name: "خرائط Google والرانك", icon: Globe, count: "SEO محلي" },
                { id: "clinics", name: "العيادات والمراكز", icon: Stethoscope, count: `${clinics.length} عيادات` },
                { id: "staff", name: "الموظفين والصلاحيات", icon: Users, count: `${staffList.length} موظفين` },
                { id: "appointments", name: "المواعيد والحجوزات", icon: CalendarCheck, count: `${bookings.length} موعد` },
                { id: "subscriptions", name: "الاشتراكات والعضويات", icon: Dumbbell, count: `${packages.length} باقات` },
                { id: "ads", name: "الإعلانات ومحتوى الزوار", icon: Megaphone, count: "البانرات والعروض" },
                { id: "customers", name: "العملاء والديون", icon: UserCheck, count: "دفتر الآجل" },
                { id: "inventory", name: "المخزون والمشتريات", icon: Package, count: "المستودع والموردين" },
                { id: "integrations", name: "الفوترة والدفع والربط", icon: CreditCard, count: "ZATCA وميسر" }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectSection(item.id as any)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-lg shadow-amber-500/20"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${isActive ? "bg-slate-950/20 text-slate-950 font-extrabold" : "bg-slate-950 text-slate-500"}`}>
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Left Content Area (Top Horizontal Sub-Tabs + Active Panel) */}
          <div className="lg:col-span-8 space-y-6">
            {/* ── SECTION 1: إعدادات العميل ── */}
            {activeSection === "client_settings" && (
              <div className="space-y-6">
                {/* Horizontal Top Sub-Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-md">
                  <button
                    onClick={() => setSubTab("facility")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "facility" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    🏢 إعدادات المنشأة
                  </button>
                  <button
                    onClick={() => setSubTab("contact_social")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "contact_social" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    📱 بيانات التواصل والسوشال ميديا
                  </button>
                  <button
                    onClick={() => setSubTab("themes_schedule")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "themes_schedule" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    🇸🇦 الثيمات والجدول الزمني للمناسبات
                  </button>
                </div>

                {/* SubTab 1: إعدادات المنشأة */}
                {subTab === "facility" && (
                  <form onSubmit={handleSaveSettings} className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
                      <Building2 className="w-5 h-5 text-amber-400" />
                      <h2 className="text-lg font-extrabold text-white">إعدادات المنشأة والبيانات الأساسية</h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">اسم المنشأة التجاري *</label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">العنوان الفرعي / السلوجان</label>
                        <input
                          type="text"
                          value={tagline}
                          onChange={(e) => setTagline(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">الوصف التعريفي الشامل بالمنشأة</label>
                        <textarea
                          rows={3}
                          value={subtitle}
                          onChange={(e) => setSubtitle(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">الموقع الجغرافي / العنوان الوطني</label>
                        <input
                          type="text"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="المدينة، الحي، الشارع الرئيسي"
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        <span>{isSaving ? "جاري الحفظ..." : "حفظ بيانات المنشأة"}</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* SubTab 2: بيانات التواصل والسوشال ميديا */}
                {subTab === "contact_social" && (
                  <form onSubmit={handleSaveSettings} className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
                      <Share2 className="w-5 h-5 text-sky-400" />
                      <div>
                        <h2 className="text-lg font-extrabold text-white">بيانات التواصل وحسابات السوشال ميديا</h2>
                        <p className="text-xs text-slate-400">تظهر هذه الحسابات في الجهة اليسرى من الهيدر والواجهة العامة مباشرة.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-emerald-400" />
                          <span>رقم الهاتف المباشر</span>
                        </label>
                        <input
                          type="text"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="05XXXXXXXX"
                          dir="ltr"
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 font-mono text-left focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span>رقم الواتساب بالحجم الدولي</span>
                        </label>
                        <input
                          type="text"
                          value={whatsapp}
                          onChange={(e) => setWhatsapp(e.target.value)}
                          placeholder="9665XXXXXXXX"
                          dir="ltr"
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 font-mono text-left focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">البريد الإلكتروني الرسمي</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="info@yourcompany.sa"
                          dir="ltr"
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 font-mono text-left focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">حساب منصة 𝕏 (تويتر)</label>
                        <input
                          type="url"
                          value={twitter}
                          onChange={(e) => setTwitter(e.target.value)}
                          placeholder="https://x.com/username"
                          dir="ltr"
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 font-mono text-left focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">حساب إنستغرام (Instagram)</label>
                        <input
                          type="url"
                          value={instagram}
                          onChange={(e) => setInstagram(e.target.value)}
                          placeholder="https://instagram.com/username"
                          dir="ltr"
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 font-mono text-left focus:outline-none focus:border-pink-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">حساب تيك توك (TikTok)</label>
                        <input
                          type="url"
                          value={tiktok}
                          onChange={(e) => setTiktok(e.target.value)}
                          placeholder="https://tiktok.com/@username"
                          dir="ltr"
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 font-mono text-left focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">حساب سناب شات (Snapchat)</label>
                        <input
                          type="url"
                          value={snapchat}
                          onChange={(e) => setSnapchat(e.target.value)}
                          placeholder="https://snapchat.com/add/username"
                          dir="ltr"
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 font-mono text-left focus:outline-none focus:border-yellow-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">حساب لينكد إن (LinkedIn)</label>
                        <input
                          type="url"
                          value={linkedin}
                          onChange={(e) => setLinkedin(e.target.value)}
                          placeholder="https://linkedin.com/company/name"
                          dir="ltr"
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 font-mono text-left focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">قناة يوتيوب (YouTube)</label>
                        <input
                          type="url"
                          value={youtube}
                          onChange={(e) => setYoutube(e.target.value)}
                          placeholder="https://youtube.com/@channel"
                          dir="ltr"
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 font-mono text-left focus:outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        <span>{isSaving ? "جاري الحفظ..." : "حفظ بيانات التواصل والسوشال ميديا"}</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* SubTab 3: الثيمات والجدول الزمني للمناسبات */}
                {subTab === "themes_schedule" && (
                  <div className="space-y-6">
                    {/* Auto Switch Feature Toggle */}
                    <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          <span>التبديل التلقائي لثيمات المناسبات حسب الموسم</span>
                        </h3>
                        <p className="text-xs text-slate-400">
                          عند التفعيل، ستقوم المنصة بتفعيل ثيم اليوم الوطني، التأسيس، والأعياد تلقائياً وفق التقويم السعودي.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoThemeSwitch}
                          onChange={(e) => {
                            setAutoThemeSwitch(e.target.checked);
                            updateClient(myClient.slug, { autoThemeSwitch: e.target.checked });
                            showToast(e.target.checked ? "تم تفعيل التبديل التلقائي للمواسم ✅" : "تم إلغاء التبديل التلقائي", "success");
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-950 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                      </label>
                    </div>

                    {/* Manual Theme Grid Selection */}
                    <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                      <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                        <Palette className="w-4 h-4 text-amber-400" />
                        <span>اختيار وتثبيت ثيم مخصص لصفحتك فوراً</span>
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {occasionsList.map((occ) => {
                          const isActive = currentTheme === occ.id;
                          return (
                            <button
                              key={occ.id}
                              type="button"
                              onClick={() => {
                                setClientTheme(myClient.slug, occ.id as OccasionId);
                                showToast(`تم تفعيل ثيم: ${occ.shortName} على صفحة منشأتك ✨`, "success");
                              }}
                              className={`p-4 rounded-2xl border text-right transition-all relative ${
                                isActive
                                  ? "bg-slate-950 border-amber-500 shadow-xl ring-2 ring-amber-500/30"
                                  : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                              }`}
                            >
                              {isActive && (
                                <div className="absolute top-3 left-3 bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  مُفعَّل
                                </div>
                              )}
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: occ.accentColor }} />
                                <span className="font-extrabold text-xs text-white">{occ.name}</span>
                              </div>
                              <p className="text-[11px] text-slate-400 line-clamp-2">{occ.description}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── SECTION 2: خرائط Google والرانك ── */}
            {activeSection === "google_seo" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-md">
                  <button
                    onClick={() => setSubTab("gmb_sync")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "gmb_sync" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    📍 ربط Google Business
                  </button>
                  <button
                    onClick={() => setSubTab("rank_report")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "rank_report" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    📈 تقرير الرانك والترتيب
                  </button>
                  <button
                    onClick={() => setSubTab("seo_tips")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "seo_tips" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    💡 اقتراحات التحسين المحلية
                  </button>
                </div>

                {subTab === "gmb_sync" && (
                  <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <div>
                        <h3 className="font-extrabold text-base text-white">حالة الربط مع ملف النشاط التجاري Google Profile</h3>
                        <p className="text-xs text-slate-400">مزامنة بيانات الـ NAP (الاسم، العنوان، الهاتف) وتحديث ساعات العمل.</p>
                      </div>
                      <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-bold">
                        متصل وموثق ✅
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                        <span className="text-xs text-slate-400">تطابق الاسم والعنوان (NAP)</span>
                        <p className="font-bold text-sm text-emerald-400">100% متطابق مع خرائط قوقل</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                        <span className="text-xs text-slate-400">التقييمات الموثقة على قوقل</span>
                        <p className="font-bold text-sm text-amber-400">⭐ {myClient.rating} ({myClient.reviewsCount})</p>
                      </div>
                    </div>
                  </div>
                )}

                {subTab === "rank_report" && (
                  <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                    <h3 className="font-extrabold text-base text-white">تقرير الكلمات المفتاحية الأكثر تصدراً</h3>
                    <div className="space-y-2.5">
                      {[
                        { keyword: "شقق فندقية المدينة المنورة", rank: "#1 على الخريطة", status: "متصدر 🥇" },
                        { keyword: "حجز غرف مخدومة قريبة من الحرم", rank: "#2 في نتائج البحث", status: "متصدر 🥈" },
                        { keyword: "شقق عائلية مفروشة نظيفة", rank: "#1 على الخريطة", status: "متصدر 🥇" }
                      ].map((item, idx) => (
                        <div key={idx} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-white text-sm">{item.keyword}</p>
                            <p className="text-slate-400 text-xs mt-0.5">{item.rank}</p>
                          </div>
                          <span className="px-3 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-full font-bold">
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {subTab === "seo_tips" && (
                  <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                    <h3 className="font-extrabold text-base text-white">اقتراحات زيادة ظهور المنشأة</h3>
                    <div className="space-y-3 text-xs">
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-white">طلب التقييمات التلقائي عبر الواتساب</p>
                          <p className="text-slate-400 mt-0.5">تم تفعيل إرسال رابط التقييم المباشر بعد انتهاء إقامة أو موعد العميل.</p>
                        </div>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-white">تحديث الصور الجغرافية المعتمدة (Geo-tagged Photos)</p>
                          <p className="text-slate-400 mt-0.5">رفع 12 صورة جديدة للشقق والمرافق لتعزيز ترتيب النشاط.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── SECTION 3: العيادات والمراكز ── */}
            {activeSection === "clinics" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-md">
                  <button
                    onClick={() => setSubTab("clinics_list")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "clinics_list" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    🩺 قائمة العيادات المسجلة ({clinics.length})
                  </button>
                  <button
                    onClick={() => setSubTab("add_clinic")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "add_clinic" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    ➕ تسجيل عيادة جديدة
                  </button>
                  <button
                    onClick={() => setSubTab("work_hours")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "work_hours" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    ⏰ مواعيد وفترات العمل
                  </button>
                </div>

                {subTab === "clinics_list" && (
                  <div className="space-y-4">
                    {clinics.map((clinic) => (
                      <div key={clinic.id} className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                              <Stethoscope className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-extrabold text-base text-white">{clinic.name}</h3>
                              <p className="text-xs text-slate-400">{clinic.specialty} • {clinic.branch}</p>
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-bold">
                            نشطة وتستقبل المواعيد ✅
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800 text-xs">
                          <div className="p-3 bg-slate-950 rounded-xl">
                            <span className="text-slate-500 block">أيام العمل:</span>
                            <span className="font-bold text-slate-200">{clinic.workingDays}</span>
                          </div>
                          <div className="p-3 bg-slate-950 rounded-xl">
                            <span className="text-slate-500 block">الفترة الصباحية:</span>
                            <span className="font-bold text-slate-200">{clinic.morningShift}</span>
                          </div>
                          <div className="p-3 bg-slate-950 rounded-xl">
                            <span className="text-slate-500 block">الفترة المسائية:</span>
                            <span className="font-bold text-slate-200">{clinic.eveningShift}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {subTab === "add_clinic" && (
                  <form onSubmit={handleAddClinic} className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
                    <h3 className="font-extrabold text-base text-white">تسجيل عيادة أو قسم طبي جديد</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">اسم العيادة / القسم *</label>
                        <input
                          type="text"
                          required
                          placeholder="مثال: عيادة العيون والليزر"
                          value={newClinicName}
                          onChange={(e) => setNewClinicName(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">التخصص الطبي *</label>
                        <input
                          type="text"
                          required
                          placeholder="مثال: طب وجراحة العيون"
                          value={newClinicSpec}
                          onChange={(e) => setNewClinicSpec(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">الفرع / الموقع</label>
                        <input
                          type="text"
                          value={newClinicBranch}
                          onChange={(e) => setNewClinicBranch(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">الطاقة الاستيعابية اليومية (كشف/موعد)</label>
                        <input
                          type="number"
                          value={newClinicCapacity}
                          onChange={(e) => setNewClinicCapacity(Number(e.target.value))}
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all"
                    >
                      حفظ وتسجيل العيادة
                    </button>
                  </form>
                )}

                {subTab === "work_hours" && (
                  <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                    <h3 className="font-extrabold text-base text-white">إدارة مواعيد واستقبال العيادات</h3>
                    <p className="text-xs text-slate-400">يتم تطبيق هذه المواعيد تلقائياً في صفحة الحجز عند اختيار العميل للعيادة.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── SECTION 4: الموظفين والصلاحيات ── */}
            {activeSection === "staff" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-md">
                  <button
                    onClick={() => setSubTab("staff_report")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "staff_report" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    👥 تقرير الموظفين والصلاحيات ({staffList.length})
                  </button>
                  <button
                    onClick={() => setSubTab("staff_bookings")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "staff_bookings" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    📅 حجوزات ومواعيد كل موظف
                  </button>
                  <button
                    onClick={() => setSubTab("add_staff")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "add_staff" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    ➕ إضافة موظف جديد
                  </button>
                </div>

                {subTab === "staff_report" && (
                  <div className="space-y-3">
                    {staffList.map((staff) => (
                      <div key={staff.id} className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                            {staff.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-white">{staff.name}</h4>
                            <p className="text-xs text-slate-400">{staff.roleTitle} • {staff.phone}</p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              {staff.permissions.map((p, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-slate-950 rounded-md text-[10px] text-slate-300 border border-slate-800">
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-300 rounded-full text-xs font-bold border border-emerald-500/30">
                          نشط ✅
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {subTab === "staff_bookings" && (
                  <div className="space-y-3">
                    {bookings.map((b) => (
                      <div key={b.id} className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-white">{b.customerName}</span>
                            <span className="text-xs text-amber-400 font-mono">({b.customerPhone})</span>
                          </div>
                          <p className="text-xs text-slate-300">الخدمة: <strong className="text-white">{b.serviceName}</strong></p>
                          <p className="text-xs text-slate-400">الموظف/الطبيب المسند له: <strong className="text-blue-400">{b.staffName}</strong> • {b.date} الساعة {b.time}</p>
                        </div>
                        <button
                          onClick={() => handleSendWhatsApp(b)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>إشعار العميل بالواتساب</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {subTab === "add_staff" && (
                  <form onSubmit={handleAddStaff} className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
                    <h3 className="font-extrabold text-base text-white">تسجيل موظف أو كابتن أو طبيب جديد</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">الاسم الكامل *</label>
                        <input
                          type="text"
                          required
                          placeholder="مثال: د. ماجد السهلي"
                          value={newStaffName}
                          onChange={(e) => setNewStaffName(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">المسمى الوظيفي *</label>
                        <input
                          type="text"
                          required
                          placeholder="مثال: أخصائي تغذية وعلاج طبيعي"
                          value={newStaffTitle}
                          onChange={(e) => setNewStaffTitle(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">رقم الجوال *</label>
                        <input
                          type="tel"
                          required
                          placeholder="05XXXXXXXX"
                          value={newStaffPhone}
                          onChange={(e) => setNewStaffPhone(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">البريد الإلكتروني</label>
                        <input
                          type="email"
                          placeholder="staff@almahrusa.sa"
                          value={newStaffEmail}
                          onChange={(e) => setNewStaffEmail(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all"
                    >
                      تسجيل الموظف وحفظ الصلاحيات
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ── SECTION 5: المواعيد والحجوزات ── */}
            {activeSection === "appointments" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-md">
                  <button
                    onClick={() => setSubTab("all_bookings")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "all_bookings" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    📅 جدول كافة المواعيد ({bookings.length})
                  </button>
                  <button
                    onClick={() => setSubTab("today_bookings")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "today_bookings" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    ⚡ مواعيد اليوم
                  </button>
                  <button
                    onClick={() => setSubTab("whatsapp_confirm")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "whatsapp_confirm" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    💬 تأكيد وإشعارات الواتساب
                  </button>
                </div>

                <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                  <h3 className="font-extrabold text-base text-white">المواعيد المسجلة في النظام</h3>
                  <div className="space-y-3">
                    {bookings.map((b) => (
                      <div key={b.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-white text-sm">{b.customerName} - {b.serviceName}</p>
                          <p className="text-slate-400 text-xs mt-0.5">الموعد: {b.date} الساعة {b.time} • مع: {b.staffName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full font-bold">
                            {b.status === "confirmed" ? "مؤكد ✅" : "قيد الانتظار ⏳"}
                          </span>
                          <button
                            onClick={() => handleSendWhatsApp(b)}
                            className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow transition"
                            title="إرسال واتساب"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── SECTION 6: الاشتراكات والعضويات ── */}
            {activeSection === "subscriptions" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-md">
                  <button
                    onClick={() => setSubTab("trainer_sessions")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "trainer_sessions" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    ⏱️ باقات المدربين والحصص
                  </button>
                  <button
                    onClick={() => setSubTab("healthy_meals")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "healthy_meals" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    🥗 باقات الوجبات الصحية
                  </button>
                  <button
                    onClick={() => setSubTab("gym_exhibitions")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "gym_exhibitions" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    🏋️ النوادي والمعارض
                  </button>
                  <button
                    onClick={() => setSubTab("subscribers_ledger")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "subscribers_ledger" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    📋 سجل وتجديدات المشتركين ({subscribers.length})
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {packages.map((pkg) => (
                    <div key={pkg.id} className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30">
                          {pkg.badge || pkg.categoryTitle}
                        </span>
                        <span className="text-sm font-black text-white">{pkg.price}</span>
                      </div>
                      <h4 className="font-extrabold text-sm text-white">{pkg.title}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">{pkg.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── SECTION 7: الإعلانات ومحتوى الزوار ── */}
            {activeSection === "ads" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-md">
                  <button
                    onClick={() => setSubTab("visitor_content")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "visitor_content" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    📢 بانرات صفحة الزوار ({ads.filter(a => a.tenantSlug === 'all' || a.tenantSlug === myClient.slug).length})
                  </button>
                  <button
                    onClick={() => setSubTab("add_ad")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "add_ad" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    ➕ إنشاء إعلان / بانر جديد
                  </button>
                  <button
                    onClick={() => setSubTab("promotions")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTab === "promotions" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    🏷️ عروض وكوبونات الخصم
                  </button>
                </div>

                {subTab === "visitor_content" && (
                  <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <h3 className="font-extrabold text-base text-white">البانرات والعروض الترويجية النشطة</h3>
                        <p className="text-xs text-slate-400">
                          عند وجود إعلانات مفعلة، يظهر زر "العروض والإعلانات" تلقائياً في الشريط العلوي لكافة الزوار.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {ads
                        .filter((a) => a.tenantSlug === "all" || a.tenantSlug === myClient.slug)
                        .map((ad) => (
                          <div
                            key={ad.id}
                            className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs ${
                              ad.active
                                ? "bg-slate-950 border-amber-500/30"
                                : "bg-slate-950/40 border-slate-800 opacity-60"
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm">{ad.title}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                                  {ad.tenantSlug === "all" ? "إعلان عام للمنصة" : "خاص بالمنشأة"}
                                </span>
                              </div>
                              <p className="text-slate-400 text-xs">{ad.subtitle}</p>
                              {ad.linkUrl && (
                                <p className="text-[11px] text-amber-400/80 font-mono">الرابط: {ad.linkUrl}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => {
                                  toggleAdActive(ad.id);
                                  showToast(ad.active ? "تم تعطيل الإعلان وإخفاؤه" : "تم تفعيل الإعلان وإظهاره بنجاح ✨", "success");
                                }}
                                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                                  ad.active
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                                    : "bg-slate-800 text-slate-400 border border-slate-700 hover:text-white"
                                }`}
                              >
                                {ad.active ? "مفعل ويظهر للزوار ✅" : "معطل (مخفي) ⏸️"}
                              </button>

                              {ad.tenantSlug !== "all" && (
                                <button
                                  onClick={() => {
                                    deleteAd(ad.id);
                                    showToast("تم حذف الإعلان بنجاح", "success");
                                  }}
                                  className="p-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-400 rounded-lg transition"
                                  title="حذف الإعلان"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {subTab === "add_ad" && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newAdTitle.trim()) return;
                      addAd({
                        id: "ad-" + Date.now(),
                        tenantSlug: myClient.slug,
                        title: newAdTitle,
                        subtitle: newAdSubtitle,
                        linkUrl: newAdLink || `/subscriber/${myClient.slug}`,
                        type: "hero_banner",
                        active: true,
                      });
                      setNewAdTitle("");
                      setNewAdSubtitle("");
                      setNewAdLink("");
                      showToast("تم إنشاء الإعلان وتفعيله بنجاح ✨", "success");
                      setSubTab("visitor_content");
                    }}
                    className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5"
                  >
                    <h3 className="font-extrabold text-base text-white">إنشاء إعلان أو بانر ترويجي جديد للمنشأة</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">عنوان الإعلان الرئيسي *</label>
                        <input
                          type="text"
                          required
                          placeholder="مثال: خصم 35% على باقات جلسات العناية والإقامة"
                          value={newAdTitle}
                          onChange={(e) => setNewAdTitle(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">تفاصيل العرض / الوصف الترويجي</label>
                        <textarea
                          rows={2}
                          placeholder="مثال: احجز موعدك اليوم واستمتع بالعرض الحصري مع خدمة التوصيل والاستشارة المجانية"
                          value={newAdSubtitle}
                          onChange={(e) => setNewAdSubtitle(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">رابط توجيه العميل (اختياري)</label>
                        <input
                          type="text"
                          placeholder={`/subscriber/${myClient.slug}`}
                          value={newAdLink}
                          onChange={(e) => setNewAdLink(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all"
                    >
                      نشر وتفعيل الإعلان فوراً
                    </button>
                  </form>
                )}

                {subTab === "promotions" && (
                  <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                    <h3 className="font-extrabold text-base text-white">إدارة كوبونات وعروض المناسبات</h3>
                    <p className="text-xs text-slate-400">
                      يتم تفعيل كوبون الخصم تلقائياً عند تفعيل ثيم المناسبة أو جدولتها.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── SECTION 8: العملاء والديون ── */}
            {activeSection === "customers" && (
              <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <h3 className="font-extrabold text-base text-white">سجلات العملاء ودفتر الديون</h3>
                  <Link
                    href="/admin/customers"
                    className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold shadow-md transition"
                  >
                    فتح صفحة إدارة العملاء الكاملة ←
                  </Link>
                </div>
                <p className="text-xs text-slate-400">إدارة سجلات العملاء، حسابات الآجل، وكشوف الحسابات وسندات القبض.</p>
              </div>
            )}

            {/* ── SECTION 9: المخزون والمشتريات ── */}
            {activeSection === "inventory" && (
              <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <h3 className="font-extrabold text-base text-white">إدارة المخزون والموردين والمشتريات</h3>
                  <Link
                    href="/admin/inventory"
                    className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold shadow-md transition"
                  >
                    فتح المستودع والمخزون ←
                  </Link>
                </div>
                <p className="text-xs text-slate-400">تتبع الكميات، حركات المخزون، أوامر الشراء، ومستحقات الموردين.</p>
              </div>
            )}

            {/* ── SECTION 10: الفوترة والدفع والربط ── */}
            {activeSection === "integrations" && (
              <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <h3 className="font-extrabold text-base text-white">الفوترة الإلكترونية ZATCA وبوابات الدفع</h3>
                  <Link
                    href="/admin/settings"
                    className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold shadow-md transition"
                  >
                    إعدادات ZATCA وميسر والواتساب ←
                  </Link>
                </div>
                <p className="text-xs text-slate-400">ربط خوادم الزكاة والضريبة، بوابة دفع ميسر Moyasar، وأتمتة الواتساب UltraMsg.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}