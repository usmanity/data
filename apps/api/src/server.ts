import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { jsonSchemaTransform, serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { createConfiguredClerkClient } from "./auth/clerk";
import { env } from "./env";
import { authRoutes } from "./routes/auth";
import { greetingRoutes } from "./routes/greeting";
import { metaRoutes } from "./routes/meta";

const app = Fastify({
  logger: {
    transport:
      process.env.NODE_ENV === "development"
        ? {
            target: "pino-pretty"
          }
        : undefined
  }
});

app.decorate("env", env);
app.decorate("clerk", createConfiguredClerkClient());
app.decorateRequest("auth", null);
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(cors, {
  origin: [env.APP_ORIGIN],
  allowedHeaders: ["Authorization", "Content-Type"]
});

await app.register(swagger, {
  openapi: {
    openapi: "3.1.0",
    info: {
      title: "Fernloop Template API",
      version: "0.1.0",
      description: "Local API baseline for the Fernloop template."
    },
    servers: [
      {
        url: env.API_BASE_URL
      }
    ]
  },
  transform: jsonSchemaTransform
});

await app.register(swaggerUi, {
  routePrefix: "/documentation"
});

await app.register(metaRoutes);
await app.register(greetingRoutes);
await app.register(authRoutes);
await app.ready();

await app.listen({
  host: "0.0.0.0",
  port: env.API_PORT
});
