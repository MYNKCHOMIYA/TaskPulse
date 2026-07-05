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
  
  // Selection mode props
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: (task: Task) => void
  onStartSelection?: (task: Task) => void
}

const PRIORITY_CONFIG: Record<
  Exclude<TaskPriority, null>,
  { dot: string; badge: string; label: string }
> = {
  URGENT: {
    dot:   "bg-rose-500",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
    label: "Urgent",
  },
  HIGH: {
    dot:   "bg-orange-400",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
    label: "High",
  },
  MEDIUM: {
    dot:   "bg-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    label: "Medium",
  },
  LOW: {
    dot:   "bg-sky-400",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    label: "Low",
  },
}

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; badge: string; dot: string; border: string }
> = {
  IN_PROGRESS: {
    label:  "In Progress",
    badge:  "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    dot:    "bg-blue-500",
    border: "border-l-blue-400 dark:border-l-blue-500",
  },
  PENDING: {
    label:  "Pending",
    badge:  "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    dot:    "bg-amber-400",
    border: "border-l-amber-400 dark:border-l-amber-500",
  },
  COMPLETED: {
    label:  "Completed",
    badge:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    dot:    "bg-emerald-400",
    border: "border-l-transparent",
  },
}

export function TaskListItem({
  task,
  onEdit,
  onDelete,
  onToggleComplete,
  onStatusChange,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  onStartSelection,
}: TaskListItemProps) {
  const [expanded, setExpanded] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [statusOpen, setStatusOpen] = React.useState(false)

  const menuRef = React.useRef<HTMLDivElement>(null)
  const moreBtnRef = React.useRef<HTMLButtonElement>(null)
  const statusRef = React.useRef<HTMLDivElement>(null)
  const statusBtnRef = React.useRef<HTMLButtonElement>(null)
  const elementRef = React.useRef<HTMLDivElement>(null)

  // ── Swipe Gesture States ─────────────────────────────────
  const touchStartX = React.useRef(0)
  const touchStartY = React.useRef(0)
  const [swipeX, setSwipeX] = React.useState(0)
  const [swiping, setSwiping] = React.useState(false)
  const [slideOut, setSlideOut] = React.useState<"left" | "right" | null>(null)
  const [isCollapsing, setIsCollapsing] = React.useState(false)
  const [collapseHeight, setCollapseHeight] = React.useState<number | undefined>(undefined)

  // Visual long-press ring animation state (does NOT block swipe)
  const [isPressing, setIsPressing] = React.useState(false)

  const isSwipeActive = React.useRef(false)
  const cardRef = React.useRef<HTMLDivElement>(null)

  // ── Scroll axis interception refs ──
  const isScrollGesture = React.useRef(false)
  const isGestureEvaluated = React.useRef(false)

  // ── Long-press: fully decoupled from pointer gesture pipeline ──
  const longHoldTimer = React.useRef<NodeJS.Timeout | null>(null)
  const longPressDidFire = React.useRef(false)

  // Coords for portalized dropdown menus
  const [dropdownCoords, setDropdownCoords] = React.useState<{
    top: number
    left: number
    width: number
    type: "status" | "menu" | null
  }>({ top: 0, left: 0, width: 0, type: null })

  // Slide-out and height collapse sequence for completed tasks
  const triggerCompletedCollapseSequence = React.useCallback(() => {
    setSlideOut("left")
    setSwipeX(-window.innerWidth * 0.5)

    if (elementRef.current) {
      setCollapseHeight(elementRef.current.offsetHeight)
    }
    // Force a micro-tick before starting CSS height transition
    setTimeout(() => {
      setIsCollapsing(true)
    }, 10)

    setTimeout(() => {
      onStatusChange(task, "COMPLETED")
      // Reset animations after unmount/re-render
      setSwipeX(0)
      setSlideOut(null)
      setIsCollapsing(false)
      setCollapseHeight(undefined)
    }, 360)
  }, [task, onStatusChange])

  // Coordinate-based Portal triggers
  const handleToggleStatusDropdown = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (dropdownCoords.type === "status") {
      setDropdownCoords({ top: 0, left: 0, width: 0, type: null })
      setStatusOpen(false)
    } else {
      const rect = statusBtnRef.current?.getBoundingClientRect()
      if (rect) {
        setDropdownCoords({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          type: "status",
        })
        setStatusOpen(true)
        setMenuOpen(false)
      }
    }
  }

  const handleToggleMenuDropdown = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (dropdownCoords.type === "menu") {
      setDropdownCoords({ top: 0, left: 0, width: 0, type: null })
      setMenuOpen(false)
    } else {
      const rect = moreBtnRef.current?.getBoundingClientRect()
      if (rect) {
        setDropdownCoords({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX - 110, // offset left
          width: rect.width,
          type: "menu",
        })
        setMenuOpen(true)
        setStatusOpen(false)
      }
    }
  }

  const handleStart = (clientX: number, clientY: number) => {
    if (menuOpen || statusOpen) return
    touchStartX.current = clientX
    touchStartY.current = clientY
    isSwipeActive.current = false
    setSwiping(false)
    setSlideOut(null)
    isScrollGesture.current = false
    isGestureEvaluated.current = false
    longPressDidFire.current = false

    // Long-press is entirely decoupled: it does NOT block or delay swipe tracking
    if (onStartSelection && !selectionMode) {
      // Start press visual animation immediately (pure cosmetic, no delay)
      setIsPressing(true)
      longHoldTimer.current = setTimeout(() => {
        if (longPressDidFire.current) return
        longPressDidFire.current = true
        setIsPressing(false)
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(40)
        }
        onStartSelection(task)
      }, 550)
    }
  }

  const handleMove = (clientX: number, clientY: number) => {
    const dx = clientX - touchStartX.current
    const dy = clientY - touchStartY.current

    // If already determined this is a scroll gesture, bail instantly
    if (isScrollGesture.current) return

    // Scroll axis interception: evaluate motion vector inside the first 6px of travel
    if (!isGestureEvaluated.current) {
      const distance = Math.hypot(dx, dy)
      if (distance >= 6) {
        isGestureEvaluated.current = true
        if (Math.abs(dy) > Math.abs(dx)) {
          // Vertical dominates — hand off to native scroll, cancel long-press
          isScrollGesture.current = true
          setIsPressing(false)
          if (longHoldTimer.current) {
            clearTimeout(longHoldTimer.current)
            longHoldTimer.current = null
          }
          return
        } else {
          // Horizontal dominates — lock onto swipe lane, cancel long-press visual + timer
          isSwipeActive.current = true
          setSwiping(true)
          setIsPressing(false)
          if (longHoldTimer.current) {
            clearTimeout(longHoldTimer.current)
            longHoldTimer.current = null
          }
        }
      } else {
        // Still inside the interception buffer, wait for more data
        return
      }
    }

    if (isSwipeActive.current) {
      // Tiered logarithmic spring tension engine
      const absX = Math.abs(dx)
      const sign = Math.sign(dx)
      let tx = 0

      if (absX <= 60) {
        tx = dx * 0.85
      } else if (absX <= 120) {
        tx = sign * 51 + (dx - sign * 60) * 0.45
      } else {
        tx = sign * 78 + (dx - sign * 120) * 0.15
      }

      // Hard clamp: no more than 45% of the viewport width
      const maxLimit = window.innerWidth * 0.45
      if (Math.abs(tx) > maxLimit) {
        tx = Math.sign(tx) * maxLimit
      }

      setSwipeX(tx)
    }
  }

  const handleEnd = () => {
    // Always cancel the long-press timer on finger-up
    if (longHoldTimer.current) {
      clearTimeout(longHoldTimer.current)
      longHoldTimer.current = null
    }
    setIsPressing(false)

    if (swiping) {
      setSwiping(false)
      isSwipeActive.current = false

      if (swipeX >= 72) {
        // Right swipe confirmed → snap back to 0 and mark IN_PROGRESS
        setSwipeX(0)
        onStatusChange(task, "IN_PROGRESS")
      } else if (swipeX <= -72) {
        // Left swipe confirmed → slide off + height collapse
        triggerCompletedCollapseSequence()
      } else {
        // Under threshold — elastic recoil to origin
        setSwipeX(0)
      }
    } else {
      setSwipeX(0)
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    if (
      moreBtnRef.current?.contains(e.target as Node) ||
      statusBtnRef.current?.contains(e.target as Node) ||
      menuRef.current?.contains(e.target as Node) ||
      statusRef.current?.contains(e.target as Node)
    ) {
      return
    }
    if (selectionMode && onToggleSelect) {
      onToggleSelect(task)
    }
  }

  const isCompleted  = task.status === "COMPLETED"
  const priorityCfg  = task.priority ? PRIORITY_CONFIG[task.priority] : null
  const statusCfg    = STATUS_CONFIG[task.status]
  const isOverdue    = !isCompleted && task.due_date
    ? new Date(task.due_date) < new Date()
    : false

  // Click outside and scroll/resize listeners
  React.useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        moreBtnRef.current && !moreBtnRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false)
        setDropdownCoords(prev => prev.type === "menu" ? { top: 0, left: 0, width: 0, type: null } : prev)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [menuOpen])

  React.useEffect(() => {
    if (!statusOpen) return
    const handler = (e: MouseEvent) => {
      if (
        statusRef.current && !statusRef.current.contains(e.target as Node) &&
        statusBtnRef.current && !statusBtnRef.current.contains(e.target as Node)
      ) {
        setStatusOpen(false)
        setDropdownCoords(prev => prev.type === "status" ? { top: 0, left: 0, width: 0, type: null } : prev)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [statusOpen])

  React.useEffect(() => {
    if (statusOpen || menuOpen) {
      const close = () => {
        setStatusOpen(false)
        setMenuOpen(false)
        setDropdownCoords({ top: 0, left: 0, width: 0, type: null })
      }
      window.addEventListener("scroll", close, { passive: true })
      window.addEventListener("resize", close, { passive: true })
      return () => {
        window.removeEventListener("scroll", close)
        window.removeEventListener("resize", close)
      }
    }
  }, [statusOpen, menuOpen])

  // ── Native non-passive touchmove listener ─────────────────────────
  // React synthetic onTouchMove is always passive (cannot call preventDefault).
  // We need a non-passive native listener so we can cancel vertical scrolling
  // once we've confirmed a horizontal swipe on Samsung/Android devices.
  React.useEffect(() => {
    const el = cardRef.current
    if (!el) return

    const onNativeTouchMove = (e: TouchEvent) => {
      if (isSwipeActive.current) {
        // We have a confirmed horizontal swipe — block native page scroll
        e.preventDefault()
        handleMove(e.touches[0].clientX, e.touches[0].clientY)
      } else if (!isScrollGesture.current) {
        // Still in the axis evaluation phase — call handleMove to evaluate axis
        handleMove(e.touches[0].clientX, e.touches[0].clientY)
      }
    }

    el.addEventListener("touchmove", onNativeTouchMove, { passive: false })
    return () => el.removeEventListener("touchmove", onNativeTouchMove)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen, statusOpen, swiping])

  // Physics transition curve
  const getTransitionString = () => {
    if (swiping) return "none"
    if (slideOut) return "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)"
    // Elastic recoil matching spec: cubic-bezier(0.175, 0.885, 0.32, 1.15)
    return "transform 400ms cubic-bezier(0.175, 0.885, 0.32, 1.15)"
  }

  // Reveal stack unravel calculations — spec: bgScale 0.65+P*0.35, parallax Tx*0.22
  const progressRatio = Math.min(1, Math.abs(swipeX) / 120)
  const bgScale = 0.65 + progressRatio * 0.35
  const parallaxX = swipeX * 0.22

  return (
    <div
      ref={elementRef}
      style={
        isCollapsing
          ? {
              height: 0,
              opacity: 0,
              marginTop: 0,
              marginBottom: 0,
              paddingTop: 0,
              paddingBottom: 0,
              overflow: "hidden",
              willChange: "transform, opacity, height",
              transition: "height 0.35s ease, margin 0.35s ease, opacity 0.35s ease",
              isolation: "isolate",
            }
          : collapseHeight !== undefined
          ? {
              height: collapseHeight,
              willChange: "transform, opacity, height",
              transition: "height 0.35s ease, margin 0.35s ease, opacity 0.35s ease",
              isolation: "isolate",
            }
          : {
              isolation: "isolate",
            }
      }
      className={cn(
        "relative select-none",
        isCompleted && "animate-completed-slide-down"
      )}
    >
      {/* Fixed Swipe Backgrounds Wrapper */}
      <div className="absolute inset-0 z-10 overflow-hidden rounded-xl pointer-events-none">
        {/* Play (Start) background panel (Swipe Right) */}
        {swipeX > 0 && (
          <div
            style={{ opacity: progressRatio * 0.95 }}
            className="absolute inset-0 bg-blue-500 transition-opacity duration-150"
          />
        )}
        {/* Check (Complete) background panel (Swipe Left) */}
        {swipeX < 0 && (
          <div
            style={{ opacity: progressRatio * 0.95 }}
            className="absolute inset-0 bg-emerald-500 transition-opacity duration-150"
          />
        )}

        {/* Action icons with parallax scale/translate */}
        {swipeX > 0 && (
          <div
            style={{
              opacity: progressRatio,
              transform: `scale(${bgScale}) translateX(${parallaxX}px)`,
            }}
            className="absolute inset-y-0 left-0 flex items-center pl-6 text-white"
          >
            <Play className="size-4 shrink-0 mr-2" />
            <span className="text-xs font-bold">Start</span>
          </div>
        )}

        {swipeX < 0 && (
          <div
            style={{
              opacity: progressRatio,
              transform: `scale(${bgScale}) translateX(${parallaxX}px)`,
            }}
            className="absolute inset-y-0 right-0 flex items-center pr-6 text-white"
          >
            <span className="text-xs font-bold mr-2">Complete</span>
            <Check className="size-4 shrink-0" />
          </div>
        )}
      </div>

      {/* Main card content container — cardRef used for native non-passive touchmove */}
      <div
        ref={cardRef}
        onTouchStart={e => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={handleEnd}
        onMouseDown={e => handleStart(e.clientX, e.clientY)}
        onMouseMove={e => swiping && handleMove(e.clientX, e.clientY)}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onClick={handleClick}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: getTransitionString(),
          // During active swipe: none (prevents scroll fighting); at rest: pan-y allows vertical scroll
          touchAction: swiping ? "none" : "pan-y",
          willChange: "transform",
        }}
        className={cn(
          "group relative rounded-xl border border-border border-l-2 bg-card z-20",
          // Long-press ring animation — pure visual, cleared on swipe initiation
          isPressing && "animate-long-press-ring",
          selected ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-md ring-2 ring-primary/20" : "",
          !selected && (isCompleted ? "border-l-transparent opacity-55" : statusCfg.border),
          (menuOpen || statusOpen) ? "z-30 shadow-md border-border/80" : "hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/25",
          selectionMode && "cursor-pointer select-none",
          "animate-fade-up"
        )}
      >
        {/* Continuous gradient loading track riding along the exact bottom edge boundary */}
        {task.status === "IN_PROGRESS" && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden rounded-b-xl pointer-events-none z-20">
            <div className="h-full w-1/2 bg-gradient-to-r from-blue-500 via-blue-300 to-blue-500 animate-loading-slide" />
          </div>
        )}

        {/* Rigid row grid container */}
        <div className="flex items-center gap-3 px-4 py-3">

          {/* Col 1: Checkbox */}
          <div className="flex items-center justify-center shrink-0">
            {selectionMode ? (
              <div
                className={cn(
                  "flex size-5 items-center justify-center rounded-lg border-2 transition-all duration-150",
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                    : "border-muted-foreground/45 hover:border-primary"
                )}
              >
                {selected && (
                  <svg viewBox="0 0 10 8" fill="none" className="size-2.5">
                    <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" />
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
                    <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            )}
          </div>

          {/* Col 2: Content Details */}
          <div className="flex-1 min-w-0 space-y-1">
            {/* Row A: Title & Priority */}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "min-w-0 truncate text-sm font-medium leading-snug",
                  isCompleted && "line-through text-muted-foreground"
                )}
              >
                {task.title}
              </span>

              {priorityCfg && (
                <span className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  priorityCfg.badge
                )}>
                  <span className={cn("size-1.5 rounded-full shrink-0", priorityCfg.dot)} />
                  {priorityCfg.label}
                </span>
              )}
            </div>

            {/* Row B: Status Dropdown & Due Date */}
            <div className="flex items-center gap-3">
              {/* Localized absolute status selector */}
              <div className="relative inline-flex">
                <button
                  ref={statusBtnRef}
                  onClick={handleToggleStatusDropdown}
                  title="Change status"
                  className={cn(
                    "inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[10px] font-semibold",
                    "select-none transition-all duration-150 hover:opacity-75 active:scale-95",
                    statusCfg.badge
                  )}
                >
                  <span className="relative flex size-1.5 shrink-0">
                    {task.status === "IN_PROGRESS" && (
                      <span className={cn("animate-ping absolute inset-0 rounded-full opacity-60", statusCfg.dot)} />
                    )}
                    {task.status === "PENDING" && (
                      <span className={cn("animate-pulse absolute inset-0 rounded-full opacity-75", statusCfg.dot)} />
                    )}
                    <span className={cn("relative inline-flex size-1.5 rounded-full", statusCfg.dot)} />
                  </span>
                  {statusCfg.label}
                  <ChevronDown className="size-2.5 opacity-60" />
                </button>
              </div>

              {/* Due Date Indicator */}
              {task.due_date ? (
                <span className={cn(
                  "inline-flex items-center gap-1 text-[11px]",
                  isOverdue ? "font-medium text-destructive" : "text-muted-foreground"
                )}>
                  <CalendarDays className="size-3 shrink-0" />
                  {formatDueDate(task.due_date)}
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground/40">No due date</span>
              )}
            </div>
          </div>

          {/* Col 3: Row Actions (Expand details & Dropdown menu) */}
          <div className="flex shrink-0 items-center gap-1">
            {task.description && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(v => !v) }}
                title={expanded ? "Hide notes" : "Show notes"}
                className={cn(
                  "flex size-7 items-center justify-center rounded-lg text-muted-foreground",
                  "opacity-0 group-hover:opacity-100",
                  "hover:bg-muted hover:text-foreground active:scale-90 transition-all duration-150"
                )}
              >
                <ChevronDown
                  className={cn(
                    "size-3.5 transition-transform duration-200",
                    expanded && "rotate-180"
                  )}
                />
              </button>
            )}

            <div className="relative inline-flex">
              <button
                ref={moreBtnRef}
                onClick={handleToggleMenuDropdown}
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
      </div>

      {/* Expandable Notes */}
      {expanded && task.description && (
        <div className="px-12 pb-3.5 animate-fade-up">
          <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground leading-relaxed">
            {task.description}
          </p>
        </div>
      )}

      {/* ── PORTALIZED STATUS DROPDOWN ────────────────────── */}
      {statusOpen && dropdownCoords.type === "status" && typeof document !== "undefined" && createPortal(
        <div
          ref={statusRef}
          style={{
            position: "absolute",
            top: dropdownCoords.top,
            left: dropdownCoords.left,
            width: "160px",
            zIndex: 99999,
          }}
          className="rounded-xl border border-border bg-popover py-1 shadow-xl animate-scale-in"
        >
          <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Set status
          </p>
          {STATUS_OPTIONS.map(opt => {
            const oCfg = STATUS_CONFIG[opt.value]
            const isActive = task.status === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => {
                  if (opt.value === "COMPLETED") {
                    setStatusOpen(false)
                    setDropdownCoords({ top: 0, left: 0, width: 0, type: null })
                    triggerCompletedCollapseSequence()
                  } else {
                    onStatusChange(task, opt.value)
                    setStatusOpen(false)
                    setDropdownCoords({ top: 0, left: 0, width: 0, type: null })
                  }
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors text-left",
                  isActive
                    ? "bg-accent text-foreground"
                    : "text-foreground/80 hover:bg-muted"
                )}
              >
                <span className="relative flex size-2 shrink-0">
                  {opt.value === "IN_PROGRESS" && (
                    <span className={cn("animate-ping absolute inset-0 rounded-full opacity-60", oCfg.dot)} />
                  )}
                  <span className={cn("relative inline-flex size-2 rounded-full", oCfg.dot)} />
                </span>
                {oCfg.label}
                {isActive && (
                  <svg className="ml-auto size-3 text-primary" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>,
        document.body
      )}

      {/* ── PORTALIZED MORE ACTIONS MENU ───────────────────── */}
      {menuOpen && dropdownCoords.type === "menu" && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "absolute",
            top: dropdownCoords.top,
            left: dropdownCoords.left,
            width: "144px",
            zIndex: 99999,
          }}
          className="rounded-xl border border-border bg-popover py-1 shadow-xl animate-scale-in"
        >
          <button
            onClick={() => {
              onEdit(task)
              setMenuOpen(false)
              setDropdownCoords({ top: 0, left: 0, width: 0, type: null })
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground/80 hover:bg-muted hover:text-foreground transition-colors text-left"
          >
            <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
            Edit task
          </button>
          <div className="mx-3 my-1 h-px bg-border" />
          <button
            onClick={() => {
              onDelete(task)
              setMenuOpen(false)
              setDropdownCoords({ top: 0, left: 0, width: 0, type: null })
            }}
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
