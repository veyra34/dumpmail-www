"use server";

import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import { blake2b } from "@noble/hashes/blake2.js";
import { Octokit } from "octokit";
import crypto from "crypto";
import createServerSupabase from "@/integrations/supabase/server";
import { cookies } from "next/headers";

const { decodeUTF8, decodeBase64, encodeBase64 } = naclUtil;

// ---------------------------------------------------------------------------
// Config — set GITHUB_REPO_OWNER and GITHUB_REPO_NAME in your .env.local
// ---------------------------------------------------------------------------
const SOURCE_OWNER = process.env.GITHUB_REPO_OWNER ?? "";
const SOURCE_REPO = process.env.GITHUB_REPO_NAME ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

// ---------------------------------------------------------------------------
// GitHub App Auth Helpers
// ---------------------------------------------------------------------------

function getPrivateKey(): string {
  const rawKey = process.env.GITHUB_APP_PRIVATE_KEY || "";
  if (!rawKey) return "";
  if (rawKey.startsWith("LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQ")) {
    return Buffer.from(rawKey, "base64").toString("utf-8");
  }
  if (rawKey.includes("-----BEGIN")) {
    return rawKey.replace(/\\n/g, "\n");
  }
  return rawKey.replace(/\\n/g, "\n");
}

function generateGitHubAppJwt(): string {
  const appId = process.env.GITHUB_APP_ID;
  if (!appId) throw new Error("Missing GITHUB_APP_ID env var");
  
  const privateKey = getPrivateKey();
  if (!privateKey) throw new Error("Missing GITHUB_APP_PRIVATE_KEY env var");

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 540, // 9 minutes
    iss: appId
  };

  const base64UrlEncode = (str: string) => {
    return Buffer.from(str)
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  };

  const base64Header = base64UrlEncode(JSON.stringify(header));
  const base64Payload = base64UrlEncode(JSON.stringify(payload));
  const tokenInput = `${base64Header}.${base64Payload}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(tokenInput);
  const signature = signer.sign(privateKey, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${tokenInput}.${signature}`;
}

async function getInstallationAccessToken(installationId: string): Promise<string> {
  const jwt = generateGitHubAppJwt();
  const res = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Dumpmail-App",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to generate installation token: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  return data.token;
}

async function getInstallationOwner(installationId: string): Promise<string> {
  const jwt = generateGitHubAppJwt();
  const res = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Dumpmail-App",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch installation details: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  return data.account.login;
}

