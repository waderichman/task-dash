import { postJson } from "@/lib/api";
import { supabase } from "@/lib/supabase";

type StripeAccountResponse = {
  accountId: string;
};

type StripeAccountLinkResponse = {
  url: string;
};

type StripeAccountStatusResponse = {
  status: "not_started" | "pending" | "active";
};

type PaymentIntentResponse = {
  paymentIntentId: string;
  clientSecret: string;
};

type ReleaseFundsResponse = {
  transferId: string;
};

async function getCurrentUserContext() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("Not authenticated.");
  }

  return data.user;
}

export async function createPayoutOnboardingLink(profileId: string, name: string) {
  const user = await getCurrentUserContext();
  const refreshUrl =
    process.env.EXPO_PUBLIC_STRIPE_CONNECT_REFRESH_URL?.trim() || "workzy://payouts?status=refresh";
  const returnUrl =
    process.env.EXPO_PUBLIC_STRIPE_CONNECT_RETURN_URL?.trim() || "workzy://payouts?status=done";

  await postJson<StripeAccountResponse>("/stripe/connect/account", {
    profileId,
    email: user.email,
    name
  });

  const accountLink = await postJson<StripeAccountLinkResponse>("/stripe/connect/account-link", {
    profileId,
    refreshUrl,
    returnUrl
  });

  return accountLink.url;
}

export async function refreshPayoutStatus(profileId: string) {
  return postJson<StripeAccountStatusResponse>("/stripe/connect/status", {
    profileId
  });
}

export async function createBookingPaymentIntent(taskId: string) {
  const user = await getCurrentUserContext();

  return postJson<PaymentIntentResponse>("/stripe/payments/payment-intent", {
    taskId,
    customerEmail: user.email
  });
}

export async function releaseTaskFunds(taskId: string) {
  return postJson<ReleaseFundsResponse>("/stripe/payments/release", {
    taskId
  });
}
