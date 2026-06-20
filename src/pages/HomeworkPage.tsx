import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Loader } from "@/components/ui/Loader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import * as homeworkApi from "@/api/homework";
import * as subjectsApi from "@/api/subjects";
import * as classesApi from "@/api/classes";
import * as scheduleApi from "@/api/schedule";
import type { Homework, ScheduleEntry, SchoolClass, Subject } from "@/types";

interface HwForm {
  id?: string;
  groupId: string;
  subjectId: string;
  title: string;
  description: string;
  dueDate: string;
}

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function daysLeft(iso: string): number {
  const due = new Date(iso + "T23:59:59");
  return Math.ceil((due.getTime() - Date.now()) / 86400000);
}

export default function HomeworkPage() {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher" || user?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [editing, setEditing] = useState<HwForm | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = () => homeworkApi.listHomework().then(setHomework);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      homeworkApi.listHomework(),
      subjectsApi.listSubjects(),
      classesApi.listClasses(),
      isTeacher ? scheduleApi.listSchedule({ teacherId: user.id }) : Promise.resolve([]),
    ]).then(([hw, su, cl, sch]) => {
      setHomework(hw);
      setSubjects(su);
      setClasses(cl);
      setSchedule(sch);
      setLoading(false);
    });
  }, [user]);

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  // для препода — только его группы/предметы из расписания
  const teacherGroups = useMemo(() => {
    const ids = Array.from(new Set(schedule.map((s) => s.groupId)));
    const list = classes.filter((c) => ids.includes(c.id));
    return list.length ? list : classes;
  }, [schedule, classes]);

  const teacherSubjects = useMemo(() => {
    const ids = Array.from(new Set(schedule.map((s) => s.subjectId)));
    const list = subjects.filter((s) => ids.includes(s.id));
    return list.length ? list : subjects;
  }, [schedule, subjects]);

  function startCreate() {
    setEditing({
      groupId: teacherGroups[0]?.id ?? "",
      subjectId: teacherSubjects[0]?.id ?? "",
      title: "",
      description: "",
      dueDate: todayPlus(7),
    });
  }

  function startEdit(h: Homework) {
    setEditing({
      id: h.id,
      groupId: h.groupId,
      subjectId: h.subjectId,
      title: h.title,
      description: h.description ?? "",
      dueDate: h.dueDate,
    });
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      await homeworkApi.upsertHomework({
        id: editing.id,
        groupId: editing.groupId,
        subjectId: editing.subjectId,
        teacherId: user!.id,
        title: editing.title,
        description: editing.description || null,
        dueDate: editing.dueDate,
      });
      await reload();
      setEditing(null);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Удалить задание?")) return;
    await homeworkApi.deleteHomework(id);
    reload();
  }

  if (loading) return <Loader />;

  const sorted = homework.slice().sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Домашние задания</h1>
          <p>
            {isTeacher
              ? "Задания, которые вы назначили группам."
              : "Актуальные задания вашей группы. Не пропустите дедлайны!"}
          </p>
        </div>
        {isTeacher && <Button onClick={startCreate}>+ Новое задание</Button>}
      </div>

      {sorted.length === 0 ? (
        <div className="empty">
          {isTeacher ? "Вы пока не назначили заданий." : "Заданий пока нет 🎉"}
        </div>
      ) : (
        <div className="hw-grid">
          {sorted.map((h) => {
            const left = daysLeft(h.dueDate);
            const overdue = left < 0;
            const soon = left >= 0 && left <= 2;
            return (
              <Card key={h.id}>
                <div className="hw-card__top">
                  <Badge variant="primary">{subjectMap.get(h.subjectId)?.name ?? "—"}</Badge>
                  {isTeacher ? (
                    <Badge variant="neutral">{classMap.get(h.groupId)?.name ?? "—"}</Badge>
                  ) : (
                    <Badge variant={overdue ? "danger" : soon ? "warning" : "success"}>
                      {overdue
                        ? "Просрочено"
                        : left === 0
                        ? "Сегодня"
                        : `Осталось ${left} дн.`}
                    </Badge>
                  )}
                </div>
                <h3 className="hw-card__title">{h.title}</h3>
                {h.description && <p className="hw-card__desc">{h.description}</p>}
                <div className="hw-card__foot">
                  <span className="muted">
                    📅 Сдать до <strong>{formatDate(h.dueDate)}</strong>
                  </span>
                  {isTeacher && (
                    <div className="row gap-12">
                      <button className="hw-link" onClick={() => startEdit(h)}>
                        Изменить
                      </button>
                      <button className="hw-link hw-link--danger" onClick={() => remove(h.id)}>
                        Удалить
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={!!editing}
        title={editing?.id ? "Редактирование задания" : "Новое задание"}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Отмена</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          </>
        }
      >
        {editing && (
          <>
            <div className="grid-2">
              <Select
                label="Группа"
                value={editing.groupId}
                onChange={(e) => setEditing({ ...editing, groupId: e.target.value })}
                options={teacherGroups.map((c) => ({ value: c.id, label: c.name }))}
              />
              <Select
                label="Предмет"
                value={editing.subjectId}
                onChange={(e) => setEditing({ ...editing, subjectId: e.target.value })}
                options={teacherSubjects.map((s) => ({ value: s.id, label: s.name }))}
              />
            </div>
            <Input
              label="Заголовок"
              value={editing.title}
              placeholder="Например: Решить задачи №12–18"
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            />
            <div className="field">
              <label className="field__label">Описание</label>
              <textarea
                className="textarea"
                value={editing.description}
                placeholder="Подробности задания (необязательно)"
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </div>
            <Input
              label="Срок сдачи"
              type="date"
              value={editing.dueDate}
              onChange={(e) => setEditing({ ...editing, dueDate: e.target.value })}
            />
          </>
        )}
      </Modal>
    </>
  );
}
