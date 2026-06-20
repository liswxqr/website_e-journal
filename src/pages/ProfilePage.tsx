import { FormEvent, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import * as authApi from "@/api/auth";

function roleLabel(r: string) {
  return r === "admin" ? "Администратор" : r === "teacher" ? "Преподаватель" : "Студент";
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (next.length < 4) {
      setStatus({ type: "err", text: "Новый пароль должен быть не короче 4 символов" });
      return;
    }
    if (next !== confirm) {
      setStatus({ type: "err", text: "Пароли не совпадают" });
      return;
    }

    setSaving(true);
    try {
      await authApi.changePassword(current, next);
      setStatus({ type: "ok", text: "Пароль успешно изменён" });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setStatus({ type: "err", text: (err as Error).message || "Не удалось изменить пароль" });
    } finally {
      setSaving(false);
    }
  }

  const initials = (user.firstName[0] ?? "") + (user.lastName[0] ?? "");

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Профиль</h1>
          <p>Ваши данные и настройки безопасности.</p>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <Card title="Личные данные">
          <div className="profile-head">
            <div className="avatar avatar--lg">{initials.toUpperCase()}</div>
            <div>
              <div className="profile-name">
                {user.lastName} {user.firstName} {user.middleName ?? ""}
              </div>
              <Badge variant={user.role === "admin" ? "danger" : user.role === "teacher" ? "primary" : "neutral"}>
                {roleLabel(user.role)}
              </Badge>
            </div>
          </div>

          <div className="profile-fields">
            <div className="profile-field">
              <span className="profile-field__label">Email</span>
              <span>{user.email}</span>
            </div>
            <div className="profile-field">
              <span className="profile-field__label">Роль</span>
              <span>{roleLabel(user.role)}</span>
            </div>
            <div className="profile-field">
              <span className="profile-field__label">ID</span>
              <code style={{ fontSize: 12 }}>{user.id}</code>
            </div>
          </div>
        </Card>

        <Card title="Смена пароля">
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input
              label="Текущий пароль"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
            <Input
              label="Новый пароль"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              required
            />
            <Input
              label="Повторите новый пароль"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />

            {status && (
              <div
                style={{
                  padding: 10,
                  borderRadius: 8,
                  fontSize: 13,
                  background: status.type === "ok" ? "var(--success-bg)" : "var(--danger-bg)",
                  color: status.type === "ok" ? "var(--success)" : "var(--danger)",
                }}
              >
                {status.text}
              </div>
            )}

            <Button type="submit" disabled={saving}>
              {saving ? "Сохранение…" : "Изменить пароль"}
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
