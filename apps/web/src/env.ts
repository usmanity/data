import { optionalEnvString, parseClientEnv, z } from "@fernloop/config";

export const webEnv = parseClientEnv(
  {
    VITE_API_BASE_URL: z.string().default("http://localhost:2001"),
    VITE_CLERK_PUBLISHABLE_KEY: optionalEnvString
  },
  import.meta.env
);

export const publicWebConfig = {
  apiBaseUrl: webEnv.VITE_API_BASE_URL,
  clerkPublishableKey: webEnv.VITE_CLERK_PUBLISHABLE_KEY ?? null
} as const;

export const isClerkConfigured = Boolean(publicWebConfig.clerkPublishableKey);
