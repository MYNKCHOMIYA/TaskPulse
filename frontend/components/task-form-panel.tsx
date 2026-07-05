"use client"

import * as React from "react"
import {
  CalendarDays,
  ChevronDown,
  Loader2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DESCRIPTION_MAX,
  formatDueDate,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  TITLE_MAX,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks"

export interface TaskFormValues {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
}

interface TaskFormPanelProps {
  open: boolean
  task: Task | null
  onClose: () => void
  onSave: (values: TaskFormValues) => Promise<void>
}

const EMPTY: TaskFormValues = {
  title: "",
  description: "",
  status: "PENDING",
  priority: null,
  due_date: null,
}

export function TaskFormPanel({ open, task, onClose, onSave }: TaskFormPanelProps) {
  const [values, setValues]   = React.useState<TaskFormValues>(EMPTY)
  const [titleErr, setTitleErr] = React.useState(false)
  const [loading, setLoading]  = React.useState(false)
  const titleRef = React.useRef<HTMLInputElement>(null)
  const isEditing = task !== null

  React.useEffect(() => {
    if (open) {
      setValues(
        task
          ? {
              title:       task.title,
              description: task.description ?? "",
              status:      task.status,
              priority:    task.priority,
              due_date:    task.due_date,
            }
          : EMPTY
      )
      setTitleErr(false)
      // Focus title after animation
      setTimeout(() => titleRef.current?.focus(), 80)
    }
  }, [open, task])

  // Prevent body scroll when panel open on mobile
  React.useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    else      document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.title.trim()) {
      setTitleErr(true)
      titleRef.current?.focus()
      return
    }
    setLoading(true)
    try {
      await onSave({ ...values, title: values.title.trim() })
      onClose()
    } catch (err: any) {
      // errors handled by parent via alert for now
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop (mobile) */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col bg-card border-l border-border shadow-2xl",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between px-5 border-b border-border shrink-0">
          <h2 className="font-semibold text-sm">
            {isEditing ? "Edit Task" : "New Task"}
          </h2>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto scrollbar-thin">
          <div className="flex-1 space-y-5 p-5">
            {/* Title */}
            <div className="space-y-1.5">
              <label htmlFor="tf-title" className="text-sm font-medium">
                Title <span className="text-destructive">*</span>
              </label>
              <input
                id="tf-title"
                ref={titleRef}
                type="text"
                placeholder="What needs to be done?"
                value={values.title}
                maxLength={TITLE_MAX}
                onChange={e => {
                  setValues(v => ({ ...v, title: e.target.value }))
                  if (titleErr) setTitleErr(false)
                }}
                disabled={loading}
                className={cn(
                  "tf-input",
                  titleErr && "border-destructive focus:border-destructive focus:shadow-destructive/20"
                )}
              />
              <p className={cn("text-xs", titleErr ? "text-destructive" : "text-muted-foreground")}>
                {titleErr ? "Title is required." : `${values.title.length}/${TITLE_MAX}`}
              </p>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label htmlFor="tf-desc" className="text-sm font-medium">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                id="tf-desc"
                placeholder="Add details or notes…"
                value={values.description}
                maxLength={DESCRIPTION_MAX}
                rows={4}
                onChange={e => setValues(v => ({ ...v, description: e.target.value }))}
                disabled={loading}
                className="tf-input resize-none"
              />
              <p className="text-xs text-muted-foreground">{values.description.length}/{DESCRIPTION_MAX}</p>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label htmlFor="tf-status" className="text-sm font-medium">Status</label>
              <SelectField
                id="tf-status"
                value={values.status}
                onChange={v => setValues(prev => ({ ...prev, status: v as TaskStatus }))}
                options={STATUS_OPTIONS}
                disabled={loading}
              />
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label htmlFor="tf-priority" className="text-sm font-medium">Priority</label>
              <SelectField
                id="tf-priority"
                value={values.priority ?? "NONE"}
                onChange={v => setValues(prev => ({ ...prev, priority: v === "NONE" ? null : v as TaskPriority }))}
                options={PRIORITY_OPTIONS as any}
                disabled={loading}
              />
            </div>

            {/* Due date */}
            <div className="space-y-1.5">
              <label htmlFor="tf-due" className="text-sm font-medium">Due Date</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <CalendarDays className="size-4" />
                </span>
                <input
                  id="tf-due"
                  type="date"
                  value={values.due_date ? values.due_date.split("T")[0] : ""}
                  onChange={e => setValues(v => ({
                    ...v,
                    due_date: e.target.value ? new Date(e.target.value).toISOString() : null,
                  }))}
                  disabled={loading}
                  className="tf-input pl-9"
                />
              </div>
              {values.due_date && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{formatDueDate(values.due_date)}</p>
                  <button
                    type="button"
                    onClick={() => setValues(v => ({ ...v, due_date: null }))}
                    className="text-xs text-destructive hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border p-4 flex gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 h-9 rounded-lg border border-border text-sm hover:bg-muted hover:border-border/80 active:scale-[0.97] transition-all duration-150 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="tf-ripple-btn flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:brightness-110 hover:shadow-md hover:shadow-primary/30 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:active:scale-100"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Saving…" : isEditing ? "Save Changes" : "Create Task"}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        /* ── Form inputs ── */
        .tf-input {
          display: block;
          width: 100%;
          min-height: 2.5rem;
          padding-top: 0.5rem;
          padding-bottom: 0.5rem;
          padding-left: 0.75rem;
          padding-right: 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid var(--border);
          background: var(--background);
          color: var(--foreground);
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
        }
        .tf-input::placeholder { color: var(--muted-foreground); }
        .tf-input:hover:not(:disabled) {
          border-color: oklch(from var(--primary) l c h / 0.5);
        }
        .tf-input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px oklch(from var(--primary) l c h / 0.15);
          background: oklch(from var(--background) calc(l + 0.01) c h);
        }
        .tf-input:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Override for left-icon inputs */
        .tf-input.pl-9  { padding-left: 2.25rem !important; }
        .tf-input.pr-10 { padding-right: 2.5rem  !important; }

        /* Select focus ring */
        .tf-input:focus-within { outline: none; }
        select.tf-input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px oklch(from var(--primary) l c h / 0.15);
        }

        /* ── Ripple on primary button ── */
        .tf-ripple-btn {
          position: relative;
          overflow: hidden;
        }
        .tf-ripple-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: oklch(1 0 0 / 0.18);
          border-radius: inherit;
          opacity: 0;
          transform: scale(0.8);
          transition: opacity 0.12s ease, transform 0.12s ease;
        }
        .tf-ripple-btn:active::after {
          opacity: 1;
          transform: scale(1);
          transition: none;
        }
      `}</style>
    </>
  )
}

function SelectField({
  id, value, onChange, options, disabled,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="tf-input appearance-none pr-8 cursor-pointer"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
    </div>
  )
}
