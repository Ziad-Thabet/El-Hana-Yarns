import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import { strings } from "@/lib/i18n/ar";
import { buttons } from "@/lib/theme/styles";
import { cn } from "@/lib/utils";
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className={cn(buttons.icon, "border-border bg-card hover:bg-muted/60")}
      title={theme === "dark" ? strings.theme.toLight : strings.theme.toDark}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4 text-accent" />
      ) : (
        <Moon className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  );
}
