"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  Navigation,
  Clock,
  Phone,
  MessageCircle,
  ExternalLink,
  CheckCircle2,
  Check,
  Building2,
  Truck,
  Zap,
} from "lucide-react";
import type { TenantLocationConfig, TenantBranch } from "@/types/database";
import { useStorefront } from "@/components/storefront/StorefrontFrame";
import { buildWhatsappClickUrl, openWhatsappClick } from "@/lib/mken/wa-click";

const ONEPLUS_EASE = [0.16, 1, 0.3, 1] as const;

import {
  extractCoordinatesFromMapsUrl,
  extractPlaceIdFromMapsUrl,
  getCleanBusinessName,
  resolveCoordinates,
  resolveMapEmbedSrc,
  resolveGoogleMapsUrl,
  type LocationTarget,
  type LocationMapCoordinates,
} from "@/lib/mken/location-resolver";

export {
  extractCoordinatesFromMapsUrl,
  extractPlaceIdFromMapsUrl,
  getCleanBusinessName,
  resolveCoordinates,
  resolveMapEmbedSrc,
  resolveGoogleMapsUrl,
  type LocationTarget,
  type LocationMapCoordinates,
};

interface SaudiRegionGroup {
  name: string;
  cities: string[];
}

const SAUDI_REGIONS: SaudiRegionGroup[] = [
  {
    name: "المنطقة الغربية",
    cities: ["المدينة المنورة", "مكة المكرمة", "جدة", "الطائف", "ينبع", "رابغ"],
  },
  {
    name: "المنطقة الوسطى",
    cities: ["الرياض", "الخرج", "القصيم", "بريدة", "عنيزة", "الدرعية", "المجمعة"],
  },
  {
    name: "المنطقة الشرقية",
    cities: ["الدمام", "الخبر", "الظهران", "الجبيل", "الأحساء", "الهفوف", "القطيف", "حفر الباطن"],
  },
  {
    name: "المنطقة الجنوبية",
    cities: ["أبها", "خميس مشيط", "جازان", "نجران", "صبيا", "بيشة", "الباحة"],
  },
  {
    name: "المنطقة الشمالية",
    cities: ["تبوك", "حائل", "عرعر", "سكاكا", "الجوف", "القريات"],
  },
];

export interface TenantLocationSectionProps {
  locationConfig?: TenantLocationConfig | null;
  storeInfo?: {
    name: string;
    location: string;
    phone?: string;
    whatsapp?: string;
    rating?: string;
    reviewsCount?: string;
  };
  accentColor?: string;
  className?: string;
}

