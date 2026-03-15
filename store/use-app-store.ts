import AsyncStorage from "@react-native-async-storage/async-storage";
import { User } from "@supabase/supabase-js";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  acceptLatestOfferInSupabase,
  completeTaskInSupabase,
  createTaskInSupabase,
  fetchMarketplace,
  leaveReviewInSupabase,
  openConversationInSupabase,
  sendMessageInSupabase
} from "@/lib/marketplace-service";
import { mockMarketplace } from "@/lib/mock-marketplace";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import {
  Category,
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
  categoryId: string;
  location: string;
  zipCode: string;
  budget: number;
  timeline: string;
  tags: string[];
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
  categories: Category[];
  users: MarketplaceUser[];
  tasks: Task[];
  conversations: Conversation[];
  reviews: Review[];
  allTasks: Task[];
  allConversations: Conversation[];
  allReviews: Review[];
  highlights: MarketplacePayload["highlights"] | null;
  selectedConversationId: string | null;
  selectedCategoryId: string | null;
  pendingSignUp: PendingSignUp | null;
  bootstrap: () => Promise<void>;
  refreshMarketplace: () => Promise<void>;
  hydrateAuthSession: () => Promise<void>;
  selectRole: (role: UserRole) => void;
  selectConversation: (conversationId: string) => void;
  selectCategory: (categoryId: string | null) => void;
  login: (input: LoginInput) => Promise<boolean>;
  signUp: (input: SignUpInput) => Promise<boolean>;
  logout: () => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<string | null>;
  openPublicConversationForTask: (taskId: string) => Promise<string | null>;
  openConversationForTask: (taskId: string) => Promise<string | null>;
  sendMessage: (
    conversationId: string,
    text: string,
    options?: { kind?: MessageKind; offerAmount?: number }
  ) => Promise<void>;
  acceptLatestOffer: (conversationId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
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
  active_role: UserRole | null;
};

const defaultRole: UserRole = "poster";
const DEMO_PASSWORD = "taskdash123";

const initialAccounts: StoredAccount[] = [
  {
    ...mockMarketplace.currentAccount,
    email: "irene@taskdash.app",
    password: DEMO_PASSWORD
  },
  {
    id: "u1",
    name: "Maya Chen",
    email: "maya@taskdash.app",
    password: DEMO_PASSWORD,
    homeBase: "Venice, CA",
    zipCode: "90291",
    serviceZipCodes: ["90291", "90292", "90401", "90403"],
    bio: "5-star mover and furniture assembler with fast replies and careful handling.",
    posterStats: {
      tasksPosted: 14,
      hireRate: "94%",
      completedCount: 12,
      rating: { average: 4.8, count: 18 }
    },
    taskerStats: {
      jobsWon: 126,
      earningsLabel: "$18.4k",
      completedCount: 126,
      rating: { average: 4.9, count: 126 }
    }
  },
  {
    id: "u2",
    name: "Jordan Tate",
    email: "jordan@taskdash.app",
    password: DEMO_PASSWORD,
    homeBase: "Marina del Rey, CA",
    zipCode: "90292",
    serviceZipCodes: ["90292", "90291", "90401", "90066"],
    bio: "Deep-clean specialist for apartments and turnovers who keeps jobs tight and reliable.",
    posterStats: {
      tasksPosted: 21,
      hireRate: "91%",
      completedCount: 18,
      rating: { average: 4.7, count: 11 }
    },
    taskerStats: {
      jobsWon: 89,
      earningsLabel: "$11.2k",
      completedCount: 89,
      rating: { average: 4.8, count: 89 }
    }
  },
  {
    id: "u3",
    name: "Elena Ruiz",
    email: "elena@taskdash.app",
    password: DEMO_PASSWORD,
    homeBase: "Culver City, CA",
    zipCode: "90066",
    serviceZipCodes: ["90066", "90404", "90403", "90230"],
    bio: "Handyman for mounting, patching, and small repairs with a precise finish.",
    posterStats: {
      tasksPosted: 10,
      hireRate: "96%",
      completedCount: 9,
      rating: { average: 4.9, count: 9 }
    },
    taskerStats: {
      jobsWon: 141,
      earningsLabel: "$22.1k",
      completedCount: 141,
      rating: { average: 4.9, count: 141 }
    }
  }
];

const initialCategories = mockMarketplace.categories.map((category) => ({ ...category }));
const initialTasks = mockMarketplace.tasks.map((task) => ({ ...task, tags: [...task.tags] }));
const initialConversations = mockMarketplace.conversations.map((conversation) => ({
  ...conversation,
  participantIds: [...conversation.participantIds],
  messages: conversation.messages.map((message) => ({ ...message }))
}));
const initialReviews = mockMarketplace.reviews.map((review) => ({ ...review }));

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function cloneAccounts(accounts: StoredAccount[]) {
  return accounts.map((account) => ({
    ...account,
    serviceZipCodes: [...account.serviceZipCodes],
    posterStats: {
      ...account.posterStats,
      rating: { ...account.posterStats.rating }
    },
    taskerStats: {
      ...account.taskerStats,
      rating: { ...account.taskerStats.rating }
    }
  }));
}

function normalizeZipCodes(values: string[]) {
  const unique = new Set(
    values
      .map((value) => value.trim())
      .filter((value) => /^\d{5}$/.test(value))
  );

  return [...unique];
}

function toMarketplaceUser(account: StoredAccount): MarketplaceUser {
  return {
    id: account.id,
    name: account.name,
    tagline: account.bio,
    taskerRating: { ...account.taskerStats.rating },
    posterRating: { ...account.posterStats.rating },
    jobsCompleted: account.taskerStats.completedCount,
    tasksPosted: account.posterStats.tasksPosted,
    responseTime: "Replies in 10 min",
    avatarColor: "#d8f6df",
    zipCode: account.zipCode,
    serviceZipCodes: [...account.serviceZipCodes]
  };
}

function getCurrentAccount(accounts: StoredAccount[], currentAccountId: string | null) {
  if (!currentAccountId) {
    return null;
  }

  return accounts.find((account) => account.id === currentAccountId) ?? null;
}

function buildVisibleUsers(accounts: StoredAccount[], account: StoredAccount, activeRole: UserRole) {
  const everyoneElse = accounts.filter((item) => item.id !== account.id).map(toMarketplaceUser);

  if (activeRole === "poster") {
    return everyoneElse.filter((user) => user.serviceZipCodes.includes(account.zipCode));
  }

  return everyoneElse;
}

function getVisibleTasks(allTasks: Task[], account: StoredAccount, activeRole: UserRole) {
  const allowedZipCodes = new Set([account.zipCode, ...account.serviceZipCodes]);

  return allTasks.filter((task) => {
    if (task.postedBy === account.id || task.assignedTo === account.id) {
      return true;
    }

    if (activeRole === "poster") {
      return task.postedBy === account.id;
    }

    return allowedZipCodes.has(task.zipCode);
  });
}

function buildHighlights(tasks: Task[], users: MarketplaceUser[]) {
  return {
    openTasks: tasks.filter((task) => task.status === "open").length,
    activeTaskers: users.length,
    averageReply: "10 min"
  };
}

function buildDerivedState(
  accounts: StoredAccount[],
  currentAccountId: string | null,
  activeRole: UserRole,
  allTasks: Task[],
  allConversations: Conversation[],
  allReviews: Review[],
  selectedConversationId: string | null
) {
  const currentAccount = getCurrentAccount(accounts, currentAccountId);

  if (!currentAccount) {
    return {
      isAuthenticated: false,
      currentAccountId: null,
      currentAccount: null,
      users: [],
      tasks: [],
      conversations: [],
      reviews: allReviews,
      highlights: null,
      selectedConversationId: null
    };
  }

  const tasks = getVisibleTasks(allTasks, currentAccount, activeRole);
  const visibleTaskIds = new Set(tasks.map((task) => task.id));
  const conversations = allConversations.filter(
    (conversation) =>
      visibleTaskIds.has(conversation.taskId) &&
      ((conversation.threadType ?? "private") === "public"
        ? true
        : conversation.participantIds.includes(currentAccount.id))
  );
  const users = buildVisibleUsers(accounts, currentAccount, activeRole);

  return {
    isAuthenticated: true,
    currentAccountId: currentAccount.id,
    currentAccount,
    users,
    tasks,
    conversations,
    reviews: allReviews,
    highlights: buildHighlights(tasks, users),
    selectedConversationId:
      selectedConversationId && conversations.some((item) => item.id === selectedConversationId)
        ? selectedConversationId
        : conversations[0]?.id ?? null
  };
}

function createEmptyAuthState(allReviews: Review[]) {
  return {
    isAuthenticated: false,
    currentAccountId: null,
    currentAccount: null,
    users: [],
    tasks: [],
    conversations: [],
    reviews: allReviews,
    highlights: null,
    selectedConversationId: null
  };
}

function updateAccount(
  accounts: StoredAccount[],
  accountId: string,
  updater: (account: StoredAccount) => StoredAccount
) {
  return accounts.map((account) => (account.id === accountId ? updater(account) : account));
}

function upsertAccount(accounts: StoredAccount[], account: StoredAccount) {
  const index = accounts.findIndex((item) => item.id === account.id);

  if (index === -1) {
    return [...accounts, account];
  }

  return accounts.map((item) => (item.id === account.id ? account : item));
}

function updateRatingSummary(summary: CurrentAccount["posterStats"]["rating"], rating: number) {
  const total = summary.average * summary.count + rating;
  const count = summary.count + 1;

  return {
    average: Number((total / count).toFixed(1)),
    count
  };
}

function systemMessage(text: string) {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    senderId: "system",
    text,
    sentAt: nowLabel(),
    kind: "system" as const
  };
}

