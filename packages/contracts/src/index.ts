import { z } from "zod/v4";

export const healthResponseSchema = z.object({
  ok: z.boolean()
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const metaResponseSchema = z.object({
  appName: z.string(),
  apiPort: z.number().int().positive(),
  appOrigin: z.string().url()
});

export type MetaResponse = z.infer<typeof metaResponseSchema>;

export const greetingParamsSchema = z.object({
  name: z.string().trim().min(1).max(64)
});

export type GreetingParams = z.infer<typeof greetingParamsSchema>;

export const greetingQuerySchema = z.object({
  excited: z.coerce.boolean().default(false)
});

export type GreetingQuery = z.infer<typeof greetingQuerySchema>;

export const greetingResponseSchema = z.object({
  message: z.string()
});

export type GreetingResponse = z.infer<typeof greetingResponseSchema>;

export const apiErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string()
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

export const currentUserResponseSchema = z.object({
  user: z.object({
    internalUserId: z.string().uuid(),
    clerkUserId: z.string(),
    sessionId: z.string().nullable()
  })
});

export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;
