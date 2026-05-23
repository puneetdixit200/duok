# KannadaOS Desktop

KannadaOS is a desktop MVP for the offline Kannada learning system described in `/Users/deepakkudi23/Downloads/duo.md`. The original handoff spec targets Flutter, but this repository uses Electron, React, TypeScript, and Vite so the app can be built for macOS and Windows from this Mac without a Flutter/Xcode desktop toolchain.

## What Is Implemented

- Onboarding with learner level selection.
- Home dashboard with streak, XP goal, hearts, gems, and a Duolingo-style level map.
- Lesson flow for all six MVP exercise types: translate, arrange words, fill in the blank, listening, speaking, and match pairs, followed by a lesson-complete screen.
- Adaptive Practice screen with flashcard review, due review counts, weak-area detection, and difficulty adjustment.
- Story Mode with illustrated story cards, locked stories, sentence reader, tap-for-word meanings, and a comprehension quiz.
- Bangalore Mode with BMTC, auto, darshini, kirana, office, and PG owner scenarios.
- Tutor chat with selectable real-world scenarios, tutor personalities, voice-input simulation, and a deterministic offline correction fallback.
- Profile/stats screen with progress-derived achievements, daily reminder notification settings, and AI model management entry points.
- AI model setup screen for required Aya, Whisper, and Piper assets plus an optional Whisper upgrade, with download progress and offline-first status states.
- On-device runtime readiness checks for Llama.cpp, Whisper.cpp, and Piper model paths through the Electron preload IPC bridge.
- Ollama integration for generated exercises when `http://localhost:11434` is available, with JSON parsing, code-fence extraction, malformed JSON recovery, and local fallback.

## Scripts

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
npm run test:e2e
npm run package:mac
npm run package:win
```

`npm run dev` starts Vite and Electron together. `npm run test:e2e` builds the renderer, launches Electron, completes onboarding, answers a lesson, checks chat fallback plus scenario/persona voice input, opens adaptive practice, completes a story quiz, opens Bangalore Mode, opens profile achievements and daily reminders, verifies model setup controls, checks local native model paths through IPC, and probes Ollama live status.

## Latest Verification

Run on May 23, 2026:

- `npm test`: 6 files, 26 tests passed.
- `npm run lint`: passed.
- `npm run build`: TypeScript and Vite production build passed.
- `npm run test:e2e`: passed across onboarding, all six lesson exercise types, lesson completion, chat scenario/persona voice input, adaptive practice, Story Mode quiz, Bangalore Mode, profile achievements, daily reminder settings, model setup controls, local runtime IPC path checks, and live Ollama smoke with `llama3.1:8b` and `qwen2.5:0.5b`.
- Electron visual smoke: model-management screen rendered the new on-device runtime panel and verified 3 of 3 temp model paths ready.
- `npm run package:mac`: created `KannadaOS-0.1.0-arm64.dmg` and `KannadaOS-0.1.0-arm64-mac.zip`.
- `npm run package:win`: created Windows portable `KannadaOS 0.1.0.exe`.

Release artifacts are generated under `release/` and are intentionally ignored because they are large rebuildable outputs.
