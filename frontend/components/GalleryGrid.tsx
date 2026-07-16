import { GalleryItem } from "@/lib/types";

export default function GalleryGrid({ items }: { items: GalleryItem[] }) {
  return (
    <section className="bg-white px-6 py-12">
      <h2 className="font-serif text-2xl text-ink">Gallery</h2>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, index) => (
          <img
            key={item.id}
            src={item.image_url}
            alt={item.caption || "Gallery photo"}
            className={`w-full rounded-lg border border-hairline object-cover ${
              index % 3 === 0 ? "aspect-[3/4]" : "aspect-square"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
