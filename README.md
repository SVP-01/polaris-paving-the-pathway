# The Zine

The Zine is a private two-person mentorship tracker with an indie zine / risograph look and a live, event-sourced data model.

## What it includes

- Mentor and Mentee login entry
- Daily task list with sticky-note suggestions
- Pitch board for resources
- Pieces journal with sticky-note feedback
- Spark capture
- Still Thinking About It shelf
- Reaction tags
- Weekly cover page / Editor's Letter
- Exploration map
- Off the Record Q&A board
- Permanent archive views
- In-app notifications

## Local run

```bash
npm install
npm run dev
```

Open the Vite URL printed in the terminal.

## Supabase setup

Set these environment variables in a `.env` file:

```bash
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

The app expects a `zine_events` table with these columns:

- `id` text primary key
- `kind` text
- `payload` jsonb
- `created_at` timestamptz

For best results, also create a `profiles` table for your own auth/profile workflow. The frontend is ready to read live events from Supabase and will fall back to local browser storage if those env vars are missing.

## Build

```bash
npm run build
```

If Windows / OneDrive path resolution causes Vite to complain during build in this workspace, the app still runs normally in dev and the production `dist` bundle can be generated from a non-OneDrive temp copy.
