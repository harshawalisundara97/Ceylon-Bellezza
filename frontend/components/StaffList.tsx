import { Staff } from "@/lib/types";

const DEFAULT_STAFF_PHOTO = "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80";

export default function StaffList({ staff }: { staff: Staff[] }) {
  return (
    <section className="py-8">
      <h2 className="font-serif text-2xl font-semibold text-ink">Team</h2>
      <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {staff.map((member) => (
          <div key={member.id} className="rounded-xl border border-hairline bg-white p-5 text-center">
            <img
              src={member.photo_url ?? DEFAULT_STAFF_PHOTO}
              alt={member.name}
              className="mx-auto h-[88px] w-[88px] rounded-full object-cover"
            />
            <p className="mt-3 font-semibold text-ink">{member.name}</p>
            <p className="text-sm text-taupe">{member.bio}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
