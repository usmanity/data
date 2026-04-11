import { createClerkClient, type ClerkClient, type SessionAuthObject } from "@clerk/backend";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../env";
import { resolveInternalUserFromClerkUserId, type ResolvedInternalUser } from "./resolve-internal-user";

export type RequestAuthContext = ResolvedInternalUser & {
  sessionId: string | null;
};

export function isClerkConfigured(): boolean {
  return Boolean(env.CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY);
}

export function createConfiguredClerkClient(): ClerkClient | null {
  if (!isClerkConfigured()) {
    return null;
  }

  return createClerkClient({
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    secretKey: env.CLERK_SECRET_KEY,
    jwtKey: env.CLERK_JWT_KEY
  });
}

export async function requireSessionAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  request.auth = null;

  const clerk = request.server.clerk;

  if (!clerk) {
    await reply.code(503).send({
      code: "clerk_not_configured",
      message:
        "Clerk is not configured. Set CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY before calling protected API routes."
    });
    return;
  }

  const requestState = await clerk.authenticateRequest(toWebRequest(request), {
    acceptsToken: "session_token",
    authorizedParties:
      request.server.env.CLERK_AUTHORIZED_PARTIES.length > 0
        ? request.server.env.CLERK_AUTHORIZED_PARTIES
        : [request.server.env.APP_ORIGIN]
  });

  if (!requestState.isAuthenticated) {
    await reply.code(401).send({
      code: "unauthorized",
      message: "A valid Clerk session token is required."
    });
    return;
  }

  const auth = requestState.toAuth();

  if (!auth.isAuthenticated || !auth.userId) {
    await reply.code(401).send({
      code: "unauthorized",
      message: "The provided Clerk token did not resolve to an authenticated user."
    });
    return;
  }

  request.auth = await toRequestAuthContext(auth.userId, auth.sessionId);
}

function toWebRequest(request: FastifyRequest): Request {
  const url = new URL(request.raw.url ?? request.url, request.server.env.API_BASE_URL);
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        headers.append(key, entry);
      }

      continue;
    }

    if (typeof value === "string") {
      headers.set(key, value);
    }
  }

  return new Request(url, {
    method: request.method,
    headers
  });
}

async function toRequestAuthContext(
  clerkUserId: string,
  sessionId: SessionAuthObject["sessionId"]
): Promise<RequestAuthContext> {
  const internalUser = await resolveInternalUserFromClerkUserId(clerkUserId);

  return {
    ...internalUser,
    sessionId
  };
}
