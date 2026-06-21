"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Layout, ArrowRight, Settings, Database, Bell, CheckCircle2 } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const { user } = await res.json();
          if (user) {
            setIsAuthenticated(true);
            setUserEmail(user.email);
            return;
          }
        }
      } catch (e) {}
      setIsAuthenticated(false);
    }
    checkAuth();
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] font-sans dark:bg-[#000000] dark:text-[#f5f5f7] transition-colors duration-300">
      {/* 头部导航栏 */}
      <header className="sticky top-0 z-40 w-full border-b border-gray-200/80 bg-white/70 backdrop-blur-md dark:border-neutral-800/80 dark:bg-black/70">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2 font-semibold tracking-tight text-black dark:text-white">
            <Layout className="h-5 w-5 stroke-[2]" />
            <span>Argons 每日简报</span>
          </div>
          <nav className="flex items-center gap-6">
            {isAuthenticated ? (
              <div className="flex items-center gap-4">
                <span className="hidden text-xs text-neutral-500 md:inline-block dark:text-neutral-400">
                  {userEmail}
                </span>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="inline-flex h-8 items-center justify-center rounded-full bg-black px-4 text-xs font-medium text-white hover:bg-neutral-800 transition-all dark:bg-white dark:text-black dark:hover:bg-neutral-200 cursor-pointer"
                >
                  进入控制台
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push("/login")}
                  className="text-xs font-medium text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white cursor-pointer"
                >
                  登录
                </button>
                <button
                  onClick={() => router.push("/signup")}
                  className="inline-flex h-8 items-center justify-center rounded-full bg-black px-4 text-xs font-medium text-white hover:bg-neutral-800 transition-all dark:bg-white dark:text-black dark:hover:bg-neutral-200 cursor-pointer"
                >
                  开始使用
                </button>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* 英雄部分 */}
      <main className="mx-auto max-w-4xl px-6 py-20 text-center md:py-32">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 mb-8 animate-fade-in">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#34c759] stroke-[2.5]" />
          <span>本地开发环境已连接 (SQLite)</span>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl bg-gradient-to-b from-neutral-950 to-neutral-600 bg-clip-text text-transparent dark:from-white dark:to-neutral-400 mb-6 leading-[1.15]">
          结构化您的一天 <br />
          每日摘要直达 Notion
        </h1>
        
        <p className="mx-auto max-w-xl text-base text-neutral-500 sm:text-lg dark:text-neutral-400 mb-10 leading-relaxed">
          通过自由组合天气、每日金句等模块化部件，自定义您的日程简报。无缝同步至您的 Notion 数据库，或通过电子邮件接收。
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row mb-20">
          <button
            onClick={() => router.push(isAuthenticated ? "/dashboard" : "/login")}
            className="group inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-black px-8 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 transition-all dark:bg-white dark:text-black dark:hover:bg-neutral-200 cursor-pointer"
          >
            <span>配置您的每日简报</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
          {!isAuthenticated && (
            <button
              onClick={() => router.push("/signup")}
              className="inline-flex h-12 w-full sm:w-auto items-center justify-center rounded-full border border-gray-200 bg-white px-8 text-sm font-medium hover:bg-neutral-50 hover:border-gray-300 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900 transition-all cursor-pointer"
            >
              创建免费账户
            </button>
          )}
        </div>

        {/* 特性卡片 */}
        <div className="grid gap-6 md:grid-cols-3 text-left">
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-[#1c1c1e] hover:border-gray-300 dark:hover:border-neutral-700 transition-all">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f5f7] text-black dark:bg-[#2c2c2e] dark:text-white">
              <Settings className="h-5 w-5 stroke-[1.75]" />
            </div>
            <h3 className="text-lg font-semibold text-black dark:text-white mb-2">模块化组件堆栈</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
              自由配置并排列天气预报、每日名言等内容模块，打造专属于您的个性化晨间摘要。
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-[#1c1c1e] hover:border-gray-300 dark:hover:border-neutral-700 transition-all">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f5f7] text-black dark:bg-[#2c2c2e] dark:text-white">
              <Database className="h-5 w-5 stroke-[1.75]" />
            </div>
            <h3 className="text-lg font-semibold text-black dark:text-white mb-2">Notion 数据库同步</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
              仅需配置一次 Notion Token 和页面 ID。简报自动整理为原生 Notion 区块插入您的页面中。
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-[#1c1c1e] hover:border-gray-300 dark:hover:border-neutral-700 transition-all">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f5f7] text-black dark:bg-[#2c2c2e] dark:text-white">
              <Bell className="h-5 w-5 stroke-[1.75]" />
            </div>
            <h3 className="text-lg font-semibold text-black dark:text-white mb-2">即时电子邮件通知</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
              可开启邮件推送提醒，每日生成简报后第一时间将通知和直达链接发送到您的邮箱。
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200/80 bg-white py-8 text-center text-xs text-neutral-400 dark:border-neutral-800 dark:bg-black dark:text-neutral-500">
        <p>© {new Date().getFullYear()} Argons Daily Brief. 保留所有权利。</p>
      </footer>
    </div>
  );
}
