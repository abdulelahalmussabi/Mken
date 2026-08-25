import { NextRequest, NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import { getApiKeys, createApiKey, deleteApiKey } from "@/lib/mken/api-keys";

export async function GET(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const result = await getApiKeys(scope.tenantSlug);

    // Ensure api_key is masked in list responses
    const safeKeys = result.keys.map((k) => ({
      id: k.id,
      tenant_slug: k.tenant_slug,
      key_name: k.key_name,
      masked_key: k.masked_key,
      created_at: k.created_at,
      expires_at: k.expires_at,
    }));

    return NextResponse.json({
      success: true,
      tenant_slug: scope.tenantSlug,
      keys: safeKeys,
      tableMissing: result.tableMissing,
      error: result.error,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch API keys";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const body = await req.json();

    if (!body.key_name || !body.key_name.trim()) {
      return NextResponse.json(
        { success: false, error: "اسم مفتاح API مطلوب (key_name)" },
        { status: 400 }
      );
    }

    const res = await createApiKey(
      scope.tenantSlug,
      body.key_name.trim(),
      body.expires_at || null
    );

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        key: res.keyRecord,
        raw_key: res.rawKey, // Returned only ONCE upon creation
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create API key";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "معرّف المفتاح (id) مطلوب للحذف" },
        { status: 400 }
      );
    }

    const res = await deleteApiKey(scope.tenantSlug, id);

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete API key";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
