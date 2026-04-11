import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  greetingParamsSchema,
  greetingQuerySchema,
  greetingResponseSchema
} from "@fernloop/contracts";

export const greetingRoutes: FastifyPluginAsyncZod = async (app) => {
  app.route({
    method: "GET",
    url: "/v1/greetings/:name",
    schema: {
      tags: ["examples"],
      summary: "Validated greeting example",
      params: greetingParamsSchema,
      querystring: greetingQuerySchema,
      response: {
        200: greetingResponseSchema
      }
    },
    handler: async (request) => {
      const suffix = request.query.excited ? "!" : ".";

      return {
        message: `Hello, ${request.params.name}${suffix}`
      };
    }
  });
};

