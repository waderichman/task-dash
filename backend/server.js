require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const {
  PORT = 4000,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  STRIPE_PLATFORM_COUNTRY = "US",
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  STRIPE_CONNECT_REFRESH_URL,
  STRIPE_CONNECT_RETURN_URL
} = process.env;

if (!STRIPE_SECRET_KEY) {
  console.warn("Missing STRIPE_SECRET_KEY in backend/.env");
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env");
}

const stripe = new Stripe(STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-02-24.acacia"
});

const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "");

const app = express();

function getStripeAccountStatus(account) {
  return account.details_submitted && account.payouts_enabled ? "active" : "pending";
}

app.use(cors());
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  if (!STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({ error: "Missing webhook secret" });
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).json({ error: "Missing Stripe signature" });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    if (event.type === "account.updated") {
      const account = event.data.object;
      const profileId = account.metadata?.profileId;

      if (profileId) {
        await supabase
          .from("profiles")
          .update({
            stripe_account_status: getStripeAccountStatus(account)
          })
          .eq("id", profileId);
      }
    }

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;
      const taskId = intent.metadata?.taskId;
      if (taskId) {
        await supabase
          .from("tasks")
          .update({
            stripe_payment_intent_id: intent.id,
            booking_paid_at: new Date().toISOString(),
            payment_status: "booked",
            status: "in_progress"
          })
          .eq("id", taskId);
      }
    }

    return res.json({ received: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "workzy-payments" });
});

app.get("/stripe/refresh", (_req, res) => {
  res.status(200).send("Stripe onboarding refresh. Return to Workzy and open payout setup again if needed.");
});

app.get("/stripe/return", (_req, res) => {
  res.status(200).send("Stripe onboarding complete. You can return to Workzy.");
});

