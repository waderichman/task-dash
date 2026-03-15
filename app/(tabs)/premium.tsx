import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/screen";
import { useAppStore } from "@/store/use-app-store";

export default function ProfileScreen() {
  const activeRole = useAppStore((state) => state.activeRole);
  const selectRole = useAppStore((state) => state.selectRole);
  const logout = useAppStore((state) => state.logout);
  const currentAccount = useAppStore((state) => state.currentAccount);
  const tasks = useAppStore((state) => state.tasks);
  const conversations = useAppStore((state) => state.conversations);

  const postedTasks = tasks.filter((task) => task.postedBy === currentAccount?.id);
  const assignedTasks = tasks.filter((task) => task.assignedTo === currentAccount?.id);

  return (
    <Screen>
      <View className="rounded-[32px] border border-[#e6ded0] bg-white px-5 pb-6 pt-6">
        <View className="flex-row items-start justify-between">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-[#d8f6df]">
            <Text className="text-2xl font-black text-[#08101c]">
              {currentAccount?.name?.slice(0, 1) ?? "N"}
            </Text>
          </View>
          <Pressable onPress={() => void logout()} className="rounded-full bg-[#08101c] px-4 py-3">
            <Text className="text-sm font-bold text-white">Log out</Text>
          </Pressable>
        </View>

        <Text className="mt-4 text-3xl font-black text-[#08101c]">{currentAccount?.name ?? "Local account"}</Text>
        <Text className="mt-2 text-sm leading-6 text-[#5b6779]">{currentAccount?.bio ?? "Marketplace profile"}</Text>

        <View className="mt-4 flex-row flex-wrap gap-3">
          <Badge
            icon="location-outline"
            text={
              currentAccount ? `${currentAccount.homeBase} | ZIP ${currentAccount.zipCode}` : "ZIP not set"
            }
          />
          <Badge icon="navigate-outline" text={`${currentAccount?.serviceZipCodes.length ?? 0} service ZIPs`} />
          <Badge icon="chatbubble-ellipses-outline" text={`${conversations.length} active threads`} />
        </View>
      </View>

      <View className="mt-8 rounded-[28px] border border-[#e8e1d5] bg-[#08101c] px-5 py-5">
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#9cb4a4]">Work mode</Text>
        <Text className="mt-3 text-2xl font-bold text-white">Switch smoothly between hiring and tasking.</Text>
        <Text className="mt-3 text-sm leading-6 text-[#c0c9d5]">
          Your work changes by role, but everything still lives in the same account and message flow.
        </Text>
        <View className="mt-6 flex-row gap-3">
          <RoleToggle label="Poster" active={activeRole === "poster"} onPress={() => selectRole("poster")} />
          <RoleToggle label="Tasker" active={activeRole === "tasker"} onPress={() => selectRole("tasker")} />
        </View>
      </View>

      <View className="mt-8 gap-4">
        <SummaryCard
          title="Poster workflow"
          primary={`${postedTasks.length} jobs visible`}
          secondary={`${postedTasks.filter((task) => task.status === "open").length} still negotiating`}
        />
        <SummaryCard
          title="Tasker workflow"
          primary={`${assignedTasks.length} jobs won`}
          secondary={`${assignedTasks.filter((task) => task.status === "completed").length} completed`}
        />
      </View>

      <View className="mt-8 rounded-[28px] border border-[#e8e1d5] bg-white px-5 py-5">
        <Text className="text-lg font-bold text-[#08101c]">How your account works</Text>
        <InfoRow icon="chatbubble-outline" text="Each job has a public thread for general questions plus private tasker chats for negotiation." />
        <InfoRow icon="cash-outline" text="Pricing stays inside private chats so posters can compare offers cleanly before booking." />
        <InfoRow icon="shield-checkmark-outline" text="ZIP coverage controls which taskers can see and join local work." />
      </View>
    </Screen>
  );
}

function SummaryCard({ title, primary, secondary }: { title: string; primary: string; secondary: string }) {
  return (
    <View className="rounded-[26px] border border-[#e8e1d5] bg-[#faf7f2] px-5 py-5">
      <Text className="text-lg font-bold text-[#08101c]">{title}</Text>
      <Text className="mt-3 text-sm font-semibold text-[#08101c]">{primary}</Text>
      <Text className="mt-2 text-sm leading-6 text-[#5b6779]">{secondary}</Text>
    </View>
  );
}

function Badge({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="flex-row items-center rounded-full bg-[#f6f3ed] px-4 py-3">
      <Ionicons name={icon} size={14} color="#6f7d8d" />
      <Text className="ml-2 text-xs font-semibold text-[#5b6779]">{text}</Text>
    </View>
  );
}

function RoleToggle({
  label,
  active,
  onPress
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className={`flex-1 rounded-full px-4 py-4 ${active ? "bg-[#d8f6df]" : "bg-white/10"}`}>
      <Text className={`text-center text-sm font-bold ${active ? "text-[#08101c]" : "text-white"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function InfoRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="mt-4 flex-row items-center rounded-[20px] bg-[#faf7f2] px-4 py-4">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-white">
        <Ionicons name={icon} size={18} color="#08101c" />
      </View>
      <Text className="ml-3 flex-1 text-sm leading-6 text-[#5b6779]">{text}</Text>
    </View>
  );
}
