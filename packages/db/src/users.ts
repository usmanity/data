import { eq } from "drizzle-orm";
import { db } from "./client";
import { users, type UserRow } from "./schema";

export async function findUserByClerkUserId(clerkUserId: string): Promise<UserRow | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId)
  });

  return user ?? null;
}

export async function findOrCreateUserByClerkUserId(clerkUserId: string): Promise<UserRow> {
  const existingUser = await findUserByClerkUserId(clerkUserId);

  if (existingUser) {
    return existingUser;
  }

  const insertedUsers = await db
    .insert(users)
    .values({ clerkUserId })
    .onConflictDoNothing({ target: users.clerkUserId })
    .returning();

  if (insertedUsers[0]) {
    return insertedUsers[0];
  }

  const fallbackUser = await findUserByClerkUserId(clerkUserId);

  if (!fallbackUser) {
    throw new Error(`Unable to resolve internal user for Clerk ID: ${clerkUserId}`);
  }

  return fallbackUser;
}

