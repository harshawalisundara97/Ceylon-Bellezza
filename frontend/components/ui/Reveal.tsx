"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { scrollReveal, fadeInUp } from "@/lib/motion";

export default function Reveal({ children }: { children: ReactNode }) {
  return (
    <motion.div {...scrollReveal} variants={fadeInUp}>
      {children}
    </motion.div>
  );
}
