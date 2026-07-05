"use client"

import * as React from "react"
import { flushSync } from "react-dom"
import {
  CheckSquare2,
  Circle,
  ListTodo,
  Menu,
  Moon,
  Settings,
  Sun,
  X,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getStoredTheme, setTheme, type Theme } from "@/lib/theme"
import type { User } from "@/lib/tasks"

interface AppSidebarProps {
  user: User
  activeFilter: "all" | "pending" | "in_progress" | "completed"
  onFilterChange: (f: "all" | "pending" | "in_progress" | "completed") => void
  onOpenProfile: () => void
  onLogout: () => void
  isMobileOpen: boolean
  onMobileClose: () => void
}

const NAV_ITEMS = [
  { key: "all",         label: "All Tasks",      icon: ListTodo      },
  { key: "pending",     label: "Pending",         icon: Circle        },
  { key: "in_progress", label: "In Progress",     icon: CheckSquare2  },
  { key: "completed",   label: "Completed",       icon: CheckSquare2  },
] as const

function ThemeCycleButton() {
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

    const transition = (document as any).startViewTransition(() => {
      flushSync(() => {
        setTheme(next)
        setLocalTheme(next)
      })
    })

    transition.ready.then(() => {
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      )

      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 550,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          pseudoElement: "::view-transition-new(root)",
        }
      )
    })
  }

  const Icon = theme === "dark" ? Moon : Sun

  return (
    <button
      ref={btnRef}
      onClick={cycle}
      title={`Theme: ${theme}. Click to cycle.`}
      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      <Icon className="size-4" />
    </button>
  )
}

function UserInitials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold select-none shrink-0">
      {initials || "?"}
    </div>
  )
}

export function AppSidebar({
  user,
  activeFilter,
  onFilterChange,
  onOpenProfile,
  onLogout,
  isMobileOpen,
  onMobileClose,
}: AppSidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar border-r border-sidebar-border",
          "transition-transform duration-300 ease-out",
          "lg:relative lg:translate-x-0 lg:z-auto",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between px-4 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary">
              <Zap className="size-3.5 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight text-sidebar-foreground">TaskPulse</span>
          </div>

          <div className="flex items-center gap-1">
            <ThemeCycleButton />
            <button
              className="lg:hidden flex size-8 items-center justify-center rounded-lg hover:bg-accent text-muted-foreground"
              onClick={onMobileClose}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-0.5">
          <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Views
          </p>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const active = activeFilter === item.key
            return (
              <button
                key={item.key}
                onClick={() => {
                  onFilterChange(item.key as any)
                  onMobileClose()
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.98]",
                  active
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/75 hover:bg-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                {item.label}
                {active && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
              </button>
            )
          })}
        </nav>

        {/* Footer: user */}
        <div className="border-t border-sidebar-border p-3 space-y-1">
          <button
            onClick={onOpenProfile}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent active:scale-[0.98] transition-all duration-150 group"
          >
            <UserInitials name={user.username} />
            <div className="flex-1 min-w-0 text-left">
              <p className="font-medium text-sm truncate text-sidebar-foreground">{user.username}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <Settings className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <button
            onClick={onLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10 active:scale-[0.98] transition-all duration-150"
          >
            <span className="text-xs font-medium">Sign out</span>
          </button>
        </div>
      </aside>
    </>
  )
}

// Mobile top bar
export function MobileTopBar({
  onMenuOpen,
}: {
  onMenuOpen: () => void
}) {
  return (
    <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 backdrop-blur px-4 lg:hidden">
      <button
        onClick={onMenuOpen}
        className="flex size-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
      >
        <Menu className="size-5" />
      </button>
      <div className="flex items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-md bg-primary">
          <Zap className="size-3 text-white" />
        </div>
        <span className="font-bold text-sm tracking-tight">TaskPulse</span>
      </div>
    </div>
  )
}
