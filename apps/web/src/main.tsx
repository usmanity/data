import { ClerkProvider } from "@clerk/clerk-react";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { isClerkConfigured, publicWebConfig } from "./env";
import { router } from "./router";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container not found");
}

const app = (
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

ReactDOM.createRoot(container).render(
  isClerkConfigured && publicWebConfig.clerkPublishableKey ? (
    <ClerkProvider publishableKey={publicWebConfig.clerkPublishableKey}>{app}</ClerkProvider>
  ) : (
    app
  )
);
