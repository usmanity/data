import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { healthResponseSchema, metaResponseSchema } from "@fernloop/contracts";

export const metaRoutes: FastifyPluginAsyncZod = async (app) => {
  app.route({
    method: "GET",
    url: "/health",
    schema: {
      tags: ["system"],
      summary: "Health check",
      response: {
        200: healthResponseSchema
      }
    },
    handler: async () => {
      return {
        ok: true
      };
    }
  });

  app.route({
    method: "GET",
    url: "/v1/meta",
    schema: {
      tags: ["system"],
      summary: "Application metadata",
      response: {
        200: metaResponseSchema
      }
    },
    handler: async () => {
      return {
        appName: "fernloop-template",
        apiPort: app.env.API_PORT,
        appOrigin: app.env.APP_ORIGIN
      };
    }
  });
};

