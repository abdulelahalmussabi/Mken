"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import {
  DEVICE_PRESETS,
  type ViewportDevice,
  type JsonPatchOperation,
} from "@/lib/preview/protocol";
import { PreviewBridge, type PreviewBridgeState } from "@/lib/preview/preview-bridge";
import { loadTenantDraft, saveTenantDraft } from "@/lib/preview/indexeddb-draft";
import {
  Smartphone,
  Tablet,
  Monitor,
  RotateCw,
  Share2,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sliders,
  ChevronDown,
  ShieldCheck,
  Copy,
  Lock,
} from "lucide-react";

export interface LivePreviewEditorProps {
  tenantSlug: string;
  initialName?: string;
  initialTagline?: string;
  initialSubtitle?: string;
  initialAccentColor?: string;
  initialSecondaryColor?: string;
  onSaveToServer?: (data: {
    name: string;
    tagline: string;
    subtitle: string;
    accentColor: string;
    secondaryColor: string;
  }) => Promise<{ success: boolean; message?: string }>;
}

export function LivePreviewEditor({
  tenantSlug,
  initialName = "",
  initialTagline = "",
  initialSubtitle = "",
  initialAccentColor = "#f59e0b",
  initialSecondaryColor = "#10b981",
  onSaveToServer,
}: LivePreviewEditorProps) {
  // Form State
  const [name, setName] = useState(initialName);
  const [tagline, setTagline] = useState(initialTagline);
  const [subtitle, setSubtitle] = useState(initialSubtitle);
  const [accentColor, setAccentColor] = useState(initialAccentColor);
  const [secondaryColor, setSecondaryColor] = useState(initialSecondaryColor);

  // Preview UI State
  const [activeDevice, setActiveDevice] = useState<ViewportDevice>("mobile-iphone");
  const [scale, setScale] = useState(1);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState(false);
  const [bridgeState, setBridgeState] = useState<PreviewBridgeState>({
    status: "idle",
    lastError: null,
    latencyMs: 0,
  });
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [serverSavePending, startServerSave] = useTransition();
  const [serverSaveMessage, setServerSaveMessage] = useState<string | null>(null);

  // Ephemeral Share State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharePin, setSharePin] = useState("1234");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const bridgeRef = useRef<PreviewBridge | null>(null);

  // Screen detection for Abu Fahad's mobile mode
  useEffect(() => {
    const checkScreen = () => {
      setIsMobileScreen(window.innerWidth < 1024);
    };
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  // Initialize Bridge
  useEffect(() => {
    const bridge = new PreviewBridge();
    bridgeRef.current = bridge;

    const unsubscribe = bridge.subscribeState((st) => {
      setBridgeState(st);
    });

    return () => {
      unsubscribe();
      bridge.detach();
    };
  }, []);

  // Load Offline Draft from IndexedDB on Mount
  useEffect(() => {
    loadTenantDraft(tenantSlug).then((draft) => {
      if (draft && draft.content) {
        if (draft.content.name) setName(draft.content.name);
        if (draft.content.tagline) setTagline(draft.content.tagline);
        if (draft.content.subtitle) setSubtitle(draft.content.subtitle);
        if (draft.tokens?.["--accent-color"]) setAccentColor(draft.tokens["--accent-color"]);
        if (draft.tokens?.["--secondary-color"]) setSecondaryColor(draft.tokens["--secondary-color"]);
        setDraftSavedAt(draft.updatedAt);
      }
    });
  }, [tenantSlug]);

  // Connect iframe to bridge once loaded
  const onIframeLoad = () => {
    if (iframeRef.current && bridgeRef.current) {
      bridgeRef.current.attach(iframeRef.current, tenantSlug);
      // Push initial values
      setTimeout(() => {
        pushLiveUpdates();
      }, 300);
    }
  };

  // Push live updates to Sandboxed Iframe (Sub-16ms)
  const pushLiveUpdates = () => {
    if (!bridgeRef.current) return;

    // 1. Inject CSS Tokens instantly
    bridgeRef.current.applyStyleTokens({
      "--accent-color": accentColor,
      "--secondary-color": secondaryColor,
      "--primary-color": accentColor,
    });

    // 2. Inject DOM Patches
    const patches: JsonPatchOperation[] = [
      { op: "replace", path: "/client/name", value: name },
      { op: "replace", path: "/client/tagline", value: tagline },
      { op: "replace", path: "/client/subtitle", value: subtitle },
    ];
    bridgeRef.current.applyDomPatch(patches);
  };

  // Auto-save draft to IndexedDB with debounce
  useEffect(() => {
    pushLiveUpdates();

    const timer = setTimeout(() => {
      saveTenantDraft(tenantSlug, {
        tokens: {
          "--accent-color": accentColor,
          "--secondary-color": secondaryColor,
        },
        content: { name, tagline, subtitle },
      }).then(() => {
        setDraftSavedAt(Date.now());
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [name, tagline, subtitle, accentColor, secondaryColor, tenantSlug]);

  // Server Save
  const handleSave = () => {
    if (!onSaveToServer) return;
    setServerSaveMessage(null);
    startServerSave(async () => {
      const res = await onSaveToServer({
        name,
        tagline,
        subtitle,
        accentColor,
        secondaryColor,
      });
      if (res.success) {
        setServerSaveMessage("تم حفظ التعديلات بنجاح ونشرها للمتجر!");
      } else {
        setServerSaveMessage(res.message || "فشل الحفظ في الخادم.");
      }
    });
  };

  // Generate Ephemeral Share URL (Saudi PDPL / NCA Compliant)
  const handleCreateShareLink = async () => {
    setShareLoading(true);
    try {
      const res = await fetch("/api/preview/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          pin: sharePin,
          snapshot: {
            name,
            tagline,
            subtitle,
            accentColor,
            secondaryColor,
          },
        }),
      });
      const data = await res.json();
      if (data?.shareUrl) {
        setShareUrl(data.shareUrl);
      }
    } catch {
      // Fallback local share URL
      setShareUrl(`${window.location.origin}/preview/sandbox?tenant=${tenantSlug}&draft=ephemeral`);
    } finally {
      setShareLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(`${shareUrl} (رمز الدخول PIN: ${sharePin})`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const selectedDevice = DEVICE_PRESETS[activeDevice];
  const previewSrc = `/preview/sandbox?tenant=${encodeURIComponent(tenantSlug)}&preview=true`;

  return (
    <div className="w-full min-h-[680px] flex flex-col bg-slate-950 text-slate-100 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Top Action Bar */}
      <header className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                bridgeState.status === "connected"
                  ? "bg-emerald-400 animate-pulse"
                  : bridgeState.status === "handshaking"
                  ? "bg-amber-400"
                  : "bg-rose-500"
              }`}
            />
            <span className="text-xs font-bold text-slate-300">
              {bridgeState.status === "connected"
                ? `المعاينة الفورية نشطة (${bridgeState.latencyMs}ms)`
                : bridgeState.status === "handshaking"
                ? "جاري تهيئة بيئة العزل..."
                : "غير متصل"}
            </span>
          </div>

          {draftSavedAt ? (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              محفوظ تلقائياً في جوالك
            </span>
          ) : null}
        </div>

        {/* Device Switcher (Desktop / Tablet / Mobile) */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveDevice("mobile-iphone")}
            className={`p-1.5 rounded-lg text-xs font-medium transition ${
              activeDevice === "mobile-iphone" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
            }`}
            title="آيفون"
          >
            <Smartphone className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setActiveDevice("mobile-android")}
            className={`p-1.5 rounded-lg text-xs font-medium transition ${
              activeDevice === "mobile-android" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
            }`}
            title="أندرويد"
          >
            <Smartphone className="w-4 h-4 rotate-90" />
          </button>
          <button
            type="button"
            onClick={() => setActiveDevice("tablet-ipad")}
            className={`p-1.5 rounded-lg text-xs font-medium transition ${
              activeDevice === "tablet-ipad" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
            }`}
            title="جهاز لوحي"
          >
            <Tablet className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setActiveDevice("desktop")}
            className={`p-1.5 rounded-lg text-xs font-medium transition ${
              activeDevice === "desktop" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
            }`}
            title="كمبيوتر"
          >
            <Monitor className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShareModalOpen(true);
              if (!shareUrl) handleCreateShareLink();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
          >
            <Share2 className="w-3.5 h-3.5 text-amber-400" />
            <span>مشاركة المسودة</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={serverSavePending}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-xl transition disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{serverSavePending ? "جاري الحفظ..." : "نشر التعديلات"}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace: Split on Desktop, Tabbed/Drawer on Mobile */}
      <div className="flex-1 flex flex-col lg:flex-row relative overflow-hidden min-h-[580px]">
        {/* Editor Form Controls */}
        <div className="w-full lg:w-96 p-5 bg-slate-900/60 border-b lg:border-b-0 lg:border-l border-slate-800 space-y-4 overflow-y-auto max-h-[80vh]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              خصائص المتجر والواجهة
            </h2>
            <span className="text-[11px] text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20">
              تحديث حي 0ms
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">اسم المنشأة / المتجر</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: مطعم شواية الرياض"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-amber-500 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">السلوجان / العنوان الترويجي</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="مثال: أشهى المأكولات النجدية الأصيلة"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-amber-500 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">الوصف التعريفي</label>
            <textarea
              rows={3}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="وصف مختصر للخدمات وتفاصيل التوصيل والحجز..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-amber-500 transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">اللون الأساسي</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-300"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">اللون الثانوي</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-300"
                />
              </div>
            </div>
          </div>

          {serverSaveMessage ? (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                serverSaveMessage.includes("بنجاح")
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{serverSaveMessage}</span>
            </div>
          ) : null}
        </div>

        {/* Viewport Frame Container (Desktop View) */}
        <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-4 lg:p-8 relative overflow-hidden">
          {/* Simulated Device Body */}
          <div
            className={`transition-all duration-300 shadow-2xl relative flex flex-col overflow-hidden ${
              selectedDevice.isMobile
                ? "rounded-[44px] border-[10px] border-slate-800 bg-slate-900"
                : "rounded-2xl border-2 border-slate-800 bg-slate-900 w-full h-full max-w-5xl"
            }`}
            style={{
              width: selectedDevice.isMobile ? `${selectedDevice.width}px` : "100%",
              height: selectedDevice.isMobile ? `${selectedDevice.height * 0.78}px` : "100%",
              maxHeight: "750px",
            }}
          >
            {/* Simulated Speaker & Notch on Mobile */}
            {selectedDevice.isMobile ? (
              <div className="w-full h-6 bg-slate-900 flex items-center justify-center relative shrink-0">
                <div className="w-20 h-3.5 bg-black rounded-full" />
              </div>
            ) : null}

            {/* The Sandboxed Iframe with Safe Origin */}
            <iframe
              ref={iframeRef}
              src={previewSrc}
              onLoad={onIframeLoad}
              className="w-full flex-1 border-0 bg-white"
              title="معاينة المتجر الحية"
              sandbox="allow-scripts allow-forms allow-popups"
            />
          </div>
        </div>
      </div>

      {/* Abu Fahad Mobile Mode: Bottom Floating Action Button & Sheet */}
      {isMobileScreen ? (
        <>
          <div className="fixed bottom-4 left-4 right-4 z-40 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              <span>افتح المعاينة الفورية (شاشة كاملة)</span>
            </button>
          </div>

          {/* Bottom Sheet Drawer for Mobile */}
          {mobileDrawerOpen ? (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col justify-end lg:hidden">
              <div className="bg-slate-900 border-t border-slate-800 rounded-t-3xl h-[92vh] flex flex-col overflow-hidden shadow-2xl">
                {/* Drawer Header */}
                <div className="px-4 py-3 bg-slate-950 flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">معاينة الجوال التفاعلية</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>

                {/* Mobile Full Iframe */}
                <iframe
                  src={previewSrc}
                  className="w-full flex-1 border-0 bg-white"
                  title="معاينة المتجر للجوال"
                  sandbox="allow-scripts allow-forms allow-popups"
                />
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {/* Ephemeral Share Modal (Saudi PDPL Safe) */}
      {shareModalOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full text-right text-slate-100 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-amber-400" />
                مشاركة مسودة معاينة مؤقتة
              </h3>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              هذا الرابط مخصص للمعاينة الداخلية مع شركائك. الرابط مؤمن برمز سري (PIN)، وتنقضي صلاحيته تلقائياً بعد 24 ساعة، ولا تتم فهرسته في محركات البحث وفق نظام حماية البيانات الشخصية.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">رمز الدخول السري (PIN)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={sharePin}
                  onChange={(e) => setSharePin(e.target.value)}
                  className="w-28 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-center text-sm font-mono tracking-widest text-amber-400 outline-none"
                />
                <span className="text-[11px] text-slate-400">مطلوب من الشريك لفتح المسودة</span>
              </div>
            </div>

            {shareUrl ? (
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold text-slate-300">رابط المعاينة المباشر</label>
                <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 bg-transparent text-xs text-slate-300 font-mono outline-none"
                  />
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedLink ? "تم النسخ!" : "نسخ"}</span>
                  </button>
                </div>
              </div>
            ) : null}

            <div className="pt-2">
              <button
                type="button"
                onClick={handleCreateShareLink}
                disabled={shareLoading}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition"
              >
                {shareLoading ? "جاري إنشاء الرابط المشفر..." : "تحديث رابط المسودة"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
