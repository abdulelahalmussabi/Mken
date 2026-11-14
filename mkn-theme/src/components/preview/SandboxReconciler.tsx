"use client";

import React, { useEffect, useState } from "react";
import {
  PREVIEW_PROTOCOL_VERSION,
  type PreviewIncomingMessage,
  type PreviewOutgoingMessage,
  type JsonPatchOperation,
} from "@/lib/preview/protocol";
import {
  SAUDI_COMPLIANCE_WATERMARK,
  SAUDI_SYNTHETIC_BUSINESS,
  SAMA_SANDBOX_CARDS,
  generateZatcaMockQrTlv,
} from "@/lib/preview/saudi-synthetic-data";
import { ShieldCheck, CreditCard, QrCode, X, AlertTriangle } from "lucide-react";

export interface SandboxReconcilerProps {
  onStateUpdate?: (patches: JsonPatchOperation[]) => void;
  onFullStateReplace?: (state: Record<string, any>) => void;
}

export function SandboxReconciler({
  onStateUpdate,
  onFullStateReplace,
}: SandboxReconcilerProps) {
  const [port, setPort] = useState<MessagePort | null>(null);
  const [activeTokens, setActiveTokens] = useState<Record<string, string>>({});
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [mockQrBase64, setMockQrBase64] = useState<string>("");

  useEffect(() => {
    // Generate initial test ZATCA QR
    setMockQrBase64(generateZatcaMockQrTlv({}));

    // Step 1: Handshake with parent
    const handleWindowMessage = (event: MessageEvent) => {
      const data = event.data as PreviewOutgoingMessage;
      if (data?.type === "ESTABLISH_CHANNEL" && event.ports && event.ports[0]) {
        const incomingPort = event.ports[0];
        setPort(incomingPort);

        incomingPort.onmessage = (portEvent: MessageEvent) => {
          const msg = portEvent.data as PreviewOutgoingMessage;
          handleIncomingPortMessage(msg);
        };

        window.removeEventListener("message", handleWindowMessage);
      }
    };

    window.addEventListener("message", handleWindowMessage);

    // Notify parent that sandbox is ready
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: "SANDBOX_READY",
          version: PREVIEW_PROTOCOL_VERSION,
          timestamp: Date.now(),
        } as PreviewIncomingMessage,
        "*"
      );
    }

    return () => {
      window.removeEventListener("message", handleWindowMessage);
    };
  }, []);

  const handleIncomingPortMessage = (msg: PreviewOutgoingMessage) => {
    if (!msg || typeof msg !== "object") return;

    switch (msg.type) {
      case "PING": {
        if (port) {
          port.postMessage({ type: "PONG", timestamp: Date.now() });
        }
        break;
      }
      case "APPLY_STYLE_TOKEN": {
        applyCssTokens(msg.tokens);
        break;
      }
      case "APPLY_DOM_PATCH": {
        if (onStateUpdate && msg.patches) {
          onStateUpdate(msg.patches);
        }
        break;
      }
      case "REPLACE_FULL_STATE": {
        if (onFullStateReplace && msg.state) {
          onFullStateReplace(msg.state);
        }
        break;
      }
      case "RESET_STATE": {
        // Clean up injected tokens
        const styleEl = document.getElementById("mken-live-preview-tokens");
        if (styleEl) styleEl.remove();
        setActiveTokens({});
        break;
      }
    }
  };

  const applyCssTokens = (tokens: Record<string, string>) => {
    setActiveTokens((prev) => ({ ...prev, ...tokens }));
    let styleEl = document.getElementById("mken-live-preview-tokens") as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "mken-live-preview-tokens";
      document.head.appendChild(styleEl);
    }

    const cssRules = Object.entries({ ...activeTokens, ...tokens })
      .map(([k, v]) => `  ${k}: ${v} !important;`)
      .join("\n");

    styleEl.innerHTML = `:root, body {\n${cssRules}\n}`;
  };

  return (
    <>
      {/* Saudi Ministry of Commerce & PDPL Mandatory Watermark Bar */}
      <aside
        role="region"
        aria-label="إشعار المعاينة التجريبية"
        className="fixed top-0 inset-x-0 z-[99999] bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 font-bold px-3 py-1.5 text-xs shadow-md border-b border-amber-400 flex items-center justify-between select-none"
      >
        <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
          <ShieldCheck className="w-4 h-4 shrink-0 text-slate-900" />
          <span className="truncate">{SAUDI_COMPLIANCE_WATERMARK}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowComplianceModal(true)}
            className="px-2 py-0.5 rounded bg-slate-950/20 hover:bg-slate-950/30 text-[11px] text-slate-950 font-bold transition"
          >
            فحص الامتثال
          </button>
          <span className="hidden sm:inline-block text-[10px] bg-slate-900 text-amber-300 px-1.5 py-0.5 rounded">
            PDPL & ZATCA Safe
          </span>
        </div>
      </aside>

      {/* Spacing compensation for the fixed watermark */}
      <div className="h-7 w-full" aria-hidden="true" />

      {/* Saudi Compliance & SAMA Sandbox Modal */}
      {showComplianceModal ? (
        <div className="fixed inset-0 z-[100000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full text-right text-slate-100 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowComplianceModal(false)}
              className="absolute top-4 left-4 p-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-amber-400">
              <ShieldCheck className="w-5 h-5" />
              <h3 className="font-extrabold text-base">بيئة الامتثال والأنظمة السعودية (Sandbox)</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              هذه المعاينة تعمل وفق ضوابط الهيئة الوطنية للأمن السيبراني (NCA) ونظام حماية البيانات الشخصية (PDPL). لا تحتوي الصفحة على أي سجلات عملاء حقيقية، وجميع الحركات البنكية معزولة.
            </p>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">السجل التجاري النموذجي:</span>
                <span className="font-mono text-amber-300">{SAUDI_SYNTHETIC_BUSINESS.crNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">الرقم الضريبي النموذجي:</span>
                <span className="font-mono text-amber-300">{SAUDI_SYNTHETIC_BUSINESS.vatNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">العنوان الوطني المعتمد:</span>
                <span className="text-slate-200">الرياض - حي الملقا</span>
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                بطاقات الاختبار المعتمدة لبوابة SAMA التجريبية:
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {SAMA_SANDBOX_CARDS.map((card) => (
                  <div key={card.brand} className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
                    <p className="font-bold uppercase text-amber-400">{card.brand}</p>
                    <p className="font-mono text-[11px] text-slate-200">{card.cardNumber}</p>
                    <p className="text-[10px] text-slate-400">CVV: {card.cvv} | Exp: {card.expiryMonth}/{card.expiryYear}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>يتم حجب أي محاولة لإرسال بطاقات حقيقية تلقائياً.</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
