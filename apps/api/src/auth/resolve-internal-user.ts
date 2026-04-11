import { findOrCreateUserByClerkUserId } from "@fernloop/db";

export type ResolvedInternalUser = {
  internalUserId: string;
  clerkUserId: string;
};

export async function resolveInternalUserFromClerkUserId(
  clerkUserId: string
): Promise<ResolvedInternalUser> {
  const user = await findOrCreateUserByClerkUserId(clerkUserId);

  return {
    internalUserId: user.id,
    clerkUserId: user.clerkUserId
  };
}
