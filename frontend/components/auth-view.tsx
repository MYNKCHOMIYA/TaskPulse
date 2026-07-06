"use client"

import * as React from "react"
import { flushSync } from "react-dom"
import { Eye, EyeOff, Loader2, Zap, ArrowRight, Moon, Sun } from "lucide-react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { getStoredTheme, setTheme, type Theme } from "@/lib/theme"

type AuthMode = "login" | "signup"
interface AuthViewProps { onAuthenticated: (preFetchedUser?: any) => void }

// ── Floating Theme Toggle inside login view ────────────────
function ThemeToggle() {
  const [theme, setLocalTheme] = React.useState<Theme>("system")
  const btnRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    setLocalTheme(getStoredTheme())
  }, [])

  function cycle(e: React.MouseEvent) {
    let next: Theme
    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      next = prefersDark ? "light" : "dark"
    } else {
      next = theme === "light" ? "dark" : "light"
    }

    const isSupported = typeof document !== "undefined" && "startViewTransition" in document

    if (!isSupported) {
      setTheme(next)
      setLocalTheme(next)
      return
    }

    const rect = btnRef.current?.getBoundingClientRect()
    const x = rect ? rect.left + rect.width / 2 : e.clientX
    const y = rect ? rect.top + rect.height / 2 : e.clientY
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )

    const isMobile = window.innerWidth < 1024

    if (!isMobile) {
      document.documentElement.classList.add('theme-transition')
      document.documentElement.style.setProperty('--click-x', `${x}px`)
      document.documentElement.style.setProperty('--click-y', `${y}px`)
      document.documentElement.style.setProperty('--end-radius', `${endRadius}px`)
    }

    const transition = (document as any).startViewTransition(() => {
      flushSync(() => {
        setTheme(next)
        setLocalTheme(next)
      })
    })

    if (!isMobile) {
      transition.finished.then(() => {
        document.documentElement.classList.remove('theme-transition')
      })
    }
  }

  const Icon = theme === "dark" ? Moon : Sun

  return (
    <button
      ref={btnRef}
      onClick={cycle}
      className="absolute top-6 right-6 z-20 flex size-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur border border-white/15 text-white hover:bg-white/20 active:scale-90 transition-all duration-150"
      title="Toggle theme"
    >
      <Icon className="size-4" />
    </button>
  )
}

