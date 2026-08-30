import { notFound } from "next/navigation";
import { getSalonBySlug } from "@/lib/api";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SalonHero from "@/components/SalonHero";
import ServiceList from "@/components/ServiceList";
import StaffList from "@/components/StaffList";
import GalleryGrid from "@/components/GalleryGrid";
import AboutContact from "@/components/AboutContact";
import BookingForm from "@/components/BookingForm";
import SalonRightRail from "@/components/SalonRightRail";
import Reveal from "@/components/ui/Reveal";

export default async function SalonPage({ params }: { params: { slug: string } }) {
  const salon = await getSalonBySlug(params.slug);

  if (!salon) {
    notFound();
  }

  return (
    <main>
      <Header />
      <SalonHero salon={salon} />
      <div className="mx-auto max-w-6xl px-6 py-8 sm:px-11">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_340px]">
          <div>
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
            <BookingForm salon={salon} />
          </div>
          <SalonRightRail salon={salon} />
        </div>
      </div>
      <Footer />
    </main>
  );
}
