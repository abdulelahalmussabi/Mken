import Script from "next/script";
import { tenantPixelId } from "@/lib/mken/meta-ads";

export async function TenantMetaPixel({ slug }: { slug?: string | null }) {
  if (!slug) return null;
  const id = await tenantPixelId(slug);
  if (id.length < 5) return null;
  return (
    <Script id={`mken-pixel-${id}`} strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`}
    </Script>
  );
}
