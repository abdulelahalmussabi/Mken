import { NextResponse } from "next/server";
import { fetchPublicOrderTrack } from "@/lib/mken/orders";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = (url.searchParams.get("id") || url.searchParams.get("order") || "").trim();
  const phone = (url.searchParams.get("phone") || "").trim();

  if (!id || !phone) {
    return NextResponse.json({ success: false, error: "رقم الطلب والجوال مطلوبان" }, { status: 400 });
  }

  const { order, error, notFound } = await fetchPublicOrderTrack(id, phone);
  if (notFound) {
    return NextResponse.json({ success: false, error: error || "الطلب غير موجود" }, { status: 404 });
  }
  if (error || !order) {
    return NextResponse.json({ success: false, error: error || "تعذّر التتبع" }, { status: 500 });
  }

  return NextResponse.json({ success: true, order });
}
