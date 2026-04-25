import React, { useEffect, useState } from "react";

import { BudgetPage } from "../features/budget";
import {
  bootstrapSession,
  getCurrentUser,
  getGoogleLoginUrl,
  logoutSession,
  subscribeToSession
} from "../auth/session";
import { THEME_KEY } from "../features/budget/model/sampleState";

function ThemeToggleButton({ theme, onClick }) {
  return (
    <button
      className="ghost-button auth-theme-toggle"
      type="button"
      onClick={onClick}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light Mode" : "Dark Mode"}
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 15.5A8.5 8.5 0 1 1 8.5 4a6.8 6.8 0 0 0 11.5 11.5Z" />
        </svg>
      )}
    </button>
  );
}

function FullPageMessage({ label, title, body, action, theme, onThemeToggle }) {
  return (
    <div className="app-shell auth-shell">
      <div className="auth-screen-topbar">
        <ThemeToggleButton theme={theme} onClick={onThemeToggle} />
      </div>
      <section className="auth-panel">
        <div className="auth-brand">
          <p className="eyebrow">Budget Base</p>
          <h1>Welcome to Budget Base</h1>
        </div>
        <div className="panel auth-copy-card">
          <p className="section-label">{label}</p>
          <h2>{title}</h2>
          <p>{body}</p>
        </div>
        {action ? (
          <div className="auth-actions-wrap">
            <div className="auth-divider" aria-hidden="true">
              <span />
              <span>Continue with</span>
              <span />
            </div>
            <div className="auth-actions">{action}</div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function GoogleSignInButton() {
  return (
    <a
      className="auth-button auth-provider-button"
      href={getGoogleLoginUrl()}
      aria-label="Sign in with Google"
      title="Sign in with Google"
    >
      <span className="auth-provider-button-content">
        <span className="auth-provider-button-icon auth-provider-button-icon-google">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
            <path fill="none" d="M0 0h48v48H0z" />
          </svg>
        </span>
        <span className="auth-provider-button-text">Sign in with Google</span>
        <span className="sr-only">Sign in with Google</span>
      </span>
    </a>
  );
}

export default function App() {
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(() => getCurrentUser());
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "light");

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const unsubscribe = subscribeToSession((nextState) => {
      setUser(nextState.user);
      setStatus(nextState.user ? "authenticated" : "unauthenticated");
    });

    let active = true;

    async function initialize() {
      const isCallbackRoute = window.location.pathname === "/auth/callback";
      setStatus(isCallbackRoute ? "callback" : "loading");

      try {
        const authenticatedUser = await bootstrapSession();
        if (!active) return;

        if (isCallbackRoute) {
          window.history.replaceState({}, "", "/");
        }

        setUser(authenticatedUser);
        setStatus(authenticatedUser ? "authenticated" : "unauthenticated");
      } catch {
        if (!active) return;
        setUser(null);
        setStatus("unauthenticated");
      }
    }

    void initialize();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (status === "loading") {
    return (
      <FullPageMessage
        label="Loading"
        title="Checking your session"
        body="Budget Base is verifying whether you already have an active login."
        theme={theme}
        onThemeToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
      />
    );
  }

  if (status === "callback") {
    return (
      <FullPageMessage
        label="Signing In"
        title="Completing Google sign-in"
        body="The API is exchanging your Google login for an app session."
        theme={theme}
        onThemeToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
      />
    );
  }

  if (!user) {
    return (
      <FullPageMessage
        label="Authentication"
        title="Use your Google account to continue"
        body="Your budget stays tied to your account so the app can load the right data every time."
        action={<GoogleSignInButton />}
        theme={theme}
        onThemeToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
      />
    );
  }

  return (
    <BudgetPage
      user={user}
      onLogout={() => void logoutSession()}
      theme={theme}
      setTheme={setTheme}
    />
  );
}
