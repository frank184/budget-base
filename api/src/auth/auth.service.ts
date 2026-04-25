import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException
} from "@nestjs/common";

import { appConfig } from "../config";
import { BudgetService } from "../budget/budget.service";
import { AuthRepository } from "./auth.repository";
import { AuthenticatedUser } from "./auth.types";

const ACCESS_AUDIENCE = "budget-base-ui";
const REFRESH_COOKIE_NAME = "budget_base_refresh";
const OAUTH_STATE_COOKIE = "budget_base_oauth_state";
const OAUTH_NONCE_COOKIE = "budget_base_oauth_nonce";

type GoogleProfile = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  nonce?: string;
};

async function loadJose() {
  return import("jose");
}

@Injectable()
export class AuthService {
  private readonly accessSecret = new TextEncoder().encode(appConfig.jwtAccessSecret);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly budgetService: BudgetService
  ) {}

  get refreshCookieName() {
    return REFRESH_COOKIE_NAME;
  }

  get oauthCookieNames() {
    return {
      state: OAUTH_STATE_COOKIE,
      nonce: OAUTH_NONCE_COOKIE
    };
  }

  createOAuthState() {
    return {
      state: randomBytes(24).toString("base64url"),
      nonce: randomBytes(24).toString("base64url")
    };
  }

  buildGoogleAuthUrl({ state, nonce }: { state: string; nonce: string }) {
    const search = new URLSearchParams({
      client_id: appConfig.googleClientId,
      redirect_uri: appConfig.googleCallbackUrl,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${search.toString()}`;
  }

  async handleGoogleCallback(input: { code?: string; state?: string; expectedState?: string; expectedNonce?: string }) {
    if (!input.code) {
      throw new BadRequestException("Google callback is missing the authorization code.");
    }

    if (!input.state || !input.expectedState || input.state !== input.expectedState) {
      throw new UnauthorizedException("Invalid OAuth state.");
    }

    if (!input.expectedNonce) {
      throw new UnauthorizedException("Missing OAuth nonce.");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code: input.code,
        client_id: appConfig.googleClientId,
        client_secret: appConfig.googleClientSecret,
        redirect_uri: appConfig.googleCallbackUrl,
        grant_type: "authorization_code"
      })
    });

    if (!tokenResponse.ok) {
      throw new UnauthorizedException("Google token exchange failed.");
    }

    const tokenPayload = (await tokenResponse.json()) as { id_token?: string };

    if (!tokenPayload.id_token) {
      throw new UnauthorizedException("Google did not return an ID token.");
    }

    const googleProfile = await this.verifyGoogleIdToken(tokenPayload.id_token, input.expectedNonce);
    const user = this.upsertGoogleUser(googleProfile);
    await this.budgetService.ensureBudgetForUser(user.id);

    return this.issueSession(user);
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    try {
      const { jwtVerify } = await loadJose();
      const verified = await jwtVerify(token, this.accessSecret, {
        issuer: appConfig.apiBaseUrl,
        audience: ACCESS_AUDIENCE
      });

      const userId = Number(verified.payload.sub);
      if (!Number.isInteger(userId)) {
        throw new UnauthorizedException("Invalid access token subject.");
      }

      const user = this.authRepository.findUserById(userId);
      if (!user) {
        throw new UnauthorizedException("User no longer exists.");
      }

      return this.toAuthenticatedUser(user);
    } catch (error) {
      throw new UnauthorizedException(
        error instanceof Error ? error.message : "Access token is invalid."
      );
    }
  }

  async createSessionFromRefreshToken(refreshToken?: string) {
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token is missing.");
    }

    const session = this.authRepository.findSessionByTokenHash(this.hashToken(refreshToken));
    if (!session) {
      throw new UnauthorizedException("Refresh token is invalid.");
    }

    if (session.revokedAt) {
      throw new UnauthorizedException("Refresh token has already been used.");
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      throw new UnauthorizedException("Refresh token has expired.");
    }

    const user = this.authRepository.findUserById(session.userId);
    if (!user) {
      throw new UnauthorizedException("Session user no longer exists.");
    }

    const nextRefreshToken = this.generateOpaqueToken();
    const nextSessionId = randomUUID();
    const nextSession = this.authRepository.rotateSession(session.id, {
      id: nextSessionId,
      userId: user.id,
      tokenHash: this.hashToken(nextRefreshToken),
      expiresAt: this.getRefreshExpiry()
    });

    this.authRepository.touchSession(nextSession.id);

    return {
      refreshToken: nextRefreshToken,
      accessToken: await this.createAccessToken(user.id),
      user: this.toAuthenticatedUser(user),
      refreshExpiresAt: nextSession.expiresAt
    };
  }

  async getCurrentUserFromRefreshToken(refreshToken?: string) {
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token is missing.");
    }

    const session = this.authRepository.findSessionByTokenHash(this.hashToken(refreshToken));
    if (!session || session.revokedAt || new Date(session.expiresAt).getTime() <= Date.now()) {
      throw new UnauthorizedException("Refresh token is invalid.");
    }

    const user = this.authRepository.findUserById(session.userId);
    if (!user) {
      throw new UnauthorizedException("User no longer exists.");
    }

    return this.toAuthenticatedUser(user);
  }

  revokeRefreshToken(refreshToken?: string) {
    if (!refreshToken) {
      return;
    }

    this.authRepository.revokeSessionByTokenHash(this.hashToken(refreshToken));
  }

  getCookieOptions(maxAgeMs: number) {
    return {
      httpOnly: true,
      sameSite: appConfig.cookieSameSite,
      secure: appConfig.cookieSecure,
      path: "/",
      maxAge: Math.floor(maxAgeMs / 1000)
    } as const;
  }

  private async verifyGoogleIdToken(idToken: string, expectedNonce: string) {
    const { createRemoteJWKSet, jwtVerify } = await loadJose();
    const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
    const verified = await jwtVerify(idToken, googleJwks, {
      audience: appConfig.googleClientId,
      issuer: ["https://accounts.google.com", "accounts.google.com"]
    });

    const payload = verified.payload as GoogleProfile;

    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException("Google profile is missing required claims.");
    }

    if (payload.nonce !== expectedNonce) {
      throw new UnauthorizedException("Google nonce did not match.");
    }

    return payload;
  }

  private upsertGoogleUser(profile: GoogleProfile) {
    const existingIdentity = this.authRepository.findIdentity("google", profile.sub);
    const profileData = {
      email: profile.email,
      displayName: profile.name || profile.email,
      avatarUrl: profile.picture
    };

    if (existingIdentity) {
      const user = this.authRepository.updateUser(existingIdentity.userId, profileData);
      this.authRepository.updateIdentity(existingIdentity.id, {
        email: profile.email,
        rawProfileJson: JSON.stringify(profile)
      });
      return user;
    }

    const existingUser = this.authRepository.findUserByEmail(profile.email);
    const user = existingUser
      ? this.authRepository.updateUser(existingUser.id, profileData)
      : this.authRepository.createUser(profileData);

    this.authRepository.createIdentity({
      userId: user.id,
      provider: "google",
      providerUserId: profile.sub,
      email: profile.email,
      rawProfileJson: JSON.stringify(profile)
    });

    return user;
  }

  private async issueSession(user: { id: number; email: string; displayName: string; avatarUrl?: string }) {
    const refreshToken = this.generateOpaqueToken();
    const session = this.authRepository.createSession({
      id: randomUUID(),
      userId: user.id,
      tokenHash: this.hashToken(refreshToken),
      expiresAt: this.getRefreshExpiry()
    });

    return {
      refreshToken,
      accessToken: await this.createAccessToken(user.id),
      user: this.toAuthenticatedUser(user),
      refreshExpiresAt: session.expiresAt
    };
  }

  private async createAccessToken(userId: number) {
    try {
      const { SignJWT } = await loadJose();
      return await new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setIssuer(appConfig.apiBaseUrl)
        .setAudience(ACCESS_AUDIENCE)
        .setSubject(String(userId))
        .setExpirationTime(`${appConfig.accessTokenTtlSeconds}s`)
        .sign(this.accessSecret);
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : "Failed to sign access token."
      );
    }
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private generateOpaqueToken() {
    return randomBytes(48).toString("base64url");
  }

  private getRefreshExpiry() {
    return new Date(Date.now() + appConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000).toISOString();
  }

  private toAuthenticatedUser(user: { id: number; email: string; displayName: string; avatarUrl?: string }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl
    };
  }
}
