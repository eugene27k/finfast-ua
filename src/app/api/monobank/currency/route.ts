import { NextResponse } from "next/server";
import { getCurrencyRates } from "@/lib/monobank";

export async function GET() {
  try {
    const data = await getCurrencyRates();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
