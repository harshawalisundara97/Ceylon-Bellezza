import { TextareaHTMLAttributes } from "react";

export default function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`rounded border border-hairline px-3 py-2 focus:border-accent focus:outline-none ${className}`.trim()}
      {...props}
    />
  );
}
