import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    if (!query) {
      return NextResponse.json([]);
    }

    // Search by name or pinyin (case-insensitive)
    const cities = await prisma.city.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { pinyin: { contains: query.toLowerCase() } }
        ]
      },
      take: 8
    });

    return NextResponse.json(cities);
  } catch (error: any) {
    console.error("GET /api/cities failed:", error);
    return NextResponse.json({ error: error.message || "Failed to search cities" }, { status: 500 });
  }
}
