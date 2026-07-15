"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { SalonSummary } from "@/lib/types";
import SalonCard from "./SalonCard";
import SearchBar from "./SearchBar";

export default function SalonDirectory({ initialSalons }: { initialSalons: SalonSummary[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return initialSalons;
    return initialSalons.filter(
      (salon) => salon.name.toLowerCase().includes(normalized) || salon.city.toLowerCase().includes(normalized)
    );
  }, [initialSalons, query]);

  return (
    <div>
      <div className="flex justify-center py-8">
        <SearchBar value={query} onChange={setQuery} />
      </div>
      {filtered.length === 0 ? (
        <p className="py-16 text-center text-gray-500">
          {initialSalons.length === 0 ? "No salons yet — check back soon." : "No salons match your search."}
        </p>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
          className="grid grid-cols-1 gap-6 px-6 pb-16 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filtered.map((salon) => (
            <motion.div key={salon.id} variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
              <SalonCard salon={salon} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
