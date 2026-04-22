import { Args, ID, Int, Mutation, Parent, Query, ResolveField, Resolver } from "@nestjs/graphql";

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

@Resolver(() => BudgetType)
export class BudgetResolver {
  constructor(private readonly budgetService: BudgetService) {}

  @Query(() => [BudgetType], { description: "List available budget resources." })
  budgets() {
    return this.budgetService.listBudgets();
  }

  @Query(() => BudgetType, {
    description: "Get the current budget resource."
  })
  budget() {
    return this.budgetService.getBudget();
  }

  @Query(() => [BudgetTransactionType], {
    description: "List transactions as standalone resources, optionally filtered."
  })
  transactions(
    @Args("filter", { type: () => TransactionFilterInput, nullable: true }) filter?: TransactionFilterInput
  ) {
    return this.budgetService.listTransactions(filter);
  }

  @Query(() => [BudgetCategoryPlanType], {
    description: "List category plans as standalone resources, optionally filtered by month."
  })
  categoryPlans(
    @Args("monthId", { type: () => ID, nullable: true }) monthId?: string,
    @Args("monthIds", { type: () => [ID], nullable: true }) monthIds?: string[]
  ) {
    return this.budgetService.listCategoryPlans({ monthId, monthIds });
  }

  @Query(() => BudgetTransactionType, {
    description: "Get a transaction by id from the current budget."
  })
  transaction(@Args("id", { type: () => ID }) id: string) {
    return this.budgetService.getTransaction(id);
  }

  @Mutation(() => BudgetType, {
    description: "Create a budget resource."
  })
  createBudget(@Args("input", { type: () => CreateBudgetInput, nullable: true }) input?: CreateBudgetInput) {
    return this.budgetService.createBudget(input as Partial<BudgetState> | undefined);
  }

  @Mutation(() => BudgetType, {
    description: "Update the current budget resource using nested month and category data."
  })
  updateBudget(@Args("input", { type: () => UpdateBudgetInput }) input: UpdateBudgetInput) {
    return this.budgetService.replaceBudget(input as BudgetState);
  }

  @ResolveField("months", () => [BudgetMonthType])
  resolveMonths(@Parent() budget: BudgetRecord | BudgetState): BudgetMonthView[] {
    const budgetState = "months" in budget && Array.isArray(budget.months)
      ? budget
      : this.budgetService.getBudget(budget.id);

    return budgetState.months
      .map((month) => hydrateBudgetMonth(budgetState, month.id))
      .filter(Boolean) as BudgetMonthView[];
  }

  @ResolveField("categories", () => [BudgetCategoryType])
  resolveCategories(@Parent() budget: BudgetRecord | BudgetState): BudgetCategoryRecord[] {
    if ("categories" in budget && Array.isArray(budget.categories)) {
      return budget.categories;
    }

    return this.budgetService.getBudget(budget.id).categories;
  }

  @ResolveField("categoryPlans", () => [BudgetCategoryPlanType])
  resolveCategoryPlans(
    @Parent() budget: BudgetRecord | BudgetState,
    @Args("monthId", { type: () => ID, nullable: true }) monthId?: string,
    @Args("monthIds", { type: () => [ID], nullable: true }) monthIds?: string[]
  ): BudgetCategoryPlanRecord[] {
    const budgetId = "id" in budget ? budget.id : undefined;
    return this.budgetService.listCategoryPlans({ monthId, monthIds }, budgetId);
  }

  @ResolveField("transactions", () => [BudgetTransactionType])
  resolveTransactions(
    @Parent() budget: BudgetRecord | BudgetState,
    @Args("filter", { type: () => TransactionFilterInput, nullable: true }) filter?: TransactionFilterInput
  ): BudgetTransactionRecord[] {
    return this.budgetService.listTransactions(filter);
  }

  @ResolveField("category", () => BudgetCategoryType, { nullable: true })
  resolveTransactionCategory(
    @Parent() transaction: BudgetTransactionRecord
  ): BudgetCategoryRecord | undefined {
    return this.budgetService.getTransactionCategory(transaction.categoryId);
  }

  @ResolveField("month", () => BudgetMonthType, { nullable: true })
  resolveTransactionMonth(
    @Parent() transaction: BudgetTransactionRecord
  ): BudgetMonthView | undefined {
    return this.budgetService.getTransactionMonth(transaction);
  }
}
