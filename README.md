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

## Deploy

1. Create a new GitHub repository and push this project to it.
2. Import the GitHub repo into Vercel.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project settings.
4. Keep the build command as `npm run build` and the output directory as `dist`.
5. Deploy the site, then share the generated Vercel URL with both users.

The app uses `vercel.json` so Vercel knows how to build and serve the SPA correctly.
