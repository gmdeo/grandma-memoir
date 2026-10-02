import { NextRequest, NextResponse } from "next/server";
import { complete } from "@/lib/aria";
import { listStories } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 120;

const BOOK_SYSTEM = `You are a memoirist working from transcripts of an older person telling their life story in their own spoken words.

Your job: shape those transcripts into a warm, readable memoir in the FIRST PERSON ("I"), in THEIR voice.

THE ONE RULE THAT MATTERS MOST — never invent:
- Use only what is actually in the transcripts. Every concrete detail you write must be traceable to something they said.
- Do NOT add sensory elaboration they did not use. If they said "we had a house by the sea", write that. Do NOT add salty air, crashing waves, lullabies, or any image they did not themselves supply.
- Do NOT add named people, places, dates, jobs, weather, feelings-as-facts, or events that are not in the material.
- Do NOT infer or assume. If something is missing, leave it missing. A gap is honest; a guess is a lie.
- It is better to write a short, plain, true chapter than a beautiful invented one.

What you MAY do:
- Connect their sentences into flowing prose, in their voice.
- Keep their turns of phrase, dialect and idiom exactly — do not tidy them away.
- Reorder material by theme or era, and give chapters short titles drawn from their own words.
- Use plain transitions ("Later,", "For years after,") where the material supports them.

Format: markdown. "## " for each chapter title, then prose paragraphs. Do not use the question-and-answer format. Never mention transcription, recording, or speaking aloud.`;

/** Second pass: strip anything the transcripts do not support. */
const VERIFY_SYSTEM = `You are a fact-checker for a family memoir. You are given SOURCE transcripts and a DRAFT written from them.

Your only job: find and remove invented detail.

For every sentence in the draft, ask: is each concrete claim in this sentence traceable to the SOURCE?
- Concrete claims = places, names, dates, objects, sensory details (smells, sounds, weather, textures), and events.
- If a sentence adds a concrete claim NOT in the source, rewrite it to remove the invention, keeping the true part.
- If a whole sentence is invention, delete it.
- Do NOT remove or alter anything that IS supported.
- Do NOT add anything new. Do not improve, embellish, or rewrite for elegance.
- Keep the markdown structure and chapter titles.
- ALWAYS use British English spelling (colour, favourite, realise, neighbour, travelled).

Return ONLY the corrected memoir. No commentary, no notes, no preamble.`;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { maxChapters?: number };
    const stories = await listStories();

    if (stories.length === 0) {
      return NextResponse.json(
        { error: "There are no stories yet. Talk together first." },
        { status: 422 }
      );
    }

    const material = stories.map((s, i) => `[${i + 1}] ${s.transcript}`).join("\n");

    // Pass 1 — draft the memoir from the material.
    const draft = await complete(
      [
        { role: "system", content: BOOK_SYSTEM },
        {
          role: "user",
          content:
            `SOURCE — ${stories.length} story fragments, in the order they were told:\n\n` +
            `${material}\n\n` +
            `Write the memoir now.` +
            (body.maxChapters ? ` Aim for about ${body.maxChapters} chapters.` : ""),
        },
      ],
      { maxTokens: 4000, temperature: 0.7 }
    );

    // Pass 2 — fidelity check. A memoir that invents memories is worthless,
    // so this runs on every generation rather than being optional.
    let memoir = draft;
    try {
      memoir = await complete(
        [
          { role: "system", content: VERIFY_SYSTEM },
          {
            role: "user",
            content: `SOURCE:\n\n${material}\n\n---\n\nDRAFT:\n\n${draft}`,
          },
        ],
        { maxTokens: 4000, temperature: 0.2 }
      );
    } catch (err) {
      // If the check fails, return the draft but say so — never silently present
      // an unverified memoir as if it were checked.
      console.error("fidelity pass failed:", err);
      return NextResponse.json({
        memoir: draft,
        basedOn: stories.length,
        verified: false,
        warning:
          "This draft could not be checked against the recordings, so please read it carefully before sharing.",
      });
    }

    return NextResponse.json({
      memoir,
      basedOn: stories.length,
      verified: true,
      originalChars: draft.length,
      finalChars: memoir.length,
    });
  } catch (err) {
    console.error("memoir failed:", err);
    return NextResponse.json({ error: "Could not write the memoir." }, { status: 500 });
  }
}
