import { Injectable } from "@nestjs/common";
import { AuthIdentity, User, UserSession } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { AuthIdentityRecord, AuthUserRecord, SessionRecord } from "./auth.types";

function toIsoString(value?: Date | null) {
  return value ? value.toISOString() : undefined;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserById(userId: number): Promise<AuthUserRecord | undefined> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    return row ? this.mapUser(row) : undefined;
  }

  async findUserByEmail(email: string): Promise<AuthUserRecord | undefined> {
    const row = await this.prisma.user.findUnique({
      where: { email }
    });

    return row ? this.mapUser(row) : undefined;
  }

  async findIdentity(provider: string, providerUserId: string): Promise<AuthIdentityRecord | undefined> {
    const row = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId
        }
      }
    });

    return row ? this.mapIdentity(row) : undefined;
  }

  async createUser(input: { email: string; displayName: string; avatarUrl?: string }) {
    const row = await this.prisma.user.create({
      data: {
        email: input.email,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        lastLoginAt: new Date()
      }
    });

    return this.mapUser(row);
  }

  async updateUser(userId: number, input: { email: string; displayName: string; avatarUrl?: string }) {
    const row = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: input.email,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        lastLoginAt: new Date()
      }
    });

    return this.mapUser(row);
  }

  async createIdentity(input: {
    userId: number;
    provider: string;
    providerUserId: string;
    email?: string;
    rawProfileJson?: string;
  }) {
    const row = await this.prisma.authIdentity.create({
      data: input
    });

    return this.mapIdentity(row);
  }

  async updateIdentity(identityId: number, input: { email?: string; rawProfileJson?: string }) {
    await this.prisma.authIdentity.update({
      where: { id: identityId },
      data: input
    });
  }

  async createSession(input: { id: string; userId: number; tokenHash: string; expiresAt: string }) {
    const row = await this.prisma.userSession.create({
      data: {
        id: input.id,
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: new Date(input.expiresAt)
      }
    });

    return this.mapSession(row);
  }

  async findSessionById(sessionId: string): Promise<SessionRecord | undefined> {
    const row = await this.prisma.userSession.findUnique({
      where: { id: sessionId }
    });

    return row ? this.mapSession(row) : undefined;
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | undefined> {
    const row = await this.prisma.userSession.findUnique({
      where: { tokenHash }
    });

    return row ? this.mapSession(row) : undefined;
  }

  async rotateSession(
    currentSessionId: string,
    replacement: { id: string; userId: number; tokenHash: string; expiresAt: string }
  ) {
    const replacementRow = await this.prisma.$transaction(async (tx) => {
      await tx.userSession.update({
        where: { id: currentSessionId },
        data: {
          revokedAt: new Date(),
          replacedBySessionId: replacement.id,
          lastUsedAt: new Date()
        }
      });

      return tx.userSession.create({
        data: {
          id: replacement.id,
          userId: replacement.userId,
          tokenHash: replacement.tokenHash,
          expiresAt: new Date(replacement.expiresAt)
        }
      });
    });

    return this.mapSession(replacementRow);
  }

  async touchSession(sessionId: string) {
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { lastUsedAt: new Date() }
    });
  }

  async revokeSessionByTokenHash(tokenHash: string) {
    await this.prisma.userSession.updateMany({
      where: {
        tokenHash,
        revokedAt: null
      },
      data: {
        revokedAt: new Date(),
        lastUsedAt: new Date()
      }
    });
  }

  private mapUser(row: User): AuthUserRecord {
    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl ?? undefined,
      status: row.status,
      lastLoginAt: toIsoString(row.lastLoginAt),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private mapIdentity(row: AuthIdentity): AuthIdentityRecord {
    return {
      id: row.id,
      userId: row.userId,
      provider: row.provider,
      providerUserId: row.providerUserId,
      email: row.email ?? undefined,
      rawProfileJson: row.rawProfileJson ?? undefined
    };
  }

  private mapSession(row: UserSession): SessionRecord {
    return {
      id: row.id,
      userId: row.userId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt.toISOString(),
      revokedAt: toIsoString(row.revokedAt),
      replacedBySessionId: row.replacedBySessionId ?? undefined,
      lastUsedAt: toIsoString(row.lastUsedAt)
    };
  }
}
