"use client"

import * as React from "react"
import { flushSync } from "react-dom"
import { Loader2, Zap } from "lucide-react"

import { AuthView }      from "@/components/auth-view"
import { AppSidebar, MobileTopBar } from "@/components/app-sidebar"
import { TaskDashboard } from "@/components/task-dashboard"
import { ProfileModal }  from "@/components/profile-modal"
import { api, clearTokens, getAccessToken } from "@/lib/api"
import type { User } from "@/lib/tasks"

type SidebarFilter = "all" | "pending" | "in_progress" | "completed"

export default function Page() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false)
  const [user, setUser]                       = React.useState<(User & { id: number }) | null>(null)
  const [isLoading, setIsLoading]             = React.useState(true)

  const [activeFilter,  setActiveFilter]  = React.useState<SidebarFilter>("all")
  const [profileOpen,   setProfileOpen]   = React.useState(false)
  const [sidebarOpen,   setSidebarOpen]   = React.useState(false)

  // ── Auth check on mount ────────────────────────────────
  const checkAuth = React.useCallback(async (preFetchedUser?: User) => {
    const token = getAccessToken()
    if (!token) {
      setIsLoading(false)
      return
    }
    if (preFetchedUser) {
      setUser(preFetchedUser as User & { id: number })
      setIsAuthenticated(true)
      setIsLoading(false)
      return
    }
    try {
      const profile = await api.auth.getMe()
      setUser(profile as User & { id: number })
      setIsAuthenticated(true)
    } catch {
      setIsAuthenticated(false)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    checkAuth()
    const handler = () => { setIsAuthenticated(false); setUser(null) }
    window.addEventListener("api-unauthorized", handler)
    return () => window.removeEventListener("api-unauthorized", handler)
  }, [checkAuth])

  // ── Logout ─────────────────────────────────────────────
  const handleLogout = React.useCallback(async () => {
    // Fire API call in the background without awaiting it to avoid freezing UI
    api.auth.logout().catch(() => {})
    
    const isSupported = typeof document !== 'undefined' && 'startViewTransition' in document
    if (isSupported) {
      const x = window.innerWidth / 2
      const y = window.innerHeight / 2
      const endRadius = Math.hypot(x, y)
      const transition = (document as any).startViewTransition(() => {
        flushSync(() => {
          setIsAuthenticated(false)
          setUser(null)
        })
      })
      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 750,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            pseudoElement: "::view-transition-new(root)",
          }
        )
      })
    } else {
      setIsAuthenticated(false)
      setUser(null)
    }
  }, [])

  // ── Account deleted ────────────────────────────────────
  const handleAccountDeleted = React.useCallback(() => {
    clearTokens()
    setProfileOpen(false)
    const isSupported = typeof document !== 'undefined' && 'startViewTransition' in document
    if (isSupported) {
      const x = window.innerWidth / 2
      const y = window.innerHeight / 2
      const endRadius = Math.hypot(x, y)
      const transition = (document as any).startViewTransition(() => {
        flushSync(() => {
          setIsAuthenticated(false)
          setUser(null)
        })
      })
      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 750,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            pseudoElement: "::view-transition-new(root)",
          }
        )
      })
    } else {
      setIsAuthenticated(false)
      setUser(null)
    }
  }, [])

  // ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
          <Zap className="size-7 text-white" />
        </div>
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading TaskPulse…</p>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <AuthView onAuthenticated={checkAuth} />
  }

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      {/* Sidebar */}
      <AppSidebar
        user={user}
        activeFilter={activeFilter}
        onFilterChange={f => { setActiveFilter(f); setSidebarOpen(false) }}
        onOpenProfile={() => setProfileOpen(true)}
        onLogout={handleLogout}
        isMobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <MobileTopBar onMenuOpen={() => setSidebarOpen(true)} />

        {/* Task area */}
        <main className="flex-1 overflow-hidden">
          <TaskDashboard statusView={activeFilter} />
        </main>
      </div>

      {/* Profile modal */}
      {user && (
        <ProfileModal
          user={user}
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          onUserUpdated={updated => setUser({ ...user, ...updated })}
          onAccountDeleted={handleAccountDeleted}
        />
      )}
    </div>
  )
}
