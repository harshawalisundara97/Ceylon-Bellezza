import { ElementType, HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLElement> {
  padding?: boolean;
  href?: string;
  as?: ElementType;
  [key: string]: unknown;
}

export default function Card({ padding = true, as: Tag = "div", className = "", ...props }: CardProps) {
  const paddingClass = padding ? "p-5" : "";
  return <Tag className={`rounded-lg border border-hairline bg-white ${paddingClass} ${className}`.trim()} {...props} />;
}
