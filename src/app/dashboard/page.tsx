"use client";
import React from "react";
import { Inbox } from "lucide-react";

export default function DashboardRootPage() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-white dark:bg-[#0d0d0d]">
      <Inbox size={48} className="text-neutral-300 mb-2 dark:text-neutral-800 animate-pulse" />
      <h3 className="text-lg font-medium text-neutral-400 dark:text-neutral-500">未选择简报</h3>
      <p className="text-xs text-neutral-400 mt-1 dark:text-neutral-600">请从侧边栏选择或新建每日简报。</p>
    </div>
  );
}
