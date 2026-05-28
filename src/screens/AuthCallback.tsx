"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { persistUserFromAccessToken } from "@/app/actions/authActions";
import { forkRepoStep, injectSecretsStep } from "@/app/actions/githubActions";

type StepStatus = "idle" | "active" | "done" | "error" | "skipped";

interface Step {
  id: string;
  label: string;
  sublabel: string;
  icon: string;
}

const STEPS: Step[] = [
  {
    id: "authenticating",
    label: "Connecting GitHub",
    sublabel: "Verifying your OAuth session with GitHub...",
    icon: "🔐",
  },
  {
    id: "persisting",
    label: "Saving Your Profile",
    sublabel: "Storing your account securely in our database...",
    icon: "👤",
  },
  {
    id: "forking",
    label: "Forking Repository",
    sublabel: "Creating your personal copy of the workflow repo...",
    icon: "🍴",
  },
  {
    id: "secrets",
    label: "Injecting Secrets",
    sublabel: "Securely configuring GitHub Actions secrets in your fork...",
    icon: "🔑",
  },
  {
    id: "done",
    label: "All Systems Go!",
    sublabel: "Redirecting you to your dashboard...",
    icon: "🚀",
  },
];

export default function AuthCallback() {
  const router = useRouter();
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({
    authenticating: "active",
    persisting: "idle",
    forking: "idle",
    secrets: "idle",
    done: "idle",
  });
  const [activeStep, setActiveStep] = useState("authenticating");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [forkWarning, setForkWarning] = useState<string | null>(null);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number; size: number }>>([]);
  const mountedRef = useRef(true);

  // Generate ambient particles once on client
  useEffect(() => {
    const generated = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 4,
      size: Math.random() * 4 + 2,
    }));
    setParticles(generated);
  }, []);

  const markStep = (id: string, status: StepStatus) => {
    if (!mountedRef.current) return;
    setStepStatuses((prev) => ({ ...prev, [id]: status }));
    if (status === "active") setActiveStep(id);
  };

  useEffect(() => {
    mountedRef.current = true;

    const run = async () => {
      try {
        // ── Step 1: Exchange code for session ─────────────────────────────
        markStep("authenticating", "active");
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (!data.session) throw new Error("No active session found. Please try signing in again.");
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        const accessToken = session?.access_token ?? null;

        if (!accessToken) {
          throw new Error("No access token found after authentication. Please try again.");
        }

        markStep("authenticating", "done");

        // ── Step 2: Persist user in public.users ──────────────────────────
        markStep("persisting", "active");
        const user = await persistUserFromAccessToken(accessToken);
        markStep("persisting", "done");

        // ── Step 3: Fork repo ─────────────────────────────────────────────
        markStep("forking", "active");
        const providerToken = session?.provider_token ?? null;

        if (!providerToken) {
          setForkWarning(
            "GitHub provider token unavailable — repo setup skipped. Please sign out and sign in again to complete setup.",
          );
          markStep("forking", "skipped");
          markStep("secrets", "skipped");
        } else {
          // Step 3a: Fork the repo
          const forkResult = await forkRepoStep(providerToken);

          if (!forkResult.ok) {
            setForkWarning(forkResult.error);
            markStep("forking", "skipped");
            markStep("secrets", "skipped");
          } else {
            markStep("forking", "done");

            // Step 3b: Inject secrets
            markStep("secrets", "active");
            const secretsResult = await injectSecretsStep(providerToken, forkResult.login, user.id);

            if (!secretsResult.ok) {
              setForkWarning(secretsResult.error);
              markStep("secrets", "skipped");
            } else {
              markStep("secrets", "done");
            }
          }
        }

        // ── Done ──────────────────────────────────────────────────────────
        if (mountedRef.current) {
          markStep("done", "active");
          await new Promise((r) => setTimeout(r, 1500));
          markStep("done", "done");
          await new Promise((r) => setTimeout(r, 500));
          router.replace("/dashboard");
        }
      } catch (error) {
        if (mountedRef.current) {
          const msg = error instanceof Error ? error.message : "Authentication failed";
          setErrorMessage(msg);
          // Mark active step as error
          setStepStatuses((prev) => {
            const updated = { ...prev };
            for (const key of Object.keys(updated)) {
              if (updated[key] === "active") updated[key] = "error";
            }
            return updated;
          });
        }
      }
    };

    run();

    return () => {
      mountedRef.current = false;
    };
  }, [router]);

  const hasError = !!errorMessage;
  const currentIdx = STEPS.findIndex((s) => s.id === activeStep);

  return (
    <div className="auth-callback-root">
      {/* Ambient particles */}
      <div className="particles-layer">
        {particles.map((p) => (
          <div
            key={p.id}
            className="particle"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              animationDelay: `${p.delay}s`,
              width: `${p.size}px`,
              height: `${p.size}px`,
            }}
          />
        ))}
      </div>

      {/* Glow blobs */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <div className="logo-ring">
            <span className="logo-emoji">
              {hasError ? "⚠️" : STEPS[currentIdx]?.icon ?? "⏳"}
            </span>
            {!hasError && activeStep !== "done" && <div className="ring-spinner" />}
            {activeStep === "done" && !hasError && <div className="ring-done" />}
          </div>

          <h1 className="auth-title">
            {hasError ? "Setup Failed" : activeStep === "done" ? "You're all set!" : "Setting Up Your Account"}
          </h1>
          <p className="auth-subtitle">
            {hasError
              ? "Something went wrong during account setup."
              : activeStep === "done"
              ? "Taking you to your dashboard…"
              : "This only takes a few seconds. Hang tight!"}
          </p>
        </div>

        {/* Progress steps */}
        <div className="steps-container">
          {STEPS.map((step, idx) => {
            const status = stepStatuses[step.id] ?? "idle";
            const isActive = status === "active";
            const isDone = status === "done";
            const isError = status === "error";
            const isSkipped = status === "skipped";
            const isIdle = status === "idle";

            return (
              <div
                key={step.id}
                className={[
                  "step-row",
                  isActive ? "step-active" : "",
                  isDone ? "step-done" : "",
                  isError ? "step-error" : "",
                  isSkipped ? "step-skipped" : "",
                  isIdle ? "step-idle" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {/* Connector line above (not for first) */}
                {idx > 0 && (
                  <div className={`connector ${isDone || isSkipped ? "connector-done" : ""}`} />
                )}

                <div className="step-inner">
                  {/* Step icon badge */}
                  <div className="step-badge">
                    {isDone && <span className="badge-icon">✓</span>}
                    {isSkipped && <span className="badge-icon">⊘</span>}
                    {isError && <span className="badge-icon">✕</span>}
                    {isActive && (
                      <span className="badge-icon">
                        <span className="badge-spinner" />
                      </span>
                    )}
                    {isIdle && <span className="badge-icon idle-num">{idx + 1}</span>}
                  </div>

                  {/* Step text */}
                  <div className="step-text">
                    <span className="step-label">
                      {step.icon} {step.label}
                    </span>
                    {(isActive || isError) && (
                      <span className="step-sublabel">{isError && errorMessage ? errorMessage : step.sublabel}</span>
                    )}
                    {isSkipped && (
                      <span className="step-sublabel step-sublabel-warn">Skipped — provider token unavailable</span>
                    )}
                  </div>

                  {/* Active glow pulse */}
                  {isActive && <div className="step-glow-pulse" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Fork warning */}
        {forkWarning && (
          <div className="fork-warning">
            <span className="fork-warning-icon">⚠️</span>
            <div>
              <strong>Repo setup skipped</strong>
              <p>{forkWarning}</p>
            </div>
          </div>
        )}

        {/* Error retry */}
        {hasError && (
          <button
            className="retry-btn"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            ← Go Back & Try Again
          </button>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        .auth-callback-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #07080f;
          font-family: 'Inter', system-ui, sans-serif;
          position: relative;
          overflow: hidden;
          padding: 24px;
        }

        /* ── Ambient effects ── */
        .particles-layer {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }

        .particle {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(99,102,241,0.6), transparent);
          animation: float-particle 6s ease-in-out infinite alternate;
          opacity: 0.5;
        }

        @keyframes float-particle {
          from { transform: translateY(0px) scale(1); opacity: 0.3; }
          to   { transform: translateY(-30px) scale(1.4); opacity: 0.7; }
        }

        .blob {
          position: fixed;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
        }
        .blob-1 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%);
          top: -150px; left: -150px;
          animation: blob-drift 12s ease-in-out infinite alternate;
        }
        .blob-2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(168,85,247,0.15), transparent 70%);
          bottom: -100px; right: -100px;
          animation: blob-drift 15s ease-in-out infinite alternate-reverse;
        }
        .blob-3 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, rgba(34,211,238,0.1), transparent 70%);
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          animation: blob-drift 10s ease-in-out infinite alternate;
        }
        @keyframes blob-drift {
          from { transform: scale(1) translate(0, 0); }
          to   { transform: scale(1.15) translate(30px, -20px); }
        }

        /* ── Card ── */
        .auth-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 520px;
          background: rgba(15, 16, 28, 0.85);
          border: 1px solid rgba(99, 102, 241, 0.25);
          border-radius: 24px;
          padding: 40px 36px;
          backdrop-filter: blur(24px);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.04),
            0 24px 80px rgba(0,0,0,0.6),
            0 0 60px rgba(99,102,241,0.08);
          animation: card-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes card-in {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── Header ── */
        .auth-header {
          text-align: center;
          margin-bottom: 36px;
        }

        .logo-ring {
          width: 88px;
          height: 88px;
          margin: 0 auto 20px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .logo-emoji {
          font-size: 40px;
          line-height: 1;
          position: relative;
          z-index: 1;
          animation: emoji-breathe 2s ease-in-out infinite alternate;
        }

        @keyframes emoji-breathe {
          from { transform: scale(1); filter: drop-shadow(0 0 0px rgba(99,102,241,0)); }
          to   { transform: scale(1.12); filter: drop-shadow(0 0 16px rgba(99,102,241,0.8)); }
        }

        .ring-spinner {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2.5px solid transparent;
          border-top-color: #6366f1;
          border-right-color: rgba(99,102,241,0.3);
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .ring-done {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2.5px solid #22c55e;
          animation: ring-pop 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes ring-pop {
          from { transform: scale(0.7); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }

        .auth-title {
          font-size: 26px;
          font-weight: 800;
          color: #f1f5f9;
          margin: 0 0 8px;
          letter-spacing: -0.5px;
        }

        .auth-subtitle {
          font-size: 14px;
          color: rgba(148, 163, 184, 0.8);
          margin: 0;
          line-height: 1.5;
        }

        /* ── Steps ── */
        .steps-container {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .step-row {
          position: relative;
          padding: 6px 0;
        }

        .connector {
          position: absolute;
          top: 0;
          left: 20px;
          width: 2px;
          height: 6px;
          background: rgba(99,102,241,0.15);
          transition: background 0.4s;
        }
        .connector-done {
          background: rgba(34, 197, 94, 0.5);
        }

        .step-inner {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 14px;
          position: relative;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }

        /* idle */
        .step-idle .step-inner {
          background: rgba(255,255,255,0.02);
          border: 1px solid transparent;
          opacity: 0.45;
        }

        /* active */
        .step-active .step-inner {
          background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.08));
          border: 1px solid rgba(99,102,241,0.35);
          transform: scale(1.02);
          box-shadow: 0 0 30px rgba(99,102,241,0.15), inset 0 1px 0 rgba(255,255,255,0.06);
          opacity: 1;
        }

        /* done */
        .step-done .step-inner {
          background: rgba(34, 197, 94, 0.06);
          border: 1px solid rgba(34,197,94,0.2);
          opacity: 1;
        }

        /* error */
        .step-error .step-inner {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          opacity: 1;
        }

        /* skipped */
        .step-skipped .step-inner {
          background: rgba(234, 179, 8, 0.06);
          border: 1px solid rgba(234,179,8,0.2);
          opacity: 0.7;
        }

        /* ── Badge ── */
        .step-badge {
          width: 40px;
          height: 40px;
          min-width: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 700;
          transition: all 0.4s;
          position: relative;
          z-index: 1;
        }

        .step-idle .step-badge {
          background: rgba(255,255,255,0.05);
          border: 1.5px solid rgba(255,255,255,0.1);
        }

        .step-active .step-badge {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          box-shadow: 0 0 20px rgba(99,102,241,0.5);
        }

        .step-done .step-badge {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border: none;
          box-shadow: 0 0 16px rgba(34,197,94,0.4);
        }

        .step-error .step-badge {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          border: none;
          box-shadow: 0 0 16px rgba(239,68,68,0.4);
        }

        .step-skipped .step-badge {
          background: rgba(234, 179, 8, 0.15);
          border: 1.5px solid rgba(234,179,8,0.3);
        }

        .badge-icon {
          color: white;
          font-size: 16px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .idle-num {
          color: rgba(148,163,184,0.5);
          font-size: 13px;
        }

        .badge-spinner {
          display: block;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2.5px solid rgba(255,255,255,0.3);
          border-top-color: white;
          animation: spin 0.7s linear infinite;
        }

        /* ── Step text ── */
        .step-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          position: relative;
          z-index: 1;
        }

        .step-label {
          font-size: 15px;
          font-weight: 600;
          color: #e2e8f0;
          line-height: 1.3;
          transition: color 0.3s;
        }

        .step-idle .step-label {
          color: rgba(148, 163, 184, 0.6);
        }

        .step-done .step-label {
          color: #86efac;
        }

        .step-error .step-label {
          color: #fca5a5;
        }

        .step-skipped .step-label {
          color: #fde68a;
        }

        .step-sublabel {
          font-size: 12.5px;
          color: rgba(148, 163, 184, 0.7);
          line-height: 1.5;
          animation: fade-in-up 0.3s ease both;
        }

        .step-sublabel-warn {
          color: rgba(253, 224, 71, 0.8);
        }

        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Active glow pulse ── */
        .step-glow-pulse {
          position: absolute;
          inset: 0;
          border-radius: 14px;
          background: radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.12), transparent 70%);
          animation: glow-pulse 2s ease-in-out infinite alternate;
          pointer-events: none;
        }

        @keyframes glow-pulse {
          from { opacity: 0.4; }
          to   { opacity: 1; }
        }

        /* ── Fork warning ── */
        .fork-warning {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          margin-top: 24px;
          background: rgba(234, 179, 8, 0.08);
          border: 1px solid rgba(234, 179, 8, 0.25);
          border-radius: 12px;
          padding: 14px 16px;
          animation: fade-in-up 0.4s ease both;
        }

        .fork-warning-icon {
          font-size: 18px;
          line-height: 1.4;
          flex-shrink: 0;
        }

        .fork-warning strong {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #fde68a;
          margin-bottom: 4px;
        }

        .fork-warning p {
          font-size: 12px;
          color: rgba(253, 230, 138, 0.7);
          margin: 0;
          line-height: 1.5;
        }

        /* ── Retry button ── */
        .retry-btn {
          display: block;
          width: 100%;
          margin-top: 24px;
          padding: 14px;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 12px;
          color: #fca5a5;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
          letter-spacing: 0.01em;
        }

        .retry-btn:hover {
          background: rgba(239,68,68,0.2);
          border-color: rgba(239,68,68,0.5);
          transform: translateY(-1px);
        }

        /* ── Responsive ── */
        @media (max-width: 480px) {
          .auth-card { padding: 28px 20px; }
          .auth-title { font-size: 22px; }
          .step-label { font-size: 14px; }
        }
      `}</style>
    </div>
  );
}
