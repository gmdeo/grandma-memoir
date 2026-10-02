/**
 * Aria API helpers — SERVER ONLY.
 * The key must never be imported into a client component.
 * Python/urllib gets Cloudflare 403 code 1010, so all calls carry a browser UA.
 */

const BASE = "https://api.entelic.io/v1";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

export const TEXT_MODEL = process.env.ARIA_TEXT_MODEL ?? "gpt-4o-mini";
export const VOICE_MODEL = "gpt-audio-2025-08-28";
export const STT_MODEL = "gpt-4o-mini-transcribe";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function authHeaders(): Record<string, string> {
  const key = process.env.ARIA_API_KEY;
  if (!key) throw new Error("ARIA_API_KEY is not set");
  return { Authorization: `Bearer ${key}`, "User-Agent": UA };
}

async function postJson(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Aria ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Plain text completion. */
export async function complete(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const json = await postJson("/chat/completions", {
    model: TEXT_MODEL,
    messages,
    max_tokens: opts.maxTokens ?? 400,
    temperature: opts.temperature ?? 0.8,
  });
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

/** Speak text aloud. Returns base64 mp3. */
export async function speak(text: string, voice = "alloy"): Promise<string | null> {
  try {
    const json = await postJson("/chat/completions", {
      model: VOICE_MODEL,
      modalities: ["text", "audio"],
      audio: { voice, format: "mp3" },
      messages: [
        {
          role: "system",
          content:
            "You are a warm, patient companion speaking aloud to an elderly person. " +
            "Say exactly what you are asked to say, adding nothing else.",
        },
        { role: "user", content: `Say this aloud, warmly and naturally:\n\n${text}` },
      ],
    });
    return json.choices?.[0]?.message?.audio?.data ?? null;
  } catch (err) {
    console.error("speak() failed:", err);
    return null; // Voice is a nicety — never fail the whole turn over it.
  }
}

/** Transcribe recorded audio to text. */
export async function transcribe(audio: Blob): Promise<string> {
  const form = new FormData();
  form.append("model", STT_MODEL);
  form.append("file", audio, "recording.webm");

  const res = await fetch(`${BASE}/audio/transcriptions`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Aria transcription failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return (json.text ?? "").trim();
}

export const COMPANION_SYSTEM_PROMPT = `You are a kind, unhurried companion whose job is to help an older person tell the stories of their life.

How you speak:
- Warm, plain, and human. Short sentences.
- Never more than two sentences, and always end with exactly ONE easy question.
- Never interview or interrogate. Follow what they seem to enjoy.
- Use their own words back to them when you can.
- Never mention that you are an AI unless they ask directly.

What you are doing: gently drawing out memories — childhood, family, work, places, food, holidays, the people they loved. One thread at a time. Let silences be fine. If they seem tired or go quiet, offer something gentle to rest on.

Never invent memories for them and never put words in their mouth. Your questions open doors; they walk through.`;
