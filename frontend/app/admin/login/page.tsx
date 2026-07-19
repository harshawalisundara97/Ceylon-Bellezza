"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginSalonAdmin, AdminApiError } from "@/lib/adminApi";
import { saveToken } from "@/lib/adminAuth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const token = await loginSalonAdmin(email, password);
      saveToken(token);
      router.push("/admin");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Something went wrong — try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ivory px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-hairline bg-white p-8">
        <h1 className="text-xl font-semibold text-ink">Salon Admin Login</h1>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <label className="mt-6 block text-sm text-taupe">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-hairline px-3 py-2 text-ink focus:border-terracotta focus:outline-none"
          />
        </label>
        <label className="mt-4 block text-sm text-taupe">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-hairline px-3 py-2 text-ink focus:border-terracotta focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded bg-terracotta py-2 text-white disabled:opacity-50"
        >
          {submitting ? "Logging in..." : "Log In"}
        </button>
      </form>
    </main>
  );
}
