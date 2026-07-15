import Link from "next/link";
import { motion } from "framer-motion";
import { SalonSummary } from "@/lib/types";

function coverImage(salon: SalonSummary): string {
  const settings = salon.template_settings as { hero_image?: string };
  return settings.hero_image ?? "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80";
}

export default function SalonCard({ salon }: { salon: SalonSummary }) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: "0 12px 24px rgba(0,0,0,0.12)" }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white"
    >
      <Link href={`/salons/${salon.slug}`}>
        <img src={coverImage(salon)} alt={salon.name} className="h-48 w-full object-cover" />
        <div className="p-4">
          <span className="inline-block rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand-dark">
            {salon.category}
          </span>
          <h3 className="mt-2 text-lg font-semibold">{salon.name}</h3>
          <p className="text-sm text-gray-500">{salon.city}</p>
        </div>
      </Link>
    </motion.div>
  );
}
