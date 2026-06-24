# CLAUDE.md — EPIC Campus
> Project-specific context. Overrides master CLAUDE.md on conflicts.
> Last updated: June 2026

---

## PROJECT IDENTITY

**Product:** Epic Campus (`epiccampus.live`)
**Company:** EPIC (`epiccampusdigital-stack`)
**Owner:** Yesh — solo builder, no dev team
**Purpose:** Multi-role student management system for a Sri Lankan overseas education institute (Galle). Students prepare for Japan SSW, Korea, China, IELTS, NVQ pathways.
**GitHub:** `epiccampusdigital-stack/epic-campus-main`
**Local path:** `D:\Projects\epic-campus-main`
**Priority:** 2nd after EPIC IELTS

---

## TECH STACK

- **Frontend:** Next.js 14 App Router + TypeScript + Tailwind CSS
- **Backend:** Firebase (Auth, Firestore, Storage, Hosting + Cloud Functions via firebase-frameworks)
- **AI:** Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) — study assistant
- **Payments:** Stripe LKR
- **Messaging:** Twilio WhatsApp
- **Charts:** Recharts
- **IDE:** Claude Code (VS Code) primary, Cursor occasional

---

## NODE / ENVIRONMENT

```powershell
# Node v22 — must set PATH each terminal session
$env:PATH = "C:\nodejs22\node-v22.13.0-win-x64;" + $env:PATH
$env:NODE_OPTIONS="--max-old-space-size=8192"
$env:NEXT_DISABLE_GOOGLE_FONTS="1"
```

**Dev server:**
```powershell
node node_modules/next/dist/bin/next dev -p 3003
# Runs at localhost:3003
```

---

## DEPLOY COMMAND (exact order, every time)

```powershell
$env:PATH = "C:\nodejs22\node-v22.13.0-win-x64;" + $env:PATH
$env:NODE_OPTIONS="--max-old-space-size=8192"
cmd /c "rd /s /q .next"
npm run build
npx firebase deploy --only hosting
# Type 30 at container prompt
```

**After hosting deploy:**
```powershell
npx firebase deploy --only firestore:rules   # when rules changed
npx firebase deploy --only firestore:indexes  # when indexes changed
npx firebase deploy --only storage            # when storage.rules changed
git add -A
git commit -m "your message"
git push origin main
```

---

## CRITICAL DEPLOY RULES

- ALWAYS `--only hosting` — NEVER `--only hosting:epic-campus` (breaks SSR)
- ALWAYS delete `.next` before building
- TSC must pass (`npx tsc --noEmit`) before any build attempt
- NEVER auto-deploy — Yesh runs deploy manually
- Cache fix: delete `.next` and `.firebase` folders if webpack errors appear
- Disk: `.next` and `functions/node_modules` are large — clear periodically from D: drive

---

## BRAND DESIGN SYSTEM

| Token | Hex |
|---|---|
| Navy (primary) | `#0B3D6B` |
| Gold (accent) | `#E8A020` |
| Light blue | `#1A6BAD` |
| Background | `#F5F7FB` |
| Text muted | `#5A6A7A` |
| Dark text | `#0D1B2A` |
| Border | `#DDE3EC` |

**Typography:** `font-jakarta` (headings), `font-inter` (body)
**Icons:** Tabler Icons via `ti-*` class names
**No emoji in SVG/canvas** — use inline SVG icons (html2canvas compat)
**Logo:** `/images/logo-transparent.png`

---

## ROUTE GROUPS
(student)     — student portal

/epic-wall              ← LOGIN LANDING (first page after login)

/exams                  ← exam paper list

/exams/[paperId]        ← exam taking UI

/my-dashboard

/my-id

/my-payments

/my-schedule            ← Day/Week/Month calendar

/my-visa

/book-consultation

/my-results

/my-materials

/student/assistant      ← AI study chatbot

/student/payments       ← Stripe payment page
(management)  — staff portal

/dashboard

/students / /students/[id]

/staff

/payments / /payments/tracker

/schedule

/sessions

/admin-exams            ← teacher exam builder

/admin/epic-wall        ← admin post publisher

/enrollments

/attendance

/crm

/accommodation / /accommodation/[houseId]

/utility-bills

