import { getSalons } from "@/lib/api";
import SalonDirectory from "@/components/SalonDirectory";
import Hero from "@/components/Hero";

export default async function HomePage() {
  const salons = await getSalons();

  return (
    <main>
      <Hero />
      <SalonDirectory initialSalons={salons} />
    </main>
  );
}
