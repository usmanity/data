import {
  RedirectToSignIn,
  SignedIn,
  SignedOut,
  SignIn,
  SignOutButton,
  SignUp,
  UserButton,
  useAuth
} from "@clerk/clerk-react";
import { Link, Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fetchCurrentUser } from "./api";
import { isClerkConfigured, publicWebConfig } from "./env";

const rootRoute = createRootRoute({
  component: () => (
    <div style={shellStyles}>
      <header style={headerStyles}>
        <Link to="/" style={brandStyles}>
          Fernloop Template
        </Link>
        <nav style={navStyles}>
          <Link to="/" style={navLinkStyles}>
            Home
          </Link>
          <Link to="/app" style={navLinkStyles}>
            App
          </Link>
        </nav>
      </header>
      <Outlet />
    </div>
  )
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  component: SignInPage
});

const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-up",
  component: SignUpPage
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app",
  component: AppPage
});

const routeTree = rootRoute.addChildren([indexRoute, signInRoute, signUpRoute, appRoute]);

export const router = createRouter({ routeTree });

function HomePage() {
  if (!isClerkConfigured) {
    return <ClerkSetupCard />;
  }

  return (
    <main style={cardStyles}>
      <p style={eyebrowStyles}>Fernloop Template</p>
      <h1 style={titleStyles}>Auth is now part of the template baseline.</h1>
      <p style={copyStyles}>
        This shell is wired for a real auth flow: Clerk in the browser, Clerk token verification
        in Fastify, and internal Fernloop user resolution in Postgres.
      </p>
      <dl style={listStyles}>
        <div>
          <dt style={labelStyles}>Web</dt>
          <dd style={valueStyles}>http://localhost:2002</dd>
        </div>
        <div>
          <dt style={labelStyles}>API</dt>
          <dd style={valueStyles}>{publicWebConfig.apiBaseUrl}</dd>
        </div>
        <div>
          <dt style={labelStyles}>Protected route</dt>
          <dd style={valueStyles}>{publicWebConfig.apiBaseUrl}/v1/me</dd>
        </div>
      </dl>
      <div style={actionsStyles}>
        <Link to="/sign-in" style={primaryActionStyles}>
          Sign in
        </Link>
        <Link to="/sign-up" style={secondaryActionStyles}>
          Create account
        </Link>
        <Link to="/app" style={secondaryActionStyles}>
          Open app shell
        </Link>
      </div>
    </main>
  );
}

function SignInPage() {
  if (!isClerkConfigured) {
    return <ClerkSetupCard />;
  }

  return (
    <main style={pageStyles}>
      <SignedIn>
        <AlreadySignedInCard />
      </SignedIn>
      <SignedOut>
        <SignIn routing="hash" signUpUrl="/sign-up" fallbackRedirectUrl="/app" />
      </SignedOut>
    </main>
  );
}

function SignUpPage() {
  if (!isClerkConfigured) {
    return <ClerkSetupCard />;
  }

  return (
    <main style={pageStyles}>
      <SignedIn>
        <AlreadySignedInCard />
      </SignedIn>
      <SignedOut>
        <SignUp routing="hash" signInUrl="/sign-in" fallbackRedirectUrl="/app" />
      </SignedOut>
    </main>
  );
}

function AppPage() {
  if (!isClerkConfigured) {
    return <ClerkSetupCard />;
  }

  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <DashboardPage />
      </SignedIn>
    </>
  );
}

