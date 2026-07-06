import { useEffect, useState } from "react";
import logoDark from "@/assets/logo-dark.png";
import logoLight from "@/assets/logo-light.png";
import { strings } from "@/lib/i18n/ar";
export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains("dark-theme"),
  );

  useEffect(() => {
    // Initial maximized state
    window.api.windowControls.isMaximized().then(setIsMaximized);

    // Sync via IPC push events (reliable across double-click, snap, etc.)
    const unsubscribe =
      window.api.windowControls.onMaximizeChange(setIsMaximized);

    // Sync theme
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark-theme"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      unsubscribe();
      observer.disconnect();
    };
  }, []);

  const drag = { WebkitAppRegion: "drag" } as React.CSSProperties;
  const noDrag = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

  return (
    <div
      style={{
        ...drag,
        height: "var(--titlebar-height)",
        minHeight: "var(--titlebar-height)",
        display: "flex",
        alignItems: "stretch",
        background: "var(--titlebar-bg)",
        borderBottom: "1px solid var(--titlebar-border)",
        flexShrink: 0,
        userSelect: "none",
        zIndex: 9999,
        position: "relative",
      }}
    >
      {/* Luxury accent line at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "1.5px",
          background:
            "linear-gradient(90deg, transparent 0%, var(--titlebar-accent-line) 20%, var(--titlebar-accent-line) 80%, transparent 100%)",
          opacity: 0.5,
          pointerEvents: "none",
        }}
      />

      {/* Top highlight for glass depth */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background:
            "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.08) 30%, hsl(0 0% 100% / 0.08) 70%, transparent)",
          pointerEvents: "none",
        }}
      />

      {/* ── Window Controls — physical left, Windows order: — □ × ── */}
      <div
        style={{
          ...noDrag,
          display: "flex",
          alignItems: "stretch",
          flexShrink: 0,
        }}
      >
        {/* Close */}
        <button
          className="title-btn title-btn--close"
          onClick={() => window.api.windowControls.close()}
          title={strings.layout.close}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <line
              x1="1.75"
              y1="1.75"
              x2="10.25"
              y2="10.25"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="10.25"
              y1="1.75"
              x2="1.75"
              y2="10.25"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* Maximize / Restore */}
        <button
          className="title-btn"
          onClick={() => {
            window.api.windowControls.maximize();
            setIsMaximized((m) => !m);
          }}
          title={isMaximized ? strings.layout.restore : strings.layout.maximize}
        >
          {isMaximized ? (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <rect
                x="2.5"
                y="0.75"
                width="7.75"
                height="7.75"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.25"
              />
              <rect
                x="0.75"
                y="2.5"
                width="7.75"
                height="7.75"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.25"
                fill="var(--titlebar-bg)"
              />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <rect
                x="0.75"
                y="0.75"
                width="9.5"
                height="9.5"
                rx="1.25"
                stroke="currentColor"
                strokeWidth="1.25"
              />
            </svg>
          )}
        </button>

        {/* Minimize */}
        <button
          className="title-btn"
          onClick={() => window.api.windowControls.minimize()}
          title={strings.layout.minimize}
        >
          <svg width="12" height="2" viewBox="0 0 12 2" fill="none">
            <rect width="12" height="1.5" rx="0.75" fill="currentColor" />
          </svg>
        </button>

        {/* Separator */}
        <div
          style={{
            width: "1px",
            margin: "9px 6px",
            background: "var(--titlebar-separator)",
            flexShrink: 0,
          }}
        />
      </div>

      {/* ── Center drag fill ── */}
      <div style={{ flex: 1, ...drag }} />

      {/* ── Brand block — physical right ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          paddingRight: "16px",
          paddingLeft: "14px",
          flexShrink: 0,
        }}
      >
        {/* Separator */}
        <div
          style={{
            width: "1px",
            height: "20px",
            background: "var(--titlebar-separator)",
            flexShrink: 0,
          }}
        />

        {/* Text block */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span
            style={{
              fontSize: "12.5px",
              fontWeight: 700,
              color: "var(--titlebar-text)",
              letterSpacing: "0.05em",
              lineHeight: 1,
              fontFamily: "inherit",
            }}
          >
            {strings.app.title}
          </span>
        </div>
      </div>
    </div>
  );
}
