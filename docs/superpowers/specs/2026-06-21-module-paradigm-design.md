# 统一简报模块范式与国服无畏契约商店模块设计规范

为了提高系统的可扩展性，并建立一个开发者友好的生态，我们定义了一套统一的简报模块开发与导入规范。其他开发者可以遵循这套规范开发自定义模块并一键导入本系统。

---

## 1. 模块标准开发接口规范 (Module Paradigm)

每个简报模块必须是一个标准的 JavaScript ES 模块文件，它默认导出一个包含元数据和执行逻辑的对象。

### 1.1 模块结构定义
```javascript
export default {
  // 1. 模块元数据 (由系统导入时自动解析提取并持久化到数据库 Module 表字段中)
  name: "模块名称 (中文)",
  description: "模块功能描述",
  
  // 2. 模块可配置输入项 (遵循标准 JSON Schema，支持 select, string 等控件类型)
  configSchema: {
    type: "object",
    properties: {
      parameterName: {
        type: "string", // 或 "select"
        title: "配置项名称",
        placeholder: "占位提示符",
        default: "默认值",
        options: [ // 当 type 为 select 时适用
          { "value": "opt1", "label": "选项一" }
        ]
      }
    },
    required: ["parameterName"]
  },

  // 3. 核心执行逻辑
  async run({ inputs, sdk }) {
    // 逻辑实现
    // inputs: 包含用户在后台配置 of values
    // sdk: 包含 sdk.fetch(url, options) 和 sdk.llm.complete(prompt)
    return "返回排版好的 Markdown 格式内容";
  }
};
```

### 1.2 自动导入解析机制
当开发者在系统后台上传/导入模块的 JS 代码文件时，后端通过沙箱执行或 AST 解析提取该 JS 代码中的 `name`、`description` 和 `configSchema` 字段，并同步存入 `Module` 数据库的对应列。
* **优点**：开发者只需维护一个 JS 文件；而系统后台无需让用户手动再次填写标题和配置表单，实现“一键导入，即刻配置”。

---

## 2. 国服无畏契约商店模块实现

该模块通过抓包掌上无畏契约 App 的接口，使用用户的 `userId` 和 `tid` 凭证获取每日商店商品，并调用系统大模型给出幽默犀利的性价比点评。

### 2.1 无畏契约商店 API 信息
* **API 接口**: `https://app.mval.qq.com/go/mlol_store/agame/user_store`
* **请求方式**: `POST`
* **重要请求头**:
  * `GH-HEADER`: `1-2-105-160-0` (固定的游戏平台头)
  * `Cookie`: 包含必要的授权字段，特别是用户提供的 `userId` 和 `tid`。
* **返回数据格式**: `data.list` 数组，每个商品包含 `goods_name` (皮肤名)、`rmb_price` (点券价格，如 1290)、`goods_pic` (图片 URL)。

### 2.2 模块代码实现
```javascript
export default {
  name: "无畏契约每日商店",
  description: "获取国服无畏契约每日商店的皮肤列表，并生成 AI 购买建议和性价比评估。",
  configSchema: {
    type: "object",
    properties: {
      userId: {
        type: "string",
        title: "掌盟/掌瓦 userId",
        placeholder: "可通过抓包掌上无畏契约 App 获取"
      },
      tid: {
        type: "string",
        title: "掌盟/掌瓦 tid",
        placeholder: "可通过抓包掌上无畏契约 App 获取"
      }
    },
    required: ["userId", "tid"]
  },
  
  async run({ inputs, sdk }) {
    const { userId, tid } = inputs;
    if (!userId || !tid) {
      return "⚠️ 缺少 userId 或 tid，请在模块设置中配置。";
    }
    
    const url = "https://app.mval.qq.com/go/mlol_store/agame/user_store";
    const timestamp = Math.floor(Date.now() / 1000);
    
    const cookie = `clientType=9; uin=o105940478; appid=102061775; acctype=qc; openid=03A18A61C761D3C44890E2992BB868CE; access_token=551176E5981C1F5422A08C227D193827; userId=${userId}; accountType=5; tid=${tid}`;
    
    const headers = {
      "Accept": "*/*",
      "Upload-Draft-Interop-Version": "5",
      "Accept-Language": "zh-CN,zh;q=0.9",
      "Content-Type": "application/json",
      "User-Agent": "mval/2.3.0.10050 Channel/5 Manufacturer/Xiaomi Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36",
      "GH-HEADER": "1-2-105-160-0",
      "Cookie": cookie
    };
    
    try {
      const res = await sdk.fetch(url, {
        method: "POST",
        headers: JSON.stringify(headers),
        body: JSON.stringify({ _t: timestamp })
      });
      
      if (!res.ok) {
        return "❌ 请求无畏契约商店接口失败，请检查网络或配置。";
      }
      
      const responseData = await res.json();
      if (responseData.result !== 0) {
        return "❌ 获取商店数据失败：" + (responseData.errMsg || responseData.msg || "未知错误");
      }
      
      let storeData = responseData.data;
      if (Array.isArray(storeData)) {
        storeData = storeData[0] || {};
      }
      
      const goodsList = storeData.list || [];
      if (goodsList.length === 0) {
        return "🔫 今天您的无畏契约商店里没有刷出任何商品。";
      }
      
      // 1. 构造 Markdown 格式排版 (由模块控制)
      let content = "#### 🔫 无畏契约每日商店\n\n";
      const itemsInfo = [];
      
      goodsList.forEach((goods, index) => {
        const name = goods.goods_name || "未知皮肤";
        const price = goods.rmb_price || "0";
        const pic = goods.goods_pic || "";
        content += (index + 1) + ". **" + name + "** (" + price + " VP)\n";
        if (pic) {
          content += "   ![" + name + "](" + pic + ")\n";
        }
        itemsInfo.push(name + " (价格: " + price + " VP)");
      });
      
      // 2. 调用系统大模型加工购买建议 (输入纯文本参数，规避多模态依赖)
      const prompt = "你是一个专业的老练射击游戏玩家，对无畏契约（VALORANT）中的各种武器皮肤极其熟悉。\n" +
        "今天商店里刷出了以下这几款武器皮肤，请给出购买建议与性价比评估（例如哪些是神仙皮肤值得买，哪些是垃圾不要买）：\n" +
        itemsInfo.join("\n") + "\n" +
        "要求：语气幽默生动，专业犀利，总字数控制在150字以内，直接输出段落内容，不要有任何多余的引言或代码框。";
        
      const aiReview = await sdk.llm.complete(prompt);
      content += "\n**🤖 AI 每日皮肤测评：**\n> " + aiReview;
      
      return content;
    } catch (err) {
      return "❌ 获取商店数据发生异常：" + err.message;
    }
  }
};
```

