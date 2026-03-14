import { NextRequest, NextResponse } from "next/server";
import { getClientInfo } from "@/lib/monobank";

export async function GET(request: NextRequest) {
  const token = request.headers.get("x-mono-token");
  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  try {
    const data = await getClientInfo(token);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
