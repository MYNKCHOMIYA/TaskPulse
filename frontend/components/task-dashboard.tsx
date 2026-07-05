"use client"

import * as React from "react"
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import {
  PRIORITY_OPTIONS,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks"
import { TaskListItem } from "@/components/task-list-item"
import { TaskFormPanel, type TaskFormValues } from "@/components/task-form-panel"

type PriorityFilter = Exclude<TaskPriority, null> | "NONE" | "ALL"

interface TaskDashboardProps {
  statusView?: "all" | "pending" | "in_progress" | "completed"
}

const VIEW_STATUS_MAP: Record<string, TaskStatus | "ALL"> = {
  all:         "ALL",
  pending:     "PENDING",
  in_progress: "IN_PROGRESS",
  completed:   "COMPLETED",
}

const VIEW_LABELS: Record<string, string> = {
  all:         "All Tasks",
  pending:     "Pending",
  in_progress: "In Progress",
  completed:   "Completed",
}

// ── Sort weight helpers ────────────────────────────────────
const PRIORITY_WEIGHT: Record<string, number> = {
  URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3, null: 4,
}

function sortActiveTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // 1. Status: IN_PROGRESS first → PENDING second
    const statusOrder: Record<string, number> = { IN_PROGRESS: 0, PENDING: 1 }
    const sDiff = (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2)
    if (sDiff !== 0) return sDiff

    // 2. Due date: earliest first; no due date goes last
    const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity
    const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity
    if (aDate !== bDate) return aDate - bDate

    // 3. Priority weight
    return (PRIORITY_WEIGHT[a.priority ?? "null"] ?? 4) - (PRIORITY_WEIGHT[b.priority ?? "null"] ?? 4)
  })
}

function sortCompletedTasks(tasks: Task[]): Task[] {
  // Completed: sorted by due date descending (most recently due first)
  return [...tasks].sort((a, b) => {
    const aDate = a.due_date ? new Date(a.due_date).getTime() : 0
    const bDate = b.due_date ? new Date(b.due_date).getTime() : 0
    return bDate - aDate
  })
}

