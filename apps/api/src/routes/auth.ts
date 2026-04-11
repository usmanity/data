import { apiErrorResponseSchema, currentUserResponseSchema } from "@fernloop/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireSessionAuth } from "../auth/clerk";

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.route({
    method: "GET",
    url: "/v1/me",
    preHandler: requireSessionAuth,
    schema: {
      tags: ["auth"],
      summary: "Resolve the current authenticated user",
      response: {
        200: currentUserResponseSchema,
        401: apiErrorResponseSchema,
        503: apiErrorResponseSchema
      }
    },
    handler: async (request) => {
      if (!request.auth) {
        throw new Error("Auth context was not attached to the request");
      }

      return {
        user: request.auth
      };
    }
  });
};
