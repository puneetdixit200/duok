# KannadaOS Desktop

KannadaOS is a desktop MVP for the offline Kannada learning system described in `/Users/deepakkudi23/Downloads/duo.md`. The original handoff spec targets Flutter, but this repository uses Electron, React, TypeScript, and Vite so the app can be built for macOS and Windows from this Mac without a Flutter/Xcode desktop toolchain.

## What Is Implemented

- Onboarding with learner level selection.
- Home dashboard with streak, XP goal, hearts, gems, and a Duolingo-style level map.
- Lesson flow for all six MVP exercise types: translate, arrange words, fill in the blank, listening, speaking, and match pairs, followed by a lesson-complete screen.
- Adaptive Practice screen with flashcard review, due review counts, weak-area detection, and difficulty adjustment.
- Pronunciation Lab with reference playback status, transcript scoring, syllable-level feedback, and persisted latest attempts.
- Story Mode with illustrated story cards, locked stories, sentence reader, tap-for-word meanings, and a comprehension quiz.
- Bangalore Mode with BMTC, auto, darshini, kirana, office, and PG owner scenarios.
- Tutor chat with selectable real-world scenarios, tutor personalities, voice-input simulation, persisted conversation logs, and a deterministic offline correction fallback.
- Profile/stats screen with progress-derived achievements, daily reminder notification settings, AI model management entry points, desktop learner data sync, and learner data export snapshots.
- AI model setup screen for required Aya, Whisper, and Piper assets plus an optional Whisper upgrade, with download progress and offline-first status states.
- On-device runtime readiness and smoke checks for Llama.cpp, Whisper.cpp, and Piper model plus executable paths through the Electron preload IPC bridge.
- Native llama.cpp exercise generation path for adaptive practice, with Ollama and local fallback still available.
- Native whisper.cpp audio-file transcription path in Pronunciation Lab for filling practice transcripts.
- Native Piper synthesis path in Pronunciation Lab for generating Kannada reference audio files.
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

`npm run dev` starts Vite and Electron together. `npm run test:e2e` builds the renderer, launches Electron, completes onboarding, answers a lesson, checks chat fallback plus persisted conversation reload and scenario/persona voice input, opens adaptive practice, scores pronunciation, completes a story quiz, opens Bangalore Mode, opens profile achievements, daily reminders, data export, and desktop learner storage, verifies model setup controls, checks local native model and executable paths through IPC, runs native command smoke checks, generates an exercise through the native llama.cpp bridge, transcribes pronunciation audio through the native whisper.cpp bridge, synthesizes reference audio through the native Piper bridge, and probes Ollama live status.

## Latest Verification

Run on May 23, 2026:

- `npm test`: 12 files, 52 tests passed.
- `npm run lint`: passed.
- `npm run build`: TypeScript and Vite production build passed.
- `npm run test:e2e`: passed across onboarding, all six lesson exercise types, lesson completion, persisted chat reload, chat scenario/persona voice input, adaptive practice, Pronunciation Lab scoring, Story Mode quiz, Bangalore Mode, profile achievements, daily reminder settings, data export snapshot with conversation logs, desktop learner storage, model setup controls, local runtime model/executable IPC path checks, native command smoke checks, native llama.cpp exercise generation, native whisper.cpp transcription, native Piper synthesis, and live Ollama smoke with `llama3.1:8b` and `qwen2.5:0.5b`.
- `npm run package:mac`: created `KannadaOS-0.1.0-arm64.dmg` and `KannadaOS-0.1.0-arm64-mac.zip`.
- `npm run package:win`: created Windows portable `KannadaOS 0.1.0.exe`.
- Electron visual smoke: Chat rendered restored conversation logs, Profile rendered data export, Practice rendered Pronunciation Lab scoring, and model-management rendered the on-device runtime panel with 3 of 3 temp model paths ready.

Release artifacts are generated under `release/` and are intentionally ignored because they are large rebuildable outputs.
