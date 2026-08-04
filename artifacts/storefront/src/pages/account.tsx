import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  signIn,
  signUp,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Mode = "signin" | "signup" | "forgot";

// Design tokens matching the lavender theme
const PURPLE = "#8B7BD8";
const LAVENDER_BG = "#EDE8F8";
const CARD_BG = "#FAF9FF";
const ROSE_GOLD = "#8B7BD8";
const TEXT_DARK = "#2D2248";
const TEXT_MUTED = "#9B93B8";
const WHITE = "#FFFFFF";
const HEART_PINK = "#F08080";

function BagLogo() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      {/* Handle */}
      <div style={{ display: "flex", gap: 20, marginBottom: -2, position: "relative", zIndex: 1 }}>
        <div style={{
          width: 18, height: 22,
          borderTop: `4px solid ${ROSE_GOLD}`,
          borderLeft: `4px solid ${ROSE_GOLD}`,
          borderRadius: "8px 0 0 0",
        }} />
        <div style={{
          width: 18, height: 22,
          borderTop: `4px solid ${ROSE_GOLD}`,
          borderRight: `4px solid ${ROSE_GOLD}`,
          borderRadius: "0 8px 0 0",
        }} />
      </div>
      {/* Bag body */}
      <div style={{
        width: 90,
        height: 88,
        borderRadius: 18,
        background: `linear-gradient(145deg, ${ROSE_GOLD}, #6C5BB5)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 12px 32px rgba(139,123,216,0.40)",
        position: "relative",
        zIndex: 2,
      }}>
        <span style={{
          fontSize: 78,
          fontWeight: 700,
          color: WHITE,
          fontFamily: '"Playfair Display", Georgia, serif',
          letterSpacing: 0,
          lineHeight: 1,
          display: "block",
        }}>A</span>
      </div>
    </div>
  );
}

function IconCircle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: 38,
      height: 38,
      borderRadius: "50%",
      backgroundColor: PURPLE,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

function SocialBtn({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      style={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        backgroundColor: WHITE,
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 2px 10px rgba(176,160,208,0.20)",
        cursor: "pointer",
        fontSize: 20,
        fontWeight: 700,
      }}
    >
      {children}
    </button>
  );
}

export default function Account() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("ref")) setMode("signup");
  }, [search]);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setForgotSent(false);
    setShowPassword(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "forgot") {
      setSubmitting(true);
      try {
        await fetch("/api/auth/request-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        setForgotSent(true);
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === "signup" && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    try {
      let res: { role?: string };
      if (mode === "signin") {
        res = await signIn({ email, password });
      } else {
        const params = new URLSearchParams(search);
        const refCode = params.get("ref");
        if (refCode) {
          const r = await fetch("/api/auth/signup", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password, referralCode: refCode }),
          });
          const data = await r.json();
          if (!r.ok) throw Object.assign(new Error(), { response: { data } });
          res = data;
        } else {
          res = await signUp({ name, email, password });
        }
      }
      await queryClient.invalidateQueries({
        queryKey: getGetCurrentUserQueryKey(),
      });
      if (mode === "signup") {
        setLocation("/verify-email");
        return;
      }
      const role = res?.role;
      if (role === "admin") setLocation("/admin");
      else if (role === "pm") setLocation("/pm");
      else setLocation("/");
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: string } } }).response?.data
          ?.error ?? "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const isSignIn = mode === "signin";
  const isForgot = mode === "forgot";

  return (
    <div
      style={{
        minHeight: "100%",
        backgroundColor: LAVENDER_BG,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
        }}
      >
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Bag logo */}
        {!isForgot && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <Link href="/" style={{ cursor: "pointer" }}>
              <BagLogo />
            </Link>
          </div>
        )}

        {/* Heading */}
        <h1 style={{
          textAlign: "center",
          fontSize: 32,
          fontWeight: 800,
          color: TEXT_DARK,
          margin: 0,
          marginBottom: 8,
          fontFamily: "inherit",
        }}>
          {isForgot ? "Reset Password" : isSignIn ? "Welcome Back" : "Create Account"}
        </h1>
        <p style={{
          textAlign: "center",
          color: TEXT_MUTED,
          fontSize: 14,
          margin: "0 0 24px",
        }}>
          {isForgot
            ? "We'll email you a reset code"
            : isSignIn
            ? "Login to continue your journey"
            : "Join AllMart today"}
        </p>

        {/* Card */}
        <div style={{
          backgroundColor: CARD_BG,
          borderRadius: 28,
          padding: "28px 24px 24px",
          boxShadow: "0 8px 32px rgba(123,107,160,0.12)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}>

          {/* Forgot — success state */}
          {isForgot && forgotSent ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "center" }}>
              <div style={{
                borderRadius: 12,
                border: "1px solid #6ee7b7",
                backgroundColor: "#ecfdf5",
                padding: "16px 16px",
                fontSize: 14,
                color: "#065f46",
              }}>
                <p style={{ fontWeight: 700, margin: 0, marginBottom: 4 }}>Check your inbox</p>
                <p style={{ margin: 0 }}>If an account exists for <strong>{email}</strong>, we've sent a reset code.</p>
              </div>
              <button
                type="button"
                onClick={() => setLocation("/reset-password")}
                style={{
                  backgroundColor: PURPLE,
                  color: WHITE,
                  border: "none",
                  borderRadius: 50,
                  padding: "14px 0",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: `0 6px 16px ${PURPLE}55`,
                }}
              >
                Enter reset code
              </button>
              <button
                type="button"
                onClick={() => switchMode("signin")}
                style={{ background: "none", border: "none", color: TEXT_MUTED, fontSize: 13, cursor: "pointer" }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Name field (sign up only) */}
              {!isSignIn && !isForgot && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: WHITE,
                  borderRadius: 14,
                  padding: "4px 14px 4px 6px",
                  boxShadow: "0 2px 8px rgba(176,160,208,0.12)",
                }}>
                  <IconCircle>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </IconCircle>
                  <input
                    type="text"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full Name"
                    style={{
                      flex: 1,
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      fontSize: 15,
                      color: TEXT_DARK,
                      padding: "12px 0",
                    }}
                  />
                </div>
              )}

              {/* Email field */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                backgroundColor: WHITE,
                borderRadius: 14,
                padding: "4px 14px 4px 6px",
                boxShadow: "0 2px 8px rgba(176,160,208,0.12)",
              }}>
                <IconCircle>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </IconCircle>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email or Username"
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    fontSize: 15,
                    color: TEXT_DARK,
                    padding: "12px 0",
                  }}
                />
              </div>

              {/* Password field */}
              {!isForgot && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: WHITE,
                  borderRadius: 14,
                  padding: "4px 14px 4px 6px",
                  boxShadow: "0 2px 8px rgba(176,160,208,0.12)",
                }}>
                  <IconCircle>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </IconCircle>
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete={isSignIn ? "current-password" : "new-password"}
                    required
                    minLength={isSignIn ? 1 : 6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    style={{
                      flex: 1,
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      fontSize: 15,
                      color: TEXT_DARK,
                      padding: "12px 0",
                    }}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_MUTED, display: "flex", alignItems: "center" }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              )}

              {/* Forgot password link */}
              {isSignIn && (
                <div style={{ textAlign: "right", marginTop: -6 }}>
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    style={{ background: "none", border: "none", color: PURPLE, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{
                  borderRadius: 10,
                  border: "1px solid rgba(224,85,85,0.3)",
                  backgroundColor: "rgba(224,85,85,0.07)",
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "#E05555",
                }}>
                  {error}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={submitting}
                style={{
                  backgroundColor: PURPLE,
                  color: WHITE,
                  border: "none",
                  borderRadius: 50,
                  padding: "16px 0",
                  fontSize: 17,
                  fontWeight: 700,
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.75 : 1,
                  boxShadow: `0 6px 20px ${PURPLE}55`,
                  marginTop: 2,
                }}
              >
                {submitting
                  ? isForgot ? "Sending…" : isSignIn ? "Signing in…" : "Creating account…"
                  : isForgot ? "Send Reset Code"
                  : isSignIn ? "Login"
                  : "Create Account"}
              </button>

              {isForgot && (
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  style={{ background: "none", border: "none", color: TEXT_MUTED, fontSize: 13, cursor: "pointer", textAlign: "center" }}
                >
                  Back to sign in
                </button>
              )}

              {/* Social login — only on sign in / sign up */}
              {!isForgot && (
                <>
                  {/* Divider */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}>
                    <div style={{ flex: 1, height: 1, backgroundColor: "#E0D8F0" }} />
                    <span style={{ color: TEXT_MUTED, fontSize: 12 }}>or continue with</span>
                    <div style={{ flex: 1, height: 1, backgroundColor: "#E0D8F0" }} />
                  </div>

                  {/* Social buttons */}
                  <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
                    <SocialBtn>
                      <span style={{ color: "#EA4335", fontWeight: 700, fontSize: 20 }}>G</span>
                    </SocialBtn>
                    <SocialBtn>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                    </SocialBtn>
                    <SocialBtn>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </SocialBtn>
                  </div>

                  {/* Switch mode */}
                  <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 2, fontSize: 13 }}>
                    <span style={{ color: TEXT_MUTED }}>
                      {isSignIn ? "Don't have an account?" : "Already have an account?"}
                    </span>
                    <button
                      type="button"
                      onClick={() => switchMode(isSignIn ? "signup" : "signin")}
                      style={{ background: "none", border: "none", color: PURPLE, fontWeight: 700, cursor: "pointer", fontSize: 13, padding: 0 }}
                    >
                      {isSignIn ? "Sign Up" : "Sign In"}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>

        {/* Terms */}
        <p style={{ textAlign: "center", fontSize: 11, color: TEXT_MUTED, marginTop: 16 }}>
          By continuing you agree to AllMart's{" "}
          <Link href="/terms" style={{ color: PURPLE, textDecoration: "underline" }}>terms</Link>.
        </p>
      </div>
      </div>{/* end centering wrapper */}

      {/* Footer */}
      <footer style={{
        textAlign: "center",
        padding: "20px 24px 28px",
        borderTop: "1px solid rgba(139,123,216,0.15)",
        backgroundColor: "rgba(255,255,255,0.5)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 10, flexWrap: "wrap" }}>
          {[
            { label: "Home", href: "/" },
            { label: "Products", href: "/products" },
            { label: "Terms", href: "/terms" },
            { label: "Privacy", href: "/privacy" },
            { label: "Help", href: "/help" },
          ].map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              style={{ color: TEXT_MUTED, fontSize: 12, textDecoration: "none", fontWeight: 500 }}
            >
              {label}
            </Link>
          ))}
        </div>
        <p style={{ color: TEXT_MUTED, fontSize: 11, margin: 0 }}>
          © {new Date().getFullYear()} AllMart. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
