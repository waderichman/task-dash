import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/screen";
import { isStripeAvailable, useOptionalStripe } from "@/lib/optional-stripe";
import { createBookingPaymentIntent } from "@/lib/payments";
import { useAppStore } from "@/store/use-app-store";

function taskSummary(status?: string, isPoster = false) {
  if (status === "open") return isPoster ? "Review offers and book when you're ready." : "Ask questions or send your offer.";
  if (status === "assigned") return isPoster ? "Payment is needed before work begins." : "Your offer was accepted. Wait for payment to start.";
  if (status === "in_progress") return isPoster ? "Work is underway." : "Work is underway. Request completion when finished.";
  if (status === "completion_requested") return isPoster ? "Confirm completion if the task is done." : "Waiting for the customer to confirm completion.";
  if (status === "completed") return isPoster ? "Release funds to close the booking." : "Waiting for the customer to release funds.";
  if (status === "released") return "This booking is finished.";
  return "Choose a conversation to continue.";
}

export function InboxScreen() {
  const router = useRouter();
  const stripe = useOptionalStripe();
  const currentAccount = useAppStore((state) => state.currentAccount);
  const conversations = useAppStore((state) => state.conversations);
  const tasks = useAppStore((state) => state.tasks);
  const users = useAppStore((state) => state.users);
  const selectedConversationId = useAppStore((state) => state.selectedConversationId);
  const selectConversation = useAppStore((state) => state.selectConversation);
  const sendMessage = useAppStore((state) => state.sendMessage);
  const acceptLatestOffer = useAppStore((state) => state.acceptLatestOffer);
  const confirmBookingPayment = useAppStore((state) => state.confirmBookingPayment);
  const requestTaskCompletion = useAppStore((state) => state.requestTaskCompletion);
  const completeTask = useAppStore((state) => state.completeTask);
  const releaseFunds = useAppStore((state) => state.releaseFunds);
  const refreshMarketplace = useAppStore((state) => state.refreshMarketplace);
  const error = useAppStore((state) => state.error);
  const status = useAppStore((state) => state.status);
  const [draft, setDraft] = useState("");

  const privateConversations = useMemo(
    () => conversations.filter((conversation) => (conversation.threadType ?? "private") === "private"),
    [conversations]
  );

  const selectedConversation =
    privateConversations.find((conversation) => conversation.id === selectedConversationId) ?? privateConversations[0];
  const selectedTask = tasks.find((task) => task.id === selectedConversation?.taskId);
  const counterpart = selectedConversation?.participantIds
    .filter((id) => id !== currentAccount?.id)
    .map((id) => users.find((user) => user.id === id))
    .find(Boolean);
  const latestOffer = [...(selectedConversation?.messages ?? [])]
    .reverse()
    .find((message) => typeof message.offerAmount === "number");
  const isPoster = selectedTask?.postedBy === currentAccount?.id;
  const needsPayoutSetup =
    selectedTask?.assignedTo === currentAccount?.id && currentAccount?.stripeAccountStatus !== "active";

  const submitMessage = () => {
    if (!selectedConversation || !draft.trim()) return;
    void sendMessage(selectedConversation.id, draft.trim(), { kind: "message" });
    setDraft("");
  };

  const sendOffer = (amount: number) => {
    if (!selectedConversation) return;
    void sendMessage(selectedConversation.id, `I can do this for $${amount}.`, {
      kind: "offer",
      offerAmount: amount
    });
  };

  const handleCheckout = async () => {
    if (!selectedTask) return;

    if (!stripe || !isStripeAvailable()) {
      Alert.alert("Stripe not available", "Rebuild the dev client if the Stripe native module is missing.");
      return;
    }

    try {
      const paymentIntent = await createBookingPaymentIntent(selectedTask.id);
      const initResult = await stripe.initPaymentSheet({
        merchantDisplayName: "Workzy",
        paymentIntentClientSecret: paymentIntent.clientSecret,
        returnURL: "workzy://confirm"
      });
      if (initResult.error) throw new Error(initResult.error.message);

      const paymentResult = await stripe.presentPaymentSheet();
      if (paymentResult.error) throw new Error(paymentResult.error.message);

      await confirmBookingPayment(selectedTask.id);
      await refreshMarketplace();
    } catch (paymentError) {
      Alert.alert(
        "Unable to complete payment",
        paymentError instanceof Error ? paymentError.message : "Payment failed."
      );
    }
  };

  return (
    <Screen>
      <View className="rounded-[28px] border border-[#e4e7ec] bg-white px-5 py-5">
        <Text className="text-[30px] font-black text-[#101828]">Inbox</Text>
        <Text className="mt-2 text-sm leading-6 text-[#667085]">
          Compare offers, message privately, and move each booking forward.
        </Text>
      </View>

      {error ? (
        <View className="mt-5 rounded-[20px] border border-[#f3d2d2] bg-[#fff5f5] px-4 py-4">
          <Text className="text-sm font-semibold text-[#b42318]">{error}</Text>
          <Pressable onPress={() => void refreshMarketplace()} className="mt-3 rounded-full bg-[#0f6fff] px-4 py-3">
            <Text className="text-center text-sm font-bold text-white">{status === "loading" ? "Refreshing..." : "Retry"}</Text>
          </Pressable>
        </View>
      ) : null}

      <Text className="mb-3 mt-8 text-[24px] font-black text-[#101828]">Messages</Text>
      <FlatList
        data={privateConversations}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View className="h-4" />}
        renderItem={({ item }) => {
          const task = tasks.find((entry) => entry.id === item.taskId);
          const lastMessage = item.messages[item.messages.length - 1];
          const isSelected = item.id === selectedConversation?.id;

          return (
            <Pressable
              onPress={() => selectConversation(item.id)}
              className={`rounded-[22px] border px-4 py-4 ${isSelected ? "border-[#b2ccff] bg-[#f5f8ff]" : "border-[#e4e7ec] bg-white"}`}
            >
              <Text className="text-lg font-black text-[#101828]">{task?.title ?? "Conversation"}</Text>
              <Text className="mt-1 text-sm text-[#667085]">{lastMessage?.text ?? "No messages yet"}</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={<EmptyCard text="No private chats yet." />}
      />

      <Text className="mb-3 mt-8 text-[24px] font-black text-[#101828]">Booking</Text>
      <View className="rounded-[24px] border border-[#e4e7ec] bg-white px-5 py-5">
        <Text className="text-xl font-black text-[#101828]">{selectedTask?.title ?? "Choose a conversation"}</Text>
        {counterpart ? (
          <Text className="mt-1 text-sm text-[#667085]">
            {isPoster ? `Tasker: ${counterpart.name}` : `Customer: ${counterpart.name}`}
          </Text>
        ) : null}
        {selectedTask ? (
          <>
            <Text className="mt-2 text-sm text-[#667085]">
              {selectedTask.location} | ${selectedTask.agreedPrice ?? selectedTask.budget} | {selectedTask.status}
            </Text>
            <Text className="mt-3 text-sm leading-6 text-[#475467]">{taskSummary(selectedTask.status, Boolean(isPoster))}</Text>
          </>
        ) : null}

        {needsPayoutSetup ? (
          <View className="mt-4 rounded-[18px] border border-[#d9e7ff] bg-[#f5f8ff] px-4 py-4">
            <Text className="text-sm font-bold text-[#1849a9]">You have been hired.</Text>
            <Text className="mt-2 text-sm leading-6 text-[#1849a9]">
              Finish payout setup now so funds can be released smoothly once this task is done.
            </Text>
            <Pressable onPress={() => router.push("/payouts")} className="mt-3 rounded-full bg-[#0f6fff] px-4 py-3.5">
              <Text className="text-center text-sm font-bold text-white">Set up payouts</Text>
            </Pressable>
          </View>
        ) : null}

        <View className="mt-5 gap-3">
          {selectedTask?.status === "open" && !isPoster ? (
            <View className="flex-row gap-3">
              <PrimaryButton label="Offer $140" onPress={() => sendOffer(140)} />
              <SecondaryButton label="Offer $160" onPress={() => sendOffer(160)} />
            </View>
          ) : null}

          {selectedTask?.status === "open" && isPoster && latestOffer?.offerAmount ? (
            <PrimaryButton label={`Accept $${latestOffer.offerAmount}`} onPress={() => void acceptLatestOffer(selectedConversation!.id)} />
          ) : null}

          {selectedTask?.status === "assigned" && isPoster ? (
            <PrimaryButton label="Pay and start" onPress={() => void handleCheckout()} />
          ) : null}

          {selectedTask?.status === "in_progress" && selectedTask.assignedTo === currentAccount?.id ? (
            <PrimaryButton label="Request completion" onPress={() => void requestTaskCompletion(selectedTask.id)} />
          ) : null}

          {selectedTask && ["in_progress", "completion_requested"].includes(selectedTask.status) && isPoster ? (
            <PrimaryButton label="Confirm completion" onPress={() => void completeTask(selectedTask.id)} />
          ) : null}

          {selectedTask?.status === "completed" && isPoster ? (
            <PrimaryButton label="Release funds" onPress={() => void releaseFunds(selectedTask.id)} />
          ) : null}
        </View>
      </View>

      <Text className="mb-3 mt-8 text-[24px] font-black text-[#101828]">Private chat</Text>
      <View className="rounded-[24px] border border-[#e4e7ec] bg-white px-5 py-5">
        {selectedConversation?.messages.length ? (
          selectedConversation.messages.map((message) => (
            <View key={message.id} className="mb-3 rounded-[18px] bg-[#f9fafb] px-4 py-4">
              <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-[#667085]">{message.kind}</Text>
              <Text className="mt-2 text-sm leading-6 text-[#475467]">{message.text}</Text>
            </View>
          ))
        ) : (
          <Text className="text-sm text-[#667085]">No messages yet.</Text>
        )}

        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a private message"
          placeholderTextColor="#98a2b3"
          className="mt-4 rounded-[18px] border border-[#d0d5dd] bg-[#f9fafb] px-4 py-4 text-[#101828]"
        />
        <Pressable onPress={submitMessage} className="mt-4 rounded-full bg-[#0f6fff] px-4 py-4">
          <Text className="text-center text-sm font-bold text-white">Send message</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-1 rounded-full bg-[#0f6fff] px-4 py-3.5">
      <Text className="text-center text-sm font-bold text-white">{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-1 rounded-full border border-[#d0d5dd] bg-white px-4 py-3.5">
      <Text className="text-center text-sm font-bold text-[#344054]">{label}</Text>
    </Pressable>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <View className="rounded-[22px] border border-[#e4e7ec] bg-white px-4 py-5">
      <Text className="text-sm text-[#667085]">{text}</Text>
    </View>
  );
}
