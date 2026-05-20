export interface AuthUser {
  id: number;
  email?: string;
  nickname: string;
}

export interface GuestUser {
  id: number;
  token: string;
  nickname: string;
}

export interface AuthState {
  type: 'guest' | 'user' | null;
  token: string | null;
  user: AuthUser | null;
}

export interface RegisterPayload {
  email: string;
  phone?: string;
  password: string;
  nickname: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface GuestPayload {
  nickname: string;
}
