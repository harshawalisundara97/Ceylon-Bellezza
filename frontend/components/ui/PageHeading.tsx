import { HTMLAttributes } from "react";

export default function PageHeading({ className = "", ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h1 className={`font-serif text-2xl text-ink ${className}`.trim()} {...props} />;
}
