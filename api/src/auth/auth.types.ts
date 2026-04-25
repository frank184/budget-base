export interface AuthUserRecord {
  id: number;
  email: string;
  displayName: string;
  avatarUrl?: string;
  status: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthIdentityRecord {
  id: number;
  userId: number;
  provider: string;
  providerUserId: string;
  email?: string;
  rawProfileJson?: string;
}

export interface SessionRecord {
  id: string;
  userId: number;
  tokenHash: string;
  expiresAt: string;
  revokedAt?: string;
  replacedBySessionId?: string;
  lastUsedAt?: string;
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  displayName: string;
  avatarUrl?: string;
}
