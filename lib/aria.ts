/**
 * Aria API helpers — SERVER ONLY.
 * The key must never be imported into a client component.
 * Python/urllib gets Cloudflare 403 code 1010, so all calls carry a browser UA.
 *
 * Provider reality (verified 2026-10-02):
 * - TTS: only the chat/completions modalities path works (gpt-audio-2025-08-28).
 *   /audio/speech returns 401 for every model, so it is not used.
 * - STT: gpt-4o-mini-transcribe and gpt-4o-transcribe work; whisper-1 is rejected.
 * - Routes go busy and return 429 model_route_busy. Retry, then fall back.
 */

const BASE = "https://api.entelic.io/v1";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

/** Model chains — first that answers wins. Verified working, in preference order. */
export const TEXT_MODELS = [
  process.env.ARIA_TEXT_MODEL,
  "gpt-4o-mini",
  "gpt-4o",
  "claude-haiku-4-5-20251001",
].filter(Boolean) as string[];

export const VOICE_MODELS = ["gpt-audio-2025-08-28"];
export const STT_MODELS = ["gpt-4o-mini-transcribe", "gpt-4o-transcribe"];

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function authHeaders(): Record<string, string> {
  const key = process.env.ARIA_API_KEY;
  if (!key) throw new Error("ARIA_API_KEY is not set");
  return { Authorization: `Bearer ${key}`, "User-Agent": UA };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 429/5xx are worth retrying; 4xx generally are not. */
function isRetryable(status: number) {
  return status === 429 || status === 408 || status >= 500;
}

/**
 * Retry a request with exponential backoff.
 * The provider returns 429 "model_route_busy" under load — that is transient,
 * so a bare failure here would be a self-inflicted outage.
 */
async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 3
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number }).status;
      if (status !== undefined && !isRetryable(status)) throw err;
      if (i < attempts - 1) {
        const wait = 350 * Math.pow(2, i) + Math.random() * 250;
        console.warn(
          `${label}: attempt ${i + 1} failed, retrying in ${Math.round(wait)}ms`
        );
        await sleep(wait);
      }
    }
  }
  throw lastErr;
}

async function postJson(path: string, body: unknown, attemptLabel = path) {
  return withRetry(attemptLabel, async () => {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      const err = new Error(`Aria ${path} failed: ${res.status} ${text}`) as Error & {
        status?: number;
      };
      err.status = res.status;
      throw err;
    }
    return res.json();
  });
}

/** Plain text completion, walking the model chain if a route is unavailable. */
export async function complete(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  let lastErr: unknown;
  for (const model of TEXT_MODELS) {
    try {
      const json = await postJson(
        "/chat/completions",
        {
          model,
          messages,
          max_tokens: opts.maxTokens ?? 400,
          temperature: opts.temperature ?? 0.8,
        },
        `complete(${model})`
      );
      const text = json.choices?.[0]?.message?.content?.trim();
      if (text) return text;
      console.warn(`complete(${model}): empty response, trying next`);
    } catch (err) {
      lastErr = err;
      console.warn(`complete(${model}) failed, trying next model`);
    }
  }
  throw lastErr ?? new Error("No text model available");
}

/**
 * Speak text aloud. Returns base64 mp3, or null if voice is unavailable.
 * Voice is a nicety — a failure here must never break the conversation.
 */
export async function speak(text: string, voice = "alloy"): Promise<string | null> {
  for (const model of VOICE_MODELS) {
    try {
      const json = await postJson(
        "/chat/completions",
        {
          model,
          modalities: ["text", "audio"],
          audio: { voice, format: "mp3" },
          messages: [
            {
              role: "system",
              content:
                "You are a warm, patient companion speaking aloud to an elderly person. " +
                "Say exactly what you are asked to say, adding nothing else.",
            },
            {
              role: "user",
              content: `Say this aloud, warmly and naturally:\n\n${text}`,
            },
          ],
        },
        `speak(${model})`
      );
      const audio = json.choices?.[0]?.message?.audio?.data;
      if (audio) return audio;
    } catch (err) {
      console.warn(`speak(${model}) failed`, err);
    }
  }
  console.error("speak(): no voice model produced audio");
  return null;
}

/** Transcribe recorded audio, walking the model chain. */
export async function transcribe(audio: Blob): Promise<string> {
  let lastErr: unknown;

  for (const model of STT_MODELS) {
    try {
      return await withRetry(`transcribe(${model})`, async () => {
        const form = new FormData();
        form.append("model", model);
        form.append("file", audio, "recording.webm");

        const res = await fetch(`${BASE}/audio/transcriptions`, {
          method: "POST",
          headers: authHeaders(),
          body: form,
        });
        if (!res.ok) {
          const err = new Error(
            `Aria transcription failed: ${res.status} ${await res.text()}`
          ) as Error & { status?: number };
          err.status = res.status;
          throw err;
        }
        const json = await res.json();
        return (json.text ?? "").trim();
      });
    } catch (err) {
      lastErr = err;
      console.warn(`transcribe(${model}) failed, trying next model`);
    }
  }
  throw lastErr ?? new Error("No transcription model available");
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
