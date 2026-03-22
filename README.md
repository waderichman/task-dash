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
EXPO_PUBLIC_API_BASE_URL=http://YOUR_COMPUTER_LAN_IP:4000
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
EXPO_PUBLIC_AUTH_CONFIRM_REDIRECT_URL=workzy://confirm
EXPO_PUBLIC_STRIPE_CONNECT_REFRESH_URL=workzy://payouts?status=refresh
EXPO_PUBLIC_STRIPE_CONNECT_RETURN_URL=workzy://payouts?status=done
```

## Notes

- The SQL schema lives in `supabase/schema.sql`.
- Email confirmation redirects should include `workzy://confirm`.
- Stripe Connect return and refresh URLs can point back into the app with `workzy://payouts?...`.
- Supabase Auth email sender branding is not controlled by this app code. For production, configure custom SMTP in Supabase Auth so confirmations come from your Workzy domain instead of the default Supabase sender.

## Payments Backend

Workzy now includes a small Stripe backend scaffold in `backend/server.js`.

1. Copy `backend/.env.example` to `backend/.env`
2. Add your backend-only secrets there
3. Run `npm run api`

Backend envs:

```bash
PORT=4000
STRIPE_SECRET_KEY=your_rotated_server_only_secret
STRIPE_WEBHOOK_SECRET=your_webhook_secret
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
STRIPE_CONNECT_REFRESH_URL=workzy://payouts?status=refresh
STRIPE_CONNECT_RETURN_URL=workzy://payouts?status=done
```

Available routes:

- `GET /health`
- `POST /stripe/connect/account`
- `POST /stripe/connect/account-link`
- `POST /stripe/connect/status`
- `POST /stripe/payments/payment-intent`
- `POST /stripe/payments/release`
- `POST /webhooks/stripe`
