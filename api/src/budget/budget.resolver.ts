import { Args, ID, Mutation, Parent, Query, ResolveField, Resolver } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";

import { CurrentUser } from "../auth/current-user.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedUser } from "../auth/auth.types";
import { BudgetService } from "./budget.service";
import { hydrateBudgetMonth } from "./budget.normalize";
import {
  BudgetCategoryPlanRecord,
  BudgetCategoryRecord,
  BudgetMonthView,
  BudgetRecord,
  BudgetState,
  BudgetTransactionRecord
} from "./budget.types";
import {
  BudgetCategoryPlanType,
  BudgetCategoryType,
  BudgetMonthType,
  BudgetTransactionType,
  TransactionFilterInput,
  BudgetType,
  UpdateBudgetInput,
  CreateBudgetInput
} from "./budget.graphql";

@UseGuards(AuthGuard)
@Resolver(() => BudgetType)
export class BudgetResolver {
  constructor(private readonly budgetService: BudgetService) {}

  @Query(() => [BudgetType], { description: "List available budget resources." })
  budgets(@CurrentUser() user: AuthenticatedUser) {
    return this.budgetService.listBudgets(user.id);
  }

  @Query(() => BudgetType, {
    description: "Get the current budget resource."
  })
  budget(@CurrentUser() user: AuthenticatedUser) {
    return this.budgetService.getBudgetForUser(user.id);
  }

  @Query(() => [BudgetTransactionType], {
    description: "List transactions as standalone resources, optionally filtered."
  })
  transactions(
    @CurrentUser() user: AuthenticatedUser,
    @Args("filter", { type: () => TransactionFilterInput, nullable: true }) filter?: TransactionFilterInput
  ) {
    return this.budgetService.listTransactions(filter, user.id);
  }

  @Query(() => [BudgetCategoryPlanType], {
    description: "List category plans as standalone resources, optionally filtered by month."
  })
  categoryPlans(
    @CurrentUser() user: AuthenticatedUser,
    @Args("monthId", { type: () => ID, nullable: true }) monthId?: string,
    @Args("monthIds", { type: () => [ID], nullable: true }) monthIds?: string[]
  ) {
    return this.budgetService.listCategoryPlans({ monthId, monthIds }, user.id);
  }

  @Query(() => BudgetTransactionType, {
    description: "Get a transaction by id from the current budget."
  })
  transaction(
    @CurrentUser() user: AuthenticatedUser,
    @Args("id", { type: () => ID }) id: string
  ) {
    return this.budgetService.getTransaction(user.id, id);
  }

  @Mutation(() => BudgetType, {
    description: "Create a budget resource."
  })
  createBudget(
    @CurrentUser() user: AuthenticatedUser,
    @Args("input", { type: () => CreateBudgetInput, nullable: true }) input?: CreateBudgetInput
  ) {
    return this.budgetService.createBudgetForUser(user.id, input as Partial<BudgetState> | undefined);
  }

  @Mutation(() => BudgetType, {
    description: "Update the current budget resource using nested month and category data."
  })
  updateBudget(
    @CurrentUser() user: AuthenticatedUser,
    @Args("input", { type: () => UpdateBudgetInput }) input: UpdateBudgetInput
  ) {
    return this.budgetService.replaceBudgetForUser(user.id, input as BudgetState);
  }

  @ResolveField("months", () => [BudgetMonthType])
  resolveMonths(
    @Parent() budget: BudgetRecord | BudgetState,
    @CurrentUser() user: AuthenticatedUser
  ): BudgetMonthView[] {
    const budgetState = "months" in budget && Array.isArray(budget.months)
      ? budget
      : this.budgetService.getBudgetForUser(user.id, budget.id);

    return budgetState.months
      .map((month) => hydrateBudgetMonth(budgetState, month.id))
      .filter(Boolean) as BudgetMonthView[];
  }

  @ResolveField("categories", () => [BudgetCategoryType])
  resolveCategories(
    @Parent() budget: BudgetRecord | BudgetState,
    @CurrentUser() user: AuthenticatedUser
  ): BudgetCategoryRecord[] {
    if ("categories" in budget && Array.isArray(budget.categories)) {
      return budget.categories;
    }

    return this.budgetService.getBudgetForUser(user.id, budget.id).categories;
  }

  @ResolveField("categoryPlans", () => [BudgetCategoryPlanType])
  resolveCategoryPlans(
    @Parent() budget: BudgetRecord | BudgetState,
    @CurrentUser() user: AuthenticatedUser,
    @Args("monthId", { type: () => ID, nullable: true }) monthId?: string,
    @Args("monthIds", { type: () => [ID], nullable: true }) monthIds?: string[]
  ): BudgetCategoryPlanRecord[] {
    const budgetState = "categoryPlans" in budget && Array.isArray(budget.categoryPlans)
      ? budget
      : this.budgetService.getBudgetForUser(user.id, budget.id);

    return budgetState.categoryPlans.filter((link) =>
      monthId ? link.monthId === monthId : monthIds?.length ? monthIds.includes(link.monthId) : true
    );
  }

  @ResolveField("transactions", () => [BudgetTransactionType])
  resolveTransactions(
    @Parent() budget: BudgetRecord | BudgetState,
    @CurrentUser() user: AuthenticatedUser,
    @Args("filter", { type: () => TransactionFilterInput, nullable: true }) filter?: TransactionFilterInput
  ): BudgetTransactionRecord[] {
    const budgetState = "transactions" in budget && Array.isArray(budget.transactions)
      ? budget
      : this.budgetService.getBudgetForUser(user.id, budget.id);

    return budgetState.transactions.filter((transaction) => {
      if (filter?.categoryId && transaction.categoryId !== filter.categoryId) return false;
      if (filter?.type && transaction.type !== filter.type) return false;
      if (filter?.occurredFrom && transaction.occurredAt < filter.occurredFrom) return false;
      if (filter?.occurredTo && transaction.occurredAt > filter.occurredTo) return false;
      return true;
    });
  }

  @ResolveField("category", () => BudgetCategoryType, { nullable: true })
  resolveTransactionCategory(
    @Parent() transaction: BudgetTransactionRecord,
    @CurrentUser() user: AuthenticatedUser
  ): BudgetCategoryRecord | undefined {
    return this.budgetService.getTransactionCategory(user.id, transaction.categoryId);
  }

  @ResolveField("month", () => BudgetMonthType, { nullable: true })
  resolveTransactionMonth(
    @Parent() transaction: BudgetTransactionRecord,
    @CurrentUser() user: AuthenticatedUser
  ): BudgetMonthView | undefined {
    return this.budgetService.getTransactionMonth(user.id, transaction);
  }
}
