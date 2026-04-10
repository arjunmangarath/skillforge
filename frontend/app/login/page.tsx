"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/logo";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void;
          renderButton: (el: HTMLElement, config: object) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If already logged in, skip login page
    const token = localStorage.getItem("sf_token");
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const noRealAuth = !clientId || clientId === "placeholder" || clientId === "";
    if (token || noRealAuth) {
      // Dev mode — auto-bypass with dev-token
      if (noRealAuth) localStorage.setItem("sf_token", "dev-token");
      router.replace("/dashboard");
      return;
    }

    // Load Google Identity Services script
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initGoogleSignIn;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [router]);

  function initGoogleSignIn() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || !window.google) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    const buttonEl = document.getElementById("google-signin-button");
    if (buttonEl) {
      window.google.accounts.id.renderButton(buttonEl, {
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "signin_with",
        width: 280,
      });
    }
  }

  async function handleCredentialResponse(response: { credential: string }) {
    setLoading(true);
    setError("");
    try {
      // Store the Google ID token — API calls use it as Bearer token
      localStorage.setItem("sf_token", response.credential);
      router.replace("/dashboard");
    } catch {
      setError("Sign-in failed. Please try again.");
      localStorage.removeItem("sf_token");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-1 p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm space-y-8 text-center"
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center glow-accent">
            <Logo size={36} className="text-white" />
          </div>
          <div>
            <h1 className="font-sans text-3xl font-bold text-text-primary tracking-tight">
              SKILLFORGE
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              Your AI-powered personal learning assistant
            </p>
          </div>
        </div>

        {/* Feature bullets */}
        <div className="glass-card p-5 text-left space-y-3">
          {[
            { icon: "🧠", text: "Week-by-week AI-generated curriculum" },
            { icon: "🃏", text: "Spaced repetition flashcards" },
            { icon: "🎮", text: "Quiz games to reinforce learning" },
            { icon: "📊", text: "Progress tracking & streaks" },
          ].map(f => (
            <div key={f.text} className="flex items-center gap-3">
              <span className="text-xl">{f.icon}</span>
              <span className="text-sm text-text-secondary">{f.text}</span>
            </div>
          ))}
        </div>

        {/* Sign-in */}
        <div className="space-y-4">
          <p className="text-xs text-text-muted">Sign in to get started — it&apos;s free</p>

          {loading ? (
            <div className="flex items-center justify-center gap-2 text-text-secondary text-sm">
              <div className="w-4 h-4 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
              Signing in…
            </div>
          ) : (
            <div className="flex justify-center">
              <div id="google-signin-button" />
            </div>
          )}

          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}

          {/* Dev mode bypass — only shows when NEXT_PUBLIC_DEV_MODE=true */}
          {process.env.NEXT_PUBLIC_DEV_MODE === "true" && (
            <button
              onClick={() => {
                localStorage.setItem("sf_token", "dev-token");
                router.replace("/dashboard");
              }}
              className="text-xs text-text-muted underline hover:text-text-secondary transition-colors"
            >
              Continue as dev user (dev mode)
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
