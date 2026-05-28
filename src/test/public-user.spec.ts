import { expect, test } from "@playwright/test";
import { ensurePublicUserForClient, type AppSupabaseClient, type PublicUserRecord } from "../lib/public-user";


type AuthUser = {
  id: string;
  email?: string;
  user_metadata: Record<string, string>;
};

type QueryResult<T> = Promise<{ data: T | null; error: Error | null }>;

class FakeSupabaseQuery {
  private selectedTable: string;
  private rows: Record<string, PublicUserRecord>;
  private pendingUpsert: Partial<PublicUserRecord> | null = null;
  private pendingUpdate: Partial<PublicUserRecord> | null = null;
  private pendingDelete = false;
  private pendingError: Error | null = null;
  private filters: Record<string, string> = {};

  constructor(selectedTable: string, rows: Record<string, PublicUserRecord>) {
    this.selectedTable = selectedTable;
    this.rows = rows;
  }

  select() {
    return this;
  }

  eq(column: string, value: string) {
    this.filters[column] = value;
    this.applyMutation();
    return this;
  }

  upsert(row: Partial<PublicUserRecord>) {
    const emailConflict = Object.values(this.rows).find((user) => user.email === row.email && user.id !== row.id);
    if (emailConflict) {
      this.pendingError = Object.assign(new Error("duplicate key value violates unique constraint users_email_key"), {
        code: "23505",
      });
    }

    this.pendingUpsert = row;
    return this;
  }

  update(row: Partial<PublicUserRecord>) {
    this.pendingUpdate = row;
    return this;
  }

  delete() {
    this.pendingDelete = true;
    return this;
  }

  async maybeSingle(): QueryResult<PublicUserRecord> {
    if (this.selectedTable !== "users") {
      return { data: null, error: new Error(`Unexpected table ${this.selectedTable}`) };
    }

    const id = this.filters.id;
    return { data: id ? this.rows[id] ?? null : null, error: null };
  }

  async single(): QueryResult<PublicUserRecord> {
    if (this.selectedTable !== "users") {
      return { data: null, error: new Error(`Unexpected table ${this.selectedTable}`) };
    }

    if (this.pendingError) {
      return { data: null, error: this.pendingError };
    }

    if (!this.pendingUpsert) {
      const row = Object.values(this.rows).find((user) => Object.entries(this.filters).every(([key, value]) => user[key as keyof PublicUserRecord] === value));
      return { data: row ?? null, error: null };
    }

    if (!this.pendingUpsert?.id || !this.pendingUpsert.email) {
      return { data: null, error: new Error("Expected users upsert before single") };
    }

    const row: PublicUserRecord = {
      created_at: new Date("2026-05-25T00:00:00.000Z").toISOString(),
      email: this.pendingUpsert.email,
      id: this.pendingUpsert.id,
      name: this.pendingUpsert.name ?? null,
    };
    this.rows[row.id] = row;

    return { data: row, error: null };
  }

  private applyMutation() {
    if (this.selectedTable !== "users") return;

    if (this.pendingUpdate) {
      Object.values(this.rows)
        .filter((user) => Object.entries(this.filters).every(([key, value]) => user[key as keyof PublicUserRecord] === value))
        .forEach((user) => {
          Object.assign(user, this.pendingUpdate);
        });
      this.pendingUpdate = null;
    }

    if (this.pendingDelete) {
      Object.values(this.rows)
        .filter((user) => Object.entries(this.filters).every(([key, value]) => user[key as keyof PublicUserRecord] === value))
        .forEach((user) => {
          delete this.rows[user.id];
        });
      this.pendingDelete = false;
    }
  }
}

function createFakeSupabase(authUser: AuthUser, existingUsers: PublicUserRecord[] = []) {
  const users = Object.fromEntries(existingUsers.map((user) => [user.id, user]));
  const calls: string[] = [];

  const fakeClient = {
    auth: {
      admin: {
        getUserById: async (userId: string) => {
          calls.push(`auth.admin.getUserById:${userId}`);
          return { data: { user: authUser.email === undefined ? { ...authUser, email: undefined } : authUser }, error: null };
        },
      },
    },
    from: (table: string) => {
      calls.push(`from:${table}`);
      return new FakeSupabaseQuery(table, users);
    },
  } as unknown as AppSupabaseClient;

  return { calls, fakeClient, users };
}

test("ensurePublicUserForClient returns an existing public user without touching auth admin", async () => {
  const existingUser: PublicUserRecord = {
    id: "user-1",
    email: "person@example.com",
    name: "Existing User",
    created_at: "2026-05-25T00:00:00.000Z",
  };
  const { calls, fakeClient } = createFakeSupabase(
    { id: existingUser.id, email: existingUser.email, user_metadata: { full_name: "Auth Name" } },
    [existingUser],
  );

  const user = await ensurePublicUserForClient(fakeClient, existingUser.id);

  expect(user).toEqual(existingUser);
  expect(calls).toEqual(["from:users"]);
});

test("ensurePublicUserForClient creates public.users before FK-backed workspace inserts", async () => {
  const authUser = {
    id: "auth-user-1",
    email: "new@example.com",
    user_metadata: { full_name: "New Person" },
  };
  const { calls, fakeClient, users } = createFakeSupabase(authUser);

  const user = await ensurePublicUserForClient(fakeClient, authUser.id);

  expect(user).toMatchObject({
    id: authUser.id,
    email: authUser.email,
    name: "New Person",
  });
  expect(users[authUser.id]).toMatchObject({
    id: authUser.id,
    email: authUser.email,
    name: "New Person",
  });
  expect(calls).toEqual(["from:users", `auth.admin.getUserById:${authUser.id}`, "from:users"]);
});

test("ensurePublicUserForClient merges an old email-matched public user into the auth id", async () => {
  const oldUser: PublicUserRecord = {
    id: "old-public-user",
    email: "same@example.com",
    name: "Old Person",
    created_at: "2026-05-20T00:00:00.000Z",
  };
  const authUser = {
    id: "auth-user-2",
    email: oldUser.email,
    user_metadata: { full_name: "Same Person" },
  };
  const { calls, fakeClient, users } = createFakeSupabase(authUser, [oldUser]);

  const user = await ensurePublicUserForClient(fakeClient, authUser.id);

  expect(user).toMatchObject({
    id: authUser.id,
    email: authUser.email,
    name: "Same Person",
  });
  expect(users[authUser.id]).toMatchObject({
    id: authUser.id,
    email: authUser.email,
    name: "Same Person",
  });
  expect(users[oldUser.id]).toBeUndefined();
  expect(calls).toContain("from:campaigns");
  expect(calls).toContain("from:email_templates");
  expect(calls).toContain("from:sender_accounts");
});

test("ensurePublicUserForClient fails clearly when auth user has no email", async () => {
  const authUser = {
    id: "auth-user-without-email",
    user_metadata: {},
  };
  const { fakeClient } = createFakeSupabase(authUser);

  await expect(ensurePublicUserForClient(fakeClient, authUser.id)).rejects.toThrow(
    "Authenticated user must have an email before creating workspace records",
  );
});