async function getGitHubAppClient(
  supabaseUserId: string,
  allowMissingRepo = false
): Promise<{ token: string; owner: string; repo: string }> {
  if (!supabaseUserId) {
    throw new Error("No user ID provided");
  }

  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.admin.getUserById(supabaseUserId);
  if (error || !data?.user) {
    throw new Error(`Unable to fetch user from database: ${error?.message || "User not found"}`);
  }

  const installationId = data.user.user_metadata?.github_installation_id;
  const repositoryId = data.user.user_metadata?.github_repository_id;
  let repoName = data.user.user_metadata?.github_repository_name;
  let repoOwner = data.user.user_metadata?.github_repository_owner;
  const permissionError = data.user.user_metadata?.github_repo_permission_error === true;

  if (!installationId) {
    throw new Error("GitHub Integration Needed please signin");
  }

  if (!allowMissingRepo && (!repositoryId || permissionError)) {
    throw new Error("Action Required: Repository Permission Needed");
  }

  let token = "";
  try {
    token = await getInstallationAccessToken(String(installationId));
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("404")) {
      console.warn(`[getGitHubAppClient] Installation ${installationId} returned 404. Cleaning up user metadata.`);
      try {
        const currentMeta = data.user.user_metadata || {};
        await supabase.auth.admin.updateUserById(supabaseUserId, {
          user_metadata: {
            ...currentMeta,
            github_installation_id: null,
            github_repository_id: null,
            github_repository_name: null,
            github_repository_owner: null,
            github_repo_permission_error: false,
          }
        });
      } catch (dbErr) {
        console.error("[getGitHubAppClient] Failed to clean up user metadata:", dbErr);
      }
      throw new Error("GitHub App uninstalled");
    }
    throw err;
  }

  // If repoName or repoOwner is missing but repositoryId is present, resolve from GitHub
  if (repositoryId && (!repoName || !repoOwner)) {
    try {
      const res = await fetch(`https://api.github.com/repositories/${repositoryId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "Dumpmail-App",
        },
        cache: "no-store",
      });
      if (res.ok) {
        const repoDetail = await res.json();
        repoName = repoDetail.name;
        repoOwner = repoDetail.owner?.login;
        // Cache in user metadata
        const currentMeta = data.user.user_metadata || {};
        await supabase.auth.admin.updateUserById(supabaseUserId, {
          user_metadata: {
            ...currentMeta,
            github_repository_name: repoName,
            github_repository_owner: repoOwner,
          }
        });
      }
    } catch (err) {
      console.error("[getGitHubAppClient] Failed to resolve repository details by ID:", err);
    }
  }

  // Fallbacks if not resolved
  if (!repoName) {
    repoName = SOURCE_REPO;
  }
  if (!repoOwner) {
    repoOwner = await getInstallationOwner(String(installationId));
  }

  return { token, owner: repoOwner, repo: repoName };
}

/** Handles GitHub API errors and updates user metadata if a permission error occurs. Returns true if it was a repository permission error. */
async function handleGitHubError(supabaseUserId: string, err: any): Promise<boolean> {
  const status = err?.status || err?.response?.status;
  const errMsg = err instanceof Error ? err.message : String(err);
  const isResourceNotAccessible = errMsg.toLowerCase().includes("resource not accessible by integration");

  if (status === 403 || status === 404 || isResourceNotAccessible) {
    try {
      const { token, owner, repo } = await getGitHubAppClient(supabaseUserId, true);
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "Dumpmail-App",
        },
        cache: "no-store",
      });
      
      if (!repoRes.ok || isResourceNotAccessible) {
        console.warn(`[handleGitHubError] Repository ${owner}/${repo} itself is inaccessible (${repoRes.status}) or resource not accessible. Setting repo permission error flag.`);
        const supabase = createServerSupabase();
        const { data: userData } = await supabase.auth.admin.getUserById(supabaseUserId);
        if (userData?.user) {
          const currentMeta = userData.user.user_metadata || {};
          await supabase.auth.admin.updateUserById(supabaseUserId, {
            user_metadata: {
              ...currentMeta,
              github_repo_permission_error: true,
            }
          });
        }
        return true;
      } else {
        console.log(`[handleGitHubError] Repository ${owner}/${repo} is accessible. This is a workflow-level issue (actions disabled or missing file).`);
      }
    } catch (checkErr) {
      console.error("[handleGitHubError] Error checking repository access:", checkErr);
    }
  }
  return false;
}


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

/** Create an Octokit instance configured with the auth token. */
function getOctokit(token: string): Octokit {
  return new Octokit({
    auth: token,
    request: {
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  });
}

/** Get the authenticated user's GitHub login from the token. */
async function getGitHubLogin(token: string): Promise<string> {
  const octokit = getOctokit(token);
  const { data } = await octokit.rest.users.getAuthenticated();
  return data.login;
}

/** Fork SOURCE_OWNER/SOURCE_REPO into the authenticated user's account. */
async function forkRepoInternal(token: string): Promise<void> {
  if (!SOURCE_OWNER || !SOURCE_REPO) {
    throw new Error(
      "GITHUB_REPO_OWNER and GITHUB_REPO_NAME env vars must be set",
    );
  }

  const octokit = getOctokit(token);
  try {
    await octokit.rest.repos.createFork({
      owner: SOURCE_OWNER,
      repo: SOURCE_REPO,
      default_branch_only: false,
    });
  } catch (err: any) {
    // 202 = fork accepted (async), 422 = already forked — both are fine.
    if (err.status !== 202 && err.status !== 422) {
      throw new Error(`Fork request failed: ${err.status} — ${err.message}`);
    }
  }
}

/** Poll until the forked repo is accessible (up to maxWaitMs). */
async function waitForFork(
  token: string,
  login: string,
  maxWaitMs = 30_000,
): Promise<void> {
  const start = Date.now();
  const octokit = getOctokit(token);
  while (Date.now() - start < maxWaitMs) {
    try {
      await octokit.rest.repos.get({
        owner: login,
        repo: SOURCE_REPO,
      });
      return;
    } catch {
      // Ignore error and try again (repo not ready yet)
    }
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
  const octokit = getOctokit(token);
  const { data } = await octokit.rest.actions.getRepoPublicKey({
    owner: login,
    repo: SOURCE_REPO,
  });
  return {
    key_id: data.key_id,
    key: data.key,
  };
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
  const octokit = getOctokit(token);
  await octokit.rest.actions.createOrUpdateRepoSecret({
    owner: login,
    repo: SOURCE_REPO,
    secret_name: secretName,
    encrypted_value: encryptedValue,
    key_id: keyId,
  });
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
      USER_ID: supabaseUserId,
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
      USER_ID: supabaseUserId,
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

/** Get the status of the scheduler workflow. */
export async function getWorkflowStatus(
  supabaseUserId: string,
): Promise<{ ok: true; state: string } | { ok: false; error: string }> {
  try {
    const { token: githubToken, owner: login, repo } = await getGitHubAppClient(supabaseUserId);
    const octokit = getOctokit(githubToken);
    const { data } = await octokit.rest.actions.getWorkflow({
      owner: login,
      repo: repo,
      workflow_id: "schedule-send-mails.yml",
    });
    return { ok: true, state: data.state };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[getWorkflowStatus]", message);
    const isPermissionError = await handleGitHubError(supabaseUserId, err);
    return { ok: false, error: isPermissionError ? "Action Required: Repository Permission Needed" : message };
  }
}

/** Enable or disable the scheduler workflow. */
export async function toggleWorkflow(
  supabaseUserId: string,
  enable: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { token: githubToken, owner: login, repo } = await getGitHubAppClient(supabaseUserId);
    const octokit = getOctokit(githubToken);
    if (enable) {
      await octokit.rest.actions.enableWorkflow({
        owner: login,
        repo: repo,
        workflow_id: "schedule-send-mails.yml",
      });
    } else {
      await octokit.rest.actions.disableWorkflow({
        owner: login,
        repo: repo,
        workflow_id: "schedule-send-mails.yml",
      });
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[toggleWorkflow]", message);
    const isPermissionError = await handleGitHubError(supabaseUserId, err);
    return { ok: false, error: isPermissionError ? "Action Required: Repository Permission Needed" : message };
  }
}

/** List runs for the scheduler workflow with pagination. */
export async function listWorkflowRuns(
  supabaseUserId: string,
  page = 1,
  perPage = 5,
): Promise<{ ok: true; runs: any[]; totalCount: number } | { ok: false; error: string }> {
  try {
    const { token: githubToken, owner: login, repo } = await getGitHubAppClient(supabaseUserId);
    const octokit = getOctokit(githubToken);
    const { data } = await octokit.rest.actions.listWorkflowRuns({
      owner: login,
      repo: repo,
      workflow_id: "schedule-send-mails.yml",
      page,
      per_page: perPage,
    });
    return {
      ok: true,
      runs: data.workflow_runs,
      totalCount: data.total_count,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[listWorkflowRuns]", message);
    const isPermissionError = await handleGitHubError(supabaseUserId, err);
    return { ok: false, error: isPermissionError ? "Action Required: Repository Permission Needed" : message };
  }
}

/** Get details of a specific workflow run, including jobs and steps. */
export async function getWorkflowRunDetails(
  supabaseUserId: string,
  runId: number,
): Promise<{ ok: true; run: any; jobs: any[] } | { ok: false; error: string }> {
  try {
    const { token: githubToken, owner: login, repo } = await getGitHubAppClient(supabaseUserId);
    const octokit = getOctokit(githubToken);
    
    const [runRes, jobsRes] = await Promise.all([
      octokit.rest.actions.getWorkflowRun({
        owner: login,
        repo: repo,
        run_id: runId,
      }),
      octokit.rest.actions.listJobsForWorkflowRun({
        owner: login,
        repo: repo,
        run_id: runId,
      }),
    ]);
    
    return {
      ok: true,
      run: runRes.data,
      jobs: jobsRes.data.jobs,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[getWorkflowRunDetails]", message);
    const isPermissionError = await handleGitHubError(supabaseUserId, err);
    return { ok: false, error: isPermissionError ? "Action Required: Repository Permission Needed" : message };
  }
}

/** Get workflow billable usage statistics. */
export async function getWorkflowUsageStats(
  supabaseUserId: string,
): Promise<{ ok: true; usage: any } | { ok: false; error: string }> {
  try {
    const { token: githubToken, owner: login, repo } = await getGitHubAppClient(supabaseUserId);
    const octokit = getOctokit(githubToken);
    const { data } = await octokit.rest.actions.getWorkflowUsage({
      owner: login,
      repo: repo,
      workflow_id: "schedule-send-mails.yml",
    });
    return { ok: true, usage: data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[getWorkflowUsageStats]", message);
    const isPermissionError = await handleGitHubError(supabaseUserId, err);
    return { ok: false, error: isPermissionError ? "Action Required: Repository Permission Needed" : message };
  }
}

/** Get the repository owner and name for the user's fork. */
export async function getRepoInfo(
  supabaseUserId: string,
): Promise<{ ok: true; owner: string; repo: string } | { ok: false; error: string }> {
  try {
    const { owner: login, repo } = await getGitHubAppClient(supabaseUserId, true);
    return { ok: true, owner: login, repo };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[getRepoInfo]", message);
    return { ok: false, error: message };
  }
}

/** Verify user repository selection for GitHub App installation and save. */
export async function verifyAndSaveInstallation(
  supabaseUserId: string,
  installationId: string,
): Promise<{ ok: true; matched: boolean; repositoryId: string | null } | { ok: false; error: string }> {
  try {
    if (!supabaseUserId) throw new Error("No user ID provided");
    if (!installationId) throw new Error("No installation ID provided");

    // Clear the OAuth cookie if present (we don't need it anymore)
    try {
      const cookieStore = await cookies();
      cookieStore.set("github_oauth_token", "", { maxAge: 0, path: "/" });
    } catch {}

    // Generate an installation access token using our GitHub App JWT
    const installationToken = await getInstallationAccessToken(installationId);
    const login = await getInstallationOwner(installationId);

    const upstreamFullName = `${SOURCE_OWNER}/${SOURCE_REPO}`.toLowerCase();
    let matchedRepo: any = null;

    console.log("[verifyAndSaveInstallation] Starting repository verification.");
    console.log(`[verifyAndSaveInstallation] Upstream repo: ${upstreamFullName}`);

    // Step 1: Direct check using installation owner and SOURCE_REPO name
    const directRepoUrl = `https://api.github.com/repos/${login}/${SOURCE_REPO}`;
    console.log(`[verifyAndSaveInstallation] Step 1: Trying direct check on: ${directRepoUrl}`);
    try {
      const directRes = await fetch(directRepoUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${installationToken}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "Dumpmail-App",
        },
        cache: "no-store",
      });

      if (directRes.ok) {
        const fullRepo = await directRes.json();
        console.log(`[verifyAndSaveInstallation] Direct check succeeded. Fork: ${fullRepo.fork}`);
        const parentName = fullRepo.parent?.full_name?.toLowerCase() || "";
        const sourceName = fullRepo.source?.full_name?.toLowerCase() || "";
        
        const isForkMatch = fullRepo.fork === true && (parentName === upstreamFullName || sourceName === upstreamFullName);
        const isNameMatch = fullRepo.name?.toLowerCase() === SOURCE_REPO.toLowerCase();

        if (isForkMatch || isNameMatch) {
          console.log(`[verifyAndSaveInstallation] Match found via direct check: ${fullRepo.full_name}`);
          matchedRepo = fullRepo;
        }
      } else {
        console.log(`[verifyAndSaveInstallation] Direct check returned status: ${directRes.status}`);
      }
    } catch (directErr) {
      console.warn("[verifyAndSaveInstallation] Direct check failed:", directErr);
    }

    // Step 2: Fallback to listing installation repositories if direct check did not match
    if (!matchedRepo) {
      console.log("[verifyAndSaveInstallation] Step 2: Falling back to listing installation repositories...");
      const res = await fetch("https://api.github.com/installation/repositories?per_page=100", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${installationToken}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "Dumpmail-App",
        },
        cache: "no-store",
      });

      if (res.ok) {
        const payload = await res.json();
        const repositories = payload.repositories || [];
        console.log(`[verifyAndSaveInstallation] Selected repos in installation (${repositories.length}):`, repositories.map((r: any) => r.full_name));

        for (const repo of repositories) {
          console.log(`[verifyAndSaveInstallation] Inspecting repository: ${repo.full_name} (fork: ${repo.fork})`);
          if (repo.fork === true) {
            const repoDetailUrl = `https://api.github.com/repos/${repo.full_name}`;
            console.log(`[verifyAndSaveInstallation] Fetching repository details from: ${repoDetailUrl}`);
            const repoDetailRes = await fetch(repoDetailUrl, {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${installationToken}`,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "Dumpmail-App",
              },
              cache: "no-store",
            });

            console.log(`[verifyAndSaveInstallation] Details response status: ${repoDetailRes.status}`);
            if (repoDetailRes.ok) {
              const fullRepo = await repoDetailRes.json();
              const parentName = fullRepo.parent?.full_name?.toLowerCase() || "";
              const sourceName = fullRepo.source?.full_name?.toLowerCase() || "";
              console.log(`[verifyAndSaveInstallation] Repository: ${repo.full_name} | Parent: ${parentName} | Source: ${sourceName}`);

              if (parentName === upstreamFullName || sourceName === upstreamFullName) {
                console.log(`[verifyAndSaveInstallation] Match found by parent/source check: ${repo.full_name}`);
                matchedRepo = repo;
                break;
              } else {
                console.log(`[verifyAndSaveInstallation] Parent/source did not match upstream.`);
              }
            } else {
              const errText = await repoDetailRes.text();
              console.warn(`[verifyAndSaveInstallation] Failed to fetch details for ${repo.full_name}: ${repoDetailRes.status} - ${errText}`);
            }
          } else {
            console.log(`[verifyAndSaveInstallation] Skipping non-fork repository during primary check: ${repo.full_name}`);
          }
        }

        // Fallback: Check if any repository name matches the target SOURCE_REPO name
        if (!matchedRepo) {
          console.log(`[verifyAndSaveInstallation] No fork match found by parent/source. Trying fallback name match for: ${SOURCE_REPO}`);
          for (const repo of repositories) {
            if (repo.name?.toLowerCase() === SOURCE_REPO.toLowerCase()) {
              console.log(`[verifyAndSaveInstallation] Match found by fallback name check: ${repo.full_name}`);
              matchedRepo = repo;
              break;
            }
          }
        }
      } else {
        const errorText = await res.text();
        throw new Error(`GitHub API error (installation/repositories): ${res.status} - ${errorText}`);
      }
    }

    if (matchedRepo) {
      console.log(`[verifyAndSaveInstallation] Successfully matched repository: ${matchedRepo.full_name} (ID: ${matchedRepo.id})`);
    } else {
      console.warn("[verifyAndSaveInstallation] Verification failed. No matching repository found in installation.");
    }

    const supabase = createServerSupabase();

    if (matchedRepo) {
      // Save repository details alongside installation_id in database user metadata
      const { error } = await supabase.auth.admin.updateUserById(supabaseUserId, {
        user_metadata: {
          github_installation_id: installationId,
          github_repository_id: matchedRepo.id.toString(),
          github_repository_name: matchedRepo.name,
          github_repository_owner: matchedRepo.owner.login,
          github_repo_permission_error: false,
        }
      });
      if (error) throw error;
      return { ok: true, matched: true, repositoryId: matchedRepo.id.toString() };
    } else {
      // Save installation_id but flag that the required repository was not found/selected
      const { error } = await supabase.auth.admin.updateUserById(supabaseUserId, {
        user_metadata: {
          github_installation_id: installationId,
          github_repository_id: null,
          github_repo_permission_error: true,
        }
      });
      if (error) throw error;
      return { ok: true, matched: false, repositoryId: null };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[verifyAndSaveInstallation]", message);
    if (message.includes("404")) {
      try {
        const supabase = createServerSupabase();
        const { data: userData } = await supabase.auth.admin.getUserById(supabaseUserId);
        if (userData?.user) {
          const currentMeta = userData.user.user_metadata || {};
          await supabase.auth.admin.updateUserById(supabaseUserId, {
            user_metadata: {
              ...currentMeta,
              github_installation_id: null,
              github_repository_id: null,
              github_repository_name: null,
              github_repository_owner: null,
              github_repo_permission_error: false,
            }
          });
        }
      } catch (dbErr) {
        console.error("[verifyAndSaveInstallation] Failed to clean up user metadata:", dbErr);
      }
      return { ok: false, error: "GitHub App uninstalled" };
    }
    return { ok: false, error: message };
  }
}

