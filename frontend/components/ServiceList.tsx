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
    <section className="px-6 py-10">
      <h2 className="text-2xl font-semibold">Services</h2>
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="mt-6">
          <h3 className="text-sm font-medium uppercase tracking-wide text-gray-400">{category}</h3>
          <ul className="mt-3 divide-y divide-gray-100">
            {items.map((service) => (
              <li key={service.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{service.name}</p>
                  <p className="text-sm text-gray-500">{service.duration_minutes} min</p>
                </div>
                <p className="font-semibold text-brand-dark">Rs. {service.price.toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
