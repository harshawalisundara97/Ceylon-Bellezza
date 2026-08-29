import { getSalons } from "@/lib/api";
import SalonDirectory from "@/components/SalonDirectory";
import Hero from "@/components/Hero";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default async function HomePage() {
  const salons = await getSalons();

  return (
    <main>
      <Header />
      <Hero />
      <SalonDirectory initialSalons={salons} />
      <Footer />
    </main>
  );
}
