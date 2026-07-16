import { getSalons } from "@/lib/api";
import SalonDirectory from "@/components/SalonDirectory";

const HERO_IMAGE = "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600&q=80";

export default async function HomePage() {
  const salons = await getSalons();

  return (
    <main>
      <section
        className="flex h-[420px] flex-col items-center justify-center bg-cover bg-center px-6 text-center"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(20,15,10,0.15) 0%, rgba(20,15,10,0.55) 100%), url('${HERO_IMAGE}')`,
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-terracotta-light">Ceylon Bellezza</p>
        <h1 className="mt-3 font-serif text-4xl text-white sm:text-5xl">Find your next favourite salon</h1>
        <p className="mt-3 max-w-md text-base text-white/80">Curated hair, beauty &amp; grooming across Sri Lanka</p>
      </section>
      <SalonDirectory initialSalons={salons} />
    </main>
  );
}
