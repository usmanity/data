import { csvEnvString, optionalEnvString, parseServerEnv } from "@fernloop/config";
import { z } from "zod/v4";

const defaultApiPort = Number(process.env.PORT ?? process.env.API_PORT ?? 2001);

export const env = parseServerEnv({
  API_PORT: z.coerce.number().default(defaultApiPort),
  APP_ORIGIN: z.string().default("http://localhost:2002"),
  API_BASE_URL: z.string().default("http://localhost:2001"),
  DATABASE_URL: z.string().default("postgres://postgres:postgres@localhost:5432/fernloop_template"),
  CLERK_PUBLISHABLE_KEY: optionalEnvString,
  CLERK_SECRET_KEY: optionalEnvString,
  CLERK_JWT_KEY: optionalEnvString,
  CLERK_AUTHORIZED_PARTIES: csvEnvString
});
