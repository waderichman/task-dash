import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/screen";
import { useAppStore } from "@/store/use-app-store";

function formatTaskStage(value: string) {
  if (value === "open") {
    return "Booking Needed";
  }

  if (["assigned", "in_progress", "completion_requested"].includes(value)) {
    return "Booked";
  }

  if (value === "released") {
    return "Released";
  }

  return "Completed";
}

export default function JobThreadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ taskId?: string | string[] }>();
  const taskId = Array.isArray(params.taskId) ? params.taskId[0] : params.taskId;
  const currentAccount = useAppStore((state) => state.currentAccount);
  const tasks = useAppStore((state) => state.tasks);
  const users = useAppStore((state) => state.users);
  const conversations = useAppStore((state) => state.conversations);
  const openPublicConversationForTask = useAppStore((state) => state.openPublicConversationForTask);
  const sendMessage = useAppStore((state) => state.sendMessage);
  const error = useAppStore((state) => state.error);
  const status = useAppStore((state) => state.status);
  const refreshMarketplace = useAppStore((state) => state.refreshMarketplace);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!taskId) {
      return;
    }

    void openPublicConversationForTask(taskId);
  }, [openPublicConversationForTask, taskId]);

  const task = tasks.find((item) => item.id === taskId);
  const conversation = conversations.find(
    (item) => item.taskId === taskId && (item.threadType ?? "private") === "public"
  );

  const senderLookup = useMemo(() => {
    const entries = users.map((user) => [user.id, user.name] as const);
    if (currentAccount) {
      entries.push([currentAccount.id, currentAccount.name] as const);
    }

    return new Map(entries);
  }, [currentAccount, users]);

  const submitMessage = () => {
    if (!conversation || !draft.trim()) {
      return;
    }

    void sendMessage(conversation.id, draft.trim(), { kind: "question" });
    setDraft("");
  };

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <Pressable onPress={() => router.back()} className="h-11 w-11 items-center justify-center rounded-full bg-white">
          <Ionicons name="arrow-back" size={20} color="#08101c" />
        </Pressable>
        <Text className="text-sm font-semibold uppercase tracking-[2px] text-[#6f7d8d]">Job thread</Text>
        <View className="h-11 w-11" />
      </View>

      <Text className="mt-6 text-3xl font-black text-[#08101c]">{task?.title ?? "Job thread"}</Text>
      <Text className="mt-3 text-sm leading-6 text-[#5b6779]">
        Shared questions live here so everyone looking at the job can see the same answers.
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

      <View className="mt-6 rounded-[28px] border border-[#e8e1d5] bg-[#08101c] px-5 py-5">
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#9cb4a4]">Job details</Text>
        <Text className="mt-3 text-2xl font-bold leading-8 text-white">
          {task?.location ?? "Loading job details..."}
        </Text>
        {task ? (
          <View className="mt-5 flex-row flex-wrap gap-2">
            <InlinePill icon="navigate-outline" text={task.zipCode} />
            <InlinePill icon="cash-outline" text={`$${task.agreedPrice ?? task.budget}`} />
            <InlinePill icon="time-outline" text={task.timeline} />
            <InlinePill icon="layers-outline" text={formatTaskStage(task.status)} />
          </View>
        ) : null}
      </View>

      <View className="mt-6 rounded-[28px] border border-[#e8e1d5] bg-white px-4 py-4">
        <Text className="text-sm font-semibold uppercase tracking-[2px] text-[#6f7d8d]">Public conversation</Text>
        <View className="mt-4">
          {conversation?.messages.length ? (
            conversation.messages.map((message) => {
              const isSystem = message.kind === "system";
              const isMine = message.senderId === currentAccount?.id;
              const sender = isSystem
                ? "System"
                : isMine
                  ? currentAccount?.name
                  : senderLookup.get(message.senderId) ?? "Workzy member";

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
                  <Text className="mt-3 text-xs text-[#7d8898]">{message.sentAt}</Text>
                </View>
              );
            })
          ) : (
            <View className="rounded-[22px] bg-[#faf7f2] px-4 py-6">
              <Text className="text-sm leading-6 text-[#5b6779]">
                No public questions yet. Start with one clear question or update.
              </Text>
            </View>
          )}
        </View>

        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask a question in the job thread"
          placeholderTextColor="#8a95a5"
          className="mt-4 rounded-[22px] border border-[#e8e1d5] bg-[#faf7f2] px-4 py-4 text-[#08101c]"
        />
        <Pressable onPress={submitMessage} className="mt-4 rounded-full bg-[#08101c] px-4 py-4">
          <Text className="text-center text-sm font-bold text-white">Post to job thread</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function InlinePill({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="flex-row items-center rounded-full bg-white/10 px-3 py-2">
      <Ionicons name={icon} size={14} color="#d9e4d7" />
      <Text className="ml-2 text-xs font-semibold text-white">{text}</Text>
    </View>
  );
}
