import { Controller, Get, Post, Query, Req, Res, UnauthorizedException } from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";

import { appConfig } from "../config";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("google/start")
  startGoogleAuth(@Res() reply: FastifyReply) {
    const { state, nonce } = this.authService.createOAuthState();

    reply.setCookie(
      this.authService.oauthCookieNames.state,
      state,
      this.authService.getCookieOptions(10 * 60 * 1000)
    );
    reply.setCookie(
      this.authService.oauthCookieNames.nonce,
      nonce,
      this.authService.getCookieOptions(10 * 60 * 1000)
    );

    return reply.redirect(this.authService.buildGoogleAuthUrl({ state, nonce }), 302);
  }

  @Get("google/callback")
  async completeGoogleAuth(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply
  ) {
    const session = await this.authService.handleGoogleCallback({
      code,
      state,
      expectedState: request.cookies[this.authService.oauthCookieNames.state],
      expectedNonce: request.cookies[this.authService.oauthCookieNames.nonce]
    });

    reply.clearCookie(this.authService.oauthCookieNames.state, { path: "/" });
    reply.clearCookie(this.authService.oauthCookieNames.nonce, { path: "/" });
    reply.setCookie(
      this.authService.refreshCookieName,
      session.refreshToken,
      this.authService.getCookieOptions(appConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000)
    );

    return reply.redirect(`${appConfig.uiBaseUrl}/auth/callback`, 302);
  }

  @Post("session")
  async createSession(@Req() request: FastifyRequest, @Res() reply: FastifyReply) {
    try {
      const session = await this.authService.createSessionFromRefreshToken(
        request.cookies[this.authService.refreshCookieName],
        { rotateRefreshToken: false }
      );

      reply.setCookie(
        this.authService.refreshCookieName,
        session.refreshToken,
        this.authService.getCookieOptions(appConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000)
      );

      return reply.send({
        accessToken: session.accessToken,
        user: session.user
      });
    } catch (error) {
      reply.clearCookie(this.authService.refreshCookieName, this.authService.getClearCookieOptions());
      throw error;
    }
  }

  @Post("refresh")
  async refreshSession(@Req() request: FastifyRequest, @Res() reply: FastifyReply) {
    try {
      const session = await this.authService.createSessionFromRefreshToken(
        request.cookies[this.authService.refreshCookieName],
        { rotateRefreshToken: true }
      );

      reply.setCookie(
        this.authService.refreshCookieName,
        session.refreshToken,
        this.authService.getCookieOptions(appConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000)
      );

      return reply.send({
        accessToken: session.accessToken,
        user: session.user
      });
    } catch (error) {
      reply.clearCookie(this.authService.refreshCookieName, this.authService.getClearCookieOptions());
      throw error;
    }
  }

  @Post("logout")
  async logout(@Req() request: FastifyRequest, @Res() reply: FastifyReply) {
    await this.authService.revokeRefreshToken(request.cookies[this.authService.refreshCookieName]);
    reply.clearCookie(this.authService.refreshCookieName, this.authService.getClearCookieOptions());
    return reply.status(204).send();
  }

  @Get("me")
  async getCurrentUser(@Req() request: FastifyRequest) {
    const authorizationHeader = request.headers.authorization;

    if (authorizationHeader?.startsWith("Bearer ")) {
      return this.authService.verifyAccessToken(authorizationHeader.slice("Bearer ".length).trim());
    }

    const refreshToken = request.cookies[this.authService.refreshCookieName];
    if (!refreshToken) {
      throw new UnauthorizedException("Not authenticated.");
    }

    return this.authService.getCurrentUserFromRefreshToken(refreshToken);
  }
}
