export default function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="border border-border rounded-md p-4 bg-card"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 w-4 rounded bg-muted animate-pulse" />
          </div>

          <div className="h-8 w-10 rounded bg-muted animate-pulse mb-2" />

          <div className="h-3 w-16 rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  );
}