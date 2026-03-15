# Supabase Setup

This project now has a production scaffold for Supabase auth and data storage.

## 1. Create the project

1. Create a Supabase project.
2. Copy the project URL and anon key.
3. Put them in `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 2. Run the schema

Open the Supabase SQL editor and run [`schema.sql`](/c:/Users/irene/OneDrive/Desktop/IOS/supabase/schema.sql).

That creates:

- `profiles` for poster/tasker accounts
- `tasker_service_areas` for ZIP codes a tasker covers
- `tasks`, `task_tags`
- `conversations`, `conversation_participants`, `messages`
- `reviews`
- row-level security policies

## 3. ZIP-code matching

The production rule is:

- Posters can always see tasks they posted.
- Taskers can see open tasks if the job ZIP is inside their manual service ZIPs or within their travel radius.
- Posters only reach taskers who cover the posted ZIP code.

The app now supports a tasker `travel_radius_miles` setting plus a nationwide `zip_codes` table.
At sign-up, the app can query nearby ZIPs from ZIP coordinates and save those ZIPs into
`tasker_service_areas` for faster visibility checks.

That logic is enforced in two places:

- Local prototype logic in the Zustand store
- Database visibility rules in the `tasks` RLS policy

## 4. Full USA ZIP coverage

For nationwide coverage, you should load a real nationwide ZIP coordinate dataset into `zip_codes`.

Expected columns:

- `zip_code`
- `city`
- `state_code`
- `latitude`
- `longitude`

How it works:

1. A tasker sets a home ZIP and travel radius.
2. The app queries the `nearby_zip_codes` function for all ZIPs within that radius.
3. Those ZIPs are written into `tasker_service_areas`.
4. Database policies also use `tasker_can_reach_zip(...)` for radius-based visibility.

Recommended production approach:

- import a nationwide ZIP latitude/longitude dataset into `zip_codes`
- use the built-in SQL distance functions in `schema.sql`
- optionally still keep `tasker_service_areas` as the fast cached visibility layer

The repo is now wired for nationwide matching logic, but you still need to import the real
nationwide ZIP coordinate dataset into `zip_codes` for every US ZIP to work.

## 5. App integration path

Use [`lib/supabase.ts`](/c:/Users/irene/OneDrive/Desktop/IOS/lib/supabase.ts) as the shared client.

Recommended next migration steps:

1. Replace local `login` and `signUp` store actions with `supabase.auth.signInWithPassword` and `supabase.auth.signUp`.
2. Save profile rows to `profiles` after sign-up.
3. Load visible tasks with a query or RPC that joins `tasks`, `task_tags`, and participant data.
4. Replace the in-memory conversation/task mutations with inserts and updates against Supabase tables.
5. Add realtime subscriptions for `messages` and `tasks`.

## 6. Hosting

- iOS app: build and ship with Expo EAS / App Store
- Backend logic if needed: Supabase Edge Functions or Vercel
- Database/auth/storage: Supabase