/kitchen/*

/reports

/payroll

...
(auth)        — /login, /signup

(examination) — existing IELTS-style exam system (separate from new JFT system)

---

## USER ROLES

`admin` `owner` `reception` `teacher` `examCoordinator` `accountant` `agent` `kitchen` `student`

Custom claims set via `adminAuth.setCustomUserClaims(uid, { role })` at account creation.
Always check role in Firestore rules AND in UI rendering.

---

## KEY FIRESTORE COLLECTIONS
students                  — student profiles

users                     — staff accounts (all non-student roles)

sessions                  — class sessions (courseId, date, startTime, endTime, teacherName, location, notes, joinLink)

schedule                  — management schedule view (ScheduleSession type)

payments                  — payment records

studentPaymentPlans       — installment schedules (used by payment tracker)

examPapers                — JFT/SSW exam papers (isPublished, order, timeLimitSeconds, passMark)

examSections              — sections within a paper (paperId, name, order)

examQuestions             — MCQ questions (paperId, sectionId, options[], correctIndex, questionAudioUrl, questionImageUrl)

examAttempts              — student exam results (studentId, paperId, correctCount, marks250, percentage)

examAttemptAnswers        — per-question answers (attemptId, questionId, selectedIndex, isCorrect)

epicWallPosts             — social feed posts

epicWallComments          — post comments

epicWallReactions         — likes/celebrates/saves

epicWallStories           — story images

visaDocuments             — student visa doc uploads

roomSlots                 — consultation room availability

roomBookings              — student bookings

aiChatHistory             — AI tutor message history (subcollection: aiChatHistory/{studentId}/messages)

studySessions             — AI session tracking

accommodations            — student house assignments

---

## KEY FILES
src/types/index.ts                          — ALL TypeScript interfaces

src/lib/firebase/client.ts                  — Firebase client (db, storage, auth)

src/lib/firebase/admin.ts                   — Firebase Admin SDK

src/lib/ai/studyModes.ts                    — AI chatbot system prompts + Epic Campus knowledge base

src/components/student/StudentContext.tsx   — student auth context (useStudentPortal)

src/components/layout/ManagementContext.tsx — staff auth context (useManagement)

src/app/(auth)/login/page.tsx               — login + getRedirectPath (students → /epic-wall)

firestore.rules                             — Firestore security rules

firestore.indexes.json                      — composite indexes (15 indexes)

storage.rules                               — Storage security rules

---

## KNOWN GOTCHAS (Epic Campus specific)

| Gotcha | Rule |
|---|---|
| `--only hosting:epic-campus` | NEVER — skips SSR Cloud Function, breaks site |
| `.next` cache | Delete before every deploy |
| `emoji-mart` / `@emoji-mart/data` | Must stay in `serverExternalPackages` + webpack externals |
| `firebase-frameworks` Node warning | Cosmetic only — deploys fine |
| Storage `{allPaths=**}` | Required for wildcard path matching in rules |
| html2canvas + emoji | Use inline SVG icons only, never emoji in canvas elements |
| Decimal precision | Never round quantity fields anywhere in kitchen/payments |
| `uid` field in Firestore | Write `uid` immediately after `createUser` — don't rely on doc ID |
| Disk space on D: | Clear `.next` and `functions/node_modules` regularly |
| Firestore composite indexes | Any `where()` + `orderBy()` combo needs an index in `firestore.indexes.json` |
| TSC `noUnusedLocals` | Remove unused imports — TSC will fail otherwise |
| Student ID card download | Uses SVG serialization (not html2canvas) — keep card as pure SVG |

---

## CODING RULES (inherited from master, reinforced here)

- **Surgical only** — touch only files needed for the task
- **TSC clean** after every change — `npx tsc --noEmit`
- **Read before write** — always read target files before editing
- **No placeholder data** in production
- **No auto-deploy** — surface the command for Yesh
- **Data model first** — schema → Firestore rules → UI
- **Batch 3-5 changes** per prompt, not one massive sweep
- **Verify with `Select-String`** after any Cursor run

---

## SESSION START CHECKLIST
□ git pull

□ $env:PATH = "C:\nodejs22\node-v22.13.0-win-x64;" + $env:PATH

□ Is dev server running? (port 3003)

□ Which feature are we building?

□ TSC clean before starting? npx tsc --noEmit

---

_Project-specific file — wins over master CLAUDE.md on any conflict._
_Update when new Epic Campus rules are discovered._
