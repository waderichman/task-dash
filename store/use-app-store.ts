import AsyncStorage from "@react-native-async-storage/async-storage";
import { User } from "@supabase/supabase-js";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  acceptLatestOfferInSupabase,
  completeTaskInSupabase,
  createTaskInSupabase,
  deleteTaskInSupabase,
  fetchMarketplace,
  leaveReviewInSupabase,
  openConversationInSupabase,
  releaseFundsInSupabase,
  requestTaskCompletionInSupabase,
  sendMessageInSupabase
} from "@/lib/marketplace-service";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import {
  Conversation,
  CurrentAccount,
  LoadStatus,
  MarketplacePayload,
  MarketplaceUser,
  MessageKind,
  RatingRole,
  Review,
  Task,
  UserRole
} from "@/lib/types";

type CreateTaskInput = {
  title: string;
  description: string;
  location: string;
  zipCode: string;
  budget: number;
  timeline: string;
  tags: string[];
};

type UpdateProfileInput = {
  homeBase: string;
  zipCode: string;
  travelRadiusMiles: number;
  bio: string;
};

type LoginInput = {
  email: string;
  password: string;
  role: UserRole;
};

type SignUpInput = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  homeBase: string;
  zipCode: string;
  travelRadiusMiles: number;
  serviceZipCodes: string[];
  bio: string;
};

type PendingSignUp = SignUpInput & {
  email: string;
};

type StoredAccount = CurrentAccount & {
  email: string;
  password?: string;
};

type AppState = {
  activeRole: UserRole;
  hasBootstrapped: boolean;
  status: LoadStatus;
  error: string | null;
  isAuthenticated: boolean;
  currentAccountId: string | null;
  currentAccount: CurrentAccount | null;
  accounts: StoredAccount[];
  users: MarketplaceUser[];
  tasks: Task[];
  conversations: Conversation[];
  reviews: Review[];
  allTasks: Task[];
  allConversations: Conversation[];
  allReviews: Review[];
  highlights: MarketplacePayload["highlights"] | null;
  selectedConversationId: string | null;
  inboxNotice: string | null;
  pendingThreadTarget:
    | {
        taskId: string;
        threadType: "public" | "private";
      }
    | null;
  pendingSignUp: PendingSignUp | null;
  bootstrap: () => Promise<void>;
  refreshMarketplace: () => Promise<void>;
  hydrateAuthSession: () => Promise<void>;
  beginThreadOpen: (taskId: string, threadType: "public" | "private") => void;
  selectRole: (role: UserRole) => void;
  selectConversation: (conversationId: string) => void;
  login: (input: LoginInput) => Promise<boolean>;
  signUp: (input: SignUpInput) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<boolean>;
  createTask: (input: CreateTaskInput) => Promise<string | null>;
  deleteTask: (taskId: string) => Promise<void>;
  openPublicConversationForTask: (taskId: string) => Promise<string | null>;
  openConversationForTask: (taskId: string) => Promise<string | null>;
  sendMessage: (
    conversationId: string,
    text: string,
    options?: { kind?: MessageKind; offerAmount?: number }
  ) => Promise<void>;
  acceptLatestOffer: (conversationId: string) => Promise<void>;
  requestTaskCompletion: (taskId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  releaseFunds: (taskId: string) => Promise<void>;
  leaveReview: (
    taskId: string,
    revieweeId: string,
    role: RatingRole,
    rating: number,
    text: string
  ) => Promise<void>;
};

type SupabaseProfileRow = {
  id: string;
  full_name: string;
  email: string | null;
  bio: string | null;
  home_base: string | null;
  zip_code: string;
  travel_radius_miles: number | null;
  stripe_account_id: string | null;
  stripe_account_status: "not_started" | "pending" | "active" | null;
  active_role: UserRole | null;
};

const defaultRole: UserRole = "poster";

function normalizeZipCodes(values: string[]) {
  const unique = new Set(
    values
      .map((value) => value.trim())
      .filter((value) => /^\d{5}$/.test(value))
  );

  return [...unique];
}

function createEmptyAuthState() {
  return {
    isAuthenticated: false,
    currentAccountId: null,
    currentAccount: null,
    users: [],
    tasks: [],
    conversations: [],
    reviews: [],
    highlights: null,
    selectedConversationId: null,
    inboxNotice: null,
    pendingThreadTarget: null
  };
}

function upsertAccount(accounts: StoredAccount[], account: StoredAccount) {
  const index = accounts.findIndex((item) => item.id === account.id);

  if (index === -1) {
    return [...accounts, account];
  }

  return accounts.map((item) => (item.id === account.id ? account : item));
}

function toStoredAccount(profile: SupabaseProfileRow, serviceZipCodes: string[]): StoredAccount {
  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email ?? "",
    homeBase: profile.home_base ?? `ZIP ${profile.zip_code}`,
    zipCode: profile.zip_code,
    serviceZipCodes: normalizeZipCodes([profile.zip_code, ...serviceZipCodes]),
    travelRadiusMiles: profile.travel_radius_miles ?? 10,
    bio: profile.bio ?? "Workzy member",
    stripeAccountId: profile.stripe_account_id ?? undefined,
    stripeAccountStatus: profile.stripe_account_status ?? "not_started",
    posterStats: {
      tasksPosted: 0,
      hireRate: "0%",
      completedCount: 0,
      rating: { average: 0, count: 0 }
    },
    taskerStats: {
      jobsWon: 0,
      earningsLabel: "$0",
      completedCount: 0,
      rating: { average: 0, count: 0 }
    }
  };
}

