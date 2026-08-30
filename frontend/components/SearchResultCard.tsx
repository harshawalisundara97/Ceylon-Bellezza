import Link from "next/link";
import { MapPin } from "lucide-react";
import { SalonSummary } from "@/lib/types";
import Card from "@/components/ui/Card";
import { formatCurrency } from "@/lib/format";

const DEFAULT_COVER_IMAGE = "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80";

function coverImage(salon: SalonSummary): string {
  const settings = salon.template_settings as { hero_image?: string };
  return settings.hero_image ?? DEFAULT_COVER_IMAGE;
}

export default function SearchResultCard({ salon }: { salon: SalonSummary }) {
  return (
    <Card padding={false} className="overflow-hidden">
      <Link href={`/salons/${salon.slug}`} className="flex flex-col gap-5 p-4 sm:flex-row">
        <div className="h-[180px] w-full flex-shrink-0 overflow-hidden rounded-lg sm:w-[250px]">
          <img src={coverImage(salon)} alt={salon.name} className="h-full w-full object-cover" />
        </div>
        <div className="flex flex-1 flex-col">
          <span className="inline-block w-fit rounded-pill bg-accent-light px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-accent">
            {salon.category}
          </span>
          <h3 className="mt-2 font-serif text-2xl font-semibold text-ink">{salon.name}</h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-taupe">
            <MapPin size={14} strokeWidth={2.75} />
            {salon.city}
          </p>
          <div className="mt-auto flex items-center justify-between border-t border-hairline pt-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-taupe">Starting from</p>
              <p className="text-sm font-semibold text-ink">
                {salon.starting_price != null ? formatCurrency(salon.starting_price) : "Price on request"}
              </p>
            </div>
            <span className="rounded-pill bg-accent px-6 py-2.5 text-sm font-semibold text-white">Book now</span>
          </div>
        </div>
      </Link>
    </Card>
  );
}
