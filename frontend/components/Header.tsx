import Link from "next/link";

const NAV_LINKS = [
  { href: "/", label: "Salons" },
  { href: "/", label: "Services" },
  { href: "/", label: "Offers" },
  { href: "/", label: "For business" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-bg px-11 py-5">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="font-serif text-[25px] font-bold text-ink">
          Ceylon<span className="text-champagne">.lk</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.label} href={link.href} className="text-[15px] text-taupe hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-6">
          <Link href="/join" className="hidden text-[15px] text-taupe hover:text-ink sm:inline">
            List your salon
          </Link>
          <Link
            href="/admin/login"
            className="rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90"
          >
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}
