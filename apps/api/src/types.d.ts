import "fastify";
import type { ClerkClient } from "@clerk/backend";
import type { env } from "./env";
import type { RequestAuthContext } from "./auth/clerk";

declare module "fastify" {
  interface FastifyInstance {
    env: typeof env;
    clerk: ClerkClient | null;
  }

  interface FastifyRequest {
    auth: RequestAuthContext | null;
  }
}
