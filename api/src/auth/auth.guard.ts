import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { FastifyRequest } from "fastify";

import { AuthService } from "./auth.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = this.getRequest(context);
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    const token = authorizationHeader.slice("Bearer ".length).trim();
    request.user = await this.authService.verifyAccessToken(token);
    return true;
  }

  private getRequest(context: ExecutionContext) {
    if (context.getType<string>() === "http") {
      return context.switchToHttp().getRequest<FastifyRequest & { user?: unknown }>();
    }

    const graphqlContext = GqlExecutionContext.create(context).getContext<{ req: FastifyRequest & { user?: unknown } }>();
    return graphqlContext.req;
  }
}
