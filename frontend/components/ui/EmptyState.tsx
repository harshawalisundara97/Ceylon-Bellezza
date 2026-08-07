import { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-hairline bg-surface p-10 text-center">
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="text-sm text-taupe">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
