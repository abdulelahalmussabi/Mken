import SubscriberStorefrontPage from "../subscriber/[slug]/page";

export default function RewaResortPage() {
  return <SubscriberStorefrontPage params={Promise.resolve({ slug: "rewa" })} />;
}

