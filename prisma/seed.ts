import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Seeding database... Cleaning old modules first.");
  
  // Clean up any existing seeded modules
  await prisma.module.deleteMany({
    where: {
      id: {
        in: ["weather-module-id", "quote-module-id", "greetings-module-id"],
      },
    },
  }).catch((err) => console.log("Clean-up warning (can ignore):", err.message));

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
      code: `
export default {
  async run({ inputs, sdk }) {
    const city = inputs.city || "北京";
    const unit = inputs.unit || "C";
    
    // Fetch live weather data from wttr.in JSON API
    const res = await sdk.fetch("https://wttr.in/" + encodeURIComponent(city) + "?format=j1");
    if (!res.ok) {
      throw new Error("Failed to fetch weather data for " + city);
    }
    
    const data = await res.json();
    const current = data.current_condition[0];
    const temp = unit === "C" ? current.temp_C : current.temp_F;
    const weatherDesc = current.weatherDesc[0].value;
    const humidity = current.humidity;
    const windSpeed = current.windspeedKmph;
    
    const weatherReport = "城市: " + city + "\\n温度: " + temp + "°" + unit + "\\n天气状况: " + weatherDesc + "\\n湿度: " + humidity + "%\\n风速: " + windSpeed + " km/h";
    
    // Call custom LLM to summarize
    const prompt = "请根据以下详细天气信息，整理总结成一段自然、简短的晨间天气广播内容，输出字数在80字以内，直接输出总结内容本身，不要带有多余说明，也绝不要带任何 Markdown 标题、粗体标记或代码框。数据参考：\\n" + weatherReport;
    return await sdk.llm.complete(prompt);
  }
}
      `
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
      code: `
export default {
  async run({ inputs, sdk }) {
    const category = inputs.category || "g";
    
    // Fetch live quote from Hitokoto
    const res = await sdk.fetch("https://v1.hitokoto.cn/?c=" + encodeURIComponent(category));
    if (!res.ok) {
      throw new Error("Failed to fetch daily quote");
    }
    
    const data = await res.json();
    const quote = data.hitokoto;
    const source = data.from;
    const author = data.from_who;
    
    const ref = author ? author + " · 《" + source + "》" : "《" + source + "》";
    return "”" + quote + "“ — — " + ref;
  }
}
      `
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
