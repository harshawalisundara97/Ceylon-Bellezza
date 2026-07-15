"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="mt-3 text-gray-500">We encountered an error while loading this page. Please try again.</p>
      <button
        onClick={reset}
        className="mt-6 px-6 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-800 transition-colors"
      >
        Try again
      </button>
    </main>
  );
}
