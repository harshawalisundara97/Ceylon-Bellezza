"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getToken, clearToken } from "@/lib/adminAuth";

const NAV_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/gallery", label: "Gallery" },
  { href: "/admin/content", label: "Content" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") {
      setChecked(true);
      return;
    }
    if (!getToken()) {
      router.replace("/admin/login");
      return;
    }
    setChecked(true);
  }, [pathname, router]);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (!checked) {
    return null;
  }

  function handleLogout() {
    clearToken();
    router.push("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-ivory">
      <aside className="w-56 shrink-0 border-r border-hairline bg-white p-6">
        <p className="font-serif text-sm uppercase tracking-wide text-terracotta">Salon Admin</p>
        <nav className="mt-6 flex flex-col gap-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded px-3 py-2 text-sm ${
                pathname === link.href ? "bg-terracotta/10 text-terracotta" : "text-ink hover:bg-ivory"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <button onClick={handleLogout} className="mt-8 text-sm text-taupe hover:text-terracotta">
          Log Out
        </button>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
