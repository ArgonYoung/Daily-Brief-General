import React from "react";

export default function Loading() {
  return (
    <div className="p-8 space-y-6 bg-white dark:bg-[#0d0d0d] h-full overflow-y-auto">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4 dark:border-neutral-800 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 dark:bg-neutral-800 rounded" />
        <div className="flex space-x-2">
          <div className="h-9 w-24 bg-gray-200 dark:bg-neutral-800 rounded" />
          <div className="h-9 w-32 bg-gray-200 dark:bg-neutral-800 rounded" />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
        <div className="h-28 bg-gray-100 dark:bg-neutral-900 rounded-2xl border border-gray-200/80 dark:border-neutral-800" />
        <div className="h-28 bg-gray-100 dark:bg-neutral-900 rounded-2xl border border-gray-200/80 dark:border-neutral-800" />
      </div>

      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-36 bg-gray-200 dark:bg-neutral-800 rounded" />
        <div className="space-y-3">
          <div className="h-16 bg-gray-100 dark:bg-neutral-900 rounded-xl border border-gray-200/80 dark:border-neutral-800" />
          <div className="h-16 bg-gray-100 dark:bg-neutral-900 rounded-xl border border-gray-200/80 dark:border-neutral-800" />
        </div>
      </div>
    </div>
  );
}
