import { ComponentProps, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Screen } from "@/components/screen";
import { useAppStore } from "@/store/use-app-store";

export default function PostTaskScreen() {
  const router = useRouter();
  const activeRole = useAppStore((state) => state.activeRole);
  const createTask = useAppStore((state) => state.createTask);
  const selectRole = useAppStore((state) => state.selectRole);
  const error = useAppStore((state) => state.error);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("Santa Monica");
  const [zipCode, setZipCode] = useState("90401");
  const [timeline, setTimeline] = useState("Tomorrow evening");
  const [budget, setBudget] = useState("120");
  const [tags, setTags] = useState("same day, careful handling");

  const submit = async () => {
    const parsedBudget = Number(budget);

    if (
      !title.trim() ||
      !description.trim() ||
      !location.trim() ||
      Number.isNaN(parsedBudget) ||
      !/^\d{5}$/.test(zipCode.trim())
    ) {
      Alert.alert("Missing details", "Add a title, description, location, valid ZIP code, and valid budget.");
      return;
    }

    const taskId = await createTask({
      title: title.trim(),
      description: description.trim(),
      categoryId: "general",
      location: location.trim(),
      zipCode: zipCode.trim(),
      budget: parsedBudget,
      timeline: timeline.trim() || "Flexible",
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    });

    if (!taskId) {
      Alert.alert("Job not posted", "We could not create the thread for this job.");
      return;
    }

    setTitle("");
    setDescription("");
    setBudget("120");
    setTags("same day, careful handling");
    Alert.alert("Job posted", "Your job is live. Matching taskers can now open the thread and start the conversation.");
    router.replace("/");
  };

  if (activeRole === "tasker") {
    return (
      <Screen>
        <View className="rounded-[32px] border border-[#e6ded0] bg-[#08101c] px-5 pb-6 pt-6">
          <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#9cb4a4]">
            Tasker mode
          </Text>
          <Text className="mt-3 text-3xl font-black leading-9 text-white">
            Posting is only for people hiring help.
          </Text>
          <Text className="mt-3 text-sm leading-6 text-[#c0c9d5]">
            Switch to poster when you want to create a job thread and collect offers from nearby taskers.
          </Text>
          <Pressable
            onPress={() => selectRole("poster")}
            className="mt-6 rounded-full bg-[#d8f6df] px-4 py-4"
          >
            <Text className="text-center text-sm font-bold text-[#08101c]">Switch to Poster</Text>
          </Pressable>
        </View>

        <View className="mt-8 rounded-[28px] border border-[#e8e1d5] bg-white px-5 py-5">
          <Text className="text-lg font-bold text-[#08101c]">How taskers win the thread</Text>
          <AdviceRow icon="chatbubble-ellipses-outline" text="Ask one sharp question before you price it." />
          <AdviceRow icon="cash-outline" text="Quote clearly and say what is included." />
          <AdviceRow icon="shield-checkmark-outline" text="Lead with reliability and response speed." />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text className="text-3xl font-black text-[#08101c]">Post a job</Text>
      <Text className="mt-3 text-sm leading-6 text-[#5b6779]">
        Keep it simple. The title and details should be enough for taskers to ask public questions first, then open a private chat when they want to price the work.
      </Text>

      {error ? (
        <View className="mt-5 rounded-[20px] border border-[#efd3d3] bg-[#fff4f4] px-4 py-4">
          <Text className="text-sm font-semibold text-[#8b3b3b]">{error}</Text>
        </View>
      ) : null}

      <View className="mt-8 rounded-[28px] border border-[#e8e1d5] bg-white px-5 py-5">
        <FormField label="Job title" value={title} onChangeText={setTitle} placeholder="What do you need done?" />
        <FormField
          label="Details"
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the work, access notes, timing, and anything a tasker should know before quoting."
          multiline
        />
        <FormField label="Location" value={location} onChangeText={setLocation} placeholder="Neighborhood or suburb" />
        <FormField label="When" value={timeline} onChangeText={setTimeline} placeholder="When should it happen?" />
        <FormField label="ZIP code" value={zipCode} onChangeText={setZipCode} placeholder="90401" keyboardType="number-pad" />
        <FormField label="Budget" value={budget} onChangeText={setBudget} placeholder="120" keyboardType="numeric" />
        <FormField label="Helpful tags" value={tags} onChangeText={setTags} placeholder="same day, tools required" />

        <View className="mt-6 rounded-[22px] bg-[#faf7f2] px-4 py-4">
          <Text className="text-sm font-bold text-[#08101c]">What happens next</Text>
          <Text className="mt-2 text-sm leading-6 text-[#5b6779]">
            Your job goes live to matching ZIPs. Taskers can ask general questions in the public thread, then open a private chat with you to negotiate price.
          </Text>
        </View>

        <Pressable onPress={submit} className="mt-8 rounded-[24px] bg-[#08101c] px-4 py-4">
          <Text className="text-center text-base font-black text-white">Publish job thread</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function FormField({
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
          multiline ? "min-h-[120px]" : ""
        }`}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}

function AdviceRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="mt-4 flex-row items-center rounded-[20px] bg-[#f6f3ed] px-4 py-4">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-white">
        <Ionicons name={icon} size={18} color="#08101c" />
      </View>
      <Text className="ml-3 flex-1 text-sm leading-6 text-[#5b6779]">{text}</Text>
    </View>
  );
}
