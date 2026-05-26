# KannadaOS App Guide

This document explains what KannadaOS is, how the app works, where data is stored, and how the main scores and progress numbers are calculated. It is written in English first, with romanized Kannada examples where helpful.

## 1. What The App Is

KannadaOS is a desktop Kannada learning app built with Electron, React, TypeScript, and Vite. It is designed as an offline-first MVP for learning practical Bangalore Kannada, with optional hosted AI providers when the learner wants cloud generation.

The app includes:

- Onboarding for the learner level.
- A dashboard with XP, hearts, gems, streaks, and a level map.
- A six-step survival lesson.
- Adaptive practice and flashcards.
- Pronunciation Lab with microphone recording, Whisper transcription, scoring, and Piper reference audio.
- Story Mode with word meanings and quizzes.
- Bangalore Mode scenarios such as auto rides, BMTC, darshini, kirana, office, and PG owner conversations.
- Tutor chat with scenario/persona selection, text input, and voice input.
- AI model/provider setup for local runtime paths, Ollama, OpenRouter, and NVIDIA hosted models.
- Profile settings, reminders, learner data export, reset progress, and local desktop storage sync.

## 2. Main Screens

### Onboarding

The learner picks a starting level and presses Start Learning. The app stores `kannadaos:onboarded=true`, then opens the main app shell.

### Dashboard

The dashboard shows:

- Current hearts and gems.
- Daily XP progress toward a 10 XP goal.
- A lesson card for "Continue: Greetings".
- A Duolingo-style level map.

The daily ring displays `min(10, dailyXp) / 10`.

### Lesson

The current MVP lesson has six exercise types:

| Step | Type | What the learner does | XP |
| --- | --- | --- | --- |
| 1 | Translate | Choose the English meaning | 2 |
| 2 | Arrange | Put Kannada words in order | 3 |
| 3 | Fill blank | Pick the missing phrase | 2 |
| 4 | Listening | Play reference audio and choose answer | 3 |
| 5 | Speaking | Record speech, transcribe, score pronunciation | 4 |
| 6 | Match pairs | Match Kannada words to English meanings | 4 |

Speaking exercises become answerable when the pronunciation score is at least 70.

### Practice

Practice shows:

- Due review count.
- Weak skill summaries.
- Adaptive difficulty.
- Flashcards.
- AI-generated exercise button.
- Pronunciation Lab.

### Pronunciation Lab

The learner can:

- Pick a phrase.
- Play or synthesize reference audio through Piper.
- Type or transcribe a manual audio file.
- Record live microphone audio.
- Score the transcript against the expected phrase.

The app shows score, level, feedback, tip, problem parts, and the latest attempt.

### Chat

The tutor chat supports:

- Scenario selection.
- Persona selection.
- Text input.
- Voice input using the same microphone to Whisper flow.
- Offline deterministic replies.
- Hosted AI replies when OpenRouter or NVIDIA hosted is selected and configured.

Conversation history is saved per scenario and limited to the latest 50 messages per scenario.

### Stories

Story Mode has:

- Story cards.
- Reader view.
- Tap-for-word meanings.
- Quiz.
- Completion XP.

Completing a story adds a story activity to progress.

### Bangalore Mode

Bangalore Mode contains practical daily-life scenarios and phrase cards. It is for real contexts like transport, food, shopping, work, and housing.

### AI Models

The model screen has two sections:

- Model setup: shows Aya, Whisper, and Piper download/readiness state.
- Runtime/provider setup: lets the learner choose local runtime paths and generation provider.

Provider choices:

- Local first: native llama.cpp if ready, then Ollama, then offline fallback.
- Ollama only: asks local Ollama.
- OpenRouter: uses OpenRouter chat completions.
- NVIDIA hosted: uses NVIDIA NIM-compatible chat completions. Current default model is `sarvamai/sarvam-m`.

API keys are saved only in local app data. Export snapshots redact the raw keys and keep only true/false configured flags.

### Profile

Profile shows:

- XP.
- practiced word count.
- streak.
- achievements.
- daily reminder settings.
- desktop storage status.
- Manage AI Models.
- Export Data.
- Reset All Progress.

Reset All Progress clears learning history, pronunciation attempts, and chat history, but keeps model paths, hosted AI keys, reminders, and onboarding state.

## 3. Data Storage

Renderer state is stored in browser `localStorage` using these keys:

| Key | Purpose |
| --- | --- |
| `kannadaos:onboarded` | Whether onboarding is complete |
| `kannadaos:progress` | XP, hearts, streak, review queue, weak areas |
| `kannadaos:reminder` | Daily reminder settings |
| `kannadaos:local-runtime` | Local model and executable paths |
| `kannadaos:ai-provider` | Selected AI provider, model IDs, base URLs, local API keys |
| `kannadaos:pronunciation-history` | Latest pronunciation attempts |
| `kannadaos:conversation-log` | Saved tutor chat messages by scenario |

