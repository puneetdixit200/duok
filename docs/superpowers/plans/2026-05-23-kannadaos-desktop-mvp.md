# KannadaOS Desktop MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Mac and Windows desktop implementation of the KannadaOS learning spec in `/Users/deepakkudi23/Downloads/duo.md`, verify it end to end, clean generated artifacts, and commit/push the source to `puneetdixit200/duok`.

**Architecture:** The repository is empty and Flutter/Xcode are not available on this laptop, so the deliverable uses Electron + Vite + React + TypeScript for a cross-platform desktop app that can be packaged for macOS and Windows from macOS. The MVP implements the spec's walking skeleton and visible core screens: onboarding, home map, lesson exercises, practice/review, Bangalore mode, AI chat, profile, and an Ollama-backed exercise generator with deterministic offline fallback.

**Tech Stack:** Electron, React, TypeScript, Vite, Vitest, Testing Library, Playwright Electron, electron-builder, localStorage persistence, optional Ollama HTTP at `http://localhost:11434`.

---

### Task 1: Scaffold Desktop App

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `electron/main.cjs`
- Create: `electron/preload.cjs`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vitest.setup.ts`

- [ ] **Step 1: Generate a Vite React TypeScript app**

Run: `npm create vite@latest . -- --template react-ts`
Expected: Vite creates the renderer skeleton inside the empty Git repository.

- [ ] **Step 2: Install desktop and test dependencies**

Run: `npm install` followed by `npm install -D electron electron-builder concurrently wait-on cross-env vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom playwright`
Expected: dependencies install without security or engine failures.

- [ ] **Step 3: Replace generated scripts with Electron scripts**

Set `package.json` scripts to include `dev`, `build`, `test`, `test:e2e`, `package:mac`, `package:win`, and `package:all`.

### Task 2: Test Core Learning Contracts First

**Files:**
- Create: `src/domain/curriculum.test.ts`
- Create: `src/domain/progress.test.ts`
- Create: `src/services/ollama.test.ts`
- Create: `src/App.test.tsx`

- [ ] **Step 1: Write failing curriculum tests**

Test that Level 1 has at least 20 survival items, covers translate/match/arrange/fill/listen/speak exercise types, and exposes Bangalore-context phrases.

- [ ] **Step 2: Write failing progress tests**

Test that completing an exercise updates XP, streak, hearts, lesson progress, weak-area counts, and review queue due dates.

- [ ] **Step 3: Write failing Ollama tests**

Test that valid Ollama JSON is parsed into an exercise, malformed JSON falls back to a local exercise, and network errors never crash the caller.

- [ ] **Step 4: Write failing app tests**

Test onboarding-to-home, lesson answer checking, chat fallback response, practice flashcard flip, Bangalore scenario visibility, and profile stats rendering.

### Task 3: Implement Data, Services, and UI

**Files:**
- Create: `src/domain/curriculum.ts`
- Create: `src/domain/progress.ts`
- Create: `src/services/ollama.ts`
- Create: `src/types.ts`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Implement the curriculum model**

Build deterministic Kannada curriculum data with lesson metadata, phrases, exercises, scenarios, stories, and review vocabulary from the spec.

- [ ] **Step 2: Implement progress state**

Store progress in localStorage with pure reducer helpers for tests and a resettable default state.

- [ ] **Step 3: Implement Ollama integration**

Use `fetch` against `/api/generate` with JSON-only prompt instructions, code-block JSON extraction, common parse repair, and fallback exercises.

- [ ] **Step 4: Implement the renderer**

Build a dense desktop dashboard with spec-inspired dark theme, onboarding, home, lesson, practice, Bangalore mode, chat, profile, and model status panels.

### Task 4: End-to-End Verification

**Files:**
- Create: `scripts/e2e-electron.cjs`

- [ ] **Step 1: Write Electron E2E script**

Launch the packaged renderer in Electron, check for console/page errors, navigate all primary tabs, complete a lesson answer, exercise chat, and probe Ollama live status when available.

- [ ] **Step 2: Run unit and component tests**

Run: `npm test`
Expected: all Vitest tests pass.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: TypeScript and Vite complete successfully.

- [ ] **Step 4: Run Electron E2E**

Run: `npm run test:e2e`
Expected: Electron launches, app renders, all primary flows pass, and Ollama is either verified live or reported unavailable with fallback behavior passing.

### Task 5: Package and Clean

**Files:**
- Modify: `.gitignore`
- Modify: `README.md`

- [ ] **Step 1: Build macOS package**

Run: `npm run package:mac`
Expected: electron-builder creates a macOS artifact in `dist/`.

- [ ] **Step 2: Build Windows package**

Run: `npm run package:win`
Expected: electron-builder creates a Windows portable artifact in `dist/`.

- [ ] **Step 3: Record verification in README**

Document app scope, scripts, Ollama behavior, and the latest verification commands.

- [ ] **Step 4: Clean generated artifacts**

Remove `dist/`, `node_modules/`, and package caches that are not source-controlled after verification if space pressure requires it.

- [ ] **Step 5: Commit and push**

Run: `git add . && git commit -m "Build KannadaOS desktop MVP" && git push origin main`
Expected: the source is pushed to `https://github.com/puneetdixit200/duok.git`.
