"use server";

import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import { blake2b } from "@noble/hashes/blake2.js";

const { decodeUTF8, decodeBase64, encodeBase64 } = naclUtil;

// ---------------------------------------------------------------------------
// Config — set GITHUB_REPO_OWNER and GITHUB_REPO_NAME in your .env.local
// ---------------------------------------------------------------------------
const SOURCE_OWNER = process.env.GITHUB_REPO_OWNER ?? "";
const SOURCE_REPO = process.env.GITHUB_REPO_NAME ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type ForkResult =
  | { ok: true; forkFullName: string }
  | { ok: false; error: string };

export type StepResult =
  | { ok: true }
  | { ok: false; error: string };

type GitHubPublicKey = {
  key_id: string;
  key: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Encrypt a secret value using libsodium's crypto_box_seal format.
 *
 * GitHub's secret API requires this exact format:
 *   sealed_box = ephemeral_pk (32 bytes) || nacl.box(msg, nonce, recipient_pk, ephemeral_sk)
 * where nonce = blake2b(ephemeral_pk || recipient_pk, outLen=24)
 *
 * Reference: https://libsodium.gitbook.io/doc/public-key_cryptography/sealed_boxes
 */
function encryptSecret(publicKeyBase64: string, secretValue: string): string {
  const recipientPublicKey: Uint8Array = decodeBase64(publicKeyBase64);
  const messageBytes: Uint8Array = decodeUTF8(secretValue);

  // 1. Generate ephemeral keypair
  const ephemeralKeyPair = nacl.box.keyPair();

  // 2. Derive nonce = blake2b(ephemeral_pk || recipient_pk, outLen=24)
  //    This is exactly what libsodium does internally in crypto_box_seal.
  const nonceInput = new Uint8Array(
    ephemeralKeyPair.publicKey.length + recipientPublicKey.length,
  );
  nonceInput.set(ephemeralKeyPair.publicKey, 0);
  nonceInput.set(recipientPublicKey, ephemeralKeyPair.publicKey.length);
  // blake2b with 24-byte output (192 bits = nacl.box.nonceLength)
  const nonce: Uint8Array = blake2b(nonceInput, { dkLen: 24 });

  // 3. Encrypt
  const encrypted: Uint8Array | null = nacl.box(
    messageBytes,
    nonce,
    recipientPublicKey,
    ephemeralKeyPair.secretKey,
  );

  if (encrypted === null) {
    throw new Error("Encryption failed");
  }

  // 4. Output format: ephemeral_pk (32) || ciphertext (msg_len + 16 byte MAC)
  //    NOTE: nonce is NOT included — the receiver derives it the same way.
  const combined = new Uint8Array(
    ephemeralKeyPair.publicKey.length + encrypted.length,
  );
  combined.set(ephemeralKeyPair.publicKey, 0);
  combined.set(encrypted, ephemeralKeyPair.publicKey.length);

  return encodeBase64(combined);
}

/** Sleep for a given number of milliseconds. */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Call the GitHub REST API with the user's provider token. */
async function ghFetch(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

/** Get the authenticated user's GitHub login from the token. */
async function getGitHubLogin(token: string): Promise<string> {
  const res = await ghFetch("/user", token);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to get GitHub user: ${res.status} — ${body}`);
  }
  const data = (await res.json()) as { login: string };
  return data.login;
}

/** Fork SOURCE_OWNER/SOURCE_REPO into the authenticated user's account. */
async function forkRepoInternal(token: string): Promise<void> {
  if (!SOURCE_OWNER || !SOURCE_REPO) {
    throw new Error(
      "GITHUB_REPO_OWNER and GITHUB_REPO_NAME env vars must be set",
    );
  }

  const res = await ghFetch(
    `/repos/${SOURCE_OWNER}/${SOURCE_REPO}/forks`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ default_branch_only: false }),
    },
  );

  // 202 = fork accepted (async), 422 = already forked — both are fine.
  if (!res.ok && res.status !== 202 && res.status !== 422) {
    const body = await res.text();
    throw new Error(`Fork request failed: ${res.status} — ${body}`);
  }
  // GitHub returns 202 Accepted — the fork is created asynchronously.
}

/** Poll until the forked repo is accessible (up to maxWaitMs). */
async function waitForFork(
  token: string,
  login: string,
  maxWaitMs = 30_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await ghFetch(`/repos/${login}/${SOURCE_REPO}`, token);
    if (res.ok) return;
    await sleep(2_000);
  }
  throw new Error(
    `Timed out waiting for fork ${login}/${SOURCE_REPO} to become available`,
  );
}

/** Get the repo's Actions public key for secret encryption. */
async function getRepoPublicKey(
  token: string,
  login: string,
): Promise<GitHubPublicKey> {
  const res = await ghFetch(
    `/repos/${login}/${SOURCE_REPO}/actions/secrets/public-key`,
    token,
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to get public key: ${res.status} — ${body}`);
  }
  return res.json() as Promise<GitHubPublicKey>;
}

