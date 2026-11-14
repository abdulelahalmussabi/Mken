import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import {
  cancelIgPost,
  fetchIgConnection,
  instagramGallery,
  listScheduledIgPosts,
  scheduleIgPost,
  uploadInstagramImage,
} from "@/lib/mken/instagram-publish";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const [connection, listed, gallery] = await Promise.all([
    fetchIgConnection(scope.slug),
    listScheduledIgPosts(scope.slug),
    instagramGallery(scope.slug),
  ]);
  if (listed.error) {
    return NextResponse.json({ success: false, message: listed.error }, { status: 500 });
  }
  return NextResponse.json({
    success: true,
    tenant: scope.slug,
    connection,
    posts: listed.posts || [],
    gallery,
  });
}

export async function POST(request: Request) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  let body: {
    action?: string;
    id?: string;
    caption?: string;
    imageUrls?: string[];
    imageDataUrl?: string;
    publishAt?: string;
    alsoFacebook?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "الطلب غير صالح" }, { status: 400 });
  }

  if (body.action === "upload") {
    const uploaded = await uploadInstagramImage(scope.slug, body.imageDataUrl || "");
    if (uploaded.error || !uploaded.url) {
      return NextResponse.json({ success: false, message: uploaded.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, url: uploaded.url });
  }

  if (body.action === "cancel") {
    const result = await cancelIgPost(scope.slug, body.id || "");
    if (result.error || !result.post) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, post: result.post });
  }

  if (body.action === "refresh") {
    const connection = await fetchIgConnection(scope.slug);
    return NextResponse.json({ success: true, connection });
  }

  if (body.action === "schedule") {
    const result = await scheduleIgPost({
      slug: scope.slug,
      caption: body.caption || "",
      imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls : [],
      publishAt: body.publishAt || new Date().toISOString(),
      alsoFacebook: body.alsoFacebook !== false,
    });
    if (result.error && !result.post) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      post: result.post,
      publishedNow: result.publishedNow,
      message: result.error,
    });
  }

  return NextResponse.json({ success: false, message: "إجراء غير معروف" }, { status: 400 });
}
