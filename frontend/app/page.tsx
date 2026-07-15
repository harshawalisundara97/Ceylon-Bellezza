import { getSalons } from "@/lib/api";
import SalonDirectory from "@/components/SalonDirectory";

export default async function HomePage() {
  const salons = await getSalons();

  return (
    <main>
      <section className="bg-brand/5 px-6 py-16 text-center">
        <h1 className="text-4xl font-bold text-brand-dark">Ceylon Bellezza</h1>
        <p className="mt-3 text-lg text-gray-600">Find and book the best salons near you.</p>
      </section>
      <SalonDirectory initialSalons={salons} />
    </main>
  );
}
