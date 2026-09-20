---
name: pyngoo-security-auditor
description: >-
  Use this skill whenever the user asks to check, scan, audit, or verify the security of the Pyngoo application, including token leaks, Supabase RLS and RPC permissions, OAuth vulnerabilities, sensitive credentials, and build bundle integrity.
---

# Pyngoo Security & Vulnerability Auditor

This skill provides an automated, multi-layer security auditing procedure tailored specifically for Pyngoo's stack: Vite, React, Supabase, OAuth, WebRTC (Agora), and client-side production bundles.

## Security Audit Checklist & Procedures

When the user asks to "check our vulnerabilities", "açıkları kontrol et", or "güvenlik taraması yap", execute these 5 verification layers systematically:

### 1. Bundle Secret Leakage & Whitelist Verification (Rule 10 & 12)
Ensure no confidential API keys, bot tokens, or private secrets have leaked into the client-side distribution bundle (`dist/assets/index-*.js` and `Pyngoo_Site/assets/index-*.js`):
- Run pattern checks for known dangerous leak signatures:
  - Check for leak string: `8734180110` (MUST BE FALSE)
  - Check for hardcoded bot tokens: `TELEGRAM_BOT_TOKEN = '...'` (MUST BE EMPTY/FALSE)
  - Verify Supabase URL presence: `https://rdqcwzosmikusketghyq.supabase.co` (MUST BE TRUE)

### 2. Supabase Server-Side RPC & RLS Audit (Rule 12)
- **RPC Anon Grant Check:** Ensure that only `check_email_exists` and `check_nickname_taken` are permitted for `anon`. All administrative functions (`admin_*`, `approve_*`, `delete_report`, etc.) must have `IF NOT public.is_caller_staff() THEN ...` guard checks.
- **RLS Tables Check:** Verify `profiles` table is not readable anonymously without auth, and `reports` table is completely closed to `anon`.

### 3. OAuth & Token Hijacking Protection (Rule 5)
- Verify `handleOAuthLogin` validates all preconditions (`checkPreconditionsAndRun`) before initiating OAuth.
- Verify that `access_token` in URL hash is never destroyed prematurely and has a bulletproof JWT fallback.
- Verify that no duplicate accounts can overwrite existing profiles without passing `check_email_exists`.

### 4. Dependency & Vulnerable Library Auditing (`Retire.js` & `npm audit`)
- Run `npx -y retire --path dist --severity high` (GitHub ~3.5k+ stars) to scan bundled JavaScript assets for known CVEs and outdated vulnerable JS libraries.
- Run `npm audit --omit=dev` to verify runtime dependencies.

### 5. Open-Source Secret Leakage Scanner (`@secretlint/quick-start`)
- Run `npx -y @secretlint/quick-start "src/**/*"` and `npx -y @secretlint/quick-start "dist/**/*"` to scan all source code and built assets for exposed secrets, credentials, and API keys.

## Verification Report Format
Always deliver a structured report with:
1. **Summary:** Overall security posture (Safe / Warnings / Critical).
2. **Layer-by-layer Results:** Findings for each of the 5 layers.
3. **Immediate Actions Taken / Needed:** Fixes already applied or recommendations.
