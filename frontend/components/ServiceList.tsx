import { Service } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

function groupByCategory(services: Service[]): Record<string, Service[]> {
  return services.reduce<Record<string, Service[]>>((groups, service) => {
    (groups[service.category] ??= []).push(service);
    return groups;
  }, {});
}

export default function ServiceList({ services }: { services: Service[] }) {
  const grouped = groupByCategory(services);

  return (
    <section className="py-8">
      <h2 className="font-serif text-2xl font-semibold text-ink">Services</h2>
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-accent">{category}</h3>
          <ul className="mt-3 divide-y divide-hairline rounded-xl border border-hairline bg-white">
            {items.map((service) => (
              <li key={service.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium text-ink">{service.name}</p>
                  <p className="text-sm text-taupe">{service.duration_minutes} min</p>
                </div>
                <p className="font-semibold text-ink">{formatCurrency(service.price)}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
