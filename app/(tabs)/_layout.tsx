import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppStore } from "@/store/use-app-store";

const iconMap = {
  index: "sparkles-outline",
  topics: "add-circle-outline",
  alerts: "chatbubble-ellipses-outline",
  premium: "person-circle-outline"
} as const;

export default function TabsLayout() {
  const hasBootstrapped = useAppStore((state) => state.hasBootstrapped);
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);

  if (hasBootstrapped && !isAuthenticated) {
    return <Redirect href={"/auth" as never} />;
  }

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#0f6fff",
        tabBarInactiveTintColor: "#7c8798",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e4e8ee",
          height: 76,
          paddingTop: 10,
          paddingBottom: 12
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700"
        },
        tabBarActiveBackgroundColor: "#edf4ff",
        tabBarItemStyle: {
          marginHorizontal: 8,
          marginVertical: 6,
          borderRadius: 18
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={iconMap[route.name as keyof typeof iconMap]}
            size={size}
            color={color}
          />
        )
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Browse" }} />
      <Tabs.Screen name="topics" options={{ title: "Post" }} />
      <Tabs.Screen name="alerts" options={{ title: "Inbox" }} />
      <Tabs.Screen name="premium" options={{ title: "Account" }} />
    </Tabs>
  );
}
