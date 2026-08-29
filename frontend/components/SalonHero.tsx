import { SalonDetail } from "@/lib/types";

const DEFAULT_HERO_IMAGE = "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600&q=80";

const CATEGORY_LABELS: Record<string, string> = {
  mens: "Mens",
  womens: "Womens",
  unisex: "Unisex",
};

function coverImage(salon: SalonDetail): string {
  const settings = salon.template_settings as { hero_image?: string };
  return settings.hero_image ?? DEFAULT_HERO_IMAGE;
}

export default function SalonHero({ salon }: { salon: SalonDetail }) {
  const galleryPhotos = salon.gallery.slice(0, 5);
  const extraPhotoCount = Math.max(0, salon.gallery.length - 5);

  return (
    <section className="px-6 pt-8 sm:px-11">
      {galleryPhotos.length > 0 ? (
        <div className="grid h-[312px] grid-cols-[2fr_1fr_1fr] grid-rows-2 gap-3 overflow-hidden rounded-xl">
          {galleryPhotos.map((photo, index) => {
            const isFirst = index === 0;
            const isLast = index === galleryPhotos.length - 1 && extraPhotoCount > 0;
            return (
              <div key={photo.id} className={`relative h-full w-full overflow-hidden ${isFirst ? "row-span-2" : ""}`}>
                <img src={photo.image_url} alt={photo.caption || salon.name} className="h-full w-full object-cover" />
                {isLast && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[rgba(14,59,50,0.5)]">
                    <span className="text-lg font-semibold text-white">+{extraPhotoCount} photos</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <img src={coverImage(salon)} alt={salon.name} className="h-[312px] w-full rounded-xl object-cover" />
      )}

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-block rounded-pill bg-accent-light px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-accent">
            {CATEGORY_LABELS[salon.category] ?? salon.category}
          </span>
          <h1 className="mt-3 font-serif text-4xl font-semibold text-ink sm:text-5xl">{salon.name}</h1>
          <p className="mt-1 text-taupe">{salon.city}</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="rounded-pill border border-hairline px-5 py-2.5 text-sm font-semibold text-ink">
            Save
          </button>
          <a href="#book" className="rounded-pill bg-champagne px-5 py-2.5 text-sm font-semibold text-ink">
            Book now
          </a>
        </div>
      </div>

      <div className="mt-6 border-b border-hairline">
        <span className="inline-block border-b-2 border-champagne pb-3 text-sm font-semibold text-accent">Services</span>
      </div>
    </section>
  );
}
