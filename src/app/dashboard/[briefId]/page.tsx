"use client";
import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Play, Save, ChevronDown, ChevronUp, Trash2, ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";

// TimeRoller removed in favor of clean dropdown selection

interface CityAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
}

function CityAutocomplete({ value, onChange }: CityAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const fetchSuggestions = async (q: string) => {
    if (!q) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/cities?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
      }
    } catch (e) {
      console.error("Failed to fetch suggestions:", e);
    }
  };

  const handleChange = (val: string) => {
    setInputValue(val);
    onChange(val);
    fetchSuggestions(val);
    setShowSuggestions(true);
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          if (inputValue) {
            fetchSuggestions(inputValue);
            setShowSuggestions(true);
          }
        }}
        onBlur={() => {
          // Delay to allow suggestion click
          setTimeout(() => setShowSuggestions(false), 200);
        }}
        placeholder="搜索城市（例如：北京、上海、Tokyo）"
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-[#f5f5f7] focus:outline-none dark:bg-[#2c2c2e] dark:border-neutral-700"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-50 dark:bg-[#1c1c1e] dark:border-neutral-800">
          {suggestions.map((city: any) => (
            <div
              key={city.id}
              onClick={() => {
                handleChange(city.name);
                setSuggestions([]);
                setShowSuggestions(false);
              }}
              className="px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer flex justify-between"
            >
              <span className="font-medium text-black dark:text-white">{city.name}</span>
              <span className="text-xs text-neutral-400">{city.country}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ModuleConfig {
  id: string;
  moduleId: string;
  name: string;
  description: string;
  configSchema: any;
  values: Record<string, any>;
  isOpen: boolean;
}

export default function BriefEditorPage(props: { params: Promise<{ briefId: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const [briefName, setBriefName] = useState("");
  const [cronExpression, setCronExpression] = useState("0 7 * * *");
  const [timezone, setTimezone] = useState("Asia/Shanghai");
  const [notionPageId, setNotionPageId] = useState("");
  const [notionToken, setNotionToken] = useState("");
  const [showNotionToken, setShowNotionToken] = useState(false);
  const [llmBaseUrl, setLlmBaseUrl] = useState("https://api.deepseek.com");
  const [llmModelName, setLlmModelName] = useState("deepseek-v4-flash");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [showLlmApiKey, setShowLlmApiKey] = useState(false);
  const [userName, setUserName] = useState("");
  const [aiPersona, setAiPersona] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [activeModules, setActiveModules] = useState<ModuleConfig[]>([]);
  const [availableModules, setAvailableModules] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [userId, setUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showValHelp, setShowValHelp] = useState(false);

  // Helper to parse "0 7 * * *" into hour=7, minute=0
  const parseCron = (cron: string) => {
    const parts = cron.split(" ");
    if (parts.length >= 2) {
      const min = parseInt(parts[0], 10);
      const hr = parseInt(parts[1], 10);
      if (!isNaN(min) && !isNaN(hr)) {
        return { hour: hr, minute: min };
      }
    }
    return { hour: 7, minute: 0 };
  };

  const { hour, minute } = parseCron(cronExpression);

  const handleTimeChange = (type: "hour" | "minute", val: number) => {
    if (type === "hour") {
      setCronExpression(`${minute} ${val} * * *`);
    } else {
      setCronExpression(`${val} ${hour} * * *`);
    }
  };

  useEffect(() => {
    fetchData();
  }, [params.briefId]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/briefs/${params.briefId}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setBriefName(data.brief.name);
        setCronExpression(data.brief.cronExpression);
        setTimezone(data.brief.timezone);
        setNotionPageId(data.brief.notionPageId);
        setNotionToken(data.brief.notionTokenEncrypted);
        setIsEnabled(data.brief.isEnabled);
        setUserId(data.brief.userId);
        setLogs(data.brief.logs || []);
        setAvailableModules(data.availableModules || []);
        setLlmBaseUrl(data.brief.llmBaseUrl || "https://api.deepseek.com");
        setLlmModelName(data.brief.llmModelName || "deepseek-v4-flash");
        setLlmApiKey(data.brief.llmApiKeyEncrypted || "");
        setUserName(data.brief.userName || "");
        setAiPersona(data.brief.aiPersona || "");
        setEmailEnabled(data.brief.emailEnabled ?? false);

        const formatted = (data.brief.mappings || [])
          .filter((m: any) => m && m.module)
          .map((m: any) => ({
            id: m.id,
            moduleId: m.moduleId,
            name: m.module.name,
            description: m.module.description,
            configSchema: m.module.configSchema,
            values: m.userModuleConfig?.values || {},
            isOpen: false,
          }));
        setActiveModules(formatted);
      }
    } catch (e) {
      console.error("Failed to load brief data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleOpen = (index: number) => {
    setActiveModules(
      activeModules.map((m, idx) => (idx === index ? { ...m, isOpen: !m.isOpen } : m))
    );
  };

  const handleUpdateValue = (moduleIndex: number, key: string, value: any) => {
    setActiveModules(
      activeModules.map((m, idx) => {
        if (idx === moduleIndex) {
          return {
            ...m,
            values: { ...m.values, [key]: value },
          };
        }
        return m;
      })
    );
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const updated = [...activeModules];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= updated.length) return;

    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setActiveModules(updated);
  };

  const handleDeleteModule = (index: number) => {
    setActiveModules(activeModules.filter((_, idx) => idx !== index));
  };

  const handleAddModule = (moduleId: string) => {
    const mod = availableModules.find(m => m.id === moduleId);
    if (!mod) return;
    setActiveModules([
      ...activeModules,
      {
        id: `temp-${Date.now()}`,
        moduleId: mod.id,
        name: mod.name,
        description: mod.description,
        configSchema: mod.configSchema || {},
        values: {},
        isOpen: true,
      }
    ]);
  };

  const handleDeleteBrief = async () => {
    try {
      const res = await fetch(`/api/briefs/${params.briefId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("brief-updated"));
        router.push("/dashboard");
      } else {
        const data = await res.json();
        setSaveError(data.error || "删除失败");
      }
    } catch (err) {
      console.error("Failed to delete brief:", err);
      setSaveError("网络错误，删除失败");
    }
  };

  const handleSave = async (): Promise<boolean> => {
    try {
      setIsSaving(true);
      setSaveError(null);
      const res = await fetch(`/api/briefs/${params.briefId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: briefName,
          cronExpression,
          timezone,
          notionPageId,
          notionTokenEncrypted: notionToken,
          isEnabled,
          userId,
          llmBaseUrl,
          llmModelName,
          llmApiKeyEncrypted: llmApiKey,
          userName,
          aiPersona,
          emailEnabled,
          mappings: activeModules.map(m => ({
            moduleId: m.moduleId,
            values: m.values,
          })),
        }),
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("brief-updated"));
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        return true;
      } else {
        const err = await res.json().catch(() => ({ error: "保存失败，请重试" }));
        setSaveError(err.error || "保存失败，请重试");
        return false;
      }
    } catch (e: any) {
      setSaveError("网络错误，无法保存");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunNow = async () => {
    try {
      setIsRunning(true);
      const saved = await handleSave();
      if (!saved) return; // Abort run if save failed

      const res = await fetch(`/api/worker/generate-brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefScheduleId: params.briefId }),
      });
      if (res.ok) {
        // Only refresh logs, not the full state (to preserve any pending local edits)
        const logRes = await fetch(`/api/briefs/${params.briefId}`, { cache: "no-store" });
        if (logRes.ok) {
          const data = await logRes.json();
          setLogs(data.brief?.logs || []);
        }
      }
    } catch (e) {
      console.error("Failed to execute brief:", e);
    } finally {
      setIsRunning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 bg-white dark:bg-[#0d0d0d] h-full overflow-y-auto">
        <div className="h-8 w-48 bg-gray-200 dark:bg-neutral-800 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-white text-black h-full overflow-y-auto dark:bg-[#0d0d0d] dark:text-white">
      {/* Top Actions */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4 dark:border-neutral-800">
        <input
          value={briefName}
          onChange={(e) => setBriefName(e.target.value)}
          className="text-2xl font-semibold tracking-tight bg-transparent focus:outline-none focus:border-b border-black dark:focus:border-white"
        />
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center px-4 py-2 border border-red-200 text-red-500 rounded-lg text-sm hover:bg-red-50 dark:border-red-950 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
          >
            <Trash2 size={16} className="mr-1.5" />
            删除简报
          </button>

          <button
            onClick={handleRunNow}
            disabled={isRunning}
            className="flex items-center px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-100 transition-colors dark:border-neutral-800 dark:hover:bg-neutral-850 cursor-pointer disabled:opacity-50"
          >
            <Play size={16} className="mr-1.5" />
            {isRunning ? "运行中..." : "立即运行"}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-neutral-850 transition-colors dark:bg-white dark:text-black dark:hover:bg-neutral-200 cursor-pointer disabled:opacity-50"
          >
            <Save size={16} className="mr-1.5" />
            {isSaving ? "保存中..." : "保存修改"}
          </button>
          {saveSuccess && (
            <span className="text-xs text-green-500 font-medium animate-fade-in">✓ 已保存</span>
          )}
          {saveError && (
            <span className="text-xs text-red-500 font-medium">{saveError}</span>
          )}
        </div>
      </div>

      {/* Schedule Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">日程与运行设置</h3>
        <div className="p-5 bg-[#f5f5f7] rounded-2xl border border-gray-200/80 space-y-4 dark:bg-[#161618] dark:border-neutral-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-xs text-neutral-500 mb-2 font-medium">每日触发时间</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsTimePickerOpen(!isTimePickerOpen)}
                  className="flex items-center justify-between w-full md:w-48 px-4 py-2.5 bg-white border border-gray-200/80 rounded-xl text-sm font-semibold text-black hover:bg-neutral-50 dark:bg-[#1c1c1e] dark:border-neutral-800 dark:text-white dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <span>{String(hour).padStart(2, "0")} : {String(minute).padStart(2, "0")}</span>
                  <ChevronDown size={16} className="text-neutral-400" />
                </button>
                
                {isTimePickerOpen && (
                  <>
                    {/* Backdrop to close click outside */}
                    <div className="fixed inset-0 z-40" onClick={() => setIsTimePickerOpen(false)} />
                    
                    <div className="absolute left-0 mt-2 p-4 bg-white border border-gray-200 rounded-2xl shadow-xl dark:bg-[#1c1c1e] dark:border-neutral-800 z-50 flex items-center space-x-3 w-[180px]">
                      {/* Hour Select */}
                      <div className="flex-1 flex flex-col">
                        <span className="text-[10px] text-neutral-400 font-semibold mb-1 text-center">时</span>
                        <select
                          value={hour}
                          onChange={(e) => {
                            handleTimeChange("hour", parseInt(e.target.value, 10));
                          }}
                          className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white dark:bg-[#2c2c2e] dark:border-neutral-700 focus:outline-none cursor-pointer text-center"
                        >
                          {Array.from({ length: 24 }).map((_, i) => (
                            <option key={i} value={i}>{String(i).padStart(2, "0")}</option>
                          ))}
                        </select>
                      </div>
                      
                      <span className="text-lg font-bold text-neutral-300 dark:text-neutral-700 mt-4">:</span>
                      
                      {/* Minute Select */}
                      <div className="flex-1 flex flex-col">
                        <span className="text-[10px] text-neutral-400 font-semibold mb-1 text-center">分</span>
                        <select
                          value={minute}
                          onChange={(e) => {
                            handleTimeChange("minute", parseInt(e.target.value, 10));
                          }}
                          className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white dark:bg-[#2c2c2e] dark:border-neutral-700 focus:outline-none cursor-pointer text-center"
                        >
                          {Array.from({ length: 60 }).map((_, i) => (
                            <option key={i} value={i}>{String(i).padStart(2, "0")}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex-1">
              <label className="block text-xs text-neutral-500 mb-2 font-medium">时区</label>
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="w-full rounded-xl border border-gray-200/80 px-4 py-2.5 text-sm bg-white dark:bg-[#1c1c1e] dark:border-neutral-800 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="Asia/Shanghai">Asia/Shanghai (北京时间)</option>
                <option value="Asia/Hong_Kong">Asia/Hong_Kong (香港时间)</option>
                <option value="Asia/Singapore">Asia/Singapore (新加坡时间)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (东京时间)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (印度标准时间)</option>
                <option value="Europe/London">Europe/London (伦敦时间)</option>
                <option value="Europe/Paris">Europe/Paris (巴黎时间)</option>
                <option value="Europe/Berlin">Europe/Berlin (柏林时间)</option>
                <option value="America/New_York">America/New_York (纽约时间)</option>
                <option value="America/Chicago">America/Chicago (中部时间)</option>
                <option value="America/Denver">America/Denver (山地时间)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (太平洋时间)</option>
                <option value="Pacific/Auckland">Pacific/Auckland (奥克兰时间)</option>
                <option value="UTC">UTC (协调世界时)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
 
      {/* LLM Configuration */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">大语言模型配置</h3>
        <div className="p-5 bg-[#f5f5f7] rounded-2xl border border-gray-200/80 space-y-4 dark:bg-[#161618] dark:border-neutral-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5 font-medium">接口 Base URL</label>
              <input
                placeholder="https://api.deepseek.com"
                value={llmBaseUrl}
                onChange={e => setLlmBaseUrl(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white dark:bg-[#2c2c2e] dark:border-neutral-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5 font-medium">模型名称 (Model)</label>
              <input
                placeholder="deepseek-v4-flash"
                value={llmModelName}
                onChange={e => setLlmModelName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white dark:bg-[#2c2c2e] dark:border-neutral-700 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5 font-medium">API 密钥 (API Key)</label>
            <div className="relative flex items-center">
              <input
                type={showLlmApiKey ? "text" : "password"}
                placeholder="请输入 API Key"
                value={llmApiKey}
                onChange={e => setLlmApiKey(e.target.value)}
                className="w-full rounded-lg border border-gray-200 pl-3 pr-10 py-2 text-sm bg-white dark:bg-[#2c2c2e] dark:border-neutral-700 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowLlmApiKey(!showLlmApiKey)}
                className="absolute right-3 text-neutral-400 hover:text-black dark:hover:text-white cursor-pointer"
              >
                {showLlmApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 简报个性化 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">简报个性化</h3>
        <div className="p-5 bg-[#f5f5f7] rounded-2xl border border-gray-200/80 space-y-4 dark:bg-[#161618] dark:border-neutral-800">
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5 font-medium">显示名称</label>
            <input
              placeholder="请输入您希望被称呼的名字"
              value={userName}
              onChange={e => setUserName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white dark:bg-[#2c2c2e] dark:border-neutral-700 focus:outline-none"
            />
            <p className="mt-1 text-xs text-neutral-400">用于替换简报开头问候中的名称，留空则使用邮箱前缀。</p>
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5 font-medium">AI 助手风格</label>
            <textarea
              placeholder="描述末尾建议语的语气，例如：以 Jarvis 风格、简洁专业。留空则使用默认温馨风格。"
              value={aiPersona}
              onChange={e => setAiPersona(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white dark:bg-[#2c2c2e] dark:border-neutral-700 focus:outline-none resize-none"
            />
          </div>
        </div>
      </div>

      {/* Notion Integration */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">Notion 集成配置</h3>
        <div className="p-5 bg-[#f5f5f7] rounded-2xl border border-gray-200/80 space-y-4 dark:bg-[#161618] dark:border-neutral-800">
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5 font-medium">父页面 / 数据库 ID</label>
              <input
                placeholder="请输入 Notion 页面或数据库 ID"
                value={notionPageId}
                onChange={e => setNotionPageId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white dark:bg-[#2c2c2e] dark:border-neutral-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5 font-medium">集成密钥 (Token)</label>
              <div className="relative flex items-center">
                <input
                  type={showNotionToken ? "text" : "password"}
                  placeholder="请输入 Notion 集成 Token"
                  value={notionToken}
                  onChange={e => setNotionToken(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 pl-3 pr-10 py-2 text-sm bg-white dark:bg-[#2c2c2e] dark:border-neutral-700 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowNotionToken(!showNotionToken)}
                  className="absolute right-3 text-neutral-400 hover:text-black dark:hover:text-white cursor-pointer"
                >
                  {showNotionToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 通知设置 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">通知设置</h3>
        <div className="p-5 bg-[#f5f5f7] rounded-2xl border border-gray-200/80 dark:bg-[#161618] dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">邮件通知</p>
              <p className="text-xs text-neutral-400 mt-0.5">
                简报生成后将自动发送邮件通知至您的账户绑定邮箱。
              </p>
            </div>
            {/* Toggle switch */}
            <button
              type="button"
              onClick={() => setEmailEnabled(!emailEnabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                emailEnabled ? "bg-black dark:bg-white" : "bg-neutral-300 dark:bg-neutral-600"
              }`}
              aria-pressed={emailEnabled}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-black shadow ring-0 transition duration-200 ease-in-out ${
                  emailEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Widget Module Stack */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-tight">简报内容模块</h3>
          <select
            onChange={(e) => {
              if (e.target.value) {
                handleAddModule(e.target.value);
                e.target.value = "";
              }
            }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-[#f5f5f7] dark:bg-[#161618] dark:border-neutral-800 focus:outline-none cursor-pointer"
          >
            <option value="">+ 添加内容模块</option>
            {availableModules.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2.5">
          {activeModules.map((mod, index) => (
            <div
              key={mod.id}
              className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm space-y-4 dark:bg-[#161618] dark:border-neutral-800"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex flex-col space-y-1">
                    <button 
                      onClick={() => handleMove(index, "up")} 
                      disabled={index === 0} 
                      className="text-neutral-400 hover:text-black disabled:opacity-30 dark:hover:text-white cursor-pointer"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button 
                      onClick={() => handleMove(index, "down")} 
                      disabled={index === activeModules.length - 1} 
                      className="text-neutral-400 hover:text-black disabled:opacity-30 dark:hover:text-white cursor-pointer"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">{mod.name}</h4>
                    <p className="text-xs text-neutral-400">{mod.description}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => handleDeleteModule(index)} 
                    className="text-neutral-400 hover:text-red-500 transition-colors cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleToggleOpen(index)} 
                    className="text-neutral-400 hover:text-black dark:hover:text-white cursor-pointer"
                  >
                    {mod.isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>

              {/* Collapsible Config Fields Form */}
              {mod.isOpen && (
                <div className="pt-4 border-t border-gray-100 dark:border-neutral-700 space-y-3">
                  {Object.entries(mod.configSchema || {}).map(([key, schemaVal]: [string, any]) => (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-neutral-500">{schemaVal.label || key}</label>
                        {key === "userId" && (
                          <button
                            type="button"
                            onClick={() => setShowValHelp(true)}
                            className="text-[10px] text-neutral-400 hover:text-black dark:hover:text-white underline cursor-pointer"
                          >
                            如何获取？
                          </button>
                        )}
                      </div>
                      {schemaVal.type === "boolean" ? (
                        <input
                          type="checkbox"
                          checked={!!mod.values[key]}
                          onChange={(e) => handleUpdateValue(index, key, e.target.checked)}
                          className="rounded border-gray-300 bg-white"
                        />
                      ) : schemaVal.type === "select" ? (
                        <select
                          value={mod.values[key] || schemaVal.default || ""}
                          onChange={(e) => handleUpdateValue(index, key, e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-[#f5f5f7] focus:outline-none dark:bg-[#2c2c2e] dark:border-neutral-700 cursor-pointer"
                        >
                          {(schemaVal.options || []).map((opt: any) => {
                            const val = typeof opt === "string" ? opt : opt.value;
                            const lbl = typeof opt === "string" ? opt : opt.label;
                            return (
                              <option key={val} value={val}>
                                {lbl}
                              </option>
                            );
                          })}
                        </select>
                      ) : key === "city" ? (
                        <CityAutocomplete
                          value={mod.values[key] || ""}
                          onChange={(val) => handleUpdateValue(index, key, val)}
                        />
                      ) : key === "prompt" || schemaVal.multiline ? (
                        <textarea
                          value={mod.values[key] || ""}
                          onChange={(e) => handleUpdateValue(index, key, e.target.value)}
                          rows={3}
                          placeholder={schemaVal.placeholder || `请输入${schemaVal.label || key}...`}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-[#f5f5f7] focus:outline-none dark:bg-[#2c2c2e] dark:border-neutral-700 resize-none"
                        />
                      ) : (
                        <input
                          type={schemaVal.type === "secret" ? "password" : "text"}
                          value={mod.values[key] || ""}
                          onChange={(e) => handleUpdateValue(index, key, e.target.value)}
                          placeholder={schemaVal.placeholder || `请输入${schemaVal.label || key}...`}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-[#f5f5f7] focus:outline-none dark:bg-[#2c2c2e] dark:border-neutral-700"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {activeModules.length === 0 && (
            <div className="p-8 border border-dashed border-gray-200 rounded-xl text-center text-xs text-neutral-400 dark:border-neutral-800">
              此简报暂未添加内容模块。
            </div>
          )}
        </div>
      </div>

      {/* History logs */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">运行历史记录</h3>
        <div className="rounded-xl border border-gray-200/80 overflow-hidden dark:border-neutral-800 bg-[#f5f5f7] dark:bg-[#161618]">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase text-neutral-500 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#1c1c1e]">
              <tr>
                <th className="px-6 py-3">触发时间</th>
                <th className="px-6 py-3">状态</th>
                <th className="px-6 py-3">错误信息</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#161618]">
                  <td className="px-6 py-4">{new Date(log.triggeredAt).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      log.status === "SUCCESS" ? "bg-green-150 text-green-800" : "bg-red-150 text-red-800"
                    }`}>
                      {log.status === "SUCCESS" ? "成功" : "失败"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-red-500 truncate max-w-sm">{log.errorMessage || "-"}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr className="bg-white dark:bg-[#161618]">
                  <td colSpan={3} className="px-6 py-8 text-center text-neutral-400">暂无运行记录。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#161618] border border-gray-200 dark:border-neutral-800 rounded-2xl max-w-md w-full shadow-2xl p-6 transform animate-scale-in">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl">
                <Trash2 size={20} />
              </div>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                确认删除此简报？
              </h3>
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6 leading-relaxed">
              此操作将永久删除简报 <span className="font-semibold text-neutral-800 dark:text-white">“{briefName}”</span> 及其所有关联的配置，该操作不可恢复！
            </p>
            <div className="flex items-center justify-end space-x-2.5">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-200 dark:border-neutral-800 text-sm font-medium rounded-xl text-neutral-600 hover:bg-neutral-50 hover:text-black dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition-all cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleDeleteBrief}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-sm font-medium rounded-xl text-white transition-all cursor-pointer shadow-sm shadow-red-500/10"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Valorant Help Modal */}
      {showValHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#161618] border border-gray-200 dark:border-neutral-800 rounded-2xl max-w-md w-full shadow-2xl p-6 transform animate-scale-in">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-3">
              如何获取掌盟/掌瓦凭证 (userId & tid)？
            </h3>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 space-y-2.5 leading-relaxed">
              <p>由于掌上无畏契约没有开放官方 API，需要通过在手机端抓包来获取接口所需的登录凭证：</p>
              <ol className="list-decimal list-inside space-y-1.5 pl-1">
                <li>准备抓包工具：
                  <ul className="list-disc list-inside pl-4 text-neutral-400">
                    <li>iOS 用户推荐使用：<strong>Stream</strong> 或 <strong>HTTP Catcher</strong></li>
                    <li>Android 用户推荐使用：<strong>HttpCanary</strong></li>
                    <li>电脑用户可使用：<strong>Fiddler</strong> 或 <strong>Charles</strong></li>
                  </ul>
                </li>
                <li>开启抓包，然后打开手机上的 <strong>“掌上无畏契约”</strong> App，进行一次数据加载（如查看战绩或进入商店）。</li>
                <li>在抓包工具的请求历史中，搜索或筛选域名：<code className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-red-500 font-mono">app.mval.qq.com</code>。</li>
                <li>选中任意一个请求，查看其 <strong>Request Headers (请求头)</strong> 中的 <code className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded font-mono">Cookie</code> 字段。</li>
                <li>从 Cookie 中分别复制出 <code className="font-semibold text-neutral-700 dark:text-neutral-300 font-mono">userId=...</code> 和 <code className="font-semibold text-neutral-700 dark:text-neutral-300 font-mono">tid=...</code> 对应的值填入即可。</li>
              </ol>
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/50 rounded-xl text-amber-600 dark:text-amber-400 mt-3 text-[11px]">
                ⚠️ 提示：<code className="font-mono">tid</code> 为临时会话凭证，具有时效性。若简报未来运行历史中报错提示登录凭证失效，需重新抓包获取并更新 tid。
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowValHelp(false)}
                className="px-4 py-2 bg-neutral-900 hover:bg-black dark:bg-white dark:text-black dark:hover:bg-neutral-100 text-sm font-semibold rounded-xl text-white transition-all cursor-pointer"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
