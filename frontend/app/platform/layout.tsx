"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getToken, clearToken } from "@/lib/platformAuth";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (pathname === "/platform/login") {
      setChecked(true);
      return;
    }
    if (!getToken()) {
      router.replace("/platform/login");
      return;
    }
    setChecked(true);
  }, [pathname, router]);

  if (pathname === "/platform/login") {
    return <>{children}</>;
  }

  if (!checked) {
    return null;
  }

  function handleLogout() {
    clearToken();
    router.push("/platform/login");
  }

  return (
    <div className="min-h-screen bg-ivory">
      <header className="flex items-center justify-between border-b border-hairline bg-white px-8 py-4">
        <p className="font-serif text-sm uppercase tracking-wide text-terracotta">Ceylon Bellezza — Platform Admin</p>
        <nav className="flex items-center gap-4">
          <Link href="/platform" className={`text-sm ${pathname === "/platform" ? "text-terracotta" : "text-ink hover:text-terracotta"}`}>
            Salons
          </Link>
          <Link href="/platform/leads" className={`text-sm ${pathname === "/platform/leads" ? "text-terracotta" : "text-ink hover:text-terracotta"}`}>
            Leads
          </Link>
          <button onClick={handleLogout} className="text-sm text-taupe hover:text-terracotta">
            Log Out
          </button>
        </nav>
      </header>
      <main className="p-8">{children}</main>
    </div>
  );
}
