"use client";

export default function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search by salon name or city..."
      className="w-full max-w-md rounded-full border border-gray-300 px-5 py-3 text-sm shadow-sm focus:border-brand focus:outline-none"
    />
  );
}
