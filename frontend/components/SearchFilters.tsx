"use client";

const CATEGORIES = [
  { value: "mens", label: "Mens" },
  { value: "womens", label: "Womens" },
  { value: "unisex", label: "Unisex" },
];

interface SearchFiltersProps {
  priceBounds: { min: number; max: number };
  priceRange: { min: number; max: number };
  onPriceRangeChange: (range: { min: number; max: number }) => void;
  category: string | null;
  onCategoryChange: (category: string | null) => void;
  onClearAll: () => void;
}

function formatRs(amount: number): string {
  return `Rs. ${Math.round(amount).toLocaleString("en-US")}`;
}

export default function SearchFilters({
  priceBounds,
  priceRange,
  onPriceRangeChange,
  category,
  onCategoryChange,
  onClearAll,
}: SearchFiltersProps) {
  return (
    <div className="rounded-lg border border-hairline bg-white p-[22px]">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold text-ink">Filters</h3>
        <button type="button" onClick={onClearAll} className="text-sm text-accent hover:underline">
          Clear all
        </button>
      </div>

      <div className="mt-5 border-t border-hairline pt-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-taupe">Price range</p>
        <div className="mt-3 flex items-center justify-between text-sm text-ink">
          <span>{formatRs(priceRange.min)}</span>
          <span>{formatRs(priceRange.max)}</span>
        </div>
        <div className="mt-2 flex flex-col gap-2">
          <input
            type="range"
            min={priceBounds.min}
            max={priceBounds.max}
            value={priceRange.min}
            onChange={(event) => {
              const nextMin = Math.min(Number(event.target.value), priceRange.max);
              onPriceRangeChange({ min: nextMin, max: priceRange.max });
            }}
            aria-label="Minimum price"
            className="w-full accent-champagne"
          />
          <input
            type="range"
            min={priceBounds.min}
            max={priceBounds.max}
            value={priceRange.max}
            onChange={(event) => {
              const nextMax = Math.max(Number(event.target.value), priceRange.min);
              onPriceRangeChange({ min: priceRange.min, max: nextMax });
            }}
            aria-label="Maximum price"
            className="w-full accent-champagne"
          />
        </div>
      </div>

      <div className="mt-5 border-t border-hairline pt-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-taupe">Service type</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORIES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onCategoryChange(category === option.value ? null : option.value)}
              className={`rounded-pill border px-4 py-2 text-sm ${
                category === option.value ? "border-accent bg-accent-light text-accent" : "border-hairline text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
