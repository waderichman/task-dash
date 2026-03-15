import { Pressable, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Screen } from "@/components/screen";
import { useAppStore } from "@/store/use-app-store";

export default function ConfirmScreen() {
  const router = useRouter();
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Screen>
      <View className="rounded-[32px] border border-[#e6ded0] bg-white px-5 py-8">
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#56705e]">
          Email Confirmed
        </Text>
        <Text className="mt-3 text-3xl font-black leading-9 text-[#08101c]">
          Your Workzy account is verified.
        </Text>
        <Text className="mt-3 text-sm leading-6 text-[#5b6779]">
          Head back to sign in with the email and password you just created.
        </Text>

        <Pressable
          onPress={() => router.replace("/auth")}
          className="mt-8 rounded-[24px] bg-[#08101c] px-4 py-4"
        >
          <Text className="text-center text-base font-black text-white">Go to Sign In</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
