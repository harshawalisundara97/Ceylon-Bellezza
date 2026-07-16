"use client";

export default function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search by salon name or city..."
      className="w-full max-w-md rounded-full border border-hairline bg-white px-5 py-3 text-sm text-ink shadow-lg shadow-black/5 focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
    />
  );
}
