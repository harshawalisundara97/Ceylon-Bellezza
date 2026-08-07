import { SelectHTMLAttributes } from "react";

export default function Dropdown({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`rounded-md border border-hairline bg-bg px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none ${className}`.trim()}
      {...props}
    />
  );
}
