import { ApiClient } from './api-client';
import type { AuthState, AuthUser, RegisterPayload, LoginPayload, GuestPayload } from '../types';

const STORAGE_KEY = 'superglazka_auth';

export class AuthService {
  private api: ApiClient;
  private state: AuthState = { type: null, token: null, user: null };

  constructor(api: ApiClient) {
    this.api = api;
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as AuthState;
        this.state = data;
      }
    } catch {
      /* ignore */
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      /* ignore */
    }
  }

  getState(): AuthState {
    return { ...this.state };
  }

  isLoggedIn(): boolean {
    return !!this.state.token;
  }

  isGuest(): boolean {
    return this.state.type === 'guest';
  }

  canSpendCoins(): boolean {
    return this.state.type === 'user';
  }

  async guestLogin(nickname: string): Promise<{ token: string; nickname: string }> {
    const payload: GuestPayload = { nickname };
    const data = await this.api.post<{ token: string; nickname: string }>('/auth/guest', payload);
    this.state = { type: 'guest', token: data.token, user: { id: 0, nickname: data.nickname } };
    this.saveToStorage();
    return data;
  }

  async register(payload: RegisterPayload): Promise<{ token: string; user: AuthUser }> {
    const data = await this.api.post<{ token: string; user: AuthUser }>('/auth/register', payload);
    this.state = { type: 'user', token: data.token, user: data.user };
    this.saveToStorage();
    return data;
  }

  async login(payload: LoginPayload): Promise<{ token: string; user: AuthUser }> {
    const data = await this.api.post<{ token: string; user: AuthUser }>('/auth/login', payload);
    this.state = { type: 'user', token: data.token, user: data.user };
    this.saveToStorage();
    return data;
  }

  logout(): void {
    this.state = { type: null, token: null, user: null };
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    window.location.reload();
  }

  async subscribeEmail(email: string): Promise<unknown> {
    return this.api.post('/subscribe', { email });
  }

  async fetchProgress(): Promise<unknown> {
    return this.api.get('/progress');
  }

  async saveProgress(episodeId: string, maxFrame: number, completed: boolean): Promise<unknown> {
    return this.api.post('/progress', { episodeId, maxFrame, completed });
  }

  async fetchCoins(): Promise<{ amount: number }> {
    return this.api.get('/coins');
  }

  async addCoins(amount: number): Promise<{ amount: number }> {
    return this.api.post('/coins/add', { amount });
  }

  async spendCoins(amount: number): Promise<{ amount: number }> {
    return this.api.post('/coins/spend', { amount });
  }
}
