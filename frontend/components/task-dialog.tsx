"use client"

import * as React from "react"
import { CalendarIcon, X } from "lucide-react"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
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

interface TaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task | null
  onSave: (values: TaskFormValues) => void
}

const EMPTY_FORM: TaskFormValues = {
  title: "",
  description: "",
  status: "PENDING",
  priority: null,
  due_date: null,
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  onSave,
}: TaskDialogProps) {
  const [values, setValues] = React.useState<TaskFormValues>(EMPTY_FORM)
  const [error, setError] = React.useState(false)
  const [calendarOpen, setCalendarOpen] = React.useState(false)

  const isEditing = task !== null

  // Reset the form whenever the dialog opens for a new or existing task.
  React.useEffect(() => {
    if (open) {
      setValues(
        task
          ? {
              title: task.title,
              description: task.description,
              status: task.status,
              priority: task.priority,
              due_date: task.due_date,
            }
          : EMPTY_FORM
      )
      setError(false)
    }
  }, [open, task])

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!values.title.trim()) {
      setError(true)
      return
    }
    onSave({ ...values, title: values.title.trim() })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit task" : "Create new task"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the details of your task below."
                : "Fill in the details to add a new task to your list."}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-4">
            <Field data-invalid={error || undefined}>
              <FieldLabel htmlFor="task-title">Title</FieldLabel>
              <Input
                id="task-title"
                placeholder="e.g. Finalize the quarterly report"
                value={values.title}
                maxLength={TITLE_MAX}
                aria-invalid={error || undefined}
                autoComplete="off"
                onChange={(e) => {
                  setValues((v) => ({ ...v, title: e.target.value }))
                  if (error) setError(false)
                }}
              />
              <FieldDescription>
                {error
                  ? "Title is required."
                  : `${values.title.length}/${TITLE_MAX} characters`}
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="task-description">Description</FieldLabel>
              <Textarea
                id="task-description"
                placeholder="Add more detail about this task (optional)"
                value={values.description}
                maxLength={DESCRIPTION_MAX}
                rows={3}
                className="resize-none"
                onChange={(e) =>
                  setValues((v) => ({ ...v, description: e.target.value }))
                }
              />
              <FieldDescription>
                {`${values.description.length}/${DESCRIPTION_MAX} characters`}
              </FieldDescription>
            </Field>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="task-status">Status</FieldLabel>
                <Select
                  items={STATUS_OPTIONS}
                  value={values.status}
                  onValueChange={(value) =>
                    setValues((v) => ({ ...v, status: value as TaskStatus }))
                  }
                >
                  <SelectTrigger id="task-status" className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="task-priority">Priority</FieldLabel>
                <Select
                  items={PRIORITY_OPTIONS}
                  value={values.priority ?? "NONE"}
                  onValueChange={(value) =>
                    setValues((v) => ({
                      ...v,
                      priority: value === "NONE" ? null : (value as TaskPriority),
                    }))
                  }
                >
                  <SelectTrigger id="task-priority" className="w-full">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PRIORITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="task-due-date">Due date</FieldLabel>
              <div className="flex items-center gap-2">
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        id="task-due-date"
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full justify-start font-normal",
                          !values.due_date && "text-muted-foreground"
                        )}
                      />
                    }
                  >
                    <CalendarIcon data-icon="inline-start" />
                    {values.due_date
                      ? formatDueDate(values.due_date)
                      : "Pick a date"}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        values.due_date ? new Date(values.due_date) : undefined
                      }
                      onSelect={(date) => {
                        setValues((v) => ({
                          ...v,
                          due_date: date ? date.toISOString() : null,
                        }))
                        setCalendarOpen(false)
                      }}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
                {values.due_date ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Clear due date"
                    onClick={() =>
                      setValues((v) => ({ ...v, due_date: null }))
                    }
                  >
                    <X />
                  </Button>
                ) : null}
              </div>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" />}
            >
              Cancel
            </DialogClose>
            <Button type="submit">Save task</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
