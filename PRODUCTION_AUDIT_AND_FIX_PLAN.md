# Orbit / Base16 Production Readiness Audit & Fix Plan

Generated from live inspection of `cvikeikqhxxkwdupglpp.supabase.co`, frontend (`components/`, `utils/`), backend (`backend/`), Edge Functions (`supabase/functions/`), and Vercel deployment config.

---

## P0 — Critical Security & Broken Production Features (Fix First)

### 1. [DONE] Hubtel SMS Secrets Exposed in Frontend Bundle
- **Status:** Fixed in `7b2a225` (Hubtel secrets removed from `utils/sms.ts`, `components/BookDemo.tsx`, and `.env`; `supabase/functions/send-sms/index.ts` updated to use Arkesel v2 / Hubtel strictly via Supabase Edge Function Secrets).

### 2. [DONE] Missing Tables & RPCs in Live Database (`cvikeikqhxxkwdupglpp`)
- **Status:** Fixed in `7b2a225` + `supabase/fix_missing_tables_and_rpcs.sql` (`message_logs`, `demo_bookings`, `add_fee_to_students`, `get_student_class_rank` verified live; `notices` → `app_notifications`, `start_new_term` → `admin_switch_academic_term`, retired `referrals` query removed).

### 3. [DONE] Client-Side Paystack & Wallet Unlocking (Revenue Bypass Risk)
- **Status:** Fixed & deployed (`supabase/functions/verify-paystack/index.ts`, `utils/paystack.ts`, `components/ModuleLockGate.tsx`, `components/Settings.tsx`, and `supabase/lock_billing_and_wallets.sql` applied on `cvikeikqhxxkwdupglpp`). All Paystack payments are now verified server-side with `PAYSTACK_SECRET_KEY`, and `wallet_balance`/`sms_balance`/`school_subscriptions` are locked against browser tampering.

### 4. [DONE] Mixed Content: Oracle AI Agent URL Uses `http://` on an `https://` Site
- **Status:** Fixed via `api/chat.js` (Vercel HTTPS proxy with Supabase JWT + `school_id` ownership verification) and updated `components/Dashboard.tsx` to route AI requests through `/api/chat` with the user's bearer token. Supports optional `AI_AGENT_UPSTREAM_URL` (e.g. `https://api.base16schools.com/api/chat`).

---

## P1 — High Priority Security & Auth Hardening

### 5. [DONE] Hardcoded Super Admin Shortcut & Default Passwords in Client Code
- **Status:** Removed `silas@222` from [Login.tsx](file:///c:/Users/HP/Desktop/orbit/components/Login.tsx#L44). Typing `silas` still resolves to `silas@base16.com`, authenticated against Supabase Auth (`role: 'super_admin'`).

### 6. Rotate Exposed Credentials & Clean `.env` / Repo History
- **Where:** `.env`, `backend/.env`, `scratch/` scripts
- **Risk:** `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, and `VITE_HUBTEL_CLIENT_SECRET` are stored in local scripts (`scratch/*.js`, `scratch/*.py`).
- **Fix:** Ensure `scratch/` and `.env` are never committed to GitHub (`.gitignore` covers `.env`, verify `scratch/` is ignored or cleaned), and rotate any keys that were ever exposed in client bundles or public logs.

### 7. [DONE] Multi-Tenant RLS Isolation Verification
- **Status:** Fixed & verified (`supabase/enable_multi_tenant_rls.sql` applied on `cvikeikqhxxkwdupglpp`). Live cross-school attack test confirmed **0 rows** readable across schools (`students`, `profiles`, `exam_results`, `transactions`, `school_subscriptions`, `message_logs`, `schools`) while own-school reads work cleanly.

---

## P2 — Reliability, Auditability & UX Polish

### 8. Add an Audit Log (`activity_logs`) for Sensitive Actions
- **Why:** When a school manager reports a missing student, deleted teacher, or reversed fee payment, you currently have no history of *who* did it and *when*.
- **Fix:** Create an `activity_logs` table (`school_id`, `actor_id`, `action`, `entity_type`, `entity_id`, `details`, `created_at`) and log fee payments, reversals, student deletions, teacher deletions, and bulk promotions.

### 9. Replace `window.alert()` / `window.confirm()` & Silent Error Swallowing
- **Where:** Across `Teachers.tsx`, `Courses.tsx`, `Students.tsx`, `Fees.tsx`, `Settings.tsx`
- **Issue:** Several `catch` blocks only log to console (so users think an action worked when it failed), and native `alert()` blocks the browser UI.
- **Fix:** Route errors to the existing `Toast` component ([components/Toast.tsx](file:///c:/Users/HP/Desktop/orbit/components/Toast.tsx)) with clear, actionable messages.

### 10. Automated Off-Site Database Backups
- **Why:** Relying on manual backups before migrations is risky as more schools depend on daily fee and attendance records.
- **Fix:** Add a daily `pg_dump` cron job on your Oracle server (`155.248.239.188`) compressing and retaining 14–30 days of backups, and upgrade Supabase to **Pro (\$25/mo)** for automated daily backups + PITR as soon as onboarding scales.

---

## P3 — Performance & Scale (Before 2,000+ Students / 20+ Schools)

### 11. Remove `.limit(5000)` & `select('*')` Full-Table Fetches
- **Where:** [components/Students.tsx](file:///c:/Users/HP/Desktop/orbit/components/Students.tsx#L69), [components/Exams.tsx](file:///c:/Users/HP/Desktop/orbit/components/Exams.tsx#L177), and 20+ `select('*')` calls.
- **Risk:** Fetching 5,000 rows and all columns on every tab switch slows down low-end school laptops and burns Supabase Free egress (5 GB/mo).
- **Fix:** Paginate student/fee/exam tables server-side (`.range(from, to)`) and select only needed columns.

### 12. [DONE] Migrate Student Photos & Signatures from Supabase Storage to Cloudinary
- **Status:** Switched [components/Students.tsx](file:///c:/Users/HP/Desktop/orbit/components/Students.tsx) and [components/Exams.tsx](file:///c:/Users/HP/Desktop/orbit/components/Exams.tsx) to upload compressed images to Cloudinary via [utils/cloudinary.ts](file:///c:/Users/HP/Desktop/orbit/utils/cloudinary.ts), avoiding Supabase Storage & 5 GB/mo egress limits.

---

## Recommended Fix Order
1. **Item #1** (Move Hubtel secrets out of frontend)
2. **Item #4** (HTTPS proxy / SSL for Oracle AI Agent + auth middleware)
3. **Item #2** (Fix missing tables/RPCs in `cvikeikqhxxkwdupglpp`)
4. **Item #3** (Server-side Paystack verification + lock down balance updates)
5. **Item #5 & #7** (Remove hardcoded `silas@222` + run cross-school RLS test)
6. **Item #8, #9, #10, #11, #12** (Audit logs, Toast errors, backups, pagination, R2)
