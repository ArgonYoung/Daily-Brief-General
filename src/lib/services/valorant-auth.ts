import crypto from "crypto";

const WECHAT_APP_ID = "wxcbb49f1f39656c2a";

/**
 * Fetch sdk_ticket from Tencent Game Auth
 */
export async function getSdkTicket(): Promise<string> {
  const response = await fetch("https://app.mval.qq.com/go/auth/get_sdk_ticket", {
    method: "POST",
    headers: {
      "user-agent": "mval/2.10062 Channel/3 Manufacturer/Redmi  Mozilla/5.0 (Linux; Android 12; 22041216C Build/V417IR; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/110.0.5481.154 Mobile Safari/537.36",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      clienttype: 9,
      config_params: { client_dev_name: "22041216C", lang_type: 0 },
      mappid: 10200,
      mcode: "69028af6dca2c107f4f58290100011b1a303",
      sdk_appid: WECHAT_APP_ID,
      source_game_zone: "agame",
      game_zone: "agame",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sdk ticket: HTTP ${response.status}`);
  }

  const resJson = await response.json();
  const ticket = resJson?.data?.ticket;
  if (!ticket) {
    throw new Error(`get_sdk_ticket returned invalid response: ${JSON.stringify(resJson)}`);
  }
  return ticket;
}

/**
 * Fetch WeChat QR code and session UUID
 */
export async function getWeChatQr(sdkTicket: string): Promise<{ uuid: string; qrCodeBase64: string }> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  // Generate random 6 characters alphanumeric noncestr
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let noncestr = "";
  for (let i = 0; i < 6; i++) {
    noncestr += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const signature = crypto
    .createHash("sha1")
    .update(`appid=${WECHAT_APP_ID}&noncestr=${noncestr}&sdk_ticket=${sdkTicket}&timestamp=${timestamp}`)
    .digest("hex");

  const queryParams = new URLSearchParams({
    appid: WECHAT_APP_ID,
    noncestr,
    timestamp,
    scope: "snsapi_userinfo",
    signature,
  });

  const response = await fetch(`https://open.weixin.qq.com/connect/sdk/qrconnect?f=json&${queryParams.toString()}`, {
    method: "GET",
    headers: {
      "User-Agent": "mval/2.10053 Channel/10068 Manufacturer/Redmi Mozilla/5.0 (Linux; Android 12; 23117RK66C Build/V417IR; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/101.0.4951.61 Mobile Safari/537.36",
      "Content-Type": "application/json",
      "Accept": "*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch WeChat QR: HTTP ${response.status}`);
  }

  const resJson = await response.json();
  if (resJson?.errcode !== 0) {
    throw new Error(`WeChat QR error: ${resJson?.errmsg || "Unknown error"}`);
  }

  const uuid = resJson?.uuid;
  const qrCodeBase64 = resJson?.qrcode?.qrcodebase64;

  if (!uuid || !qrCodeBase64) {
    throw new Error("WeChat response missing uuid or qrCodeBase64");
  }

  return { uuid, qrCodeBase64 };
}

export interface WeChatPollResult {
  errcode: number;
  code?: string;
}

/**
 * Poll WeChat login status for the given UUID
 */
export async function pollWeChatStatus(uuid: string): Promise<WeChatPollResult> {
  const pollUrl = `https://long.open.weixin.qq.com/connect/l/qrconnect?f=json&uuid=${uuid}`;
  const response = await fetch(pollUrl, {
    method: "GET",
    headers: {
      "User-Agent": "mval/2.10053 Channel/10068 Manufacturer/Redmi Mozilla/5.0 (Linux; Android 12; 23117RK66C Build/V417IR; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/101.0.4951.61 Mobile Safari/537.36",
      "Accept": "*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`WeChat poll failed: HTTP ${response.status}`);
  }

  const respText = await response.text();
  
  // Parse WeChat response format. It can be JSON or JavaScript window.wx_errcode string
  if (respText.includes("window.wx_errcode")) {
    const errcodeMatch = respText.match(/wx_errcode=(\d+)/);
    const codeMatch = respText.match(/wx_code='([^']+)'/);
    const errcode = errcodeMatch ? parseInt(errcodeMatch[1], 10) : 408;
    const code = codeMatch ? codeMatch[1] : undefined;
    return { errcode, code };
  } else {
    try {
      const resJson = JSON.parse(respText);
      return {
        errcode: resJson?.wx_errcode ?? 408,
        code: resJson?.wx_code || undefined,
      };
    } catch {
      throw new Error(`Failed to parse WeChat poll response: ${respText}`);
    }
  }
}

export interface ValorantTokenResult {
  userId: string;
  tid: string;
}

/**
 * Exchange WeChat wx_code for Valorant userId and tid tokens
 */
export async function loginByWeChat(wxCode: string): Promise<ValorantTokenResult> {
  const response = await fetch("https://app.mval.qq.com/go/auth/login_by_wechat", {
    method: "POST",
    headers: {
      "user-agent": "mval/2.6.0.10062 Channel/3 Manufacturer/Redmi  Mozilla/5.0 (Linux; Android 12; 22041216C Build/V417IR; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/110.0.5481.154 Mobile Safari/537.36",
      "content-type": "application/json",
      "cookie": "clientType=9; openid=null; access_token=null;",
    },
    body: JSON.stringify({
      clienttype: 9,
      config_params: {
        client_dev_name: "22041216C",
        lang_type: 0,
      },
      login_info: {
        appid: WECHAT_APP_ID,
        check_third_type: 1,
        code: wxCode,
        wx_info_type: 1,
      },
      mappid: 10200,
      mcode: "69028af6dca2c107f4f58290100011b1a303",
      source_game_zone: "agame",
      game_zone: "agame",
    }),
  });

  if (!response.ok) {
    throw new Error(`Tencent login exchange failed: HTTP ${response.status}`);
  }

  const resJson = await response.json();
  const loginInfo = resJson?.data?.login_info;
  if (!loginInfo || loginInfo.result !== 0) {
    throw new Error(`Tencent WeChat login failed: ${JSON.stringify(resJson)}`);
  }

  const userId = loginInfo.user_id;
  const tid = loginInfo.wt;

  if (!userId || !tid) {
    throw new Error("Tencent response missing user_id or wt (tid) tokens");
  }

  return { userId, tid };
}
