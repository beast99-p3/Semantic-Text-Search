"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4">
      <div className="frost-panel w-full rounded-2xl p-6 text-center">
        <h1 className="text-2xl font-semibold">Unexpected application error</h1>
        <p className="ink-muted mt-2 text-sm">{error.message}</p>
        <button
          onClick={reset}
          className="mt-4 rounded-xl bg-[var(--accent-1)] px-4 py-2 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
