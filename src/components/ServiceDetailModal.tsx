"use client";

import React from "react";
import { ServiceItem } from "@/types/database";
import { X, CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface ServiceDetailModalProps {
  service: ServiceItem | null;
  onClose: () => void;
}

export default function ServiceDetailModal({ service, onClose }: ServiceDetailModalProps) {
  if (!service) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-6 left-6 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-2">
          {service.badge && (
            <span className="px-3 py-1 bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold rounded-full">
              {service.badge}
            </span>
          )}
          <h3 className="text-2xl font-extrabold text-slate-100">{service.title}</h3>
          <p className="text-slate-400 text-sm">{service.shortDesc}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-slate-300 text-sm leading-relaxed">
          {service.fullDesc}
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">ما الذي تتضمنه هذه الخدمة؟</h4>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {service.features.map((feat, idx) => (
              <li key={idx} className="flex items-center gap-2 text-xs text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="pt-4 border-t border-slate-800 flex items-center gap-3">
          <Link
            href="/auth"
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/20"
          >
            <span>اطلب هذه الخدمة الآن</span>
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <button
            onClick={onClose}
            className="px-5 py-3 bg-slate-800 text-slate-300 hover:text-white font-semibold text-sm rounded-xl cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
