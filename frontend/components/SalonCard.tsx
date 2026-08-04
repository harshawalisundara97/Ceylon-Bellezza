import Link from "next/link";
import { motion } from "framer-motion";
import { SalonSummary } from "@/lib/types";
import Card from "@/components/ui/Card";
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
      className="group overflow-hidden transition-shadow duration-300 hover:shadow-xl"
    >
      <Link href={`/salons/${salon.slug}`}>
        <div className="h-48 w-full overflow-hidden">
          <img
            src={coverImage(salon)}
            alt={salon.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <div className="p-4">
          <span className="inline-block rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-accent">
            {salon.category}
          </span>
          <h3 className="mt-2 font-serif text-lg text-ink">{salon.name}</h3>
          <p className="text-sm text-taupe">{salon.city}</p>
        </div>
      </Link>
    </Card>
  );
}
