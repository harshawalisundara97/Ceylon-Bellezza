import { SalonDetail } from "@/lib/types";

function coverImage(salon: SalonDetail): string {
  const settings = salon.template_settings as { hero_image?: string };
  return settings.hero_image ?? "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80";
}

export default function SalonHero({ salon }: { salon: SalonDetail }) {
  return (
    <section className="relative">
      <img src={coverImage(salon)} alt={salon.name} className="h-72 w-full object-cover sm:h-96" />
      <div className="bg-white px-6 py-6 text-center">
        <span className="inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand-dark">
          {salon.category}
        </span>
        <h1 className="mt-2 text-3xl font-bold">{salon.name}</h1>
        <p className="mt-1 text-gray-500">{salon.city}</p>
        <button
          disabled
          title="Coming soon"
          className="mt-4 cursor-not-allowed rounded-full bg-gray-300 px-6 py-3 text-sm font-medium text-gray-600"
        >
          Book Appointment
        </button>
      </div>
    </section>
  );
}
