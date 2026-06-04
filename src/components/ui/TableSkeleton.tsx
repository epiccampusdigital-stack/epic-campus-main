export default function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse divide-y divide-[#DDE3EC] dark:divide-gray-600">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="h-10 w-10 shrink-0 rounded-full bg-[#DDE3EC] dark:bg-gray-700" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-[#DDE3EC] dark:bg-gray-700" />
            <div className="h-2 w-24 rounded bg-[#DDE3EC] dark:bg-gray-700" />
          </div>
          <div className="h-6 w-16 rounded-full bg-[#DDE3EC] dark:bg-gray-700" />
          <div className="hidden h-3 w-20 rounded bg-[#DDE3EC] sm:block dark:bg-gray-700" />
        </div>
      ))}
    </div>
  )
}
