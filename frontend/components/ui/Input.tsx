import { InputHTMLAttributes } from "react";

export default function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`rounded border border-hairline px-3 py-2 focus:border-terracotta focus:outline-none ${className}`.trim()}
      {...props}
    />
  );
}
