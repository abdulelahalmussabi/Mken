import { NextResponse } from "next/server";
import { createClientServer } from "@/lib/supabase/server";
import { DEFAULT_CLIENTS } from "@/context/AdminContext";
import type { ClientRecord } from "@/types/database";

export async function GET() {
  try {
    const supabase = await createClientServer();
    const { data: dbClients, error } = await supabase.from("clients").select("*");

    if (error || !dbClients || dbClients.length === 0) {
      // Fallback to default clients
      return NextResponse.json({ success: true, clients: DEFAULT_CLIENTS, source: "default" });
    }

    return NextResponse.json({ success: true, clients: dbClients, source: "database" });
  } catch (err) {
    return NextResponse.json(
      { success: true, clients: DEFAULT_CLIENTS, source: "fallback", error: String(err) },
      { status: 200 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: ClientRecord = await request.json();
    if (!body.slug || !body.name) {
      return NextResponse.json({ success: false, message: "بيانات ناقصة" }, { status: 400 });
    }

    const supabase = await createClientServer();
    const { data, error } = await supabase.from("clients").upsert([body]).select();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, client: data[0] });
  } catch (err) {
    return NextResponse.json({ success: false, message: "فشل حفظ البيانات" }, { status: 500 });
  }
}
