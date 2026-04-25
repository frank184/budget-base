import { Module } from "@nestjs/common";
import { GraphQLModule } from "@nestjs/graphql";
import { MercuriusDriver, MercuriusDriverConfig } from "@nestjs/mercurius";

import { AuthModule } from "./auth/auth.module";
import { BudgetModule } from "./budget/budget.module";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    DatabaseModule,
    GraphQLModule.forRoot<MercuriusDriverConfig>({
      driver: MercuriusDriver,
      autoSchemaFile: true,
      path: "/graphql",
      graphiql: true,
      sortSchema: true,
      context: (req, reply) => ({
        req,
        reply
      })
    }),
    BudgetModule,
    AuthModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
