"use client";

import { useEffect, useState, useMemo } from "react";
import {
  CreditCard,
  Building2,
  CalendarCheck,
  Tag,
  ShieldCheck,
  Check,
  Plus,
  X,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";

interface AttributeOption {
  key: string;
  label: string;
  description: string;
  category: "payment" | "amenity" | "service";
}

const SAUDI_ATTRIBUTES: AttributeOption[] = [
  // 1. وسائل الدفع
  {
    key: "pay_mada",
    label: "الدفع عبر مدى (Mada)",
    description: "قبول بطاقات الدفع الوطنية مدى وأجهزة نقاط البيع",
    category: "payment",
  },
  {
    key: "pay_apple_pay",
    label: "أبل باي (Apple Pay)",
    description: "دفع سريع بدون تلامس عبر أجهزة آبل",
    category: "payment",
  },
  {
    key: "pay_credit_card",
    label: "بطاقات ائتمانية (Visa / MasterCard)",
    description: "قبول جميع البطاقات الائتمانية المحلية والدولية",
    category: "payment",
  },
  {
    key: "pay_cash",
    label: "دفع نقدي / عند الاستلام",
    description: "قبول الأوراق النقدية داخل المنشأة",
    category: "payment",
  },
  {
    key: "pay_tamara_tabby",
    label: "التقسيط عبر تمارا / تابي",
    description: "خدمات اشتر الآن وادفع لاحقاً المرخصة من البنك المركزي",
    category: "payment",
  },

  // 2. المرافق والتسهيلات
  {
    key: "amenity_wheelchair",
    label: "مدخل مهيأ لذوي الإعاقة (Wheelchair Accessible)",
    description: "منحدر ومصاعد مريحة للكراسي المتحركة وعربات الأطفال",
    category: "amenity",
  },
  {
    key: "amenity_parking",
    label: "مواقف سيارات خاصة أو مجانية",
    description: "توفر مواقف سيارات مخصصة لعملاء المنشأة",
    category: "amenity",
  },
  {
    key: "amenity_prayer_room",
    label: "مصلى مخصص (رجال / نساء)",
    description: "مكان مخصص ونظيف لأداء الصلوات",
    category: "amenity",
  },
  {
    key: "amenity_family_section",
    label: "قسم عوائل / قسم أفراد",
    description: "خصوصية ملائمة للعائلات والأفراد",
    category: "amenity",
  },
  {
    key: "amenity_wifi",
    label: "إنترنت واي فاي مجاني (Free Wi-Fi)",
    description: "شبكة إنترنت سريعة متاحة للزوار والعملاء",
    category: "amenity",
  },

  // 3. طبيعة الخدمة والحجوزات
  {
    key: "service_appointment_required",
    label: "حجز موعد مسبق مطلوب",
    description: "الخدمة تتطلب جدولة موعد مسبق عبر المنصة",
    category: "service",
  },
  {
    key: "service_walkins_welcome",
    label: "استقبال مباشر بدون موعد",
    description: "نرحب بالزوار والعملاء في أي وقت خلال ساعات العمل",
    category: "service",
  },
  {
    key: "service_home_service",
    label: "خدمة منزلية / موقع العميل",
    description: "إمكانية إرسال الفني أو مقدم الخدمة لموقع العميل",
    category: "service",
  },
  {
    key: "service_kid_friendly",
    label: "مناسب للأطفال والعائلات",
    description: "بيئة مهيأة ومرحبة بالأسر والأطفال",
    category: "service",
  },
];

const SECONDARY_CATEGORY_SUGGESTIONS: Record<string, string[]> = {
  salon: ["صالون حلاقة رجالي", "مركز عناية وتجميل", "سبا ومساج", "مصفف شعر"],
  barber: ["صالون حلاقة", "مركز عناية بالبشرة", "سبا رجالي", "حلاق أطفال"],
  clinic: ["مجمع عيادات طبية", "عيادة أسنان", "عيادة تجميل وليزر", "مركز علاج طبيعي"],
  auto: ["ورشة صيانة سيارات", "مغسلة سيارات وتلميع", "كهرباء وميكانيكا", "فحص كمبيوتر سيارات"],
  restaurant: ["مطعم", "مقهى ومحمصة", "حلويات ومخبوزات", "وجبات سريعة"],
  contracting: ["مقاولات عامة", "أعمال تشطيب وديكور", "صيانة مباني", "أعمال كهرباء وسباكة"],
  default: [
    "مركز خدمات",
    "متجر متخصص",
    "مكتب استشارات",
    "خدمات احترافية",
    "مؤسسة صيانة وتشغيل",
  ],
};

interface Props {
  query: string;
  locationId?: string;
  onToast: (msg: string, type: "success" | "error") => void;
}

export default function GbpAttributesAndCategories({ query, locationId, onToast }: Props) {
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, boolean>>({});
  const [secondaryCategories, setSecondaryCategories] = useState<string[]>([]);
  const [customCategoryInput, setCustomCategoryInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [primaryCategory, setPrimaryCategory] = useState("");

  useEffect(() => {
    let cancelled = false;
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/google-business?action=attributes-and-categories${query ? `&${query.slice(1)}` : ""}`);
        const data = await res.json();
        if (!cancelled && data.success) {
          setSelectedAttributes(data.attributes || {});
          setSecondaryCategories(Array.isArray(data.secondaryCategories) ? data.secondaryCategories : []);
          setPrimaryCategory(data.primaryCategory || "");
        }
      } catch {
        // non-fatal
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchSettings();
    return () => {
      cancelled = true;
    };
  }, [query]);

  const toggleAttribute = (key: string) => {
    setSelectedAttributes((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const addCategory = (category: string) => {
    const trimmed = category.trim();
    if (!trimmed) return;
    if (secondaryCategories.includes(trimmed)) return;
    if (secondaryCategories.length >= 9) {
      onToast("الحد الأقصى للتصنيفات الإضافية على جوجل هو 9 تصنيفات", "error");
      return;
    }
    setSecondaryCategories((prev) => [...prev, trimmed]);
    setCustomCategoryInput("");
  };

  const removeCategory = (category: string) => {
    setSecondaryCategories((prev) => prev.filter((c) => c !== category));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/google-business${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-attributes-and-categories",
          locationId,
          attributes: selectedAttributes,
          secondaryCategories,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "فشل حفظ الخصائص");
      }
      onToast("تم حفظ الخصائص والتصنيفات في إعدادات المنشأة بنجاح", "success");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "تعذّر حفظ الخصائص", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSyncToGoogle = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/google-business${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync-attributes",
          locationId,
          attributes: selectedAttributes,
          secondaryCategories,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "فشلت المزامنة مع جوجل");
      }
      onToast(data.message || "تمت مزامنة الخصائص والتصنيفات مع Google بنجاح", "success");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "تعذّرت المزامنة المباشرة — تم الاحتفاظ بالبيانات محلياً", "error");
    } finally {
      setSyncing(false);
    }
  };

  const suggestedList = useMemo(() => {
    const key = Object.keys(SECONDARY_CATEGORY_SUGGESTIONS).find((k) =>
      primaryCategory.toLowerCase().includes(k)
    );
    return key ? SECONDARY_CATEGORY_SUGGESTIONS[key] : SECONDARY_CATEGORY_SUGGESTIONS.default;
  }, [primaryCategory]);

  if (loading) {
    return <div className="h-44 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse" />;
  }

  return (
    <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6" dir="rtl">
      {/* رأس القسم */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              خصائص المنشأة والتصنيفات الفرعية (GBP Attributes & Categories)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              تحديد سمات النشاط الدقيقة ووسائل الدفع السعودية يعزز ظهورك في نتائج البحث المحلية المرشحة (Filter Chips).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5 text-amber-400" />
            {saving ? "جاري الحفظ..." : "حفظ محلياً"}
          </button>
          <button
            type="button"
            onClick={handleSyncToGoogle}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "جاري المزامنة..." : "مزامنة مع خرائط Google"}
          </button>
        </div>
      </div>

      {/* 1. قائمة التصنيفات الفرعية (Secondary Categories) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-slate-200">التصنيفات الفرعية الإضافية (حتى 9 تصنيفات)</h4>
          </div>
          <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
            {secondaryCategories.length} / 9 مختارة
          </span>
        </div>

        {/* التصنيفات المختارة حالياً */}
        <div className="flex flex-wrap gap-2 min-h-9 p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80">
          {secondaryCategories.length === 0 ? (
            <span className="text-xs text-slate-500 py-1">لم يتم اختيار أي تصنيف فرعي إضافي بعد.</span>
          ) : (
            secondaryCategories.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 font-medium"
              >
                {cat}
                <button
                  type="button"
                  onClick={() => removeCategory(cat)}
                  className="hover:text-rose-400 transition"
                  title="حذف التصنيف"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))
          )}
        </div>

        {/* اقتراحات سريعة بنقرة واحدة */}
        <div className="space-y-1.5">
          <p className="text-[11px] text-slate-400">اقتراحات سريعة تلائم نشاطك (اضغط للإضافة):</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedList.map((sug) => {
              const selected = secondaryCategories.includes(sug);
              return (
                <button
                  key={sug}
                  type="button"
                  onClick={() => (selected ? removeCategory(sug) : addCategory(sug))}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                    selected
                      ? "bg-amber-600 text-white border-amber-500 font-bold"
                      : "bg-slate-800/70 text-slate-300 border-slate-700/80 hover:bg-slate-700"
                  }`}
                >
                  {selected ? `✓ ${sug}` : `+ ${sug}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* إضافة تصنيف مخصص يدوي */}
        <div className="flex items-center gap-2 max-w-md pt-1">
          <input
            type="text"
            value={customCategoryInput}
            onChange={(e) => setCustomCategoryInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCategory(customCategoryInput);
              }
            }}
            placeholder="أضف تصنيفاً إضافياً مخصصاً..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="button"
            onClick={() => addCategory(customCategoryInput)}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            إضافة
          </button>
        </div>
      </div>

      {/* 2. شبكة الخصائص المتوافقة مع السوق السعودي (3 بطاقات) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
        {/* بطاقة وسائل الدفع */}
        <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 border-b border-slate-800/80 pb-2.5">
            <CreditCard className="w-4 h-4" />
            <h5 className="text-xs font-bold text-white">وسائل الدفع والتحصيل</h5>
          </div>

          <div className="space-y-2">
            {SAUDI_ATTRIBUTES.filter((a) => a.category === "payment").map((attr) => {
              const active = !!selectedAttributes[attr.key];
              return (
                <label
                  key={attr.key}
                  className={`flex items-start gap-2.5 p-2 rounded-xl cursor-pointer border transition text-xs ${
                    active
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                      : "bg-slate-900/40 border-slate-800/60 text-slate-300 hover:bg-slate-800/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleAttribute(attr.key)}
                    className="mt-0.5 shrink-0"
                  />
                  <div>
                    <span className="font-semibold block">{attr.label}</span>
                    <span className="text-[10px] text-slate-400 block leading-tight">{attr.description}</span>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-800/30 text-[10px] text-emerald-300 leading-relaxed flex items-start gap-2">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              إقرار نظامي: تفعيل وسائل الدفع الإلكتروني يتطلب توفرها الفعلي في المتجر وفق لوائح مكافحة التستر والبنك المركزي (SAMA).
            </span>
          </div>
        </div>

        {/* بطاقة المرافق والتسهيلات */}
        <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-sky-400 border-b border-slate-800/80 pb-2.5">
            <Building2 className="w-4 h-4" />
            <h5 className="text-xs font-bold text-white">المرافق وسهولة الوصول</h5>
          </div>

          <div className="space-y-2">
            {SAUDI_ATTRIBUTES.filter((a) => a.category === "amenity").map((attr) => {
              const active = !!selectedAttributes[attr.key];
              return (
                <label
                  key={attr.key}
                  className={`flex items-start gap-2.5 p-2 rounded-xl cursor-pointer border transition text-xs ${
                    active
                      ? "bg-sky-500/10 border-sky-500/30 text-sky-200"
                      : "bg-slate-900/40 border-slate-800/60 text-slate-300 hover:bg-slate-800/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleAttribute(attr.key)}
                    className="mt-0.5 shrink-0"
                  />
                  <div>
                    <span className="font-semibold block">{attr.label}</span>
                    <span className="text-[10px] text-slate-400 block leading-tight">{attr.description}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* بطاقة طبيعة الخدمة والحجوزات */}
        <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-amber-400 border-b border-slate-800/80 pb-2.5">
            <CalendarCheck className="w-4 h-4" />
            <h5 className="text-xs font-bold text-white">خيارات الحجز والخدمة</h5>
          </div>

          <div className="space-y-2">
            {SAUDI_ATTRIBUTES.filter((a) => a.category === "service").map((attr) => {
              const active = !!selectedAttributes[attr.key];
              return (
                <label
                  key={attr.key}
                  className={`flex items-start gap-2.5 p-2 rounded-xl cursor-pointer border transition text-xs ${
                    active
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                      : "bg-slate-900/40 border-slate-800/60 text-slate-300 hover:bg-slate-800/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleAttribute(attr.key)}
                    className="mt-0.5 shrink-0"
                  />
                  <div>
                    <span className="font-semibold block">{attr.label}</span>
                    <span className="text-[10px] text-slate-400 block leading-tight">{attr.description}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
