import { Field, Float, ID, InputType, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class BudgetType {
  @Field(() => Int)
  id!: number;

  @Field()
  name!: string;

  @Field()
  currency!: string;

  @Field(() => [BudgetMonthType])
  months!: BudgetMonthType[];

  @Field(() => [BudgetCategoryType])
  categories!: BudgetCategoryType[];

  @Field(() => [BudgetCategoryPlanType])
  categoryPlans!: BudgetCategoryPlanType[];

  @Field(() => [BudgetTransactionType])
  transactions!: BudgetTransactionType[];
}

@ObjectType()
export class BudgetMonthType {
  @Field(() => ID)
  id!: string;

  @Field()
  startAt!: string;

  @Field()
  endAt!: string;

  @Field()
  name!: string;

  @Field(() => Float)
  startingBalance!: number;

  @Field(() => [HydratedBudgetCategoryType])
  categories!: HydratedBudgetCategoryType[];

  @Field(() => [BudgetTransactionType])
  transactions!: BudgetTransactionType[];
}

@ObjectType()
export class BudgetCategoryType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  type!: string;
}

@ObjectType()
export class BudgetCategoryPlanType {
  @Field(() => ID)
  id!: string;

  @Field()
  monthId!: string;

  @Field()
  categoryId!: string;

  @Field(() => Float)
  planned!: number;

  @Field(() => Int)
  sortOrder!: number;
}

@ObjectType()
export class BudgetTransactionType {
  @Field(() => ID)
  id!: string;

  @Field()
  occurredAt!: string;

  @Field(() => Float)
  amount!: number;

  @Field()
  description!: string;

  @Field()
  categoryId!: string;

  @Field()
  type!: string;

  @Field(() => String, { nullable: true })
  createdAt?: string;

  @Field(() => String, { nullable: true })
  updatedAt?: string;

  @Field(() => BudgetCategoryType, { nullable: true })
  category?: BudgetCategoryType;

  @Field(() => BudgetMonthType, { nullable: true })
  month?: BudgetMonthType;
}

@ObjectType()
export class HydratedBudgetCategoryType extends BudgetCategoryType {
  @Field()
  linkId!: string;

  @Field()
  categoryId!: string;

  @Field()
  monthId!: string;

  @Field(() => Float)
  planned!: number;

  @Field(() => Int)
  sortOrder!: number;
}

@InputType()
export class BudgetMonthRecordInput {
  @Field()
  id!: string;

  @Field()
  startAt!: string;

  @Field()
  endAt!: string;

  @Field()
  name!: string;

  @Field(() => Float)
  startingBalance!: number;
}

@InputType()
export class BudgetCategoryInput {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field()
  type!: string;
}

@InputType()
export class BudgetCategoryPlanInput {
  @Field()
  id!: string;

  @Field()
  monthId!: string;

  @Field()
  categoryId!: string;

  @Field(() => Float)
  planned!: number;

  @Field(() => Int)
  sortOrder!: number;
}

@InputType()
export class BudgetTransactionInput {
  @Field()
  id!: string;

  @Field()
  occurredAt!: string;

  @Field(() => Float)
  amount!: number;

  @Field()
  description!: string;

  @Field()
  categoryId!: string;

  @Field()
  type!: string;

  @Field(() => String, { nullable: true })
  createdAt?: string;

  @Field(() => String, { nullable: true })
  updatedAt?: string;
}

@InputType()
export class UpdateBudgetInput {
  @Field(() => Int, { nullable: true })
  id?: number;

  @Field({ nullable: true })
  name?: string;

  @Field()
  currency!: string;

  @Field(() => [BudgetMonthRecordInput])
  months!: BudgetMonthRecordInput[];

  @Field(() => [BudgetCategoryInput])
  categories!: BudgetCategoryInput[];

  @Field(() => [BudgetCategoryPlanInput])
  categoryPlans!: BudgetCategoryPlanInput[];

  @Field(() => [BudgetTransactionInput])
  transactions!: BudgetTransactionInput[];
}

@InputType()
export class CreateBudgetInput {
  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  currency?: string;

  @Field(() => [BudgetMonthRecordInput], { nullable: true })
  months?: BudgetMonthRecordInput[];

  @Field(() => [BudgetCategoryInput], { nullable: true })
  categories?: BudgetCategoryInput[];

  @Field(() => [BudgetCategoryPlanInput], { nullable: true })
  categoryPlans?: BudgetCategoryPlanInput[];

  @Field(() => [BudgetTransactionInput], { nullable: true })
  transactions?: BudgetTransactionInput[];
}

@InputType()
export class TransactionFilterInput {
  @Field(() => ID, { nullable: true })
  monthId?: string;

  @Field(() => ID, { nullable: true })
  categoryId?: string;

  @Field(() => String, { nullable: true })
  type?: string;

  @Field(() => String, { nullable: true })
  occurredFrom?: string;

  @Field(() => String, { nullable: true })
  occurredTo?: string;
}
