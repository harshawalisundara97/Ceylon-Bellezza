import { SalonDetail, SalonSummary } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function getSalons(): Promise<SalonSummary[]> {
  const response = await fetch(`${API_URL}/salons`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch salons: ${response.status}`);
  }
  return response.json();
}

export async function getSalonBySlug(slug: string): Promise<SalonDetail | null> {
  const response = await fetch(`${API_URL}/salons/${slug}`, { cache: "no-store" });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch salon ${slug}: ${response.status}`);
  }
  return response.json();
}
