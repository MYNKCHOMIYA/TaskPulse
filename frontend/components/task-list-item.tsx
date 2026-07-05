"use client"

import * as React from "react"
import {
  CalendarDays,
  ChevronDown,
  Pencil,
  Trash2,
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
}: TaskListItemProps) {
  const [expanded, setExpanded] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [statusOpen, setStatusOpen] = React.useState(false)

  const menuRef = React.useRef<HTMLDivElement>(null)
  const moreBtnRef = React.useRef<HTMLButtonElement>(null)
  const statusRef = React.useRef<HTMLDivElement>(null)
  const statusBtnRef = React.useRef<HTMLButtonElement>(null)

  const isCompleted  = task.status === "COMPLETED"
  const priorityCfg  = task.priority ? PRIORITY_CONFIG[task.priority] : null
  const statusCfg    = STATUS_CONFIG[task.status]
  const isOverdue    = !isCompleted && task.due_date
    ? new Date(task.due_date) < new Date()
    : false

  // Click outside listener for action menu
  React.useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        moreBtnRef.current && !moreBtnRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [menuOpen])

  // Click outside listener for status menu
  React.useEffect(() => {
    if (!statusOpen) return
    const handler = (e: MouseEvent) => {
      if (
        statusRef.current && !statusRef.current.contains(e.target as Node) &&
        statusBtnRef.current && !statusBtnRef.current.contains(e.target as Node)
      ) {
        setStatusOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [statusOpen])

  return (
    <div
      className={cn(
        "group relative rounded-xl border border-border border-l-2 bg-card transition-all duration-200",
        isCompleted ? "border-l-transparent opacity-55" : statusCfg.border,
        (menuOpen || statusOpen) ? "z-30 shadow-md border-border/80" : "z-10 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/25",
        "animate-fade-up"
      )}
    >
      {/* Rigid row grid container */}
      <div className="flex items-center gap-3 px-4 py-3">

        {/* Col 1: Checkbox */}
        <div className="flex items-center justify-center shrink-0">
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
                onClick={e => { e.stopPropagation(); setStatusOpen(v => !v) }}
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

              {statusOpen && (
                <div
                  ref={statusRef}
                  className="absolute left-0 top-full mt-1.5 z-50 w-40 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-xl animate-scale-in"
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
                        onClick={() => { onStatusChange(task, opt.value); setStatusOpen(false) }}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors",
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
                </div>
              )}
            </div>

            {/* Due Date Indicator */}
            {task.due_date ? (
              <span className={cn(
                "inline-flex items-center gap-1 text-[11px]",
                isOverdue ? "font-medium text-destructive" : "text-muted-foreground"
              )}>
                <CalendarDays className="size-3 shrink-0" />
                {isOverdue ? "Overdue · " : ""}
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
              onClick={() => setExpanded(v => !v)}
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
              onClick={() => setMenuOpen(v => !v)}
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

            {menuOpen && (
              <div
                ref={menuRef}
                className="absolute right-0 top-full mt-1.5 z-50 w-36 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-xl animate-scale-in"
              >
                <button
                  onClick={() => { onEdit(task); setMenuOpen(false) }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
                  Edit task
                </button>
                <div className="mx-3 my-1 h-px bg-border" />
                <button
                  onClick={() => { onDelete(task); setMenuOpen(false) }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="size-3.5 shrink-0" />
                  Delete
                </button>
              </div>
            )}
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
    </div>
  )
}
