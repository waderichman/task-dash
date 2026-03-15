import { ComponentProps, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Screen } from "@/components/screen";
import { UserRole } from "@/lib/types";
import { useAppStore } from "@/store/use-app-store";

export default function AuthScreen() {
  const router = useRouter();
  const hasBootstrapped = useAppStore((state) => state.hasBootstrapped);
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const status = useAppStore((state) => state.status);
  const error = useAppStore((state) => state.error);
  const login = useAppStore((state) => state.login);
  const signUp = useAppStore((state) => state.signUp);

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<UserRole>("poster");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [homeBase, setHomeBase] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [travelRadiusMiles, setTravelRadiusMiles] = useState("10");
  const [serviceZipCodes, setServiceZipCodes] = useState("");
  const [bio, setBio] = useState("");

  if (!hasBootstrapped) {
    return (
      <Screen>
        <View className="rounded-[28px] border border-[#e8e1d5] bg-white px-5 py-10">
          <Text className="text-center text-2xl font-black text-[#08101c]">Workzy</Text>
          <Text className="mt-3 text-center text-sm leading-6 text-[#5b6779]">
            Restoring your session...
          </Text>
        </View>
      </Screen>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  const submit = async () => {
    const ok =
      mode === "login"
        ? await login({ email, password, role })
        : await signUp({
            name,
            email,
            password,
            role,
            homeBase,
            zipCode,
            travelRadiusMiles: Number(travelRadiusMiles) || 10,
            serviceZipCodes: serviceZipCodes.split(",").map((item) => item.trim()),
            bio
          });

    if (ok) {
      router.replace("/(tabs)");
    }
  };

  const busy = status === "loading";

  return (
    <Screen>
      <LinearGradient
        colors={["#f4f1ea", "#dff6e6", "#f4e6d4"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="rounded-[32px] border border-[#e6ded0] px-5 pb-6 pt-6"
      >
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#56705e]">
          Workzy Auth
        </Text>
        <Text className="mt-3 text-[34px] font-black leading-[40px] text-[#08101c]">
          {mode === "login" ? "Sign in to your local marketplace" : "Create your Workzy account"}
        </Text>
        <Text className="mt-3 text-sm leading-6 text-[#4f5d70]">
          Posters post jobs by ZIP code. Taskers can cover nearby ZIPs automatically with a travel radius.
        </Text>
      </LinearGradient>

      <View className="mt-8 rounded-[28px] border border-[#e8e1d5] bg-white px-5 py-5">
        <View className="flex-row gap-3">
          <ModePill label="Sign In" active={mode === "login"} onPress={() => setMode("login")} />
          <ModePill label="Sign Up" active={mode === "signup"} onPress={() => setMode("signup")} />
        </View>

        <Text className="mt-6 text-sm font-bold text-[#08101c]">I'm using the app as</Text>
        <View className="mt-3 flex-row gap-3">
          <ModePill label="Poster" active={role === "poster"} onPress={() => setRole("poster")} />
          <ModePill label="Tasker" active={role === "tasker"} onPress={() => setRole("tasker")} />
        </View>

        {mode === "signup" ? (
          <>
            <Field label="Full name" value={name} onChangeText={setName} placeholder="Irene Parker" />
            <Field
              label="Home base"
              value={homeBase}
              onChangeText={setHomeBase}
              placeholder="Santa Monica, CA"
            />
            <Field
              label="Home ZIP"
              value={zipCode}
              onChangeText={setZipCode}
              placeholder="90401"
              keyboardType="number-pad"
            />
            {role === "tasker" ? (
              <Field
                label="Travel radius (miles)"
                value={travelRadiusMiles}
                onChangeText={setTravelRadiusMiles}
                placeholder="10"
                keyboardType="number-pad"
              />
            ) : null}
            <Field
              label="Extra ZIPs"
              value={serviceZipCodes}
              onChangeText={setServiceZipCodes}
              placeholder="Optional: 90402, 90403"
            />
            <Field
              label="Bio"
              value={bio}
              onChangeText={setBio}
              placeholder="Reliable local pro"
              multiline
            />
          </>
        ) : null}

        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder={mode === "login" ? "you@example.com" : "name@workzy.app"}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
        />

        {error ? (
          <View className="mt-5 rounded-[20px] border border-[#efd3d3] bg-[#fff4f4] px-4 py-4">
            <Text className="text-sm font-semibold text-[#8b3b3b]">{error}</Text>
          </View>
        ) : null}

        <Pressable onPress={() => void submit()} className="mt-8 rounded-[24px] bg-[#08101c] px-4 py-4">
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-center text-base font-black text-white">
              {mode === "login" ? "Sign in" : "Create account"}
            </Text>
          )}
        </Pressable>
      </View>
    </Screen>
  );
}

function ModePill({
  label,
  active,
  onPress
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-full px-4 py-4 ${
        active ? "bg-[#08101c]" : "bg-[#f6f3ed]"
      }`}
    >
      <Text className={`text-center text-sm font-bold ${active ? "text-white" : "text-[#08101c]"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function Field({
  label,
  multiline,
  ...props
}: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View className="mt-5">
      <Text className="text-sm font-bold text-[#08101c]">{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor="#8a95a5"
        className={`mt-3 rounded-[20px] border border-[#e8e1d5] bg-[#faf7f2] px-4 py-4 text-[#08101c] ${
          multiline ? "min-h-[110px]" : ""
        }`}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}
