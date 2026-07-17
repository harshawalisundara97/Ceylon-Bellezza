import Link from "next/link";

const SECTIONS = [
  { href: "/admin/services", label: "Services", description: "Manage the services your salon offers." },
  { href: "/admin/staff", label: "Staff", description: "Manage your team's profiles." },
  { href: "/admin/gallery", label: "Gallery", description: "Manage photos shown on your public page." },
  { href: "/admin/content", label: "Content", description: "Edit your About Us and Contact info." },
];

export default function AdminHomePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Welcome back</h1>
      <p className="mt-1 text-taupe">Manage your salon's public listing from here.</p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-lg border border-hairline bg-white p-5 hover:border-terracotta"
          >
            <p className="font-semibold text-ink">{section.label}</p>
            <p className="mt-1 text-sm text-taupe">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
