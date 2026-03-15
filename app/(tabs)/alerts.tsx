import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/screen";
import { useAppStore } from "@/store/use-app-store";

export default function InboxScreen() {
  const currentAccount = useAppStore((state) => state.currentAccount);
  const conversations = useAppStore((state) => state.conversations);
  const tasks = useAppStore((state) => state.tasks);
  const users = useAppStore((state) => state.users);
  const reviews = useAppStore((state) => state.reviews);
  const selectedConversationId = useAppStore((state) => state.selectedConversationId);
  const selectConversation = useAppStore((state) => state.selectConversation);
  const sendMessage = useAppStore((state) => state.sendMessage);
  const acceptLatestOffer = useAppStore((state) => state.acceptLatestOffer);
  const completeTask = useAppStore((state) => state.completeTask);
  const leaveReview = useAppStore((state) => state.leaveReview);
  const refreshMarketplace = useAppStore((state) => state.refreshMarketplace);
  const error = useAppStore((state) => state.error);
  const status = useAppStore((state) => state.status);
  const [draft, setDraft] = useState("");

  const senderLookup = useMemo(() => {
    const entries = users.map((user) => [user.id, user.name] as const);
    if (currentAccount) {
      entries.push([currentAccount.id, currentAccount.name] as const);
    }

    return new Map(entries);
  }, [currentAccount, users]);

  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedConversationId) ?? conversations[0];
  const selectedTask = tasks.find((task) => task.id === selectedConversation?.taskId);
  const counterpartIds = (selectedConversation?.participantIds ?? []).filter((id) => id !== currentAccount?.id);
  const counterpartUsers = counterpartIds
    .map((id) => users.find((user) => user.id === id))
    .filter((user): user is NonNullable<typeof user> => Boolean(user));
  const counterpart = counterpartUsers[0];
  const counterpartLabel =
    counterpartUsers.length === 0
      ? "Pick a thread above to see the full negotiation and reply."
      : counterpartUsers.length === 1
        ? `${counterpartUsers[0].name} | ZIP ${counterpartUsers[0].zipCode}`
        : `${counterpartUsers[0].name} +${counterpartUsers.length - 1} more in this thread`;
  const latestOffer = [...(selectedConversation?.messages ?? [])]
    .reverse()
    .find((message) => typeof message.offerAmount === "number");
  const selectedThreadType = selectedConversation?.threadType ?? "private";

  const threadRows = useMemo(
    () =>
      conversations.map((conversation) => {
        const task = tasks.find((item) => item.id === conversation.taskId);
        const threadUsers = conversation.participantIds
          .filter((id) => id !== currentAccount?.id)
          .map((id) => users.find((user) => user.id === id))
          .filter((user): user is NonNullable<typeof user> => Boolean(user));
        const lastMessage = conversation.messages[conversation.messages.length - 1];

        return {
          id: conversation.id,
          taskTitle: task?.title ?? "Job thread",
          threadType: conversation.threadType ?? "private",
          personName:
            (conversation.threadType ?? "private") === "public"
              ? "Public job thread"
              : threadUsers.length === 0
              ? "No replies yet"
              : threadUsers.length === 1
                ? threadUsers[0].name
                : `${threadUsers[0].name} +${threadUsers.length - 1}`,
          preview: lastMessage?.text ?? "No messages yet",
          amount: lastMessage?.offerAmount,
          active: conversation.id === selectedConversation?.id,
          status: task?.status ?? "open"
        };
      }),
    [conversations, currentAccount?.id, selectedConversation?.id, tasks, users]
  );

  const reviewTargets = useMemo(() => {
    if (!selectedTask || !currentAccount || !counterpart) {
      return { canReviewTasker: false, canReviewPoster: false };
    }

    const myId = currentAccount.id;

    return {
      canReviewTasker:
        selectedTask.status === "completed" &&
        selectedTask.postedBy === myId &&
        !reviews.some(
          (review) =>
            review.taskId === selectedTask.id &&
            review.reviewerId === myId &&
            review.revieweeId === counterpart.id &&
            review.role === "tasker"
        ),
      canReviewPoster:
        selectedTask.status === "completed" &&
        selectedTask.assignedTo === myId &&
        !reviews.some(
          (review) =>
            review.taskId === selectedTask.id &&
            review.reviewerId === myId &&
            review.revieweeId === counterpart.id &&
            review.role === "poster"
        )
    };
  }, [counterpart, currentAccount, reviews, selectedTask]);

  const submitMessage = (kind: "message" | "question" = "message") => {
    if (!selectedConversation || !draft.trim()) {
      return;
    }

    void sendMessage(selectedConversation.id, draft.trim(), { kind });
    setDraft("");
  };

  const submitOffer = (amount: number) => {
    if (!selectedConversation) {
      return;
    }

    void sendMessage(selectedConversation.id, `I can do this for $${amount}.`, {
      kind: "offer",
      offerAmount: amount
    });
  };

  return (
    <Screen>
      <Text className="text-3xl font-black text-[#08101c]">Threads</Text>
      <Text className="mt-3 text-sm leading-6 text-[#5b6779]">
        Each job has a public thread for general questions, plus private tasker chats for pricing and negotiation.
      </Text>

      {error ? (
        <View className="mt-5 rounded-[20px] border border-[#efd3d3] bg-[#fff4f4] px-4 py-4">
          <Text className="text-sm font-semibold text-[#8b3b3b]">{error}</Text>
          <Pressable onPress={() => void refreshMarketplace()} className="mt-3 rounded-full bg-[#08101c] px-4 py-3">
            <Text className="text-center text-sm font-bold text-white">
              {status === "loading" ? "Refreshing..." : "Retry sync"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View className="mt-8 rounded-[28px] border border-[#e8e1d5] bg-white px-4 py-4">
        <Text className="text-sm font-semibold uppercase tracking-[2px] text-[#6f7d8d]">Open threads</Text>
        <FlatList
          className="mt-4"
          data={threadRows}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => selectConversation(item.id)}
              className={`w-[232px] rounded-[24px] border px-4 py-4 ${
                item.active ? "border-[#08101c] bg-[#d8f6df]" : "border-[#ece4d8] bg-[#faf7f2]"
              }`}
            >
              <Text className="text-sm font-bold text-[#08101c]">{item.taskTitle}</Text>
              <Text className="mt-1 text-sm text-[#5b6779]">
                {(item.threadType === "public" ? "Public" : "Private") + " | " + item.personName}
              </Text>
              <Text className="mt-4 text-sm leading-5 text-[#6f7d8d]" numberOfLines={2}>
                {item.preview}
              </Text>
              <View className="mt-4 flex-row items-center justify-between">
                <ThreadBadge text={item.status} />
                {item.amount ? <Text className="text-sm font-bold text-[#214a35]">${item.amount}</Text> : null}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="w-[260px] rounded-[24px] border border-dashed border-[#d8d0c3] bg-[#faf7f2] px-5 py-6">
              <Text className="text-base font-bold text-[#08101c]">No threads yet</Text>
              <Text className="mt-2 text-sm leading-6 text-[#5b6779]">
                Start a private chat from Discover, or wait for taskers to open chats on your posted jobs.
              </Text>
            </View>
          }
        />
      </View>

      <View className="mt-6 rounded-[28px] border border-[#e8e1d5] bg-[#08101c] px-5 py-5">
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#9cb4a4]">Selected thread</Text>
        <Text className="mt-3 text-2xl font-bold leading-8 text-white">
          {selectedTask?.title ?? "Choose a thread to start"}
        </Text>
        <Text className="mt-2 text-sm leading-6 text-[#c0c9d5]">
          {selectedThreadType === "public"
            ? `Public thread for job questions in ZIP ${selectedTask?.zipCode ?? ""}`
            : counterpartLabel}
        </Text>

        {selectedTask ? (
          <View className="mt-5 flex-row flex-wrap gap-2">
            <InlinePill icon="location-outline" text={selectedTask.location} dark />
            <InlinePill icon="navigate-outline" text={selectedTask.zipCode} dark />
            <InlinePill icon="cash-outline" text={`$${selectedTask.agreedPrice ?? selectedTask.budget}`} dark />
            <InlinePill icon="layers-outline" text={selectedTask.status} dark />
          </View>
        ) : null}

        <View className="mt-5 gap-3">
          <View className="flex-row gap-3">
            <QuickAction
              label="Ask a question"
              onPress={() => {
                setDraft("Can you confirm the access details?");
              }}
            />
            {selectedThreadType === "private" ? <QuickAction label="Offer $140" onPress={() => submitOffer(140)} /> : null}
            {selectedThreadType === "private" ? <QuickAction label="Offer $160" onPress={() => submitOffer(160)} /> : null}
          </View>
          {selectedThreadType === "private" ? (
            <View className="flex-row gap-3">
              <QuickAction
                label={latestOffer?.offerAmount ? `Accept $${latestOffer.offerAmount}` : "Accept latest offer"}
                onPress={() => void (selectedConversation && acceptLatestOffer(selectedConversation.id))}
              />
              <QuickAction label="Mark complete" onPress={() => void (selectedTask && completeTask(selectedTask.id))} />
            </View>
          ) : null}
        </View>
      </View>

      <View className="mt-6 rounded-[28px] border border-[#e8e1d5] bg-white px-4 py-4">
        <Text className="text-sm font-semibold uppercase tracking-[2px] text-[#6f7d8d]">Conversation</Text>
        <View className="mt-4">
          {selectedConversation?.messages.length ? (
            selectedConversation.messages.map((message) => {
              const isSystem = message.kind === "system";
              const isMine = message.senderId === currentAccount?.id;
              const sender = isSystem
                ? "System"
                : isMine
                  ? currentAccount?.name
                  : senderLookup.get(message.senderId) ?? "Local user";

              return (
                <View
                  key={message.id}
                  className={`mb-3 rounded-[22px] px-4 py-4 ${
                    isSystem ? "bg-[#f4f1ea]" : isMine ? "self-end bg-[#d8f6df]" : "bg-[#f6f3ed]"
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-bold text-[#08101c]">{sender}</Text>
                    <Text className="text-xs font-semibold uppercase tracking-[1.5px] text-[#6f7d8d]">
                      {message.kind}
                    </Text>
                  </View>
                  <Text className="mt-2 text-sm leading-6 text-[#445164]">{message.text}</Text>
                  {message.offerAmount ? (
                    <View className="mt-3 flex-row items-center rounded-full bg-white/70 px-3 py-2">
                      <Ionicons name="cash-outline" size={14} color="#214a35" />
                      <Text className="ml-2 text-xs font-bold text-[#214a35]">${message.offerAmount} proposed</Text>
                    </View>
                  ) : null}
                  <Text className="mt-3 text-xs text-[#7d8898]">{message.sentAt}</Text>
                </View>
              );
            })
          ) : (
            <View className="rounded-[22px] bg-[#faf7f2] px-4 py-6">
              <Text className="text-sm leading-6 text-[#5b6779]">
                Messages and offers for the selected thread will appear here.
              </Text>
            </View>
          )}
        </View>

        {selectedThreadType === "private" && (reviewTargets.canReviewTasker || reviewTargets.canReviewPoster) ? (
          <View className="mt-2 rounded-[22px] bg-[#faf7f2] px-4 py-4">
            <Text className="text-sm font-bold text-[#08101c]">Leave a rating</Text>
            <View className="mt-4 flex-row gap-3">
              {reviewTargets.canReviewTasker ? (
                <QuickReview
                  label="Rate tasker 5 stars"
                  onPress={() =>
                    counterpart &&
                    selectedTask &&
                    void leaveReview(
                      selectedTask.id,
                      counterpart.id,
                      "tasker",
                      5,
                      "Excellent work, on time and easy to coordinate."
                    )
                  }
                />
              ) : null}
              {reviewTargets.canReviewPoster ? (
                <QuickReview
                  label="Rate poster 5 stars"
                  onPress={() =>
                    counterpart &&
                    selectedTask &&
                    void leaveReview(
                      selectedTask.id,
                      counterpart.id,
                      "poster",
                      5,
                      "Clear brief, smooth communication, and paid promptly."
                    )
                  }
                />
              ) : null}
            </View>
          </View>
        ) : null}

        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Write your message"
          placeholderTextColor="#8a95a5"
          className="mt-4 rounded-[22px] border border-[#e8e1d5] bg-[#faf7f2] px-4 py-4 text-[#08101c]"
        />
        <View className="mt-4 flex-row gap-3">
          <Pressable onPress={() => submitMessage("message")} className="flex-1 rounded-full bg-[#08101c] px-4 py-4">
            <Text className="text-center text-sm font-bold text-white">Send message</Text>
          </Pressable>
          <Pressable onPress={() => submitMessage("question")} className="flex-1 rounded-full bg-[#d8f6df] px-4 py-4">
            <Text className="text-center text-sm font-bold text-[#08101c]">Send question</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function QuickAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-1 rounded-full bg-white/10 px-4 py-3">
      <Text className="text-center text-sm font-semibold text-white">{label}</Text>
    </Pressable>
  );
}

function QuickReview({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-1 rounded-full bg-[#08101c] px-4 py-3">
      <Text className="text-center text-sm font-semibold text-white">{label}</Text>
    </Pressable>
  );
}

function InlinePill({
  icon,
  text,
  dark = false
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  dark?: boolean;
}) {
  return (
    <View className={`flex-row items-center rounded-full px-3 py-2 ${dark ? "bg-white/10" : "bg-[#f6f3ed]"}`}>
      <Ionicons name={icon} size={14} color={dark ? "#d9e4d7" : "#6f7d8d"} />
      <Text className={`ml-2 text-xs font-semibold ${dark ? "text-white" : "text-[#5b6779]"}`}>{text}</Text>
    </View>
  );
}

function ThreadBadge({ text }: { text: string }) {
  return (
    <View className="rounded-full bg-white px-3 py-2">
      <Text className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[#6f7d8d]">{text}</Text>
    </View>
  );
}
