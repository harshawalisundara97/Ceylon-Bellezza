import { getToken, clearToken } from "./adminAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class AdminApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/admin/login";
    }
    throw new AdminApiError(401, "Not authenticated");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    let message: string;
    if (Array.isArray(body.detail)) {
      message = body.detail.map((entry: any) => (entry && entry.msg) ? entry.msg : String(entry)).join("; ");
    } else if (typeof body.detail === "string") {
      message = body.detail;
    } else {
      message = "Request failed";
    }
    throw new AdminApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function loginSalonAdmin(email: string, password: string): Promise<string> {
  const response = await fetch(`${API_URL}/auth/salon-admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new AdminApiError(response.status, "Invalid email or password");
  }
  const data = await response.json();
  return data.access_token;
}
