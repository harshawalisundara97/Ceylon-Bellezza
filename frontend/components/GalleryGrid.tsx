import { GalleryItem } from "@/lib/types";

export default function GalleryGrid({ items }: { items: GalleryItem[] }) {
  return (
    <section className="px-6 py-10">
      <h2 className="text-2xl font-semibold">Gallery</h2>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <img
            key={item.id}
            src={item.image_url}
            alt={item.caption || "Gallery photo"}
            className="aspect-square w-full rounded-lg object-cover"
          />
        ))}
      </div>
    </section>
  );
}