/** Create or update a single Actions secret on the forked repo. */
async function putSecret(
  token: string,
  login: string,
  secretName: string,
  secretValue: string,
  keyId: string,
  encryptedValue: string,
): Promise<void> {
  void secretValue; // value already encrypted externally
  const res = await ghFetch(
    `/repos/${login}/${SOURCE_REPO}/actions/secrets/${secretName}`,
    token,
    {
      method: "PUT",
      body: JSON.stringify({
        encrypted_value: encryptedValue,
        key_id: keyId,
      }),
    },
  );
  if (!res.ok && res.status !== 204) {
    const body = await res.text();
    throw new Error(
      `Failed to set secret ${secretName}: ${res.status} — ${body}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Public server action
// ---------------------------------------------------------------------------

/**
 * Orchestrates the full GitHub fork + secret injection flow.
 *
 * @param githubToken  The raw GitHub OAuth access token (session.provider_token)
 * @param supabaseUserId  The authenticated user's Supabase UUID
 */
export async function forkAndConfigureRepo(
  githubToken: string,
  supabaseUserId: string,
): Promise<ForkResult> {
  try {
    if (!githubToken) throw new Error("No GitHub provider token available");
    if (!supabaseUserId) throw new Error("No Supabase user ID provided");

    // 1. Get the GitHub login for the authenticated user
    const login = await getGitHubLogin(githubToken);

    // 2. Fork the repo (async on GitHub side)
    await forkRepoInternal(githubToken);

    // 3. Wait until the fork is ready
    await waitForFork(githubToken, login);

    // 4. Get the fork's Actions public key
    const { key_id, key } = await getRepoPublicKey(githubToken, login);

    // 5. Encrypt all three secrets
    const secrets: Record<string, string> = {
      SUPABASE_USER_ID: supabaseUserId,
      SUPABASE_URL: SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY: SUPABASE_PUBLISHABLE_KEY,
    };

    // 6. Push each secret to the forked repo
    for (const [name, value] of Object.entries(secrets)) {
      const encryptedValue = encryptSecret(key, value);
      await putSecret(githubToken, login, name, value, key_id, encryptedValue);
    }

    return { ok: true, forkFullName: `${login}/${SOURCE_REPO}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[forkAndConfigureRepo]", message);
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Split server actions for granular UI progress tracking
// ---------------------------------------------------------------------------

/**
 * Step 1 of 2: Fork the repo and wait for it to be ready.
 * Returns the GitHub login (used by the next step).
 */
export async function forkRepoStep(
  githubToken: string,
): Promise<{ ok: true; login: string } | { ok: false; error: string }> {
  try {
    if (!githubToken) throw new Error("No GitHub provider token available");
    const login = await getGitHubLogin(githubToken);
    await forkRepoInternal(githubToken);
    await waitForFork(githubToken, login);
    return { ok: true, login };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[forkRepoStep]", message);
    return { ok: false, error: message };
  }
}

/**
 * Step 2 of 2: Inject Actions secrets into the already-forked repo.
 */
export async function injectSecretsStep(
  githubToken: string,
  login: string,
  supabaseUserId: string,
): Promise<StepResult> {
  try {
    if (!githubToken) throw new Error("No GitHub provider token available");
    if (!login) throw new Error("GitHub login is required");
    if (!supabaseUserId) throw new Error("No Supabase user ID provided");

    const { key_id, key } = await getRepoPublicKey(githubToken, login);

    const secrets: Record<string, string> = {
      SUPABASE_USER_ID: supabaseUserId,
      SUPABASE_URL: SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY: SUPABASE_PUBLISHABLE_KEY,
    };

    for (const [name, value] of Object.entries(secrets)) {
      const encryptedValue = encryptSecret(key, value);
      await putSecret(githubToken, login, name, value, key_id, encryptedValue);
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[injectSecretsStep]", message);
    return { ok: false, error: message };
  }
}
