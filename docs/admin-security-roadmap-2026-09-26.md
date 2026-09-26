# VerSans — Admin security roadmap

Date: 2026-09-26

## Current controls

- Admin/staff accounts use a shorter server-side session lifetime of 8 hours, while customer sessions keep the existing lifetime.
- Admin and staff access is role-based (`admin` / `staff`) and protected by server-side permission checks.
- Blocking an account invalidates its active sessions.
- Password reset invalidates active sessions.

## 2FA

Two-factor authentication (2FA) is not enabled in the current release because the action table marks it as a future hardening step rather than a launch requirement.

Before the admin area accumulates a significant volume of orders or customer information, add TOTP-based 2FA for privileged accounts (admin/staff), including enrollment, recovery codes, re-authentication for sensitive actions, and a safe recovery procedure.
