# DLCF AFIT Live Bible Quiz

**Organization:** Deeper Life Campus Fellowship (DLCF), Air Force Institute of Technology (AFIT), Kaduna, Nigeria  
**Theme Scripture:** *"Study to shew thyself approved unto God, a workman that needeth not to be ashamed, rightly dividing the word of truth."* — 2 Timothy 2:15  
**Target Concurrency:** 100–250 simultaneous students over campus mobile networks (3G/4G/5G).

---

## 1. System Overview

DLCF AFIT Live Bible Quiz is a real-time, multiplayer web application engineered for campus fellowship services and Bible study reviews. It pairs a high-contrast **Host Projection Console (`/host`)** designed for fellowship hall projectors with an ultra-lightweight, zero-login **Mobile Player Client (`/play`)** accessible via a 6-digit Room PIN or projected QR code.

### Key Capabilities
- **Multi-Format Question Bank Uploader:** Supports **PDF**, **CSV**, and **JSON** file uploads with automatic parsing, validation, and sample template downloads for all 3 formats.
- **Universal & Custom Question Timers:** Configure a global round timer (e.g. 15s, 20s, 30s) across all questions with per-question override support.
- **Full-Screen 10-Second Emergency Timer:** When remaining time hits **10 seconds**, a massive, bold countdown number fills the screen with an emergency pulsing red border and audio double-ticks to signal the low-time state.
- **Live Response Distribution Bar Chart:** On answer reveal, an animated 4-column bar chart highlights student selections, rendering the **correct answer bar in vibrant emerald green** and displaying the roster of student names who picked each option.
- **Real Name Registration:** Simple, frictionless entry asking for the student's real name (e.g., *Samuel Adebayo*) and academic level (`100L`–`500L`, `PG/STAFF`).
- **Zero-Latency In-Memory DB + Supabase Fallback:** Runs completely offline with a zero-dependency in-memory mock database when Supabase is not configured, with automatic seamless failover to PostgreSQL + Supabase Realtime when deployed.
- **Server-Authoritative Anti-Cheat:** Correct options and scripture explanations are strictly withheld from client DTOs until the host reveals the answer.
- **Speed + Accuracy Scoring:** Awards `500` to `1,000` points per correct answer based on response time; `0` points on incorrect answers.
- **Instant Session Rehydration:** `localStorage` session recovery restores player state, cumulative score, and answer lockouts upon browser refresh or network signal drops.
- **Live HYPE Reactions:** Students can send live floating emoji reactions (`🔥🚀👏💡⚡`) to the hall projection screen with zero database overhead.

---

## 2. Quick Start & Setup

### 2.1 Prerequisites
- **Node.js** `v20+` or `v24+`
- **npm** `v10+`

### 2.2 Installation
```bash
# Clone the repository
git clone https://github.com/Gideonmarkson/dlcfquiz.git
cd dlcfquiz

# Install dependencies
npm install
```

### 2.3 Running Locally (Zero Configuration)
The application includes an in-memory database fallback, allowing you to start developing and testing immediately without configuring external databases:

```bash
# Start development server on port 3001
npm run dev
```

Open your browser:
- **Landing Page:** [http://localhost:3001](http://localhost:3001)
- **Host / Media Unit Console:** [http://localhost:3001/host](http://localhost:3001/host)
- **Student Join Arena:** [http://localhost:3001/play](http://localhost:3001/play)

### 2.4 Production Database Setup (Supabase - Optional)
To enable persistent multi-session history across restarts:
1. Run `supabase/migrations/001_initial_schema.sql` in your Supabase SQL editor.
2. Run `supabase/migrations/002_rpc_functions.sql` to install the atomic answer submission function.
3. Configure your environment variables in `.env.local` (see `.env.example`).

---

## 3. Architecture & User Flows

### Host Projection Console (`/host`)
1. **Setup (`/host`):** Enter session title, set universal round timer, and upload questions via **PDF**, **CSV**, or **JSON** (or click "Load 5-Question AFIT Demo Set").
2. **Lobby (`/host/[pin]`):** Displays the 6-digit PIN, high-resolution SVG QR code, and real-time roster of connected students with academic level badges.
3. **Question Active:** Displays the prompt, 4 high-contrast answer options, live response counter, and countdown timer. At 10 seconds remaining, the whole-screen bold emergency countdown activates.
4. **Answer Revealed:** Projects the Scripture verification card and the **Response Distribution Bar Chart** (with the correct answer in emerald green and student names listed per option).
5. **Leaderboard:** Displays the current Top 5 standings.
6. **Game Over:** Celebratory Top 3 Championship Podium with full rankings and CSV export.

### Mobile Player Client (`/play`)
1. **Join (`/play`):** Student enters PIN, full name, and selects academic level (`100L`–`500L` or `PG/STAFF`).
2. **Active Round:** Taps one of 4 large buttons (`A`, `B`, `C`, `D`). Button locks in immediately.
3. **Reveal & Rank:** Sees correctness status, score, scripture reference, and mobile response breakdown.
4. **HYPE Bar:** Sends live emoji reactions (`🔥`, `🚀`, `👏`, `💡`, `⚡`) to the hall screen.

---

## 4. Verification Suite

Run the built-in test suites:
```bash
# Verify scoring engine, tie-breakers, PIN generation, and anti-cheat DTO sanitization
node scripts/verify-engine.mjs

# Verify PDF question parser
node scripts/test-pdf-parser.mjs

# TypeScript type check
npx tsc --noEmit
```

---

## 5. Tech Stack

- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript 5.7
- **Styling:** Tailwind CSS v4
- **State Management:** Zustand v5
- **Realtime / DB:** Supabase (PostgreSQL + Realtime Broadcast) with In-Memory Mock Fallback
- **Parsing & Utilities:** PDF.js + PapaParse + Zod + qrcode.react + Web Audio API
