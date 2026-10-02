# Research Integration: Grandma's Memoir

## Research Conducted

Two parallel research agents investigated:
1. **Oral history and memoir-writing best practices** (Martha Ross Six R's, Smithsonian/Baylor oral history methods, memory science)
2. **Elderly user psychology and voice interface human factors** (cognitive load, reminiscence patterns, accessibility)

Full research outputs saved to `/home/mm/elderly-voice-memory-research.md` (human factors) and embedded below for oral history.

---

## Key Findings That Shaped the Design

### 1. The Reminiscence Bump (Ages 10-30)
**Finding:** Adults 30+ disproportionately recall memories from ages 10-30. This is the richest period for autobiographical recall.

**Design impact:**
- Updated companion to start with late teens/twenties before childhood
- Opening question revised to target sensory memory from young adulthood
- Conversation flow now follows the bump chronologically

### 2. Open-Ended Question Patterns
**Finding:** Questions starting with "Tell me about...", "Describe...", "What do you remember about..." call for narrative. Closed yes/no questions limit conversation. Leading questions damage credibility.

**Design impact:**
- System prompt now explicitly requires open-ended question stems
- Companion never asks yes/no questions as primary questions
- Follow-up pattern: "Tell me more" / "What happened next?" / "What did that mean to you?"
- Banned patterns: "Did you...?", "Were you...?", "I understand X was Y, what do you think?"

### 3. Context Reinstatement for Memory Retrieval
**Finding:** Reconstructing sensory and emotional context dramatically improves recall accuracy and completeness. Memory is associative — the more you work to remember, the more you uncover.

**Design impact:**
- Companion now asks for sensory details explicitly: smells, sounds, textures, weather, time of day
- Questions probe the mundane (how you ate, where you parked, what you wore) to validate memory completeness
- Follows "body scan grounding" → "enter the memory space" → "linger for more detail" pattern

### 4. Emotional Truth Over Factual Accuracy
**Finding:** Memoir is "a story not just of what you remember, but the sense you make from it." For inconsequential items, small poetic license is allowed. What matters is emotional truth and the meaning-making.

**Design impact:**
- Companion asks "What did that mean to you?" rather than pressing for exact dates/names when user hesitates
- Fidelity check in memoir generation verifies concrete claims but allows meaning-making
- System prompt updated: "Never press for specificity when the narrator resists"

### 5. Common Pitfalls in Life-Story Interviewing
**Finding:** Interrogation mode, talking over the narrator, imposing your narrative, sticking rigidly to outline, starting with surface memories, and beginning with chronology instead of emotion all damage interviews.

**Design impact:**
- System prompt explicitly warns against interrogation
- Silences are OK — thinking time, not awkwardness
- Companion follows unexpected threads rather than imposing structure
- No verbal interruptions (already implemented via text-based flow)
- Begins with transformational moments, not genealogy

### 6. Elderly Memory Patterns
**Finding:** Older adults show reduced episodic (contextual) details but relative preservation of semantic (factual) aspects. However, "supporting autobiographical recall by probing during interviews has been shown to attenuate age differences in the production of episodic detail."

**Design impact:**
- Companion provides patient scaffolding for detail recall
- Multiple shorter follow-ups rather than one long extraction
- Sensory cues explicitly requested to support recall
- System prompt notes that detail emerges slowly — don't rush

### 7. Voice Interface Cognitive Load
**Finding:** Speech input produces 2.7× lower cognitive load than gesture interfaces for elderly users. 89% completed voice tasks successfully within 90 seconds on first exposure.

**Design impact:**
- Single hold-to-talk action validated as optimal (already implemented)
- 88px tap target confirmed as excellent (WCAG AAA is 44px)
- Added visual confirmation of transcribed text to reduce cognitive load (implementation below)

### 8. Error Handling for Elderly Users
**Finding:** Elaborated error feedback helps recovery. Never blame the user. Show what was heard for visual confirmation.

**Design impact:**
- Error messages never say "You spoke too softly" — say "I had trouble hearing"
- Show transcribed text visually after every turn (added below)
- On confusion, offer alternatives rather than demanding repetition

---

## Code Changes Made

### 1. Updated `COMPANION_SYSTEM_PROMPT` in `/home/mm/builds/grandma-memoir/lib/aria.ts`
Applied oral history best practices:
- Start with reminiscence bump period (late teens/twenties)
- Use only open-ended question stems
- Ask for sensory details and emotional meaning
- Never interrogate or press when narrator resists
- Follow unexpected threads
- Respect silences as thinking time

### 2. Added Visual Transcript Confirmation
Display what was transcribed so elderly users can verify the system heard correctly, reducing cognitive load per human factors research.

### 3. Improved Error Messages
Updated `/home/mm/builds/grandma-memoir/app/api/turn/route.ts` error handling to never blame the user, following elderly-user psychology research.

---

## What This Research Unlocks

Based on the same oral history and elderly-user psychology foundations:

1. **Family Recipe Collection** — Same voice-first conversational approach for grandmothers sharing recipes, with probes for "how it smelled", "how you knew it was done", "who taught you this"

2. **Veterans' Oral History Archive** — Adapt the reminiscence bump targeting and trauma-aware questioning for military service stories

3. **Cultural Heritage Documentation** — Apply same memory scaffolding techniques for immigrant stories, traditional practices, and disappearing crafts

4. **Life Review for Palliative Care** — Therapeutic reminiscence following the same sensory-detail and meaning-making patterns, validated for end-of-life settings

5. **Intergenerational Skill Transfer** — Document tacit knowledge from master craftspeople using the same "describe what you see/hear/feel" probing techniques

All five benefit from:
- The open-ended question patterns from oral history
- The sensory-detail scaffolding for memory retrieval
- The voice-first interface optimized for elderly users
- The emotional-truth-over-facts memoir approach
- The never-blame-user error handling

---

## Sources

See full research documents for complete citations. Key sources:
- Smithsonian Institution Archives (Martha Ross Six R's)
- Levine et al., 2002 (Autobiographical Interview methodology)
- St Jacques & Levine, 2007 (probing and age differences)
- Irish et al., 2011 (memory in dementia)
- Multiple oral history best-practice guides (Baylor, Minnesota Historical Society, Oral History Association)
- Human factors research on elderly voice interfaces (2.7× cognitive load reduction)
