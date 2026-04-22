import { Module } from "@nestjs/common";
import { GraphQLModule } from "@nestjs/graphql";
import { MercuriusDriver, MercuriusDriverConfig } from "@nestjs/mercurius";

import { BudgetModule } from "./budget/budget.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    GraphQLModule.forRoot<MercuriusDriverConfig>({
      driver: MercuriusDriver,
      autoSchemaFile: true,
      path: "/graphql",
      graphiql: true,
      sortSchema: true
    }),
    BudgetModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
