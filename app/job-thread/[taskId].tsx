import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/screen";
import { useAppStore } from "@/store/use-app-store";

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
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (taskId) {
      void openPublicConversationForTask(taskId);
    }
  }, [openPublicConversationForTask, taskId]);

  const task = tasks.find((item) => item.id === taskId);
  const conversation = conversations.find(
    (item) => item.taskId === taskId && (item.threadType ?? "private") === "public"
  );

  const senderLookup = useMemo(() => {
    const entries = users.map((user) => [user.id, user.name] as const);
    if (currentAccount) entries.push([currentAccount.id, currentAccount.name] as const);
    return new Map(entries);
  }, [currentAccount, users]);

  const submitMessage = () => {
    if (!conversation || !draft.trim()) return;
    void sendMessage(conversation.id, draft.trim(), { kind: "question" });
    setDraft("");
  };

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <Pressable onPress={() => router.back()} className="rounded-full border border-[#d0d5dd] bg-white px-4 py-3">
          <Text className="text-sm font-bold text-[#344054]">Back</Text>
        </Pressable>
        <Text className="text-sm font-bold text-[#344054]">Task details</Text>
        <View className="w-16" />
      </View>

      <View className="mt-6 rounded-[28px] border border-[#e4e7ec] bg-white px-5 py-5">
        <Text className="text-[28px] font-black text-[#101828]">{task?.title ?? "Task"}</Text>
        <Text className="mt-2 text-sm leading-6 text-[#667085]">
          {task ? `${task.location} • ZIP ${task.zipCode} • $${task.agreedPrice ?? task.budget}` : "Loading task details..."}
        </Text>
        {task ? <Text className="mt-3 text-sm leading-6 text-[#475467]">{task.description}</Text> : null}
      </View>

      <Text className="mb-3 mt-8 text-[24px] font-black text-[#101828]">Public questions</Text>
      <View className="rounded-[24px] border border-[#e4e7ec] bg-white px-5 py-5">
        {conversation?.messages.length ? (
          conversation.messages.map((message) => (
            <View key={message.id} className="mb-3 rounded-[18px] bg-[#f9fafb] px-4 py-4">
              <Text className="text-sm font-bold text-[#101828]">
                {message.senderId === currentAccount?.id
                  ? currentAccount?.name
                  : senderLookup.get(message.senderId) ?? "Workzy member"}
              </Text>
              <Text className="mt-2 text-sm leading-6 text-[#475467]">{message.text}</Text>
            </View>
          ))
        ) : (
          <Text className="text-sm text-[#667085]">No public questions yet.</Text>
        )}

        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask a public question"
          placeholderTextColor="#98a2b3"
          className="mt-4 rounded-[18px] border border-[#d0d5dd] bg-[#f9fafb] px-4 py-4 text-[#101828]"
        />
        <Pressable onPress={submitMessage} className="mt-4 rounded-full bg-[#0f6fff] px-4 py-4">
          <Text className="text-center text-sm font-bold text-white">Post question</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
