"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Turn = { speaker: "her" | "companion"; text: string; id?: string };
type Phase = "idle" | "listening" | "thinking" | "speaking";

const OPENING =
  "Hello. I'm glad you're here. Tell me — what's a smell or a sound that takes you straight back to being young?";

export default function Home() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);
  const [typed, setTyped] = useState("");
  const [showTyping, setShowTyping] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  const playAudio = useCallback(async (b64: string) => {
    return new Promise<void>((resolve) => {
      const audio = new Audio(`data:audio/mp3;base64,${b64}`);
      audioRef.current = audio;
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      void audio.play().catch(() => resolve());
    });
  }, []);

  /** Speak a line through the server so the API key stays server-side. */
  const speak = useCallback(
    async (text: string) => {
      try {
        setPhase("speaking");
        const res = await fetch("/api/speak", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) return;
        const { audio } = (await res.json()) as { audio: string | null };
        if (audio) await playAudio(audio);
      } finally {
        setPhase("idle");
      }
    },
    [playAudio]
  );

  // She speaks first — no blank stare, no "press start".
  useEffect(() => {
    setTurns([{ speaker: "companion", text: OPENING }]);
    void speak(OPENING);
    if (typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
      setSupported(false);
      setShowTyping(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the newest line in view.
  useEffect(() => {
    liveRef.current?.scrollTo({ top: liveRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, phase]);

  const sendTurn = useCallback(
    async (payload: FormData | string) => {
      setError("");
      setPhase("thinking");
      setStatus("Thinking about what you said…");

      const history = turns.map((t) => ({
        role: t.speaker === "companion" ? "assistant" : "user",
        content: t.text,
      }));

      try {
        let body: BodyInit;
        if (typeof payload === "string") {
          body = JSON.stringify({ text: payload, history });
        } else {
          payload.set("history", JSON.stringify(history));
          body = payload;
        }

        const res = await fetch("/api/turn", { method: "POST", body });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Something went wrong.");
          setPhase("idle");
          setStatus("");
          return;
        }

        setTurns((prev) => [
          ...prev,
          { speaker: "her", text: data.transcript },
          { speaker: "companion", text: data.reply, id: data.id },
        ]);
        setStatus("");

        if (data.audio) {
          setPhase("speaking");
          await playAudio(data.audio);
        }
        setPhase("idle");
      } catch {
        setError("I couldn't reach the server. Check the connection and try again.");
        setPhase("idle");
        setStatus("");
      }
    },
    [turns, playAudio]
  );

  const startListening = useCallback(async () => {
    if (phase === "listening" || phase === "thinking") return;
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 1200) {
          setError("That was very short — hold the circle while you talk.");
          setPhase("idle");
          setStatus("");
          return;
        }
        const fd = new FormData();
        fd.append("audio", blob, "story.webm");
        await sendTurn(fd);
      };

      recorderRef.current = rec;
      rec.start();
      setPhase("listening");
      setStatus("I'm listening…");
    } catch {
      setSupported(false);
      setShowTyping(true);
      setError(
        "I can't reach your microphone. You can type instead — the box is below."
      );
      setPhase("idle");
    }
  }, [phase, sendTurn]);

  const stopListening = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      setStatus("Just a moment…");
      recorderRef.current.stop();
    }
  }, []);

  const busy = phase === "thinking" || phase === "speaking";

  return (
    <main id="main" className="lamp relative flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <p className="font-prose text-lg italic text-parchment-dim">Tell me a story</p>
        <Link
          href="/book"
          className="rounded-full border border-parchment/25 px-4 py-2 text-[0.95rem] text-parchment-dim hover:border-amber hover:text-amber"
        >
          The book
        </Link>
      </header>

      <div
        ref={liveRef}
        className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-5 pb-4 sm:px-8"
        aria-live="polite"
      >
        <ul className="flex flex-col gap-5 py-4">
          {turns.map((t, i) => (
            <li
              key={i}
              className={t.speaker === "companion" ? "max-w-[88%]" : "max-w-[88%] self-end"}
            >
              {t.speaker === "companion" ? (
                <>
                  <p className="font-prose text-[1.3rem] leading-relaxed text-parchment">
                    {t.text}
                  </p>
                  <button
                    type="button"
                    onClick={() => void speak(t.text)}
                    className="mt-1 text-[0.85rem] text-parchment-dim/70 underline decoration-dotted hover:text-amber"
                  >
                    Say that again
                  </button>
                </>
              ) : (
                <p className="rounded-2xl bg-plum-soft/70 px-5 py-3 font-prose text-[1.2rem] leading-relaxed text-parchment-dim">
                  {t.text}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
        <p className="min-h-6 text-center text-[0.95rem] text-parchment-dim" role="status">
          {status}
        </p>
        {error && (
          <p className="mt-1 text-center text-[0.95rem] text-amber" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="mx-auto w-full max-w-3xl px-5 pb-8 pt-2 sm:px-8">
        {supported ? (
          <button
            type="button"
            disabled={busy}
            onPointerDown={startListening}
            onPointerUp={stopListening}
            onPointerLeave={stopListening}
            className={`orb mx-auto block h-32 w-32 rounded-full transition disabled:opacity-60 ${
              phase === "listening"
                ? "orb-listening"
                : phase === "thinking"
                  ? "orb-thinking"
                  : "orb-idle"
            }`}
            aria-label="Hold to tell your story"
          >
            <span className="sr-only">Hold to tell your story</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowTyping(true)}
            className="orb mx-auto block h-28 w-28 rounded-full text-ink"
            aria-label="Type your story instead"
          >
            <span className="text-[0.9rem] font-medium">Type instead</span>
          </button>
        )}

        <p className="mt-4 text-center text-[0.95rem] text-parchment-dim">
          {phase === "listening"
            ? "Let go when you've finished"
            : phase === "thinking"
              ? "One moment…"
              : phase === "speaking"
                ? "Listen…"
                : supported
                  ? "Hold the circle and talk"
                  : "Type your story below"}
        </p>

        {showTyping && (
          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              const text = typed.trim();
              if (!text || busy) return;
              setTyped("");
              void sendTurn(text);
            }}
          >
            <label htmlFor="typed" className="sr-only">
              Type your story
            </label>
            <input
              id="typed"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Type your story here…"
              disabled={busy}
              className="flex-1 rounded-xl border border-parchment/25 bg-plum px-4 py-4 text-[1.1rem] text-parchment placeholder:text-parchment-dim/60 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy || !typed.trim()}
              className="min-h-14 rounded-xl bg-amber px-6 py-4 text-[1.05rem] font-medium text-ink disabled:opacity-50"
            >
              Send
            </button>
          </form>
        )}

        {supported && (
          <button
            type="button"
            onClick={() => setShowTyping((s) => !s)}
            className="mx-auto mt-4 block text-[0.9rem] text-parchment-dim/80 underline decoration-dotted hover:text-amber"
          >
            {showTyping ? "Hide typing" : "Prefer to type? Tap here"}
          </button>
        )}
      </div>
    </main>
  );
}
