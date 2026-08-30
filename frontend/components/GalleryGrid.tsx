import { GalleryItem } from "@/lib/types";

export default function GalleryGrid({ items }: { items: GalleryItem[] }) {
  return (
    <section className="py-8">
      <h2 className="font-serif text-2xl font-semibold text-ink">Gallery</h2>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, index) => (
          <img
            key={item.id}
            src={item.image_url}
            alt={item.caption || "Gallery photo"}
            className={`w-full rounded-xl object-cover ${index % 3 === 0 ? "aspect-[3/4]" : "aspect-square"}`}
          />
        ))}
      </div>
    </section>
  );
}
