# Step 5: Generate VO + Map Timing

## Audition voices

Never use the first voice you find. Audition 2-3 voices with the first sentence of SCRIPT.md:

- **ElevenLabs** (recommended — widest voice selection, most natural output) — `mcp__elevenlabs__search_voices` to browse, `mcp__elevenlabs__text_to_speech` to generate. Does not return timestamps — transcribe separately after.
- **HeyGen TTS** (alternative — returns word timestamps automatically) — `mcp__claude_ai_HeyGen__text_to_speech`. Use `mcp__claude_ai_HeyGen__list_audio_voices` to browse. Look for relaxed, confident voices.
- **Kokoro** (offline last resort — has Python dependency issues on many systems) — `npx hyperframes tts SCRIPT.md --voice af_nova --output narration.wav`. Only try this if ElevenLabs and HeyGen are unavailable.

Pick the voice that sounds most natural and conversational. Listen for pacing — does it breathe between sentences? Does it sound like a person or a robot?

## Generate full narration

Generate the full script as `narration.wav` (or `.mp3`) in the project directory.

## Transcribe for word-level timestamps

```bash
npx hyperframes transcribe narration.wav
```

Produces `transcript.json` with `[{ text, start, end }]` for every word. These timestamps are the source of truth for all beat durations.

## Map timestamps to beats

Go through STORYBOARD.md beat by beat. For each beat:

1. Find the first word of that beat's VO cue in `transcript.json`
2. Find the last word of that beat's VO cue
3. Set `beat.start = firstWord.start`, `beat.end = lastWord.end`
4. Add 0.3-0.5s padding at the end for visual breathing room

Update STORYBOARD.md with real durations. Replace estimated times (e.g., "0:00-0:05") with actual timestamps (e.g., "0.00-3.21s").

Beat boundaries land on word onsets — hard cuts to the VO.

## Update index.html

Update each scene slot's `data-start` and `data-duration` to match the real beat timings from the transcript. Also update the total composition duration and audio element duration.
