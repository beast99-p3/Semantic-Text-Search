export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-8 sm:py-12">
      <div className="frost-panel rounded-2xl p-6">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-zinc-200" />
        <div className="mt-3 h-4 w-full animate-pulse rounded-lg bg-zinc-200" />
        <div className="mt-2 h-4 w-5/6 animate-pulse rounded-lg bg-zinc-200" />
      </div>
    </main>
  );
}
