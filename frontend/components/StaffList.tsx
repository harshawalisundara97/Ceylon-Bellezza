import { Staff } from "@/lib/types";

const DEFAULT_STAFF_PHOTO = "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80";

export default function StaffList({ staff }: { staff: Staff[] }) {
  return (
    <section className="bg-ivory px-6 py-12">
      <h2 className="font-serif text-2xl text-ink">Our Team</h2>
      <div className="mt-8 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
        {staff.map((member) => (
          <div key={member.id} className="text-center">
            <img
              src={member.photo_url ?? DEFAULT_STAFF_PHOTO}
              alt={member.name}
              className="mx-auto h-24 w-24 rounded-full border border-hairline object-cover"
            />
            <p className="mt-3 font-serif text-ink">{member.name}</p>
            <p className="text-sm text-taupe">{member.bio}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
