import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  transcribe,
  complete,
  speak,
  COMPANION_SYSTEM_PROMPT,
  type ChatMessage,
} from "@/lib/aria";
import { saveStory, listStories } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * One conversational turn.
 * Accepts either recorded audio (multipart) or typed text (JSON).
 * Returns: what she said (transcript), Aria's warm reply, and spoken audio.
 */
export async function POST(req: NextRequest) {
  try {
    let transcript = "";
    let history: ChatMessage[] = [];
    let voice = "alloy";

    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("audio");
      const historyRaw = form.get("history");
      const voiceRaw = form.get("voice");
      if (typeof voiceRaw === "string" && voiceRaw) voice = voiceRaw;
      if (typeof historyRaw === "string" && historyRaw) {
        history = JSON.parse(historyRaw) as ChatMessage[];
      }
      if (!(file instanceof Blob) || file.size === 0) {
        return NextResponse.json({ error: "No audio received." }, { status: 400 });
      }
      transcript = await transcribe(file);
    } else {
      const body = (await req.json()) as {
        text?: string;
        history?: ChatMessage[];
        voice?: string;
      };
      transcript = (body.text ?? "").trim();
      history = body.history ?? [];
      if (body.voice) voice = body.voice;
    }

    if (!transcript) {
      return NextResponse.json(
        { error: "I couldn't hear anything. Try again, a little closer to the mic." },
        { status: 422 }
      );
    }

    // Build the conversation: system prompt + recent history + what she just said.
    const messages: ChatMessage[] = [
      { role: "system", content: COMPANION_SYSTEM_PROMPT },
      ...history.slice(-12),
      { role: "user", content: transcript },
    ];

    // Aria's reply, split into the warm line and the follow-up question.
    const reply = await complete(messages, { maxTokens: 220, temperature: 0.85 });

    const question =
      reply.match(/[^.!?]*\?["']?\s*$/)?.[0]?.trim() ?? "";

    // Speak it. If voice fails we still return the text — never lose the moment.
    const audioB64 = await speak(reply, voice);

    const id = randomUUID();
    await saveStory({
      id,
      created_at: new Date().toISOString(),
      transcript,
      reply,
      question,
      session_id: "default",
    });

    return NextResponse.json({
      id,
      transcript,
      reply,
      question,
      audio: audioB64, // base64 mp3, or null
    });
  } catch (err) {
    console.error("turn failed:", err);
    return NextResponse.json(
      { error: "Something went wrong on our end. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const stories = await listStories();
    return NextResponse.json({ stories });
  } catch (err) {
    console.error("list failed:", err);
    return NextResponse.json({ error: "Could not load stories." }, { status: 500 });
  }
}
