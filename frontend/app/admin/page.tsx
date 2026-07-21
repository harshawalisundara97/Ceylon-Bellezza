import Link from "next/link";
import Card from "@/components/ui/Card";
import PageHeading from "@/components/ui/PageHeading";

const SECTIONS = [
  { href: "/admin/services", label: "Services", description: "Manage the services your salon offers." },
  { href: "/admin/staff", label: "Staff", description: "Manage your team's profiles." },
  { href: "/admin/gallery", label: "Gallery", description: "Manage photos shown on your public page." },
  { href: "/admin/content", label: "Content", description: "Edit your About Us and Contact info." },
];

export default function AdminHomePage() {
  return (
    <div>
      <PageHeading>Welcome back</PageHeading>
      <p className="mt-1 text-taupe">Manage your salon&apos;s public listing from here.</p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <Card as={Link} key={section.href} href={section.href} className="block hover:border-terracotta">
            <p className="font-medium text-ink">{section.label}</p>
            <p className="mt-1 text-sm text-taupe">{section.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