// ── Main AuthView Component ────────────────────────────────
export function AuthView({ onAuthenticated }: AuthViewProps) {
  const [mode, setMode]               = React.useState<AuthMode>("login")
  const [username, setUsername]       = React.useState("")
  const [email, setEmail]             = React.useState("")
  const [password, setPassword]       = React.useState("")
  const [showPw, setShowPw]           = React.useState(false)
  const [errorMsg, setErrorMsg]       = React.useState("")
  const [loading, setLoading]         = React.useState(false)
  const [success, setSuccess]         = React.useState(false)
  const [shake, setShake]             = React.useState(false)

  const isLogin = mode === "login"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg("")
    setLoading(true)
    setShake(false)
    try {
      if (isLogin) {
        await api.auth.login(email, password)
      } else {
        if (username.trim().length < 2) throw new Error("Username must be at least 2 characters")
        await api.auth.signup(username.trim(), email, password)
        await api.auth.login(email, password)
      }

      // Fetch user profile immediately before starting the transition to prevent visual lag
      const profile = await api.auth.getMe()

      setSuccess(true)

      const isSupported = typeof document !== "undefined" && "startViewTransition" in document
      if (isSupported) {
        const isMobile = window.innerWidth < 1024
        if (!isMobile) {
          const x = window.innerWidth / 2
          const y = window.innerHeight / 2
          const endRadius = Math.hypot(x, y)

          document.documentElement.classList.add('theme-transition')
          document.documentElement.style.setProperty('--click-x', `${x}px`)
          document.documentElement.style.setProperty('--click-y', `${y}px`)
          document.documentElement.style.setProperty('--end-radius', `${endRadius}px`)
        }

        const transition = (document as any).startViewTransition(() => {
          flushSync(() => {
            onAuthenticated(profile)
          })
        })

        if (!isMobile) {
          transition.finished.then(() => {
            document.documentElement.classList.remove('theme-transition')
          })
        }
      } else {
        onAuthenticated(profile)
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong. Please try again.")
      setShake(true)
      setTimeout(() => setShake(false), 450)
    } finally {
      setLoading(false)
    }
  }

  function switchMode(m: AuthMode) {
    setMode(m); setUsername(""); setEmail(""); setPassword(""); setErrorMsg(""); setShake(false)
  }

  return (
    <div className="gl-root flex min-h-svh items-center justify-center lg:justify-end p-4 lg:pr-24">
      {/* Background Image Container */}
      <div className="gl-bg-image" />
      {/* Grayscale/Brightness Color Correction Tint Overlay */}
      <div className="gl-bg-overlay" />

      {/* Dynamic Theme Toggle in Top Right */}
      <ThemeToggle />

      <div
        className={cn(
          "w-full max-w-[400px] z-10 transition-all duration-300",
          success && "scale-95 opacity-0"
        )}
      >
        {/* Simple Brand Header */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="flex size-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur border border-white/20 text-white shadow-lg">
            <Zap className="size-5 fill-white text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white drop-shadow-md">TaskPulse</span>
        </div>

        {/* Glassmorphism Card */}
        <div className={cn("gl-card p-6 sm:p-8 rounded-2xl border border-white/20 shadow-2xl backdrop-blur-xl", shake && "gl-shake")}>
          {/* Tabs */}
          <div className="flex bg-black/30 dark:bg-black/50 p-1 rounded-xl gap-1 mb-6">
            {(["login", "signup"] as AuthMode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={cn(
                  "flex-1 text-center py-1.5 text-xs font-bold rounded-lg border transition-all",
                  mode === m
                    ? "bg-white/15 border-white/20 text-white shadow-sm backdrop-blur-sm"
                    : "border-transparent text-white/60 hover:text-white hover:bg-white/5"
                )}
              >
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          {/* Heading */}
          <div className="mb-5 space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-white drop-shadow-sm">
              {isLogin ? "Welcome back" : "Create Account"}
            </h2>
            <p className="text-xs text-white/70">
              {isLogin ? "Sign in to access your task workspace." : "Get started with your free account."}
            </p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 mb-4 rounded-xl border border-red-500/30 bg-red-500/20 text-red-200 text-xs font-semibold animate-fade-up">
              {errorMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <label htmlFor="gl-username" className="text-xs font-bold uppercase tracking-wider text-white/70">Username</label>
                <input
                  id="gl-username"
                  type="text"
                  placeholder="alexrivera"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  disabled={loading}
                  className="gl-input"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="gl-email" className="text-xs font-bold uppercase tracking-wider text-white/70">Email Address</label>
              <input
                id="gl-email"
                type="email"
                placeholder="alex@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={loading}
                className="gl-input"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="gl-password" className="text-xs font-bold uppercase tracking-wider text-white/70">Password</label>
              <div className="relative">
                <input
                  id="gl-password"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="gl-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="gl-submit-btn w-full mt-2"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <span>{isLogin ? "Sign In" : "Register"}</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle */}
          <p className="mt-5 text-center text-xs text-white/70">
            {isLogin ? "New to TaskPulse?" : "Have an account?"}{" "}
            <button
              type="button"
              onClick={() => switchMode(isLogin ? "signup" : "login")}
              className="font-bold text-white hover:underline underline-offset-2"
            >
              {isLogin ? "Sign up free" : "Log in"}
            </button>
          </p>
        </div>
      </div>

      <style>{`
        .gl-root {
          position: relative;
          background: #0d0d0f;
          overflow: hidden;
        }

        /* Full bleed background cover */
        .gl-bg-image {
          position: absolute;
          inset: 0;
          background-image: url('/bg.webp'); /* Mobile default (160KB) */
          background-size: cover;
          background-position: center;
          pointer-events: none;
        }

        /* Large screens get the high-resolution bg-desktop.webp (optimized) */
        @media (min-width: 1024px) {
          .gl-bg-image {
            background-image: url('/bg-desktop.webp');
          }
        }

        /* Color correction overlay - darken/contrast mapping */
        .gl-bg-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(13, 13, 15, 0.45) 0%, rgba(20, 20, 25, 0.7) 100%);
          pointer-events: none;
        }
        .dark .gl-bg-overlay {
          background: linear-gradient(135deg, rgba(8, 8, 10, 0.6) 0%, rgba(13, 13, 15, 0.85) 100%);
        }

        /* Glassmorphism Card styling with premium frosted look */
        .gl-card {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
        .dark .gl-card {
          background: rgba(20, 20, 25, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.6);
        }

        /* Transparent Glass Inputs */
        .gl-input {
          display: block;
          width: 100%;
          height: 2.75rem;
          padding-left: 0.875rem;
          padding-right: 0.875rem;
          border-radius: 0.75rem;
          border: 1.5px solid rgba(255, 255, 255, 0.12);
          background: rgba(0, 0, 0, 0.3);
          color: #ffffff;
          font-size: 0.875rem;
          font-weight: 500;
          outline: none;
          transition: border-color 0.18s, box-shadow 0.18s, background-color 0.18s;
        }
        .gl-input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }
        .gl-input:hover:not(:disabled) {
          background: rgba(0, 0, 0, 0.4);
          border-color: rgba(255, 255, 255, 0.25);
        }
        .gl-input:focus {
          background: rgba(0, 0, 0, 0.5);
          border-color: rgba(255, 255, 255, 0.45);
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
        }

        /* Prevent browser autofill from breaking the glass styling */
        .gl-input:-webkit-autofill,
        .gl-input:-webkit-autofill:hover, 
        .gl-input:-webkit-autofill:focus, 
        .gl-input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px rgba(15, 15, 20, 0.85) inset !important;
          -webkit-text-fill-color: #ffffff !important;
          caret-color: #ffffff;
          transition: background-color 5000s ease-in-out 0s;
        }

        /* Glassy Submit button */
        .gl-submit-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          height: 2.75rem;
          border-radius: 0.75rem;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.22);
          color: #ffffff;
          font-weight: 700;
          font-size: 0.875rem;
          border: none;
          cursor: pointer;
          transition: transform 0.15s, background-color 0.15s, box-shadow 0.15s;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .gl-submit-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          box-shadow: 0 6px 20px rgba(255, 255, 255, 0.1);
        }
        .gl-submit-btn:active {
          transform: scale(0.97);
        }

        /* ── Hard Shaking animation on validation error ── */
        .gl-shake {
          animation: glHardShake 0.4s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes glHardShake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  )
}
