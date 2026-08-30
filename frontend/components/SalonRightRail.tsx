import { SalonDetail } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

export default function SalonRightRail({ salon }: { salon: SalonDetail }) {
  const prices = salon.services.map((s) => s.price);
  const startingPrice = prices.length > 0 ? Math.min(...prices) : null;

  return (
    <div className="sticky top-24 flex flex-col gap-5">
      <div className="rounded-xl bg-accent p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-champagne">Booking</p>
        <p className="mt-3 text-sm text-white/80">Starting from</p>
        <p className="mt-1 font-serif text-3xl font-semibold">
          {startingPrice != null ? formatCurrency(startingPrice) : "Price on request"}
        </p>
        <a
          href="#book"
          className="mt-5 block rounded-pill bg-champagne px-6 py-3 text-center text-sm font-bold text-ink"
        >
          Continue to booking
        </a>
        <p className="mt-3 text-xs text-white/70">Pay at salon or online</p>
      </div>
    </div>
  );
}
