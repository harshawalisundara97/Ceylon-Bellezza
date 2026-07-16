import { Service } from "@/lib/types";

function groupByCategory(services: Service[]): Record<string, Service[]> {
  return services.reduce<Record<string, Service[]>>((groups, service) => {
    (groups[service.category] ??= []).push(service);
    return groups;
  }, {});
}

export default function ServiceList({ services }: { services: Service[] }) {
  const grouped = groupByCategory(services);

  return (
    <section className="bg-white px-6 py-12">
      <h2 className="font-serif text-2xl text-ink">Services</h2>
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="mt-8">
          <h3 className="border-b border-terracotta/30 pb-2 font-serif text-sm uppercase tracking-widest text-terracotta">
            {category}
          </h3>
          <ul className="mt-3 divide-y divide-hairline">
            {items.map((service) => (
              <li key={service.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-ink">{service.name}</p>
                  <p className="text-sm text-taupe">{service.duration_minutes} min</p>
                </div>
                <p className="font-serif font-semibold text-terracotta">Rs. {service.price.toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
