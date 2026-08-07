import { HTMLAttributes } from "react";

export default function Skeleton({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`animate-pulse rounded-md bg-surface ${className}`.trim()} {...props} />;
}
