import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/screen";
import { createPayoutOnboardingLink, refreshPayoutStatus } from "@/lib/payments";
import { useAppStore } from "@/store/use-app-store";

type SetupState = "loading" | "pending" | "active" | "not_started" | "error";

export default function PayoutsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const currentAccount = useAppStore((state) => state.currentAccount);
  const tasks = useAppStore((state) => state.tasks);
  const refreshMarketplace = useAppStore((state) => state.refreshMarketplace);
  const [status, setStatus] = useState<SetupState>("loading");
  const [message, setMessage] = useState("Checking your payout setup...");
  const [isOpeningStripe, setIsOpeningStripe] = useState(false);

  const activeAssignedTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.assignedTo === currentAccount?.id &&
          ["assigned", "in_progress", "completion_requested", "completed"].includes(task.status)
      ),
    [currentAccount?.id, tasks]
  );

  const syncStatus = useCallback(async () => {
    if (!currentAccount) {
      setStatus("error");
      setMessage("Log in again before checking your payout status.");
      return;
    }

    setStatus("loading");
    setMessage("Checking your payout setup...");

    try {
      const result = await refreshPayoutStatus(currentAccount.id);
      await refreshMarketplace();

      if (result.status === "active") {
        setStatus("active");
        setMessage("Your payout account is ready. When customers release funds, your payouts can go through.");
        return;
      }

      if (result.status === "pending") {
        setStatus("pending");
        setMessage(
          params.status === "refresh"
            ? "Stripe still needs a little more information from you. Continue where you left off to finish verification."
            : "Your payout setup has started, but Stripe still needs the final verification details."
        );
        return;
      }

      setStatus("not_started");
      setMessage("You can browse and win tasks first. We only ask for payout setup when you are ready to receive money.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to check payout status.");
    }
  }, [currentAccount, params.status, refreshMarketplace]);

  useEffect(() => {
    void syncStatus();
  }, [syncStatus]);

  useFocusEffect(
    useCallback(() => {
      void syncStatus();
    }, [syncStatus])
  );

  const handleContinue = async () => {
    if (!currentAccount) {
      return;
    }

    try {
      setIsOpeningStripe(true);
      const url = await createPayoutOnboardingLink(currentAccount.id, currentAccount.name);
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        throw new Error("Your device could not open Stripe right now.");
      }

      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(
        "Unable to continue",
        error instanceof Error ? error.message : "Stripe could not be opened right now."
      );
    } finally {
      setIsOpeningStripe(false);
    }
  };

  const primaryLabel =
    status === "active"
      ? "Back to account"
      : status === "pending"
        ? "Continue verification"
        : "Continue to Stripe";

  return (
    <Screen>
      <View className="rounded-[28px] border border-[#d9e7ff] bg-[#f5f8ff] px-5 py-5">
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#0f6fff]">Get Paid</Text>
        <Text className="mt-3 text-[30px] font-black leading-9 text-[#101828]">Set up payouts once, then Workzy handles the rest.</Text>
        <Text className="mt-3 text-sm leading-6 text-[#475467]">{message}</Text>
      </View>

      <View className="mt-6 rounded-[28px] border border-[#e4e7ec] bg-white px-5 py-5">
        <Text className="text-[22px] font-black text-[#101828]">How this works</Text>
        <StepRow
          title="1. Keep using Workzy normally"
          detail="Browsing, posting, messaging, and winning jobs all happen inside the app."
          complete
        />
        <StepRow
          title="2. We prepare your payout profile"
          detail="Workzy uses your profile name and email first so Stripe does not start from zero."
          complete={Boolean(currentAccount)}
        />
        <StepRow
          title="3. Finish the regulated payout step"
          detail="Stripe still has to verify your identity and bank details before money can be paid out."
          complete={status === "active"}
          pending={status === "pending"}
        />
      </View>

      <View className="mt-6 rounded-[28px] border border-[#e4e7ec] bg-white px-5 py-5">
        <Text className="text-[22px] font-black text-[#101828]">Why Stripe appears at the end</Text>
        <Text className="mt-3 text-sm leading-6 text-[#475467]">
          Good marketplace apps usually keep everything inside the app until the final legal payout step. That last step is
          where Stripe collects bank, identity, tax, and compliance details.
        </Text>
      </View>

      <View className="mt-6 rounded-[28px] border border-[#e4e7ec] bg-white px-5 py-5">
        <Text className="text-[22px] font-black text-[#101828]">Your current jobs</Text>
        <Text className="mt-3 text-sm leading-6 text-[#475467]">
          {activeAssignedTasks.length
            ? `You currently have ${activeAssignedTasks.length} task${activeAssignedTasks.length === 1 ? "" : "s"} that may eventually need payout release.`
            : "You do not have any active hired tasks right now, so you can finish this later."}
        </Text>
      </View>

      <View className="mt-6 rounded-[28px] border border-[#e4e7ec] bg-white px-5 py-5">
        {status === "loading" ? <ActivityIndicator color="#0f6fff" /> : null}

        <Pressable
          onPress={() => {
            if (status === "active") {
              router.replace("/(tabs)/premium");
              return;
            }

            void handleContinue();
          }}
          className="rounded-full bg-[#0f6fff] px-4 py-4"
        >
          <Text className="text-center text-sm font-bold text-white">
            {isOpeningStripe ? "Opening Stripe..." : primaryLabel}
          </Text>
        </Pressable>

        <Pressable onPress={() => void syncStatus()} className="mt-3 rounded-full border border-[#d0d5dd] bg-white px-4 py-4">
          <Text className="text-center text-sm font-bold text-[#344054]">Refresh payout status</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function StepRow({
  title,
  detail,
  complete = false,
  pending = false
}: {
  title: string;
  detail: string;
  complete?: boolean;
  pending?: boolean;
}) {
  const badgeLabel = complete ? "Done" : pending ? "In progress" : "Next";
  const badgeClassName = complete ? "bg-[#e8f7ee] text-[#027a48]" : pending ? "bg-[#fff4e5] text-[#b54708]" : "bg-[#eef2f6] text-[#344054]";

  return (
    <View className="mt-5 rounded-[22px] border border-[#e4e7ec] bg-[#f9fafb] px-4 py-4">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-base font-black text-[#101828]">{title}</Text>
        <Text className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[1px] ${badgeClassName}`}>
          {badgeLabel}
        </Text>
      </View>
      <Text className="mt-2 text-sm leading-6 text-[#475467]">{detail}</Text>
    </View>
  );
}
