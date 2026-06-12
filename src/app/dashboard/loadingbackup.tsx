export default function DashboardLoading() {
  return (
    <div className="max-w-[100rem] mx-auto p-6 md:p-8 space-y-6">
      <div className="mb-8">
        <div className="h-7 w-32 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-52 rounded-md bg-muted animate-pulse mt-2" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="border border-border rounded-md p-4 bg-card space-y-3"
          >
            <div className="h-4 w-4 rounded bg-muted animate-pulse" />
            <div className="h-8 w-12 rounded-md bg-muted animate-pulse" />
            <div className="h-3 w-16 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-md border border-dashed border-border p-8 text-center">
        <div className="h-4 w-80 mx-auto rounded bg-muted animate-pulse" />
      </div>
    </div>
  );
}
