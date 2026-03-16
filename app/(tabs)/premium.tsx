import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/screen";
import { createTaskerOnboardingLink } from "@/lib/payments";
import { useAppStore } from "@/store/use-app-store";

export default function ProfileScreen() {
  const activeRole = useAppStore((state) => state.activeRole);
  const selectRole = useAppStore((state) => state.selectRole);
  const logout = useAppStore((state) => state.logout);
  const updateProfile = useAppStore((state) => state.updateProfile);
  const currentAccount = useAppStore((state) => state.currentAccount);
  const tasks = useAppStore((state) => state.tasks);
  const conversations = useAppStore((state) => state.conversations);
  const status = useAppStore((state) => state.status);
  const error = useAppStore((state) => state.error);
  const refreshMarketplace = useAppStore((state) => state.refreshMarketplace);
  const [isEditing, setIsEditing] = useState(false);
  const [isOpeningPayouts, setIsOpeningPayouts] = useState(false);
  const [homeBase, setHomeBase] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [travelRadiusMiles, setTravelRadiusMiles] = useState("10");
  const [bio, setBio] = useState("");

  const postedTasks = tasks.filter((task) => task.postedBy === currentAccount?.id);
  const assignedTasks = tasks.filter((task) => task.assignedTo === currentAccount?.id);

  useEffect(() => {
    if (!currentAccount || isEditing) {
      return;
    }

    setHomeBase(currentAccount.homeBase);
    setZipCode(currentAccount.zipCode);
    setTravelRadiusMiles(String(currentAccount.travelRadiusMiles));
    setBio(currentAccount.bio);
  }, [currentAccount, isEditing]);

  const handleStartEdit = () => {
    if (!currentAccount) {
      return;
    }

    setHomeBase(currentAccount.homeBase);
    setZipCode(currentAccount.zipCode);
    setTravelRadiusMiles(String(currentAccount.travelRadiusMiles));
    setBio(currentAccount.bio);
    setIsEditing(true);
  };

  const handleSave = async () => {
    const saved = await updateProfile({
      homeBase,
      zipCode,
      travelRadiusMiles: Number(travelRadiusMiles),
      bio
    });

    if (saved) {
      setIsEditing(false);
    }
  };

  const handlePayoutSetup = async () => {
    if (!currentAccount) {
      return;
    }

    try {
      setIsOpeningPayouts(true);
      const url = await createTaskerOnboardingLink(currentAccount.id, currentAccount.name);
      await Linking.openURL(url);
      Alert.alert("Payout setup", "Finish the Stripe onboarding flow in your browser, then come back to Workzy.");
      await refreshMarketplace();
    } catch (paymentError) {
      Alert.alert(
        "Unable to open payouts",
        paymentError instanceof Error ? paymentError.message : "Something went wrong while opening Stripe onboarding."
      );
    } finally {
      setIsOpeningPayouts(false);
    }
  };

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

        <View className="mt-4 flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-3xl font-black text-[#08101c]">{currentAccount?.name ?? "Your account"}</Text>
          {!isEditing ? (
            <Pressable onPress={handleStartEdit} className="rounded-full border border-[#d9d2c7] bg-[#faf7f2] px-4 py-3">
              <Text className="text-sm font-bold text-[#08101c]">Edit profile</Text>
            </Pressable>
          ) : null}
        </View>
        <Text className="mt-2 text-sm leading-6 text-[#5b6779]">{currentAccount?.bio ?? "Marketplace profile"}</Text>

        <View className="mt-4 flex-row flex-wrap gap-3">
          <Badge
            icon="location-outline"
            text={
              currentAccount ? `${currentAccount.homeBase} | ZIP ${currentAccount.zipCode}` : "ZIP not set"
            }
          />
          <Badge icon="car-outline" text={`${currentAccount?.travelRadiusMiles ?? 0} mile radius`} />
          <Badge icon="navigate-outline" text={`${currentAccount?.serviceZipCodes.length ?? 0} service ZIPs`} />
          <Badge icon="chatbubble-ellipses-outline" text={`${conversations.length} active threads`} />
        </View>

        {isEditing ? (
          <View className="mt-5 rounded-[26px] border border-[#efe7da] bg-[#faf7f2] px-4 py-4">
            <Text className="text-lg font-bold text-[#08101c]">Update coverage</Text>
            <Text className="mt-2 text-sm leading-6 text-[#5b6779]">
              Change your home base, main ZIP, and travel radius. We will refresh your nearby job coverage automatically.
            </Text>

            <ProfileField
              label="Home base"
              value={homeBase}
              onChangeText={setHomeBase}
              placeholder="Santa Monica, CA"
            />
            <ProfileField
              label="ZIP code"
              value={zipCode}
              onChangeText={setZipCode}
              keyboardType="number-pad"
              placeholder="90401"
            />
            <ProfileField
              label="Travel radius (miles)"
              value={travelRadiusMiles}
              onChangeText={setTravelRadiusMiles}
              keyboardType="number-pad"
              placeholder="10"
            />
            <ProfileField
              label="Bio"
              value={bio}
              onChangeText={setBio}
              placeholder="Tell people how you like to work."
              multiline
            />

            {error ? <Text className="mt-3 text-sm font-medium text-[#b42318]">{error}</Text> : null}

            <View className="mt-4 flex-row gap-3">
              <Pressable
                onPress={() => setIsEditing(false)}
                className="flex-1 rounded-full border border-[#d9d2c7] bg-white px-4 py-4"
              >
                <Text className="text-center text-sm font-bold text-[#08101c]">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleSave()}
                className="flex-1 rounded-full bg-[#08101c] px-4 py-4"
              >
                <Text className="text-center text-sm font-bold text-white">
                  {status === "loading" ? "Saving..." : "Save changes"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      <View className="mt-8 rounded-[28px] border border-[#e8e1d5] bg-white px-5 py-5">
        <Text className="text-lg font-bold text-[#08101c]">Tasker payouts</Text>
        <Text className="mt-2 text-sm leading-6 text-[#5b6779]">
          Stripe handles tasker onboarding and bank payouts. Posters pay inside Workzy, Workzy keeps its 10% platform fee, and the remainder is released to the tasker after completion.
        </Text>
        <View className="mt-4 flex-row flex-wrap gap-3">
          <Badge
            icon="card-outline"
            text={
              currentAccount?.stripeAccountStatus === "active"
                ? "Payouts active"
                : currentAccount?.stripeAccountStatus === "pending"
                  ? "Payout setup in progress"
                  : "Payouts not set up"
            }
          />
        </View>
        <Pressable
          onPress={() => void handlePayoutSetup()}
          className="mt-5 rounded-full bg-[#08101c] px-4 py-4"
        >
          <Text className="text-center text-sm font-bold text-white">
            {isOpeningPayouts
              ? "Opening Stripe..."
              : currentAccount?.stripeAccountStatus === "active"
                ? "Manage payout setup"
                : "Set up payouts"}
          </Text>
        </Pressable>
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

      <View className="mt-8 rounded-[28px] border border-[#e8e1d5] bg-white px-5 py-5">
        <Text className="text-lg font-bold text-[#08101c]">Disclaimer</Text>
        <Text className="mt-3 text-sm leading-6 text-[#5b6779]">
          Workzy is a marketplace that helps posters and taskers connect. Taskers and posters use Workzy as
          independent users and are not employees, agents, joint venturers, or representatives of Workzy. Workzy does
          not perform the services offered by taskers and does not guarantee the quality, safety, legality, licensing,
          insurance, identity, background, credentials, availability, conduct, or outcome of any job, communication,
          or transaction arranged through the app.
        </Text>
        <Text className="mt-3 text-sm leading-6 text-[#5b6779]">
          Users are responsible for their own decisions, screening, hiring, supervision, access to property, and
          interactions with others on the platform. If there is an emergency, immediate safety threat, injury, theft,
          assault, or suspected crime, contact local emergency services right away first, then report the issue to
          Workzy.
        </Text>
        <Text className="mt-3 text-sm leading-6 text-[#5b6779]">
          In-app information is general platform guidance only and is not legal, safety, insurance, tax, employment,
          or professional advice. Use of Workzy is subject to Workzy&apos;s terms, policies, and applicable law.
        </Text>
      </View>

      <View className="mt-8 rounded-[28px] border border-[#e8e1d5] bg-white px-5 py-5">
        <Text className="text-lg font-bold text-[#08101c]">Contact us</Text>
        <Text className="mt-3 text-sm leading-6 text-[#5b6779]">
          Questions, safety concerns, takedown requests, or support issues can be sent to:
        </Text>
        <Text className="mt-3 text-base font-bold text-[#08101c]">tookey444@gmail.com</Text>
      </View>
    </Screen>
  );
}

function ProfileField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "number-pad";
  multiline?: boolean;
}) {
  return (
    <View className="mt-4">
      <Text className="text-xs font-semibold uppercase tracking-[1px] text-[#5b6779]">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        className={`mt-2 rounded-[20px] border border-[#ded6ca] bg-white px-4 py-4 text-sm text-[#08101c] ${multiline ? "min-h-[112px]" : ""}`}
      />
    </View>
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
