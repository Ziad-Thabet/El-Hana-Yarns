import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { surfaces } from "@/lib/theme/styles";
import { TitleBar } from "./TitleBar";
interface AppShellProps {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
  className?: string;
}
export function AppShell({
  sidebar,
  header,
  children,
  className,
}: AppShellProps) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <TitleBar />
      <div
        className={cn(
          surfaces.shell,
          className,
          "flex-1 min-h-0 overflow-hidden",
        )}
      >
        {sidebar}
        <div className={cn(surfaces.main, "mr-[5.75rem]")}>
          {header}
          <main className={surfaces.content}>{children}</main>
        </div>
      </div>
    </div>
  );
}