In Electron, these values are also synced to a desktop JSON file named `learner-data.json` inside the app user data folder. On macOS for this app, that folder is typically:

```text
~/Library/Application Support/kannadaos-desktop/
```

The desktop store uses this shape:

```json
{
  "schemaVersion": 1,
  "appName": "KannadaOS",
  "savedAt": "ISO timestamp",
  "values": {
    "kannadaos:progress": "serialized JSON string"
  }
}
```

## 4. Progress Calculation

Initial progress:

```json
{
  "xp": 0,
  "dailyXp": 0,
  "hearts": 5,
  "gems": 120,
  "streakDays": 0,
  "lastPracticeDate": null,
  "completedExerciseIds": [],
  "weakAreas": {},
  "reviewQueue": {}
}
```

When an exercise is checked, the app computes:

```text
correct = selectedAnswer === exercise.answer
earnedXp = correct ? exercise.xp : 0
xp = oldXp + earnedXp
dailyXp = oldDailyXp + earnedXp
hearts = correct ? oldHearts : max(0, oldHearts - 1)
```

Streak logic:

```text
practiceDate = first 10 characters of ISO timestamp, for example 2026-05-26
if lastPracticeDate !== practiceDate:
  streakDays = max(1, oldStreakDays + 1)
else:
  streakDays = oldStreakDays
lastPracticeDate = practiceDate
```

Current behavior note: `completedExerciseIds` records an exercise ID after it is checked, even if the learner got it wrong. It behaves like "activity attempted/completed" rather than "only correct answers".

Weak area logic:

```text
if wrong:
  weakAreas[exercise.skillTag] = oldMistakesForSkill + 1
if correct:
  weakAreas is unchanged
```

Review queue logic for each vocabulary ID in the exercise:

```text
previousStrength = old strength if present, otherwise 0.5

if correct:
  strength = min(1.0, previousStrength + 0.2)
  dueAt = now + 2 days
else:
  strength = max(0.1, previousStrength - 0.25)
  dueAt = now

attempts = oldAttempts + 1
```

## 5. Adaptive Practice Calculation

Due review items:

```text
dueReviewItems = reviewQueue items where dueAt <= now
```

Weak skill summaries:

- Only skills with mistakes greater than 0 are shown.
- Sort by mistake count descending.
- If tied, sort by skill name.
- Limit to 3 skills.

Weak skill priority:

```text
mistakes >= 3 -> high
mistakes >= 2 -> medium
otherwise -> low
```

Adaptive difficulty:

```text
if hearts <= 2 OR dueReviewCount > 0 OR highestMistakeCount >= 3:
  difficulty = gentle
else if xp >= 80 AND weakSkillCount === 0:
  difficulty = challenge
else:
  difficulty = steady
```

Reasons shown in the UI are built from weak skill count and due review count, for example "1 weak skill and 2 due reviews".

## 6. Achievement Calculation

| Achievement | Unlock rule | Progress label |
| --- | --- | --- |
| First Word | `completedExerciseIds.length > 0` | Number of activities |
| Getting Started | At least 6 `survival-*` exercise IDs | `x/6 lesson exercises` |
| Voice Ready | Includes `survival-speaking-1` | Pronunciation scored or pending |
| Story Starter | Any exercise ID starts with `story-` | 1 story complete or none |
| One Week | `streakDays >= 7` | `x/7 streak days` |
| Review Pro | Any review item has `attempts >= 3` and `strength >= 0.7` | Practiced word count |

## 7. Pronunciation Scoring

Pronunciation scoring compares the expected Kannada text with the Whisper transcript.

Normalization:

- Normalize text to NFC.
- Lowercase it.
- Remove punctuation, spaces, and symbols.
- Keep only letters and numbers.

Similarity:

```text
if normalizedExpected === normalizedTranscript:
  similarity = 1
else:
  distance = Levenshtein distance between expected and transcript
  similarity = 1 - distance / max(expected.length, transcript.length)
```

Score:

```text
score = round(55 + similarity * 43)
score is clamped between 0 and 99
```

Because exact similarity is 1, an exact match currently scores:

```text
round(55 + 1 * 43) = 98
```

Pronunciation level:

```text
score >= 90 -> clear
score >= 70 -> steady
otherwise -> needs-practice
```

Problem parts:

```text
problemParts = target phrase parts that are not found inside the normalized transcript
```

Feedback and tips are chosen from the level and problem parts. If there are problem parts, the tip focuses on the last missing part.

