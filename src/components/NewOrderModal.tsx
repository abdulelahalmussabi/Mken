"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useApp } from "@/context/AppContext";
import { X, MapPin, Store, FileText, Send, AlertCircle, Loader2 } from "lucide-react";

const googleMapsUrlRegex = /^(https?:\/\/)?(www\.)?(google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.com)\/.+$/i;

const orderSchema = z.object({
  store_name: z.string().min(3, { message: "يرجى إدخال اسم المحل التجاري (3 حروف على الأقل)" }),
  maps_url: z
    .string()
    .min(5, { message: "يرجى إدخال رابط خرائط Google المحل" })
    .refine(
      (val) => {
        return (
          val.includes("maps") ||
          val.includes("google") ||
          val.includes("goo.gl") ||
          googleMapsUrlRegex.test(val)
        );
      },
      { message: "يرجى إدخال رابط URL صحيح يتبعه خرائط Google (مثال: https://maps.app.goo.gl/...)" }
    ),
  notes: z.string().optional(),
});

type OrderFormValues = z.infer<typeof orderSchema>;

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewOrderModal({ isOpen, onClose }: NewOrderModalProps) {
  const { addOrder } = useApp();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
  });

  if (!isOpen) return null;

  const onSubmit = async (data: OrderFormValues) => {
    setSubmitting(true);
    try {
      await addOrder(data.store_name, data.maps_url, data.notes);
      reset();
      onClose();
    } catch {
      // Handled in context
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          disabled={submitting}
          className="absolute top-6 left-6 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-orange-400 bg-orange-950/40 px-3 py-1 rounded-full border border-orange-800/40">
            <Store className="w-3.5 h-3.5" />
            طلب تحسين جديد
          </div>
          <h3 className="text-2xl font-extrabold text-slate-100">تقديم طلب تحسين محل تجاري</h3>
          <p className="text-slate-400 text-sm">
            أدخل بيانات المحل ورابط الخريطة للبدء في رفع ترتيب محلك على خرائط قوقل.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Store Name */}
          <div>
            <label htmlFor="store_name" className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Store className="w-4 h-4 text-orange-400" />
              اسم المحل أو النشاط التجاري <span className="text-orange-500">*</span>
            </label>
            <input
              id="store_name"
              type="text"
              placeholder="مثال: مطعم ومحمصة الجود - حي الملك فهد، الرياض"
              {...register("store_name")}
              disabled={submitting}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm"
            />
            {errors.store_name && (
              <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.store_name.message}
              </p>
            )}
          </div>

          {/* Maps URL */}
          <div>
            <label htmlFor="maps_url" className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-orange-400" />
              رابط خرائط Google المحل <span className="text-orange-500">*</span>
            </label>
            <input
              id="maps_url"
              type="text"
              dir="ltr"
              placeholder="https://maps.app.goo.gl/..."
              {...register("maps_url")}
              disabled={submitting}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm text-left dir-ltr"
            />
            {errors.maps_url && (
              <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium dir-rtl">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errors.maps_url.message}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-orange-400" />
              ملاحظات أو الكلمات المفتاحية المستهدفة (اختياري)
            </label>
            <textarea
              id="notes"
              rows={3}
              placeholder="اكتب أي ملاحظات إضافية، الكلمات المفتاحية الرئيسية التي ترغب في التصدر بها..."
              {...register("notes")}
              disabled={submitting}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-xl cursor-pointer disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/20 disabled:opacity-50 cursor-pointer transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري إرسال الطلب...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  إرسال الطلب الآن
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
