import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import * as authApi from "@/api/auth";
import * as subjectsApi from "@/api/subjects";
import * as classesApi from "@/api/classes";
import { streamLabel, streamFull } from "@/types";
import type { Subject, SchoolClass } from "@/types";

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
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<SchoolClass[]>([]);

  useEffect(() => {
    if (user?.role !== "student") return;
    Promise.all([subjectsApi.listSubjects(), classesApi.listClasses()]).then(([s, g]) => {
      setSubjects(s);
      setGroups(g);
    });
  }, [user]);

  if (!user) return null;

  // Предметы потока: предметы выбранного потока + общие (stream = null)
  const streamSubjects = subjects.filter(
    (s) => (user.stream && s.stream === user.stream) || !s.stream
  );
  const groupName = user.groupId ? groups.find((g) => g.id === user.groupId)?.name : null;

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
            {user.role === "student" && (
              <>
                <div className="profile-field">
                  <span className="profile-field__label">Группа</span>
                  <span>{groupName ?? "—"}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-field__label">Поток</span>
                  <span>
                    {user.stream ? (
                      <Badge variant="primary">{streamLabel(user.stream)}</Badge>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              </>
            )}
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

      {user.role === "student" && (
        <div className="mt-24">
          <Card
            title={
              <span>
                Предметы потока{" "}
                {user.stream && <Badge variant="primary">{streamLabel(user.stream)}</Badge>}
              </span>
            }
          >
            {!user.stream ? (
              <div className="empty">
                Поток не назначен. Обратитесь к администратору, чтобы выбрать специальность.
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, marginBottom: 14 }}>
                  {streamFull(user.stream)}. Дисциплины вашей специальности и общие предметы:
                </p>
                <div className="stream-subjects">
                  {streamSubjects.map((s) => (
                    <div key={s.id} className="stream-subject">
                      <span className="stream-subject__name">{s.name}</span>
                      <Badge variant={s.stream ? "primary" : "neutral"}>
                        {s.stream ? streamLabel(s.stream) : "общий"}
                      </Badge>
                    </div>
                  ))}
                  {streamSubjects.length === 0 && (
                    <div className="empty">Предметы не заданы.</div>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
