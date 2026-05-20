import type { AuthState } from '../types';

export interface ApiClientConfig {
  baseUrl: string;
  getAuthState: () => AuthState | null;
}

export class ApiClient {
  private baseUrl: string;
  private getAuthState: () => AuthState | null;
  private offlineQueue: Array<{ url: string; options: RequestInit }> = [];

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
    this.getAuthState = config.getAuthState;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const auth = this.getAuthState();
    if (auth?.type === 'guest' && auth.token) {
      headers['X-Guest-Token'] = auth.token;
    } else if (auth?.type === 'user' && auth.token) {
      headers['Authorization'] = `Bearer ${auth.token}`;
    }
    return headers;
  }

  async request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = { ...this.getHeaders(), ...(options.headers || {}) };

    try {
      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }
      return (await response.json()) as T;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('fetch') || message.includes('NetworkError') || message.includes('Failed to fetch')) {
        throw new Error('offline');
      }
      throw err;
    }
  }

  get<T = unknown>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  post<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) });
  }
}
