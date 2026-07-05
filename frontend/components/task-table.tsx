"use client"

import { CalendarDays, MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PriorityBadge, StatusBadge } from "@/components/task-badges"
import { formatDueDate, type Task } from "@/lib/tasks"
import { cn } from "@/lib/utils"

interface TaskTableProps {
  tasks: Task[]
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

export function TaskTable({ tasks, onEdit, onDelete }: TaskTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="min-w-[240px]">Task</TableHead>
            <TableHead className="w-40">Status</TableHead>
            <TableHead className="w-32">Priority</TableHead>
            <TableHead className="w-40">Due date</TableHead>
            <TableHead className="w-14 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const isCompleted = task.status === "COMPLETED"
            return (
              <TableRow key={task.id}>
                <TableCell className="max-w-[420px] align-top">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span
                      className={cn(
                        "truncate font-medium leading-snug",
                        isCompleted && "text-muted-foreground line-through"
                      )}
                    >
                      {task.title}
                    </span>
                    {task.description ? (
                      <span className="truncate text-sm text-muted-foreground">
                        {task.description}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <StatusBadge status={task.status} />
                </TableCell>
                <TableCell className="align-top">
                  <PriorityBadge priority={task.priority} />
                </TableCell>
                <TableCell className="align-top">
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarDays className="size-3.5" aria-hidden />
                    {formatDueDate(task.due_date)}
                  </span>
                </TableCell>
                <TableCell className="align-top text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${task.title}`}
                        >
                          <MoreHorizontal />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => onEdit(task)}>
                          <Pencil data-icon="inline-start" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDelete(task)}
                        >
                          <Trash2 data-icon="inline-start" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
