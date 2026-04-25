import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";

import { AuthenticatedUser } from "./auth.types";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined => {
    if (context.getType<string>() === "http") {
      return context.switchToHttp().getRequest().user;
    }

    const graphqlContext = GqlExecutionContext.create(context).getContext<{ req?: { user?: AuthenticatedUser } }>();
    return graphqlContext.req?.user;
  }
);
