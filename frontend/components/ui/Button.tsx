import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-terracotta text-white disabled:opacity-50",
  secondary: "border border-hairline text-ink hover:border-terracotta",
  danger: "text-sm text-red-600",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export default function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const base = variant === "danger" ? "" : "rounded px-4 py-2";
  return <button className={`${base} ${VARIANT_CLASSES[variant]} ${className}`.trim()} {...props} />;
}
