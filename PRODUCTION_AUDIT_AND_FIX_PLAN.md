# Orbit / Base16 Production Readiness Audit & Fix Plan

Generated from live inspection of `cvikeikqhxxkwdupglpp.supabase.co`, frontend (`components/`, `utils/`), backend (`backend/`), Edge Functions (`supabase/functions/`), and Vercel deployment config.

---

## P0 — Critical Security & Broken Production Features (Fix First)

### 1. Hubtel SMS Secrets Exposed in Frontend Bundle
- **Where:** `.env` (`VITE_HUBTEL_CLIENT_ID`, `VITE_HUBTEL_CLIENT_SECRET`), [utils/sms.ts](file:///c:/Users/HP/Desktop/orbit/utils/sms.ts#L60-L76), [supabase/functions/send-sms/index.ts](file:///c:/Users/HP/Desktop/orbit/supabase/functions/send-sms/index.ts#L31-L33)
- **Risk:** Any variable starting with `VITE_` is compiled into the public browser JS bundle. Anyone can inspect DevTools and steal your Hubtel API credentials to send SMS on your account.
- **Fix:**
  1. Set `HUBTEL_CLIENT_ID`, `HUBTEL_CLIENT_SECRET`, and `HUBTEL_SENDER_ID` as Supabase Edge Function secrets (`supabase secrets set`).
  2. Remove `hubtelKeys` from [utils/sms.ts](file:///c:/Users/HP/Desktop/orbit/utils/sms.ts#L72-L76) and remove `VITE_HUBTEL_*` from `.env` and Vercel.
  3. Require a valid logged-in user JWT inside `send-sms/index.ts` and deduct SMS credits atomically server-side before sending.

### 2. Missing Tables & RPCs in Live Database (`cvikeikqhxxkwdupglpp`)
Our automated scan against the live OpenAPI schema (`31 tables`, `24 RPCs`) found frontend calls referencing tables and RPCs that **do not exist** in `cvikeikqhxxkwdupglpp`:
- **Missing Tables:**
  - `notices` (used in [components/Dashboard.tsx](file:///c:/Users/HP/Desktop/orbit/components/Dashboard.tsx) and [backend/tools.py](file:///c:/Users/HP/Desktop/orbit/backend/tools.py#L171-L230))
  - `message_logs` (used in [components/Communication.tsx](file:///c:/Users/HP/Desktop/orbit/components/Communication.tsx#L110) and [components/Exams.tsx](file:///c:/Users/HP/Desktop/orbit/components/Exams.tsx))
  - `referrals` (used in [components/Analytics.tsx](file:///c:/Users/HP/Desktop/orbit/components/Analytics.tsx))
  - `demo_bookings` (used in [components/BookDemo.tsx](file:///c:/Users/HP/Desktop/orbit/components/BookDemo.tsx))
- **Missing RPCs:**
  - `start_new_term` ([components/Dashboard.tsx](file:///c:/Users/HP/Desktop/orbit/components/Dashboard.tsx))
  - `add_fee_to_students` ([components/Fees.tsx](file:///c:/Users/HP/Desktop/orbit/components/Fees.tsx))
  - `create_teacher_user` ([components/Teachers.tsx](file:///c:/Users/HP/Desktop/orbit/components/Teachers.tsx))
  - `get_student_class_rank`, `toggle_mark_entry`, `submit_exam_marks_v3`, `unsubmit_exam_marks`, `publish_class_results` ([components/Exams.tsx](file:///c:/Users/HP/Desktop/orbit/components/Exams.tsx))
  - `get_student_attendance_summary` ([components/ReportCard.tsx](file:///c:/Users/HP/Desktop/orbit/components/ReportCard.tsx))
- **Fix:** Audit each one — create the missing tables/RPCs in `cvikeikqhxxkwdupglpp` (from `supabase/` migrations) or update the frontend calls to use the new `master_schema_v1.sql` names (e.g., `app_notifications` vs `notices`).

### 3. Client-Side Paystack & Wallet Unlocking (Revenue Bypass Risk)
- **Where:** [components/ModuleLockGate.tsx](file:///c:/Users/HP/Desktop/orbit/components/ModuleLockGate.tsx#L42-L166), [components/Settings.tsx](file:///c:/Users/HP/Desktop/orbit/components/Settings.tsx)
- **Risk:** `onSuccess` in `PaystackPop` directly updates `school_subscriptions` and `schools.wallet_balance` from the browser without server-side Paystack verification. A technical user can fake a client callback or modify wallet balance via the Supabase REST API if RLS allows `schools` updates.
- **Fix:**
  1. Create a server-side Paystack webhook / verification endpoint (in FastAPI or Supabase Edge Function) using your Paystack **Secret Key** (`https://api.paystack.co/transaction/verify/:reference`).
  2. Only unlock modules / credit wallets / credit SMS from the server after Paystack confirms `status === 'success'` and the exact `amount` matches.
  3. Lock down `schools.wallet_balance`, `schools.sms_balance`, and `school_subscriptions` in RLS so normal school admins cannot `UPDATE` balances directly from the browser.

### 4. Mixed Content: Oracle AI Agent URL Uses `http://` on an `https://` Site
- **Where:** `.env` (`VITE_AI_AGENT_URL=http://155.248.239.188/base16-api/api/chat`), [backend/main.py](file:///c:/Users/HP/Desktop/orbit/backend/main.py)
- **Risk:** `https://www.base16schools.com` cannot call `http://155.248.239.188/...` directly in modern browsers (blocked as Mixed Content).
- **Fix:**
  1. Either attach an HTTPS domain (e.g., `api.base16schools.com` → `155.248.239.188` with Let's Encrypt SSL on Nginx), **or** add a Vercel serverless proxy `api/chat.js` that forwards `/api/chat` → `http://155.248.239.188/base16-api/api/chat`.
  2. Add JWT verification + `school_id` ownership check in [backend/main.py](file:///c:/Users/HP/Desktop/orbit/backend/main.py#L53-L89) and restrict `ALLOWED_ORIGINS` from `*` to `https://www.base16schools.com` (currently anyone can call `/api/chat` or `/api/send-sms` with any `school_id`).

---

## P1 — High Priority Security & Auth Hardening

### 5. Hardcoded Super Admin Shortcut & Default Passwords in Client Code
- **Where:** [components/Login.tsx](file:///c:/Users/HP/Desktop/orbit/components/Login.tsx#L44), [components/Teachers.tsx](file:///c:/Users/HP/Desktop/orbit/components/Teachers.tsx#L129)
- **Risk:** Hardcoded `silas@222` in `Login.tsx` is shipped in the public JS bundle. Default `password123` is easy to guess if teachers don't change it.
- **Fix:**
  1. Remove the hardcoded password check from `Login.tsx` (keep username shortcut `silas` → `silas@base16.com` without the password literal).
  2. Generate random temporary passwords when creating teachers and prompt them to change on first login.

### 6. Rotate Exposed Credentials & Clean `.env` / Repo History
- **Where:** `.env`, `backend/.env`, `scratch/` scripts
- **Risk:** `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, and `VITE_HUBTEL_CLIENT_SECRET` are stored in local scripts (`scratch/*.js`, `scratch/*.py`).
- **Fix:** Ensure `scratch/` and `.env` are never committed to GitHub (`.gitignore` covers `.env`, verify `scratch/` is ignored or cleaned), and rotate any keys that were ever exposed in client bundles or public logs.

### 7. Multi-Tenant RLS Isolation Verification
- **Where:** [supabase/master_schema_v1.sql](file:///c:/Users/HP/Desktop/orbit/supabase/master_schema_v1.sql)
- **Risk:** Need to verify that an authenticated user in **School A** cannot read or mutate **School B**'s `students`, `teachers`, `transactions`, `exam_results`, or `school_subscriptions` via direct REST calls.
- **Fix:** Write a small automated RLS test script using two test school accounts to verify zero cross-school read/write access on every table.

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

### 12. Migrate Student Photos from Supabase Storage to Cloudflare R2 (When Scaling)
- **Where:** [components/Students.tsx](file:///c:/Users/HP/Desktop/orbit/components/Students.tsx#L265-L327)
- **Why:** Current usage (~45 MB for 668 students) fits easily in Supabase's 1 GB storage, but Supabase Free's **5 GB/month egress** will be hit as schools view photos daily. Cloudflare R2 gives **10 GB free + \$0.015/GB + \$0 egress fees**.

---

## Recommended Fix Order
1. **Item #1** (Move Hubtel secrets out of frontend)
2. **Item #4** (HTTPS proxy / SSL for Oracle AI Agent + auth middleware)
3. **Item #2** (Fix missing tables/RPCs in `cvikeikqhxxkwdupglpp`)
4. **Item #3** (Server-side Paystack verification + lock down balance updates)
5. **Item #5 & #7** (Remove hardcoded `silas@222` + run cross-school RLS test)
6. **Item #8, #9, #10, #11, #12** (Audit logs, Toast errors, backups, pagination, R2)
