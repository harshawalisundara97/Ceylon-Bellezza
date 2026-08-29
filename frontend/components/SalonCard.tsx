"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, MapPin } from "lucide-react";
import { SalonSummary } from "@/lib/types";
import Card from "@/components/ui/Card";
import { formatCurrency } from "@/lib/format";
import { staggerItem, scaleTap, usePrefersReducedMotion } from "@/lib/motion";

const DEFAULT_COVER_IMAGE = "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80";

function coverImage(salon: SalonSummary): string {
  const settings = salon.template_settings as { hero_image?: string };
  return settings.hero_image ?? DEFAULT_COVER_IMAGE;
}

export default function SalonCard({ salon }: { salon: SalonSummary }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <Card
      as={motion.div}
      variants={staggerItem}
      {...scaleTap}
      {...(prefersReducedMotion ? { transition: { duration: 0.01 } } : {})}
      padding={false}
      className="group overflow-hidden transition-shadow duration-300 hover:shadow-md"
    >
      <Link href={`/salons/${salon.slug}`}>
        <div className="relative h-[172px] w-full overflow-hidden">
          <img
            src={coverImage(salon)}
            alt={salon.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <button
            type="button"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-pill bg-white/80 text-charcoal"
            aria-label="Save salon"
            onClick={(event) => event.preventDefault()}
          >
            <Heart size={16} strokeWidth={2.75} />
          </button>
        </div>
        <div className="p-4">
          <span className="inline-block rounded-pill bg-accent-light px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-accent">
            {salon.category}
          </span>
          <h3 className="mt-2 font-serif text-2xl font-semibold text-ink">{salon.name}</h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-taupe">
            <MapPin size={14} strokeWidth={2.75} />
            {salon.city}
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-taupe">From</p>
              <p className="text-sm font-semibold text-ink">
                {salon.starting_price !== null ? formatCurrency(salon.starting_price) : "Price on request"}
              </p>
            </div>
          </div>
        </div>
      </Link>
    </Card>
  );
}
