import { Module } from "@nestjs/common";
import { GraphQLModule } from "@nestjs/graphql";
import { MercuriusDriver, MercuriusDriverConfig } from "@nestjs/mercurius";

import { AuthModule } from "./auth/auth.module";
import { BudgetModule } from "./budget/budget.module";
import { GraphiqlController } from "./graphiql.controller";
import { HealthController } from "./health.controller";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    PrismaModule,
    GraphQLModule.forRoot<MercuriusDriverConfig>({
      driver: MercuriusDriver,
      autoSchemaFile: true,
      path: "/graphql",
      graphiql: false,
      sortSchema: true,
      context: (req, reply) => ({
        req,
        reply
      })
    }),
    BudgetModule,
    AuthModule
  ],
  controllers: [HealthController, GraphiqlController]
})
export class AppModule {}
