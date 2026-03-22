import { ComponentProps, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Screen } from "@/components/screen";
import { useAppStore } from "@/store/use-app-store";

export default function AuthScreen() {
  const router = useRouter();
  const hasBootstrapped = useAppStore((state) => state.hasBootstrapped);
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const status = useAppStore((state) => state.status);
  const error = useAppStore((state) => state.error);
  const login = useAppStore((state) => state.login);
  const signUp = useAppStore((state) => state.signUp);
  const resendConfirmation = useAppStore((state) => state.resendConfirmation);
  const pendingConfirmationEmail = useAppStore((state) => state.pendingConfirmationEmail);

  const [mode, setMode] = useState<"login" | "signup">("login");
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
          <Text className="mt-3 text-center text-sm leading-6 text-[#5b6779]">Restoring your session...</Text>
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
        ? await login({ email, password })
        : await signUp({
            name,
            email,
            password,
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
        colors={["#f4efe7", "#e7f7ef", "#f8ead8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="rounded-[32px] border border-[#e6ded0] px-5 pb-6 pt-6"
      >
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#56705e]">Workzy</Text>
        <Text className="mt-3 text-[34px] font-black leading-[40px] text-[#08101c]">
          {mode === "login" ? "Sign in and pick up where you left off." : "One account for posting work or earning from it."}
        </Text>
        <Text className="mt-3 text-sm leading-6 text-[#4f5d70]">
          No role picking up front. Set your area once, then post tasks, message people, and enable payouts whenever you want to earn.
        </Text>
      </LinearGradient>

      <View className="mt-8 rounded-[28px] border border-[#e8e1d5] bg-white px-5 py-5">
        <View className="flex-row gap-3">
          <ModePill label="Sign In" active={mode === "login"} onPress={() => setMode("login")} />
          <ModePill label="Create Account" active={mode === "signup"} onPress={() => setMode("signup")} />
        </View>

        {mode === "signup" ? (
          <>
            <Field label="Full name" value={name} onChangeText={setName} placeholder="Irene Parker" />
            <Field label="Home base" value={homeBase} onChangeText={setHomeBase} placeholder="Santa Monica, CA" />
            <Field
              label="Home ZIP"
              value={zipCode}
              onChangeText={setZipCode}
              placeholder="90401"
              keyboardType="number-pad"
            />
            <Field
              label="Travel radius (miles)"
              value={travelRadiusMiles}
              onChangeText={setTravelRadiusMiles}
              placeholder="10"
              keyboardType="number-pad"
            />
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
              placeholder="Reliable, quick to reply, happy to help."
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
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />

        {error ? (
          <View className="mt-5 rounded-[20px] border border-[#efd3d3] bg-[#fff4f4] px-4 py-4">
            <Text className="text-sm font-semibold text-[#8b3b3b]">{error}</Text>
          </View>
        ) : null}

        {pendingConfirmationEmail ? (
          <View className="mt-5 rounded-[20px] border border-[#d9e7ff] bg-[#f3f8ff] px-4 py-4">
            <Text className="text-sm font-semibold leading-6 text-[#1849a9]">
              We sent a confirmation link to {pendingConfirmationEmail}. If the sender still looks generic, that part is
              coming from your current Supabase mail setup, not this screen.
            </Text>
            <Pressable
              onPress={() => void resendConfirmation(email || pendingConfirmationEmail)}
              className="mt-3 rounded-full border border-[#b2ccff] bg-white px-4 py-3"
            >
              <Text className="text-center text-sm font-bold text-[#1849a9]">
                {busy ? "Sending..." : "Resend confirmation email"}
              </Text>
            </Pressable>
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
      className={`flex-1 rounded-full px-4 py-4 ${active ? "bg-[#08101c]" : "bg-[#f6f3ed]"}`}
    >
      <Text className={`text-center text-sm font-bold ${active ? "text-white" : "text-[#08101c]"}`}>{label}</Text>
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
