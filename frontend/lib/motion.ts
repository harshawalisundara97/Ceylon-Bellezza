"use client";

import { useEffect, useState } from "react";
import type { Transition, Variants } from "framer-motion";

export const duration = { fast: 0.15, base: 0.3, slow: 0.5 };

export const spring: Transition = { type: "spring", stiffness: 300, damping: 20 };

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: duration.base } },
};

export const staggerContainer: Variants = {
  visible: { transition: { staggerChildren: 0.08 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export const scaleTap = {
  whileHover: { scale: 1.03 },
  whileTap: { scale: 0.97 },
  transition: spring,
};

export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: spring },
};

export const drawerSlide: Variants = {
  hidden: { x: "100%" },
  visible: { x: 0, transition: spring },
};

export const scrollReveal = {
  initial: "hidden",
  whileInView: "visible",
  viewport: { once: true, margin: "-80px" },
};

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);

  return reduced;
}