---

## 3. 官方模块迁移重构

我们将原有的 **天气** 与 **每日一句 (名言)** 模块同步升级为上述的独立闭环规范。

### 3.1 天气模块 (`weather-module-id`)
```javascript
export default {
  name: "天气",
  description: "获取指定城市的实时天气 data 并利用 AI 总结为晨间天气播报。",
  configSchema: {
    type: "object",
    properties: {
      city: {
        type: "string",
        title: "城市名称",
        placeholder: "输入城市名（如：北京、上海）",
        default: "北京"
      },
      unit: {
        type: "select",
        title: "温度单位",
        default: "C",
        options: [
          { "value": "C", "label": "摄氏度 (°C)" },
          { "value": "F", "label": "华氏度 (°F)" }
        ]
      }
    },
    required: ["city"]
  },
  
  async run({ inputs, sdk }) {
    const city = inputs.city || "北京";
    const unit = inputs.unit || "C";
    
    try {
      const res = await sdk.fetch("https://wttr.in/" + encodeURIComponent(city) + "?format=j1");
      if (!res.ok) {
        return "⚠️ 无法获取 " + city + " 的天气数据。";
      }
      
      const data = await res.json();
      const current = data.current_condition[0];
      const temp = unit === "C" ? current.temp_C : current.temp_F;
      const weatherDesc = current.weatherDesc[0].value;
      const humidity = current.humidity;
      const windSpeed = current.windspeedKmph;
      
      const weatherReport = "城市: " + city + "\n温度: " + temp + "°" + unit + "\n天气状况: " + weatherDesc + "\n湿度: " + humidity + "%\n风速: " + windSpeed + " km/h";
      
      const prompt = "请根据以下详细天气信息，整理总结成一段自然、简短的晨间天气广播内容。\n" +
        "要求：输出字数在80字以内，直接输出总结内容本身，不要带有多余说明，也绝不要带任何 Markdown 标题、粗体标记或代码框。\n" +
        "数据参考：\n" + weatherReport;
        
      const summary = await sdk.llm.complete(prompt);
      return summary;
    } catch (err) {
      return "⚠️ 获取天气 data 发生异常：" + err.message;
    }
  }
};
```

### 3.2 每日一句模块 (`quote-module-id`)
```javascript
export default {
  name: "每日一句",
  description: "从 Hitokoto 接口实时获取一句励志名言、文学金句等。",
  configSchema: {
    type: "object",
    properties: {
      category: {
        type: "select",
        title: "句子类别",
        default: "g",
        options: [
          { "value": "g", "label": "哲学 / 经典金句" },
          { "value": "d", "label": "文学 / 经典名句" },
          { "value": "h", "label": "影视 / 经典台词" },
          { "value": "i", "label": "诗词 / 古代名句" },
          { "value": "j", "label": "网易云 / 扎心热评" },
          { "value": "e", "label": "原创 / 现代随笔" }
        ]
      }
    },
    required: ["category"]
  },
  
  async run({ inputs, sdk }) {
    const category = inputs.category || "g";
    
    try {
      const res = await sdk.fetch("https://v1.hitokoto.cn/?c=" + encodeURIComponent(category));
      if (!res.ok) {
        return "“生活就像海洋，只有意志坚强的人，才能到达彼岸。”";
      }
      
      const data = await res.json();
      const quote = data.hitokoto;
      const source = data.from;
      const author = data.from_who;
      
      const ref = author ? author + " · 《" + source + "》" : "《" + source + "》";
      return "”" + quote + "“ — — " + ref;
    } catch (err) {
      return "“生活就像海洋，只有意志坚强的人，才能到达彼岸。”";
    }
  }
};
```
