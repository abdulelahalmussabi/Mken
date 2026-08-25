"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(3, { message: "الاسم يجب أن يتكون من 3 حروف على الأقل" }),
  email: z.string().email({ message: "يرجى إدخال بريد إلكتروني صحيح" }),
});

type FormValues = z.infer<typeof formSchema>;

export default function DemoForm() {
  const [submittedData, setSubmittedData] = useState<FormValues | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: FormValues) => {
    // محاكاة عملية معالجة النموذج
    await new Promise((resolve) => setTimeout(resolve, 600));
    setSubmittedData(data);
    reset();
  };

  return (
    <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-indigo-400" />
        <h2 className="text-lg font-bold text-slate-100">تجربة التحقق باستخدام Zod & React Hook Form</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">
            الاسم الكامل
          </label>
          <input
            id="name"
            type="text"
            placeholder="أدخل اسمك هنا"
            {...register("name")}
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
          {errors.name && (
            <p className="flex items-center gap-1 text-xs text-rose-400 mt-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.name.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
            البريد الإلكتروني
          </label>
          <input
            id="email"
            type="email"
            placeholder="example@domain.com"
            {...register("email")}
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
          {errors.email && (
            <p className="flex items-center gap-1 text-xs text-rose-400 mt-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.email.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg transition-all disabled:opacity-50 cursor-pointer"
        >
          <Send className="w-4 h-4" />
          {isSubmitting ? "جاري الإرسال..." : "اختبار التحقق"}
        </button>
      </form>

      {submittedData && (
        <div className="mt-4 p-3 bg-emerald-950/50 border border-emerald-800/50 rounded-xl text-emerald-300 text-xs flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">تم التحقق من النموذج بنجاح!</p>
            <p className="mt-0.5 text-emerald-400">الاسم: {submittedData.name} | البريد: {submittedData.email}</p>
          </div>
        </div>
      )}
    </div>
  );
}
