export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ProgressPayload {
  episodeId: string;
  maxFrame: number;
  completed: boolean;
}

export interface CoinsPayload {
  amount: number;
}

export interface SubscriptionPayload {
  email: string;
}

export interface HealthResponse {
  status: string;
  time: string;
}
