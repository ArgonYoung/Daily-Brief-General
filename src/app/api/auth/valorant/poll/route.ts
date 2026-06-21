import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { pollWeChatStatus, loginByWeChat } from "@/lib/services/valorant-auth";

export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const uuid = searchParams.get("uuid");

    if (!uuid) {
      return NextResponse.json({ error: "Missing uuid parameter" }, { status: 400 });
    }

    const pollResult = await pollWeChatStatus(uuid);
    const errcode = pollResult.errcode;

    // Interpret errcode
    // 0: Authorized successfully
    // 405: Authorized successfully (in some client redirection situations)
    // 404: Scanned, waiting for click confirmation in WeChat app
    // 408: Keep waiting
    // Others: Cancelled, expired, or error
    if (errcode === 0 || errcode === 405) {
      const code = pollResult.code;
      if (!code) {
        return NextResponse.json({
          status: "error",
          error: "Authorization code not found in successful WeChat response",
        });
      }

      // Exchange the code for actual game tokens
      const { userId, tid } = await loginByWeChat(code);

      return NextResponse.json({
        status: "success",
        data: { userId, tid },
      });
    } else if (errcode === 404) {
      return NextResponse.json({ status: "scanned" });
    } else if (errcode === 408) {
      return NextResponse.json({ status: "pending" });
    } else {
      // WeChat QR expired, canceled, or other error
      return NextResponse.json({
        status: "expired",
        errcode,
      });
    }
  } catch (error: any) {
    console.error("Failed to poll WeChat login status:", error);
    return NextResponse.json(
      { status: "error", error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