export function TenantLocationSection(props: TenantLocationSectionProps) {
  // Pull from Storefront Context if props are omitted
  const storefront = useStorefront();
  const storeInfo = props.storeInfo || storefront.storeInfo;
  const accentColor = props.accentColor || storefront.accentColor || "#10B981";
  const locationConfig = props.locationConfig !== undefined ? props.locationConfig : storefront.storeClient?.locationConfig;

  // Normalized location config fallback
  const config = useMemo<TenantLocationConfig>(() => {
    if (locationConfig && locationConfig.mode) {
      return locationConfig;
    }
    const rawLoc = storeInfo.location || "المملكة العربية السعودية";
    const isMultiRegion = /المنطقة الغربية|مناطق|فروع|ومكة|وجدة/.test(rawLoc);

    if (isMultiRegion) {
      return {
        mode: "coverage",
        primaryLocation: {
          name: storeInfo.name,
          city: "المدينة المنورة",
          district: "",
          address: rawLoc,
          workingHours: "السبت - الخميس: ٩:٠٠ ص - ١١:٠٠ م",
          isOpen: true,
        },
        branches: [],
        coverageRegions: ["المدينة المنورة", "مكة المكرمة", "جدة", "الطائف", "الرياض"],
        coverageNote: "نغطي كافة أحياء ومدن المنطقة المحددة مع سرعة استجابة ميدانية مباشرة",
      };
    }

    return {
      mode: "single",
      primaryLocation: {
        name: storeInfo.name,
        city: rawLoc.split(/[-–,]/)[0]?.trim() || "المدينة المنورة",
        district: rawLoc.split(/[-–,]/)[1]?.trim() || "",
        address: rawLoc,
        workingHours: "السبت - الخميس: ٩:٠٠ ص - ١١:٠٠ م",
        isOpen: true,
      },
      branches: [],
      coverageRegions: [],
    };
  }, [locationConfig, storeInfo.location, storeInfo.name]);

  const mode = config.mode || "single";
  const isMultipleBranches = (mode === "multiple" || (mode as string) === "branches") && config.branches.length > 0;
  const isCoverage = mode === "coverage";

  // Active branch in multi-branch mode
  const [activeBranchId, setActiveBranchId] = useState<string>(() => {
    if (config.branches && config.branches.length > 0) {
      const main = config.branches.find((b) => b.isMain) || config.branches[0];
      return main?.id || "";
    }
    return "";
  });

  // Selected city in coverage mode
  const [selectedCoverageCity, setSelectedCoverageCity] = useState<string>(() => {
    return config.coverageRegions?.[0] || config.primaryLocation?.city || "الرياض";
  });

  // Filter city in multi-branch mode
  const [cityFilter, setCityFilter] = useState<string>("all");

  // Get active branch object
  const activeBranch = useMemo<TenantBranch | undefined>(() => {
    if (isMultipleBranches && config.branches.length > 0) {
      return config.branches.find((b) => b.id === activeBranchId) || config.branches[0];
    }
    return undefined;
  }, [isMultipleBranches, config.branches, activeBranchId]);

  // Unique cities for multi-branch filtering
  const branchCities = useMemo(() => {
    if (!isMultipleBranches) return [];
    const set = new Set<string>();
    config.branches.forEach((b) => {
      if (b.city) set.add(b.city.trim());
    });
    return Array.from(set);
  }, [isMultipleBranches, config.branches]);

  // Filtered branches
  const filteredBranches = useMemo(() => {
    if (!isMultipleBranches) return [];
    if (cityFilter === "all") return config.branches;
    return config.branches.filter((b) => b.city === cityFilter);
  }, [isMultipleBranches, config.branches, cityFilter]);

  // Regional grouping for Coverage mode
  const coverageGroupedRegions = useMemo(() => {
    if (!isCoverage) return [];
    const coveredSet = new Set(config.coverageRegions || []);
    const result: { name: string; cities: string[] }[] = [];
    const assignedCities = new Set<string>();

    SAUDI_REGIONS.forEach((region) => {
      const matching = region.cities.filter((c) => coveredSet.has(c));
      if (matching.length > 0) {
        result.push({ name: region.name, cities: matching });
        matching.forEach((c) => assignedCities.add(c));
      }
    });

    const leftover = (config.coverageRegions || []).filter((c) => !assignedCities.has(c));
    if (leftover.length > 0) {
      result.push({ name: "مناطق التغطية والخدمة الإضافية", cities: leftover });
    }

    if (result.length === 0 && config.coverageRegions?.length) {
      result.push({ name: "مناطق الخدمة المعتمدة", cities: config.coverageRegions });
    }

    return result;
  }, [isCoverage, config.coverageRegions]);

  // Dynamic headings and subtitles
  const sectionHeading = useMemo(() => {
    if (isCoverage) return "مناطق التغطية والخدمة";
    if (isMultipleBranches) return "فروعنا في خدمتك";
    return "تواجدنا بالقرب منك";
  }, [isCoverage, isMultipleBranches]);

  const sectionSubtitle = useMemo(() => {
    if (isCoverage) {
      return "نصلك أينما كنت عبر شبكة فرقنا الميدانية المعتمدة مع التزام كامل بسرعة الاستجابة وجودة التنفيذ.";
    }
    if (isMultipleBranches) {
      return "اختر الفرع الأقرب إليك واستكشف أوقات العمل وتفاصيل الوصول المباشر عبر الخريطة.";
    }
    return "نسعد باستقبالكم في موقعنا وتوفير تجربة متميزة تلبي تطلعاتكم طوال أوقات العمل.";
  }, [isCoverage, isMultipleBranches]);

  // Resolved active map location metadata
  const activeMapLocation = useMemo(() => {
    const businessName = storeInfo.name || "المنشأة";

    if (isMultipleBranches && activeBranch) {
      const branchTitle = `${businessName} — ${activeBranch.name}`;
      const cleanDistrict = (activeBranch.district || "").replace(/^حي\s+/, "").trim();
      const city = activeBranch.city || "";
      const displayLocation = cleanDistrict && city
        ? `${cleanDistrict}، ${city}`
        : cleanDistrict || city || activeBranch.address || "المملكة العربية السعودية";

      return {
        name: branchTitle,
        shortName: activeBranch.name,
        businessName,
        city,
        district: cleanDistrict,
        address: activeBranch.address || `${displayLocation}، المملكة العربية السعودية`,
        displayLocation,
        googleMapsUrl: activeBranch.googleMapsUrl,
        latitude: activeBranch.latitude,
        longitude: activeBranch.longitude,
        placeId: activeBranch.placeId,
      };
    }

    if (isCoverage) {
      const coverageTitle = `${businessName} — ${selectedCoverageCity}`;
      return {
        name: coverageTitle,
        shortName: selectedCoverageCity,
        businessName,
        city: selectedCoverageCity,
        district: "",
        address: `تغطية ميدانية مباشرة في ${selectedCoverageCity} وكافة الأحياء المجاورة`,
        displayLocation: selectedCoverageCity,
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedCoverageCity + " المملكة العربية السعودية")}`,
        latitude: undefined,
        longitude: undefined,
        placeId: undefined,
      };
    }

    const prim = config.primaryLocation || {};
    const singleTitle = businessName;
    const contactMap = storefront.contactExtras?.map;

    const rawDistrict = prim.district || (prim.address ? prim.address.split(/[-–,]/)[1]?.trim() : "") || "";
    const cleanDistrict = rawDistrict.replace(/^حي\s+/, "").trim();
    const city = prim.city || contactMap?.city || "المدينة المنورة";
    const displayLocation = cleanDistrict && city
      ? `${cleanDistrict}، ${city}`
      : cleanDistrict || city || prim.address || storeInfo.location || "المملكة العربية السعودية";

    const latitude = prim.latitude ?? (typeof contactMap?.lat === "number" ? contactMap.lat : undefined);
    const longitude = prim.longitude ?? (typeof contactMap?.lng === "number" ? contactMap.lng : undefined);
    const googleMapsUrl = prim.googleMapsUrl || contactMap?.mapsUrl || storefront.storeClient?.socialLinks?.map;

    return {
      name: singleTitle,
      shortName: singleTitle,
      businessName,
      city,
      district: cleanDistrict,
      address: prim.address || (cleanDistrict && city ? `حي ${cleanDistrict}، ${city}` : storeInfo.location || `${city}، المملكة العربية السعودية`),
      displayLocation,
      googleMapsUrl,
      latitude,
      longitude,
      placeId: prim.placeId,
    };
  }, [
    isMultipleBranches,
    activeBranch,
    isCoverage,
    selectedCoverageCity,
    config.primaryLocation,
    storeInfo.name,
    storeInfo.location,
    storefront.contactExtras?.map,
    storefront.storeClient?.socialLinks?.map,
  ]);

  const mapEmbedSrc = useMemo(() => {
    return resolveMapEmbedSrc(activeMapLocation, storeInfo.name);
  }, [activeMapLocation, storeInfo.name]);

  const directionsUrl = useMemo(() => {
    return resolveGoogleMapsUrl(activeMapLocation, storeInfo.name);
  }, [activeMapLocation, storeInfo.name]);

  // WhatsApp click handler
  const handleWhatsapp = (customMessage: string) => {
    const rawNumber = storeInfo.whatsapp || storeInfo.phone || "966543530333";
    const url = buildWhatsappClickUrl(rawNumber, customMessage);
    if (url) openWhatsappClick(url);
  };

  return (
    <section
      id="tenant-locations"
      dir="rtl"
      className={`py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-10 scroll-mt-24 ${props.className || ""}`}
    >
      {/* 1. SECTION HEADER */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: ONEPLUS_EASE }}
        className="text-center space-y-3 max-w-2xl mx-auto"
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
          <MapPin className="w-3.5 h-3.5" />
          <span>مواقعنا ونطاق الخدمة</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white leading-[1.35]">
          {sectionHeading}
        </h2>
        <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
          {sectionSubtitle}
        </p>
      </motion.div>

      {/* 2-COLUMN BENTO SPLIT (RTL: Col 1 is Right 60%, Col 2 is Left 40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* RIGHT COLUMN: Interactive Selector (60% width on desktop = lg:col-span-7) */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.6, ease: ONEPLUS_EASE }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
            e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
          }}
          className="lg:col-span-7 bg-white/90 dark:bg-[#141417]/85 backdrop-blur-2xl border-t border-emerald-400/35 border-x border-b border-slate-200/80 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-900/[0.03] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)] flex flex-col justify-between space-y-6 spotlight-card overflow-hidden"
          style={{
            borderTopColor: `${accentColor}55`,
            "--spotlight-color": `${accentColor}18`,
          } as React.CSSProperties}
        >
          {/* CASE A: SINGLE BRANCH MODE */}
          {!isMultipleBranches && !isCoverage ? (
            <div className="space-y-6 flex-1 flex flex-col justify-between">
              <div className="space-y-5">
                {/* Header line with real business name and status badge */}
                <div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-slate-100 dark:border-white/5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                        {activeMapLocation.name}
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{activeMapLocation.displayLocation}</span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>مفتوح الآن • يغلق ١١:٠٠ م</span>
                  </span>
                </div>

                {/* Detailed Address Card */}
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-white/5">
                  <MapPin className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">العنوان والوصول</p>
                    <p className="text-slate-600 dark:text-zinc-400 text-xs sm:text-sm leading-relaxed">
                      {activeMapLocation.address}
                    </p>
                  </div>
                </div>

                {/* Direct Phone Line */}
                {storeInfo.phone ? (
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-white/5">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-emerald-500 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">الاتصال المباشر والاستفسارات</p>
                        <p className="text-slate-600 dark:text-zinc-400 text-xs font-mono" dir="ltr">
                          {storeInfo.phone}
                        </p>
                      </div>
                    </div>
                    <a
                      href={`tel:${storeInfo.phone.replace(/[^0-9+]/g, "")}`}
                      className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-zinc-200 hover:border-emerald-500 transition-colors shadow-xs"
                    >
                      اتصال مباشر
                    </a>
                  </div>
                ) : null}

                {/* Working hours box: clean vertical flex stack formatting weekdays and Friday on two clean lines */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-white/5 space-y-3">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>أوقات العمل واستقبال العملاء</span>
                  </div>
                  <div className="flex flex-col space-y-2 text-xs text-slate-600 dark:text-zinc-400 pt-1">
                    <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-white/5 pb-2">
                      <span className="font-medium text-slate-700 dark:text-zinc-300">السبت - الخميس:</span>
                      <span className="font-bold text-slate-900 dark:text-zinc-100">٩:٠٠ ص - ١١:٠٠ م</span>
                    </div>
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="font-medium text-slate-700 dark:text-zinc-300">الجمعة:</span>
                      <span className="font-bold text-slate-900 dark:text-zinc-100">٤:٠٠ م - ١١:٠٠ م</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Two prominent action buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm text-slate-950 flex items-center justify-center gap-2 shadow-lg hover:opacity-95 active:scale-98 transition-all text-center"
                  style={{ backgroundColor: accentColor }}
                >
                  <Navigation className="w-4 h-4" />
                  <span>الاتجاهات عبر خرائط Google</span>
                </a>
                <button
                  type="button"
                  onClick={() =>
                    handleWhatsapp(
                      `السلام عليكم ورحمة الله، أود الاستفسار عن تفاصيل الزيارة في موقع ${activeMapLocation.name}.`
                    )
                  }
                  className="w-full py-3.5 px-4 rounded-2xl font-bold text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/40 hover:bg-emerald-500/10 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>تواصل عبر واتساب</span>
                </button>
              </div>
            </div>
          ) : null}

          {/* CASE B: MULTIPLE BRANCHES MODE */}
          {isMultipleBranches ? (
            <div className="space-y-5 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                {/* Horizontal City Filter Pills */}
                {branchCities.length > 1 ? (
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => setCityFilter("all")}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        cityFilter === "all"
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-sm"
                          : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
                      }`}
                    >
                      الكل ({config.branches.length})
                    </button>
                    {branchCities.map((city) => (
                      <button
                        key={city}
                        type="button"
                        onClick={() => setCityFilter(city)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                          cityFilter === city
                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-sm"
                            : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
                        }`}
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                ) : null}

                {/* Interactive Branches Stack */}
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {filteredBranches.map((branch) => {
                    const isSelected = branch.id === (activeBranch?.id || "");
                    const branchMapUrl = resolveGoogleMapsUrl(branch, storeInfo.name);
                    return (
                      <div
                        key={branch.id}
                        onClick={() => setActiveBranchId(branch.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isSelected
                            ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-md"
                            : "border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-zinc-900/40 hover:border-slate-300 dark:hover:border-white/20"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                              {branch.name}
                            </h4>
                            {branch.isMain ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                الفرع الرئيسي
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>
                              {branch.city} {branch.district ? `• حي ${branch.district.replace(/^حي\s+/, "")}` : ""}
                            </span>
                          </p>
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>مفتوح الآن ({branch.workingHours || "مواعيد عمل مرنة"})</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/40 dark:border-white/5">
                          <a
                            href={branchMapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-zinc-200 hover:border-emerald-500 transition-colors shadow-xs"
                          >
                            <Navigation className="w-3.5 h-3.5 text-emerald-500" />
                            <span>فتح في الخريطة</span>
                          </a>
                          {branch.phone ? (
                            <a
                              href={`tel:${branch.phone.replace(/[^0-9+]/g, "")}`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 hover:text-emerald-500 transition-colors shadow-xs"
                              title="اتصال بالفرع"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Multi-branch footer action */}
              <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  انقر على أي فرع لتحديث الخريطة والاتجاهات المباشرة فوراً.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    handleWhatsapp(
                      `السلام عليكم ورحمة الله، أود الاستفسار عن فرع (${activeBranch?.name || "الرئيسي"}) في ${storeInfo.name}.`
                    )
                  }
                  className="w-full sm:w-auto py-2.5 px-5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/40 hover:bg-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>تواصل بخصوص هذا الفرع</span>
                </button>
              </div>
            </div>
          ) : null}

          {/* CASE C: MULTI-REGION / SERVICE AREA BUSINESS */}
          {isCoverage ? (
            <div className="space-y-6 flex-1 flex flex-col justify-between">
              <div className="space-y-5">
                {/* Notice Badge */}
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
                  <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="leading-relaxed">
                    {config.coverageNote || "⚡ نصلكم أينما كنتم عبر فرقنا الميدانية المعتمدة مع جاهزية تامة للتنفيذ المباشر."}
                  </p>
                </div>

                {/* Regional Grouping Grid */}
                <div className="space-y-4">
                  {coverageGroupedRegions.map((region) => (
                    <div key={region.name} className="space-y-2">
                      <p className="text-xs font-extrabold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{region.name}</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {region.cities.map((city) => {
                          const isSelected = selectedCoverageCity === city;
                          return (
                            <button
                              key={city}
                              type="button"
                              onClick={() => setSelectedCoverageCity(city)}
                              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20 scale-[1.02] border border-emerald-600"
                                  : "bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:border-emerald-500/50"
                              }`}
                            >
                              {isSelected ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-emerald-500 opacity-60" />
                              )}
                              <span>{city}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Action Button Pre-filling Selected City */}
              <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-2">
                <button
                  type="button"
                  onClick={() =>
                    handleWhatsapp(
                      `السلام عليكم ورحمة الله، أود طلب الخدمة في مدينة (${selectedCoverageCity}) من مؤسسة ${storeInfo.name}.`
                    )
                  }
                  className="w-full py-4 px-6 rounded-2xl font-black text-sm text-slate-950 flex items-center justify-center gap-2 shadow-xl hover:scale-[1.01] active:scale-95 transition-all cursor-pointer"
                  style={{ backgroundColor: accentColor }}
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>اطلب الخدمة الآن في {selectedCoverageCity} عبر واتساب</span>
                </button>
                <p className="text-center text-[11px] text-slate-500 dark:text-zinc-400">
                  سيتم تجهيز فريق العمل وتحديد موعد الزيارة الميدانية لمدينتك فور إرسال الطلب.
                </p>
              </div>
            </div>
          ) : null}
        </motion.div>

        {/* LEFT COLUMN: Luxury Google Maps Local Pack Preview Card (40% width on desktop = lg:col-span-5) */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.6, delay: 0.1, ease: ONEPLUS_EASE }}
          className="lg:col-span-5 bg-white/90 dark:bg-[#141417]/85 backdrop-blur-2xl border-t border-emerald-400/35 border-x border-b border-slate-200/80 dark:border-white/10 rounded-3xl overflow-hidden shadow-xl shadow-slate-900/[0.03] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)] flex flex-col relative min-h-[440px] lg:min-h-[520px]"
          style={{
            borderTopColor: `${accentColor}55`,
          }}
        >
          {/* Map Preview Iframe: Real Business Coordinates / Clean Address Query */}
          <div className="absolute inset-0 w-full h-full bg-slate-100 dark:bg-zinc-900">
            <iframe
              key={mapEmbedSrc}
              title={`خريطة موقع ${activeMapLocation.name}`}
              src={mapEmbedSrc}
              className="w-full h-full border-0 filter contrast-[1.05] opacity-90 hover:opacity-100 transition-opacity"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          {/* Top Floating Badge */}
          <div className="absolute top-4 right-4 z-20 backdrop-blur-md bg-white/90 dark:bg-[#09090B]/90 px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-zinc-200 shadow-md flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>خريطة تفاعلية مباشرة</span>
          </div>

          {/* Bottom Floating Glassmorphism Overlay Card (PDPL Compliant - No fake review metrics) */}
          <div className="mt-auto relative z-20 m-3 sm:m-4 p-4 sm:p-5 rounded-2xl backdrop-blur-xl bg-white/92 dark:bg-[#09090B]/92 border border-slate-200/80 dark:border-white/10 shadow-2xl space-y-3 text-right">
            {/* Real Business / Branch Name + Verified Badge */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                  {activeMapLocation.name}
                </h4>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 shrink-0">
                  ✓ نشاط موثّق عبر مكّن
                </span>
              </div>
            </div>

            {/* Actual Neighborhood & City */}
            <p className="text-xs text-slate-600 dark:text-zinc-300 truncate flex items-center gap-1.5 font-medium">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{activeMapLocation.displayLocation}</span>
            </p>

            {/* Prominent Get Directions Button */}
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-black flex items-center justify-center gap-2 hover:opacity-90 active:scale-98 transition-all shadow-md"
            >
              <Navigation className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
              <span>احصل على الاتجاهات (Google Maps)</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-60" />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
