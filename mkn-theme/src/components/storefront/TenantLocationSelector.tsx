"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  MapPin,
  ChevronDown,
  Navigation,
  Clock,
  Phone,
  MessageCircle,
  ExternalLink,
  Check,
  X,
  Sparkles,
  Building2,
  Truck,
} from "lucide-react";
import type { TenantLocationConfig, TenantBranch } from "@/types/database";
import { buildWhatsappClickUrl, openWhatsappClick } from "@/lib/mken/wa-click";
import { resolveGoogleMapsUrl } from "@/components/storefront/TenantLocationSection";

interface TenantLocationSelectorProps {
  locationConfig?: TenantLocationConfig | null;
  storeInfo: {
    name: string;
    location: string;
    phone?: string;
    whatsapp?: string;
  };
  accentColor: string;
  variant?: "navbar" | "hero";
  className?: string;
}

export function TenantLocationSelector({
  locationConfig,
  storeInfo,
  accentColor,
  variant = "navbar",
  className = "",
}: TenantLocationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Derived location config fallback
  const config = useMemo<TenantLocationConfig>(() => {
    if (locationConfig && locationConfig.mode) {
      return locationConfig;
    }
    // Fallback if no locationConfig is explicitly defined on the client
    const rawLoc = storeInfo.location || "المملكة العربية السعودية";
    const isMultiRegion = /المنطقة الغربية|مناطق|فروع|ومكة|وجدة/.test(rawLoc);

    if (isMultiRegion) {
      return {
        mode: "coverage",
        primaryLocation: {
          city: "المدينة المنورة",
          district: "",
          address: rawLoc,
          workingHours: "08:00 ص - 10:00 م",
          isOpen: true,
        },
        branches: [],
        coverageRegions: ["المدينة المنورة", "مكة المكرمة", "جدة", "الطائف", "الرياض"],
        coverageNote: "نغطي كافة أحياء ومدن المنطقة المحددة",
      };
    }

    return {
      mode: "single",
      primaryLocation: {
        city: rawLoc.split(/[-–,]/)[0]?.trim() || "المدينة المنورة",
        district: rawLoc.split(/[-–,]/)[1]?.trim() || "",
        address: rawLoc,
        workingHours: "مفتوح الآن — مواعيد عمل مرنة",
        isOpen: true,
      },
      branches: [],
      coverageRegions: [],
    };
  }, [locationConfig, storeInfo.location]);

  // Selected branch in multi-branch mode
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

  // Selected city filter for multi-branch (>3 branches)
  const [branchCityFilter, setBranchCityFilter] = useState<string>("all");

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const activeBranch: TenantBranch | undefined = useMemo(() => {
    if (config.branches && config.branches.length > 0) {
      return config.branches.find((b) => b.id === activeBranchId) || config.branches[0];
    }
    return undefined;
  }, [config.branches, activeBranchId]);

  // Cities list for multi-branch filter
  const branchCities = useMemo(() => {
    if (!config.branches) return [];
    const set = new Set<string>();
    config.branches.forEach((b) => {
      if (b.city) set.add(b.city.trim());
    });
    return Array.from(set);
  }, [config.branches]);

  const filteredBranches = useMemo(() => {
    if (!config.branches) return [];
    if (branchCityFilter === "all") return config.branches;
    return config.branches.filter((b) => b.city.trim() === branchCityFilter);
  }, [config.branches, branchCityFilter]);

  // Pill Label Computation
  const pillLabel = useMemo(() => {
    if (config.mode === "multiple") {
      const count = config.branches?.length || 0;
      if (activeBranch) {
        return `${activeBranch.city} (${count} فروع)`;
      }
      return `${count} فروع معتمدة`;
    }
    if (config.mode === "coverage") {
      const count = config.coverageRegions?.length || 0;
      if (selectedCoverageCity) {
        return `نغطي: ${selectedCoverageCity} (${count} مناطق)`;
      }
      return `نغطي ${count} مناطق`;
    }
    // Single
    const p = config.primaryLocation;
    if (p?.city && p?.district) {
      return `${p.city} - ${p.district}`;
    }
    if (p?.city) {
      return p.city;
    }
    return storeInfo.location || "المملكة العربية السعودية";
  }, [config, activeBranch, selectedCoverageCity, storeInfo.location]);

  // WhatsApp CTA for coverage mode
  const handleCoverageWhatsApp = (city: string) => {
    const wa = activeBranch?.whatsapp || storeInfo.whatsapp || storeInfo.phone || "";
    const text = `السلام عليكم، أود الاستفسار وطلب الخدمة من ${storeInfo.name} في منطقة ${city}.`;
    const url = buildWhatsappClickUrl(wa, text);
    if (url) {
      openWhatsappClick(url);
    }
  };

  return (
    <div ref={containerRef} className={`relative inline-block text-right ${className}`}>
      {/* Location Trigger Button / Pill */}
      {variant === "navbar" ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-[#1E1E24] dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-white/10 transition-all cursor-pointer shadow-xs group"
          title="عرض الفروع والمناطق المخدومة"
          aria-expanded={isOpen}
        >
          <MapPin
            className="w-3.5 h-3.5 transition-transform group-hover:scale-110"
            style={{ color: accentColor }}
          />
          <span className="truncate max-w-[130px] sm:max-w-[170px]">{pillLabel}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/90 dark:bg-[#141417]/90 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10 hover:border-emerald-500/50 shadow-sm transition-all cursor-pointer group"
          aria-expanded={isOpen}
        >
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
            <MapPin className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <span>الموقع:</span>
          </span>
          <span className="truncate font-medium">{pillLabel}</span>
          <ChevronDown
            className={`w-3 h-3 text-slate-400 group-hover:text-foreground transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      )}

      {/* Expanded Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-auto min-w-[320px] sm:min-w-[380px] max-w-[420px] bg-white dark:bg-[#141417] border border-slate-200 dark:border-white/10 rounded-3xl p-5 shadow-2xl z-50 text-right space-y-4 animate-in fade-in zoom-in-95 duration-200">
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm"
                style={{ backgroundColor: accentColor }}
              >
                {config.mode === "coverage" ? (
                  <Truck className="w-4 h-4" />
                ) : config.mode === "multiple" ? (
                  <Building2 className="w-4 h-4" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {config.mode === "coverage"
                    ? "المناطق ونطاق التغطية"
                    : config.mode === "multiple"
                    ? "فروع المنشأة المعتمدة"
                    : "موقع المنشأة وبيانات الوصول"}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  {config.mode === "coverage"
                    ? "نصل إلى موقعك في أي من المدن المحددة"
                    : config.mode === "multiple"
                    ? "اختر الفرع الأقرب لزيارته أو التواصل معه"
                    : "استقبال مباشر بدون انتظار"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* MODE A: Single Physical Branch */}
          {config.mode === "single" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      {(!config.primaryLocation?.name || config.primaryLocation.name === "الفرع الرئيسي")
                        ? storeInfo.name
                        : config.primaryLocation.name}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {config.primaryLocation?.isOpen !== false ? "مفتوح الآن" : "ساعات العمل"}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                  {config.primaryLocation?.address || storeInfo.location}
                </p>

                {config.primaryLocation?.workingHours && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 pt-1 border-t border-slate-200/60 dark:border-white/5">
                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>{config.primaryLocation.workingHours}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <a
                  href={resolveGoogleMapsUrl(config.primaryLocation || {}, storeInfo.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>فتح في خرائط Google</span>
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </a>

                {(storeInfo.whatsapp || storeInfo.phone) && (
                  <a
                    href={buildWhatsappClickUrl(
                      storeInfo.whatsapp || storeInfo.phone || "",
                      `السلام عليكم، أود الاستفسار عن موقع ${storeInfo.name}`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl transition-colors"
                    title="محادثة واتساب"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </a>
                )}

                {storeInfo.phone && (
                  <a
                    href={`tel:${storeInfo.phone}`}
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl transition-colors"
                    title="اتصال هاتفي"
                  >
                    <Phone className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* MODE B: Multiple Physical Branches */}
          {config.mode === "multiple" && (
            <div className="space-y-3">
              {/* Optional City Filter Tabs if >3 branches */}
              {branchCities.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setBranchCityFilter("all")}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                      branchCityFilter === "all"
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                        : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200"
                    }`}
                  >
                    الكل ({config.branches?.length || 0})
                  </button>
                  {branchCities.map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => setBranchCityFilter(city)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                        branchCityFilter === city
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                          : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200"
                      }`}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              )}

              {/* Branch Cards List */}
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-0.5">
                {filteredBranches.map((branch) => {
                  const isSelected = branch.id === activeBranchId;
                  return (
                    <div
                      key={branch.id}
                      onClick={() => setActiveBranchId(branch.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500 shadow-sm"
                          : "bg-slate-50 dark:bg-zinc-900/60 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                              isSelected
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                            }`}
                          >
                            {isSelected ? <Check className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
                          </div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {branch.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                          {branch.city}
                        </span>
                      </div>

                      {branch.address && (
                        <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-snug">
                          {branch.address}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 dark:text-zinc-400 border-t border-slate-200/50 dark:border-white/5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span>{branch.workingHours || "متاح للزيارة"}</span>
                        </span>

                        <a
                          href={resolveGoogleMapsUrl(branch, storeInfo.name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
                        >
                          <span>الاتجاهات</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Active branch footer summary */}
              {activeBranch && (
                <div className="pt-2 flex items-center gap-2 border-t border-slate-100 dark:border-white/10">
                  <a
                    href={resolveGoogleMapsUrl(activeBranch, storeInfo.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-3 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-transform active:scale-95"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>خرائط Google ({activeBranch.city})</span>
                  </a>
                  {activeBranch.whatsapp || storeInfo.whatsapp ? (
                    <a
                      href={buildWhatsappClickUrl(
                        activeBranch.whatsapp || storeInfo.whatsapp || "",
                        `السلام عليكم، أود التواصل مع ${activeBranch.name}`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
                      title="واتساب الفرع المحدد"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* MODE C: Multi-Region / Service-Area Business */}
          {config.mode === "coverage" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-950 dark:text-amber-200 text-xs leading-relaxed flex items-start gap-2">
                <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">خدمة وتغطية ميدانية بدون استقبال فروع:</strong>
                  <span className="text-[11px] opacity-90">
                    {config.coverageNote || "نقدم خدماتنا ونصل إلى موقعك أو مشروعك في المدن المعتمدة أدناه."}
                  </span>
                </div>
              </div>

              {/* Regions Pills */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                  اختر مدينتك أو منطقتك لطلب الخدمة:
                </label>
                <div className="flex flex-wrap gap-2">
                  {(config.coverageRegions || []).map((region) => {
                    const isSelected = selectedCoverageCity === region;
                    return (
                      <button
                        key={region}
                        type="button"
                        onClick={() => setSelectedCoverageCity(region)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20 scale-105"
                            : "bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                        <span>{region}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* WhatsApp CTA with pre-filled selected city */}
              <button
                type="button"
                onClick={() => handleCoverageWhatsApp(selectedCoverageCity)}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>اطلب الخدمة في ({selectedCoverageCity}) عبر واتساب</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
