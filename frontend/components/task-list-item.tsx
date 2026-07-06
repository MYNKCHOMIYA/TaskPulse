"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { CalendarDays, ChevronDown, Pencil, Trash2, Play, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDueDate, STATUS_OPTIONS, type Task, type TaskPriority, type TaskStatus } from "@/lib/tasks"

interface TaskListItemProps {
  task: Task
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onToggleComplete: (task: Task) => void
  onStatusChange: (task: Task, status: TaskStatus) => void
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: (task: Task) => void
  onStartSelection?: (task: Task) => void
}

const PRIORITY_CONFIG: Record<Exclude<TaskPriority, null>, { dot: string; badge: string; label: string }> = {
  URGENT: { dot: "bg-rose-500",   badge: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",       label: "Urgent" },
  HIGH:   { dot: "bg-orange-400", badge: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300", label: "High" },
  MEDIUM: { dot: "bg-amber-400",  badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",   label: "Medium" },
  LOW:    { dot: "bg-sky-400",    badge: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",           label: "Low" },
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; badge: string; dot: string; border: string }> = {
  IN_PROGRESS: { label: "In Progress", badge: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",         dot: "bg-blue-500",    border: "border-l-blue-400 dark:border-l-blue-500" },
  PENDING:     { label: "Pending",     badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",     dot: "bg-amber-400",   border: "border-l-amber-400 dark:border-l-amber-500" },
  COMPLETED:   { label: "Completed",   badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300", dot: "bg-emerald-400", border: "border-l-transparent" },
}

// ── Time Helpers ─────────────────────────────────────────────
function formatUTC(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true
  }) + " UTC"
}

function formatDuration(ms: number) {
  if (ms < 0) ms = 0
  const secs = Math.floor(ms / 1000)
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function LiveTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = React.useState(0)

  React.useEffect(() => {
    const start = new Date(startedAt).getTime()
    const update = () => setElapsed(Date.now() - start)
    update() // initial
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  return (
    <span className="font-mono bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight shadow-sm">
      {formatDuration(elapsed)}
    </span>
  )
}

// Logarithmic spring — resistance builds up, hard clamp at 45% viewport
function spring(dx: number): number {
  const abs = Math.abs(dx), sign = Math.sign(dx)
  let tx: number
  if      (abs <= 60)  tx = dx * 0.85
  else if (abs <= 120) tx = sign * 51 + (dx - sign * 60) * 0.45
  else                 tx = sign * 78 + (dx - sign * 120) * 0.15
  const max = typeof window !== "undefined" ? window.innerWidth * 0.45 : 200
  return Math.abs(tx) > max ? Math.sign(tx) * max : tx
}

export function TaskListItem({
  task, onEdit, onDelete, onToggleComplete, onStatusChange,
  selectionMode = false, selected = false, onToggleSelect, onStartSelection,
}: TaskListItemProps) {
  const [expanded,       setExpanded]       = React.useState(false)
  const [menuOpen,       setMenuOpen]       = React.useState(false)
  const [statusOpen,     setStatusOpen]     = React.useState(false)
  const [isCollapsing,   setIsCollapsing]   = React.useState(false)
  const [collapseHeight, setCollapseHeight] = React.useState<number | undefined>(undefined)
  const [dropdownCoords, setDropdownCoords] = React.useState<{
    top: number; left: number; type: "status" | "menu" | null
  }>({ top: 0, left: 0, type: null })

  // DOM refs — all visual updates hit these directly, bypassing React render
  const elementRef   = React.useRef<HTMLDivElement>(null)
  const cardRef      = React.useRef<HTMLDivElement>(null)
  const bgRightRef   = React.useRef<HTMLDivElement>(null)
  const bgLeftRef    = React.useRef<HTMLDivElement>(null)
  const iconRightRef = React.useRef<HTMLDivElement>(null)
  const iconLeftRef  = React.useRef<HTMLDivElement>(null)
  const menuRef      = React.useRef<HTMLDivElement>(null)
  const moreBtnRef   = React.useRef<HTMLButtonElement>(null)
  const statusRef    = React.useRef<HTMLDivElement>(null)
  const statusBtnRef = React.useRef<HTMLButtonElement>(null)

  // Gesture tracking — all refs, zero React state during drag
  const startX     = React.useRef(0)
  const startY     = React.useRef(0)
  const prevClientY = React.useRef(0)   // for manual scroll delta
  const liveTx     = React.useRef(0)
  const axis       = React.useRef<"none" | "horiz" | "vert">("none")
  const dragging   = React.useRef(false)
  const longTimer  = React.useRef<NodeJS.Timeout | null>(null)
  const longFired  = React.useRef(false)

  // ── Direct DOM paint — no React reconciler, 0ms latency ─────────────
  const paint = (tx: number) => {
    liveTx.current = tx
    const P = Math.min(1, Math.abs(tx) / 120)
    if (cardRef.current) {
      // Always keep translateZ(0) — it maintains the GPU compositor layer.
      // Without it, Samsung Chrome stops firing touchmove after the first write.
      cardRef.current.style.transform  = `translateX(${tx}px) translateZ(0)`
      cardRef.current.style.transition = "none"
    }

    // Only reveal background in directions that will actually trigger an action
    const canRight = task.status !== "IN_PROGRESS"
    const canLeft  = task.status !== "COMPLETED"

    if (bgRightRef.current)   bgRightRef.current.style.opacity   = (tx > 0 && canRight) ? String(P * 0.95) : "0"
    if (bgLeftRef.current)    bgLeftRef.current.style.opacity    = (tx < 0 && canLeft)  ? String(P * 0.95) : "0"

    const s = 0.65 + P * 0.35, iTx = tx * 0.22
    if (iconRightRef.current) {
      iconRightRef.current.style.opacity   = (tx > 0 && canRight) ? String(P) : "0"
      iconRightRef.current.style.transform = `scale(${s}) translateX(${iTx}px)`
    }
    if (iconLeftRef.current) {
      iconLeftRef.current.style.opacity   = (tx < 0 && canLeft) ? String(P) : "0"
      iconLeftRef.current.style.transform = `scale(${s}) translateX(${iTx}px)`
    }
  }

  const snapBack = (animated: boolean) => {
    if (cardRef.current) {
      cardRef.current.style.transition = animated
        ? "transform 400ms cubic-bezier(0.175, 0.885, 0.32, 1.15)"
        : "none"
      // Preserve translateZ(0) to keep the GPU layer alive for the next gesture
      cardRef.current.style.transform = "translateX(0) translateZ(0)"
    }
    if (bgRightRef.current)   bgRightRef.current.style.opacity   = "0"
    if (bgLeftRef.current)    bgLeftRef.current.style.opacity    = "0"
    if (iconRightRef.current) iconRightRef.current.style.opacity = "0"
    if (iconLeftRef.current)  iconLeftRef.current.style.opacity  = "0"
    liveTx.current = 0
  }

  const triggerCollapse = React.useCallback(() => {
    if (cardRef.current) {
      cardRef.current.style.transition = "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)"
      // translateZ(0) keeps GPU layer during slide-out
      cardRef.current.style.transform  = "translateX(-110%) translateZ(0)"
    }
    if (elementRef.current) setCollapseHeight(elementRef.current.offsetHeight)
    setTimeout(() => setIsCollapsing(true), 16)
    setTimeout(() => {
      onStatusChange(task, "COMPLETED")
      setIsCollapsing(false); setCollapseHeight(undefined)
      liveTx.current = 0
      if (cardRef.current) { cardRef.current.style.transform = "translateZ(0)"; cardRef.current.style.transition = "" }
    }, 380)
  }, [task, onStatusChange])

  // ── Touch handlers — synthetic React events ────────────────────────
  // With touch-action:none on the card, React synthetic events fire for ALL
  // touches. We don't need a native listener or e.preventDefault() because
  // touch-action:none already tells the browser not to handle pan/zoom.
  const onTouchStart = (e: React.TouchEvent) => {
    if (menuOpen || statusOpen) return
    const t = e.touches[0]
    startX.current     = t.clientX
    startY.current     = t.clientY
    prevClientY.current = t.clientY
    liveTx.current     = 0
    axis.current       = "none"
    dragging.current   = false
    longFired.current  = false

    if (onStartSelection && !selectionMode) {
      longTimer.current = setTimeout(() => {
        if (longFired.current) return
        longFired.current = true
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(40)
        onStartSelection(task)
      }, 550)
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (menuOpen || statusOpen) return
    const t = e.touches[0]
    const dx = t.clientX - startX.current
    const dy = t.clientY - startY.current

    // Axis decision: 10px dead-zone, bias strongly toward horizontal
    if (axis.current === "none") {
      if (Math.sqrt(dx * dx + dy * dy) < 10) return
      if (Math.abs(dy) > Math.abs(dx) * 1.8) {
        axis.current = "vert"
        if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null }
      } else {
        axis.current = "horiz"
        dragging.current = true
        if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null }
      }
    }

    if (axis.current === "vert") {
      const delta = prevClientY.current - t.clientY
      prevClientY.current = t.clientY
      window.scrollBy(0, delta)
      return
    }

    if (axis.current === "horiz") {
      // Block right swipe (→ IN_PROGRESS) if already IN_PROGRESS
      // Block left swipe  (→ COMPLETED)   if already COMPLETED
      // Allow a tiny rubber-band resistance so the user feels the block
      const blocked =
        (dx > 0 && task.status === "IN_PROGRESS") ||
        (dx < 0 && task.status === "COMPLETED")

      paint(blocked ? dx * 0.08 : spring(dx))
    }
  }

  const onTouchEnd = () => {
    if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null }

    // Plain tap — do nothing
    if (!dragging.current) {
      axis.current = "none"
      return
    }
    dragging.current = false
    axis.current     = "none"

    const tx = liveTx.current
    if (tx >= 72) {
      // Right swipe → IN_PROGRESS (blocked if already IN_PROGRESS)
      if (task.status === "IN_PROGRESS") {
        snapBack(true)
      } else {
        snapBack(true)
        onStatusChange(task, "IN_PROGRESS")
      }
    } else if (tx <= -72) {
      // Left swipe → COMPLETED (blocked if already COMPLETED)
      if (task.status === "COMPLETED") {
        snapBack(true)
      } else {
        triggerCollapse()
      }
    } else {
      snapBack(true)
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    if (moreBtnRef.current?.contains(e.target as Node)  ||
        statusBtnRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)      ||
        statusRef.current?.contains(e.target as Node)) return
    if (selectionMode && onToggleSelect) onToggleSelect(task)
  }

  const openStatusDropdown = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (statusOpen) { setStatusOpen(false); return }
    const rect = statusBtnRef.current?.getBoundingClientRect()
    if (rect) { setDropdownCoords({ top: rect.bottom + 4, left: rect.left, type: "status" }); setStatusOpen(true); setMenuOpen(false) }
  }
  const openMenuDropdown = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (menuOpen) { setMenuOpen(false); return }
    const rect = moreBtnRef.current?.getBoundingClientRect()
    if (rect) { setDropdownCoords({ top: rect.bottom + 4, left: rect.left - 110, type: "menu" }); setMenuOpen(true); setStatusOpen(false) }
  }

  React.useEffect(() => {
    if (!menuOpen) return
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          moreBtnRef.current && !moreBtnRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
  }, [menuOpen])

  React.useEffect(() => {
    if (!statusOpen) return
    const h = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node) &&
          statusBtnRef.current && !statusBtnRef.current.contains(e.target as Node)) setStatusOpen(false)
    }
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
  }, [statusOpen])

  React.useEffect(() => {
    if (!statusOpen && !menuOpen) return
    const close = () => { setStatusOpen(false); setMenuOpen(false) }
    window.addEventListener("scroll", close, { passive: true }); window.addEventListener("resize", close, { passive: true })
    return () => { window.removeEventListener("scroll", close); window.removeEventListener("resize", close) }
  }, [statusOpen, menuOpen])

  const isCompleted = task.status === "COMPLETED"
  const priorityCfg = task.priority ? PRIORITY_CONFIG[task.priority] : null
  const statusCfg   = STATUS_CONFIG[task.status]
  const isOverdue   = !isCompleted && task.due_date ? new Date(task.due_date) < new Date() : false

  const wrapperStyle: React.CSSProperties = isCollapsing
    ? { height: 0, opacity: 0, marginTop: 0, marginBottom: 0, overflow: "hidden",
        transition: "height 0.35s ease, margin 0.35s ease, opacity 0.35s ease", isolation: "isolate" }
    : collapseHeight !== undefined
    ? { height: collapseHeight, transition: "height 0.35s ease, margin 0.35s ease, opacity 0.35s ease", isolation: "isolate" }
    : { isolation: "isolate" }

  return (
    <div ref={elementRef} style={wrapperStyle} className={cn("relative select-none", isCompleted && "animate-completed-slide-down")}>

      {/* BACKGROUND REVEAL */}
      <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none" style={{ zIndex: 10 }} aria-hidden>
        <div ref={bgRightRef}  className="absolute inset-0 bg-blue-500"    style={{ opacity: 0 }} />
        <div ref={bgLeftRef}   className="absolute inset-0 bg-emerald-500" style={{ opacity: 0 }} />
        <div ref={iconRightRef} className="absolute inset-y-0 left-0 flex items-center pl-5 text-white gap-1.5" style={{ opacity: 0, transform: "scale(0.65)" }}>
          <Play className="size-5 shrink-0" /><span className="text-sm font-bold">Start</span>
        </div>
        <div ref={iconLeftRef}  className="absolute inset-y-0 right-0 flex items-center pr-5 text-white gap-1.5" style={{ opacity: 0, transform: "scale(0.65)" }}>
          <span className="text-sm font-bold">Done</span><Check className="size-5 shrink-0" />
        </div>
      </div>

      {/* FOREGROUND CARD */}
      <div
        ref={cardRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={handleClick}
        style={{
          position: "relative",
          zIndex: 20,
          touchAction: "none",
          // translateZ(0): forces GPU compositor layer immediately on mount.
          // backfaceVisibility:hidden: secondary GPU layer guarantee (Samsung fix).
          // Both together ensure touchmove events are delivered for PENDING/COMPLETED
          // cards that have no running CSS animation to promote them naturally.
          transform: "translateZ(0)",
          willChange: "transform",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
        className={cn(
          "group rounded-xl border border-border border-l-2 bg-card",
          task.status === "IN_PROGRESS" ? "animate-progress-glow" : "animate-layer-keep-alive",
          selected ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-md ring-2 ring-primary/20"
                   : !isCompleted ? statusCfg.border : "border-l-transparent opacity-55",
          (menuOpen || statusOpen) ? "shadow-md border-border/80" : "hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/25",
          selectionMode && "cursor-pointer",
          "animate-fade-up",
        )}
      >
        {/* IN_PROGRESS bouncing activity dots */}
        {task.status === "IN_PROGRESS" && (
          <div className="absolute bottom-2 right-3 flex items-center gap-[3px] pointer-events-none" style={{ zIndex: 21 }}>
            <span className="activity-dot-1 inline-block size-1 rounded-full bg-blue-400" />
            <span className="activity-dot-2 inline-block size-1 rounded-full bg-blue-400" />
            <span className="activity-dot-3 inline-block size-1 rounded-full bg-blue-400" />
          </div>
        )}

        <div className="flex items-center gap-3 px-4 py-3">
          {/* Checkbox / selection */}
          <div className="flex items-center justify-center shrink-0">
            {selectionMode ? (
              <div className={cn("flex size-5 items-center justify-center rounded-lg border-2 transition-all duration-150",
                selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/45 hover:border-primary")}>
                {selected && <svg viewBox="0 0 10 8" fill="none" className="size-2.5"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
            ) : (
              <button onClick={() => onToggleComplete(task)} title={isCompleted ? "Mark as pending" : "Mark as complete"}
                className={cn("flex size-5 items-center justify-center rounded-full border-2 transition-all duration-200 active:scale-90 hover:scale-110",
                  isCompleted ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                              : "border-border hover:border-primary hover:bg-accent hover:shadow-sm hover:shadow-primary/15")}>
                {isCompleted && <svg viewBox="0 0 10 8" fill="none" className="size-3"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className={cn("min-w-0 truncate text-sm font-medium leading-snug", isCompleted && "line-through text-muted-foreground")}>
                {task.title}
              </span>
              {priorityCfg && (
                <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", priorityCfg.badge)}>
                  <span className={cn("size-1.5 rounded-full shrink-0", priorityCfg.dot)} />{priorityCfg.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button ref={statusBtnRef} onClick={openStatusDropdown} title="Change status"
                className={cn("inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[10px] font-semibold select-none transition-all duration-150 hover:opacity-75 active:scale-95", statusCfg.badge)}>
                <span className="relative flex size-1.5 shrink-0">
                  {task.status === "IN_PROGRESS" && <span className={cn("animate-ping absolute inset-0 rounded-full opacity-60", statusCfg.dot)} />}
                  {task.status === "PENDING"     && <span className={cn("animate-pulse absolute inset-0 rounded-full opacity-75", statusCfg.dot)} />}
                  <span className={cn("relative inline-flex size-1.5 rounded-full", statusCfg.dot)} />
                </span>
                {statusCfg.label}<ChevronDown className="size-2.5 opacity-60" />
              </button>
              {task.due_date
                ? <span className={cn("inline-flex items-center gap-1 text-[11px]", isOverdue ? "font-medium text-destructive" : "text-muted-foreground")}><CalendarDays className="size-3 shrink-0" />{formatDueDate(task.due_date)}</span>
                : <span className="text-[11px] text-muted-foreground/40">No due date</span>}
            </div>
            {/* Inline timing badges — always visible, no expand needed */}
            {task.status === "IN_PROGRESS" && task.started_at && (
              <div className="flex items-center gap-2 mt-0.5">
                <Play className="size-2.5 text-blue-500 shrink-0" />
                <span className="text-[10px] text-muted-foreground">Started {formatUTC(task.started_at)}</span>
                <LiveTimer startedAt={task.started_at} />
              </div>
            )}
            {task.status === "COMPLETED" && task.completed_at && (
              <div className="flex items-center gap-2 mt-0.5">
                <Check className="size-2.5 text-emerald-500 shrink-0" />
                {task.started_at && task.completed_at ? (
                  <span className="text-[10px] text-muted-foreground">
                    Completed in{" "}
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatDuration(new Date(task.completed_at).getTime() - new Date(task.started_at).getTime())}
                    </span>
                    {" · "}{formatUTC(task.started_at).replace(" UTC","")} → {formatUTC(task.completed_at)}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Completed at {formatUTC(task.completed_at)}</span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1">
            {(task.description || task.started_at || task.completed_at) && (
              <button onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
                className={cn("flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground active:scale-90 transition-all duration-150", !expanded && "opacity-0 group-hover:opacity-100")}>
                <ChevronDown className={cn("size-3.5 transition-transform duration-200", expanded && "rotate-180")} />
              </button>
            )}
            <button ref={moreBtnRef} onClick={openMenuDropdown} title="More options"
              className={cn("flex size-7 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 text-muted-foreground hover:bg-muted hover:text-foreground active:scale-90 transition-all duration-150", menuOpen && "!opacity-100 bg-muted text-foreground")}>
              <svg viewBox="0 0 16 4" fill="currentColor" className="w-3.5">
                <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="14" cy="2" r="1.5"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-12 pb-3.5 animate-fade-up space-y-3">
          {task.description && (
            <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground leading-relaxed">
              {task.description}
            </p>
          )}
          
          {/* Timing details */}
          {(task.started_at || task.completed_at) && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-border/50 bg-background/50 p-3 text-[11px] text-muted-foreground">
              {task.started_at && (
                <div className="flex items-center gap-2">
                  <Play className="size-3 text-blue-500" />
                  <span>Started at: <span className="font-semibold text-foreground">{formatUTC(task.started_at)}</span></span>
                  {task.status === "IN_PROGRESS" && <LiveTimer startedAt={task.started_at} />}
                </div>
              )}
              {task.completed_at && (
                <div className="flex items-center gap-2 mt-0.5">
                  <Check className="size-3 text-emerald-500" />
                  <span>Ended at: <span className="font-semibold text-foreground">{formatUTC(task.completed_at)}</span></span>
                </div>
              )}
              {task.completed_at && task.started_at && (
                <div className="mt-1.5 border-t border-border/50 pt-1.5">
                  <span className="font-medium text-foreground">Time taken:</span>{" "}
                  {formatDuration(new Date(task.completed_at).getTime() - new Date(task.started_at).getTime())}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PORTALIZED STATUS DROPDOWN */}
      {statusOpen && typeof document !== "undefined" && createPortal(
        <div ref={statusRef} style={{ position: "fixed", top: dropdownCoords.top, left: dropdownCoords.left, width: "168px", zIndex: 99999 }}
          className="rounded-xl border border-border bg-popover py-1 shadow-xl animate-scale-in">
          <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Set status</p>
          {STATUS_OPTIONS.map(opt => {
            const oCfg = STATUS_CONFIG[opt.value]; const isActive = task.status === opt.value
            return (
              <button key={opt.value} onClick={() => { setStatusOpen(false); if (opt.value === "COMPLETED") triggerCollapse(); else onStatusChange(task, opt.value) }}
                className={cn("flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors text-left", isActive ? "bg-accent text-foreground" : "text-foreground/80 hover:bg-muted")}>
                <span className="relative flex size-2 shrink-0">
                  {opt.value === "IN_PROGRESS" && <span className={cn("animate-ping absolute inset-0 rounded-full opacity-60", oCfg.dot)} />}
                  <span className={cn("relative inline-flex size-2 rounded-full", oCfg.dot)} />
                </span>
                {oCfg.label}
                {isActive && <svg className="ml-auto size-3 text-primary" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
            )
          })}
        </div>,
        document.body
      )}

      {/* PORTALIZED MORE ACTIONS MENU */}
      {menuOpen && typeof document !== "undefined" && createPortal(
        <div ref={menuRef} style={{ position: "fixed", top: dropdownCoords.top, left: dropdownCoords.left, width: "148px", zIndex: 99999 }}
          className="rounded-xl border border-border bg-popover py-1 shadow-xl animate-scale-in">
          <button onClick={() => { onEdit(task); setMenuOpen(false) }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground/80 hover:bg-muted hover:text-foreground transition-colors text-left">
            <Pencil className="size-3.5 shrink-0 text-muted-foreground" /> Edit task
          </button>
          <div className="mx-3 my-1 h-px bg-border" />
          <button onClick={() => { onDelete(task); setMenuOpen(false) }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left">
            <Trash2 className="size-3.5 shrink-0" /> Delete
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}
