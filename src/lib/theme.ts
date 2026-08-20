// 主题配置系统
// 支持：颜色、字体、圆角、阴影等自定义

export interface ThemeConfig {
  id: string;
  name: string;
  colors: {
    primary: string;
    primarySoft: string;
    primaryStrong: string;
    warning: string;
    warningSoft: string;
    success: string;
    successSoft: string;
    danger: string;
    dangerSoft: string;
    paper: string;
    paperWarm: string;
    surface: string;
    ink: string;
    muted: string;
    mutedLight: string;
    line: string;
    lineSoft: string;
  };
  fonts: {
    display: string;
    body: string;
    mono: string;
  };
  radius: {
    card: string;
    button: string;
    badge: string;
  };
  shadows: {
    card: string;
    cardHover: string;
  };
}

// 预设主题
export const presetThemes: ThemeConfig[] = [
  {
    id: "coral",
    name: "珊瑚粉",
    colors: {
      primary: "#c4716b",
      primarySoft: "#f5e6e4",
      primaryStrong: "#a85d58",
      warning: "#d4a35a",
      warningSoft: "#fdf5e8",
      success: "#7fb069",
      successSoft: "#edf5e8",
      danger: "#c45b5b",
      dangerSoft: "#fceeee",
      paper: "#fdf8f3",
      paperWarm: "#f8f0e8",
      surface: "#ffffff",
      ink: "#2d2a26",
      muted: "#9a8e84",
      mutedLight: "#c4b8ae",
      line: "#e8ddd4",
      lineSoft: "#f0e8e0",
    },
    fonts: {
      display: '"Playfair Display", "Noto Serif SC", serif',
      body: '"Noto Sans SC", "Quicksand", system-ui, sans-serif',
      mono: '"JetBrains Mono", monospace',
    },
    radius: {
      card: "24px",
      button: "12px",
      badge: "8px",
    },
    shadows: {
      card: "0 2px 16px rgba(45, 42, 38, 0.05)",
      cardHover: "0 8px 32px rgba(45, 42, 38, 0.09)",
    },
  },
  {
    id: "mint",
    name: "薄荷绿",
    colors: {
      primary: "#5fb3a3",
      primarySoft: "#e4f5f2",
      primaryStrong: "#4a9a8c",
      warning: "#e8a87c",
      warningSoft: "#fdf2e8",
      success: "#7fb069",
      successSoft: "#edf5e8",
      danger: "#c45b5b",
      dangerSoft: "#fceeee",
      paper: "#f5faf9",
      paperWarm: "#e8f3f1",
      surface: "#ffffff",
      ink: "#2a2d2c",
      muted: "#8a948e",
      mutedLight: "#b8c4be",
      line: "#d8e4df",
      lineSoft: "#e8f0ec",
    },
    fonts: {
      display: '"Outfit", "Noto Sans SC", sans-serif',
      body: '"Noto Sans SC", "Quicksand", system-ui, sans-serif',
      mono: '"JetBrains Mono", monospace',
    },
    radius: {
      card: "20px",
      button: "10px",
      badge: "6px",
    },
    shadows: {
      card: "0 2px 12px rgba(42, 45, 44, 0.05)",
      cardHover: "0 8px 28px rgba(42, 45, 44, 0.08)",
    },
  },
  {
    id: "lavender",
    name: "薰衣草",
    colors: {
      primary: "#9b8ec4",
      primarySoft: "#eeeaf5",
      primaryStrong: "#7d71a8",
      warning: "#e8b87c",
      warningSoft: "#fdf5e8",
      success: "#7fb069",
      successSoft: "#edf5e8",
      danger: "#c45b5b",
      dangerSoft: "#fceeee",
      paper: "#f8f7fa",
      paperWarm: "#efedf5",
      surface: "#ffffff",
      ink: "#2a2a2d",
      muted: "#8e8a94",
      mutedLight: "#c4bec8",
      line: "#e0dce8",
      lineSoft: "#ece8f0",
    },
    fonts: {
      display: '"Playfair Display", "Noto Serif SC", serif',
      body: '"Noto Sans SC", system-ui, sans-serif',
      mono: '"JetBrains Mono", monospace',
    },
    radius: {
      card: "28px",
      button: "14px",
      badge: "10px",
    },
    shadows: {
      card: "0 2px 16px rgba(42, 42, 45, 0.05)",
      cardHover: "0 8px 32px rgba(42, 42, 45, 0.09)",
    },
  },
  {
    id: "warm",
    name: "秋日暖",
    colors: {
      primary: "#c27b5e",
      primarySoft: "#f5e6df",
      primaryStrong: "#a0644a",
      warning: "#d4a35a",
      warningSoft: "#fdf5e8",
      success: "#7fb069",
      successSoft: "#edf5e8",
      danger: "#c45b5b",
      dangerSoft: "#fceeee",
      paper: "#faf6f2",
      paperWarm: "#f3ece4",
      surface: "#ffffff",
      ink: "#2d2926",
      muted: "#9a8e84",
      mutedLight: "#c4b8ae",
      line: "#e4dcd4",
      lineSoft: "#f0e8e0",
    },
    fonts: {
      display: '"Noto Serif SC", serif',
      body: '"Noto Sans SC", system-ui, sans-serif',
      mono: '"JetBrains Mono", monospace',
    },
    radius: {
      card: "16px",
      button: "8px",
      badge: "6px",
    },
    shadows: {
      card: "0 1px 8px rgba(45, 41, 38, 0.04)",
      cardHover: "0 6px 24px rgba(45, 41, 38, 0.07)",
    },
  },
];

