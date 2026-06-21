# 模块重构与无畏契约商店模块实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构现有官方模块（天气、每日一句）以符合独立 JS 模块范式，并在数据库种子中新增“无畏契约每日商店”模块，完成本地数据库播种与编译验证。

**Architecture:** 我们直接更新 `prisma/seed.ts` 种子脚本，将天气与每日一句模块的 `code` 改为 ES 模块闭环代码（包含名称、描述与配置规范），并新增国服无畏契约商店模块（使用 `sdk.fetch` 抓取掌盟 API + `sdk.llm.complete` 总结评价）。最后在本地与服务端执行数据播种（seed）。

**Tech Stack:** Next.js 16, Prisma, TypeScript, SQLite, QuickJS-emscripten

---

### Task 1: 更新数据库种子脚本 `prisma/seed.ts`

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: 修改 天气模块 种子数据**
  在 `prisma/seed.ts` 中，更新 `weather-module-id` 的 `code` 字符串，使其符合 `export default { name, description, configSchema, async run() }` 闭环范式。同时确保 `configSchema` 采用扁平 Key-Value 格式与前端完全兼容。

- [ ] **Step 2: 修改 每日一句模块 种子数据**
  在 `prisma/seed.ts` 中，更新 `quote-module-id` 的 `code` 字符串，使其符合闭环范式。

- [ ] **Step 3: 新增 无畏契约每日商店模块 种子数据**
  在 `prisma/seed.ts` 中，加入 `val-shop-module-id` 的数据插入逻辑：
  * **Id**: `"val-shop-module-id"`
  * **名称**: `"无畏契约每日商店"`
  * **描述**: `"获取国服无畏契约每日商店的皮肤列表，并生成 AI 购买建议和性价比评估。"`
  * **configSchema**:
    ```json
    {
      "userId": {
        "type": "string",
        "label": "掌盟/掌瓦 userId",
        "placeholder": "请输入抓包获取的 userId"
      },
      "tid": {
        "type": "secret",
        "label": "掌盟/掌瓦 tid",
        "placeholder": "请输入抓包获取的 tid"
      }
    }
    ```
  * **code**: (完整的 Valorant 模块 JS 代码字符串)

- [ ] **Step 4: 编译验证种子脚本**
  执行 `npx tsc --noEmit` 确保没有 TypeScript 语法报错。

---

### Task 2: 执行数据库种子播种与验证

**Files:**
- Test: Local database seeding

- [ ] **Step 1: 清空旧模块映射以避免外键冲突（如有）**
  运行数据库清空种子：
  Run: `npx prisma db seed`
  Expected: 输出 `Seeding completed successfully!` 且无报错。

- [ ] **Step 2: 重新执行生产编译验证**
  运行: `npm run build`
  Expected: Next.js 编译成功，无类型报错。

- [ ] **Step 3: 提交并推送到 GitHub 仓库**
  ```bash
  git add prisma/seed.ts
  git commit -m "feat: refactor weather and quotes modules to new paradigm and add valorant store module"
  git push origin main
  ```
