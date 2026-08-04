import { notFound } from "next/navigation";
import { getSalonBySlug } from "@/lib/api";
import SalonHero from "@/components/SalonHero";
import ServiceList from "@/components/ServiceList";
import StaffList from "@/components/StaffList";
import GalleryGrid from "@/components/GalleryGrid";
import AboutContact from "@/components/AboutContact";
import BookingForm from "@/components/BookingForm";
import { motion } from "framer-motion";
import { scrollReveal, fadeInUp } from "@/lib/motion";

export default async function SalonPage({ params }: { params: { slug: string } }) {
  const salon = await getSalonBySlug(params.slug);

  if (!salon) {
    notFound();
  }

  return (
    <main>
      <SalonHero salon={salon} />
      <BookingForm salon={salon} />
      <motion.div {...scrollReveal} variants={fadeInUp}>
        <ServiceList services={salon.services} />
      </motion.div>
      {salon.staff.length > 0 && (
        <motion.div {...scrollReveal} variants={fadeInUp}>
          <StaffList staff={salon.staff} />
        </motion.div>
      )}
      {salon.gallery.length > 0 && (
        <motion.div {...scrollReveal} variants={fadeInUp}>
          <GalleryGrid items={salon.gallery} />
        </motion.div>
      )}
      <motion.div {...scrollReveal} variants={fadeInUp}>
        <AboutContact content={salon.content} />
      </motion.div>
    </main>
  );
}
