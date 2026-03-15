import { Redirect } from "expo-router";
import { Text, View } from "react-native";
import { useAppStore } from "@/store/use-app-store";

export default function Index() {
  const hasBootstrapped = useAppStore((state) => state.hasBootstrapped);
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);

  if (!hasBootstrapped) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f6f3ed] px-6">
        <Text className="text-3xl font-black text-[#08101c]">Workzy</Text>
        <Text className="mt-3 text-center text-sm leading-6 text-[#5b6779]">
          Loading your marketplace workspace...
        </Text>
      </View>
    );
  }

  return <Redirect href={(isAuthenticated ? "/(tabs)" : "/auth") as never} />;
}
