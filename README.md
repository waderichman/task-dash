# Workzy

Workzy is a local task marketplace app built with Expo and React Native.

People posting work can create a job, answer public questions, and review private offers from nearby taskers. Taskers can discover jobs in the ZIP codes they cover, join the public thread for a job, and open a private chat when they want to negotiate price or details.

## What It Does

- Two-sided flow with `poster` and `tasker` roles
- Supabase auth for sign up, sign in, and session handling
- ZIP-based matching so local jobs reach the right taskers
- Public job threads for general questions
- Private poster-tasker chats for offers and negotiation
- Profile and role switching for hiring or tasking

## Local Setup

1. Install Node 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set your Supabase project values in `.env`.
5. Run `npx expo start --dev-client`.

Example:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Notes

- The SQL schema lives in `supabase/schema.sql`.
- Email confirmation redirects should include `workzy://confirm`.
