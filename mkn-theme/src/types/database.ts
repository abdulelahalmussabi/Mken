export type OrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface Profile {
  id: string;
  full_name: string;
  phone?: string;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  store_name: string;
  maps_url: string;
  notes?: string;
  status: OrderStatus;
  created_at: string;
  user_name?: string;
}

export interface Message {
  id: string;
  order_id: string;
  sender_id: string;
  sender_name?: string;
  content: string;
  created_at: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  created_at: string;
}

export interface ServiceItem {
  id: string;
  title: string;
  shortDesc: string;
  fullDesc: string;
  features: string[];
  iconName: 'MapPin' | 'Search' | 'Star' | 'BarChart3' | 'TrendingUp';
  badge?: string;
}

// Admin Types
export type ClientType = 'hotel' | 'salon' | 'restaurant' | 'cafe' | 'other';

export interface SocialLinks {
  instagram?: string;
  snapchat?: string;
  tiktok?: string;
  x?: string;
  twitter?: string;
  whatsapp?: string;
  facebook?: string;
  youtube?: string;
  telegram?: string;
  linkedin?: string;
  pinterest?: string;
  website?: string;
  phone?: string;
  map?: string;
}

export interface ClientRecord {
  slug: string;
  name: string;
  tagline: string;
  subtitle: string;
  type: ClientType;
  phone: string;
  whatsapp: string;
  email?: string;
  location: string;
  rating: string;
  reviewsCount: string;
  heroImage: string;
  demoNotice: string;
  adminEmail: string;
  /** Write-only: accepted when creating a client, never returned by the API. */
  adminPassword?: string;
  theme: string; // OccasionId
  couponCode?: string;
  discountText?: string;
  discountEnabled?: boolean;
  socialLinks?: SocialLinks;
  active: boolean;
  createdAt: string;
}

/** Fields a public storefront may expose. No admin emails or credentials. */
export type StorefrontClient = Pick<
  ClientRecord,
  | "slug"
  | "name"
  | "tagline"
  | "subtitle"
  | "type"
  | "phone"
  | "whatsapp"
  | "location"
  | "rating"
  | "reviewsCount"
  | "heroImage"
  | "demoNotice"
  | "theme"
  | "couponCode"
  | "discountText"
  | "discountEnabled"
>;

export type StorefrontKind = "hotel" | "salon" | "commerce" | "generic";

export interface StorefrontCatalogService {
  id: string;
  activityId: string;
  name: string;
  badge: string;
  price: string;
  features: string[];
  description: string;
  image: string;
  popular?: boolean;
  duration: string;
}

export interface StorefrontCatalogActivity {
  id: string;
  title: string;
  shortTitle: string;
  icon: string;
  tagline: string;
}

export interface StorefrontCatalog {
  kind: StorefrontKind;
  featuredActivity: string;
  activities: StorefrontCatalogActivity[];
  services: StorefrontCatalogService[];
}
