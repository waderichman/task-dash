import { mockMarketplace } from "@/lib/mock-marketplace";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import {
  Category,
  Conversation,
  ConversationType,
  CurrentAccount,
  MarketplacePayload,
  MarketplaceUser,
  Message,
  MessageKind,
  RatingRole,
  RatingSummary,
  Review,
  Task,
  UserRole
} from "@/lib/types";

type ProfileRow = {
  id: string;
  full_name: string;
  email: string | null;
  bio: string | null;
  home_base: string | null;
  zip_code: string;
  active_role: UserRole | null;
};

type ServiceAreaRow = {
  profile_id: string;
  zip_code: string;
};

type TaskRow = {
  id: string;
  posted_by: string;
  assigned_to: string | null;
  category_id: string | null;
  title: string;
  description: string;
  location: string;
  zip_code: string;
  budget: number;
  agreed_price: number | null;
  timeline: string;
  status: "open" | "assigned" | "completed";
  posted_at: string;
};

type TaskTagRow = {
  task_id: string;
  label: string;
};

type ConversationRow = {
  id: string;
  task_id: string;
  thread_type: ConversationType | null;
  tasker_id: string | null;
};

type ConversationParticipantRow = {
  conversation_id: string;
  profile_id: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  body: string;
  kind: MessageKind;
  offer_amount: number | null;
  sent_at: string;
};

type ReviewRow = {
  id: string;
  task_id: string;
  reviewer_id: string;
  reviewee_id: string;
  role: RatingRole;
  rating: number;
  body: string;
  created_at: string;
};

