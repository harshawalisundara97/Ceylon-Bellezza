"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSalons } from "@/lib/api";
import { SalonSummary } from "@/lib/types";
import SearchResultCard from "./SearchResultCard";
import SearchFilters from "./SearchFilters";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";

export default function SearchResults() {
  const searchParams = useSearchParams();
  const service = searchParams.get("service") ?? "";
  const location = searchParams.get("location") ?? "";

  const [salons, setSalons] = useState<SalonSummary[] | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(null);

  useEffect(() => {
    getSalons()
      .then(setSalons)
      .catch((error) => {
        console.error("Failed to load salons", error);
        setSalons([]);
      });
  }, []);

  const priceBounds = useMemo(() => {
    if (!salons) return { min: 0, max: 0 };
    const prices = salons.map((s) => s.starting_price).filter((p): p is number => p != null);
    if (prices.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [salons]);

  const effectivePriceRange = priceRange ?? priceBounds;

  const filtered = useMemo(() => {
    if (!salons) return [];
    const normalizedService = service.trim().toLowerCase();
    const normalizedLocation = location.trim().toLowerCase();
    return salons.filter((salon) => {
      if (normalizedService && !salon.name.toLowerCase().includes(normalizedService)) return false;
      if (normalizedLocation && !salon.city.toLowerCase().includes(normalizedLocation)) return false;
      if (category && salon.category !== category) return false;
      if (priceRange) {
        if (salon.starting_price == null) return false;
        if (salon.starting_price < priceRange.min || salon.starting_price > priceRange.max) return false;
      }
      return true;
    });
  }, [salons, service, location, category, priceRange]);

  function handleClearAll() {
    setCategory(null);
    setPriceRange(null);
  }

  if (salons === null) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-11">
        <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2">
          <Skeleton className="h-[212px] w-full" />
          <Skeleton className="h-[212px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-11">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[300px_1fr]">
        <div>
          <SearchFilters
            priceBounds={priceBounds}
            priceRange={effectivePriceRange}
            onPriceRangeChange={setPriceRange}
            category={category}
            onCategoryChange={setCategory}
            onClearAll={handleClearAll}
          />
        </div>

        <div>
          <h1 className="font-serif text-[32px] font-semibold text-ink">
            {service ? `${service} salons` : "Search results"}
            {location ? ` in ${location}` : ""}
          </h1>
          <p className="mt-1 text-sm text-taupe">{filtered.length} salons available</p>

          {filtered.length === 0 ? (
            <div className="mt-8">
              <EmptyState title="No salons match your search" />
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-5">
              {filtered.map((salon) => (
                <SearchResultCard key={salon.id} salon={salon} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
