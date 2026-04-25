import { Module, forwardRef } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { BudgetResolver } from "./budget.resolver";
import { BudgetRepository } from "./budget.repository";
import { BudgetService } from "./budget.service";

@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [BudgetRepository, BudgetService, BudgetResolver],
  exports: [BudgetService]
})
export class BudgetModule {}
