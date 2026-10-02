import { NextRequest, NextResponse } from "next/server";
import { speak } from "@/lib/aria";

export const runtime = "nodejs";
export const maxDuration = 45;

/** Speak a line. Keeps the API key server-side. */
export async function PUT(req: NextRequest) {
  try {
    const { text, voice } = (await req.json()) as { text?: string; voice?: string };
    if (!text) return NextResponse.json({ error: "No text." }, { status: 400 });
    const audio = await speak(text, voice ?? "alloy");
    return NextResponse.json({ audio });
  } catch (err) {
    console.error("speak failed:", err);
    return NextResponse.json({ error: "Could not speak that." }, { status: 500 });
  }
}
