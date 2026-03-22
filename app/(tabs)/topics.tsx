import { ComponentProps, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/screen";
import { useAppStore } from "@/store/use-app-store";

export default function PostTaskScreen() {
  const createTask = useAppStore((state) => state.createTask);
  const status = useAppStore((state) => state.status);
  const error = useAppStore((state) => state.error);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [timeline, setTimeline] = useState("");
  const [budget, setBudget] = useState("");
  const [tags, setTags] = useState("");

  const submit = async () => {
    const parsedBudget = Number(budget);
    if (
      !title.trim() ||
      !description.trim() ||
      !location.trim() ||
      !/^\d{5}$/.test(zipCode.trim()) ||
      Number.isNaN(parsedBudget)
    ) {
      Alert.alert("Missing details", "Add a title, details, location, ZIP code, and budget.");
      return;
    }

    const taskId = await createTask({
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      zipCode: zipCode.trim(),
      budget: parsedBudget,
      timeline: timeline.trim() || "Flexible",
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean)
    });

    if (!taskId) {
      Alert.alert("Task not posted", "We could not create the task right now.");
      return;
    }

    setTitle("");
    setDescription("");
    setLocation("");
    setZipCode("");
    setTimeline("");
    setBudget("");
    setTags("");
    Alert.alert("Task posted", "Your task is live and ready for offers.");
  };

  return (
    <Screen>
      <View className="rounded-[28px] border border-[#e4e7ec] bg-white px-5 py-5">
        <Text className="text-[30px] font-black text-[#101828]">Post a task</Text>
        <Text className="mt-2 text-sm leading-6 text-[#667085]">
          Tell people what needs to be done, where it is, when it should happen, and what you want to spend.
        </Text>
      </View>

      {error ? (
        <View className="mt-5 rounded-[20px] border border-[#f3d2d2] bg-[#fff5f5] px-4 py-4">
          <Text className="text-sm font-semibold text-[#b42318]">{error}</Text>
        </View>
      ) : null}

      <View className="mt-6 rounded-[28px] border border-[#e4e7ec] bg-white px-5 py-5">
        <Field label="Task title" value={title} onChangeText={setTitle} placeholder="Need help moving a sofa" />
        <Field
          label="Details"
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the task, access details, timing, parking, tools, or anything someone should know before making an offer."
          multiline
        />

        <View className="mt-5 flex-row gap-3">
          <View className="flex-1">
            <Field label="Location" value={location} onChangeText={setLocation} placeholder="Santa Monica" />
          </View>
          <View className="w-[120px]">
            <Field label="ZIP code" value={zipCode} onChangeText={setZipCode} placeholder="90401" keyboardType="number-pad" />
          </View>
        </View>

        <View className="mt-5 flex-row gap-3">
          <View className="flex-1">
            <Field label="When" value={timeline} onChangeText={setTimeline} placeholder="Tomorrow evening" />
          </View>
          <View className="w-[120px]">
            <Field label="Budget" value={budget} onChangeText={setBudget} placeholder="120" keyboardType="numeric" />
          </View>
        </View>

        <Field label="Tags" value={tags} onChangeText={setTags} placeholder="same day, tools required" />

        <View className="mt-6 rounded-[20px] bg-[#f9fafb] px-4 py-4">
          <Text className="text-sm font-bold text-[#101828]">After you post</Text>
          <Text className="mt-2 text-sm leading-6 text-[#667085]">
            Your task shows up in Browse. People can ask a public question first, then send private offers in Inbox.
          </Text>
        </View>

        <Pressable onPress={() => void submit()} className="mt-8 rounded-full bg-[#0f6fff] px-4 py-4">
          <Text className="text-center text-sm font-bold text-white">
            {status === "loading" ? "Publishing..." : "Publish task"}
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
        className={`mt-3 rounded-[18px] border border-[#d0d5dd] bg-[#f9fafb] px-4 py-4 text-[#101828] ${multiline ? "min-h-[120px]" : ""}`}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}
