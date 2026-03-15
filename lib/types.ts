export type UserRole = "poster" | "tasker";

export type RatingRole = "poster" | "tasker";

export type Category = {
  id: string;
  label: string;
  icon: string;
  accent: string;
};

export type RatingSummary = {
  average: number;
  count: number;
};

export type MarketplaceUser = {
  id: string;
  name: string;
  tagline: string;
  taskerRating: RatingSummary;
  posterRating: RatingSummary;
  jobsCompleted: number;
  tasksPosted: number;
  responseTime: string;
  avatarColor: string;
  zipCode: string;
  serviceZipCodes: string[];
};

export type TaskStatus = "open" | "assigned" | "completed";

export type Task = {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  location: string;
  zipCode: string;
  distanceLabel: string;
  budget: number;
  timeline: string;
  status: TaskStatus;
  postedAt: string;
  postedBy: string;
  assignedTo?: string;
  agreedPrice?: number;
  offers: number;
  questions: number;
  tags: string[];
};

export type MessageKind = "message" | "offer" | "question" | "system";

export type Message = {
  id: string;
  senderId: string;
  text: string;
  sentAt: string;
  kind: MessageKind;
  offerAmount?: number;
};

export type ConversationType = "public" | "private";

export type Conversation = {
  id: string;
  taskId: string;
  threadType?: ConversationType;
  taskerId?: string;
  participantIds: string[];
  messages: Message[];
};

export type Review = {
  id: string;
  taskId: string;
  reviewerId: string;
  revieweeId: string;
  role: RatingRole;
  rating: number;
  text: string;
  createdAt: string;
};

export type CurrentAccount = {
  id: string;
  name: string;
  homeBase: string;
  zipCode: string;
  serviceZipCodes: string[];
  bio: string;
  posterStats: {
    tasksPosted: number;
    hireRate: string;
    completedCount: number;
    rating: RatingSummary;
  };
  taskerStats: {
    jobsWon: number;
    earningsLabel: string;
    completedCount: number;
    rating: RatingSummary;
  };
};

export type MarketplacePayload = {
  currentAccount: CurrentAccount;
  categories: Category[];
  users: MarketplaceUser[];
  tasks: Task[];
  conversations: Conversation[];
  reviews: Review[];
  highlights: {
    openTasks: number;
    activeTaskers: number;
    averageReply: string;
  };
};

export type LoadStatus = "idle" | "loading" | "success" | "error";
