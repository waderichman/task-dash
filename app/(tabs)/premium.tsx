import { ComponentProps, useCallback, useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen } from "@/components/screen";
import { refreshPayoutStatus } from "@/lib/payments";
import { useAppStore } from "@/store/use-app-store";

export default function AccountScreen() {
  const router = useRouter();
  const logout = useAppStore((state) => state.logout);
  const updateProfile = useAppStore((state) => state.updateProfile);
  const currentAccount = useAppStore((state) => state.currentAccount);
  const tasks = useAppStore((state) => state.tasks);
  const status = useAppStore((state) => state.status);
  const error = useAppStore((state) => state.error);
  const refreshMarketplace = useAppStore((state) => state.refreshMarketplace);
  const [isEditing, setIsEditing] = useState(false);
  const [homeBase, setHomeBase] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [travelRadiusMiles, setTravelRadiusMiles] = useState("10");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (!currentAccount || isEditing) return;
    setHomeBase(currentAccount.homeBase);
    setZipCode(currentAccount.zipCode);
    setTravelRadiusMiles(String(currentAccount.travelRadiusMiles));
    setBio(currentAccount.bio);
  }, [currentAccount, isEditing]);

  useFocusEffect(
    useCallback(() => {
      if (!currentAccount) {
        return undefined;
      }

      let active = true;

      void (async () => {
        try {
          await refreshPayoutStatus(currentAccount.id);
          if (active) {
            await refreshMarketplace();
          }
        } catch {
          // Best-effort sync after returning from Stripe.
        }
      })();

      return () => {
        active = false;
      };
    }, [currentAccount, refreshMarketplace])
  );

  const postedTasks = tasks.filter((task) => task.postedBy === currentAccount?.id);
  const assignedTasks = tasks.filter((task) => task.assignedTo === currentAccount?.id);

  const handleSave = async () => {
    const saved = await updateProfile({
      homeBase,
      zipCode,
      travelRadiusMiles: Number(travelRadiusMiles),
      bio
    });
    if (saved) setIsEditing(false);
  };

  return (
    <Screen>
      <View className="rounded-[28px] border border-[#e4e7ec] bg-white px-5 py-5">
        <Text className="text-[30px] font-black text-[#101828]">{currentAccount?.name ?? "Account"}</Text>
        <Text className="mt-2 text-sm leading-6 text-[#667085]">{currentAccount?.bio ?? "Marketplace profile"}</Text>

        <View className="mt-5 flex-row gap-3">
          <StatCard label="Posted" value={String(postedTasks.length)} />
          <StatCard label="Working" value={String(assignedTasks.length)} />
          <StatCard label="Payouts" value={currentAccount?.stripeAccountStatus === "active" ? "Active" : "Off"} />
        </View>
      </View>

      <View className="mt-6 rounded-[28px] border border-[#e4e7ec] bg-white px-5 py-5">
        <Text className="text-[24px] font-black text-[#101828]">Profile</Text>
        {!isEditing ? (
          <>
            <Text className="mt-3 text-sm leading-6 text-[#667085]">
              {currentAccount
                ? `${currentAccount.homeBase} | ZIP ${currentAccount.zipCode} | ${currentAccount.travelRadiusMiles} mile radius`
                : "No profile loaded yet."}
            </Text>
            <View className="mt-5 flex-row gap-3">
              <PrimaryButton label="Edit profile" onPress={() => setIsEditing(true)} />
              <SecondaryButton label="Log out" onPress={() => void logout()} />
            </View>
          </>
        ) : (
          <>
            <Field label="Home base" value={homeBase} onChangeText={setHomeBase} placeholder="Santa Monica, CA" />
            <View className="mt-5 flex-row gap-3">
              <View className="flex-1">
                <Field label="ZIP code" value={zipCode} onChangeText={setZipCode} placeholder="90401" keyboardType="number-pad" />
              </View>
              <View className="flex-1">
                <Field label="Travel radius" value={travelRadiusMiles} onChangeText={setTravelRadiusMiles} placeholder="10" keyboardType="number-pad" />
              </View>
            </View>
            <Field label="Bio" value={bio} onChangeText={setBio} placeholder="Tell people how you work." multiline />
            {error ? <Text className="mt-3 text-sm text-[#b42318]">{error}</Text> : null}

            <View className="mt-5 flex-row gap-3">
              <SecondaryButton label="Cancel" onPress={() => setIsEditing(false)} />
              <PrimaryButton label={status === "loading" ? "Saving..." : "Save changes"} onPress={() => void handleSave()} />
            </View>
          </>
        )}
      </View>

      <View className="mt-6 rounded-[28px] border border-[#e4e7ec] bg-white px-5 py-5">
        <Text className="text-[24px] font-black text-[#101828]">Payouts</Text>
        <Text className="mt-3 text-sm leading-6 text-[#667085]">
          Turn this on when you want to get paid for tasks you complete. Customers can still post and book tasks without it.
        </Text>
        <Text className="mt-2 text-sm leading-6 text-[#667085]">
          Workzy guides you first, then hands off to Stripe only for the final legal verification step.
        </Text>
        <Pressable onPress={() => router.push("/payouts")} className="mt-5 rounded-full bg-[#0f6fff] px-4 py-4">
          <Text className="text-center text-sm font-bold text-white">
            {currentAccount?.stripeAccountStatus === "active" ? "Manage payout account" : "Get paid"}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function Field({
  label,
  multiline,
  ...props
}: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View>
      <Text className="text-sm font-bold text-[#344054]">{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor="#98a2b3"
        className={`mt-3 rounded-[18px] border border-[#d0d5dd] bg-[#f9fafb] px-4 py-4 text-[#101828] ${multiline ? "min-h-[110px]" : ""}`}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-[20px] border border-[#e4e7ec] bg-[#f9fafb] px-4 py-4">
      <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-[#667085]">{label}</Text>
      <Text className="mt-2 text-lg font-black text-[#101828]">{value}</Text>
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
