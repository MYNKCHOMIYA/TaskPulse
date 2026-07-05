"use client"

import * as React from "react"
import {
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { profileApi } from "@/lib/profile-api"
import type { User } from "@/lib/tasks"

interface ProfileModalProps {
  user: User & { id: number }
  open: boolean
  onClose: () => void
  onUserUpdated: (user: User) => void
  onAccountDeleted: () => void
}

type Tab = "profile" | "password" | "danger"

export function ProfileModal({
  user,
  open,
  onClose,
  onUserUpdated,
  onAccountDeleted,
}: ProfileModalProps) {
  const [activeTab, setActiveTab] = React.useState<Tab>("profile")
  const [loading, setLoading] = React.useState(false)
  const [successMsg, setSuccessMsg] = React.useState("")
  const [errorMsg, setErrorMsg] = React.useState("")

  // Profile fields
  const [username, setUsername] = React.useState(user.username)
  const [email, setEmail]       = React.useState(user.email)

  // Password fields
  const [newPassword, setNewPassword]     = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [showNewPwd, setShowNewPwd]       = React.useState(false)

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = React.useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setUsername(user.username)
      setEmail(user.email)
      setActiveTab("profile")
      setSuccessMsg("")
      setErrorMsg("")
      setNewPassword("")
      setConfirmPassword("")
      setDeleteConfirm("")
    }
  }, [open, user])

  // Prevent body scroll when open
  React.useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    else      document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  function clearMessages() {
    setSuccessMsg("")
    setErrorMsg("")
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault()
    clearMessages()
    if (!username.trim()) {
      setErrorMsg("Username cannot be empty")
      return
    }
    setLoading(true)
    try {
      await profileApi.updateProfile(user.id, {
        username: username.trim(),
        email: email.trim(),
      })
      onUserUpdated({ ...user, username: username.trim(), email: email.trim() })
      setSuccessMsg("Profile updated successfully!")
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    clearMessages()
    if (newPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match")
      return
    }
    setLoading(true)
    try {
      await profileApi.updateProfile(user.id, { password: newPassword })
      setSuccessMsg("Password updated! Please log in again on other devices.")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteAccount() {
    clearMessages()
    if (deleteConfirm !== user.username) {
      setErrorMsg("Username does not match. Account not deleted.")
      return
    }
    setLoading(true)
    try {
      await profileApi.deleteAccount(user.id)
      onAccountDeleted()
    } catch (err: any) {
      setErrorMsg(err.message)
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md animate-scale-in rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <div>
            <h2 className="text-lg font-bold">Account Settings</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg hover:bg-muted hover:rotate-90 active:scale-90 transition-all duration-200 text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-6 mt-5 border-b border-border">
          {(["profile", "password", "danger"] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); clearMessages() }}
              className={cn(
                "relative px-4 py-2 text-sm font-medium capitalize transition-all duration-200 select-none",
                "after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-primary after:transition-all after:duration-300 after:ease-out",
                activeTab === tab
                  ? "text-primary after:scale-x-100 after:opacity-100"
                  : "text-muted-foreground hover:text-foreground after:scale-x-0 after:opacity-0"
              )}
            >
              {tab === "danger" ? "Danger Zone" : tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {/* Messages */}
          {(successMsg || errorMsg) && (
            <div
              className={cn(
                "mb-4 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm animate-fade-up",
                successMsg
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-destructive/25 bg-destructive/8 text-destructive dark:bg-destructive/15"
              )}
            >
              {successMsg ? <Check className="size-4 shrink-0 mt-0.5" /> : <AlertTriangle className="size-4 shrink-0 mt-0.5" />}
              <span>{successMsg || errorMsg}</span>
            </div>
          )}

          {/* ── Profile tab ─────────────────────── */}
          {activeTab === "profile" && (
            <form onSubmit={handleUpdateProfile} className="space-y-4 animate-fade-up">
              <ProfileField
                id="pm-username"
                label="Username"
                icon={<UserIcon className="size-4" />}
                value={username}
                onChange={setUsername}
                placeholder="Your display name"
                disabled={loading}
              />
              <ProfileField
                id="pm-email"
                label="Email address"
                icon={<Mail className="size-4" />}
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                disabled={loading}
              />
              <div className="pt-1">
                <SubmitBtn loading={loading} label="Save Changes" />
              </div>
            </form>
          )}

          {/* ── Password tab ─────────────────────── */}
          {activeTab === "password" && (
            <form onSubmit={handleChangePassword} className="space-y-4 animate-fade-up">
              <div className="space-y-1.5">
                <label htmlFor="pm-newpwd" className="text-sm font-medium">New Password</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Lock className="size-4" />
                  </span>
                  <input
                    id="pm-newpwd"
                    type={showNewPwd ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="tp-modal-input pl-9 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showNewPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="pm-confirmpwd" className="text-sm font-medium">Confirm Password</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Lock className="size-4" />
                  </span>
                  <input
                    id="pm-confirmpwd"
                    type="password"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="tp-modal-input pl-9"
                  />
                </div>
              </div>
              <div className="pt-1">
                <SubmitBtn loading={loading} label="Update Password" />
              </div>
            </form>
          )}

          {/* ── Danger tab ─────────────────────── */}
          {activeTab === "danger" && (
            <div className="space-y-5 animate-fade-up">
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/15 text-destructive shrink-0">
                    <Trash2 className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-destructive">Delete Account</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      This action is <strong>permanent</strong> and cannot be undone. All your tasks and data will be removed.
                    </p>
                  </div>
                </div>

                {!deleteDialogOpen ? (
                  <button
                    onClick={() => setDeleteDialogOpen(true)}
                    className="w-full rounded-lg border border-destructive/40 bg-destructive/10 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors"
                  >
                    I want to delete my account
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Type <strong className="text-foreground">{user.username}</strong> to confirm:
                    </p>
                    <input
                      type="text"
                      placeholder={user.username}
                      value={deleteConfirm}
                      onChange={e => setDeleteConfirm(e.target.value)}
                      disabled={loading}
                      className="tp-modal-input border-destructive/40"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setDeleteDialogOpen(false); setDeleteConfirm("") }}
                        className="flex-1 rounded-lg border border-border py-2 text-sm hover:bg-muted transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={loading || deleteConfirm !== user.username}
                        className="flex-1 rounded-lg bg-destructive py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                      >
                        {loading ? <Loader2 className="size-4 animate-spin mx-auto" /> : "Delete Account"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        /* ── Modal inputs ── */
        .tp-modal-input {
          display: block;
          width: 100%;
          height: 2.5rem;
          padding-top: 0;
          padding-bottom: 0;
          padding-left: 0.75rem;   /* overridden by pl-9 when icon present */
          padding-right: 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid var(--border);
          background: var(--background);
          color: var(--foreground);
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
        }
        .tp-modal-input::placeholder { color: var(--muted-foreground); }
        .tp-modal-input:hover:not(:disabled) {
          border-color: oklch(from var(--primary) l c h / 0.5);
        }
        .tp-modal-input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px oklch(from var(--primary) l c h / 0.15);
          background: oklch(from var(--background) calc(l + 0.01) c h);
        }
        .tp-modal-input:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Tailwind pl-9 must win over the padding-left above — force via specificity */
        .tp-modal-input.pl-9  { padding-left: 2.25rem !important; }
        .tp-modal-input.pr-10 { padding-right: 2.5rem  !important; }

        /* ── Ripple effect on buttons ── */
        .tp-ripple {
          position: relative;
          overflow: hidden;
        }
        .tp-ripple::after {
          content: '';
          position: absolute;
          inset: 0;
          background: oklch(1 0 0 / 0.18);
          border-radius: inherit;
          opacity: 0;
          transform: scale(0.85);
          transition: opacity 0.12s ease, transform 0.12s ease;
        }
        .tp-ripple:active::after {
          opacity: 1;
          transform: scale(1);
          transition: none;
        }

        /* ── Tab active / hover ── */
        .tp-tab {
          position: relative;
          transition: color 0.18s ease;
        }
        .tp-tab::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--primary);
          border-radius: 9999px;
          transform: scaleX(0);
          transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }
        .tp-tab.active::after { transform: scaleX(1); }
      `}</style>
    </div>
  )
}

function ProfileField({
  id, label, icon, value, onChange, placeholder, type = "text", disabled,
}: {
  id: string
  label: string
  icon: React.ReactNode
  value: string
  onChange: (v: string) => void
  placeholder: string
  type?: string
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          required
          disabled={disabled}
          className="tp-modal-input pl-9"
        />
      </div>
    </div>
  )
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="tp-ripple inline-flex items-center justify-center gap-2 h-10 w-full rounded-xl bg-primary text-primary-foreground text-sm font-semibold transition-all duration-150 hover:brightness-110 hover:shadow-md hover:shadow-primary/30 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {loading ? "Saving…" : label}
    </button>
  )
}
