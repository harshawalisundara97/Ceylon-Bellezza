import { notFound } from "next/navigation";
import { getSalonBySlug } from "@/lib/api";
import SalonHero from "@/components/SalonHero";
import ServiceList from "@/components/ServiceList";
import StaffList from "@/components/StaffList";
import GalleryGrid from "@/components/GalleryGrid";
import AboutContact from "@/components/AboutContact";
import BookingForm from "@/components/BookingForm";
import Reveal from "@/components/ui/Reveal";

export default async function SalonPage({ params }: { params: { slug: string } }) {
  const salon = await getSalonBySlug(params.slug);

  if (!salon) {
    notFound();
  }

  return (
    <main>
      <SalonHero salon={salon} />
      <BookingForm salon={salon} />
      <Reveal>
        <ServiceList services={salon.services} />
      </Reveal>
      {salon.staff.length > 0 && (
        <Reveal>
          <StaffList staff={salon.staff} />
        </Reveal>
      )}
      {salon.gallery.length > 0 && (
        <Reveal>
          <GalleryGrid items={salon.gallery} />
        </Reveal>
      )}
      <Reveal>
        <AboutContact content={salon.content} />
      </Reveal>
    </main>
  );
}
