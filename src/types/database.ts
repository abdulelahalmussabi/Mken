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
  iconName: 'MapPin' | 'Search' | 'Star' | 'BarChart3' | 'TrendingUp' | 'FileCheck2' | 'MessagesSquare';
  badge?: string;
}

// ─── Social Media Links ───────────────────────────────────────────────────────
export interface SocialLinks {
  twitter?: string;
  instagram?: string;
  tiktok?: string;
  snapchat?: string;
  linkedin?: string;
  whatsapp?: string;
  youtube?: string;
  facebook?: string;
  telegram?: string;
}

// ─── Admin & Client Types ─────────────────────────────────────────────────────
export type ClientType = 'hotel' | 'salon' | 'clinic' | 'gym' | 'restaurant' | 'cafe' | 'other';

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
  logoUrl?: string;
  demoNotice: string;
  adminEmail: string;
  adminPassword: string;
  theme: string; // OccasionId
  couponCode?: string;
  discountText?: string;
  discountEnabled?: boolean;
  socialLinks?: SocialLinks;
  autoThemeSwitch?: boolean;
  active: boolean;
  createdAt: string;
}

// ─── Clinics Management Types ────────────────────────────────────────────────
export interface ClinicRecord {
  id: string;
  tenantSlug: string;
  name: string;
  specialty: string;
  branch: string;
  capacityPerDay: number;
  workingDays: string;
  morningShift: string;
  eveningShift: string;
  assignedStaffIds: string[];
  active: boolean;
  createdAt: string;
}

// ─── Staff Management Types ──────────────────────────────────────────────────
export type StaffRole = 'admin' | 'manager' | 'doctor' | 'trainer' | 'receptionist' | 'accountant';

export interface StaffRecord {
  id: string;
  tenantSlug: string;
  name: string;
  role: StaffRole;
  roleTitle: string;
  specialty?: string;
  email: string;
  phone: string;
  assignedClinicId?: string;
  permissions: string[];
  active: boolean;
  createdAt: string;
}

export interface StaffBookingRecord {
  id: string;
  tenantSlug: string;
  staffId: string;
  staffName: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
}

// ─── Subscriptions Management Types ──────────────────────────────────────────
export type SubscriptionCategory = 'gym' | 'meals' | 'sessions' | 'exhibitions';

export interface SubscriptionPackageRecord {
  id: string;
  tenantSlug: string;
  category: SubscriptionCategory;
  categoryTitle: string;
  title: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  trainerName?: string;
  mealsPerDay?: number;
  badge?: string;
  popular?: boolean;
  active: boolean;
}

export interface SubscriberMemberRecord {
  id: string;
  tenantSlug: string;
  customerName: string;
  customerPhone: string;
  packageId: string;
  packageName: string;
  category: SubscriptionCategory;
  startDate: string;
  endDate: string;
  status: 'active' | 'expiring_soon' | 'expired';
  paidAmount: string;
}

// ─── Advertisements & Visitor Content Types ──────────────────────────────────
export interface AdBannerRecord {
  id: string;
  tenantSlug: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  linkUrl?: string;
  type: 'hero_banner' | 'popup' | 'announcement';
  active: boolean;
  startDate?: string;
  endDate?: string;
}
