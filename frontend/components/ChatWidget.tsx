"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Send } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const pathname = usePathname();
  if (pathname?.startsWith("/admin") || pathname?.startsWith("/platform")) {
    return null;
  }

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const history = messages.slice(-10);
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = typeof body?.detail === "string" ? body.detail : "Sorry, something went wrong — try again.";
        setMessages((prev) => [...prev, { role: "assistant", content: detail }]);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: body.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong — try again." }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-champagne text-ink shadow-floating"
        aria-label="Open chat"
      >
        <MessageCircle size={24} strokeWidth={2.5} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex h-[480px] w-[340px] flex-col overflow-hidden rounded-xl bg-white shadow-floating">
      <div className="flex items-center justify-between border-b border-hairline bg-accent px-4 py-3">
        <p className="font-serif text-lg font-semibold text-white">Ask Ceylon.lk</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="text-white">
          <X size={20} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-sm text-taupe">Ask me about salons, services, or prices.</p>}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              message.role === "user" ? "ml-auto bg-accent text-white" : "bg-surface text-ink"
            }`}
          >
            {message.content}
          </div>
        ))}
        {loading && <div className="max-w-[85%] rounded-lg bg-surface px-3 py-2 text-sm text-taupe">...</div>}
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-hairline p-3">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type a message..."
          className="min-h-[40px] flex-1 rounded-md border border-hairline px-3 text-sm text-ink placeholder:text-taupe focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white disabled:opacity-50"
          aria-label="Send message"
        >
          <Send size={16} strokeWidth={2.5} />
        </button>
      </form>
    </div>
  );
}
