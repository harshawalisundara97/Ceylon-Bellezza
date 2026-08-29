"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, Calendar } from "lucide-react";

export default function SearchBarCard() {
  const router = useRouter();
  const [service, setService] = useState("");
  const [location, setLocation] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams({ service, location, date: "today" });
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg bg-white p-4 shadow-floating sm:grid sm:grid-cols-[1.3fr_1fr_1fr_auto] sm:items-center sm:gap-3.5 sm:p-[18px]"
    >
      <div className="border-hairline py-2 sm:border-r sm:pr-3.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-taupe">Service</p>
        <div className="mt-1 flex items-center gap-2">
          <Search size={18} className="text-champagne" strokeWidth={2.75} />
          <input
            type="text"
            value={service}
            onChange={(event) => setService(event.target.value)}
            placeholder="Search by salon name or city..."
            className="min-h-[44px] w-full bg-transparent text-sm text-ink placeholder:text-taupe focus:outline-none"
          />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-hairline py-2 sm:col-span-2 sm:mt-0 sm:grid sm:grid-cols-2 sm:gap-0 sm:border-r sm:px-3.5">
        <div className="border-hairline sm:border-r sm:pr-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-taupe">Location</p>
          <div className="mt-1 flex items-center gap-2">
            <MapPin size={18} className="text-champagne" strokeWidth={2.75} />
            <input
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Anywhere"
              className="min-h-[44px] w-full bg-transparent text-sm text-ink placeholder:text-taupe focus:outline-none"
            />
          </div>
        </div>
        <div className="sm:pl-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-taupe">Date</p>
          <div className="mt-1 flex min-h-[44px] items-center gap-2 opacity-60">
            <Calendar size={18} className="text-champagne" strokeWidth={2.75} />
            <span className="text-sm text-ink">Today</span>
          </div>
        </div>
      </div>
      <button
        type="submit"
        className="mt-3 min-h-[44px] w-full rounded-pill bg-champagne px-6 text-sm font-bold text-ink sm:mt-0 sm:h-14 sm:w-auto sm:min-h-0"
      >
        Search salons
      </button>
    </form>
  );
}