export function TaskDashboard({ statusView = "all" }: TaskDashboardProps) {
  const [tasks,           setTasks]          = React.useState<Task[]>([])
  const [isLoading,       setIsLoading]      = React.useState(true)
  const [searchQuery,     setSearchQuery]    = React.useState("")
  const [priorityFilter,  setPriorityFilter] = React.useState<PriorityFilter>("ALL")
  const [showFilters,     setShowFilters]    = React.useState(false)
  const [showCompleted,   setShowCompleted]  = React.useState(true)

  const [panelOpen,     setPanelOpen]     = React.useState(false)
  const [editingTask,   setEditingTask]   = React.useState<Task | null>(null)
  const [deleteTarget,  setDeleteTarget]  = React.useState<Task | null>(null)
  const [deleteLoading, setDeleteLoading] = React.useState(false)

  const statusFilter = VIEW_STATUS_MAP[statusView] ?? "ALL"

  // ── Fetch ───────────────────────────────────────────────
  const fetchTasks = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await api.tasks.getTasks({
        status: statusFilter !== "ALL" ? statusFilter : undefined,
      })
      setTasks(data)
    } catch (err) {
      console.error("Failed to load tasks:", err)
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  React.useEffect(() => { fetchTasks() }, [fetchTasks])

  // ── Filter + search (client-side) ───────────────────────
  const filteredTasks = React.useMemo(() => {
    let list = tasks

    // Priority filter
    if (priorityFilter !== "ALL") {
      list = list.filter(t =>
        priorityFilter === "NONE"
          ? t.priority === null
          : t.priority === priorityFilter
      )
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        t =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q))
      )
    }

    return list
  }, [tasks, priorityFilter, searchQuery])

  // ── Split into active / completed ───────────────────────
  const activeTasks    = React.useMemo(
    () => sortActiveTasks(filteredTasks.filter(t => t.status !== "COMPLETED")),
    [filteredTasks]
  )
  const completedTasks = React.useMemo(
    () => sortCompletedTasks(filteredTasks.filter(t => t.status === "COMPLETED")),
    [filteredTasks]
  )

  // ── CRUD handlers ────────────────────────────────────────
  function openCreate() { setEditingTask(null); setPanelOpen(true) }
  function openEdit(task: Task) { setEditingTask(task); setPanelOpen(true) }

  async function handleSave(values: TaskFormValues) {
    if (editingTask) {
      const updated = await api.tasks.updateTask(editingTask.id, values)
      setTasks(prev => prev.map(t => t.id === editingTask.id ? updated : t))
    } else {
      const created = await api.tasks.createTask(values)
      setTasks(prev => [created, ...prev])
    }
  }

  async function handleToggleComplete(task: Task) {
    const newStatus: TaskStatus = task.status === "COMPLETED" ? "PENDING" : "COMPLETED"
    
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    
    try {
      const updated = await api.tasks.updateTask(task.id, { status: newStatus })
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
    } catch (err: any) {
      // Revert on failure
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t))
      alert(err.message)
    }
  }

  async function handleStatusChange(task: Task, status: TaskStatus) {
    if (task.status === status) return
    const originalStatus = task.status
    
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status } : t))
    
    try {
      const updated = await api.tasks.updateTask(task.id, { status })
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
    } catch (err: any) {
      // Revert on failure
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: originalStatus } : t))
      alert(err.message)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteLoading(true)
    
    // Optimistic update: close modal and remove task immediately
    setDeleteTarget(null)
    setTasks(prev => prev.filter(t => t.id !== target.id))
    
    try {
      await api.tasks.deleteTask(target.id)
    } catch (err: any) {
      // Revert on failure: restore task
      setTasks(prev => [target, ...prev])
      alert(err.message)
    } finally {
      setDeleteLoading(false)
    }
  }

  const hasFilters = priorityFilter !== "ALL" || !!searchQuery

  // ── Stats ────────────────────────────────────────────────
  const stats = React.useMemo(() => ({
    total:      tasks.length,
    inProgress: tasks.filter(t => t.status === "IN_PROGRESS").length,
    pending:    tasks.filter(t => t.status === "PENDING").length,
    completed:  tasks.filter(t => t.status === "COMPLETED").length,
  }), [tasks])

  return (
    <div className="relative flex h-full min-h-0 flex-col">

      {/* ── Sticky header ────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex flex-col gap-4 border-b border-border bg-background/90 backdrop-blur px-6 pt-6 pb-4">
        {/* Title + New button */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{VIEW_LABELS[statusView]}</h1>
            {!isLoading && (
              <p className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {stats.inProgress > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="relative flex size-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-60" />
                      <span className="relative inline-flex rounded-full size-1.5 bg-blue-500" />
                    </span>
                    {stats.inProgress} in progress
                  </span>
                )}
                {stats.pending > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-amber-400" />
                    {stats.pending} pending
                  </span>
                )}
                {stats.completed > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                    {stats.completed} done
                  </span>
                )}
                {stats.total === 0 && "No tasks"}
              </p>
            )}
          </div>

          <button
            onClick={openCreate}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 h-9 text-sm font-semibold text-primary-foreground hover:brightness-110 hover:shadow-lg hover:shadow-primary/25 active:scale-95 transition-all duration-150"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">New Task</span>
          </button>
        </div>

        {/* Search + filter toggle */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search tasks…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-border bg-muted/40 text-sm outline-none transition-all focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/15"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-all duration-150",
              showFilters || priorityFilter !== "ALL"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <SlidersHorizontal className="size-3.5" />
            <span className="hidden sm:inline">Filter</span>
            {priorityFilter !== "ALL" && (
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                1
              </span>
            )}
          </button>
        </div>

        {/* Priority filter pills */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 animate-fade-up">
            <p className="text-xs font-medium text-muted-foreground self-center">Priority:</p>
            {[{ value: "ALL", label: "All" }, ...PRIORITY_OPTIONS].map(opt => (
              <button
                key={opt.value}
                onClick={() => setPriorityFilter(opt.value as PriorityFilter)}
                className={cn(
                  "h-7 rounded-full px-3 text-xs font-medium border transition-all duration-150 active:scale-95",
                  priorityFilter === opt.value
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted"
                )}
              >
                {opt.label}
              </button>
            ))}
            {hasFilters && (
              <button
                onClick={() => { setPriorityFilter("ALL"); setSearchQuery("") }}
                className="h-7 rounded-full px-3 text-xs font-medium text-destructive border border-destructive/30 hover:bg-destructive/10 active:scale-95 transition-all duration-150"
              >
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Task list ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4">
        {isLoading ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="size-7 animate-spin text-primary" />
            <p className="text-sm font-medium">Loading tasks…</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <EmptyState
            hasFilters={hasFilters}
            onClear={() => { setPriorityFilter("ALL"); setSearchQuery("") }}
            onNew={openCreate}
          />
        ) : (
          <div className="space-y-6 pb-24">

            {/* Active tasks */}
            {activeTasks.length > 0 && (
              <section>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  Active — {activeTasks.length}
                </p>
                <div className="space-y-2">
                  {activeTasks.map((task, i) => (
                    <div key={task.id} style={{ animationDelay: `${i * 20}ms` }}>
                      <TaskListItem
                        task={task}
                        onEdit={openEdit}
                        onDelete={setDeleteTarget}
                        onToggleComplete={handleToggleComplete}
                        onStatusChange={handleStatusChange}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Completed section */}
            {completedTasks.length > 0 && (
              <section>
                <button
                  onClick={() => setShowCompleted(v => !v)}
                  className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 hover:text-muted-foreground transition-colors group"
                >
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                  Completed — {completedTasks.length}
                  {showCompleted
                    ? <ChevronUp  className="size-3 ml-0.5 group-hover:opacity-100 opacity-60" />
                    : <ChevronDown className="size-3 ml-0.5 group-hover:opacity-100 opacity-60" />}
                </button>

                {showCompleted && (
                  <div className="space-y-2 animate-fade-up">
                    {completedTasks.map((task, i) => (
                      <div key={task.id} style={{ animationDelay: `${i * 15}ms` }}>
                        <TaskListItem
                          task={task}
                          onEdit={openEdit}
                          onDelete={setDeleteTarget}
                          onToggleComplete={handleToggleComplete}
                          onStatusChange={handleStatusChange}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>

      {/* ── FAB ───────────────────────────────────────────── */}
      <button
        onClick={openCreate}
        className="fixed bottom-6 right-6 z-20 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-110 active:scale-95 transition-all duration-200 lg:hidden"
        title="New task"
      >
        <Plus className="size-6" />
      </button>

      {/* ── Task form panel ───────────────────────────────── */}
      <TaskFormPanel
        open={panelOpen}
        task={editingTask}
        onClose={() => { setPanelOpen(false); setEditingTask(null) }}
        onSave={handleSave}
      />

      {/* ── Delete confirm ────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative z-10 w-full max-w-sm animate-scale-in rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-base">Delete task?</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">"{deleteTarget.title}"</span>{" "}
              will be permanently removed. This cannot be undone.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
                className="flex-1 h-9 rounded-lg border border-border text-sm hover:bg-muted active:scale-[0.97] transition-all duration-150"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteLoading}
                className="flex-1 h-9 rounded-lg bg-destructive text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50"
              >
                {deleteLoading && <Loader2 className="size-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────
function EmptyState({
  hasFilters,
  onClear,
  onNew,
}: {
  hasFilters: boolean
  onClear: () => void
  onNew: () => void
}) {
  return (
    <div className="flex h-60 flex-col items-center justify-center gap-4 text-center animate-fade-up">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        {hasFilters
          ? <SlidersHorizontal className="size-7 text-muted-foreground" />
          : <CheckCircle2 className="size-7 text-muted-foreground" />}
      </div>
      <div>
        <p className="font-semibold text-base">
          {hasFilters ? "No matching tasks" : "No tasks yet"}
        </p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          {hasFilters
            ? "Try adjusting your filters or search query."
            : "Create your first task and start getting things done!"}
        </p>
      </div>
      <button
        onClick={hasFilters ? onClear : onNew}
        className="h-9 rounded-xl px-5 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 active:scale-95 transition-all duration-150"
      >
        {hasFilters ? "Clear filters" : "Create a task"}
      </button>
    </div>
  )
}
