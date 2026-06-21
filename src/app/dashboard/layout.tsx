"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Plus, LogOut, FileText } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [briefs, setBriefs] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    // 1. Check Auth state
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then(({ user }) => {
        if (!user) {
          router.push("/login");
        } else {
          setUserEmail(user.email || null);
          fetchBriefs();
        }
      })
      .catch(() => {
        router.push("/login");
      });

    // 2. Listen for brief updates to refresh sidebar names
    const handleBriefUpdated = () => {
      fetchBriefs();
    };
    window.addEventListener("brief-updated", handleBriefUpdated);
    return () => {
      window.removeEventListener("brief-updated", handleBriefUpdated);
    };
  }, [router]);

  const fetchBriefs = async () => {
    try {
      const res = await fetch(`/api/briefs?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setBriefs(data);
      }
    } catch (e) {
      console.error("Failed to fetch briefs:", e);
    }
  };

  const handleAddBrief = async () => {
    try {
      const res = await fetch("/api/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Brief" }),
      });
      if (res.ok) {
        const newBrief = await res.json();
        setBriefs([...briefs, newBrief]);
        router.push(`/dashboard/${newBrief.id}`);
      }
    } catch (e) {
      console.error("Failed to add brief:", e);
    }
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-black dark:bg-[#0d0d0d] dark:text-white">
      {/* Left Sidebar */}
      <aside className="w-64 border-r border-gray-200/80 bg-[#f5f5f7] flex flex-col justify-between dark:border-neutral-800 dark:bg-[#161618]">
        <div>
          {/* Header Profile */}
          <div className="p-4 border-b border-gray-200/80 flex items-center justify-between dark:border-neutral-800">
            <span className="text-sm font-semibold tracking-tight truncate max-w-[110px]">
              {userEmail || "账户"}
            </span>
            <button 
              onClick={() => setShowSignOutConfirm(true)} 
              className="flex items-center space-x-1 text-xs text-neutral-500 hover:text-red-500 transition-colors cursor-pointer shrink-0"
            >
              <LogOut size={14} className="mr-0.5" />
              <span>登出</span>
            </button>
          </div>
 
          {/* Links */}
          <div className="p-3">
            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-2 mb-2">
              我的简报
            </div>
            <nav className="space-y-1">
              {briefs.map((brief) => {
                const isActive = params.briefId === brief.id;
                return (
                  <Link
                    key={brief.id}
                    href={`/dashboard/${brief.id}`}
                    className={`flex items-center px-3 py-2 rounded-lg text-sm transition-all ${
                      isActive
                        ? "bg-black text-white dark:bg-white dark:text-black font-medium"
                        : "hover:bg-gray-200/80 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <FileText size={16} className="mr-2 shrink-0" />
                    <span className="truncate">{brief.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
 
        {/* Footer actions */}
        <div className="p-3 border-t border-gray-200/80 dark:border-neutral-800">
          <button
            onClick={handleAddBrief}
            className="w-full flex items-center justify-center px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-neutral-600 hover:text-black hover:border-black transition-colors dark:border-neutral-700 dark:text-neutral-400 dark:hover:text-white dark:hover:border-white cursor-pointer"
          >
            <Plus size={16} className="mr-1" />
            新建简报
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 overflow-hidden">{children}</main>

      {/* Sign Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#161618] border border-gray-200 dark:border-neutral-800 rounded-2xl max-w-sm w-full shadow-2xl p-6 transform animate-scale-in">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-355 rounded-xl">
                <LogOut size={20} />
              </div>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                确认退出登录？
              </h3>
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6 leading-relaxed">
              退出登录后，您将需要重新验证凭证以继续使用该系统。
            </p>
            <div className="flex items-center justify-end space-x-2.5">
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="px-4 py-2 border border-gray-200 dark:border-neutral-850 text-sm font-medium rounded-xl text-neutral-600 hover:bg-neutral-50 hover:text-black dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition-all cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-black hover:bg-neutral-850 dark:bg-white dark:text-black dark:hover:bg-neutral-100 text-sm font-medium rounded-xl text-white transition-all cursor-pointer shadow-sm shadow-neutral-950/5"
              >
                确认登出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
