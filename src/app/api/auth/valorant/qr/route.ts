import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getSdkTicket, getWeChatQr } from "@/lib/services/valorant-auth";

export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sdkTicket = await getSdkTicket();
    const { uuid, qrCodeBase64 } = await getWeChatQr(sdkTicket);

    return NextResponse.json({
      success: true,
      uuid,
      qrCode: qrCodeBase64,
    });
  } catch (error: any) {
    console.error("Failed to generate WeChat QR:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
