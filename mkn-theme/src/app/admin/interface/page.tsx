"use client";

import { useAdmin } from "@/context/AdminContext";
import { useAdminTenant } from "@/components/AdminPageTabs";
import { LivePreviewEditor } from "@/components/preview/LivePreviewEditor";

export default function InterfaceTitlesPage() {
  const { tenant } = useAdminTenant();
  const { clients, updateClient } = useAdmin();
  const client = clients.find((c) => c.slug === tenant);

  const handleSaveToServer = async (data: {
    name: string;
    tagline: string;
    subtitle: string;
    accentColor: string;
    secondaryColor: string;
  }) => {
    if (!tenant) return { success: false, message: "لم يتم تحديد المنشأة" };
    return await updateClient(tenant, {
      name: data.name,
      tagline: data.tagline,
      subtitle: data.subtitle,
    });
  };

  return (
    <div className="space-y-4">
      <LivePreviewEditor
        tenantSlug={tenant || "demo"}
        initialName={client?.name || ""}
        initialTagline={client?.tagline || ""}
        initialSubtitle={client?.subtitle || ""}
        onSaveToServer={handleSaveToServer}
      />
    </div>
  );
}
