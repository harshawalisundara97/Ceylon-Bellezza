"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { fadeInUp } from "@/lib/motion";

const HERO_IMAGE = "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600&q=80";

export default function Hero() {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="relative mx-4 mt-4 h-[300px] overflow-hidden rounded-xl bg-cover bg-center sm:mx-11 sm:mt-6 sm:h-[520px]"
      style={{ backgroundImage: `url('${HERO_IMAGE}')` }}
    >
      <div
        className="absolute inset-0 [background:linear-gradient(180deg,rgba(14,59,50,.55)_0%,rgba(14,59,50,.9)_100%)] sm:[background:linear-gradient(102deg,rgba(14,59,50,.92)_0%,rgba(14,59,50,.72)_44%,rgba(14,59,50,.12)_78%)]"
      />
      <div className="relative flex h-full max-w-[600px] flex-col justify-end p-6 sm:justify-center sm:p-16">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-champagne">
          Colombo · Kandy · Galle · Negombo
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1.04] text-white sm:text-[62px]">
          Find your next favourite salon
        </h1>
        <p className="mt-3 max-w-[470px] text-base text-white/80 sm:text-lg">
          Curated hair, beauty &amp; grooming across Sri Lanka
        </p>
        <Link
          href="/join"
          className="mt-4 w-fit text-sm text-white underline underline-offset-4 hover:text-champagne"
        >
          List Your Salon
        </Link>
      </div>
    </motion.div>
  );
}
