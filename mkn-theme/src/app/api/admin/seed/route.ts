import { NextResponse } from "next/server";

function disabled() {
  return NextResponse.json(
    {
      success: false,
      message: "تم تعطيل نقطة التهيئة القديمة؛ تتم إدارة الحسابات وكلمات المرور عبر Supabase Auth فقط.",
    },
    { status: 410 }
  );
}

export async function GET() {
  return disabled();
}

export async function POST() {
  return disabled();
}
