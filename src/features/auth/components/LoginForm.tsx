import { useState, type FormEvent, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { PremiumButton } from "@/components/ui/premium";
import { strings } from "@/lib/i18n/ar";
import { cards, typography } from "@/lib/theme/styles";
import { cn } from "@/lib/utils";
import { useLogin } from "@/features/auth/hooks";

interface LoginFormProps {
  brandIcon: ReactNode;
  onSuccess: () => void;
}

export function LoginForm({ brandIcon, onSuccess }: LoginFormProps) {
  const login = useLogin();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login.mutateAsync(form);
      onSuccess();
    } catch (err) {
      setError((err as Error).message || strings.auth.loginError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      className={cn(cards.elevated, "w-full max-w-sm")}
      style={{
        background: "hsl(var(--card))",
        boxShadow: "var(--shadow-elevated), 0 0 0 1px hsl(var(--border))",
        borderRadius: "var(--radius-xl)",
        overflow: "hidden",
      }}
    >
      {/* Luxury top accent bar */}
      <div
        style={{
          height: "3px",
          background:
            "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary)))",
          opacity: 0.85,
        }}
      />

      <div style={{ padding: "2rem 2rem 2.25rem" }}>
        {/* Brand header */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "2rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "20px",
              overflow: "hidden",
              boxShadow:
                "0 6px 24px hsl(var(--primary) / 0.3), 0 0 0 1px hsl(var(--border))",
              flexShrink: 0,
            }}
          >
            {brandIcon}
          </div>
          <div>
            <h1
              style={{
                fontSize: "1.35rem",
                fontWeight: 700,
                color: "hsl(var(--foreground))",
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              {strings.app.loginTitle}
            </h1>
            <p
              style={{
                fontSize: "0.8rem",
                color: "hsl(var(--muted-foreground))",
                marginTop: "0.3rem",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              El-Hana Yarns
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-sm font-semibold">
              {strings.auth.username}
            </Label>
            <Input
              id="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder={strings.auth.usernamePlaceholder}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-semibold">
              {strings.auth.password}
            </Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={strings.auth.passwordPlaceholder}
              required
            />
          </div>

          {error && (
            <div className="rounded-[var(--radius-lg)] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <PremiumButton
            type="submit"
            className="w-full py-3 mt-2"
            disabled={loading}
            style={{ marginTop: "1.25rem" }}
          >
            {loading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
            {strings.auth.submit}
          </PremiumButton>
        </form>
      </div>
    </Card>
  );
}

export default LoginForm;
