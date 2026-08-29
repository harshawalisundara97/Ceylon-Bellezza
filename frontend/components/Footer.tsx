import Link from "next/link";

const FOOTER_COLUMNS = [
  { heading: "Discover", links: ["Browse salons", "Popular services", "Gift cards"] },
  { heading: "For salons", links: ["List your salon", "Owner login", "Pricing"] },
  { heading: "Company", links: ["About us", "Careers", "Contact"] },
];

export default function Footer() {
  return (
    <footer className="bg-charcoal px-11 py-14 text-white sm:px-24 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="font-serif text-2xl font-bold">
            Ceylon<span className="text-champagne">.lk</span>
          </p>
          <p className="mt-3 max-w-xs text-sm text-white/70">
            Curated hair, beauty &amp; grooming across Sri Lanka.
          </p>
          <div className="mt-5 flex gap-2">
            <span className="rounded-pill bg-white/10 px-3 py-1 text-xs">English</span>
            <span className="rounded-pill bg-white/10 px-3 py-1 text-xs opacity-50">සිංහල</span>
            <span className="rounded-pill bg-white/10 px-3 py-1 text-xs opacity-50">தமிழ்</span>
          </div>
        </div>
        {FOOTER_COLUMNS.map((column) => (
          <div key={column.heading}>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-champagne">{column.heading}</p>
            <ul className="mt-4 flex flex-col gap-3">
              {column.links.map((label) => (
                <li key={label}>
                  <Link href="/" className="text-sm text-white/60 hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-14 max-w-6xl border-t border-white/10 pt-6 text-xs text-white/50">
        <p>© {new Date().getFullYear()} Ceylon Bellezza. Payments by PayHere · Visa · Mastercard · eZ Cash</p>
      </div>
    </footer>
  );
}
