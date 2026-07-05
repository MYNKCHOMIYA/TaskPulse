// Theme utilities: get, set, and listen to theme changes

export type Theme = "light" | "dark" | "system"

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system"
  return (localStorage.getItem("tp_theme") as Theme) || "system"
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches

  if (theme === "dark" || (theme === "system" && prefersDark)) {
    root.classList.add("dark")
    root.classList.remove("light")
  } else {
    root.classList.remove("dark")
    root.classList.add("light")
  }
}

export function setTheme(theme: Theme) {
  localStorage.setItem("tp_theme", theme)
  applyTheme(theme)
}

export function initTheme() {
  const theme = getStoredTheme()
  applyTheme(theme)
}
