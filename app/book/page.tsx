"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Story = {
  id: string;
  created_at: string;
  transcript: string;
  reply: string;
  question: string;
};

type Chapter = { title: string; paragraphs: string[] };

/** Split the model's markdown into chapters without a markdown dependency. */
function parseChapters(md: string): Chapter[] {
  const chapters: Chapter[] = [];
  let current: Chapter | null = null;

  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (heading) {
      if (current) chapters.push(current);
      current = { title: heading[1].trim(), paragraphs: [] };
      continue;
    }
    const text = line.replace(/\*\*/g, "").replace(/^[-*]\s+/, "");
    if (!current) current = { title: "The story so far", paragraphs: [] };
    current.paragraphs.push(text);
  }
  if (current) chapters.push(current);
  return chapters.filter((c) => c.paragraphs.length > 0);
}

export default function BookPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/turn");
      const data = await res.json();
      setStories(data.stories ?? []);
    } catch {
      setError("Could not load the stories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const writeMemoir = useCallback(async () => {
    setWriting(true);
    setError("");
    try {
      const res = await fetch("/api/memoir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not write the memoir.");
        return;
      }
      setChapters(parseChapters(data.memoir as string));
    } catch {
      setError("Could not write the memoir just now.");
    } finally {
      setWriting(false);
    }
  }, []);

  const wordCount = useMemo(
    () =>
      chapters.reduce(
        (n, c) => n + c.paragraphs.join(" ").split(/\s+/).filter(Boolean).length,
        0
      ),
    [chapters]
  );

  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main id="main" className="lamp min-h-dvh">
      <header className="no-print flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link
          href="/"
          className="rounded-full border border-parchment/25 px-4 py-2 text-[0.95rem] text-parchment-dim hover:border-amber hover:text-amber"
        >
          Back to talking
        </Link>
        <p className="font-prose text-lg italic text-parchment-dim">The book</p>
      </header>

      <div className="mx-auto w-full max-w-3xl px-5 pb-16 sm:px-8">
        {loading ? (
          <p className="py-16 text-center text-parchment-dim">Fetching the stories…</p>
        ) : stories.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-prose text-2xl text-parchment">
              There are no stories yet.
            </p>
            <p className="mx-auto mt-3 max-w-md text-[1.05rem] text-parchment-dim">
              Sit down together and talk first. Every conversation is saved, and the
              book is written from them.
            </p>
            <Link
              href="/"
              className="mt-7 inline-block min-h-14 rounded-xl bg-amber px-6 py-4 text-[1.05rem] font-medium text-ink"
            >
              Start talking
            </Link>
          </div>
        ) : (
          <>
            <div className="no-print py-6 text-center">
              <p className="text-[1.05rem] text-parchment-dim">
                {stories.length} {stories.length === 1 ? "story" : "stories"} saved so
                far.
              </p>
              <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={writeMemoir}
                  disabled={writing}
                  className="min-h-14 rounded-xl bg-amber px-6 py-4 text-[1.05rem] font-medium text-ink disabled:opacity-50"
                >
                  {writing
                    ? "Writing…"
                    : chapters.length
                      ? "Write it again"
                      : "Write the memoir"}
                </button>
                {chapters.length > 0 && (
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="min-h-14 rounded-xl border border-parchment/30 px-6 py-4 text-[1.05rem] text-parchment hover:border-amber hover:text-amber"
                  >
                    Save as PDF
                  </button>
                )}
              </div>
              {error && (
                <p className="mt-3 text-[0.95rem] text-amber" role="alert">
                  {error}
                </p>
              )}
              {wordCount > 0 && (
                <p className="mt-3 text-[0.9rem] text-parchment-dim/80">
                  {wordCount.toLocaleString()} words. You can print this or save it as a
                  PDF.
                </p>
              )}
            </div>

            {/* The book itself */}
            <article className="paper print-area mt-2 rounded-lg p-8 shadow-2xl sm:p-14">
              <p className="mb-2 text-center text-[0.85rem] tracking-wide text-[#8a7a66]">
                {today}
              </p>

              {chapters.length === 0 ? (
                <>
                  <h1 className="mb-8 text-center font-prose text-3xl">
                    Stories I remember
                  </h1>
                  {stories.map((s) => (
                    <p key={s.id} className="mb-5 font-prose text-[1.15rem] leading-[1.85]">
                      {s.transcript}
                    </p>
                  ))}
                </>
              ) : (
                <>
                  <h1 className="mb-10 text-center font-prose text-3xl">
                    Stories I remember
                  </h1>
                  {chapters.map((c, i) => (
                    <section key={i} className="mb-10 break-inside-avoid">
                      <h2 className="mb-4 font-prose text-2xl text-[#3a2c1e]">
                        {c.title}
                      </h2>
                      {c.paragraphs.map((p, j) => (
                        <p
                          key={j}
                          className="mb-4 font-prose text-[1.15rem] leading-[1.85] text-[#2a2119]"
                        >
                          {p}
                        </p>
                      ))}
                    </section>
                  ))}
                </>
              )}
            </article>
          </>
        )}
      </div>
    </main>
  );
}
