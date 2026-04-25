import { Query, Resolver } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";

import { CurrentUser } from "./current-user.decorator";
import { MeType } from "./auth.graphql";
import { AuthGuard } from "./auth.guard";
import { AuthenticatedUser } from "./auth.types";

@Resolver(() => MeType)
export class AuthResolver {
  @UseGuards(AuthGuard)
  @Query(() => MeType, { description: "Get the authenticated app user." })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