function formatShortDate(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function ensureSupabase() {
  if (!hasSupabaseEnv()) {
    throw new Error("Missing Supabase environment variables");
  }
}

function ratingSummary(reviews: ReviewRow[], revieweeId: string, role: RatingRole): RatingSummary {
  const relevant = reviews.filter((review) => review.reviewee_id === revieweeId && review.role === role);

  if (relevant.length === 0) {
    return { average: 0, count: 0 };
  }

  const average =
    relevant.reduce((sum, review) => sum + review.rating, 0) / relevant.length;

  return {
    average: Number(average.toFixed(1)),
    count: relevant.length
  };
}

function buildUsers(
  profiles: ProfileRow[],
  serviceAreas: ServiceAreaRow[],
  reviews: ReviewRow[],
  tasks: TaskRow[],
  currentAccountId: string
) {
  const serviceAreaMap = new Map<string, string[]>();
  for (const area of serviceAreas) {
    serviceAreaMap.set(area.profile_id, [...(serviceAreaMap.get(area.profile_id) ?? []), area.zip_code]);
  }

  const users = profiles
    .filter((profile) => profile.id !== currentAccountId)
    .map<MarketplaceUser>((profile) => {
      const tasksPosted = tasks.filter((task) => task.posted_by === profile.id).length;
      const jobsCompleted = tasks.filter(
        (task) => task.assigned_to === profile.id && task.status === "completed"
      ).length;

      return {
        id: profile.id,
        name: profile.full_name,
        tagline: profile.bio ?? "TaskDash member",
        taskerRating: ratingSummary(reviews, profile.id, "tasker"),
        posterRating: ratingSummary(reviews, profile.id, "poster"),
        jobsCompleted,
        tasksPosted,
        responseTime: "Replies quickly",
        avatarColor: "#d8f6df",
        zipCode: profile.zip_code,
        serviceZipCodes: serviceAreaMap.get(profile.id) ?? [profile.zip_code]
      };
    });

  return {
    users,
    serviceAreaMap
  };
}

function buildCurrentAccount(
  currentProfile: ProfileRow,
  serviceAreaMap: Map<string, string[]>,
  reviews: ReviewRow[],
  tasks: TaskRow[]
): CurrentAccount {
  const postedTasks = tasks.filter((task) => task.posted_by === currentProfile.id);
  const assignedTasks = tasks.filter((task) => task.assigned_to === currentProfile.id);
  const completedPostedTasks = postedTasks.filter((task) => task.status === "completed");
  const completedAssignedTasks = assignedTasks.filter((task) => task.status === "completed");
  const hireRate =
    postedTasks.length === 0
      ? "0%"
      : `${Math.round((postedTasks.filter((task) => task.status !== "open").length / postedTasks.length) * 100)}%`;
  const earnings = completedAssignedTasks.reduce((sum, task) => sum + (task.agreed_price ?? task.budget), 0);

  return {
    id: currentProfile.id,
    name: currentProfile.full_name,
    homeBase: currentProfile.home_base ?? `ZIP ${currentProfile.zip_code}`,
    zipCode: currentProfile.zip_code,
    serviceZipCodes: serviceAreaMap.get(currentProfile.id) ?? [currentProfile.zip_code],
    bio: currentProfile.bio ?? "TaskDash member",
    posterStats: {
      tasksPosted: postedTasks.length,
      hireRate,
      completedCount: completedPostedTasks.length,
      rating: ratingSummary(reviews, currentProfile.id, "poster")
    },
    taskerStats: {
      jobsWon: assignedTasks.length,
      earningsLabel: `$${earnings}`,
      completedCount: completedAssignedTasks.length,
      rating: ratingSummary(reviews, currentProfile.id, "tasker")
    }
  };
}

function buildConversations(
  conversations: ConversationRow[],
  participants: ConversationParticipantRow[],
  messages: MessageRow[]
) {
  const participantsMap = new Map<string, string[]>();
  for (const participant of participants) {
    participantsMap.set(participant.conversation_id, [
      ...(participantsMap.get(participant.conversation_id) ?? []),
      participant.profile_id
    ]);
  }

  const messagesMap = new Map<string, Message[]>();
  for (const message of messages) {
    const mapped: Message = {
      id: message.id,
      senderId: message.sender_id ?? "system",
      text: message.body,
      sentAt: formatShortDate(message.sent_at),
      kind: message.kind,
      offerAmount: message.offer_amount ?? undefined
    };

    messagesMap.set(message.conversation_id, [...(messagesMap.get(message.conversation_id) ?? []), mapped]);
  }

  return conversations.map<Conversation>((conversation) => ({
    id: conversation.id,
    taskId: conversation.task_id,
    threadType: conversation.thread_type ?? "private",
    taskerId: conversation.tasker_id ?? undefined,
    participantIds: participantsMap.get(conversation.id) ?? [],
    messages: messagesMap.get(conversation.id) ?? []
  }));
}

function buildTasks(
  tasks: TaskRow[],
  tags: TaskTagRow[],
  conversations: Conversation[]
) {
  const tagsMap = new Map<string, string[]>();
  for (const tag of tags) {
    tagsMap.set(tag.task_id, [...(tagsMap.get(tag.task_id) ?? []), tag.label]);
  }

  const counts = new Map<string, { offers: number; questions: number }>();
  for (const conversation of conversations) {
    const offerCount = conversation.messages.filter((message) => message.kind === "offer").length;
    const questionCount = conversation.messages.filter((message) => message.kind === "question").length;
    const existing = counts.get(conversation.taskId) ?? { offers: 0, questions: 0 };
    counts.set(conversation.taskId, {
      offers: existing.offers + ((conversation.threadType ?? "private") === "private" ? offerCount : 0),
      questions: existing.questions + questionCount
    });
  }

  return tasks.map<Task>((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    categoryId: task.category_id ?? "cleaning",
    location: task.location,
    zipCode: task.zip_code,
    distanceLabel: `ZIP ${task.zip_code}`,
    budget: task.budget,
    timeline: task.timeline,
    status: task.status,
    postedAt: formatShortDate(task.posted_at),
    postedBy: task.posted_by,
    assignedTo: task.assigned_to ?? undefined,
    agreedPrice: task.agreed_price ?? undefined,
    offers: counts.get(task.id)?.offers ?? 0,
    questions: counts.get(task.id)?.questions ?? 0,
    tags: tagsMap.get(task.id) ?? []
  }));
}

function buildReviews(reviews: ReviewRow[]) {
  return reviews.map<Review>((review) => ({
    id: review.id,
    taskId: review.task_id,
    reviewerId: review.reviewer_id,
    revieweeId: review.reviewee_id,
    role: review.role,
    rating: review.rating,
    text: review.body,
    createdAt: formatShortDate(review.created_at)
  }));
}

