"use client";

import React, { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useApp } from "@/context/AppContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  User,
  Phone,
  Lock,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

// Profile Schema
const profileSchema = z.object({
  full_name: z.string().min(3, { message: "الاسم الكامل يجب أن يتكون من 3 حروف على الأقل" }),
  phone: z.string().min(9, { message: "يرجى إدخال رقم جوال صحيح (مثال: 0551234567)" }),
});

// Password Schema
const passwordSchema = z
  .object({
    current_password: z.string().min(6, { message: "كلمة المرور الحالية تتكون من 6 خانات على الأقل" }),
    new_password: z.string().min(6, { message: "كلمة المرور الجديدة يجب أن تكون 6 خانات على الأقل" }),
    confirm_password: z.string().min(6, { message: "تأكيد كلمة المرور مطلوب" }),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "كلمة المرور الجديدة وتأكيدها غير متطابقين",
    path: ["confirm_password"],
  });

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { user, setUser, showToast } = useApp();
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors, isSubmitting: isSubmittingProfile },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name || "",
      phone: user?.phone || "",
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPassword,
    formState: { errors: passwordErrors, isSubmitting: isSubmittingPassword },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  });

  if (!user) return null;

  const onUpdateProfile = async (data: ProfileFormValues) => {
    setProfileSuccess(null);
    await new Promise((r) => setTimeout(r, 600));

    setUser({
      ...user,
      full_name: data.full_name,
      phone: data.phone,
    });

    setProfileSuccess("تم تحديث البيانات الشخصية بنجاح!");
    showToast("تم تحديث ملفك الشخصي بنجاح.", "success");
  };

  const onChangePassword = async (_data: PasswordFormValues) => {
    setPasswordSuccess(null);
    await new Promise((r) => setTimeout(r, 800));

    resetPassword();
    setPasswordSuccess("تم تغيير كلمة المرور بنجاح!");
    showToast("تم تغيير كلمة المرور بنجاح.", "success");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-orange-400 bg-orange-950/40 px-3 py-1 rounded-full border border-orange-800/40">
            <User className="w-3.5 h-3.5" />
            إعدادات الملف الشخصي
          </div>
          <h1 className="text-2xl font-extrabold text-white">إدارة الحساب والأمان</h1>
          <p className="text-slate-400 text-xs">
            تحديث بياناتك الشخصية وتغيير كلمة المرور الخاصة بحسابك في منصة مكّن.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PROFILE EDIT FORM */}
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
              <User className="w-5 h-5 text-orange-400" />
              <h2 className="font-extrabold text-slate-100 text-base">البيانات الشخصية</h2>
            </div>

            {profileSuccess && (
              <div className="p-3.5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSubmitProfile(onUpdateProfile)} className="space-y-4">
              <div>
                <label htmlFor="full_name" className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-orange-400" />
                  الاسم الكامل
                </label>
                <input
                  id="full_name"
                  type="text"
                  {...registerProfile("full_name")}
                  disabled={isSubmittingProfile}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                {profileErrors.full_name && (
                  <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {profileErrors.full_name.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="phone" className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-orange-400" />
                  رقم الجوال
                </label>
                <input
                  id="phone"
                  type="text"
                  dir="ltr"
                  {...registerProfile("phone")}
                  disabled={isSubmittingProfile}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm dir-ltr text-right focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                {profileErrors.phone && (
                  <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {profileErrors.phone.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmittingProfile}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-500/20 disabled:opacity-50 cursor-pointer transition-all"
              >
                {isSubmittingProfile ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    حفظ التغييرات
                  </>
                )}
              </button>
            </form>
          </div>

          {/* CHANGE PASSWORD FORM */}
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
              <KeyRound className="w-5 h-5 text-orange-400" />
              <h2 className="font-extrabold text-slate-100 text-base">تغيير كلمة المرور</h2>
            </div>

            {passwordSuccess && (
              <div className="p-3.5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSubmitPassword(onChangePassword)} className="space-y-4">
              <div>
                <label htmlFor="current_password" className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-orange-400" />
                  كلمة المرور الحالية
                </label>
                <input
                  id="current_password"
                  type="password"
                  placeholder="••••••••"
                  {...registerPassword("current_password")}
                  disabled={isSubmittingPassword}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dir-ltr text-right"
                />
                {passwordErrors.current_password && (
                  <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {passwordErrors.current_password.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="new_password" className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-orange-400" />
                  كلمة المرور الجديدة
                </label>
                <input
                  id="new_password"
                  type="password"
                  placeholder="••••••••"
                  {...registerPassword("new_password")}
                  disabled={isSubmittingPassword}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dir-ltr text-right"
                />
                {passwordErrors.new_password && (
                  <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {passwordErrors.new_password.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="confirm_password" className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-orange-400" />
                  تأكيد كلمة المرور الجديدة
                </label>
                <input
                  id="confirm_password"
                  type="password"
                  placeholder="••••••••"
                  {...registerPassword("confirm_password")}
                  disabled={isSubmittingPassword}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dir-ltr text-right"
                />
                {passwordErrors.confirm_password && (
                  <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {passwordErrors.confirm_password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmittingPassword}
                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl disabled:opacity-50 cursor-pointer transition-all border border-slate-700"
              >
                {isSubmittingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري التحديث...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    تحديث كلمة المرور
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