function DashboardPage() {
  const { getToken } = useAuth();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | {
        status: "ready";
        internalUserId: string;
        clerkUserId: string;
        sessionId: string | null;
      }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const token = await getToken();

        if (!token) {
          throw new Error("Clerk did not return a session token.");
        }

        const response = await fetchCurrentUser(token);

        if (!cancelled) {
          setState({
            status: "ready",
            internalUserId: response.user.internalUserId,
            clerkUserId: response.user.clerkUserId,
            sessionId: response.user.sessionId
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Unable to resolve the current user."
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken]);

  return (
    <main style={cardStyles}>
      <div style={dashboardHeaderStyles}>
        <div>
          <p style={eyebrowStyles}>Authenticated Shell</p>
          <h1 style={titleStyles}>This is the template app boundary.</h1>
        </div>
        <div style={dashboardActionsStyles}>
          <UserButton />
          <SignOutButton>
            <button type="button" style={buttonStyles}>
              Sign out
            </button>
          </SignOutButton>
        </div>
      </div>
      <p style={copyStyles}>
        The browser is signed in with Clerk, the API verifies the Clerk session token, and the
        backend resolves the internal Fernloop user ID before returning protected data.
      </p>
      {state.status === "loading" ? <p style={statusStyles}>Resolving current user...</p> : null}
      {state.status === "error" ? <p style={errorStyles}>{state.message}</p> : null}
      {state.status === "ready" ? (
        <dl style={listStyles}>
          <div>
            <dt style={labelStyles}>Internal user ID</dt>
            <dd style={valueStyles}>{state.internalUserId}</dd>
          </div>
          <div>
            <dt style={labelStyles}>Clerk user ID</dt>
            <dd style={valueStyles}>{state.clerkUserId}</dd>
          </div>
          <div>
            <dt style={labelStyles}>Session ID</dt>
            <dd style={valueStyles}>{state.sessionId ?? "None"}</dd>
          </div>
        </dl>
      ) : null}
    </main>
  );
}

function AlreadySignedInCard() {
  return (
    <section style={cardStyles}>
      <p style={eyebrowStyles}>Already signed in</p>
      <h1 style={titleStyles}>Jump straight into the template app shell.</h1>
      <p style={copyStyles}>
        Clerk already has an active session in this browser. Use the protected app route to verify
        the full browser-to-API auth boundary.
      </p>
      <div style={actionsStyles}>
        <Link to="/app" style={primaryActionStyles}>
          Open app shell
        </Link>
      </div>
    </section>
  );
}

function ClerkSetupCard() {
  return (
    <main style={cardStyles}>
      <p style={eyebrowStyles}>Configuration required</p>
      <h1 style={titleStyles}>Add Clerk keys to finish the template auth flow.</h1>
      <p style={copyStyles}>
        The template boots without Clerk so local development is not blocked, but the auth shell
        stays disabled until you set the publishable and secret keys in the root
        <code style={inlineCodeStyles}>.env</code>.
      </p>
      <dl style={listStyles}>
        <div>
          <dt style={labelStyles}>Required frontend env</dt>
          <dd style={valueStyles}>VITE_CLERK_PUBLISHABLE_KEY</dd>
        </div>
        <div>
          <dt style={labelStyles}>Required API env</dt>
          <dd style={valueStyles}>CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY</dd>
        </div>
      </dl>
    </main>
  );
}

const shellStyles = {
  minHeight: "100vh",
  display: "grid",
  gridTemplateRows: "auto 1fr",
  gap: "24px",
  padding: "24px",
  background:
    "radial-gradient(circle at top, rgba(255, 196, 120, 0.45), transparent 35%), linear-gradient(135deg, #f5efe6 0%, #d9e8f5 100%)",
  fontFamily: '"IBM Plex Sans", "Helvetica Neue", sans-serif'
} as const;

const headerStyles = {
  width: "min(1120px, 100%)",
  margin: "0 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px"
} as const;

const brandStyles = {
  color: "#142033",
  textDecoration: "none",
  fontSize: "1rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
} as const;

const navStyles = {
  display: "flex",
  gap: "16px"
} as const;

const navLinkStyles = {
  color: "#33445c",
  textDecoration: "none",
  fontWeight: 600
} as const;

const cardStyles = {
  width: "min(720px, 100%)",
  margin: "auto",
  padding: "40px",
  borderRadius: "28px",
  background: "rgba(255, 255, 255, 0.72)",
  boxShadow: "0 30px 80px rgba(38, 53, 76, 0.16)",
  backdropFilter: "blur(16px)"
} as const;

const pageStyles = {
  display: "grid",
  placeItems: "center"
} as const;

const eyebrowStyles = {
  margin: 0,
  fontSize: "0.8rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#8a5b1f"
} as const;

const titleStyles = {
  margin: "12px 0 16px",
  fontSize: "clamp(2rem, 5vw, 3.75rem)",
  lineHeight: 1,
  color: "#142033"
} as const;

const copyStyles = {
  margin: 0,
  maxWidth: "52ch",
  fontSize: "1.05rem",
  lineHeight: 1.6,
  color: "#33445c"
} as const;

const listStyles = {
  margin: "28px 0 0",
  display: "grid",
  gap: "16px"
} as const;

const actionsStyles = {
  marginTop: "28px",
  display: "flex",
  flexWrap: "wrap",
  gap: "12px"
} as const;

const primaryActionStyles = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "44px",
  padding: "0 18px",
  borderRadius: "999px",
  background: "#142033",
  color: "#f5efe6",
  textDecoration: "none",
  fontWeight: 700
} as const;

const secondaryActionStyles = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "44px",
  padding: "0 18px",
  borderRadius: "999px",
  border: "1px solid rgba(20, 32, 51, 0.16)",
  color: "#142033",
  textDecoration: "none",
  fontWeight: 700
} as const;

const labelStyles = {
  fontSize: "0.8rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#627188"
} as const;

const valueStyles = {
  margin: "4px 0 0",
  fontSize: "1rem",
  fontWeight: 600,
  color: "#142033"
} as const;

const dashboardHeaderStyles = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start"
} as const;

const dashboardActionsStyles = {
  display: "flex",
  gap: "12px",
  alignItems: "center"
} as const;

const buttonStyles = {
  minHeight: "40px",
  padding: "0 16px",
  borderRadius: "999px",
  border: "1px solid rgba(20, 32, 51, 0.16)",
  background: "rgba(255, 255, 255, 0.8)",
  color: "#142033",
  fontWeight: 700,
  cursor: "pointer"
} as const;

const statusStyles = {
  marginTop: "24px",
  color: "#33445c",
  fontWeight: 600
} as const;

const errorStyles = {
  marginTop: "24px",
  color: "#a11f1f",
  fontWeight: 600
} as const;

const inlineCodeStyles = {
  marginLeft: "0.35rem",
  marginRight: "0.35rem",
  padding: "0.15rem 0.35rem",
  borderRadius: "6px",
  background: "rgba(20, 32, 51, 0.08)"
} as const;
