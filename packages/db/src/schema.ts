import { sql } from "drizzle-orm";
import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date())
  },
  (table) => ({
    clerkUserIdIdx: uniqueIndex("users_clerk_user_id_idx").on(table.clerkUserId),
    createdAtIdx: index("users_created_at_idx").on(table.createdAt)
  })
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

export const databaseHealthView = sql`select 1`;
