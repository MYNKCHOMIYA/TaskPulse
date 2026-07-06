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
  Pencil,
  Trash2,
  CalendarDays,
  History,
  Activity,
} from "lucide-react"
import confetti from "canvas-confetti"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import {
  PRIORITY_OPTIONS,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TaskEventLog
} from "@/lib/tasks"
import { TaskListItem } from "@/components/task-list-item"
import { TaskFormPanel, type TaskFormValues } from "@/components/task-form-panel"

// ── Timezone & Live Clock ──────────────────────────────────
function TimezoneHeader() {
  const [time, setTime] = React.useState(new Date())
  const [tz, setTz] = React.useState("UTC")

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Format date: "Mon, Jul 6, 2026"
  const dateStr = time.toLocaleDateString("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  })

  // Format time: "10:30:15 AM"
  const timeStr = time.toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  })

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 border-b border-border px-6 py-2.5">
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CalendarDays className="size-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold tracking-wide text-foreground">{dateStr}</span>
          <span className="text-[10px] font-medium text-muted-foreground font-mono">{timeStr}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Timezone:</label>
        <div className="relative">
          <select
            value={tz}
            onChange={e => setTz(e.target.value)}
            className="h-7 appearance-none rounded-lg border border-border bg-background pl-2.5 pr-7 text-xs font-medium outline-none hover:bg-muted focus:border-primary focus:ring-1 focus:ring-primary/20"
          >
            <option value="UTC">UTC</option>
            <option value="America/New_York">New York (EST)</option>
            <option value="America/Los_Angeles">Los Angeles (PST)</option>
            <option value="Europe/London">London (GMT)</option>
            <option value="Europe/Paris">Paris (CET)</option>
            <option value="Asia/Kolkata">India (IST)</option>
            <option value="Asia/Tokyo">Tokyo (JST)</option>
            <option value="Australia/Sydney">Sydney (AEDT)</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>
    </div>
  )
}

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
  const [historyOpen,   setHistoryOpen]   = React.useState(false)
  const [editingTask,   setEditingTask]   = React.useState<Task | null>(null)
  const [deleteTarget,  setDeleteTarget]  = React.useState<Task | null>(null)
  const [deleteLoading, setDeleteLoading] = React.useState(false)

  // ── Selection Mode States ──────────────────────────────────
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set())
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = React.useState(false)

  const selectionMode = selectedIds.size > 0

  const handleToggleSelect = React.useCallback((task: Task) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(task.id)) {
        next.delete(task.id)
      } else {
        next.add(task.id)
      }
      return next
    })
  }, [])

  const handleStartSelection = React.useCallback((task: Task) => {
    setSelectedIds(new Set([task.id]))
  }, [])

  const handleClearSelection = React.useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleEditSelected = React.useCallback(() => {
    if (selectedIds.size !== 1) return
    const id = Array.from(selectedIds)[0]
    const task = tasks.find(t => t.id === id)
    if (task) {
      setEditingTask(task)
      setPanelOpen(true)
      setSelectedIds(new Set())
    }
  }, [selectedIds, tasks])

  async function confirmBulkDelete() {
    if (selectedIds.size === 0) return
    const targets = Array.from(selectedIds)
    setBulkDeleteConfirm(false)
    setDeleteLoading(true)

    const prevTasks = [...tasks]

    // Optimistic delete from UI & reset selection
    setTasks(prev => prev.filter(t => !selectedIds.has(t.id)))
    setSelectedIds(new Set())

    try {
      await Promise.all(targets.map(id => api.tasks.deleteTask(id)))
    } catch (err: any) {
      setTasks(prevTasks)
      alert("Failed to delete some tasks. Please try again.")
    } finally {
      setDeleteLoading(false)
    }
  }

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
    try {
      if (editingTask) {
        const updated = await api.tasks.updateTask(editingTask.id, values)
        setTasks(prev => prev.map(t => t.id === editingTask.id ? updated : t))
      } else {
        const created = await api.tasks.createTask(values)
        setTasks(prev => [created, ...prev])
      }
    } catch (err: any) {
      alert(err.message || "An error occurred while saving the task.")
      throw err // Rethrow to let the form panel know it failed
    }
  }

  // ── Confetti Celebration Helper ───────────────────────────
  const triggerConfetti = React.useCallback(() => {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
      colors: ["#6366f1", "#10b981", "#3b82f6", "#f59e0b", "#ec4899"],
    })
  }, [])

  async function handleToggleComplete(task: Task) {
    const newStatus: TaskStatus = task.status === "COMPLETED" ? "PENDING" : "COMPLETED"
    
    // Add timestamps based on new status
    const updates: Partial<Task> = { status: newStatus }
    if (newStatus === "COMPLETED") {
      updates.completed_at = new Date().toISOString()
      // If it somehow bypassed IN_PROGRESS, give it a started_at of now
      if (!task.started_at) updates.started_at = updates.completed_at
    }
    
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } : t))
    
    if (newStatus === "COMPLETED") {
      triggerConfetti()
    }
    
    try {
      const updated = await api.tasks.updateTask(task.id, updates)
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
    
    const updates: Partial<Task> = { status }
    if (status === "IN_PROGRESS" && !task.started_at) {
      updates.started_at = new Date().toISOString()
    } else if (status === "COMPLETED") {
      updates.completed_at = new Date().toISOString()
      if (!task.started_at) updates.started_at = updates.completed_at
    }
    
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } : t))
    
    if (status === "COMPLETED") {
      triggerConfetti()
    }
    
    try {
      const updated = await api.tasks.updateTask(task.id, updates)
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
      <TimezoneHeader />

      {/* ── Sticky header ────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex flex-col gap-4 border-b border-border bg-background/90 backdrop-blur px-6 pt-6 pb-4">
        {/* Selection mode floating bar */}
        {selectionMode && (
          <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl px-4 py-2.5 animate-fade-in">
            <div className="flex items-center gap-3">
              <button
                onClick={handleClearSelection}
                className="flex size-7 items-center justify-center rounded-lg hover:bg-primary/15 text-primary active:scale-95 transition-all"
                title="Cancel selection"
              >
                <X className="size-4" />
              </button>
              <span className="text-sm font-semibold text-primary">{selectedIds.size} selected</span>
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.size === 1 && (
                <button
                  onClick={handleEditSelected}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-background hover:bg-muted border border-border rounded-lg active:scale-95 transition-all"
                >
                  <Pencil className="size-3.5" />
                  Edit
                </button>
              )}
              <button
                onClick={() => setBulkDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-destructive text-white hover:opacity-90 rounded-lg active:scale-95 transition-all"
              >
                <Trash2 className="size-3.5" />
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Title + New button */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
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

          <div className="flex items-center gap-2">
            <button
              onClick={() => setHistoryOpen(true)}
              className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground h-9 px-3 text-sm font-semibold transition-all duration-150 active:scale-95"
              title="Activity History"
            >
              <History className="size-4" />
              <span className="hidden sm:inline">History</span>
            </button>
            <button
              onClick={openCreate}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 h-9 text-sm font-semibold text-primary-foreground hover:brightness-110 hover:shadow-lg hover:shadow-primary/25 active:scale-95 transition-all duration-150"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">New Task</span>
            </button>
          </div>
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
                        selectionMode={selectionMode}
                        selected={selectedIds.has(task.id)}
                        onToggleSelect={handleToggleSelect}
                        onStartSelection={handleStartSelection}
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
                          selectionMode={selectionMode}
                          selected={selectedIds.has(task.id)}
                          onToggleSelect={handleToggleSelect}
                          onStartSelection={handleStartSelection}
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

      {/* ── Task history panel ────────────────────────────── */}
      <TaskHistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />

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

      {/* ── Bulk Delete confirm ───────────────────────────── */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setBulkDeleteConfirm(false)}
          />
          <div className="relative z-10 w-full max-w-sm animate-scale-in rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-base">Delete multiple tasks?</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You are about to permanently delete <span className="font-medium text-foreground">{selectedIds.size} tasks</span>. This action is irreversible.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setBulkDeleteConfirm(false)}
                disabled={deleteLoading}
                className="flex-1 h-9 rounded-lg border border-border text-sm hover:bg-muted active:scale-[0.97] transition-all duration-150"
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkDelete}
                disabled={deleteLoading}
                className="flex-1 h-9 rounded-lg bg-destructive text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50"
              >
                {deleteLoading && <Loader2 className="size-4 animate-spin" />}
                Delete Selected
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

// ── Activity History Panel ─────────────────────────────────
function TaskHistoryPanel({ open, onClose }: { open: boolean, onClose: () => void }) {
  const [logs, setLogs] = React.useState<TaskEventLog[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setLoading(true)
      api.tasks.getHistory().then(data => {
        setLogs(data)
      }).catch(err => {
        console.error(err)
      }).finally(() => {
        setLoading(false)
      })
    }
  }, [open])

  return (
    <>
      <div 
        className={cn("fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300", open ? "opacity-100" : "opacity-0 pointer-events-none")}
        onClick={onClose} 
      />
      <div className={cn(
        "fixed right-0 top-0 z-50 h-full w-full max-w-md bg-background shadow-2xl transition-transform duration-300 flex flex-col border-l border-border",
        open ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5 text-foreground">
            <Activity className="size-5 text-primary" />
            <h2 className="text-lg font-bold">Activity History</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted transition-colors">
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              No activity in the last 7 days.
            </div>
          ) : (
            <div className="relative border-l border-border pl-6 ml-3 space-y-8 pb-10">
              {logs.map((log) => {
                const date = new Date(log.timestamp)
                const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                let Icon = Activity
                let colorClass = "text-muted-foreground bg-muted"
                let message = `Updated task '${log.task_title}'`

                if (log.event_type === "CREATE") {
                  Icon = Plus
                  colorClass = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                  message = `Created task '${log.task_title}'`
                } else if (log.event_type === "DELETE") {
                  Icon = Trash2
                  colorClass = "text-destructive bg-destructive/10 border-destructive/20"
                  message = `Deleted task '${log.task_title}'`
                } else if (log.event_type === "STATUS_CHANGE") {
                  Icon = CheckCircle2
                  if (log.new_value === "COMPLETED") colorClass = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                  else if (log.new_value === "IN_PROGRESS") colorClass = "text-blue-500 bg-blue-500/10 border-blue-500/20"
                  else colorClass = "text-amber-500 bg-amber-500/10 border-amber-500/20"
                  message = `Changed status of '${log.task_title}' from ${log.old_value} to ${log.new_value}`
                } else if (log.event_type === "PRIORITY_CHANGE") {
                  Icon = SlidersHorizontal
                  colorClass = "text-orange-500 bg-orange-500/10 border-orange-500/20"
                  message = `Changed priority of '${log.task_title}' from ${log.old_value || "None"} to ${log.new_value || "None"}`
                }

                return (
                  <div key={log.id} className="relative animate-fade-up">
                    <span className={cn("absolute -left-[37px] flex size-6 items-center justify-center rounded-full border ring-4 ring-background", colorClass)}>
                      <Icon className="size-3" />
                    </span>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{dateStr}</span>
                      <p className="text-sm font-medium leading-snug">{message}</p>
                      {log.details && (
                        <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md mt-1.5 font-medium border border-border/50">
                          {log.details}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
