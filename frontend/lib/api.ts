import { Task, TaskPriority, TaskStatus, User } from "./tasks"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("tp_access_token")
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("tp_refresh_token")
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem("tp_access_token", access)
  localStorage.setItem("tp_refresh_token", refresh)
}

export function clearTokens() {
  localStorage.removeItem("tp_access_token")
  localStorage.removeItem("tp_refresh_token")
}

// In-flight refresh promise to prevent concurrent duplicate refresh calls
let refreshPromise: Promise<string | null> | null = null

async function refreshTokens(): Promise<string | null> {
  const refresh = getRefreshToken()
  if (!refresh) return null

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (!res.ok) {
      throw new Error("Refresh failed")
    }
    const data: TokenResponse = await res.json()
    setTokens(data.access_token, data.refresh_token)
    return data.access_token
  } catch (error) {
    clearTokens()
    window.dispatchEvent(new Event("api-unauthorized"))
    return null
  }
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${BASE_URL}${path}`
  const headers = new Headers(options.headers || {})

  const token = getAccessToken()
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  if (options.body && typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const mergedOptions = { ...options, headers }
  let response = await fetch(url, mergedOptions)

  if (response.status === 401) {
    if (!refreshPromise) {
      refreshPromise = refreshTokens().finally(() => {
        refreshPromise = null
      })
    }

    const newToken = await refreshPromise
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`)
      response = await fetch(url, { ...options, headers: { ...Object.fromEntries(headers.entries()), Authorization: `Bearer ${newToken}` } })
    }
  }

  return response
}

export const api = {
  auth: {
    async login(email: string, password: string): Promise<TokenResponse> {
      const params = new URLSearchParams()
      params.append("username", email)
      params.append("password", password)

      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || "Invalid credentials")
      }

      const data: TokenResponse = await res.json()
      setTokens(data.access_token, data.refresh_token)
      return data
    },

    async signup(username: string, email: string, password: string): Promise<any> {
      const res = await fetch(`${BASE_URL}/users/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email, password }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || "Signup failed")
      }

      return res.json()
    },

    async logout(): Promise<void> {
      const refresh = getRefreshToken()
      if (refresh) {
        await apiFetch("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refresh_token: refresh }),
        }).catch(() => {})
      }
      clearTokens()
      window.dispatchEvent(new Event("api-unauthorized"))
    },

    async getMe(): Promise<User> {
      const res = await apiFetch("/auth/me")
      if (!res.ok) {
        throw new Error("Failed to load user profile")
      }
      return res.json()
    }
  },

  tasks: {
    async getTasks(filters?: {
      search?: string
      status?: string
      priority?: string
    }): Promise<Task[]> {
      const params = new URLSearchParams()
      if (filters?.search) {
        params.append("search", filters.search)
      }
      if (filters?.status && filters.status !== "ALL") {
        params.append("task_status", filters.status)
      }
      if (filters?.priority && filters.priority !== "ALL" && filters.priority !== "NONE") {
        params.append("priority", filters.priority)
      }

      const res = await apiFetch(`/tasks/?${params.toString()}`)
      if (!res.ok) {
        throw new Error("Failed to fetch tasks")
      }

      const data = await res.json()
      let tasksList: Task[] = data.tasks.map((t: any) => ({
        ...t,
        id: String(t.id),
      }))

      if (filters?.priority === "NONE") {
        tasksList = tasksList.filter((t) => t.priority === null)
      }

      return tasksList
    },

    async createTask(taskData: Omit<Task, "id" | "created_at" | "updated_at">): Promise<Task> {
      const payload = {
        title: taskData.title,
        description: taskData.description || null,
        status: taskData.status,
        priority: taskData.priority,
        due_date: taskData.due_date,
      }

      const res = await apiFetch("/tasks/create", {
        method: "POST",
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || "Failed to create task")
      }

      const t = await res.json()
      return {
        ...t,
        id: String(t.id),
      }
    },

    async updateTask(id: string, taskData: Partial<Omit<Task, "id" | "created_at" | "updated_at">>): Promise<Task> {
      const payload = {
        title: taskData.title,
        description: taskData.description,
        status: taskData.status,
        priority: taskData.priority,
        due_date: taskData.due_date,
      }

      const res = await apiFetch(`/tasks/update/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || "Failed to update task")
      }

      const t = await res.json()
      return {
        ...t,
        id: String(t.id),
      }
    },

    async deleteTask(id: string): Promise<void> {
      const res = await apiFetch(`/tasks/delete/${id}`, {
        method: "DELETE",
      })

      if (!res.ok && res.status !== 204) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || "Failed to delete task")
      }
    }
  }
}