async function loadBaseRows() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Not authenticated");

  const currentUserId = authData.user.id;

  const [
    profilesResult,
    serviceAreasResult,
    categoriesResult,
    tasksResult,
    tagsResult,
    conversationsResult,
    participantsResult,
    messagesResult,
    reviewsResult
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, bio, home_base, zip_code, active_role"),
    supabase.from("tasker_service_areas").select("profile_id, zip_code"),
    supabase.from("categories").select("id, label, icon, accent").order("label"),
    supabase.from("tasks").select("*").order("posted_at", { ascending: false }),
    supabase.from("task_tags").select("task_id, label"),
    supabase.from("conversations").select("id, task_id, thread_type, tasker_id").order("created_at", { ascending: false }),
    supabase.from("conversation_participants").select("conversation_id, profile_id"),
    supabase.from("messages").select("id, conversation_id, sender_id, body, kind, offer_amount, sent_at").order("sent_at"),
    supabase.from("reviews").select("id, task_id, reviewer_id, reviewee_id, role, rating, body, created_at").order("created_at", { ascending: false })
  ]);

  for (const result of [
    profilesResult,
    serviceAreasResult,
    categoriesResult,
    tasksResult,
    tagsResult,
    conversationsResult,
    participantsResult,
    messagesResult,
    reviewsResult
  ]) {
    if (result.error) throw result.error;
  }

  return {
    currentUserId,
    profiles: (profilesResult.data ?? []) as ProfileRow[],
    serviceAreas: (serviceAreasResult.data ?? []) as ServiceAreaRow[],
    categories: (categoriesResult.data ?? []) as Category[],
    taskRows: (tasksResult.data ?? []) as TaskRow[],
    taskTags: (tagsResult.data ?? []) as TaskTagRow[],
    conversationRows: (conversationsResult.data ?? []) as ConversationRow[],
    participantRows: (participantsResult.data ?? []) as ConversationParticipantRow[],
    messageRows: (messagesResult.data ?? []) as MessageRow[],
    reviewRows: (reviewsResult.data ?? []) as ReviewRow[]
  };
}

export async function fetchMarketplaceFromSupabase(): Promise<MarketplacePayload> {
  ensureSupabase();

  const rows = await loadBaseRows();
  const { users, serviceAreaMap } = buildUsers(
    rows.profiles,
    rows.serviceAreas,
    rows.reviewRows,
    rows.taskRows,
    rows.currentUserId
  );
  const currentProfile = rows.profiles.find((profile) => profile.id === rows.currentUserId);

  if (!currentProfile) {
    throw new Error("Profile not found for current user");
  }

  const conversations = buildConversations(
    rows.conversationRows,
    rows.participantRows,
    rows.messageRows
  );
  const tasks = buildTasks(rows.taskRows, rows.taskTags, conversations);
  const reviews = buildReviews(rows.reviewRows);
  const currentAccount = buildCurrentAccount(currentProfile, serviceAreaMap, rows.reviewRows, rows.taskRows);

  return {
    currentAccount,
    categories: rows.categories,
    users,
    tasks,
    conversations,
    reviews,
    highlights: {
      openTasks: tasks.filter((task) => task.status === "open").length,
      activeTaskers: users.length,
      averageReply: "Live"
    }
  };
}

async function createConversationForTask(
  taskId: string,
  participantIds: string[],
  threadType: ConversationType,
  taskerId?: string | null
) {
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .insert({ task_id: taskId, thread_type: threadType, tasker_id: taskerId ?? null })
    .select("id, task_id, thread_type, tasker_id")
    .single();

  if (conversationError) throw conversationError;

  const uniqueIds = [...new Set(participantIds)];
  const { error: participantsError } = await supabase.from("conversation_participants").insert(
    uniqueIds.map((profileId) => ({
      conversation_id: conversation.id,
      profile_id: profileId
    }))
  );

  if (participantsError) throw participantsError;

  return conversation.id;
}

async function ensureConversationParticipant(conversationId: string, profileId: string) {
  const { data, error } = await supabase
    .from("conversation_participants")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  if (data) return;

  const { error: insertError } = await supabase.from("conversation_participants").insert({
    conversation_id: conversationId,
    profile_id: profileId
  });

  if (insertError) throw insertError;
}

export async function createTaskInSupabase(input: {
  title: string;
  description: string;
  categoryId: string;
  location: string;
  zipCode: string;
  budget: number;
  timeline: string;
  tags: string[];
}) {
  ensureSupabase();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Not authenticated");

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      posted_by: authData.user.id,
      category_id: input.categoryId,
      title: input.title,
      description: input.description,
      location: input.location,
      zip_code: input.zipCode,
      budget: input.budget,
      timeline: input.timeline
    })
    .select("id")
    .single();

  if (taskError) throw taskError;

  if (input.tags.length > 0) {
    const { error: tagsError } = await supabase.from("task_tags").insert(
      input.tags.map((label) => ({ task_id: task.id, label }))
    );
    if (tagsError) throw tagsError;
  }

  await createConversationForTask(task.id, [authData.user.id], "public", null);

  return {
    taskId: task.id,
    conversationId: null,
    marketplace: await fetchMarketplaceFromSupabase()
  };
}