// 默认主题
// 线上工作台当前使用薰衣草主题，本地首次打开时保持同一视觉基线。
export const defaultTheme = presetThemes.find((theme) => theme.id === "lavender") ?? presetThemes[0];

// 从 localStorage 读取主题
export function loadTheme(): ThemeConfig {
  if (typeof window === "undefined") return defaultTheme;
  const stored = window.localStorage.getItem("workbench-theme");
  if (!stored) return defaultTheme;
  try {
    const parsed = JSON.parse(stored) as ThemeConfig;
    // 验证是否是预设主题
    const preset = presetThemes.find((t) => t.id === parsed.id);
    if (preset) return preset;
    return parsed;
  } catch {
    return defaultTheme;
  }
}

// 保存主题到 localStorage
export function saveTheme(theme: ThemeConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("workbench-theme", JSON.stringify(theme));
}

// 应用主题到 CSS 变量
export function applyTheme(theme: ThemeConfig) {
  const root = document.documentElement;
  const c = theme.colors;

  root.style.setProperty("--color-primary", c.primary);
  root.style.setProperty("--color-primary-soft", c.primarySoft);
  root.style.setProperty("--color-primary-strong", c.primaryStrong);
  root.style.setProperty("--color-warning", c.warning);
  root.style.setProperty("--color-warning-soft", c.warningSoft);
  root.style.setProperty("--color-success", c.success);
  root.style.setProperty("--color-success-soft", c.successSoft);
  root.style.setProperty("--color-danger", c.danger);
  root.style.setProperty("--color-danger-soft", c.dangerSoft);
  root.style.setProperty("--color-paper", c.paper);
  root.style.setProperty("--color-paper-warm", c.paperWarm);
  root.style.setProperty("--color-surface", c.surface);
  root.style.setProperty("--color-ink", c.ink);
  root.style.setProperty("--color-muted", c.muted);
  root.style.setProperty("--color-muted-light", c.mutedLight);
  root.style.setProperty("--color-line", c.line);
  root.style.setProperty("--color-line-soft", c.lineSoft);

  root.style.setProperty("--font-display", theme.fonts.display);
  root.style.setProperty("--font-body", theme.fonts.body);
  root.style.setProperty("--font-mono", theme.fonts.mono);

  root.style.setProperty("--radius-card", theme.radius.card);
  root.style.setProperty("--radius-button", theme.radius.button);
  root.style.setProperty("--radius-badge", theme.radius.badge);

  root.style.setProperty("--shadow-card", theme.shadows.card);
  root.style.setProperty("--shadow-card-hover", theme.shadows.cardHover);
}
