# EPIC Campus — Project Brief

**Repo:** `epiccampusdigital-stack/epic-campus-main` · **Branch:** `main` @ `0433a90`
**Audited:** 19 Aug 2026 · 404 TypeScript/TSX files · read-only pass against actual source
**Scope of confidence:** every claim below is cited to a file and line. Where I inferred rather than
verified, the line is prefixed **[INFERENCE]**. Runtime state (live Firestore contents, actual
Firebase/Vercel project config, Twilio console settings) was not accessible and is listed in §11.

---

## 1. Stack and Verification

### 1.1 Full stack

| Layer | Actual |
|---|---|
| Frontend framework | Next.js **14.2.35** App Router, React 18, TypeScript 5 ([package.json](package.json)) |
| Build tool | Next's own bundler (webpack), custom overrides in [next.config.mjs](next.config.mjs) |
| Styling | Tailwind CSS 3.4 + Tabler Icons (`ti-*` class names) |
| Backend runtime | Node 22 — no separate backend. Next.js Route Handlers under [src/app/api/](src/app/api/) (63 routes) |
| Backend framework | None. Route Handlers + Firebase Admin SDK 13 |
| **ORM** | **None.** Direct Firestore SDK calls, client-side and admin-side. No Prisma/Drizzle/TypeORM |
| Database | Cloud Firestore (document store). Schema is convention-only; the closest thing to a schema is [src/types/index.ts](src/types/index.ts) (871 lines) and four Zod files in [src/lib/schemas/](src/lib/schemas/) |
| Hosting | Firebase Hosting + `frameworksBackend` SSR Cloud Function, `us-central1`, 1 GiB, 120 s timeout, **maxInstances 10, minInstances 0** ([firebase.json](firebase.json)) |
| Auth | Firebase Auth (email/password + Google). Role delivered as a **custom claim** set server-side at [src/app/api/auth/session/route.ts:49](src/app/api/auth/session/route.ts#L49). Session = the raw Firebase ID token stored in an `epic-session` httpOnly cookie ([route.ts:70-76](src/app/api/auth/session/route.ts#L70-L76)) |
| File storage | Firebase Storage ([storage.rules](storage.rules)) |

### 1.2 Third-party services with keys or SDKs

Verified from [.env.local](.env.local) variable names and import sites. **No secret values are reproduced here.**

| Service | Purpose | Key env vars | Code |
|---|---|---|---|
| Firebase (client + Admin) | Auth, Firestore, Storage, Hosting | `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_ADMIN_*` / `FIREBASE_*` | [client.ts](src/lib/firebase/client.ts), [admin.ts](src/lib/firebase/admin.ts) |
| **Anthropic** | 15 route handlers — study assistant, question generation, exam marking, lead agent, finance/kitchen summaries | `ANTHROPIC_API_KEY` | `@anthropic-ai/sdk` ^0.100.1 + raw `fetch` to `api.anthropic.com` |
| **Twilio** | WhatsApp messaging, OTP, 2FA, voice spike | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | [src/lib/twilio.ts](src/lib/twilio.ts), [src/lib/twilio/helpers.ts](src/lib/twilio/helpers.ts) |
| **Stripe** | Card payments (LKR) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | [src/app/api/stripe/](src/app/api/stripe/) |
| **PayPal** | Alternate payment rail | `PAYPAL_SECRET`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `NEXT_PUBLIC_PAYPAL_MODE` | [src/app/api/paypal/](src/app/api/paypal/) |
| `NEXTAUTH_SECRET` | **Vestigial** — NextAuth is not a dependency and is imported nowhere. Dead env var. |
| `CRON_SECRET` | Shared secret for [src/app/api/cron/re-engage-leads/route.ts](src/app/api/cron/re-engage-leads/route.ts) |

Client-side libraries with no external service: `pdf-lib` + `jspdf` (PDFs), `recharts` (charts),
`three` / `@react-three/fiber` (landing-page 3D), `xlsx`, `html2canvas`, `qrcode.react`,
`pdf-parse`, `sharp`, `zod`.

`.env.local` is correctly gitignored and **not tracked** (`git ls-files` returns only
`.env.local.example`). Note that `firebase-tools` copies `.env.local` into the deployed function
bundle — this is how runtime secrets reach production, and it is why
[.github/workflows/deploy.yml](.github/workflows/deploy.yml) is `workflow_dispatch`-only with a
comment explaining that a CI deploy would produce a credential-less backend.

### 1.3 Your claims, checked

> **"Multi-role system (at minimum student / teacher / admin)"**

**CONFIRMED, and significantly understated.** There are **eleven** roles, not three
([src/types/index.ts:1-12](src/types/index.ts#L1-L12)): `admin`, `owner`, `reception`,
`accountant`, `teacher`, `examCoordinator`, `agent`, `student`, `company`, `parent`, `kitchen`.
Six distinct portals exist with their own layouts and sidebars. Full enumeration in §2.

> **"Japanese and Korean language courses, and IT skills training"**

**PARTIALLY TRUE.** The `CourseId` union at [src/types/index.ts:14](src/types/index.ts#L14) has
**nine** courses:

`japan-ssw` · `korea-d2d4` · `china` · `ielts` · `nvq-it` · `nvq-hospitality` ·
`nvq-caregiving` · `nvq-construction` · `nvq-logistics`

- Japanese ✓ and Korean ✓ — confirmed.
- "IT skills training" → `nvq-it` exists, but it is **one of five** NVQ vocational tracks, not the
  IT-focused offering your phrasing implies.
- **Missing from your model:** Chinese and IELTS are full first-class courses with their own
  landing pages ([src/app/china/](src/app/china/), [src/app/ielts/](src/app/ielts/)), plus NVQ
  Hospitality, Caregiving, Construction and Logistics.

More importantly, **this is not a course platform — it is an institute ERP.** Beyond teaching it
runs: a kitchen/canteen with inventory, meal logs, waste tracking and budget
([src/app/kitchen/](src/app/kitchen/), 8 pages); student housing with per-house bills, inventory and
rent ([src/app/(management)/accommodation/](src/app/(management)/accommodation/)); payroll;
utility bills; a CRM with agent commissions; and a **partner-company recruitment pipeline** that
shortlists students to Japanese employers ([src/app/company/](src/app/company/)). Your brief
described maybe a third of the system.

> **"Produces exam timetable displays and student result PDFs"**

**PARTIALLY TRUE on timetables; WRONG on result PDFs.**

- *Timetables:* schedule views exist and work — management
  [src/app/(management)/schedule/page.tsx](src/app/(management)/schedule/page.tsx) and student
  day/week/month [src/app/(student)/my-schedule/page.tsx](src/app/(student)/my-schedule/page.tsx).
  But there is **no dedicated exam timetable**. Exams are ordinary `sessions` rows with
  `type: 'exam'` ([src/types/index.ts:378](src/types/index.ts#L378)) rendered in red
  ([src/lib/schedule/helpers.ts:62](src/lib/schedule/helpers.ts#L62)). There is **zero conflict
  detection** anywhere in the codebase — see §6.
- *Result PDFs:* **no such thing exists.** I grepped every PDF-producing module. The complete list
  is: completion **certificates** ([src/lib/certificates/generateCertificate.ts](src/lib/certificates/generateCertificate.ts)),
  enrollment/exam certificates ([src/lib/generatePDF.ts](src/lib/generatePDF.ts)), payment receipts
  ([src/lib/payments/downloadReceiptPdf.ts](src/lib/payments/downloadReceiptPdf.ts)), and three
  kitchen reports. **Exam results are screen-only** —
  [src/app/(student)/my-results/page.tsx](src/app/(student)/my-results/page.tsx) renders cards and
  offers exactly one download button, and that button produces a *certificate*, not a result sheet
  ([my-results/page.tsx:100-130](src/app/(student)/my-results/page.tsx#L100-L130)).

  If you have been telling staff or students that the system issues result PDFs, that is not true
  today.

> **"Earlier exploration of 'AI E-Learning Mode' and adaptive exam systems"**

**Neither exists under those names, and adaptive examining does not exist at all.**
`grep -i "e-learning|elearning|adaptive"` across `src/` returns exactly **one** hit, and it is
marketing copy on the About page ([src/app/(public)/about/page.tsx:106](src/app/(public)/about/page.tsx#L106)).

What actually got built is described in §7. Short version: a *shipped* AI Study Assistant with seven
**fixed** modes ([src/types/index.ts:700-707](src/types/index.ts#L700-L707)) — no difficulty
adaptation, no performance-driven question selection, no item-response logic anywhere. Exams are
fixed papers with fixed question sets. The AI work that did get real investment went into
**lead conversion over WhatsApp**, not learning.

---

## 2. Roles and Access Control — the centrepiece

### 2.1 The enforcement model, stated plainly

There are three candidate enforcement layers. **Only one of them actually enforces anything.**

| Layer | Status |
|---|---|
| **Server-side route guards** — `guardManagement`, `guardStudent`, `guardExamination`, `guardBusiness` ([src/lib/auth/roleGuard.ts:1-35](src/lib/auth/roleGuard.ts#L1-L35)) | **DEAD CODE.** Zero import sites. `grep -rn "guardManagement\|guardStudent\|guardExamination\|guardBusiness" src/` returns only the four definitions themselves. `getSession`/`requireRole` ([src/lib/auth/session.ts](src/lib/auth/session.ts)) are likewise consumed only by this dead module. **No page in this application performs a server-side role check.** |
| **Middleware** ([src/middleware.ts](src/middleware.ts)) | Gates **six finance prefixes only** ([L13-20](src/middleware.ts#L13-L20)). Everything else passes through. And the role is read by base64-decoding the JWT payload **without verifying the signature** ([L27-42](src/middleware.ts#L27-L42)) — trivially forgeable. The code says so itself at [L22-24](src/middleware.ts#L22-L24): *"This is UX-level route gating only."* That comment is honest; treat the middleware as **not a security control**. |
| **Firestore + Storage security rules** ([firestore.rules](firestore.rules), 636 lines; [storage.rules](storage.rules)) | **This is the entire security perimeter.** Every finding in §2.3 follows from that fact. |

Layout files are all `'use client'` and gate by reading `users/{uid}` in the browser and calling
`router.replace()` — e.g. [(management)/layout.tsx:46-50](src/app/(management)/layout.tsx#L46-L50),
[(student)/layout.tsx:84-87](src/app/(student)/layout.tsx#L84-L87). A determined user bypasses the
redirect; whether they *get data* depends entirely on the rules.

For most collections the rules do hold. §2.3 is where they don't.

### 2.2 Role inventory

| Role | Portal | What it can do | Enforced where |
|---|---|---|---|
| `owner` | `(management)` | Everything. Present in nearly every rule allowlist | Rules |
| `admin` | `(management)` | Everything except a handful of owner-only writes | Rules |
| `reception` | `(management)` | Students (create/update), CRM/leads, payments incl. front-desk collection, attendance, enrollments, broadcast, visa tracker | Rules; sidebar filtering [ManagementSidebar.tsx:31-73](src/components/layout/ManagementSidebar.tsx#L31-L73) |
| `accountant` | `(management)` + finance | Payments, payroll, expenses, utility bills, accommodation finance, kitchen budget | Rules + the **only** middleware gate ([middleware.ts:11-20](src/middleware.ts#L11-L20)) |
| `teacher` | `(management)` | Own dashboard, students (read + **update**), attendance, sessions, lesson plans, materials, exam building, exam results | Rules |
| `examCoordinator` | `(examination)` | Exam papers/sections/questions CRUD, results. **Not** in `MANAGEMENT_ROLES` ([roles.ts:17](src/lib/constants/roles.ts#L17)) so the management layout bounces them to `/login` | Rules; layout redirect |
| `agent` | `(portal)/agent` | Own commission rows only — correctly scoped at [firestore.rules:338-345](firestore.rules#L338-L345) |
| `student` | `(student)` | Own profile, payments, results, materials, schedule, visa docs, AI assistant, Epic Wall | Rules |
| `parent` | `/parent` | One linked child's dashboard/attendance/payments/results/visa | Rules via `users/{uid}.studentId` lookups |
| `company` | `/company` | Partner-employer candidate shortlists | **See CRITICAL-3 — effectively unenforced** |
| `kitchen` | `/kitchen` | Inventory, meal logs, orders, waste, menus | Rules |

Note `examCoordinator` is absent from `MANAGEMENT_ROLES` but present in `EXAM_ROLES` and
`EXAM_MANAGEMENT_ROLES` ([roles.ts:17-22](src/lib/constants/roles.ts#L17-L22)) — a coordinator
therefore cannot reach `/exam-results`, which the sidebar advertises to them at
[ManagementSidebar.tsx:68](src/components/layout/ManagementSidebar.tsx#L68). Cosmetic bug, no
security impact.

### 2.3 🔴 Findings — read these

Ordered by consequence. Every one verified against source.

---

#### 🔴 CRITICAL-1 — Unauthenticated Stripe webhook → forge payments, mint student accounts

**`src/app/api/stripe/webhook/route.ts:39-44`**

```js
if (!webhookSecret || webhookSecret.startsWith('whsec_placeholder')) {
  console.log('[Stripe webhook] Secret not configured — skipping verification')
  event = JSON.parse(body) as Stripe.Event      // ← unsigned body, trusted
}
```

**`STRIPE_WEBHOOK_SECRET` in `.env.local` literally begins `whsec_placehol`.** The bypass branch is
the live branch. Signature verification is **off in production right now.**

Chained with [firestore.rules:227-235](firestore.rules#L227-L235) — `enrollmentApplications` has
`allow create: if true`, i.e. **unauthenticated writes** — the full attack is:

1. Anonymous client SDK write → create an `enrollmentApplications` doc with any name/email/phone.
2. `POST /api/stripe/webhook` with a hand-written `checkout.session.completed` body carrying that
   `enrollmentId` and `amount_total: 8500000`.
3. Handler ([webhook/route.ts:60-135](src/app/api/stripe/webhook/route.ts#L60-L135)) marks
   `registrationFeePaid`/`courseFeePaid`/`status: 'confirmed'`, calls `adminAuth.createUser()`,
   writes a `students` doc **and** a `users` doc with `role: 'student'`, and WhatsApps the temp
   password to an attacker-supplied number ([L137-142](src/app/api/stripe/webhook/route.ts#L137-L142)).

Net effect: **anyone on the internet can enroll for free and self-provision an authenticated account
inside your system.** That account then inherits every `request.auth != null` grant below.

Fix is one line — set the real webhook secret — but the `startsWith('whsec_placeholder')` escape
hatch should be deleted so this cannot silently recur.

---

#### 🔴 CRITICAL-2 — Storage: any logged-in user can read, overwrite and delete every student's documents

**`storage.rules:5-19`**

```
match /students/{allPaths=**} { allow read: if request.auth != null;
                                allow write: if request.auth != null; }
match /visaDocs/{allPaths=**} { allow read: if request.auth != null;
                                allow write: if request.auth != null;
                                allow delete: if request.auth != null; }
```

No ownership predicate. One student — or any account created via CRITICAL-1 — can enumerate and
download **every** student's uploaded files, and **delete** them.

`visaDocs/` is the worst case: [src/lib/visa/documents.ts](src/lib/visa/documents.ts) and
[src/app/(student)/my-visa/page.tsx](src/app/(student)/my-visa/page.tsx) drive passport scans, birth
certificates and financial statements through this prefix. **Many of these students are minors.**
This is the single most serious data-exposure finding in the audit, and `allow delete` makes it a
data-loss finding too.

Contrast [storage.rules:60-65](storage.rules#L60-L65), where `payment-receipts/{userId}/` *is*
correctly scoped by `request.auth.uid == userId`. The pattern was known; it just wasn't applied.

---

#### 🔴 CRITICAL-3 — `partnerCompanies` and `candidateShortlists` are wide open to every authenticated user

**`firestore.rules:155-161`**

```
match /partnerCompanies/{docId}    { allow read, write: if request.auth != null; }
match /candidateShortlists/{docId} { allow read, write: if request.auth != null; }
```

Read **and write**, no role check. `CandidateShortlist`
([src/types/index.ts:616-636](src/types/index.ts#L616-L636)) is the record of which students are
being put forward to which Japanese employers. Any student can read the entire pipeline for every
student, and can **modify or delete** shortlist entries — changing who gets presented for a job.

This is also why the `company` role has no meaningful enforcement: the collections its portal reads
are open to everyone anyway.

---

#### 🔴 CRITICAL-4 — Exam integrity: answer key readable, score self-writable, marking endpoint unauthenticated

Four independent breaks, any one of which is sufficient:

1. **Answer key is client-readable.** [firestore.rules:110-114](firestore.rules#L110-L114) —
   `examQuestions` `allow read: if request.auth != null`, and the docs carry `correctIndex`
   ([src/types/index.ts:834](src/types/index.ts#L834)). The rules file acknowledges this at
   [L107-109](firestore.rules#L107-L109). Any student can pull the key from the browser console
   before or during the exam.

2. **Scoring happens in the browser.**
   [(examination)/exams/[paperId]/page.tsx:242-260](src/app/(examination)/exams/[paperId]/page.tsx#L242-L260):
   ```js
   const correct = questions.filter(q => Number(answers[q.id]) === Number(q.correctIndex)).length
   ...
   await addDoc(collection(db, 'examAttempts'), { score: correct, percentage: pct, ... })
   ```
   The client computes the mark and writes it. `examAttempts` `allow create: if request.auth != null`
   ([firestore.rules:121](firestore.rules#L121)) — no validation of the submitted score.

3. **Students can edit their own results after the fact.**
   [firestore.rules:122-125](firestore.rules#L122-L125) — `allow update` includes
   `resource.data.studentId == request.auth.uid`. A student can rewrite `percentage`, `grade` and
   `totalScore` on a completed attempt at any time, with no audit record.

4. **The AI marking endpoint has no auth and writes scores with the Admin SDK.**
   [src/app/api/exam/mark-writing/route.ts:8-26](src/app/api/exam/mark-writing/route.ts#L8-L26)
   accepts `attemptId` from an anonymous POST body and at
   [L74-95](src/app/api/exam/mark-writing/route.ts#L74-L95) writes `score` and `markingStatus:
   'complete'` into `examAttempts/{attemptId}/writingSubmissions/*`, bypassing rules entirely.
   Same shape at [src/app/api/exam/mark-speaking/route.ts](src/app/api/exam/mark-speaking/route.ts).

**Also:** the "exam code" gate is decorative. `examPapers` is readable by any authenticated user
([firestore.rules:95-99](firestore.rules#L95-L99)), so a student can list every paper ID and
navigate straight to `/exams/{id}`, skipping
[(student)/exam-code/page.tsx](src/app/(student)/exam-code/page.tsx) entirely. `maxAttempts` is
likewise enforced only in the client at
[page.tsx:285](src/app/(examination)/exams/[paperId]/page.tsx#L285).

---

#### 🔴 CRITICAL-5 — Four unauthenticated API routes that act on real student records

All four use the Admin SDK, which **bypasses Firestore rules completely**.

| Route | What an anonymous POST achieves |
|---|---|
| [`/api/certificates/generate`](src/app/api/certificates/generate/route.ts) **:19-22** | Body is `{ studentId }`, nothing else. Returns a **completion certificate PDF containing the student's name, course and batch**, writes a permanent `certificates` record, and **WhatsApps the student's phone** ([L77-90](src/app/api/certificates/generate/route.ts#L77-L90)). Enumerate IDs → harvest names/courses and spam every student. |
| [`/api/audit/log`](src/app/api/audit/log/route.ts) **:8-38** | Writes arbitrary `userId`, `userEmail`, `userRole`, `action`, `details` into `auditLog`. **Anyone can forge or flood the audit trail.** This destroys the evidential value of the one collection whose whole purpose is evidence — and the rules correctly make it client-unwritable ([firestore.rules:71-75](firestore.rules#L71-L75)), so this route is the *only* way in and it's open. |
| [`/api/notify`](src/app/api/notify/route.ts) **:4-34** | Sends an arbitrary WhatsApp to an arbitrary number on EPIC's Twilio account. Direct billing exposure, sender-reputation risk, and a ready-made phishing channel branded as EPIC. |
| [`/api/exam/mark-writing`](src/app/api/exam/mark-writing/route.ts), [`/api/exam/mark-speaking`](src/app/api/exam/mark-speaking/route.ts) | Rewrite marks — see CRITICAL-4(4). |

---

#### 🟠 HIGH-1 — Students can rewrite their own student record, unrestricted

**`firestore.rules:32-36`**

```
allow update: if request.auth != null && (
  request.auth.uid == studentId || resource.data.uid == request.auth.uid || <staff roles> );
```

No field mask. A student can set their own `paymentStatus: 'paid'`, zero their `pendingAmount`,
change `feeAmount`, `batchId`, `status`, `courseId`, or rotate their own `parentAccessCode`
(disconnecting a guardian). `Student` has 40+ fields ([types/index.ts:124-184](src/types/index.ts#L124-L184))
and every one is writable by the subject.

The finance dashboards read straight off these fields, so this is a **books-corruption** vector as
much as a privacy one.

---

#### 🟠 HIGH-2 — `/api/chat` and `/api/chat/stream` are an open, unmetered proxy to your Anthropic key

**`src/app/api/chat/route.ts:22-41`**

```js
const { sessionId, userMessage, ...anthropicBody } = body
...
body: JSON.stringify(anthropicBody),   // forwarded verbatim
```

No auth, no rate limit, no allowlist on `model`, **no cap on `max_tokens`** — the caller controls
all three. Anyone who finds `https://www.epiccampus.live/api/chat` can run arbitrary prompts against
the most expensive model available on your account, in a loop.
[chat/stream/route.ts:28-31](src/app/api/chat/stream/route.ts#L28-L31) has the same defect
(`body.max_tokens ?? 1024` — caller wins).

[`/api/student-risk`](src/app/api/student-risk/route.ts),
[`/api/kitchen-ai`](src/app/api/kitchen-ai/route.ts),
[`/api/whatsapp-draft`](src/app/api/whatsapp-draft/route.ts),
[`/api/exam/generate-questions`](src/app/api/exam/generate-questions/route.ts) and
[`/api/admin-exams/generate-questions`](src/app/api/admin-exams/generate-questions/route.ts) are
also unauthenticated Anthropic callers; they at least pin the model server-side, so the exposure is
volume rather than per-call cost.

---

#### 🟠 HIGH-3 — Twilio webhook signature validation is off; the WhatsApp AI agent is drivable by anyone

[whatsapp/webhook/route.ts:34-38](src/app/api/whatsapp/webhook/route.ts#L34-L38) skips validation
unless `TWILIO_VALIDATE_WEBHOOK === 'true'`. **That variable does not appear in `.env.local`** (nor
does `TWILIO_WEBHOOK_URL`). So the check short-circuits to `return true` and any POST reaches the
370-line handler, which loads the knowledge base, calls Claude, writes `leads`/`messages`, and sends
WhatsApp replies.

The code comment frames this as deliberate ("so a misconfigured URL can't silently take the whole
line down"), which is a reasonable trade-off *if the flag is set in production*. It isn't.

---

#### 🟠 HIGH-4 — 2FA and OTP are bypassable by design

- [`/api/twilio/send-2fa`](src/app/api/twilio/send-2fa/route.ts) **:7-21** — unauthenticated. Takes
  `{ userId, phone }` and writes `twoFactorCodes/{userId}`. An attacker sets the code for *someone
  else's* uid and has it delivered to **their own** phone.
- [`/api/twilio/verify-2fa`](src/app/api/twilio/verify-2fa/route.ts) **:6-22** — unauthenticated,
  no attempt counter, no lockout, no rate limit. Six digits, five-minute window, unlimited guesses.
- [firestore.rules:601-608](firestore.rules#L601-L608) — a user can **read their own**
  `otpVerifications` and `twoFactorCodes` document straight from Firestore, i.e. read the code
  without possessing the phone. And `otpVerifications` is `allow write` to self, so
  `verified: true` can be self-asserted.

Mitigating: 2FA appears to be wired but inert — [login/page.tsx:297](src/app/(auth)/login/page.tsx#L297)
carries a comment that the routes are "preserved" while the flow is bypassed. **[INFERENCE]** I read
this as 2FA being disabled in practice, which limits current exposure but leaves live, abusable
endpoints.

---

#### 🟠 HIGH-5 — Cross-student reads via over-broad rules

| Collection | Rule | Exposure |
|---|---|---|
| `attendance` | [180-184](firestore.rules#L180-L184) — `allow read: if request.auth != null` | Every student can read **every** student's attendance history, with `studentName` and `studentCode` denormalised in ([types:206-221](src/types/index.ts#L206-L221)) |
| `parentPortalCodes` | [361-365](firestore.rules#L361-L365) — read by any authenticated user | Docs hold `{ code, studentId, studentName }` ([StudentForm.tsx:562-568](src/components/students/StudentForm.tsx#L562-L568)). A full listing of guardian codes mapped to student names |
| `messageThreads` + `/messages` subcollection | [499-504](firestore.rules#L499-L504) — `allow read, write: if request.auth != null` | Any authenticated user reads and writes any thread |
| `certificates` | [581-587](firestore.rules#L581-L587) — `allow read: if true` | Intended for public `/verify`, but it grants **unauthenticated listing of the whole collection**: every graduate's name, course, batch and student code. A bulk PII dump reachable without login |
| `epicWallPosts`, `epicWallComments` | [418-438](firestore.rules#L418-L438) — `allow read: if true` | The student social feed — names and free text, written largely by minors — is world-readable |
| `notifications` | [163-168](firestore.rules#L163-L168) — `allow create: if request.auth != null` | Any user can inject notifications for any user |

---

#### 🟡 MEDIUM-1 — The "immutable compliance transcript" is not immutable

[firestore.rules:148-152](firestore.rules#L148-L152) declares `messages/{messageId}` with
`allow write: if false` and a comment calling it *"the compliance record for regulated
recruitment."* But [firestore.rules:472-482](firestore.rules#L472-L482) declares a **second block
on the same path shape**, `messages/{studentId}`, granting `read, write` to
`admin/owner/teacher/reception` and to `request.auth.uid == studentId`.

Firestore ORs match blocks. **The permissive rule wins.** Any teacher or reception account can
rewrite or delete transcript documents. The stated guarantee does not hold.

---

#### 🟡 MEDIUM-2 — `/api/debug/env-check` is a public recon endpoint

[src/app/api/debug/env-check/route.ts:5-14](src/app/api/debug/env-check/route.ts#L5-L14) returns,
unauthenticated: the **first 12 characters** of `ANTHROPIC_API_KEY`, its exact length, and which of
Firebase/Twilio are configured. The prefix is low-entropy (`sk-ant-api03`), so the direct secret
leak is small — but it confirms a live key exists and fingerprints the stack. Delete it.

#### 🟡 MEDIUM-3 — `/api/parent/register` grants a child's full record for a guessable 6-digit code

[route.ts:26-58](src/app/api/parent/register/route.ts#L26-L58) — unauthenticated, unthrottled,
no attempt cap. Codes are `Math.floor(100000 + Math.random() * 900000)`
([createStudentAccount.ts:144](src/lib/students/createStudentAccount.ts#L144),
[stripe/webhook/route.ts:97](src/app/api/stripe/webhook/route.ts#L97)) — `Math.random()`, not a CSPRNG.
Because a guess is tested against *all* students at once, the search space is
900 000 / (number of unclaimed codes), not 900 000. Success yields a `parent` account with full
visibility of that child's results, payments, attendance and visa status.

### 2.4 Routes protected in UI only

Given §2.1 — **all of them.** No page-level server-side check exists anywhere in the application.
The practical question is which of those UI-only gates lack a compensating rule, and that is exactly
CRITICAL-3, HIGH-1 and HIGH-5 above.

### 2.5 Routes with no auth check at all

**34 of 63 API routes** contain no auth token whatsoever (no `verifyIdToken`, no session read, no
shared secret, no webhook signature). Some are legitimately public (`/api/leads/contact`,
`/api/leads/destination-picker`, `/api/enrollment/checkout`). The ones that are **not** legitimately
public are listed in CRITICAL-5, HIGH-2, HIGH-3 and HIGH-4.

The 29 routes that *are* protected use a consistent, correct pattern —
`Bearer` token → `adminAuth.verifyIdToken` → re-read role from `users/{uid}` rather than trusting
the claim (e.g. [students/create-account/route.ts:17-27](src/app/api/students/create-account/route.ts#L17-L27),
[leads/send-message/route.ts:12-24](src/app/api/leads/send-message/route.ts#L12-L24)). The pattern
is sound; **it simply was not applied to the other 34.**

---

## 3. Student Data and PII

### 3.1 What is held

`Student` — [src/types/index.ts:124-184](src/types/index.ts#L124-L184) — the sensitive core:

- **Identity:** `name`, **`nic`** (Sri Lankan National Identity Card number — a government ID),
  `dateOfBirth`, `photoUrl`, `address`
- **Contact:** `mobile`, `email`, `personalEmail`
- **Credentials:** `idNumber` (9-digit login username), `loginEmail` (`{idNumber}@epiccampus.lk`)
- **Guardian block** ([L173-181](src/types/index.ts#L173-L181)): guardian `name`, `relationship`,
  `phone`, `email`, `address`, `parentPortalCode`
- **Financial:** `feeAmount`, `paidAmount`, `pendingAmount`, `paymentStatus`, `registrationFee`,
  full `feeSchedule` with line items
- **Immigration:** `visaStatus`, plus `visaDocuments` / `visaApplications` collections and the
  `visaDocs/` Storage prefix (passports, birth certificates, financial statements)
- **Free text:** `notes` — unstructured, staff-authored, **[INFERENCE]** likely to contain
  disciplinary, health or family detail

Related stores: `attendance`, `payments` / `partialPayments` / `paymentReceipts`, `examAttempts` +
`examAttemptAnswers`, `aiChatHistory/{studentId}/messages`, `studySessions`, `roomBookings`,
`consultationRequests`, `accommodations`, `epicWallPosts` / `Comments` / `Stories`, `leads`
([types:331-356](src/types/index.ts#L331-L356) — `name`, `phone`, `email`, `address`,
`educationLevel`, `budget`), `parentAccounts`, `messages` (WhatsApp transcripts).

**Minors.** Nothing in the codebase distinguishes minors from adults. `dateOfBirth` is stored but
never used for an age check, a consent gate, or differential retention. There is no consent record,
no retention policy, no deletion path, and no data-export path anywhere in `src/`.

### 3.2 Encryption

**Nothing is encrypted at the application layer.** No `crypto` usage for data at rest, no field-level
encryption, no hashing of `nic` or phone. Firestore and Storage provide Google-managed encryption at
rest and TLS in transit; that is the entirety of the protection. NIC numbers, passport scans and
guardian contact details sit in plaintext documents.

Passwords are handled by Firebase Auth and are never stored by this application — that part is fine.

### 3.3 PII written to logs

Better than expected, with real exceptions:

- ✅ No student PII in `console.log` across `src/app` and `src/lib`.
- 🔴 **Temp passwords transmitted in plaintext over WhatsApp** —
  [stripe/webhook/route.ts:140](src/app/api/stripe/webhook/route.ts#L140) sends
  `Temp Password: ${tempPassword}` to the student's phone. Same pattern in
  [src/lib/students/credentialsMessage.ts](src/lib/students/credentialsMessage.ts). Twilio retains
  message bodies in its console by default.
- 🟠 [seed-student-user.ts:109-112](src/scripts/seed-student-user.ts#L109-L112) and
  [seed-kitchen-user.ts:80-81](src/scripts/seed-kitchen-user.ts#L80-L81) print email + password.
  Dev scripts, but they are committed.
- 🟠 [firebase/admin.ts:29-34](src/lib/firebase/admin.ts#L29-L34) logs
  `privateKeyStart: privateKey?.slice(0, 40)` — **40 characters of the service-account private key**
  into Cloud Function logs on every cold start. The PEM header eats ~28 of those, so the real leak is
  ~12 key characters, but there is no reason to log any of it.
- 🟡 [audit/log/route.ts:25-26](src/app/api/audit/log/route.ts#L25-L26) captures IP addresses into
  `auditLog` — legitimate, but it is personal data with no stated retention.

### 3.4 Over-fetching: API responses wider than the UI needs

This is systemic, and it follows from the architecture rather than from any single mistake. **The
client talks to Firestore directly.** There is no serialisation layer, so *every* read returns the
**entire document** and the component picks fields out of it. There is no place in this codebase
where a response could be trimmed, because there are no responses — only documents.

Concrete consequences:

- [(management)/students/page.tsx:83](src/app/(management)/students/page.tsx#L83) does
  `getDocs(collection(db, 'students'))` — a full unfiltered pull of every student document, NIC and
  guardian block included, to render a list view. Any `teacher` account gets the same payload.
- [src/lib/students/helpers.ts:198-199](src/lib/students/helpers.ts#L198-L199) parses
  `parentAccessCode` into the client-side `Student` object, so the guardian access code is present
  in browser memory on any page that loads a student.
- [verify/[id]/page.tsx:130-137](src/app/verify/[id]/page.tsx#L130-L137) reads whole student
  documents to display four fields.

Firestore list-rule evaluation does stop a *student* from listing other students
([firestore.rules:25-29](firestore.rules#L25-L29) is per-document and rejects the query), so the
blast radius here is staff-side and internal. It nonetheless means every teacher account is one
compromise away from the full student database including NIC numbers.

---

## 4. Data Model

### 4.1 Collections

Firestore, so "model" means convention. 60+ top-level collections are referenced in
[firestore.rules](firestore.rules); the ones that matter:

**Identity & people**
| Collection | Key fields | Relationships |
|---|---|---|
| `users/{uid}` | `uid`, `email`, `role`, `roles[]`, `studentId`, `branchId`, `locationAssigned`, `showFinances` | Auth uid ↔ role. `studentId` links parent → child |
| `students/{id}` | See §3.1. Doc id is normally the auth uid but **not guaranteed** | `uid`, `parentId`, `agentId`, `batchId`, `courseId` |
| `parentAccounts/{uid}` | `parentName`, `email`, `phone`, `studentId` | → `students` |
| `agents`, `partnerCompanies`, `candidateShortlists` | | |

**Academic**
| Collection | Key fields | Notes |
|---|---|---|
| `examPapers/{id}` | `title`, `level`, `timeLimitSeconds`, `passMark`, `maxAttempts`, `accessCode`, `isLive`, `isPublished` | |
| `examSections/{id}` | `paperId`, `name`, `order` | → paper |
| `examQuestions/{id}` | `paperId`, `sectionId`, `options[]`, **`correctIndex`**, media URLs | → paper, section |
| `examAttempts/{id}` | `studentId`, `paperId`, `score`, `percentage`, `grade`, `markingStatus` | + subcollections `answers`, `writingSubmissions`, `speakingSubmissions` |
| `examAttemptAnswers` | `attemptId`, `questionId`, `selectedIndex`, `isCorrect` | |
| `exams`, `examResults` | `examId`, `studentId`, `score`, `band`, `status` | **⚠️ ORPHANED — see §4.3** |
| `attendance/{id}` | `studentId`, `date`, `status`, `sessionStart/End`, `markedBy` | denormalised `studentName`, `studentCode` |
| `sessions`, `schedule` | `courseId`, `date`, `startTime`, `endTime`, `staffId`, `location`, `type` | |
| `materials`, `studyMaterials`, `lessonPlans` | | |

**Financial:** `payments` (doubles as flat receipts *and* installment plans — see the comment at
[firestore.rules:41-46](firestore.rules#L41-L46)), `partialPayments` (append-only, correctly
immutable at [L66](firestore.rules#L66)), `paymentReceipts`, `expenses`, `payroll`,
`agentCommissions`, `staffReferrals`, `utilityBills`, `fixedUtilityBills`, `accommodationBudget`.

**Operational:** `leads`, `inquiries`, `enrollmentApplications`, `messages`, `conversations`,
`messageThreads`, `broadcastMessages`/`Logs`, `notifications`, `auditLog`, `consultationRequests`,
`roomSlots`, `roomBookings`, `visaDocuments`, `visaApplications`, `certificates`, `pendingApprovals`.

**Kitchen/facilities:** `inventory` (+`/history`), `inventoryLogs`, `kitchen_intake`, `mealLogs`,
`wasteLog`, `kitchenOrders`, `kitchenBudget`, `dailyMenus`, `mealTemplates`, `supplies`,
`accommodations` (+`/inventory`, `/bills`, `/rentPayments`), `settings/campusStatus`.

**AI:** `aiChatHistory/{studentId}/messages`, `studySessions`, `publicChatLogs`, `riskCache`,
`aiKnowledgeBase` (+`_history`, append-only at [L628-634](firestore.rules#L628-L634)).

Relationships are **string foreign keys with no referential integrity** — nothing prevents an
`examAttempt` pointing at a deleted `paperId`, or a `payment` at a deleted `studentId`. Only 13
composite indexes exist ([firestore.indexes.json](firestore.indexes.json)).

### 4.2 The core lifecycle, end to end

**① Enroll**
- Public: [src/app/enroll/page.tsx](src/app/enroll/page.tsx) → `enrollmentApplications`
  (`allow create: if true`) → [/api/enrollment/checkout](src/app/api/enrollment/checkout/route.ts) →
  Stripe → [/api/stripe/webhook](src/app/api/stripe/webhook/route.ts) creates the auth user +
  `students` + `users` docs ([L86-133](src/app/api/stripe/webhook/route.ts#L86-L133)).
- Staff: [(management)/enrollments/page.tsx](src/app/(management)/enrollments/page.tsx) →
  [/api/enrollment/confirm](src/app/api/enrollment/confirm/route.ts) →
  [src/lib/students/createStudentAccount.ts](src/lib/students/createStudentAccount.ts) (the
  better-engineered path: handles the existing-doc merge case at
  [L65-80](src/lib/students/createStudentAccount.ts#L65-L80)).
- Credentials go out over WhatsApp: [src/lib/students/credentialsMessage.ts](src/lib/students/credentialsMessage.ts).

**② Assign to batch** — no batch entity exists. `batchId` is a **string on the student**, defaulted
to `` `${courseId}-${year}` `` ([createStudentAccount.ts:144](src/lib/students/createStudentAccount.ts#L144)).
Batch membership is a `where('batchId','==',…)` query. The nearest thing to batch management is
admin-toggled campus presence: [(management)/admin/campus-status/page.tsx](src/app/(management)/admin/campus-status/page.tsx)
→ `settings/campusStatus`, consumed by the kitchen for head counts
([src/lib/campus/campusStatus.ts](src/lib/campus/campusStatus.ts)).

**③ Attend** — [src/components/attendance/AttendanceForm.tsx](src/components/attendance/AttendanceForm.tsx)
→ `attendance` docs; parsing/rates in [src/lib/attendance/helpers.ts](src/lib/attendance/helpers.ts).
This step **does** write audit entries ([AttendanceForm.tsx:186, :219](src/components/attendance/AttendanceForm.tsx#L186)).

**④ Sit exam** — staff build papers in [(management)/admin-exams/page.tsx](src/app/(management)/admin-exams/page.tsx)
(or [ai-builder](src/app/(management)/admin-exams/ai-builder/page.tsx)) → student enters a code at
[(student)/exam-code/page.tsx](src/app/(student)/exam-code/page.tsx) → takes it at
[(examination)/exams/[paperId]/page.tsx](src/app/(examination)/exams/[paperId]/page.tsx).

**⑤ Record result** — **in the browser**, at
[page.tsx:242-260](src/app/(examination)/exams/[paperId]/page.tsx#L242-L260). One `addDoc` to
`examAttempts`. Writing/speaking sections are marked afterwards by Claude via
[/api/exam/mark-writing](src/app/api/exam/mark-writing/route.ts) and
[mark-speaking](src/app/api/exam/mark-speaking/route.ts).

**⑥ Deliver** — student sees results on-screen at
[(student)/my-results/page.tsx](src/app/(student)/my-results/page.tsx); staff at
[(management)/exam-results/page.tsx](src/app/(management)/exam-results/page.tsx). **The step you
believe exists — "result PDF is generated and delivered" — does not exist.** The only artefact is a
completion certificate (§5.3).

### 4.3 ⚠️ Two parallel result systems, and the old one is orphaned

`examResults` and `exams` are read in **eight** places — including the **parent portal**
([parent/results/page.tsx:21](src/app/parent/results/page.tsx#L21),
[parent/dashboard/page.tsx:66](src/app/parent/dashboard/page.tsx#L66)), the student detail page
([students/[id]/page.tsx:331](src/app/(management)/students/[id]/page.tsx#L331)), admin analytics,
partner helpers, and risk scoring.

**Nothing in the codebase writes to either collection.** I grepped every `addDoc`, `setDoc`,
`updateDoc` and `.add(`/`.set(` against both names: zero write sites.

Consequences, unless these collections were populated by hand or by a migration outside the repo:

- **The parent portal's Results page shows nothing.** Parents see an empty page where their child's
  results should be.
- `checkCertificateEligibility` ([src/lib/student/certificate.ts:28-57](src/lib/student/certificate.ts#L28-L57))
  queries `examResults`, finds nothing, and returns `eligible: false` for **every** student whenever
  any active paper exists.
- Admin analytics and the student-risk exam average are computed from an empty set.

The live engine is `examAttempts`. `examResults` is dead weight still wired into four user-facing
surfaces. **[INFERENCE]** this is a half-finished migration from the older `Exam`/`ExamResult` model
([types:283-306](src/types/index.ts#L283-L306)) to the JFT engine.

---

## 5. Result Integrity

### 5.1 Who can create or edit a result

| Actor | Create | Edit | Where |
|---|---|---|---|
| **The student themselves** | ✅ | ✅ | [firestore.rules:121-125](firestore.rules#L121-L125) — `create: if request.auth != null`, `update` if `resource.data.studentId == request.auth.uid` |
| `admin`, `owner`, `teacher` | ✅ | ✅ | [firestore.rules:122-123](firestore.rules#L122-L123) |
| **Anonymous internet** | — | ✅ writing/speaking scores | [mark-writing/route.ts:74-95](src/app/api/exam/mark-writing/route.ts#L74-L95), no auth |

`examCoordinator` — the role named for this job — can update `examAttemptAnswers`
([L135-136](firestore.rules#L135-L136)) but **not** `examAttempts` itself
([L122-125](firestore.rules#L122-L125)). Almost certainly an oversight.

### 5.2 Audit trail — there is none for results

`logAuditEvent` ([src/lib/audit/helpers.ts](src/lib/audit/helpers.ts)) is called from exactly seven
places: login, staff management, attendance (×2), CRM lead forms (×3), company sidebar, partner
forms. **No exam or result path calls it.** Grep confirms zero audit writes in
`(examination)/`, `exam-results/`, or any `api/exam/*` route.

So: **a result can be silently altered after publication, by the student it belongs to, leaving no
record whatsoever.** No `updatedAt`, no `updatedBy`, no revision history, no immutability flag on
`examAttempts`. Contrast `partialPayments` ([L66](firestore.rules#L66)), `inventoryLogs`
([L268](firestore.rules#L268)) and `aiKnowledgeBase_history` ([L633](firestore.rules#L633)), which
*are* correctly append-only — the pattern is understood in this codebase and simply wasn't applied
to results.

And per CRITICAL-5, `auditLog` itself is forgeable through an unauthenticated endpoint, so even the
seven paths that *do* log are not trustworthy evidence.

### 5.3 PDF generation and URL guessability

- **Library:** `pdf-lib` ([src/lib/certificates/generateCertificate.ts:1](src/lib/certificates/generateCertificate.ts#L1),
  [src/lib/generatePDF.ts:1](src/lib/generatePDF.ts#L1)). `jspdf` is used for kitchen/receipt PDFs.
- **Source data:** the `students` document plus a `certificates` record. **Not** exam results —
  §4.3 explains why the eligibility check that *should* gate this is inert.
- **On demand or stored?** Generated on demand, returned as base64 in the JSON response
  ([certificates/generate/route.ts:92-93](src/app/api/certificates/generate/route.ts#L92-L93)) and
  turned into a blob download client-side
  ([my-results/page.tsx:110-120](src/app/(student)/my-results/page.tsx#L110-L120)). The bytes are
  never persisted, so **there is no PDF URL to guess.** That specific risk does not apply.
- **But the generating endpoint is worse than a guessable URL.**
  [route.ts:19-22](src/app/api/certificates/generate/route.ts#L19-L22) takes `{ studentId }` from an
  unauthenticated body. Anyone can mint anyone's certificate.
- **And there is no eligibility gate on the shipped path.** `checkCertificateEligibility` exists and
  is used by [CompletionCertificate.tsx:28](src/components/student/CompletionCertificate.tsx#L28) —
  but the actual download button at
  [my-results/page.tsx:289-299](src/app/(student)/my-results/page.tsx#L289-L299) calls
  `downloadCertificate()` directly with no check. **Any student can download a completion
  certificate for their course at any time, having passed nothing.**

  For an institute whose certificates are shown to foreign employers and immigration authorities,
  this is the finding with the longest tail.

- Certificate numbers are `EC-{year}-{studentCode-fragment}-{course}`
  ([generateCertificateNumber](src/lib/certificates/generateCertificate.ts)) — structured and
  enumerable — and `certificates` is `allow read: if true`
  ([firestore.rules:582](firestore.rules#L582)), so the public `/verify` surface doubles as a bulk
  export (HIGH-5).

---

## 6. Timetables and Scheduling

### 6.1 How they work

Two collections, `sessions` and `schedule`, both written by `admin`/`owner`/`teacher`/`reception`
([firestore.rules:394-400](firestore.rules#L394-L400), [L506-510](firestore.rules#L506-L510)) and
**readable by any authenticated user**. `ScheduleSession`
([types:400-422](src/types/index.ts#L400-L422)) stores `date` as `YYYY-MM-DD` and `startTime`/`endTime`
as `HH:MM` **strings** — no timezone, no UTC instant.

Surfaces: management [schedule/page.tsx](src/app/(management)/schedule/page.tsx), teacher
[sessions/page.tsx](src/app/(management)/sessions/page.tsx), student
[my-schedule/page.tsx](src/app/(student)/my-schedule/page.tsx) (day/week/month), consultation slots
via `roomSlots`/`roomBookings`.

Exams are not modelled separately — `SessionType` is `'class' | 'consultation' | 'exam'`
([types:378](src/types/index.ts#L378)), rendered red at
[schedule/helpers.ts:62](src/lib/schedule/helpers.ts#L62). **There is no exam timetable feature**,
just exam-coloured rows in the general calendar.

### 6.2 Conflict detection: none

`grep -rni "conflict|overlap|doubleBook|clash"` across `src/` returns **one** hit, and it is about
studentCode uniqueness ([leads/convert-to-student/route.ts:21](src/app/api/leads/convert-to-student/route.ts#L21)).

There is no check for: same room twice, same teacher twice, overlapping time ranges, a student
booked into two sessions at once, or an exam colliding with a class. The `roomSlots` composite index
on `(date, room)` ([firestore.indexes.json](firestore.indexes.json)) is the only structural hint
that anyone considered it. Nothing prevents an exam being scheduled on top of another exam.

### 6.3 Timezone and date-format edge cases — a real, present bug

Sri Lanka is **UTC+5:30**, always positive, no DST. The pattern
`new Date(...).toISOString().slice(0, 10)` converts to UTC *before* taking the date, so it returns
**the previous day for any moment between 00:00 and 05:30 local.**

Someone knew this. [my-schedule/page.tsx:82-91](src/app/(student)/my-schedule/page.tsx#L82-L91) has
an explicit comment and a correct `toLocalISODate()` helper:

```js
// NOTE: dates are formatted from local Date fields (getFullYear/getMonth/getDate),
// never via toISOString() — that round-trips through UTC and shifts the date by
// one day in positive-offset zones like Asia/Colombo (UTC+5:30).
```

**The fix was applied to that one file.** I count **40+ remaining sites** still using the broken
pattern. The ones that matter:

| Site | Impact |
|---|---|
| [src/lib/schedule/helpers.ts:28](src/lib/schedule/helpers.ts#L28) | `parseSession` — **the shared parser for every schedule surface.** A session stored as a Timestamp at midnight Colombo renders as the previous day. This is the fix's own blind spot |
| [src/lib/attendance/helpers.ts:35](src/lib/attendance/helpers.ts#L35) | `parseAttendance` shifts dates on read — while `todayISO()` at [L14-20](src/lib/attendance/helpers.ts#L14-L20) is correctly local. **Attendance is written on one calendar and read on another** |
| [src/app/api/stripe/webhook/route.ts:58](src/app/api/stripe/webhook/route.ts#L58) | **Server-side — always UTC**, not just early mornings. Payments made before 05:30 Colombo are dated to the previous day, permanently, in the financial record |
| [kitchen/meal-log:46](src/app/kitchen/meal-log/page.tsx#L46), [kitchen/dashboard:27](src/app/kitchen/dashboard/page.tsx#L27), [kitchen/orders:105](src/app/kitchen/orders/page.tsx#L105) | Kitchen staff working breakfast prep before 05:30 log to yesterday |
| [(management)/teacher/page.tsx:41](src/app/(management)/teacher/page.tsx#L41), [dashboard:480](src/app/(management)/dashboard/page.tsx#L480), [payments/tracker:67](src/app/(management)/payments/tracker/page.tsx#L67) | "Today's sessions", "today's count", overdue-installment comparison all wrong before 05:30 |

Client-side sites are only wrong during the 00:00–05:30 window; **server-side sites are wrong
always.** The `payments/tracker` overdue comparison
(`dueDate < new Date().toISOString().slice(0,10)`) means an installment shows as overdue a day early
during that window.

There is also **no `date-fns`/`dayjs`/`luxon` dependency** and no `Asia/Colombo` constant anywhere —
every date decision is hand-rolled against the host's local time.

---

## 7. The AI Features

Correcting the premise first: **"AI E-Learning Mode" and "adaptive exams" do not exist under those
names, and adaptive examining does not exist in any form.** Here is what does.

### 7.1 Shipped and in use

**AI Study Assistant** — [src/app/(student)/student/assistant/page.tsx](src/app/(student)/student/assistant/page.tsx),
linked in the student sidebar at [StudentSidebar.tsx:37](src/components/student/StudentSidebar.tsx#L37).
Seven **fixed** modes ([types:700-707](src/types/index.ts#L700-L707)): general, japanese-grammar,
japanese-vocabulary, jlpt-practice, ielts-writing, ielts-speaking, korean-basics. System prompts and
an Epic Campus knowledge base live in
[src/lib/ai/studyModes.ts](src/lib/ai/studyModes.ts) (535 lines — the single largest AI investment
on the learning side). History persists to `aiChatHistory/{studentId}/messages`. **This is probably
what you remember as "AI E-Learning Mode."** It is real and shipped — but it is a chatbot with seven
personas, not adaptive learning. Nothing reads a student's performance to change what it asks.

**WhatsApp AI lead agent** — the most recent and best-engineered AI work in the repo
([whatsapp/webhook/route.ts](src/app/api/whatsapp/webhook/route.ts), 370 lines;
[cron/re-engage-leads/route.ts](src/app/api/cron/re-engage-leads/route.ts), commit `57865d1`
"Phase B.6"). Constant-time secret comparison
([cron:21-26](src/app/api/cron/re-engage-leads/route.ts#L21-L26)), bounded history
(`HISTORY_LIMIT = 40`, [webhook:19](src/app/api/whatsapp/webhook/route.ts#L19)), per-run ceiling
(`MAX_PER_RUN = 25`, [cron:16](src/app/api/cron/re-engage-leads/route.ts#L16)), an admin-editable
knowledge base with append-only version history. Undermined by HIGH-3 (signature validation off).

**AI Question Builder** — [(management)/admin-exams/ai-builder/page.tsx](src/app/(management)/admin-exams/ai-builder/page.tsx),
sidebar-linked. Generates MCQs from a topic or an uploaded PDF (`pdf-parse`). Staff review before
saving — a sound design.

**AI marking** — [/api/exam/mark-writing](src/app/api/exam/mark-writing/route.ts) (Haiku,
`max_tokens: 800`) and [mark-speaking](src/app/api/exam/mark-speaking/route.ts). Bounded per-call;
unauthenticated (CRITICAL-4).

**Student risk scoring** — [src/lib/ai/studentRisk.ts](src/lib/ai/studentRisk.ts) +
[riskCache.ts](src/lib/ai/riskCache.ts) + [/api/student-risk](src/app/api/student-risk/route.ts),
surfaced at [admin/student-risk](src/app/(management)/admin/student-risk/page.tsx). Partly
compromised by §4.3 — the exam-average input reads the orphaned `examResults`.

**Ops helpers** — [/api/finance/ai-summary](src/app/api/finance/ai-summary/route.ts),
[/api/kitchen/ai-budget](src/app/api/kitchen/ai-budget/route.ts),
[/api/kitchen-ai](src/app/api/kitchen-ai/route.ts),
[/api/import-ai](src/app/api/import-ai/route.ts) (bulk data import across 10 collections),
[/api/whatsapp-draft](src/app/api/whatsapp-draft/route.ts).

### 7.2 Experimental / dead

- **Voice agent spike** — [src/app/api/voice/spike-test/](src/app/api/voice/spike-test/),
  **uncommitted** (untracked in git status). Its own header calls it a "THROWAWAY SPIKE… Delete once
  the question is answered" ([route.ts:6-28](src/app/api/voice/spike-test/route.ts#L6-L28)) —
  testing whether Twilio handles Sinhala TTS/STT. Honest, well-documented throwaway. **It is
  publicly reachable if deployed.**
- **Adaptive exams** — no code, no flag, no stub. It was never started.

### 7.3 Are the AI calls bounded?

| Route | Model pinned | `max_tokens` bounded | Auth | Verdict |
|---|---|---|---|---|
| [`/api/chat`](src/app/api/chat/route.ts) | ❌ caller-set | ❌ caller-set | ❌ | 🔴 **Open proxy — HIGH-2** |
| [`/api/chat/stream`](src/app/api/chat/stream/route.ts) | ⚠️ defaulted, overridable | ⚠️ `?? 1024`, overridable | ❌ | 🔴 **Open proxy** |
| `/api/student-risk`, `/api/kitchen-ai`, `/api/whatsapp-draft`, `/api/exam/*`, `/api/admin-exams/*` | ✅ Haiku | ✅ 800–2000 | ❌ | 🟠 volume abuse only |
| `/api/finance/ai-summary`, `/api/kitchen/ai-budget`, `/api/import-ai`, `/api/leads/*` | ✅ | ✅ | ✅ Bearer + role | ✅ |
| `/api/whatsapp/webhook` | ✅ | ✅ history-capped | ⚠️ signature check disabled | 🟠 **HIGH-3** |
| `/api/cron/re-engage-leads` | ✅ | ✅ `MAX_PER_RUN` | ✅ `CRON_SECRET`, constant-time | ✅ best in repo |

**There is no global spend cap, no rate limiter, and no per-user quota anywhere in the codebase.**

---

## 8. State of Play

Blunt inventory. "Staff use it" is **[INFERENCE]** from code maturity, commit history and data-flow
completeness — I cannot see production usage.

### ✅ Fully working, and evidently in daily use

- **Student management** — CRUD, 40-field records, credential issue over WhatsApp, ID cards
  (SVG-serialised, deliberately not html2canvas), bulk views. The most-iterated area in the repo.
- **Payments** — Stripe + PayPal + cash, installment plans, partial payments with an append-only
  trail, front-desk collection, receipt PDFs, a payment tracker. Commit `93acb2f` ("total income all
  installments, paid students 73") reads like production reconciliation against real numbers.
- **Kitchen module** — 8 pages, inventory with history, meal logs, waste, orders, budget, Sinhala
  UI helper ([useKitchenSinhala.ts](src/lib/kitchen/useKitchenSinhala.ts)), decimal-precision care.
  Disproportionately polished. Someone uses this every day.
- **Attendance** — works, and is the **only** student-touching flow with a real audit trail.
- **Accommodation** — houses, per-house inventory, bills, rent, budget.
- **Epic Wall** — the social feed; login landing page.
- **JFT/SSW exam engine** — paper building, sections, questions, media, live codes, taking UI,
  results views. Functionally complete; **integrity-broken** (§5).
- **CRM / leads / WhatsApp AI agent** — the current active workstream.

### 🟡 Half-finished

- **`examResults` migration** — §4.3. Four user-facing surfaces read a collection nothing writes.
  **The parent portal's results page is empty.** Highest-value fix in this category.
- **Certificates** — generation works; the eligibility gate exists but is not wired to the button
  (§5.3); the endpoint is unauthenticated.
- **Parent portal** — layout, sidebar and five pages exist; results are empty per above; registration
  is weakly protected (MEDIUM-3).
- **Company/partner portal** — UI complete, access control effectively absent (CRITICAL-3).
- **2FA / OTP** — endpoints built, flow bypassed at
  [login/page.tsx:297](src/app/(auth)/login/page.tsx#L297), endpoints left live and abusable (HIGH-4).
- **Batches** — a string on a document, not an entity. Adequate today, will not survive scheduling
  or per-batch reporting.

### 🔴 Dead code

- [src/lib/auth/roleGuard.ts](src/lib/auth/roleGuard.ts) — all four guards, zero call sites. **The
  most consequential dead code in the repo**: it is the server-side authorisation layer, written and
  never connected.
- `getSession` / `requireSession` / `requireRole` ([src/lib/auth/session.ts](src/lib/auth/session.ts))
  — consumed only by the above.
- `exams` + `examResults` collections — read-only orphans.
- `NEXTAUTH_SECRET` — NextAuth is not installed.
- [/api/debug/env-check](src/app/api/debug/env-check/route.ts) — should not exist.
- [/api/voice/spike-test/](src/app/api/voice/spike-test/) — self-declared throwaway, uncommitted.
- `parentPortalCodes` vs `students.parentAccessCode` — two guardian-code mechanisms; only the latter
  is used by the registration route.

### ⚙️ Build and deploy posture

[next.config.mjs:3-4](next.config.mjs#L3-L4):

```js
eslint:     { ignoreDuringBuilds: true },
typescript: { ignoreBuildErrors: true },
```

This **directly contradicts** the project's own rule in [CLAUDE.md](CLAUDE.md) — *"TSC must pass
before any build attempt."* As configured, a type error cannot stop a deploy. The discipline is
being enforced by you running `npx tsc --noEmit` by hand, not by the toolchain.

`firebase.json` sets `maxInstances: 10`, `minInstances: 0` — cold starts on first hit, hard ceiling
at ten concurrent SSR instances. Mitigating: most data flows client→Firestore directly, so SSR
carries page loads only.

---

## 9. Risks, Ranked by Real-World Consequence

**1. Unauthenticated Stripe webhook → free enrollment + self-provisioned accounts** (CRITICAL-1)
Live today; `STRIPE_WEBHOOK_SECRET` is a placeholder and the code branches around verification.
Revenue loss, fake student records in the operational database, and an authenticated foothold that
unlocks every finding below it. *Fix: set the real secret; delete the placeholder branch at
[webhook/route.ts:39](src/app/api/stripe/webhook/route.ts#L39).*

**2. Every student's documents readable and deletable by any logged-in user** (CRITICAL-2)
`storage.rules:5-19`. Passports and birth certificates of minors. `allow delete` makes it
irreversible data loss as well as exposure. *Fix: scope both prefixes by uid, as
`payment-receipts/` already is.*

**3. Result integrity is unenforceable** (CRITICAL-4, §5)
Answer key readable, marks computed and written by the client, students can edit their own results
afterwards, marking endpoint open, **zero audit trail**. You cannot currently defend a grade against
a challenge, and you would not know a change had occurred. *Fix, in order: (a) server-side scoring;
(b) `examAttempts` immutable after submit + append-only revision log; (c) auth on `api/exam/*`.*

**4. Certificates mintable by anyone, for anyone, with no eligibility check** (§5.3)
Unauthenticated endpoint, no pass requirement on the shipped path. These certificates are shown to
foreign employers and immigration authorities; a forged one traced back to EPIC is an
institutional-credibility event, not a software bug. *Fix: auth the route; call
`checkCertificateEligibility` before generating — which first requires fixing §4.3.*

**5. Cross-student PII exposure through over-broad rules** (CRITICAL-3, HIGH-1, HIGH-5)
Candidate shortlists world-writable; all attendance readable by all students; guardian-code→name
mapping listable; the entire `certificates` collection readable **without logging in**; the student
social feed public. Data on minors, and Sri Lanka's PDPA (No. 9 of 2022) is in force. *Fix: a rules
pass adding ownership predicates.*

**6. Unbounded Anthropic spend** (HIGH-2)
`/api/chat` forwards caller-controlled `model` and `max_tokens` with no auth or rate limit. One
person with a script can run a very large bill overnight, and the first signal is the invoice.
*Fix: pin the model and cap `max_tokens` server-side; require auth; add a rate limit.*

**7. Exam-period availability**
`maxInstances: 10`, `minInstances: 0`, 120 s timeout. Every student loading `/exams/{id}` at 9am
hits cold starts. Compounding: the client fetches **all** questions plus media up front, and a
failed submit keeps state only in browser memory
([page.tsx:264-268](src/app/(examination)/exams/[paperId]/page.tsx#L264-L268)) — **a tab crash or
refresh loses the attempt entirely.** No server-side draft persistence for MCQ answers.
*Fix: raise `minInstances` before exam windows; persist answers incrementally (the
`examAttempts/{id}/answers` subcollection already exists at
[exam/helpers.ts:325](src/lib/exam/helpers.ts#L325) — it just isn't used by the MCQ path).*

**8. Students can rewrite their own fee status** (HIGH-1)
Unrestricted `update` on own `students` doc. Corrupts the finance dashboards, which read those
fields directly. Hard to detect because there is no audit on student-record writes.

**9. Audit log is forgeable and floodable** (CRITICAL-5)
`/api/audit/log` is open. The one collection meant to be evidence cannot be trusted, which
undermines any investigation of items 1–8.

**10. Timezone bug corrupting dated records** (§6.3)
40+ sites. Server-side sites (Stripe payment dates) are **always** wrong; client-side sites are
wrong 00:00–05:30. Silent, cumulative, and worst in the two places you'd least want it — financial
records and attendance.

**11. WhatsApp channel abuse** (HIGH-3, CRITICAL-5)
`/api/notify` open + Twilio signature validation off. Anyone can send EPIC-branded WhatsApps to any
number. Twilio account suspension would take down credential delivery, payment confirmations and
the lead agent at once.

**12. Guardian-portal brute force** (MEDIUM-3) · **13. 2FA bypass** (HIGH-4) ·
**14. Type errors cannot block a deploy** (§8) · **15. `/api/debug/env-check`** (MEDIUM-2)

---

## 10. Automation Candidates

Framing: this system holds records that determine whether a young person gets a visa and a job
abroad. The asymmetry is severe — an automation that saves ten minutes a day is not worth a one-in-
a-thousand chance of silently corrupting a result. **Default is human-approved; the safe list below
had to earn its place.**

### ✅ Safe to automate

| Task | Why it's safe |
|---|---|
| **Data-integrity checks (read-only, report out)** | Highest value here. Detect: students whose `uid` ≠ doc id ([a known bug class](src/app/api/admin/fix-student-uids/route.ts)); `examAttempts` pointing at deleted papers; `payments` orphaned from students; `paidAmount + pendingAmount ≠ feeAmount`; students with `parentId` but no `parentAccounts` doc; **attempts whose `percentage` doesn't match their stored answers** (a tamper detector for §5). **Detects, never writes.** |
| **Firestore + Storage backups** | Additive, off-path, nothing in the repo does it today. Given item 2 in §9 permits deletion, this is the compensating control. |
| **Scheduled report *generation*** (kitchen, finance, attendance summaries) | Derived artefacts, no source-of-truth writes. [generateKitchenReport.ts](src/lib/kitchen/generateKitchenReport.ts) and [reports/helpers.ts](src/lib/reports/helpers.ts) already exist. Generate and file it; let a human send it. |
| **Low-stock and expiry alerts** | [kitchen/low-stock-alert](src/app/api/kitchen/low-stock-alert/route.ts) and [expiryHelpers.ts](src/lib/kitchen/expiryHelpers.ts) exist. Kitchen inventory, not student records — worst case is a wasted trip to the market. |
| **Anthropic / Twilio spend monitoring** | Pure observation, and §9 items 6 and 11 mean you currently have none. |
| **Dependency and rules drift checks** | e.g. alert when a `firestore.rules` line grants `if request.auth != null` on a collection holding student data. Would have caught CRITICAL-3 on the day it shipped. |
| **`npx tsc --noEmit` in CI** | Restores the discipline `next.config.mjs` disabled. Blocks nothing until you wire it to a gate. |
| **Timezone-bug linting** | Flag new `toISOString().slice(0, 10)` occurrences. Prevents §6.3 growing past 40 sites. |

### 🚫 Must stay human-approved

| Task | Why |
|---|---|
| **Anything writing `examAttempts`, `examResults` or `certificates`** | §5: no audit trail, no rollback. An automated writer here is an undetectable corruption engine. Non-negotiable. |
| **Certificate issuance** | §5.3. These reach foreign employers and immigration officials. A human attests, or nobody does. |
| **Student record creation, edits, deletion** | 40 fields including NIC, guardian and immigration status. `students` `allow delete` exists ([firestore.rules:37-38](firestore.rules#L37-L38)) and there is no soft-delete or recovery path. |
| **Payment records, installment plans, refunds** | Real money, and §9 item 10 means dates are already unreliable. Automation would scale a known bug. |
| **Any outbound message to a student, parent or lead** | Twilio delivers to real phones, many belonging to minors, and messages carry credentials. A loop here is unrecallable — and the cold-lead cron already has `MAX_PER_RUN = 25` and `QUIET_HOURS = 48` for exactly this reason. Whatever you build should inherit those limits. |
| **Account creation and role assignment** | Roles are custom claims driving the entire perimeter (§2). Automated role grants are automated privilege escalation. |
| **Firestore rules or Storage rules deployment** | The rules **are** the security model. Every finding in §2.3 is a rules line. Never auto-deployed. |
| **Production deploys** | `ignoreBuildErrors: true` means a broken build ships silently. [CLAUDE.md](CLAUDE.md) already says never auto-deploy; that rule is correct and should stay. |
| **Attendance marking** | Feeds risk scoring and, plausibly, visa documentation. Requires a human who was in the room. |
| **Visa document handling** | Passports and birth certificates, subject to deletion under CRITICAL-2. Read-only inventory checks are fine; nothing else. |

**Suggested sequencing:** backups first (they make everything else recoverable), then the read-only
integrity checks (they will find real problems in week one — start with the §4.3 orphan and the
§6.3 date drift), then spend monitoring. Report generation once those are steady. Nothing that
writes to a student record, ever, without a person clicking approve.

---

## 11. Open Questions

Things code alone cannot answer.

**Security posture — resolve first**
1. Is the deployed `STRIPE_WEBHOOK_SECRET` still the placeholder that `.env.local` holds? If yes,
   CRITICAL-1 is live right now and everything else waits.
2. Is `TWILIO_VALIDATE_WEBHOOK=true` set in the deployed environment? Absent from `.env.local`.
3. Is the deployed `firestore.rules` the version in this repo? `firebase deploy --only
   firestore:rules` is a separate manual step per CLAUDE.md, so the live rules may differ in either
   direction.
4. Has `/api/chat` seen anomalous traffic? Anthropic's usage dashboard would show it.
5. Was the Anthropic key ever exposed via `/api/debug/env-check` to a party who acted on it?

**Data reality**
6. **Does `examResults` contain data?** The whole §4.3 assessment — including whether parents see
   anything and whether certificates can ever be gated — turns on this one query.
7. Are there `students` docs where `uid` ≠ document id? [/api/admin/fix-student-uids](src/app/api/admin/fix-student-uids/route.ts)
   exists, implying yes at some point. Determines whether the rules' `resource.data.uid ==
   request.auth.uid` clause actually covers everyone.
8. How many active students and staff? Changes the practical severity of the brute-force findings.
9. Are `certificates` populated? If so, that collection is currently a public, unauthenticated
   export of graduate PII.

**Deployment**
10. **Firebase Hosting or Vercel?** `firebase.json` and CLAUDE.md say Firebase; recent commits say
    "trigger vercel rebuild with env vars" and there's a Vercel connector in the toolchain. No
    `vercel.json` exists. If both are live, there may be **two deployments with different rules and
    different secrets.**
11. What invokes `/api/cron/re-engage-leads`? No `vercel.json` crons, no Cloud Scheduler config in
    the repo.
12. Are Firestore/Storage backups configured in the Firebase console? Nothing in the repo does it.

**Operational**
13. Which features do staff *actually* open daily? My §8 read is inferred from code maturity. The
    kitchen module's polish suggests heavy use; the parent portal's broken results page suggests
    nobody has complained, which suggests nobody uses it.
14. Have exam results ever been disputed? Determines whether §5 is a latent risk or a live one.
15. Is 2FA meant to be on? [login/page.tsx:297](src/app/(auth)/login/page.tsx#L297) says the routes
    are "preserved" — preserved for a return, or forgotten?
16. Under Sri Lanka's PDPA (No. 9 of 2022), is EPIC registered as a controller, and is there a
    consent or retention position for students under 18? No consent, retention, export or deletion
    mechanism exists in code.
17. What is the exam-day concurrency peak? Determines whether `maxInstances: 10` is a real §9-item-7
    risk or a theoretical one.

---

*Prepared from a read-only audit of `main` @ `0433a90`. No files were modified except this one. Line
citations are accurate as of that commit.*
