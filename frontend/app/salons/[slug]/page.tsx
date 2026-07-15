import { notFound } from "next/navigation";
import { getSalonBySlug } from "@/lib/api";
import SalonHero from "@/components/SalonHero";
import ServiceList from "@/components/ServiceList";
import StaffList from "@/components/StaffList";
import GalleryGrid from "@/components/GalleryGrid";
import AboutContact from "@/components/AboutContact";

export default async function SalonPage({ params }: { params: { slug: string } }) {
  const salon = await getSalonBySlug(params.slug);

  if (!salon) {
    notFound();
  }

  return (
    <main>
      <SalonHero salon={salon} />
      <ServiceList services={salon.services} />
      {salon.staff.length > 0 && <StaffList staff={salon.staff} />}
      {salon.gallery.length > 0 && <GalleryGrid items={salon.gallery} />}
      <AboutContact content={salon.content} />
    </main>
  );
}