async function resolveServiceAreaZipCodes(homeZip: string, extraZipCodes: string[], travelRadiusMiles: number) {
  const safeRadius = Number.isFinite(travelRadiusMiles)
    ? Math.max(0, Math.min(50, Math.round(travelRadiusMiles)))
    : 10;

  const { data, error } = await supabase.rpc("nearby_zip_codes", {
    origin_zip: homeZip,
    radius_miles: safeRadius
  });

  if (error) {
    return normalizeZipCodes([homeZip, ...extraZipCodes]);
  }

  return normalizeZipCodes([homeZip, ...extraZipCodes, ...((data ?? []) as { zip_code: string }[]).map((item) => String(item.zip_code))]);
}

async function fetchSupabaseAccount(user: User) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, bio, home_base, zip_code, travel_radius_miles, stripe_account_id, stripe_account_status, active_role")
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { data: serviceAreas, error: serviceAreasError } = await supabase
    .from("tasker_service_areas")
    .select("zip_code")
    .eq("profile_id", user.id);

  if (serviceAreasError) {
    throw new Error(serviceAreasError.message);
  }

  const profileRow = profile as SupabaseProfileRow;

  return {
    account: toStoredAccount(
      profileRow,
      (serviceAreas ?? []).map((item) => String(item.zip_code))
    ),
    role: (profileRow.active_role ?? defaultRole) as UserRole
  };
}

async function ensureSupabaseProfile(user: User, fallback?: PendingSignUp | null) {
  try {
    return await fetchSupabaseAccount(user);
  } catch (error) {
    if (!fallback || fallback.email.trim().toLowerCase() !== (user.email ?? "").trim().toLowerCase()) {
      throw error;
    }

    const zipCode = fallback.zipCode.trim();
    const serviceZipCodes = await resolveServiceAreaZipCodes(
      zipCode,
      fallback.serviceZipCodes,
      fallback.travelRadiusMiles
    );

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fallback.name.trim(),
      email: fallback.email.trim().toLowerCase(),
      bio: fallback.bio.trim() || "New Workzy member",
      home_base: fallback.homeBase.trim() || `ZIP ${zipCode}`,
      zip_code: zipCode,
      travel_radius_miles: fallback.travelRadiusMiles,
      active_role: fallback.role
    });

    if (profileError) {
      throw new Error(profileError.message);
    }

    const { error: deleteError } = await supabase
      .from("tasker_service_areas")
      .delete()
      .eq("profile_id", user.id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    const { error: serviceAreaError } = await supabase.from("tasker_service_areas").insert(
      serviceZipCodes.map((value) => ({
        profile_id: user.id,
        zip_code: value
      }))
    );

    if (serviceAreaError) {
      throw new Error(serviceAreaError.message);
    }

    return fetchSupabaseAccount(user);
  }
}

