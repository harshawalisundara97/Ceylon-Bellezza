import { Staff } from "@/lib/types";

export default function StaffList({ staff }: { staff: Staff[] }) {
  return (
    <section className="bg-gray-50 px-6 py-10">
      <h2 className="text-2xl font-semibold">Our Team</h2>
      <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {staff.map((member) => (
          <div key={member.id} className="text-center">
            <img
              src={member.photo_url ?? "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80"}
              alt={member.name}
              className="mx-auto h-24 w-24 rounded-full object-cover"
            />
            <p className="mt-2 font-medium">{member.name}</p>
            <p className="text-sm text-gray-500">{member.bio}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
