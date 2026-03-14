import { NextRequest, NextResponse } from "next/server";
import { getStatement } from "@/lib/monobank";

export async function GET(request: NextRequest) {
  const token = request.headers.get("x-mono-token");
  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("account");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!accountId || !from) {
    return NextResponse.json(
      { error: "account and from parameters are required" },
      { status: 400 }
    );
  }

  try {
    const data = await getStatement(
      token,
      accountId,
      parseInt(from),
      to ? parseInt(to) : undefined
    );
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