function createInitialState() {
  return {
    activeRole: defaultRole,
    hasBootstrapped: false,
    status: "idle" as LoadStatus,
    error: null,
    ...createEmptyAuthState(),
    accounts: [],
    allTasks: [],
    allConversations: [],
    allReviews: [],
    pendingThreadTarget: null,
    pendingSignUp: null
  };
}

function applyMarketplacePayload(
  payload: MarketplacePayload,
  activeRole: UserRole,
  selectedConversationId: string | null
) {
  const visibleTasks =
    activeRole === "poster"
      ? payload.tasks.filter((task) => task.postedBy === payload.currentAccount.id || task.assignedTo === payload.currentAccount.id)
      : payload.tasks.filter(
          (task) =>
            task.postedBy === payload.currentAccount.id ||
            task.assignedTo === payload.currentAccount.id ||
            payload.currentAccount.serviceZipCodes.includes(task.zipCode) ||
            payload.currentAccount.zipCode === task.zipCode
        );

  const visibleTaskIds = new Set(visibleTasks.map((task) => task.id));
  const visibleUsers =
    activeRole === "poster"
      ? payload.users.filter((user) => user.serviceZipCodes.includes(payload.currentAccount.zipCode))
      : payload.users;
  const visibleConversations = payload.conversations.filter((conversation) =>
    visibleTaskIds.has(conversation.taskId)
  );

  return {
    currentAccountId: payload.currentAccount.id,
    currentAccount: payload.currentAccount,
    users: visibleUsers,
    tasks: visibleTasks,
    conversations: visibleConversations,
    reviews: payload.reviews,
    allTasks: payload.tasks,
    allConversations: payload.conversations,
    allReviews: payload.reviews,
    highlights: payload.highlights,
    isAuthenticated: true,
    selectedConversationId:
      selectedConversationId &&
      visibleConversations.some((item) => item.id === selectedConversationId)
        ? selectedConversationId
        : visibleConversations[0]?.id ?? null,
    inboxNotice: null
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...createInitialState(),
      bootstrap: async () => {
        if (get().hasBootstrapped) {
          return;
        }

        set({ status: "loading" });
        await get().hydrateAuthSession();
        set({ hasBootstrapped: true });
      },
      beginThreadOpen: (taskId, threadType) =>
        set({
          pendingThreadTarget: { taskId, threadType },
          error: null,
          inboxNotice: null
        }),
      hydrateAuthSession: async () => {
        if (!hasSupabaseEnv()) {
          set({
            ...createEmptyAuthState(),
            status: "error",
            error: "Missing Supabase environment variables."
          });
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) {
          set({
            ...createEmptyAuthState(),
            status: "error",
            error: error.message
          });
          return;
        }

        const sessionUser = data.session?.user;
        if (!sessionUser) {
          set({
            ...createEmptyAuthState(),
            status: "success",
            error: null
          });
          return;
        }

        try {
          const { account, role } = await ensureSupabaseProfile(sessionUser, get().pendingSignUp);
          const accounts = upsertAccount(get().accounts, account);
          const payload = await fetchMarketplace();

          set({
            accounts,
            activeRole: role,
            ...applyMarketplacePayload(payload, role, get().selectedConversationId),
            pendingSignUp: null,
            status: "success",
            error: null
          });
        } catch (syncError) {
          console.error("Workzy hydrateAuthSession failed", syncError);
          set({
            ...createEmptyAuthState(),
            status: "error",
            error:
              syncError instanceof Error
                ? `Unable to load account: ${syncError.message}`
                : "Unable to load account"
          });
        }
      },
      refreshMarketplace: async () => {
        if (!get().isAuthenticated) {
          return;
        }

        try {
          const payload = await fetchMarketplace();
          set({
            ...applyMarketplacePayload(payload, get().activeRole, get().selectedConversationId),
            status: "success",
            error: null,
            pendingThreadTarget: null
          });
        } catch (error) {
          set({
            status: "error",
            error: error instanceof Error ? error.message : "Unable to load marketplace"
          });
        }
      },
      selectRole: (role) => {
        const state = get();
        set({
          activeRole: role,
          error: null
        });

        if (state.currentAccountId) {
          void (async () => {
            await supabase.from("profiles").update({ active_role: role }).eq("id", state.currentAccountId);
            try {
              const payload = await fetchMarketplace();
              set({
                activeRole: role,
                ...applyMarketplacePayload(payload, role, get().selectedConversationId),
                status: "success",
                error: null,
                pendingThreadTarget: null
              });
            } catch (error) {
              set({
                status: "error",
                error: error instanceof Error ? error.message : "Unable to refresh marketplace"
              });
            }
          })();
        }
      },
      selectConversation: (conversationId) =>
        set({ selectedConversationId: conversationId, pendingThreadTarget: null, inboxNotice: null }),
      login: async ({ email, password, role }) => {
        set({ status: "loading", error: null });

        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password
        });

        if (error) {
          set({ status: "error", error: error.message });
          return false;
        }

        try {
          const { account } = await ensureSupabaseProfile(data.user, get().pendingSignUp);
          const accounts = upsertAccount(get().accounts, account);
          const payload = await fetchMarketplace();

          await supabase.from("profiles").update({ active_role: role }).eq("id", account.id);

          set({
            accounts,
            activeRole: role,
            ...applyMarketplacePayload(payload, role, get().selectedConversationId),
            pendingSignUp: null,
            status: "success",
            error: null,
            pendingThreadTarget: null
          });

          return true;
        } catch (syncError) {
          console.error("Workzy login failed after auth", syncError);
          set({
            status: "error",
            error:
              syncError instanceof Error
                ? `Unable to load account: ${syncError.message}`
                : "Unable to load account"
          });
          return false;
        }
      },
      signUp: async (input) => {
        const normalizedEmail = input.email.trim().toLowerCase();
        const zipCode = input.zipCode.trim();
        const safeTravelRadius = Math.max(0, Math.min(50, Math.round(input.travelRadiusMiles || 10)));

        if (!input.name.trim() || !normalizedEmail || !input.password.trim()) {
          set({ status: "error", error: "Name, email, and password are required." });
          return false;
        }

        if (!/^\d{5}$/.test(zipCode)) {
          set({ status: "error", error: "Use a valid 5-digit ZIP code." });
          return false;
        }

        set({ status: "loading", error: null });

        const pendingSignUp: PendingSignUp = {
          ...input,
          travelRadiusMiles: safeTravelRadius,
          email: normalizedEmail
        };
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password: input.password,
          options: {
            emailRedirectTo: "workzy://confirm",
            data: {
              full_name: input.name.trim()
            }
          }
        });

        if (error) {
          set({ status: "error", error: error.message });
          return false;
        }

        if (!data.user) {
          set({ status: "error", error: "Unable to create your account." });
          return false;
        }

        const authUser = data.user;

        if (!data.session) {
          set({
            status: "success",
            error: "Account created. Confirm your email, then sign in.",
            pendingSignUp
          });
          return false;
        }

        const { error: profileError } = await supabase.from("profiles").upsert({
          id: data.user.id,
          full_name: input.name.trim(),
          email: normalizedEmail,
          bio: input.bio.trim() || "New Workzy member",
          home_base: input.homeBase.trim() || `ZIP ${zipCode}`,
          zip_code: zipCode,
          travel_radius_miles: safeTravelRadius,
          active_role: input.role
        });

        if (profileError) {
          set({ status: "error", error: profileError.message });
          return false;
        }

        const { error: deleteError } = await supabase
          .from("tasker_service_areas")
          .delete()
          .eq("profile_id", authUser.id);

        if (deleteError) {
          set({ status: "error", error: deleteError.message });
          return false;
        }

        const serviceZipCodes = await resolveServiceAreaZipCodes(
          zipCode,
          input.serviceZipCodes,
          safeTravelRadius
        );

        const { error: serviceAreaError } = await supabase.from("tasker_service_areas").insert(
          serviceZipCodes.map((value) => ({
            profile_id: authUser.id,
            zip_code: value
          }))
        );

        if (serviceAreaError) {
          set({ status: "error", error: serviceAreaError.message });
          return false;
        }

        try {
          const { account } = await ensureSupabaseProfile(authUser, pendingSignUp);
          const accounts = upsertAccount(get().accounts, account);
          const payload = await fetchMarketplace();

          set({
            accounts,
            activeRole: input.role,
            ...applyMarketplacePayload(payload, input.role, get().selectedConversationId),
            pendingSignUp: null,
            status: "success",
            error: null
          });

          return true;
        } catch (syncError) {
          console.error("Workzy signup failed after auth", syncError);
          set({
            status: "error",
            error:
              syncError instanceof Error
                ? `Unable to load account: ${syncError.message}`
                : "Unable to load account"
          });
          return false;
        }
      },
      logout: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          set({ error: error.message });
          return;
        }

        set({
          activeRole: defaultRole,
          status: "success",
          error: null,
          ...createEmptyAuthState()
        });
      },
      updateProfile: async (input) => {
        const currentAccount = get().currentAccount;
        if (!currentAccount) {
          set({ status: "error", error: "Log in before updating your profile." });
          return false;
        }

        const zipCode = input.zipCode.trim();
        const safeTravelRadius = Math.max(0, Math.min(50, Math.round(input.travelRadiusMiles || 0)));

        if (!/^\d{5}$/.test(zipCode)) {
          set({ status: "error", error: "Use a valid 5-digit ZIP code." });
          return false;
        }

        set({ status: "loading", error: null });

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
          set({ status: "error", error: authError.message });
          return false;
        }

        if (!authData.user) {
          set({ status: "error", error: "Not authenticated." });
          return false;
        }

        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            home_base: input.homeBase.trim() || `ZIP ${zipCode}`,
            zip_code: zipCode,
            travel_radius_miles: safeTravelRadius,
            bio: input.bio.trim() || "Workzy member"
          })
          .eq("id", authData.user.id);

        if (profileError) {
          set({ status: "error", error: profileError.message });
          return false;
        }

        const serviceZipCodes = await resolveServiceAreaZipCodes(zipCode, [], safeTravelRadius);

        const { error: deleteError } = await supabase
          .from("tasker_service_areas")
          .delete()
          .eq("profile_id", authData.user.id);

        if (deleteError) {
          set({ status: "error", error: deleteError.message });
          return false;
        }

        const { error: serviceAreaError } = await supabase.from("tasker_service_areas").insert(
          serviceZipCodes.map((value) => ({
            profile_id: authData.user.id,
            zip_code: value
          }))
        );

        if (serviceAreaError) {
          set({ status: "error", error: serviceAreaError.message });
          return false;
        }

        try {
          const { account } = await fetchSupabaseAccount(authData.user);
          const accounts = upsertAccount(get().accounts, account);
          const payload = await fetchMarketplace();

          set({
            accounts,
            ...applyMarketplacePayload(payload, get().activeRole, get().selectedConversationId),
            status: "success",
            error: null,
            pendingThreadTarget: null
          });

          return true;
        } catch (syncError) {
          set({
            status: "error",
            error:
              syncError instanceof Error
                ? `Unable to refresh account: ${syncError.message}`
                : "Unable to refresh account"
          });
          return false;
        }
      },
      createTask: async (input) => {
        const currentAccount = get().currentAccount;
        if (!currentAccount) {
          set({ error: "Log in before posting a task." });
          return null;
        }

        if (!/^\d{5}$/.test(input.zipCode)) {
          set({ error: "A valid 5-digit ZIP code is required." });
          return null;
        }

        try {
          const result = await createTaskInSupabase(input);
          set({
            ...applyMarketplacePayload(
              result.marketplace,
              get().activeRole,
              result.conversationId ?? get().selectedConversationId
            ),
            status: "success",
            error: null,
            pendingThreadTarget: null
          });
          return result.taskId;
        } catch (error) {
          set({
            status: "error",
            error: error instanceof Error ? error.message : "Unable to create task"
          });
          return null;
        }
      },
      deleteTask: async (taskId) => {
        try {
          const payload = await deleteTaskInSupabase(taskId);
          set({
            ...applyMarketplacePayload(payload, get().activeRole, get().selectedConversationId),
            status: "success",
            error: null,
            pendingThreadTarget: null
          });
        } catch (error) {
          set({
            status: "error",
            error: error instanceof Error ? error.message : "Unable to remove job"
          });
        }
      },
      openPublicConversationForTask: async (taskId) => {
        set({ status: "loading", error: null });
        try {
          const result = await openConversationInSupabase(taskId, "public");
          set({
            ...applyMarketplacePayload(result.marketplace, get().activeRole, result.conversationId),
            status: "success",
            error: null,
            pendingThreadTarget: null
          });
          return result.conversationId;
        } catch (error) {
          set({
            status: "error",
            error: error instanceof Error ? error.message : "Unable to open public thread",
            pendingThreadTarget: null
          });
          return null;
        }
      },
      openConversationForTask: async (taskId) => {
        set({ status: "loading", error: null });
        try {
          const result = await openConversationInSupabase(taskId, "private");
          set({
            ...applyMarketplacePayload(
              result.marketplace,
              get().activeRole,
              result.conversationId
            ),
            status: "success",
            error: null,
            pendingThreadTarget: null
          });
          return result.conversationId;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to open conversation";
          if (message === "No tasker has opened a private thread for this job yet.") {
            set({
              status: "success",
              error: null,
              inboxNotice: message,
              pendingThreadTarget: null,
              selectedConversationId: null
            });
            return null;
          }

          set({
            status: "error",
            error: message,
            pendingThreadTarget: null
          });
          return null;
        }
      },
      sendMessage: async (conversationId, text, options) => {
        if (!get().currentAccount) {
          set({ error: "Log in before messaging." });
          return;
        }

        try {
          const payload = await sendMessageInSupabase(conversationId, {
            text,
            kind: options?.kind,
            offerAmount: options?.offerAmount
          });
          set({
            ...applyMarketplacePayload(payload, get().activeRole, conversationId),
            status: "success",
            error: null,
            pendingThreadTarget: null
          });
        } catch (error) {
          set({
            status: "error",
            error: error instanceof Error ? error.message : "Unable to send message"
          });
        }
      },
      acceptLatestOffer: async (conversationId) => {
        try {
          const payload = await acceptLatestOfferInSupabase(conversationId);
          set({
            ...applyMarketplacePayload(payload, get().activeRole, conversationId),
            status: "success",
            error: null,
            pendingThreadTarget: null
          });
        } catch (error) {
          set({
            status: "error",
            error: error instanceof Error ? error.message : "Unable to accept offer"
          });
        }
      },
      requestTaskCompletion: async (taskId) => {
        try {
          const payload = await requestTaskCompletionInSupabase(taskId);
          set({
            ...applyMarketplacePayload(payload, get().activeRole, get().selectedConversationId),
            status: "success",
            error: null,
            pendingThreadTarget: null
          });
        } catch (error) {
          set({
            status: "error",
            error: error instanceof Error ? error.message : "Unable to request completion"
          });
        }
      },
      completeTask: async (taskId) => {
        try {
          const payload = await completeTaskInSupabase(taskId);
          set({
            ...applyMarketplacePayload(payload, get().activeRole, get().selectedConversationId),
            status: "success",
            error: null,
            pendingThreadTarget: null
          });
        } catch (error) {
          set({
            status: "error",
            error: error instanceof Error ? error.message : "Unable to complete task"
          });
        }
      },
      releaseFunds: async (taskId) => {
        try {
          const payload = await releaseFundsInSupabase(taskId);
          set({
            ...applyMarketplacePayload(payload, get().activeRole, get().selectedConversationId),
            status: "success",
            error: null,
            pendingThreadTarget: null
          });
        } catch (error) {
          set({
            status: "error",
            error: error instanceof Error ? error.message : "Unable to release funds"
          });
        }
      },
      leaveReview: async (taskId, revieweeId, role, rating, text) => {
        try {
          const payload = await leaveReviewInSupabase({
            taskId,
            revieweeId,
            role,
            rating,
            text
          });
          set({
            ...applyMarketplacePayload(payload, get().activeRole, get().selectedConversationId),
            status: "success",
            error: null,
            pendingThreadTarget: null
          });
        } catch (error) {
          set({
            status: "error",
            error: error instanceof Error ? error.message : "Unable to leave review"
          });
        }
      }
    }),
    {
      name: "workzy-store",
      version: 8,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persistedState, version) => {
        if (!persistedState || typeof persistedState !== "object" || version < 8) {
          return createInitialState();
        }

        return persistedState as AppState;
      },
      partialize: (state) => ({
        activeRole: state.activeRole,
        currentAccountId: state.currentAccountId,
        accounts: state.accounts,
        allTasks: state.allTasks,
        allConversations: state.allConversations,
        allReviews: state.allReviews,
        selectedConversationId: state.selectedConversationId,
        pendingSignUp: state.pendingSignUp
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<AppState>)
      })
    }
  )
);
