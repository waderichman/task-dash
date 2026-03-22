import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/screen";
import { useAppStore } from "@/store/use-app-store";

export default function MarketplaceProfileScreen() {
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const users = useAppStore((state) => state.users);
  const reviews = useAppStore((state) => state.reviews);

  const user = users.find((entry) => entry.id === userId);
  const taskerReviews = reviews.filter((review) => review.revieweeId === userId && review.role === "tasker");
  const posterReviews = reviews.filter((review) => review.revieweeId === userId && review.role === "poster");

  if (!user) {
    return (
      <Screen>
        <View className="rounded-[28px] border border-[#e8e1d5] bg-white px-5 py-6">
          <Text className="text-2xl font-black text-[#08101c]">Profile not found</Text>
          <Text className="mt-3 text-sm leading-6 text-[#5b6779]">
            This person is not available in your current marketplace view.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="rounded-[32px] border border-[#e6ded0] bg-white px-5 pb-6 pt-6">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-[#d8f6df]">
          <Text className="text-2xl font-black text-[#08101c]">{user.name.slice(0, 1)}</Text>
        </View>
        <Text className="mt-4 text-3xl font-black text-[#08101c]">{user.name}</Text>
        <Text className="mt-2 text-sm leading-6 text-[#5b6779]">{user.tagline}</Text>

        <View className="mt-4 flex-row flex-wrap gap-3">
          <Badge icon="star-outline" text={formatRating(user.taskerRating, "tasker")} />
          <Badge icon="receipt-outline" text={`${user.jobsCompleted} jobs completed`} />
          <Badge icon="location-outline" text={`ZIP ${user.zipCode}`} />
          <Badge icon="navigate-outline" text={`${user.serviceZipCodes.length} service ZIPs`} />
        </View>
      </View>

      <View className="mt-8 gap-4">
        <SummaryCard
          title="Tasker reputation"
          primary={formatRating(user.taskerRating, "tasker")}
          secondary={`${user.jobsCompleted} completed jobs`}
        />
        <SummaryCard
          title="Poster reputation"
          primary={formatRating(user.posterRating, "poster")}
          secondary={`${user.tasksPosted} jobs posted`}
        />
      </View>

      <ReviewSection
        title="Tasker reviews"
        emptyText="No tasker reviews yet."
        reviews={taskerReviews}
      />
      <ReviewSection
        title="Poster reviews"
        emptyText="No poster reviews yet."
        reviews={posterReviews}
      />
    </Screen>
  );
}

function formatRating(
  rating: { average: number; count: number },
  label: "tasker" | "poster"
) {
  return rating.count > 0
    ? `${rating.average.toFixed(1)} stars from ${rating.count} ${label} review${rating.count === 1 ? "" : "s"}`
    : `No ${label} reviews yet`;
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

function ReviewSection({
  title,
  emptyText,
  reviews
}: {
  title: string;
  emptyText: string;
  reviews: Array<{ id: string; rating: number; text: string; createdAt: string }>;
}) {
  return (
    <View className="mt-8 rounded-[28px] border border-[#e8e1d5] bg-white px-5 py-5">
      <Text className="text-lg font-bold text-[#08101c]">{title}</Text>
      {reviews.length === 0 ? (
        <Text className="mt-3 text-sm leading-6 text-[#5b6779]">{emptyText}</Text>
      ) : (
        reviews.map((review) => (
          <View key={review.id} className="mt-4 rounded-[22px] bg-[#faf7f2] px-4 py-4">
            <Text className="text-sm font-bold text-[#08101c]">{`${review.rating}/5 stars`}</Text>
            <Text className="mt-2 text-sm leading-6 text-[#5b6779]">{review.text}</Text>
            <Text className="mt-3 text-xs font-semibold uppercase tracking-[1.5px] text-[#7d8898]">
              {review.createdAt}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}
