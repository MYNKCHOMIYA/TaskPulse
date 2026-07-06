export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED"
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null // ISO date string or null
  created_at: string
  updated_at: string
  started_at?: string | null
  completed_at?: string | null
}

export interface TaskEventLog {
  id: number
  task_id: number | null
  task_title: string
  event_type: string
  old_value: string | null
  new_value: string | null
  details: string | null
  timestamp: string
}

export interface User {
  username: string
  email: string
}

export const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
]

export const PRIORITY_OPTIONS: { value: Exclude<TaskPriority, null> | "NONE"; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
]

export const TITLE_MAX = 100
export const DESCRIPTION_MAX = 255

export function formatDueDate(iso: string | null): string {
  if (!iso) return "No due date"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "No due date"
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function daysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

export const MOCK_USER: User = {
  username: "Alex Rivera",
  email: "alex@example.com",
}

export const INITIAL_TASKS: Task[] = [
  {
    id: "t1",
    title: "Finalize Q3 product roadmap",
    description:
      "Consolidate feedback from stakeholders and lock the feature priorities for the next quarter.",
    status: "IN_PROGRESS",
    priority: "HIGH",
    due_date: daysFromNow(2),
    created_at: daysFromNow(-6),
    updated_at: daysFromNow(-1),
    started_at: daysFromNow(-1),
  },
  {
    id: "t2",
    title: "Review design system tokens",
    description:
      "Audit color, spacing, and typography tokens for consistency across the marketing site and app.",
    status: "PENDING",
    priority: "MEDIUM",
    due_date: daysFromNow(5),
    created_at: daysFromNow(-4),
    updated_at: daysFromNow(-4),
    started_at: null,
    completed_at: null,
  },
  {
    id: "t3",
    title: "Ship onboarding email sequence",
    description:
      "Write and schedule the five-part welcome sequence for new sign-ups.",
    status: "COMPLETED",
    priority: "LOW",
    due_date: daysFromNow(-1),
    created_at: daysFromNow(-10),
    updated_at: daysFromNow(-1),
    started_at: daysFromNow(-2),
    completed_at: daysFromNow(-1),
  },
  {
    id: "t4",
    title: "Prepare investor update deck",
    description:
      "Summarize growth metrics, revenue, and product milestones for the monthly update.",
    status: "PENDING",
    priority: "HIGH",
    due_date: daysFromNow(7),
    created_at: daysFromNow(-2),
    updated_at: daysFromNow(-2),
    started_at: null,
    completed_at: null,
  },
  {
    id: "t5",
    title: "Clean up backlog tickets",
    description: "",
    status: "PENDING",
    priority: null,
    due_date: null,
    created_at: daysFromNow(-3),
    updated_at: daysFromNow(-3),
    started_at: null,
    completed_at: null,
  },
]
