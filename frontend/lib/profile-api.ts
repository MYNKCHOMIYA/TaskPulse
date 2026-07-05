// Extend api.ts with user profile management

import { apiFetch } from "./api"

export interface UpdateProfileData {
  username?: string
  email?: string
  password?: string
}

export const profileApi = {
  async updateProfile(userId: number, data: UpdateProfileData): Promise<any> {
    const res = await apiFetch(`/users/update/${userId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Failed to update profile")
    }
    return res.json()
  },

  async deleteAccount(userId: number): Promise<void> {
    const res = await apiFetch(`/users/delete/${userId}`, {
      method: "DELETE",
    })
    if (!res.ok && res.status !== 200) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Failed to delete account")
    }
  }
}