app.post("/stripe/connect/account", async (req, res) => {
  try {
    const { profileId, email, name } = req.body;
    if (!profileId || !email) {
      return res.status(400).json({ error: "profileId and email are required" });
    }

    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", profileId)
      .single();

    if (existingProfileError) {
      throw existingProfileError;
    }

    if (existingProfile?.stripe_account_id) {
      return res.json({ accountId: existingProfile.stripe_account_id });
    }

    const account = await stripe.accounts.create({
      type: "express",
      country: STRIPE_PLATFORM_COUNTRY,
      email,
      business_type: "individual",
      business_profile: {
        product_description: "Local in-person household and errand services booked through Workzy."
      },
      capabilities: {
        transfers: { requested: true }
      },
      metadata: {
        profileId,
        name: name || ""
      }
    });

    const { error } = await supabase
      .from("profiles")
      .update({
        stripe_account_id: account.id,
        stripe_account_status: "pending"
      })
      .eq("id", profileId);

    if (error) {
      throw error;
    }

    return res.json({ accountId: account.id });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/stripe/connect/account-link", async (req, res) => {
  try {
    const { profileId, refreshUrl, returnUrl } = req.body;
    if (!profileId) {
      return res.status(400).json({ error: "profileId is required" });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", profileId)
      .single();

    if (profileError) {
      throw profileError;
    }

    if (!profile?.stripe_account_id) {
      return res.status(400).json({ error: "Tasker has no Stripe account yet" });
    }

    const account = await stripe.accounts.retrieve(profile.stripe_account_id);
    const stripeAccountStatus = getStripeAccountStatus(account);

    await supabase
      .from("profiles")
      .update({
        stripe_account_status: stripeAccountStatus
      })
      .eq("id", profileId);

    if (stripeAccountStatus === "active") {
      const loginLink = await stripe.accounts.createLoginLink(profile.stripe_account_id);
      return res.json({ url: loginLink.url });
    }

    const link = await stripe.accountLinks.create({
      account: profile.stripe_account_id,
      refresh_url: refreshUrl || STRIPE_CONNECT_REFRESH_URL,
      return_url: returnUrl || STRIPE_CONNECT_RETURN_URL,
      type: "account_onboarding"
    });

    return res.json({ url: link.url });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/stripe/connect/status", async (req, res) => {
  try {
    const { profileId } = req.body;
    if (!profileId) {
      return res.status(400).json({ error: "profileId is required" });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", profileId)
      .single();

    if (profileError) {
      throw profileError;
    }

    if (!profile?.stripe_account_id) {
      await supabase
        .from("profiles")
        .update({
          stripe_account_status: "not_started"
        })
        .eq("id", profileId);

      return res.json({ status: "not_started" });
    }

    const account = await stripe.accounts.retrieve(profile.stripe_account_id);
    const stripeAccountStatus = getStripeAccountStatus(account);

    await supabase
      .from("profiles")
      .update({
        stripe_account_status: stripeAccountStatus
      })
      .eq("id", profileId);

    return res.json({ status: stripeAccountStatus });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/stripe/payments/payment-intent", async (req, res) => {
  try {
    const { taskId, customerEmail } = req.body;
    if (!taskId) {
      return res.status(400).json({ error: "taskId is required" });
    }

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, posted_by, assigned_to, agreed_price, budget, platform_fee_amount, tasker_payout_amount, stripe_payment_intent_id")
      .eq("id", taskId)
      .single();

    if (taskError) {
      throw taskError;
    }

    const amount = task.agreed_price ?? task.budget;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Task has no payable amount yet" });
    }

    if (task.stripe_payment_intent_id) {
      const existingIntent = await stripe.paymentIntents.retrieve(task.stripe_payment_intent_id);
      return res.json({
        paymentIntentId: existingIntent.id,
        clientSecret: existingIntent.client_secret
      });
    }

    const intent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: "usd",
      automatic_payment_methods: {
        enabled: true
      },
      receipt_email: customerEmail || undefined,
      metadata: {
        taskId: task.id,
        postedBy: task.posted_by,
        assignedTo: task.assigned_to || "",
        platformFeeAmount: String(task.platform_fee_amount || 0),
        taskerPayoutAmount: String(task.tasker_payout_amount || 0)
      }
    });

    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        stripe_payment_intent_id: intent.id
      })
      .eq("id", task.id);

    if (updateError) {
      throw updateError;
    }

    return res.json({
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/stripe/payments/release", async (req, res) => {
  try {
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ error: "taskId is required" });
    }

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, assigned_to, status, stripe_payment_intent_id, stripe_transfer_id, tasker_payout_amount")
      .eq("id", taskId)
      .single();

    if (taskError) {
      throw taskError;
    }

    if (task.status !== "completed") {
      return res.status(400).json({ error: "Task must be completed before funds can be released" });
    }

    if (!task.stripe_payment_intent_id) {
      return res.status(400).json({ error: "No payment intent found for this task" });
    }

    if (!task.assigned_to) {
      return res.status(400).json({ error: "No assigned tasker found for this task" });
    }

    if (task.stripe_transfer_id) {
      return res.json({ transferId: task.stripe_transfer_id });
    }

    const { data: taskerProfile, error: taskerError } = await supabase
      .from("profiles")
      .select("stripe_account_id, stripe_account_status")
      .eq("id", task.assigned_to)
      .single();

    if (taskerError) {
      throw taskerError;
    }

    if (!taskerProfile?.stripe_account_id) {
      return res.status(400).json({ error: "Tasker has not completed Stripe onboarding yet" });
    }

    const transfer = await stripe.transfers.create({
      amount: task.tasker_payout_amount * 100,
      currency: "usd",
      destination: taskerProfile.stripe_account_id,
      source_transaction: undefined,
      metadata: {
        taskId: task.id,
        paymentIntentId: task.stripe_payment_intent_id
      }
    });

    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        stripe_transfer_id: transfer.id,
        funds_released_at: new Date().toISOString()
      })
      .eq("id", task.id);

    if (updateError) {
      throw updateError;
    }

    return res.json({ transferId: transfer.id });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Workzy payments API listening on port ${PORT}`);
});
