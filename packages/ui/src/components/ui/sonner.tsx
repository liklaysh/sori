import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-sori-surface-main group-[.toaster]:text-sori-text-primary group-[.toaster]:border-sori-border-medium group-[.toaster]:shadow-2xl group-[.toaster]:rounded-xl group-[.toaster]:border-[1.5px] group-[.toaster]:border-sori-border-accent",
          description: "group-[.toast]:text-sori-text-muted",
          actionButton:
            "group-[.toast]:bg-sori-accent-primary group-[.toast]:text-black",
          cancelButton:
            "group-[.toast]:bg-sori-surface-active group-[.toast]:text-sori-text-muted",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
