import SubscriberStorefrontPage from "../subscriber/[slug]/page";

export default function AlmasabiPage() {
  return <SubscriberStorefrontPage params={Promise.resolve({ slug: "almasabi" })} />;
}
