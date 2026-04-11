import { z } from "zod/v4";
export { z } from "zod/v4";

export const optionalEnvString = z.string().trim().min(1).optional();

export const csvEnvString = z
  .string()
  .optional()
  .transform((value) =>
    value
      ? value
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      : []
  );

export function parseServerEnv<TShape extends z.ZodRawShape>(
  shape: TShape,
  input: Record<string, unknown> = process.env
): z.infer<z.ZodObject<TShape>> {
  return z.object(shape).parse(input);
}

export function parseClientEnv<TShape extends z.ZodRawShape>(
  shape: TShape,
  input: Record<string, unknown>
): z.infer<z.ZodObject<TShape>> {
  return z.object(shape).parse(input);
}

export const envVisibilityRules = {
  publicPrefix: "VITE_",
  localFile: ".env",
  exampleFile: ".env.example"
} as const;
