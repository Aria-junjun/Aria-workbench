import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--color-ink)",
        paper: "var(--color-paper)",
        "paper-warm": "var(--color-paper-warm)",
        line: "var(--color-line)",
        "line-soft": "var(--color-line-soft)",
        action: "var(--color-primary)",
        "action-soft": "var(--color-primary-soft)",
        "action-strong": "var(--color-primary-strong)",
        warning: "var(--color-warning)",
        "warning-soft": "var(--color-warning-soft)",
        success: "var(--color-success)",
        "success-soft": "var(--color-success-soft)",
        danger: "var(--color-danger)",
        "danger-soft": "var(--color-danger-soft)",
        muted: "var(--color-muted)",
        "muted-light": "var(--color-muted-light)",
        surface: "var(--color-surface)",
        "surface-warm": "var(--color-paper-warm)",
        cream: "var(--color-paper-warm)",
        blush: "var(--color-primary-soft)",
        sage: "var(--color-success-soft)"
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '"Quicksand"', 'system-ui', 'sans-serif'],
        serif: ['"Noto Serif SC"', '"Playfair Display"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['"Playfair Display"', '"Noto Serif SC"', 'serif'],
        rounded: ['"Quicksand"', '"Noto Sans SC"', 'sans-serif']
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        "card-elevated": "0 16px 48px rgba(45, 42, 38, 0.12)",
        subtle: "0 1px 3px rgba(45, 42, 38, 0.04)",
        glow: "0 0 24px color-mix(in srgb, var(--color-primary) 14%, transparent)",
        "glow-warm": "0 0 24px color-mix(in srgb, var(--color-warning) 12%, transparent)"
      },
      borderRadius: {
        xl: "16px",
        "2xl": "20px",
        "3xl": "var(--radius-card)"
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
        bouncy: "cubic-bezier(0.34, 1.56, 0.64, 1)"
      },
      animation: {
        "fade-up": "fadeUp 0.6s ease-out forwards",
        "fade-in": "fadeIn 0.4s ease-out forwards",
        "slide-in": "slideIn 0.5s ease-out forwards",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite"
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(-12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" }
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" }
        }
      }
    }
  },
  plugins: []
};

export default config;
