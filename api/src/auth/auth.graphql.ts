import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class MeType {
  @Field(() => ID)
  id!: number;

  @Field()
  email!: string;

  @Field()
  displayName!: string;

  @Field({ nullable: true })
  avatarUrl?: string;
}
