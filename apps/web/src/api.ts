import { currentUserResponseSchema, type CurrentUserResponse } from "@fernloop/contracts";
import { publicWebConfig } from "./env";

export async function fetchCurrentUser(token: string): Promise<CurrentUserResponse> {
  const response = await fetch(`${publicWebConfig.apiBaseUrl}/v1/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message ?? "Unable to load the current user.");
  }

  return currentUserResponseSchema.parse(payload);
}
