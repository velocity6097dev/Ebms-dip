# Water Dip & Appearance Register

A web version of your monitoring workbook, with real logins for staff and a genuine spreadsheet-style view. Built on **Node/Express** + **Supabase** (Postgres + Auth).

Three registers, matching your uploaded workbook:

1. **Monthly register** (Daily Water Dip & Appearance Monitoring — Monsoon Months) — one entry per day, morning + evening, per tank.
2. **Hourly register** (Rainy Days) — one entry per hour while it's raining, per tank.
3. **Contamination log** — one row per confirmed water contamination instance.

## What's fixed / new in this version

- **Deleting a staff account now actually works.** The previous version blocked it at the database level (a foreign key constraint) — fixed in `supabase-schema.sql`. **You need to re-run that file once** for this fix to take effect on your project.
- **Signatures can no longer be overwritten.** Signing now happens in its own dedicated full-screen view: tap **Sign**, draw, tap **OK — save signature**, and it's written to the database immediately. Once an entry is signed, the signature is shown locked — nobody, including the original signer, can re-sign or overwrite it. Only entries without a signature yet show a Sign button.
- **Hourly register timestamps are locked for staff.** When a staff member adds an hourly reading, the date and time are captured automatically from the clock and can't be edited — this stops back-dating. The owner can still set/edit the date and time freely (e.g. to correct a mistake or enter something after the fact).
- **Add-staff and Log out moved to the top bar.** Owners see a "+person" icon at the top of every screen to add a new staff account (opens a small popup — name, email, temporary password). A log-out icon sits next to it for everyone. Settings still shows the list of existing staff for renaming or removing.
- **Print icon** now uses the actual Lucide "printer" icon.

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project (free tier is fine).
2. In **Project Settings → API Keys** you need three values:
   - **Project URL**
   - **Publishable key** (`sb_publishable_...`) or legacy **anon public** key — safe for the browser.
   - **Secret key** (`sb_secret_...`) or legacy **service_role** key — **server-only, never expose this**. It's what lets the owner create staff logins.
3. In **SQL Editor → New query**, paste the contents of `supabase-schema.sql` and run it. Safe to re-run — uses `IF NOT EXISTS` / constraint-replacement patterns throughout, so running it again (e.g. to pick up this update's staff-delete fix) won't touch your existing data.
4. In **Authentication → URL Configuration**, add your app's URL (e.g. `http://localhost:3000`, or your real domain once deployed) to **Redirect URLs** — required for the "forgot password" email link.
5. (Optional) In **Authentication → Settings**, turn off **Confirm email** if you don't want the "check your email" step after registering.

## 2. Configure the app

```bash
cp .env.example .env
```

Edit `.env`:

```
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-OR-ANON-KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR-SECRET-OR-SERVICE-ROLE-KEY
PORT=3000
```

`SUPABASE_ANON_KEY` is meant to be public. `SUPABASE_SERVICE_ROLE_KEY` is **not** — it stays on the server and is never sent to the browser. It powers the two admin-only routes in `server.js` (`POST /api/create-staff`, `DELETE /api/staff/:id`).

## 3. Run it

```bash
npm install
npm start
```

Open **http://localhost:3000**.

## First-time flow

1. **Register outlet** — owner's name, outlet name, email, password.
2. **Set up your tanks** — how many tanks, then a name + quantity (litres) for each. Editable later in Settings.
3. Tap the **+person** icon at the top of any screen to add a staff account (name, email, temporary password). Share those credentials with them — they sign in at the same login screen you used.

## How it's organized

```
water-dip-monitoring/
├── server.js               # Express server — serves the app, injects Supabase config,
│                            #   and exposes owner-only staff-management API routes
├── supabase-schema.sql     # Safe to re-run in Supabase's SQL editor any time
├── .env.example             # Copy to .env and fill in your Supabase keys
├── package.json
└── public/
    ├── index.html           # Auth/registration, recovery, onboarding, app shell, modals
    ├── style.css            # Excel-grid tables, entry popup, full-screen signer, bottom sheets
    └── app.js               # Auth + role detection, tanks/staff, grids, entry popup, signing
```

## Using the register

- **Top bar** — outlet name and month/year on the left; role badge, add-staff (owners only), and log-out on the right.
- **Bottom nav** — Monthly, Hourly, Contam., Settings.
- **Tap any row** in a register to open it in the entry popup and edit it. Tap the **+** button to start a new one.
- **In the popup** — fill in the date (and hour, for the Hourly register), each tank's readings (dip in mm, appearance via a bottom-sheet picker), and remarks, then tap **Save**.
- **Signing** — tap **Sign** in the popup. This opens a full-screen signing view: draw your signature, tap **OK — save signature**. It's written to the database immediately and shown locked from then on — it cannot be re-signed or overwritten by anyone, including the original signer. Your name and the exact time are captured automatically; nobody has to be picked from a list.
- **Delete** — inside the popup, for existing entries (asks for confirmation).
- **Print icon** — a clean, register-only printout with outlet name and month/year at the top.
- **Settings → Account** — change password. Owners additionally see Outlet details, Tanks, and the Staff accounts list; staff see a read-only outlet summary plus their own Account section.

## Staff vs. owner — what each can do

| | Owner | Staff |
|---|---|---|
| Register the outlet | ✅ | — |
| Edit outlet name / month / year | ✅ | view only |
| Add / rename / remove tanks | ✅ | view only |
| Add / remove staff accounts | ✅ | — |
| Fill in / edit register entries | ✅ | ✅ |
| Sign an entry | ✅ | ✅ |
| Edit an entry's date/time (Hourly register) | ✅ | 🔒 auto-captured, locked |
| Change their own password | ✅ | ✅ |

This is enforced both in the UI and at the database level (Row Level Security), so it holds even if someone bypasses the app's UI.

## Password reset details

- **Forgot password (signed out):** tap "Forgot password?" on the sign-in screen, enter your email, and Supabase sends a reset link. Opening that link brings you back to the app on a "Set a new password" screen.
- **Change password (signed in):** Settings → Account → **Change password**.
- Both work the same for owner and staff logins.

## Extending it further

- **Same date/time lock on the Monthly register too?** Right now only the Hourly register locks the date for staff. If you'd like the same rule on the Monthly register, that's a small change to `buildMonsoonForm` in `app.js` mirroring what `buildRainyForm` already does.
- **PDF export instead of browser print?** The `@media print` block at the bottom of `style.css` is the place to start, or generate PDFs server-side with a library like `pdfmake`.
- **More fields per tank?** Add columns to the `tanks` table, then extend the form builders in `app.js` (`buildMonsoonForm` / `buildRainyForm` / `buildContamForm`).

## Anything else you'd like changed?

Tell me specifically what's off and I'll fix it — a screenshot of what looks wrong helps even more than a description.
