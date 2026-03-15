# TaskDash

Expo/React Native app for a local task marketplace with Supabase auth and live marketplace data.

## Included

- Two-sided flow with `poster` and `tasker` roles
- Supabase email/password auth with email confirmation
- ZIP-based job visibility for local taskers
- Post flow for publishing a job and opening a negotiation thread
- Inbox screen for chat, questions, and offer negotiation
- Profile screen with role switching and account stats
- Zustand state with persisted active role and selected thread

## Run

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
- Email confirmation redirects should include `taskdash://confirm`.
- The current product flow includes one public job thread for questions plus separate private poster-tasker chats for negotiation and offers.
