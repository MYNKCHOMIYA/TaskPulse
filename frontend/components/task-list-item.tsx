"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
  CalendarDays,
  ChevronDown,
  Pencil,
  Trash2,
  Play,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  formatDueDate,
  STATUS_OPTIONS,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks"

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

const PRIORITY_CONFIG: Record<
  Exclude<TaskPriority, null>,
  { dot: string; badge: string; label: string }
> = {
  URGENT: { dot: "bg-rose-500",   badge: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",     label: "Urgent" },
  HIGH:   { dot: "bg-orange-400", badge: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300", label: "High" },
  MEDIUM: { dot: "bg-amber-400",  badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",  label: "Medium" },
  LOW:    { dot: "bg-sky-400",    badge: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",          label: "Low" },
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; badge: string; dot: string; border: string }> = {
  IN_PROGRESS: { label: "In Progress", badge: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",       dot: "bg-blue-500",    border: "border-l-blue-400 dark:border-l-blue-500" },
  PENDING:     { label: "Pending",     badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",   dot: "bg-amber-400",   border: "border-l-amber-400 dark:border-l-amber-500" },
  COMPLETED:   { label: "Completed",   badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300", dot: "bg-emerald-400", border: "border-l-transparent" },
}

export function TaskListItem({
  task, onEdit, onDelete, onToggleComplete, onStatusChange,
  selectionMode = false, selected = false, onToggleSelect, onStartSelection,
}: TaskListItemProps) {
  const [expanded,       setExpanded]       = React.useState(false)
  const [menuOpen,       setMenuOpen]       = React.useState(false)
  const [statusOpen,     setStatusOpen]     = React.useState(false)
  const [swipeX,         setSwipeX]         = React.useState(0)
  const [swiping,        setSwiping]        = React.useState(false)
  const [isPressing,     setIsPressing]     = React.useState(false)
  const [slideOut,       setSlideOut]       = React.useState<"left" | null>(null)
  const [isCollapsing,   setIsCollapsing]   = React.useState(false)
  const [collapseHeight, setCollapseHeight] = React.useState<number | undefined>(undefined)
  const [dropdownCoords, setDropdownCoords] = React.useState<{
    top: number; left: number; width: number; type: "status" | "menu" | null
  }>({ top: 0, left: 0, width: 0, type: null })

  const elementRef   = React.useRef<HTMLDivElement>(null)
  const cardRef      = React.useRef<HTMLDivElement>(null)
  const menuRef      = React.useRef<HTMLDivElement>(null)
  const moreBtnRef   = React.useRef<HTMLButtonElement>(null)
  const statusRef    = React.useRef<HTMLDivElement>(null)
  const statusBtnRef = React.useRef<HTMLButtonElement>(null)

  // All gesture tracking in refs so native listener never has stale values
  const startX         = React.useRef(0)
  const startY         = React.useRef(0)
  const liveSwipeX     = React.useRef(0)   // mirrors swipeX for use inside native handler
  const isHoriz        = React.useRef(false)
  const isScroll       = React.useRef(false)
  const axisDecided    = React.useRef(false)
  const activeSwiping  = React.useRef(false)
  const longTimer      = React.useRef<NodeJS.Timeout | null>(null)
  const longFired      = React.useRef(false)
  const menuOpenRef    = React.useRef(menuOpen)
  const statusOpenRef  = React.useRef(statusOpen)

  React.useEffect(() => { menuOpenRef.current = menuOpen },   [menuOpen])
  React.useEffect(() => { statusOpenRef.current = statusOpen }, [statusOpen])

  // ── Spring math ──────────────────────────────────────────────────────
  const computeSpring = (dx: number): number => {
    const abs  = Math.abs(dx)
    const sign = Math.sign(dx)
    let tx: number
    if      (abs <= 60)  tx = dx * 0.85
    else if (abs <= 120) tx = sign * 51 + (dx - sign * 60) * 0.45
    else                 tx = sign * 78 + (dx - sign * 120) * 0.15
    const max = window.innerWidth * 0.45
    return Math.abs(tx) > max ? Math.sign(tx) * max : tx
  }

  // ── Completed collapse ───────────────────────────────────────────────
  const triggerCollapse = React.useCallback(() => {
    setSlideOut("left")
    if (elementRef.current) setCollapseHeight(elementRef.current.offsetHeight)
    setTimeout(() => setIsCollapsing(true), 16)
    setTimeout(() => {
      onStatusChange(task, "COMPLETED")
      setSwipeX(0); liveSwipeX.current = 0
      setSlideOut(null); setIsCollapsing(false); setCollapseHeight(undefined)
    }, 380)
  }, [task, onStatusChange])

  // ── Native non-passive touchmove — attached once, no stale closure ──
  React.useEffect(() => {
    const el = cardRef.current
    if (!el) return

    const onMove = (e: TouchEvent) => {
      if (menuOpenRef.current || statusOpenRef.current) return
      if (e.touches.length !== 1) return
      if (isScroll.current) return

      const touch = e.touches[0]
      const dx = touch.clientX - startX.current
      const dy = touch.clientY - startY.current

      // Axis decision in first 6px of movement
      if (!axisDecided.current) {
        if (Math.hypot(dx, dy) < 6) return
        axisDecided.current = true
        if (Math.abs(dy) > Math.abs(dx)) {
          // Vertical → native scroll
          isScroll.current = true
          setIsPressing(false)
          if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null }
          return
        } else {
          // Horizontal → lock swipe
          isHoriz.current    = true
          activeSwiping.current = true
          setSwiping(true)
          setIsPressing(false)
          if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null }
        }
      }

      if (isHoriz.current) {
        e.preventDefault() // block scroll now that we are in a horizontal swipe
        const tx = computeSpring(dx)
        liveSwipeX.current = tx
        setSwipeX(tx)
      }
    }

    el.addEventListener("touchmove", onMove, { passive: false })
    return () => el.removeEventListener("touchmove", onMove)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Touch start ──────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    if (menuOpenRef.current || statusOpenRef.current) return
    const t = e.touches[0]
    startX.current        = t.clientX
    startY.current        = t.clientY
    liveSwipeX.current    = 0
    isHoriz.current       = false
    isScroll.current      = false
    axisDecided.current   = false
    activeSwiping.current = false
    longFired.current     = false
    setSwiping(false)
    setSlideOut(null)

    if (onStartSelection && !selectionMode) {
      setIsPressing(true)
      longTimer.current = setTimeout(() => {
        if (longFired.current) return
        longFired.current = true
        setIsPressing(false)
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(40)
        onStartSelection(task)
      }, 550)
    }
  }

  // ── Touch end ────────────────────────────────────────────────────────
  const onTouchEnd = () => {
    if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null }
    setIsPressing(false)

    if (activeSwiping.current) {
      activeSwiping.current = false
      setSwiping(false)
      const tx = liveSwipeX.current
      if      (tx >=  72) { setSwipeX(0); liveSwipeX.current = 0; onStatusChange(task, "IN_PROGRESS") }
      else if (tx <= -72) { triggerCollapse() }
      else                { setSwipeX(0); liveSwipeX.current = 0 }
    } else {
      setSwipeX(0); liveSwipeX.current = 0
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    if (moreBtnRef.current?.contains(e.target as Node)  ||
        statusBtnRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)      ||
        statusRef.current?.contains(e.target as Node)) return
    if (selectionMode && onToggleSelect) onToggleSelect(task)
  }

  // ── Portal dropdown helpers ──────────────────────────────────────────
  const openStatusDropdown = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (statusOpen) { setStatusOpen(false); return }
    const rect = statusBtnRef.current?.getBoundingClientRect()
    if (rect) {
      setDropdownCoords({ top: rect.bottom, left: rect.left, width: rect.width, type: "status" })
      setStatusOpen(true); setMenuOpen(false)
    }
  }
  const openMenuDropdown = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (menuOpen) { setMenuOpen(false); return }
    const rect = moreBtnRef.current?.getBoundingClientRect()
    if (rect) {
      setDropdownCoords({ top: rect.bottom, left: rect.left - 110, width: rect.width, type: "menu" })
      setMenuOpen(true); setStatusOpen(false)
    }
  }

  // Portal dismiss listeners
  React.useEffect(() => {
    if (!menuOpen) return
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          moreBtnRef.current && !moreBtnRef.current.contains(e.target as Node))
        setMenuOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [menuOpen])

  React.useEffect(() => {
    if (!statusOpen) return
    const h = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node) &&
          statusBtnRef.current && !statusBtnRef.current.contains(e.target as Node))
        setStatusOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [statusOpen])

  React.useEffect(() => {
    if (!statusOpen && !menuOpen) return
    const close = () => { setStatusOpen(false); setMenuOpen(false) }
    window.addEventListener("scroll", close, { passive: true })
    window.addEventListener("resize", close, { passive: true })
    return () => { window.removeEventListener("scroll", close); window.removeEventListener("resize", close) }
  }, [statusOpen, menuOpen])

  // ── Derived display values ───────────────────────────────────────────
  const isCompleted = task.status === "COMPLETED"
  const priorityCfg = task.priority ? PRIORITY_CONFIG[task.priority] : null
  const statusCfg   = STATUS_CONFIG[task.status]
  const isOverdue   = !isCompleted && task.due_date ? new Date(task.due_date) < new Date() : false

  const transition = swiping
    ? "none"
    : slideOut
    ? "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)"
    : "transform 400ms cubic-bezier(0.175, 0.885, 0.32, 1.15)"

  const P          = Math.min(1, Math.abs(swipeX) / 120)
  const iconScale  = 0.65 + P * 0.35
  const iconTx     = swipeX * 0.22

  const wrapperStyle: React.CSSProperties = isCollapsing
    ? { height: 0, opacity: 0, marginTop: 0, marginBottom: 0, overflow: "hidden",
        transition: "height 0.35s ease, margin 0.35s ease, opacity 0.35s ease", isolation: "isolate" }
    : collapseHeight !== undefined
    ? { height: collapseHeight, transition: "height 0.35s ease, margin 0.35s ease, opacity 0.35s ease", isolation: "isolate" }
    : { isolation: "isolate" }

  return (
    <div
      ref={elementRef}
      style={wrapperStyle}
      className={cn("relative select-none", isCompleted && "animate-completed-slide-down")}
    >
      {/* BACKGROUND REVEAL — sits beneath moving card, clipped to card shape */}
      <div
        className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none"
        style={{ zIndex: 10 }}
        aria-hidden
      >
        {/* Right swipe: blue IN_PROGRESS */}
        <div
          className="absolute inset-0 bg-blue-500"
          style={{ opacity: swipeX > 0 ? P * 0.95 : 0 }}
        />
        {/* Left swipe: emerald COMPLETE */}
        <div
          className="absolute inset-0 bg-emerald-500"
          style={{ opacity: swipeX < 0 ? P * 0.95 : 0 }}
        />
        {/* Right icon */}
        {swipeX > 0 && (
          <div
            className="absolute inset-y-0 left-0 flex items-center pl-5 text-white gap-1.5"
            style={{ opacity: P, transform: `scale(${iconScale}) translateX(${iconTx}px)` }}
          >
            <Play className="size-5 shrink-0" />
            <span className="text-sm font-bold">Start</span>
          </div>
        )}
        {/* Left icon */}
        {swipeX < 0 && (
          <div
            className="absolute inset-y-0 right-0 flex items-center pr-5 text-white gap-1.5"
            style={{ opacity: P, transform: `scale(${iconScale}) translateX(${iconTx}px)` }}
          >
            <span className="text-sm font-bold">Done</span>
            <Check className="size-5 shrink-0" />
          </div>
        )}
      </div>

      {/* FOREGROUND CARD — moves with swipe, sits above background */}
      <div
        ref={cardRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={handleClick}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition,
          touchAction: "pan-y",
          willChange: "transform",
          position: "relative",
          zIndex: 20,
        }}
        className={cn(
          "group rounded-xl border border-border border-l-2 bg-card",
          isPressing && "animate-long-press-ring",
          selected
            ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-md ring-2 ring-primary/20"
            : !isCompleted ? statusCfg.border : "border-l-transparent opacity-55",
          (menuOpen || statusOpen)
            ? "shadow-md border-border/80"
            : "hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/25",
          selectionMode && "cursor-pointer",
          "animate-fade-up",
        )}
      >
        {/* IN_PROGRESS bottom loader */}
        {task.status === "IN_PROGRESS" && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden rounded-b-xl pointer-events-none" style={{ zIndex: 21 }}>
            <div className="h-full w-1/2 bg-gradient-to-r from-blue-500 via-blue-300 to-blue-500 animate-loading-slide" />
          </div>
        )}

        <div className="flex items-center gap-3 px-4 py-3">
          {/* Col 1: checkbox */}
          <div className="flex items-center justify-center shrink-0">
            {selectionMode ? (
              <div className={cn(
                "flex size-5 items-center justify-center rounded-lg border-2 transition-all duration-150",
                selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/45 hover:border-primary"
              )}>
                {selected && (
                  <svg viewBox="0 0 10 8" fill="none" className="size-2.5">
                    <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            ) : (
              <button
                onClick={() => onToggleComplete(task)}
                title={isCompleted ? "Mark as pending" : "Mark as complete"}
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border-2",
                  "transition-all duration-200 active:scale-90 hover:scale-110",
                  isCompleted
                    ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                    : "border-border hover:border-primary hover:bg-accent hover:shadow-sm hover:shadow-primary/15"
                )}
              >
                {isCompleted && (
                  <svg viewBox="0 0 10 8" fill="none" className="size-3">
                    <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            )}
          </div>

          {/* Col 2: content */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className={cn(
                "min-w-0 truncate text-sm font-medium leading-snug",
                isCompleted && "line-through text-muted-foreground"
              )}>
                {task.title}
              </span>
              {priorityCfg && (
                <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", priorityCfg.badge)}>
                  <span className={cn("size-1.5 rounded-full shrink-0", priorityCfg.dot)} />
                  {priorityCfg.label}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                ref={statusBtnRef}
                onClick={openStatusDropdown}
                title="Change status"
                className={cn(
                  "inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[10px] font-semibold",
                  "select-none transition-all duration-150 hover:opacity-75 active:scale-95",
                  statusCfg.badge
                )}
              >
                <span className="relative flex size-1.5 shrink-0">
                  {task.status === "IN_PROGRESS" && <span className={cn("animate-ping absolute inset-0 rounded-full opacity-60", statusCfg.dot)} />}
                  {task.status === "PENDING"     && <span className={cn("animate-pulse absolute inset-0 rounded-full opacity-75", statusCfg.dot)} />}
                  <span className={cn("relative inline-flex size-1.5 rounded-full", statusCfg.dot)} />
                </span>
                {statusCfg.label}
                <ChevronDown className="size-2.5 opacity-60" />
              </button>

              {task.due_date ? (
                <span className={cn("inline-flex items-center gap-1 text-[11px]", isOverdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                  <CalendarDays className="size-3 shrink-0" />
                  {formatDueDate(task.due_date)}
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground/40">No due date</span>
              )}
            </div>
          </div>

          {/* Col 3: actions */}
          <div className="flex shrink-0 items-center gap-1">
            {task.description && (
              <button
                onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
                className={cn(
                  "flex size-7 items-center justify-center rounded-lg text-muted-foreground",
                  "opacity-0 group-hover:opacity-100",
                  "hover:bg-muted hover:text-foreground active:scale-90 transition-all duration-150"
                )}
              >
                <ChevronDown className={cn("size-3.5 transition-transform duration-200", expanded && "rotate-180")} />
              </button>
            )}
            <button
              ref={moreBtnRef}
              onClick={openMenuDropdown}
              title="More options"
              className={cn(
                "flex size-7 items-center justify-center rounded-lg",
                "opacity-0 group-hover:opacity-100",
                "text-muted-foreground hover:bg-muted hover:text-foreground",
                "active:scale-90 transition-all duration-150",
                menuOpen && "!opacity-100 bg-muted text-foreground"
              )}
            >
              <svg viewBox="0 0 16 4" fill="currentColor" className="w-3.5">
                <circle cx="2"  cy="2" r="1.5" />
                <circle cx="8"  cy="2" r="1.5" />
                <circle cx="14" cy="2" r="1.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Expandable notes */}
      {expanded && task.description && (
        <div className="px-12 pb-3.5 animate-fade-up">
          <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground leading-relaxed">
            {task.description}
          </p>
        </div>
      )}

      {/* PORTALIZED STATUS DROPDOWN */}
      {statusOpen && typeof document !== "undefined" && createPortal(
        <div
          ref={statusRef}
          style={{ position: "fixed", top: dropdownCoords.top, left: dropdownCoords.left, width: "168px", zIndex: 99999 }}
          className="rounded-xl border border-border bg-popover py-1 shadow-xl animate-scale-in"
        >
          <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Set status</p>
          {STATUS_OPTIONS.map(opt => {
            const oCfg = STATUS_CONFIG[opt.value]
            const isActive = task.status === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => {
                  setStatusOpen(false)
                  if (opt.value === "COMPLETED") triggerCollapse()
                  else onStatusChange(task, opt.value)
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors text-left",
                  isActive ? "bg-accent text-foreground" : "text-foreground/80 hover:bg-muted"
                )}
              >
                <span className="relative flex size-2 shrink-0">
                  {opt.value === "IN_PROGRESS" && <span className={cn("animate-ping absolute inset-0 rounded-full opacity-60", oCfg.dot)} />}
                  <span className={cn("relative inline-flex size-2 rounded-full", oCfg.dot)} />
                </span>
                {oCfg.label}
                {isActive && (
                  <svg className="ml-auto size-3 text-primary" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>,
        document.body
      )}

      {/* PORTALIZED MORE ACTIONS MENU */}
      {menuOpen && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: dropdownCoords.top, left: dropdownCoords.left, width: "148px", zIndex: 99999 }}
          className="rounded-xl border border-border bg-popover py-1 shadow-xl animate-scale-in"
        >
          <button
            onClick={() => { onEdit(task); setMenuOpen(false) }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground/80 hover:bg-muted hover:text-foreground transition-colors text-left"
          >
            <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
            Edit task
          </button>
          <div className="mx-3 my-1 h-px bg-border" />
          <button
            onClick={() => { onDelete(task); setMenuOpen(false) }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
          >
            <Trash2 className="size-3.5 shrink-0" />
            Delete
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}
