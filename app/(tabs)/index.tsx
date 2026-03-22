import { useMemo } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Task } from "@/lib/types";
import { Screen } from "@/components/screen";
import { useAppStore } from "@/store/use-app-store";

function formatStatus(task: Task) {
  if (task.status === "open") return "Open";
  if (task.status === "assigned") return "Accepted";
  if (task.status === "in_progress") return "In progress";
  if (task.status === "completion_requested") return "Awaiting approval";
  if (task.status === "completed") return "Completed";
  return "Released";
}

export default function BrowseScreen() {
  const router = useRouter();
  const tasks = useAppStore((state) => state.tasks);
  const currentAccount = useAppStore((state) => state.currentAccount);
  const users = useAppStore((state) => state.users);
  const conversations = useAppStore((state) => state.conversations);
  const error = useAppStore((state) => state.error);
  const status = useAppStore((state) => state.status);
  const refreshMarketplace = useAppStore((state) => state.refreshMarketplace);
  const beginThreadOpen = useAppStore((state) => state.beginThreadOpen);
  const openConversationForTask = useAppStore((state) => state.openConversationForTask);

  const postedTasks = useMemo(
    () => tasks.filter((task) => task.postedBy === currentAccount?.id && task.status !== "released"),
    [currentAccount?.id, tasks]
  );
  const doingTasks = useMemo(
    () => tasks.filter((task) => task.assignedTo === currentAccount?.id && task.status !== "released"),
    [currentAccount?.id, tasks]
  );
  const openTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.status === "open" &&
          task.postedBy !== currentAccount?.id &&
          task.assignedTo !== currentAccount?.id
      ),
    [currentAccount?.id, tasks]
  );

  const openChat = (taskId: string) => {
    beginThreadOpen(taskId, "private");
    router.push("/inbox");
    void openConversationForTask(taskId);
  };

  return (
    <Screen>
      <View className="rounded-[28px] bg-white px-5 py-5">
        <Text className="text-[30px] font-black text-[#101828]">Workzy</Text>
        <Text className="mt-2 text-sm leading-6 text-[#667085]">
          Post a task, compare offers, and manage bookings in one place.
        </Text>

        <View className="mt-5 flex-row gap-3">
          <PrimaryButton label="Post a task" onPress={() => router.push("/topics")} />
          <SecondaryButton label="Open inbox" onPress={() => router.push("/inbox")} />
        </View>
      </View>

      <View className="mt-6 flex-row gap-3">
        <MetricCard label="Posted" value={String(postedTasks.length)} />
        <MetricCard label="Doing" value={String(doingTasks.length)} />
        <MetricCard label="Chats" value={String(conversations.length)} />
      </View>

      {error ? (
        <View className="mt-6 rounded-[20px] border border-[#f3d2d2] bg-[#fff5f5] px-4 py-4">
          <Text className="text-sm font-semibold text-[#b42318]">{error}</Text>
          <Pressable onPress={() => void refreshMarketplace()} className="mt-3 rounded-full bg-[#0f6fff] px-4 py-3">
            <Text className="text-center text-sm font-bold text-white">{status === "loading" ? "Refreshing..." : "Retry"}</Text>
          </Pressable>
        </View>
      ) : null}

      <SectionHeader
        title="My tasks"
        detail="Tasks you posted and still need to manage."
        actionLabel="Post"
        onActionPress={() => router.push("/topics")}
      />
      <FlatList
        data={postedTasks}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View className="h-4" />}
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            subtitle={`${item.location} • $${item.agreedPrice ?? item.budget}`}
            context={`${item.offers} offers • ${item.questions} questions`}
            primaryLabel="View offers"
            onPrimaryPress={() => openChat(item.id)}
            secondaryLabel="View details"
            onSecondaryPress={() => router.push(`/job-thread/${item.id}` as never)}
          />
        )}
        ListEmptyComponent={<EmptyCard text="You have no active posted tasks right now." />}
      />

      <SectionHeader
        title="Tasks I'm working on"
        detail="Accepted tasks you should keep moving."
      />
      <FlatList
        data={doingTasks}
        keyExtractor={(item) => `${item.id}-doing`}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View className="h-4" />}
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            subtitle={`${item.location} • $${item.agreedPrice ?? item.budget}`}
            context="Private chat keeps the booking moving"
            primaryLabel="Open chat"
            onPrimaryPress={() => openChat(item.id)}
            secondaryLabel="View details"
            onSecondaryPress={() => router.push(`/job-thread/${item.id}` as never)}
          />
        )}
        ListEmptyComponent={<EmptyCard text="You have no assigned tasks right now." />}
      />

      <SectionHeader
        title="Available tasks"
        detail="Open local tasks you can ask about or quote."
      />
      <FlatList
        data={openTasks}
        keyExtractor={(item) => `${item.id}-browse`}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View className="h-4" />}
        renderItem={({ item }) => {
          const poster = users.find((user) => user.id === item.postedBy);
          return (
            <TaskCard
              task={item}
              subtitle={`${poster?.name ?? "Local customer"} • ${item.location} • $${item.budget}`}
              context={item.tags.length > 0 ? item.tags.join(" • ") : "Open for offers"}
              primaryLabel="Send offer"
              onPrimaryPress={() => openChat(item.id)}
              secondaryLabel="View details"
              onSecondaryPress={() => router.push(`/job-thread/${item.id}` as never)}
            />
          );
        }}
        ListEmptyComponent={<EmptyCard text="No nearby tasks right now." />}
      />
    </Screen>
  );
}

