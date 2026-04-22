import { Module } from "@nestjs/common";

import { BudgetResolver } from "./budget.resolver";
import { BudgetRepository } from "./budget.repository";
import { BudgetService } from "./budget.service";

@Module({
  providers: [BudgetRepository, BudgetService, BudgetResolver]
})
export class BudgetModule {}
