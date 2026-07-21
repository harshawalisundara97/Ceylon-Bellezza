export interface SalonSummary {
  id: string;
  slug: string;
  name: string;
  category: string;
  city: string;
  template_settings: Record<string, unknown>;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  duration_minutes: number;
}

export interface Staff {
  id: string;
  name: string;
  photo_url: string | null;
  bio: string;
}

export interface GalleryItem {
  id: string;
  image_url: string;
  caption: string;
}

export interface SalonDetail {
  id: string;
  slug: string;
  name: string;
  category: string;
  city: string;
  address: string;
  template_settings: Record<string, unknown>;
  services: Service[];
  staff: Staff[];
  gallery: GalleryItem[];
  content: Record<string, string>;
}

export interface BookingCreatePayload {
  service_id: string;
  staff_id?: string | null;
  scheduled_at: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  gender: "male" | "female" | "other";
}

export interface Booking {
  id: string;
  salon_id: string;
  service_id: string;
  staff_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  gender: string;
  scheduled_at: string;
  status: string;
}
