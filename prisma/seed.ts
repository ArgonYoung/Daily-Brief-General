import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Seeding database... Cleaning old modules first.");
  
  // Clean up any existing seeded modules
  await prisma.module.deleteMany({
    where: {
      id: {
        in: ["weather-module-id", "quote-module-id", "val-shop-module-id", "greetings-module-id"],
      },
    },
  }).catch((err: any) => console.log("Clean-up warning (can ignore):", err.message));

  console.log("Inserting 天气 (Weather) module...");
  await prisma.module.create({
    data: {
      id: "weather-module-id",
      name: "天气",
      description: "获取指定城市的实时天气数据并利用 AI 总结为晨间天气播报。",
      isOfficial: true,
      configSchema: {
        city: {
          type: "string",
          required: true,
          default: "北京",
          label: "城市名称",
          placeholder: "输入城市名（如：北京、上海）"
        },
        unit: {
          type: "select",
          required: true,
          default: "C",
          options: [
            { "value": "C", "label": "摄氏度 (°C)" },
            { "value": "F", "label": "华氏度 (°F)" }
          ],
          label: "温度单位"
        }
      },
      code: `export default {
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
      
      const weatherReport = "城市: " + city + "\\n温度: " + temp + "°" + unit + "\\n天气状况: " + weatherDesc + "\\n湿度: " + humidity + "%\\n风速: " + windSpeed + " km/h";
      
      const prompt = "请根据以下详细天气信息，整理总结成一段自然、简短的晨间天气广播内容。\\n" +
        "要求：输出字数在80字以内，直接输出总结内容本身，不要带有多余说明，也绝不要带任何 Markdown 标题、粗体标记或代码框。\\n" +
        "数据参考：\\n" + weatherReport;
        
      const summary = await sdk.llm.complete(prompt);
      return summary;
    } catch (err) {
      return "⚠️ 获取天气 data 发生异常：" + err.message;
    }
  }
};`
    }
  });

  console.log("Inserting 每日一句 (Daily Motivation) module...");
  await prisma.module.create({
    data: {
      id: "quote-module-id",
      name: "每日一句",
      description: "从 Hitokoto 接口实时获取一句励志名言、文学金句等。",
      isOfficial: true,
      configSchema: {
        category: {
          type: "select",
          required: true,
          default: "g",
          options: [
            { "value": "g", "label": "哲学 / 经典金句" },
            { "value": "d", "label": "文学 / 经典名句" },
            { "value": "h", "label": "影视 / 经典台词" },
            { "value": "i", "label": "诗词 / 古代名句" },
            { "value": "j", "label": "网易云 / 扎心热评" },
            { "value": "e", "label": "原创 / 现代随笔" }
          ],
          label: "句子类别"
        }
      },
      code: `export default {
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
};`
    }
  });

  console.log("Inserting 无畏契约每日商店 (Valorant Shop) module...");
  await prisma.module.create({
    data: {
      id: "val-shop-module-id",
      name: "无畏契约每日商店",
      description: "获取国服无畏契约每日商店的皮肤列表，并生成 AI 购买建议和性价比评估。",
      isOfficial: true,
      configSchema: {
        userId: {
          type: "string",
          label: "掌盟/掌瓦 userId",
          placeholder: "请输入抓包获取的 userId"
        },
        tid: {
          type: "secret",
          label: "掌盟/掌瓦 tid",
          placeholder: "请输入抓包获取的 tid"
        }
      },
      code: `export default {
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
    
    const cookie = \`clientType=9; uin=o105940478; appid=102061775; acctype=qc; openid=03A18A61C761D3C44890E2992BB868CE; access_token=551176E5981C1F5422A08C227D193827; userId=\${userId}; accountType=5; tid=\${tid}\`;
    
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
      let content = "#### 🔫 无畏契约每日商店\\n\\n";
      const itemsInfo = [];
      
      goodsList.forEach((goods, index) => {
        const name = goods.goods_name || "未知皮肤";
        const price = goods.rmb_price || "0";
        const pic = goods.goods_pic || "";
        content += (index + 1) + ". **" + name + "** (" + price + " VP)\\n";
        if (pic) {
          content += "   ![" + name + "](" + pic + ")\\n";
        }
        itemsInfo.push(name + " (价格: " + price + " VP)");
      });
      
      // 2. 调用系统大模型加工购买建议 (输入纯文本参数，规避多模态依赖)
      const prompt = "你是一个专业的老练射击游戏玩家，对无畏契约（VALORANT）中的各种武器皮肤极其熟悉。\\n" +
        "今天商店里刷出了以下这几款武器皮肤，请给出购买建议与性价比评估（例如哪些是神仙皮肤值得买，哪些是垃圾不要买）：\\n" +
        itemsInfo.join("\\n") + "\\n" +
        "要求：语气幽默生动，专业犀利，总字数控制在150字以内，直接输出段落内容，不要有任何多余的引言或代码框。";
        
      const aiReview = await sdk.llm.complete(prompt);
      content += "\\n**🤖 AI 每日皮肤测评：**\\n> " + aiReview;
      
      return content;
    } catch (err) {
      return "❌ 获取商店数据发生异常：" + err.message;
    }
  }
};`
    }
  });

  console.log("Seeding cities database...");
  await prisma.city.deleteMany({});
  
  const cities = [
    { name: "北京", pinyin: "beijing", country: "中国" },
    { name: "上海", pinyin: "shanghai", country: "中国" },
    { name: "广州", pinyin: "guangzhou", country: "中国" },
    { name: "深圳", pinyin: "shenzhen", country: "中国" },
    { name: "杭州", pinyin: "hangzhou", country: "中国" },
    { name: "成都", pinyin: "chengdu", country: "中国" },
    { name: "武汉", pinyin: "wuhan", country: "中国" },
    { name: "南京", pinyin: "nanjing", country: "中国" },
    { name: "西安", pinyin: "xian", country: "中国" },
    { name: "重庆", pinyin: "chongqing", country: "中国" },
    { name: "苏州", pinyin: "suzhou", country: "中国" },
    { name: "天津", pinyin: "tianjin", country: "中国" },
    { name: "青岛", pinyin: "qingdao", country: "中国" },
    { name: "东京", pinyin: "tokyo", country: "日本" },
    { name: "纽约", pinyin: "new york", country: "美国" },
    { name: "伦敦", pinyin: "london", country: "英国" },
    { name: "巴黎", pinyin: "paris", country: "法国" },
    { name: "柏林", pinyin: "berlin", country: "德国" },
    { name: "新加坡", pinyin: "singapore", country: "新加坡" },
    { name: "香港", pinyin: "hong kong", country: "中国" },
    { name: "台北", pinyin: "taipei", country: "中国" }
  ];

  for (const city of cities) {
    await prisma.city.create({
      data: city
    });
  }

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
