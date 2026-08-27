export type BlockType =
  | "hero"
  | "services"
  | "features"
  | "pricing"
  | "testimonials"
  | "faq"
  | "contact"
  | "cta"
  | "content";

export interface BaseBlock {
  id?: string;
  type: BlockType;
  visible?: boolean;
}

export interface HeroBlock extends BaseBlock {
  type: "hero";
  title: string;
  subtitle?: string;
  badge?: string;
  ctaText?: string;
  ctaLink?: string;
  imageUrl?: string;
}

export interface ServicesBlock extends BaseBlock {
  type: "services";
  title: string;
  subtitle?: string;
  items?: Array<{
    id: string;
    name: string;
    price: string;
    description: string;
    icon?: string;
  }>;
}

export interface PricingBlock extends BaseBlock {
  type: "pricing";
  title: string;
  subtitle?: string;
  plans?: Array<{
    name: string;
    price: string;
    period?: string;
    features: string[];
    isPopular?: boolean;
    buttonText?: string;
  }>;
}

export interface ContentBlock extends BaseBlock {
  type: "content";
  title: string;
  body: string;
}

export interface ContactBlock extends BaseBlock {
  type: "contact";
  title: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  location?: string;
}

export type PageBlock = HeroBlock | ServicesBlock | PricingBlock | ContentBlock | ContactBlock | BaseBlock;

export interface TenantPage {
  id?: string;
  tenantSlug: string;
  title: string;
  slug: string;
  blocks: PageBlock[];
  isHome: boolean;
  isPublished: boolean;
  seoMetadata?: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
  };
  orderIndex?: number;
  createdAt?: string;
  updatedAt?: string;
}
