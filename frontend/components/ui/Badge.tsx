import { ReactNode } from "react";

const VARIANT_CLASS: Record<string, string> = {
  success: "bg-accent-light text-accent",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-danger",
  neutral: "bg-hairline text-ink",
};

interface BadgeProps {
  variant: "success" | "warning" | "danger" | "neutral";
  children: ReactNode;
}

export default function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${VARIANT_CLASS[variant]}`}>
      {children}
    </span>
  );
}
