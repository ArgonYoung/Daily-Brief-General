"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to log in");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to server");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-4 dark:bg-[#0d0d0d]">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 border border-gray-200/85 shadow-sm dark:bg-[#1c1c1e] dark:border-neutral-800">
        <h2 className="text-2xl font-semibold tracking-tight text-black dark:text-white mb-6 text-center">登录</h2>
        {error && <p className="mb-4 text-xs text-red-500 text-center">{error}</p>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">电子邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-[#f5f5f7] focus:outline-none focus:ring-1 focus:ring-black dark:bg-[#2c2c2e] dark:border-neutral-700 dark:focus:ring-white dark:text-white"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">密码</label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-200 pl-3 pr-10 py-2 text-sm bg-[#f5f5f7] focus:outline-none focus:ring-1 focus:ring-black dark:bg-[#2c2c2e] dark:border-neutral-700 dark:focus:ring-white dark:text-white"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-neutral-400 hover:text-black dark:hover:text-white cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-black py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition-colors dark:bg-white dark:text-black dark:hover:bg-neutral-200 cursor-pointer"
          >
            登录
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-neutral-500">
          没有账户？{" "}
          <span 
            onClick={() => router.push("/signup")}
            className="text-black hover:underline cursor-pointer dark:text-white font-medium"
          >
            注册
          </span>
        </p>
      </div>
    </div>
  );
}
