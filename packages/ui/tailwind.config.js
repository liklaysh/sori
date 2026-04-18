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
        "sori-primary-subtle": "var(--sori-primary-subtle)",
        "sori-secondary-subtle": "var(--sori-secondary-subtle)",
        "sori-error-subtle": "var(--sori-error-subtle)",
        "sori-success-subtle": "var(--sori-success-subtle)",
        "sori-warning-subtle": "var(--sori-warning-subtle)",

        // Legacy/Direct mappings for transition (mapped to semantic tokens)
        "sori-primary": "var(--sori-accent-primary)",
        "sori-secondary": "var(--sori-accent-secondary)",
        "sori-error": "var(--sori-accent-danger)",
        "sori-success": "var(--sori-accent-success)",
        "sori-warning": "var(--sori-accent-warning)",
        "sori-chat": "var(--sori-surface-main)",
        "sori-sidebar": "var(--sori-surface-panel)",
        "sori-server": "var(--sori-surface-base)",
        "sori-right": "var(--sori-surface-panel)",
        "sori-voice": "var(--sori-surface-elevated)",
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