function toStoredAccount(profile: SupabaseProfileRow, serviceZipCodes: string[]): StoredAccount {
  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email ?? "",
    homeBase: profile.home_base ?? `ZIP ${profile.zip_code}`,
    zipCode: profile.zip_code,
    serviceZipCodes: normalizeZipCodes([profile.zip_code, ...serviceZipCodes]),
    bio: profile.bio ?? "TaskDash member",
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

async function fetchSupabaseAccount(user: User) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, bio, home_base, zip_code, active_role")
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
    const serviceZipCodes = normalizeZipCodes([zipCode, ...fallback.serviceZipCodes]);

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fallback.name.trim(),
      email: fallback.email.trim().toLowerCase(),
      bio: fallback.bio.trim() || "New TaskDash member",
      home_base: fallback.homeBase.trim() || `ZIP ${zipCode}`,
      zip_code: zipCode,
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
    ...createEmptyAuthState(initialReviews),
    accounts: cloneAccounts(initialAccounts),
    categories: initialCategories,
    allTasks: initialTasks,
    allConversations: initialConversations,
    allReviews: initialReviews,
    selectedCategoryId: null,
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
    categories: payload.categories,
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
        : visibleConversations[0]?.id ?? null
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
      hydrateAuthSession: async () => {
        if (!hasSupabaseEnv()) {
          set({ status: "success", error: null });
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) {
          set({
            ...createEmptyAuthState(get().allReviews),
            status: "error",
            error: error.message
          });
          return;
        }

        const sessionUser = data.session?.user;
        if (!sessionUser) {
          set({
            ...createEmptyAuthState(get().allReviews),
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
          console.error("TaskDash hydrateAuthSession failed", syncError);
          set({
            ...createEmptyAuthState(get().allReviews),
            status: "error",
            error:
              syncError instanceof Error
                ? `Unable to load account: ${syncError.message}`
                : "Unable to load account"
          });
        }
      },
      refreshMarketplace: async () => {
        if (hasSupabaseEnv() && get().isAuthenticated) {
          try {
            const payload = await fetchMarketplace();
            set({
              ...applyMarketplacePayload(payload, get().activeRole, get().selectedConversationId),
              status: "success",
              error: null
            });
            return;
          } catch (error) {
            set({
              status: "error",
              error: error instanceof Error ? error.message : "Unable to load marketplace"
            });
            return;
          }
        }

        const state = get();
        const derived = buildDerivedState(
          state.accounts,
          state.currentAccountId,
          state.activeRole,
          state.allTasks,
          state.allConversations,
          state.allReviews,
          state.selectedConversationId
        );

        set({
          categories: initialCategories,
          ...derived,
          status: "success",
          error: null
        });
      },
      selectRole: (role) => {
        const state = get();
        const derived = buildDerivedState(
          state.accounts,
          state.currentAccountId,
          role,
          state.allTasks,
          state.allConversations,
          state.allReviews,
          state.selectedConversationId
        );

        set({
          activeRole: role,
          ...derived,
          error: null
        });

        if (hasSupabaseEnv() && state.currentAccountId) {
          void (async () => {
            await supabase.from("profiles").update({ active_role: role }).eq("id", state.currentAccountId);
            try {
              const payload = await fetchMarketplace();
              set({
                activeRole: role,
                ...applyMarketplacePayload(payload, role, get().selectedConversationId),
                status: "success",
                error: null
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
      selectConversation: (conversationId) => set({ selectedConversationId: conversationId }),
      selectCategory: (categoryId) => set({ selectedCategoryId: categoryId }),
      login: async ({ email, password, role }) => {
        set({ status: "loading", error: null });

        if (hasSupabaseEnv()) {
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
              error: null
            });

            return true;
          } catch (syncError) {
            console.error("TaskDash login failed after auth", syncError);
            set({
              status: "error",
              error:
                syncError instanceof Error
                  ? `Unable to load account: ${syncError.message}`
                  : "Unable to load account"
            });
            return false;
          }
        }

        const account = get().accounts.find(
          (item) => item.email.toLowerCase() === email.trim().toLowerCase()
        );

        if (!account || account.password !== password) {
          set({
            status: "error",
            error: "That email and password do not match an account."
          });
          return false;
        }

        const derived = buildDerivedState(
          get().accounts,
          account.id,
          role,
          get().allTasks,
          get().allConversations,
          get().allReviews,
          get().selectedConversationId
        );

        set({
          activeRole: role,
          ...derived,
          status: "success",
          error: null
        });

        return true;
      },
      signUp: async (input) => {
        const normalizedEmail = input.email.trim().toLowerCase();
        const zipCode = input.zipCode.trim();
        const serviceZipCodes = normalizeZipCodes([zipCode, ...input.serviceZipCodes]);

        if (!input.name.trim() || !normalizedEmail || !input.password.trim()) {
          set({ status: "error", error: "Name, email, and password are required." });
          return false;
        }

        if (!/^\d{5}$/.test(zipCode)) {
          set({ status: "error", error: "Use a valid 5-digit ZIP code." });
          return false;
        }

        set({ status: "loading", error: null });

        if (hasSupabaseEnv()) {
          const pendingSignUp: PendingSignUp = {
            ...input,
            email: normalizedEmail
          };
          const { data, error } = await supabase.auth.signUp({
            email: normalizedEmail,
            password: input.password,
            options: {
              emailRedirectTo: "taskdash://confirm",
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
            bio: input.bio.trim() || "New TaskDash member",
            home_base: input.homeBase.trim() || `ZIP ${zipCode}`,
            zip_code: zipCode,
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
            console.error("TaskDash signup failed after auth", syncError);
            set({
              status: "error",
              error:
                syncError instanceof Error
                  ? `Unable to load account: ${syncError.message}`
                  : "Unable to load account"
            });
            return false;
          }
        }

        if (get().accounts.some((account) => account.email.toLowerCase() === normalizedEmail)) {
          set({ status: "error", error: "That email is already registered." });
          return false;
        }

        const account: StoredAccount = {
          id: `acct-${Date.now()}`,
          name: input.name.trim(),
          email: normalizedEmail,
          password: input.password,
          homeBase: input.homeBase.trim() || `ZIP ${zipCode}`,
          zipCode,
          serviceZipCodes,
          bio: input.bio.trim() || "New TaskDash member",
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

        const accounts = [...get().accounts, account];
        const derived = buildDerivedState(
          accounts,
          account.id,
          input.role,
          get().allTasks,
          get().allConversations,
          get().allReviews,
          get().selectedConversationId
        );

        set({
          accounts,
          activeRole: input.role,
          ...derived,
          status: "success",
          error: null
        });

        return true;
      },
      logout: async () => {
        if (hasSupabaseEnv()) {
          const { error } = await supabase.auth.signOut();
          if (error) {
            set({ error: error.message });
            return;
          }
        }

        set({
          activeRole: defaultRole,
          status: "success",
          error: null,
          selectedCategoryId: null,
          ...createEmptyAuthState(get().allReviews)
        });
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

        if (hasSupabaseEnv()) {
          try {
            const result = await createTaskInSupabase(input);
            set({
              ...applyMarketplacePayload(
                result.marketplace,
                get().activeRole,
                result.conversationId ?? get().selectedConversationId
              ),
              status: "success",
              error: null
            });
            return result.taskId;
          } catch (error) {
            set({
              status: "error",
              error: error instanceof Error ? error.message : "Unable to create task"
            });
            return null;
          }
        }

        const task: Task = {
          id: `task-${Date.now()}`,
          title: input.title,
          description: input.description,
          categoryId: input.categoryId,
          location: input.location,
          zipCode: input.zipCode,
          distanceLabel: "Just posted",
          budget: input.budget,
          timeline: input.timeline,
          status: "open",
          postedAt: "now",
          postedBy: currentAccount.id,
          offers: 0,
          questions: 0,
          tags: input.tags
        };

        const accounts = updateAccount(get().accounts, currentAccount.id, (account) => ({
          ...account,
          posterStats: {
            ...account.posterStats,
            tasksPosted: account.posterStats.tasksPosted + 1
          }
        }));

        const allTasks = [task, ...get().allTasks];
        const publicConversation: Conversation = {
          id: `conv-${Date.now()}-public`,
          taskId: task.id,
          threadType: "public",
          participantIds: [currentAccount.id],
          messages: [systemMessage("Public job thread opened.")]
        };
        const allConversations = [publicConversation, ...get().allConversations];

        const derived = buildDerivedState(
          accounts,
          currentAccount.id,
          get().activeRole,
          allTasks,
          allConversations,
          get().allReviews,
          publicConversation.id
        );

        set({
          accounts,
          allTasks,
          allConversations,
          ...derived,
          error: null
        });

        return task.id;
      },
      openPublicConversationForTask: async (taskId) => {
        if (hasSupabaseEnv()) {
          try {
            const result = await openConversationInSupabase(taskId, "public");
            set({
              ...applyMarketplacePayload(result.marketplace, get().activeRole, result.conversationId),
              status: "success",
              error: null
            });
            return result.conversationId;
          } catch (error) {
            set({
              status: "error",
              error: error instanceof Error ? error.message : "Unable to open public thread"
            });
            return null;
          }
        }

        const state = get();
        const currentAccount = state.currentAccount;
        const task = state.allTasks.find((item) => item.id === taskId);

        if (!currentAccount || !task) {
          set({ error: "Task not found." });
          return null;
        }

        const existing = state.allConversations.find(
          (conversation) => conversation.taskId === taskId && (conversation.threadType ?? "private") === "public"
        );

        if (existing) {
          const allConversations = state.allConversations.map((conversation) =>
            conversation.id === existing.id && !conversation.participantIds.includes(currentAccount.id)
              ? { ...conversation, participantIds: [...conversation.participantIds, currentAccount.id] }
              : conversation
          );
          const derived = buildDerivedState(
            state.accounts,
            currentAccount.id,
            state.activeRole,
            state.allTasks,
            allConversations,
            state.allReviews,
            existing.id
          );
          set({ allConversations, ...derived, error: null });
          return existing.id;
        }

        const conversation: Conversation = {
          id: `conv-${Date.now()}-public`,
          taskId,
          threadType: "public",
          participantIds: [task.postedBy, currentAccount.id],
          messages: [systemMessage("Public job thread opened.")]
        };

        const allConversations = [conversation, ...state.allConversations];
        const derived = buildDerivedState(
          state.accounts,
          currentAccount.id,
          state.activeRole,
          state.allTasks,
          allConversations,
          state.allReviews,
          conversation.id
        );

        set({
          allConversations,
          ...derived,
          error: null
        });

        return conversation.id;
      },
      openConversationForTask: async (taskId) => {
        if (hasSupabaseEnv()) {
          try {
            const result = await openConversationInSupabase(taskId, "private");
            set({
              ...applyMarketplacePayload(
                result.marketplace,
                get().activeRole,
                result.conversationId
              ),
              status: "success",
              error: null
            });
            return result.conversationId;
          } catch (error) {
            set({
              status: "error",
              error: error instanceof Error ? error.message : "Unable to open conversation"
            });
            return null;
          }
        }

        const state = get();
        const currentAccount = state.currentAccount;
        const task = state.allTasks.find((item) => item.id === taskId);

        if (!currentAccount || !task) {
          set({ error: "Task not found." });
          return null;
        }

        const visibleAccount = getCurrentAccount(state.accounts, currentAccount.id);
        if (!visibleAccount) {
          set({ error: "Account not found." });
          return null;
        }

        const visibleTasks = getVisibleTasks(state.allTasks, visibleAccount, state.activeRole);
        if (!visibleTasks.some((item) => item.id === taskId)) {
          set({ error: "That task is outside your current service area." });
          return null;
        }

        const existing = state.allConversations.find(
          (conversation) =>
            conversation.taskId === taskId &&
            (conversation.threadType ?? "private") === "private" &&
            conversation.participantIds.includes(currentAccount.id)
        );

        if (existing) {
          set({ selectedConversationId: existing.id, error: null });
          return existing.id;
        }

        if (task.postedBy === currentAccount.id) {
          set({ error: "No tasker has opened a private thread for this job yet." });
          return null;
        }

        const conversation: Conversation = {
          id: `conv-${Date.now()}`,
          taskId,
          threadType: "private",
          participantIds: [currentAccount.id, task.postedBy],
          messages: [systemMessage("Conversation opened.")]
        };

        const allConversations = [conversation, ...state.allConversations];
        const derived = buildDerivedState(
          state.accounts,
          currentAccount.id,
          state.activeRole,
          state.allTasks,
          allConversations,
          state.allReviews,
          conversation.id
        );

        set({
          allConversations,
          ...derived,
          error: null
        });

        return conversation.id;
      },
      sendMessage: async (conversationId, text, options) => {
        const state = get();
        const currentAccount = state.currentAccount;

        if (!currentAccount) {
          set({ error: "Log in before messaging." });
          return;
        }

        if (hasSupabaseEnv()) {
          try {
            const payload = await sendMessageInSupabase(conversationId, {
              text,
              kind: options?.kind,
              offerAmount: options?.offerAmount
            });
            set({
              ...applyMarketplacePayload(payload, get().activeRole, conversationId),
              status: "success",
              error: null
            });
          } catch (error) {
            set({
              status: "error",
              error: error instanceof Error ? error.message : "Unable to send message"
            });
          }
          return;
        }

        const allConversations = state.allConversations.map((conversation) => {
          if (conversation.id !== conversationId) {
            return conversation;
          }

          return {
            ...conversation,
            messages: [
              ...conversation.messages,
              {
                id: `msg-${Date.now()}`,
                senderId: currentAccount.id,
                text,
                sentAt: nowLabel(),
                kind: options?.kind ?? "message",
                offerAmount: options?.offerAmount
              }
            ]
          };
        });

        const allTasks = state.allTasks.map((task) => {
          const conversation = allConversations.find((item) => item.id === conversationId);
          if (!conversation || conversation.taskId !== task.id) {
            return task;
          }

          return {
            ...task,
            offers: task.offers + (options?.kind === "offer" ? 1 : 0),
            questions: task.questions + (options?.kind === "question" ? 1 : 0)
          };
        });

        const derived = buildDerivedState(
          state.accounts,
          currentAccount.id,
          state.activeRole,
          allTasks,
          allConversations,
          state.allReviews,
          conversationId
        );

        set({
          allTasks,
          allConversations,
          ...derived,
          error: null
        });
      },
      acceptLatestOffer: async (conversationId) => {
        if (hasSupabaseEnv()) {
          try {
            const payload = await acceptLatestOfferInSupabase(conversationId);
            set({
              ...applyMarketplacePayload(payload, get().activeRole, conversationId),
              status: "success",
              error: null
            });
          } catch (error) {
            set({
              status: "error",
              error: error instanceof Error ? error.message : "Unable to accept offer"
            });
          }
          return;
        }

        const state = get();
        const currentAccount = state.currentAccount;
        const conversation = state.allConversations.find((item) => item.id === conversationId);

        if (!currentAccount || !conversation) {
          set({ error: "Conversation not found." });
          return;
        }

        const latestOffer = [...conversation.messages]
          .reverse()
          .find((message) => typeof message.offerAmount === "number");

        if (!latestOffer || typeof latestOffer.offerAmount !== "number") {
          set({ error: "There is no offer to accept yet." });
          return;
        }

        const assignedTo = conversation.participantIds.find((id) => id !== currentAccount.id);
        const allTasks = state.allTasks.map((task) =>
          task.id === conversation.taskId
            ? {
                ...task,
                status: "assigned" as const,
                assignedTo,
                agreedPrice: latestOffer.offerAmount
              }
            : task
        );

        const allConversations = state.allConversations.map((item) =>
          item.id === conversationId
            ? {
                ...item,
                messages: [
                  ...item.messages,
                  systemMessage(`Offer accepted at $${latestOffer.offerAmount}.`)
                ]
              }
            : item
        );

        const derived = buildDerivedState(
          state.accounts,
          currentAccount.id,
          state.activeRole,
          allTasks,
          allConversations,
          state.allReviews,
          conversationId
        );

        set({
          allTasks,
          allConversations,
          ...derived,
          error: null
        });
      },
      completeTask: async (taskId) => {
        if (hasSupabaseEnv()) {
          try {
            const payload = await completeTaskInSupabase(taskId);
            set({
              ...applyMarketplacePayload(payload, get().activeRole, get().selectedConversationId),
              status: "success",
              error: null
            });
          } catch (error) {
            set({
              status: "error",
              error: error instanceof Error ? error.message : "Unable to complete task"
            });
          }
          return;
        }

        const state = get();
        const currentAccount = state.currentAccount;

        if (!currentAccount) {
          set({ error: "Log in before updating tasks." });
          return;
        }

        const task = state.allTasks.find((item) => item.id === taskId);
        if (!task) {
          set({ error: "Task not found." });
          return;
        }

        const allTasks = state.allTasks.map((item) =>
          item.id === taskId ? { ...item, status: "completed" as const } : item
        );

        let accounts = state.accounts;

        if (task.postedBy === currentAccount.id) {
          accounts = updateAccount(accounts, currentAccount.id, (account) => ({
            ...account,
            posterStats: {
              ...account.posterStats,
              completedCount: account.posterStats.completedCount + 1
            }
          }));
        }

        if (task.assignedTo === currentAccount.id) {
          accounts = updateAccount(accounts, currentAccount.id, (account) => ({
            ...account,
            taskerStats: {
              ...account.taskerStats,
              completedCount: account.taskerStats.completedCount + 1,
              jobsWon: account.taskerStats.jobsWon + 1
            }
          }));
        }

        const allConversations = state.allConversations.map((conversation) =>
          conversation.taskId === taskId
            ? {
                ...conversation,
                messages: [...conversation.messages, systemMessage("Task marked as completed.")]
              }
            : conversation
        );

        const derived = buildDerivedState(
          accounts,
          currentAccount.id,
          state.activeRole,
          allTasks,
          allConversations,
          state.allReviews,
          state.selectedConversationId
        );

        set({
          accounts,
          allTasks,
          allConversations,
          ...derived,
          error: null
        });
      },
      leaveReview: async (taskId, revieweeId, role, rating, text) => {
        if (hasSupabaseEnv()) {
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
              error: null
            });
          } catch (error) {
            set({
              status: "error",
              error: error instanceof Error ? error.message : "Unable to leave review"
            });
          }
          return;
        }

        const state = get();
        const currentAccount = state.currentAccount;

        if (!currentAccount) {
          set({ error: "Log in before leaving a review." });
          return;
        }

        const exists = state.allReviews.some(
          (review) =>
            review.taskId === taskId &&
            review.revieweeId === revieweeId &&
            review.reviewerId === currentAccount.id &&
            review.role === role
        );

        if (exists) {
          return;
        }

        const review: Review = {
          id: `review-${Date.now()}`,
          taskId,
          reviewerId: currentAccount.id,
          revieweeId,
          role,
          rating,
          text,
          createdAt: "Now"
        };

        const accounts = updateAccount(state.accounts, revieweeId, (account) => ({
          ...account,
          posterStats:
            role === "poster"
              ? {
                  ...account.posterStats,
                  rating: updateRatingSummary(account.posterStats.rating, rating)
                }
              : account.posterStats,
          taskerStats:
            role === "tasker"
              ? {
                  ...account.taskerStats,
                  rating: updateRatingSummary(account.taskerStats.rating, rating)
                }
              : account.taskerStats
        }));

        const allReviews = [review, ...state.allReviews];
        const allConversations = state.allConversations.map((conversation) =>
          conversation.taskId === taskId
            ? {
                ...conversation,
                messages: [...conversation.messages, systemMessage(`Review left: ${rating} stars.`)]
              }
            : conversation
        );

        const derived = buildDerivedState(
          accounts,
          currentAccount.id,
          state.activeRole,
          state.allTasks,
          allConversations,
          allReviews,
          state.selectedConversationId
        );

        set({
          accounts,
          allReviews,
          allConversations,
          ...derived,
          error: null
        });
      }
    }),
    {
      name: "taskdash-store",
      version: 6,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persistedState, version) => {
        if (!persistedState || typeof persistedState !== "object" || version < 6) {
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
        selectedCategoryId: state.selectedCategoryId,
        pendingSignUp: state.pendingSignUp
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<AppState>)
      })
    }
  )
);
