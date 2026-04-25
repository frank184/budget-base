import { Module, forwardRef } from "@nestjs/common";

import { BudgetModule } from "../budget/budget.module";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthRepository } from "./auth.repository";
import { AuthResolver } from "./auth.resolver";
import { AuthService } from "./auth.service";

@Module({
  imports: [forwardRef(() => BudgetModule)],
  providers: [AuthRepository, AuthService, AuthGuard, AuthResolver],
  controllers: [AuthController],
  exports: [AuthService, AuthGuard]
})
export class AuthModule {}