function SectionHeader({
  title,
  detail,
  actionLabel,
  onActionPress
}: {
  title: string;
  detail: string;
  actionLabel?: string;
  onActionPress?: () => void;
}) {
  return (
    <View className="mb-3 mt-8 flex-row items-end justify-between gap-3">
      <View className="flex-1">
        <Text className="text-[24px] font-black text-[#101828]">{title}</Text>
        <Text className="mt-1 text-sm leading-6 text-[#667085]">{detail}</Text>
      </View>
      {actionLabel && onActionPress ? (
        <Pressable onPress={onActionPress} className="rounded-full bg-[#eef4ff] px-4 py-2.5">
          <Text className="text-sm font-bold text-[#0f6fff]">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function TaskCard({
  task,
  subtitle,
  context,
  primaryLabel,
  onPrimaryPress,
  secondaryLabel,
  onSecondaryPress
}: {
  task: Task;
  subtitle: string;
  context: string;
  primaryLabel: string;
  onPrimaryPress: () => void;
  secondaryLabel: string;
  onSecondaryPress: () => void;
}) {
  return (
    <View className="rounded-[24px] border border-[#e4e7ec] bg-white px-4 py-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-lg font-black text-[#101828]">{task.title}</Text>
          <Text className="mt-1 text-sm text-[#667085]">{subtitle}</Text>
        </View>
        <View className="rounded-full bg-[#f2f4f7] px-3 py-2">
          <Text className="text-xs font-bold text-[#344054]">{formatStatus(task)}</Text>
        </View>
      </View>

      <Text className="mt-3 text-sm leading-6 text-[#475467]">{task.description}</Text>
      <Text className="mt-3 text-sm font-medium text-[#667085]">{context}</Text>

      <View className="mt-4 flex-row gap-3">
        <PrimaryButton label={primaryLabel} onPress={onPrimaryPress} />
        <SecondaryButton label={secondaryLabel} onPress={onSecondaryPress} />
      </View>
    </View>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-[20px] border border-[#e4e7ec] bg-white px-4 py-4">
      <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-[#667085]">{label}</Text>
      <Text className="mt-2 text-2xl font-black text-[#101828]">{value}</Text>
    </View>
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
