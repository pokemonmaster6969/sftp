import React from 'react'

export const FileGridSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
      {Array.from({ length: 16 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-slate-100 p-4 h-48 flex flex-col justify-between animate-pulse shadow-sm will-change-transform"
        >
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-xl bg-slate-100" />
            <div className="w-4 h-4 rounded bg-slate-100" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full bg-slate-100 rounded" />
            <div className="h-3 w-2/3 bg-slate-100 rounded" />
          </div>
          <div className="h-8 w-full bg-slate-100 rounded-lg mt-4" />
        </div>
      ))}
    </div>
  )
}
