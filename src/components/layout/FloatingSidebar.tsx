import { cn } from "@/lib/utils";
import { sidebar as sidebarStyles } from "@/lib/theme/styles";
import type { NavItem, NavTabId } from "@/lib/config/navigation";
import { strings } from "@/lib/i18n/ar";
interface FloatingSidebarProps {
  items: NavItem[];
  activeTab: NavTabId;
  onTabChange: (id: NavTabId) => void;
}
export function FloatingSidebar({
  items,
  activeTab,
  onTabChange,
}: FloatingSidebarProps) {
  return (
    <aside
      className={cn(sidebarStyles.container, "right-4 left-auto")}
      aria-label={strings.common.mainNav}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            className={cn(
              sidebarStyles.item,
              isActive && sidebarStyles.itemActive,
            )}
            title={item.label}
          >
            <Icon
              className="h-5 w-5 shrink-0"
              strokeWidth={isActive ? 2.25 : 1.75}
            />
            <span className={sidebarStyles.label}>{item.label}</span>
          </button>
        );
      })}
    </aside>
  );
}
