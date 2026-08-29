"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SalonSummary } from "@/lib/types";
import SalonCard from "./SalonCard";
import SearchBarCard from "./SearchBarCard";
import { staggerContainer } from "@/lib/motion";

export default function SalonDirectory({ initialSalons }: { initialSalons: SalonSummary[] }) {
  return (
    <div>
      <div className="relative z-10 mx-4 -mt-[26px] sm:mx-11 sm:-mt-[58px]">
        <SearchBarCard />
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-11">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-[32px] font-semibold text-ink">Featured this week</h2>
          <div className="hidden gap-2 sm:flex">
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-pill border border-hairline text-ink"
              aria-label="Previous"
            >
              <ChevronLeft size={18} strokeWidth={2.75} />
            </button>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-pill bg-accent text-white"
              aria-label="Next"
            >
              <ChevronRight size={18} strokeWidth={2.75} />
            </button>
          </div>
        </div>

        {initialSalons.length === 0 ? (
          <p className="py-16 text-center text-taupe">No salons yet — check back soon.</p>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="mt-6 grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-4"
          >
            {initialSalons.map((salon) => (
              <div key={salon.id}>
                <SalonCard salon={salon} />
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
