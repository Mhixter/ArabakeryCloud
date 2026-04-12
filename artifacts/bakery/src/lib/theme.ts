export const THEME_COLORS = [
  { value: "amber", label: "Amber", description: "Warm bakery feel", hex: "#D97706" },
  { value: "orange", label: "Orange", description: "Vibrant & energetic", hex: "#EA580C" },
  { value: "blue", label: "Blue", description: "Professional & calm", hex: "#2563EB" },
  { value: "green", label: "Green", description: "Fresh & natural", hex: "#16A34A" },
  { value: "slate", label: "Slate", description: "Modern & elegant", hex: "#475569" },
] as const;

export function applyTheme(color: string) {
  const root = document.documentElement;
  if (color === "amber") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", color);
  }
}

export function initTheme() {
  try {
    const raw = localStorage.getItem("nmb_company");
    if (raw) {
      const company = JSON.parse(raw);
      if (company?.themeColor) {
        applyTheme(company.themeColor);
        return;
      }
    }
  } catch {
    // ignore
  }
  applyTheme("amber");
}
