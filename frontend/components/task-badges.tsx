import { ArrowDown, ArrowRight, ArrowUp, ChevronsUp, Minus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { TaskPriority, TaskStatus } from "@/lib/tasks"

const STATUS_STYLES: Record<
  TaskStatus,
  { label: string; className: string; dot: string }
> = {
  PENDING: {
    label: "Pending",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  IN_PROGRESS: {
    label: "In Progress",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  COMPLETED: {
    label: "Completed",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const config = STATUS_STYLES[status]
  return (
    <Badge variant="outline" className={cn("gap-1.5", config.className)}>
      <span className={cn("size-1.5 rounded-full", config.dot)} aria-hidden />
      {config.label}
    </Badge>
  )
}

const PRIORITY_STYLES: Record<
  Exclude<TaskPriority, null>,
  { label: string; className: string; icon: any }
> = {
  URGENT: {
    label: "Urgent",
    className:
      "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 font-semibold animate-pulse",
    icon: ChevronsUp,
  },
  HIGH: {
    label: "High",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
    icon: ArrowUp,
  },
  MEDIUM: {
    label: "Medium",
    className:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300",
    icon: ArrowRight,
  },
  LOW: {
    label: "Low",
    className:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300",
    icon: ArrowDown,
  },
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  if (priority === null) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Minus className="size-3" aria-hidden />
        None
      </Badge>
    )
  }

  const config = PRIORITY_STYLES[priority]
  const Icon = config.icon

  return (
    <Badge variant="outline" className={cn("gap-1", config.className)}>
      <Icon className="size-3" aria-hidden />
      {config.label}
    </Badge>
  )
}