export async function openConversationInSupabase(taskId: string, threadType: ConversationType = "private") {
  ensureSupabase();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Not authenticated");

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, posted_by, zip_code")
    .eq("id", taskId)
    .single();

  if (taskError) throw taskError;

  const myId = authData.user.id;

  if (threadType === "public") {
    const { data: publicConversation, error: publicConversationError } = await supabase
      .from("conversations")
      .select("id, task_id, thread_type, tasker_id")
      .eq("task_id", taskId)
      .eq("thread_type", "public")
      .maybeSingle();

    if (publicConversationError) throw publicConversationError;
    if (publicConversation) {
      await ensureConversationParticipant(publicConversation.id, myId);
      return {
        conversationId: publicConversation.id,
        marketplace: await fetchMarketplaceFromSupabase()
      };
    }

    const conversationId = await createConversationForTask(taskId, [task.posted_by, myId], "public", null);
    await ensureConversationParticipant(conversationId, myId);
    return {
      conversationId,
      marketplace: await fetchMarketplaceFromSupabase()
    };
  }

  if (task.posted_by === myId) {
    const { data: posterConversation, error: posterConversationError } = await supabase
      .from("conversations")
      .select("id, task_id, thread_type, tasker_id")
      .eq("task_id", taskId)
      .eq("thread_type", "private")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (posterConversationError) throw posterConversationError;
    if (!posterConversation) {
      throw new Error("No tasker has opened a private thread for this job yet.");
    }

    await ensureConversationParticipant(posterConversation.id, myId);
    return {
      conversationId: posterConversation.id,
      marketplace: await fetchMarketplaceFromSupabase()
    };
  }

  const { data: existingConversation, error: existingError } = await supabase
    .from("conversations")
    .select("id, task_id, thread_type, tasker_id")
    .eq("task_id", taskId)
    .eq("thread_type", "private")
    .eq("tasker_id", myId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existingConversation) {
    await ensureConversationParticipant(existingConversation.id, myId);
    await ensureConversationParticipant(existingConversation.id, task.posted_by);
    return {
      conversationId: existingConversation.id,
      marketplace: await fetchMarketplaceFromSupabase()
    };
  }

  const conversationId = await createConversationForTask(taskId, [myId, task.posted_by], "private", myId);

  return {
    conversationId,
    marketplace: await fetchMarketplaceFromSupabase()
  };
}

export async function sendMessageInSupabase(
  conversationId: string,
  input: { text: string; kind?: MessageKind; offerAmount?: number }
) {
  ensureSupabase();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Not authenticated");

  await ensureConversationParticipant(conversationId, authData.user.id);

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: authData.user.id,
    body: input.text,
    kind: input.kind ?? "message",
    offer_amount: input.offerAmount ?? null
  });

  if (error) throw error;

  return fetchMarketplaceFromSupabase();
}

export async function acceptLatestOfferInSupabase(conversationId: string) {
  ensureSupabase();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Not authenticated");

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("sender_id, offer_amount")
    .eq("conversation_id", conversationId)
    .not("offer_amount", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1);

  if (messagesError) throw messagesError;
  const latestOffer = messages?.[0];

  if (!latestOffer?.offer_amount || !latestOffer.sender_id) {
    throw new Error("No offer available");
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("task_id")
    .eq("id", conversationId)
    .single();

  if (conversationError) throw conversationError;

  const { error: updateError } = await supabase
    .from("tasks")
    .update({
      status: "assigned",
      assigned_to: latestOffer.sender_id,
      agreed_price: latestOffer.offer_amount
    })
    .eq("id", conversation.task_id);

  if (updateError) throw updateError;

  return fetchMarketplaceFromSupabase();
}

export async function completeTaskInSupabase(taskId: string) {
  ensureSupabase();

  const { error } = await supabase.from("tasks").update({ status: "completed" }).eq("id", taskId);
  if (error) throw error;

  return fetchMarketplaceFromSupabase();
}

export async function leaveReviewInSupabase(input: {
  taskId: string;
  revieweeId: string;
  role: RatingRole;
  rating: number;
  text: string;
}) {
  ensureSupabase();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Not authenticated");

  const { error } = await supabase.from("reviews").insert({
    task_id: input.taskId,
    reviewer_id: authData.user.id,
    reviewee_id: input.revieweeId,
    role: input.role,
    rating: input.rating,
    body: input.text
  });

  if (error) throw error;

  return fetchMarketplaceFromSupabase();
}

export async function fetchMarketplace(): Promise<MarketplacePayload> {
  if (!hasSupabaseEnv()) {
    return mockMarketplace;
  }

  return fetchMarketplaceFromSupabase();
}
