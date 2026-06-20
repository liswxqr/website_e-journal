import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Loader } from "@/components/ui/Loader";
import * as usersApi from "@/api/users";
import * as classesApi from "@/api/classes";
import type { Role, SchoolClass, User } from "@/types";

const ROLES: { value: Role; label: string }[] = [
  { value: "admin", label: "Администратор" },
  { value: "teacher", label: "Преподаватель" },
  { value: "student", label: "Студент" },
];

// Локальная форма редактирования (вкл. поле пароля, которого нет в типе User)
interface UserForm extends Omit<User, "id"> {
  id?: string;
  password?: string;
}

const EMPTY: UserForm = {
  firstName: "",
  lastName: "",
  middleName: "",
  email: "",
  role: "student",
  groupId: undefined,
  password: "",
};

// Генератор читаемого случайного пароля
function generatePassword(length = 10): string {
  // Без неоднозначных символов (0/O, 1/l/I)
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length];
  return out;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [editing, setEditing] = useState<UserForm | null>(null);
  const [credentials, setCredentials] = useState<{ user: User; password: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    Promise.all([usersApi.listUsers(), classesApi.listClasses()]).then(([u, c]) => {
      setUsers(u);
      setClasses(c);
      setLoading(false);
    });
  };

  useEffect(reload, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter]);

  const classMap = new Map(classes.map((c) => [c.id, c]));

  function startCreate() {
    setError(null);
    setEditing({ ...EMPTY, password: generatePassword() });
  }

  function startEdit(u: User) {
    setError(null);
    setEditing({ ...u, password: "" });
  }

  async function save() {
    if (!editing) return;
    setError(null);
    setSaving(true);
    try {
      const isCreate = !editing.id;
      if (isCreate) {
        // Если поле пустое — бэк подставит дефолт. Лучше его заполнить.
        const password = editing.password?.trim() || generatePassword();
        const created = await usersApi.createUser({ ...editing, password } as any);
        setEditing(null);
        setCredentials({ user: created, password });
      } else {
        const payload: any = { ...editing };
        if (!payload.password) delete payload.password; // не сбрасываем если пусто
        await usersApi.updateUser(editing.id!, payload);
        if (editing.password) {
          setCredentials({ user: editing as unknown as User, password: editing.password });
        }
        setEditing(null);
      }
      reload();
    } catch (e) {
      setError((e as Error).message || "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Удалить пользователя?")) return;
    await usersApi.deleteUser(id);
    reload();
  }

  function resetPassword() {
    if (!editing) return;
    setEditing({ ...editing, password: generatePassword() });
  }

  if (loading) return <Loader />;

  const isCreating = editing !== null && !editing.id;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Пользователи</h1>
          <p>Управление администраторами, преподавателями и студентами.</p>
        </div>
        <Button onClick={startCreate}>+ Добавить пользователя</Button>
      </div>

      <div className="toolbar">
        <Input
          placeholder="Поиск по имени или email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          options={[{ value: "", label: "Все роли" }, ...ROLES]}
        />
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Email</th>
              <th>Роль</th>
              <th>Группа</th>
              <th style={{ textAlign: "right" }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">Ничего не найдено</td>
              </tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>
                    {u.lastName} {u.firstName} {u.middleName ?? ""}
                  </strong>
                </td>
                <td className="muted">{u.email}</td>
                <td>
                  <Badge variant={u.role === "admin" ? "danger" : u.role === "teacher" ? "primary" : "neutral"}>
                    {ROLES.find((r) => r.value === u.role)?.label}
                  </Badge>
                </td>
                <td>{u.groupId ? classMap.get(u.groupId)?.name ?? "—" : "—"}</td>
                <td className="table__actions">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(u)}>
                    Изменить
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => remove(u.id)}>
                    Удалить
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Форма создания / редактирования */}
      <Modal
        open={editing !== null}
        title={isCreating ? "Новый пользователь" : "Редактирование"}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Отмена</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Button>
          </>
        }
      >
        {editing && (
          <>
            <div className="grid-2">
              <Input
                label="Фамилия"
                value={editing.lastName}
                onChange={(e) => setEditing({ ...editing, lastName: e.target.value })}
              />
              <Input
                label="Имя"
                value={editing.firstName}
                onChange={(e) => setEditing({ ...editing, firstName: e.target.value })}
              />
            </div>
            <Input
              label="Отчество"
              value={editing.middleName ?? ""}
              onChange={(e) => setEditing({ ...editing, middleName: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              value={editing.email}
              onChange={(e) => setEditing({ ...editing, email: e.target.value })}
            />
            <div className="grid-2">
              <Select
                label="Роль"
                value={editing.role}
                onChange={(e) => setEditing({ ...editing, role: e.target.value as Role })}
                options={ROLES}
              />
              {editing.role === "student" && (
                <Select
                  label="Группа"
                  value={editing.groupId ?? ""}
                  onChange={(e) => setEditing({ ...editing, groupId: e.target.value || undefined })}
                  options={[{ value: "", label: "—" }, ...classes.map((c) => ({ value: c.id, label: c.name }))]}
                />
              )}
            </div>

            <div className="field">
              <label className="field__label">
                {isCreating ? "Пароль" : "Новый пароль (оставьте пустым, чтобы не менять)"}
              </label>
              <div className="row gap-12">
                <input
                  className="input flex-1"
                  type="text"
                  value={editing.password ?? ""}
                  placeholder={isCreating ? "Будет сгенерирован" : "не менять"}
                  onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                />
                <Button type="button" variant="secondary" size="sm" onClick={resetPassword}>
                  🎲 Сгенерировать
                </Button>
              </div>
              <div className="field__hint">
                Пароль показывается в открытом виде — после сохранения вы сможете его скопировать
                и передать пользователю.
              </div>
            </div>

            {error && (
              <div style={{ background: "var(--danger-bg)", color: "var(--danger)", padding: 10, borderRadius: 8, fontSize: 13 }}>
                {error}
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Окно с учётными данными после создания / сброса */}
      <Modal
        open={!!credentials}
        title={isCreating ? "Пользователь создан" : "Пароль обновлён"}
        onClose={() => setCredentials(null)}
        footer={
          <Button onClick={() => setCredentials(null)}>Готово</Button>
        }
      >
        {credentials && (
          <>
            <p style={{ marginBottom: 8 }}>
              Передайте эти данные пользователю — пароль больше нигде не отобразится.
            </p>
            <div className="credentials-card">
              <div className="credentials-row">
                <span className="credentials-label">ФИО</span>
                <span>{credentials.user.lastName} {credentials.user.firstName}</span>
              </div>
              <div className="credentials-row">
                <span className="credentials-label">Email</span>
                <code>{credentials.user.email}</code>
              </div>
              <div className="credentials-row">
                <span className="credentials-label">Пароль</span>
                <code className="credentials-pwd">{credentials.password}</code>
              </div>
            </div>
            <Button
              variant="secondary"
              block
              onClick={() => {
                const text = `Email: ${credentials.user.email}\nПароль: ${credentials.password}`;
                navigator.clipboard.writeText(text);
              }}
            >
              📋 Скопировать в буфер обмена
            </Button>
          </>
        )}
      </Modal>
    </>
  );
}
