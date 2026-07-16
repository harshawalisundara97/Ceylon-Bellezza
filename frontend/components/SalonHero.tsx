import { SalonDetail } from "@/lib/types";

const DEFAULT_HERO_IMAGE = "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600&q=80";

function coverImage(salon: SalonDetail): string {
  const settings = salon.template_settings as { hero_image?: string };
  return settings.hero_image ?? DEFAULT_HERO_IMAGE;
}

export default function SalonHero({ salon }: { salon: SalonDetail }) {
  return (
    <section
      className="flex h-[420px] flex-col items-center justify-center bg-cover bg-center px-6 text-center"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(20,15,10,0.15) 0%, rgba(20,15,10,0.55) 100%), url('${coverImage(salon)}')`,
      }}
    >
      <span className="rounded-full border border-white/40 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white">
        {salon.category}
      </span>
      <h1 className="mt-3 font-serif text-4xl text-white sm:text-5xl">{salon.name}</h1>
      <p className="mt-1 text-white/80">{salon.city}</p>
      <button
        disabled
        title="Coming soon"
        className="mt-6 cursor-not-allowed rounded-full border border-white/60 px-6 py-3 text-sm font-medium text-white/70"
      >
        Book Appointment
      </button>
    </section>
  );
}
