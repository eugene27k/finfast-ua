import { NextRequest, NextResponse } from "next/server";
import { setWebhook } from "@/lib/monobank";

export async function POST(request: NextRequest) {
  const token = request.headers.get("x-mono-token");
  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
    const data = await setWebhook(token, url);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
