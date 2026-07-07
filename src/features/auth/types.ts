import type { UserRole } from "@/lib/types";

export interface AuthSession {
  sessionId: string;
  userId: string;
  username: string;
  role: UserRole;
  loginAt: string;
  startedAt: string;
  firstLoginAt: string | null;
  displayName: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  password: string;
  displayName?: string;
}

export interface User {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
}
