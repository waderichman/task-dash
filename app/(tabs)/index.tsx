import { useMemo } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Screen } from "@/components/screen";
import { CurrentAccount, MarketplaceUser, Task, UserRole } from "@/lib/types";
import { useAppStore } from "@/store/use-app-store";

const roleCopy: Record<
  UserRole,
  { title: string; subtitle: string; primaryCta: string; secondaryCta: string }
> = {
  poster: {
    title: "Post the job. Run the thread. Book the right person.",
    subtitle:
      "Keep everything in one negotiation thread so you can compare offers, answer questions, and hire cleanly.",
    primaryCta: "Post a new job",
    secondaryCta: "Open your inbox"
  },
  tasker: {
    title: "Find nearby work and negotiate directly with posters.",
    subtitle:
      "See local jobs, open the thread, ask a clarifying question, and send the price you want to win the work.",
    primaryCta: "Browse jobs",
    secondaryCta: "Open your inbox"
  }
};

export default function DiscoverScreen() {
  const router = useRouter();
  const activeRole = useAppStore((state) => state.activeRole);
  const selectRole = useAppStore((state) => state.selectRole);
  const tasks = useAppStore((state) => state.tasks);
  const conversations = useAppStore((state) => state.conversations);
  const currentAccount = useAppStore((state) => state.currentAccount);
  const users = useAppStore((state) => state.users);
  const error = useAppStore((state) => state.error);
  const refreshMarketplace = useAppStore((state) => state.refreshMarketplace);
  const status = useAppStore((state) => state.status);
  const beginThreadOpen = useAppStore((state) => state.beginThreadOpen);
  const openConversationForTask = useAppStore((state) => state.openConversationForTask);
  const openPublicConversationForTask = useAppStore((state) => state.openPublicConversationForTask);

  const copy = roleCopy[activeRole];

  const managedTasks = useMemo(
    () => tasks.filter((task) => task.postedBy === currentAccount?.id),
    [currentAccount?.id, tasks]
  );
  const openManagedTasks = managedTasks.filter((task) => task.status !== "completed");
  const openNearbyTasks = tasks.filter((task) => task.status === "open");
  const visibleTasks = activeRole === "poster" ? openManagedTasks : openNearbyTasks;

  const handleOpenTask = (taskId: string) => {
    beginThreadOpen(taskId, "private");
    router.navigate("/alerts");
    void openConversationForTask(taskId);
  };

  const handleOpenPublicThread = (taskId: string) => {
    beginThreadOpen(taskId, "public");
    router.navigate("/alerts");
    void openPublicConversationForTask(taskId);
  };

  return (
    <Screen>
      <LinearGradient
        colors={["#f4f1ea", "#dff6e6", "#f4e6d4"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="rounded-[32px] border border-[#e6ded0] px-5 pb-6 pt-6"
      >
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#56705e]">
          TaskDash
        </Text>
        <Text className="mt-3 text-[34px] font-black leading-[40px] text-[#08101c]">
          {copy.title}
        </Text>
        <Text className="mt-3 text-sm leading-6 text-[#4f5d70]">{copy.subtitle}</Text>

        <View className="mt-6 flex-row gap-3">
          <RoleCard
            label="Poster"
            icon="create-outline"
            active={activeRole === "poster"}
            description="Create jobs and manage private chats from interested taskers."
            onPress={() => selectRole("poster")}
          />
          <RoleCard
            label="Tasker"
            icon="flash-outline"
            active={activeRole === "tasker"}
            description="Open nearby jobs and start a private chat with the poster."
            onPress={() => selectRole("tasker")}
          />
        </View>

        <View className="mt-6 flex-row gap-3">
          <QuickActionButton
            label={copy.primaryCta}
            filled
            onPress={() => router.push(activeRole === "poster" ? "/topics" : "/")}
          />
          <QuickActionButton label={copy.secondaryCta} onPress={() => router.push("/alerts")} />
        </View>
      </LinearGradient>

      <View className="mt-8 flex-row gap-3">
        <CountCard
          label={activeRole === "poster" ? "Open jobs" : "Open jobs near you"}
          value={String(visibleTasks.length)}
        />
        <CountCard
          label={activeRole === "poster" ? "Active chats" : "Live threads"}
          value={String(conversations.length)}
        />
      </View>

      {error ? (
        <View className="mt-6 rounded-[24px] border border-[#efd3d3] bg-[#fff4f4] px-5 py-5">
          <Text className="text-base font-bold text-[#5f1d1d]">We could not sync the latest data.</Text>
          <Text className="mt-2 text-sm leading-6 text-[#8b3b3b]">{error}</Text>
          <Pressable
            onPress={() => void refreshMarketplace()}
            className="mt-4 rounded-full bg-[#08101c] px-4 py-3"
          >
            <Text className="text-center text-sm font-bold text-white">
              {status === "loading" ? "Refreshing..." : "Retry"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <SectionHeader
        title={activeRole === "poster" ? "Manage your open jobs" : "Nearby jobs"}
        detail={activeRole === "poster" ? "Keep chats moving" : "Open a thread to negotiate"}
      />

      <FlatList
        data={visibleTasks}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View className="h-4" />}
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            poster={
              item.postedBy === currentAccount?.id
                ? currentAccount
                : users.find((user) => user.id === item.postedBy)
            }
            tasker={item.assignedTo ? users.find((user) => user.id === item.assignedTo) : undefined}
            isPosterView={activeRole === "poster"}
            onOpenThread={() => handleOpenTask(item.id)}
            onOpenPublicThread={() => handleOpenPublicThread(item.id)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title={activeRole === "poster" ? "No open jobs yet" : "No nearby jobs right now"}
            body={
              activeRole === "poster"
                ? "Post your first job and taskers in your ZIP coverage will see the thread."
                : "Check back soon or switch ZIP coverage in your profile later."
            }
          />
        }
      />

      {activeRole === "poster" && managedTasks.length > 0 ? (
        <>
          <SectionHeader title="Completed jobs" detail="Wrapped and ready for reviews" />
          <FlatList
            data={managedTasks.filter((task) => task.status === "completed")}
            keyExtractor={(item) => `${item.id}-complete`}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View className="h-4" />}
            renderItem={({ item }) => (
              <TaskCard
                task={item}
                poster={currentAccount ?? undefined}
                tasker={item.assignedTo ? users.find((user) => user.id === item.assignedTo) : undefined}
                isPosterView
                onOpenThread={() => handleOpenTask(item.id)}
                onOpenPublicThread={() => handleOpenPublicThread(item.id)}
              />
            )}
            ListEmptyComponent={<EmptyState title="No completed jobs yet" body="Completed work will land here." />}
          />
        </>
      ) : null}
    </Screen>
  );
}

function SectionHeader({ title, detail }: { title: string; detail: string }) {
  return (
    <View className="mb-4 mt-8 gap-1">
      <Text className="text-lg font-bold text-[#08101c]">{title}</Text>
      <Text className="text-sm font-semibold text-[#56705e]">{detail}</Text>
    </View>
  );
}

function RoleCard({
  label,
  icon,
  description,
  active,
  onPress
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`min-h-[152px] flex-1 rounded-[24px] border px-4 py-4 ${
        active ? "border-[#08101c] bg-white" : "border-[#e3ddcf] bg-white/50"
      }`}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-[#ecf3ea]">
        <Ionicons name={icon} size={18} color="#08101c" />
      </View>
      <Text className="mt-4 text-base font-bold text-[#08101c]">{label}</Text>
      <Text className="mt-2 text-sm leading-5 text-[#596579]">{description}</Text>
    </Pressable>
  );
}

function QuickActionButton({
  label,
  onPress,
  filled = false
}: {
  label: string;
  onPress: () => void;
  filled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-full px-4 py-4 ${filled ? "bg-[#08101c]" : "bg-white/75"}`}
    >
      <Text className={`text-center text-sm font-bold ${filled ? "text-white" : "text-[#08101c]"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function CountCard({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-[24px] border border-[#e8e1d5] bg-white px-4 py-4">
      <Text className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[#6f7d8d]">
        {label}
      </Text>
      <Text className="mt-2 text-2xl font-black text-[#08101c]">{value}</Text>
    </View>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View className="rounded-[24px] border border-dashed border-[#d8d0c3] bg-[#faf7f2] px-5 py-8">
      <Text className="text-base font-bold text-[#08101c]">{title}</Text>
      <Text className="mt-2 text-sm leading-6 text-[#5b6779]">{body}</Text>
    </View>
  );
}

function TaskCard({
  task,
  poster,
  tasker,
  isPosterView,
  onOpenThread,
  onOpenPublicThread
}: {
  task: Task;
  poster?: CurrentAccount | MarketplaceUser;
  tasker?: MarketplaceUser;
  isPosterView: boolean;
  onOpenThread: () => void;
  onOpenPublicThread: () => void;
}) {
  const posterRating =
    poster && "posterStats" in poster ? poster.posterStats.rating : poster?.posterRating;

  return (
    <View className="rounded-[28px] border border-[#e8e1d5] bg-white px-5 py-5">
      <View className="flex-row items-start justify-between">
        <View className="mr-4 flex-1">
          <Text className="text-xs font-semibold uppercase tracking-[1.5px] text-[#6f7d8d]">
            {isPosterView ? "Your job" : "Open job"}
          </Text>
          <Text className="mt-2 text-xl font-bold leading-7 text-[#08101c]">{task.title}</Text>
        </View>
        <View className="rounded-full bg-[#eff8f1] px-3 py-2">
          <Text className="text-sm font-bold text-[#214a35]">${task.agreedPrice ?? task.budget}</Text>
        </View>
      </View>

      <Text className="mt-3 text-sm leading-6 text-[#5b6779]">{task.description}</Text>

      <View className="mt-5 flex-row flex-wrap gap-2">
        <Pill icon="location-outline" text={task.location} />
        <Pill icon="navigate-outline" text={task.zipCode} />
        <Pill icon="time-outline" text={task.timeline} />
        <Pill icon="layers-outline" text={task.status} />
      </View>

      <View className="mt-4 rounded-[22px] bg-[#faf7f2] px-4 py-4">
        <Text className="text-xs font-semibold uppercase tracking-[1.5px] text-[#6f7d8d]">
          {isPosterView ? "Private chat activity" : "Poster"}
        </Text>
        <Text className="mt-2 text-base font-bold text-[#08101c]">
          {isPosterView ? `${task.offers} offers | ${task.questions} questions` : poster?.name ?? "Local poster"}
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-3">
          {isPosterView ? (
            <MetaPill icon="chatbubble-ellipses-outline" text="Review each tasker chat and compare offers" />
          ) : (
            <>
              <MetaPill
                icon="star-outline"
                text={posterRating ? `${posterRating.average.toFixed(1)} stars` : "Trusted locally"}
              />
              <MetaPill icon="chatbubble-ellipses-outline" text={`${task.offers} offers | ${task.questions} questions`} />
            </>
          )}
        </View>
      </View>

      {tasker ? (
        <View className="mt-4 rounded-[22px] bg-[#eef7ff] px-4 py-4">
          <Text className="text-xs font-semibold uppercase tracking-[1.5px] text-[#55708e]">
            Assigned tasker
          </Text>
          <Text className="mt-2 text-base font-bold text-[#08101c]">{tasker.name}</Text>
        </View>
      ) : null}

      {task.tags.length > 0 ? (
        <View className="mt-5 flex-row flex-wrap gap-2">
          {task.tags.map((tag) => (
            <View key={tag} className="rounded-full bg-[#f3efe8] px-3 py-2">
              <Text className="text-xs font-semibold text-[#6f7d8d]">{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View className="mt-5">
        <Text className="text-sm font-medium text-[#7d8898]">{task.postedAt}</Text>
        <View className="mt-3 flex-row gap-3">
          <Pressable onPress={onOpenPublicThread} className="flex-1 rounded-full bg-[#f3efe8] px-4 py-3">
            <Text className="text-center text-sm font-bold text-[#08101c]">
              {isPosterView ? "View public thread" : "Open public thread"}
            </Text>
          </Pressable>
          <Pressable onPress={onOpenThread} className="flex-1 rounded-full bg-[#08101c] px-4 py-3">
            <Text className="text-center text-sm font-bold text-white">
              {task.status === "completed" ? "View private chats" : isPosterView ? "Manage private chats" : "Start private chat"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Pill({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="flex-row items-center rounded-full bg-[#f6f3ed] px-3 py-2">
      <Ionicons name={icon} size={14} color="#6f7d8d" />
      <Text className="ml-2 text-xs font-semibold capitalize text-[#5b6779]">{text}</Text>
    </View>
  );
}

function MetaPill({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="flex-row shrink items-center rounded-full bg-white px-3 py-2">
      <Ionicons name={icon} size={14} color="#6f7d8d" />
      <Text className="ml-2 shrink text-xs font-semibold text-[#5b6779]">{text}</Text>
    </View>
  );
}
