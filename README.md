# KannadaOS Desktop

KannadaOS is a desktop MVP for the offline Kannada learning system described in `/Users/deepakkudi23/Downloads/duo.md`. The original handoff spec targets Flutter, but this repository uses Electron, React, TypeScript, and Vite so the app can be built for macOS and Windows from this Mac without a Flutter/Xcode desktop toolchain.

## What Is Implemented

- Onboarding with learner level selection.
- Home dashboard with streak, XP goal, hearts, gems, and a Duolingo-style level map.
- Lesson flow for the first survival Kannada exercise with answer checking, XP, hearts, and review scheduling.
- Practice screen with flashcard review and weak-area cards.
- Bangalore Mode with BMTC, auto, darshini, kirana, office, and PG owner scenarios.
- Tutor chat with a deterministic offline correction fallback.
- Profile/stats screen.
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

`npm run dev` starts Vite and Electron together. `npm run test:e2e` builds the renderer, launches Electron, completes onboarding, answers a lesson, checks chat fallback, opens practice, opens Bangalore Mode, opens profile, and probes Ollama live status.

## Latest Verification

Run on May 23, 2026:

- `npm test`: 4 files, 13 tests passed.
- `npm run lint`: passed.
- `npm run build`: TypeScript and Vite production build passed.
- `npm run test:e2e`: passed; live Ollama smoke reported `qwen2.5:0.5b`.
- `npm run package:mac`: created `KannadaOS-0.1.0-arm64.dmg` and `KannadaOS-0.1.0-arm64-mac.zip`.
- `npm run package:win`: created Windows portable `KannadaOS 0.1.0.exe`.

Release artifacts are generated under `release/` and are intentionally ignored because they are large rebuildable outputs.
