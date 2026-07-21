"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginSalonAdmin, AdminApiError } from "@/lib/adminApi";
import { saveToken } from "@/lib/adminAuth";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import PageHeading from "@/components/ui/PageHeading";

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
      <Card as="form" className="w-full max-w-sm p-8" onSubmit={handleSubmit}>
        <PageHeading className="text-xl">Salon Admin Login</PageHeading>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <label className="mt-6 block text-sm text-taupe">
          Email
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full"
          />
        </label>
        <label className="mt-4 block text-sm text-taupe">
          Password
          <Input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full"
          />
        </label>
        <Button type="submit" disabled={submitting} className="mt-6 w-full">
          {submitting ? "Logging in..." : "Log In"}
        </Button>
      </Card>
    </main>
  );
}