## 8. Voice Recording And Transcription

The live voice flow is:

1. Renderer asks the browser for microphone permission with mono audio, echo cancellation, and noise suppression.
2. Web Audio collects mono `Float32Array` chunks.
3. On Stop Recording, chunks are concatenated.
4. Samples are encoded as 16-bit mono PCM WAV.
5. The app rejects empty audio and clips shorter than 300 ms.
6. Renderer sends WAV bytes to Electron through `transcribeRecordedAudio`.
7. Electron writes a temporary WAV under the user data `recordings` folder.
8. Electron calls the existing Whisper.cpp bridge.
9. The temporary WAV is deleted in a `finally` cleanup path.
10. The transcript returns to the UI.

Manual audio-file transcription remains available in Pronunciation Lab for debugging and fallback.

## 9. AI Generation Routing

### Local first

The app prefers native generation only when:

- All three local runtime components are ready.
- Runtime smoke checks passed.
- The Electron native generation bridge exists.

If native generation is not ready, Local first falls back to Ollama. If Ollama fails, the app uses a deterministic local fallback exercise.

### Ollama only

The app calls:

```text
http://localhost:11434/api/generate
```

It asks for one JSON exercise. The parser accepts valid JSON or JSON inside a code fence and repairs trailing commas. Invalid output falls back to a local exercise.

### OpenRouter

OpenRouter uses:

```text
https://openrouter.ai/api/v1/chat/completions
```

Default model:

```text
openai/gpt-4o-mini
```

OpenRouter requests include app attribution headers.

### NVIDIA hosted

NVIDIA hosted uses:

```text
https://integrate.api.nvidia.com/v1/chat/completions
```

Default model:

```text
sarvamai/sarvam-m
```

Hosted providers require:

- Provider selected.
- API key present.
- Model ID present.
- Base URL present.

If a hosted request fails, the tutor or exercise generator falls back to offline behavior.

## 10. Tutor Reply Flow

When the learner sends chat text:

1. The learner message is appended.
2. The app builds a deterministic offline tutor reply.
3. If OpenRouter or NVIDIA is selected, it asks the hosted provider.
4. If hosted provider succeeds, hosted text replaces the deterministic reply.
5. If hosted provider fails, the deterministic reply is used.
6. Messages are stored under the selected scenario ID.

Hosted tutor prompts ask for short English-first replies, with small amounts of Kannada and romanization when useful.

## 11. Export Calculation

Export creates a JSON snapshot with a summary:

```text
completedActivities = progress.completedExerciseIds.length
practicedWords = number of keys in progress.reviewQueue
runtimePathsConfigured = number of non-empty runtime path fields
conversationMessages = total messages across all scenarios
pronunciationAttempts = pronunciationHistory.length
```

Export includes:

- Progress.
- Reminder settings.
- Runtime paths.
- Sanitized AI provider settings.
- Conversation store.
- Pronunciation history.

Raw OpenRouter and NVIDIA API keys are not exported. The export stores only:

```text
openRouterApiKeyConfigured: true or false
nvidiaApiKeyConfigured: true or false
```

## 12. Reset All Progress

The Reset All Progress button is in Profile.

It asks for confirmation:

```text
Reset all lesson progress, pronunciation attempts, and chat history?
```

If confirmed, it clears:

- `kannadaos:progress`
- `kannadaos:pronunciation-history`
- `kannadaos:conversation-log`
- active lesson interaction state
- active chat input/status
- export preview/status

It keeps:

- onboarding state
- reminder settings
- local runtime paths
- AI provider selection
- OpenRouter key
- NVIDIA key
- hosted model IDs

This is meant for starting learning over without losing setup work.

## 13. Packaging And Release Artifacts

Release artifacts are kept in:

```text
/Users/deepakkudi23/duok/release
```

Current release artifact types:

- Windows portable EXE.
- macOS arm64 ZIP.
- macOS arm64 DMG, retained from the last successful DMG build.

The app can be installed on macOS by extracting the macOS ZIP and copying `KannadaOS.app` to `/Applications`.

## 14. Verification Commands

Common verification commands:

```bash
npm install
npm test
npm run lint
npm run build
npm run test:e2e
npm run package:mac
npm run package:win
```

On this Mac, full DMG creation has previously been blocked by a hanging `hdiutil` service. The macOS ZIP build is the reliable macOS package path on this machine.

## 15. Important Safety Notes

- API keys must never be committed to Git.
- API keys are local app data only.
- Export snapshots redact raw keys.
- Temporary recorded WAV files are deleted after Whisper transcription.
- Rebuildable artifacts such as `node_modules`, `dist`, Electron caches, unpacked package directories, blockmaps, and metadata can be deleted after verification to save disk space.
