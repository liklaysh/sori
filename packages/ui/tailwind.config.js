/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "../../apps/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Sori Semantic System
        "sori-surface": {
          base: "var(--sori-surface-base)",
          panel: "var(--sori-surface-panel)",
          main: "var(--sori-surface-main)",
          elevated: "var(--sori-surface-elevated)",
          hover: "var(--sori-surface-hover)",
          active: "var(--sori-surface-active)",
          selected: "var(--sori-surface-selected)",
          "accent-subtle": "var(--sori-surface-accent-subtle)",
          "danger-subtle": "var(--sori-surface-danger-subtle)",
          "success-subtle": "var(--sori-surface-success-subtle)",
          "warning-subtle": "var(--sori-surface-warning-subtle)",
          overlay: "var(--sori-surface-overlay)",
        },
        "sori-border": {
          subtle: "var(--sori-border-subtle)",
          medium: "var(--sori-border-medium)",
          strong: "var(--sori-border-strong)",
          accent: "var(--sori-border-accent)",
          danger: "var(--sori-border-danger)",
        },
        "sori-text": {
          primary: "var(--sori-text-primary)",
          muted: "var(--sori-text-muted)",
          dim: "var(--sori-text-dim)",
          strong: "var(--sori-text-strong)",
        },
        "sori-accent": {
          primary: "var(--sori-accent-primary)",
          secondary: "var(--sori-accent-secondary)",
          danger: "var(--sori-accent-danger)",
          success: "var(--sori-accent-success)",
          warning: "var(--sori-accent-warning)",
        },

        // Subtle Helpers
        "sori-accent-primary-subtle": "var(--sori-accent-primary-subtle)",
        "sori-accent-soft": "var(--sori-accent-soft)",
        "sori-accent-secondary-subtle": "var(--sori-accent-secondary-subtle)",
        "sori-accent-danger-subtle": "var(--sori-accent-danger-subtle)",
        "sori-accent-success-subtle": "var(--sori-accent-success-subtle)",
        "sori-accent-warning-subtle": "var(--sori-accent-warning-subtle)",
        "sori-chat-bubble-me": "var(--sori-chat-bubble-me)",
        "sori-chat-bubble-me-border": "var(--sori-chat-bubble-me-border)",

      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        headline: ["Manrope", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
