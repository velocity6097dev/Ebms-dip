# Water Dip & Appearance Register

A web version of your two paper logs:

1. **Daily Water Dip & Appearance Monitoring Format (Monsoon Month)** — one entry per day, morning + evening, per tank.
2. **Hourly Water Dip & Appearance Monitoring Format (Rainy Days)** — one entry per hour while it's raining.

The owner can edit **Retail Outlet Name**, **Month**, **Year**, and the two tank labels at any time. Whoever checks a row can tap **+ Sign** and draw their signature right on the row (finger, mouse, or stylus) — no more pen needed. Every cell autosaves a moment after you stop typing.

Login and data storage run on **Supabase** (Postgres + Auth), so each outlet owner only ever sees their own records.

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project (free tier is fine).
2. In **Project Settings → API**, copy the **Project URL** and the **anon public key**.
3. In the Supabase dashboard, open **SQL Editor → New query**, paste the contents of `supabase-schema.sql` (included in this project), and run it. This creates three tables — `outlet_settings`, `monsoon_entries`, `rainy_entries` — each locked down with Row Level Security so a user can only read/write their own rows.
4. (Optional) In **Authentication → Providers**, email/password sign-up is on by default. If you don't want the "confirm your email" step, turn off **Confirm email** under **Authentication → Settings**.

## 2. Configure the app

```bash
cp .env.example .env
```

Edit `.env`:

```
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
PORT=3000
```

The anon key is meant to be public (it's what every Supabase front end ships) — the real protection is the Row Level Security policies from `supabase-schema.sql`.

## 3. Run it

```bash
npm install
npm start
```

Open **http://localhost:3000**. Create an account (email + password), sign in, and the register loads.

## How it's organized

```
water-dip-monitoring/
├── server.js              # Express server — serves the app, injects Supabase config
├── supabase-schema.sql    # Run once in Supabase's SQL editor
├── .env.example            # Copy to .env and fill in your Supabase keys
├── package.json
└── public/
    ├── index.html          # Login screen + both register panels + signature modal
    ├── style.css           # Ledger/logbook styling
    └── app.js              # Supabase auth, autosave, signature capture logic
```

## Using the register

- **Outlet details card** — set Retail Outlet Name, Month, Year, and rename the two tanks. Click **Save outlet details**. These labels also update the table headers and the browser tab title live.
- **Two tabs** — "Monthly register (monsoon)" mirrors your first sheet; "Hourly register (rainy days)" mirrors the second.
- **+ Add day / + Add reading** — adds a new blank row, saved to Supabase immediately.
- **Any cell** — edit dip readings, pick an Appearance (Clear / Hazy / Water layer — color-coded), or type Remarks. A small dot next to the delete button turns amber while saving and green once saved.
- **Save all** — forces every pending edit to save immediately (useful right before printing or closing the tab).
- **+ Sign** — opens a signature pad; the checker types their name, signs, and taps **Save signature**. The signature and name are stored in that row and shown as a small thumbnail.
- **✕** — deletes a row (asks for confirmation first).
- **Print** — flips to that tab's clean, printable view.

## Notes on extending it

- Want more than two tanks? Add columns to `monsoon_entries` / `rainy_entries` in Supabase, then extend the row HTML in `app.js` (`renderMonsoonRow` / `renderRainyRow`) and the header cells in `index.html`.
- Want a PDF export instead of browser print? The print stylesheet at the bottom of `style.css` is the place to start, or swap in a library like `pdfmake` on the server.
- Want multiple staff logins to see the *same* outlet's data (not just the owner)? Add an `outlet_members` table linking multiple `user_id`s to one outlet, and adjust the Row Level Security policies in `supabase-schema.sql` to check membership instead of `user_id = auth.uid()`.
