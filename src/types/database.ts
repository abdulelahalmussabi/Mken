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
  adminPassword: string;
  theme: string; // OccasionId
  couponCode?: string;
  discountText?: string;
  discountEnabled?: boolean;
  active: boolean;
  createdAt: string;
}
