import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Loader } from "@/components/ui/Loader";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import * as classesApi from "@/api/classes";
import * as subjectsApi from "@/api/subjects";
import * as usersApi from "@/api/users";
import * as gradesApi from "@/api/grades";
import * as assessmentsApi from "@/api/assessments";
import * as scheduleApi from "@/api/schedule";
import { downloadCsv, printHtml } from "@/utils/export";
import type {
  Assessment,
  Grade,
  GradeValue,
  ScheduleEntry,
  SchoolClass,
  Subject,
  User,
} from "@/types";

type Mode = "grades" | "assessments";

function parseGrade(raw: string): GradeValue | null {
  const v = raw.trim();
  if (v === "") return "";
  if (v.toUpperCase() === "Н" || v.toUpperCase() === "H") return "Н";
  const n = Number(v);
  if (Number.isInteger(n) && n >= 1 && n <= 10) return n;
  return null;
}

function gradeClass(v: GradeValue): string {
  if (v === "Н") return "g-n";
  if (typeof v !== "number") return "";
  if (v >= 8) return "g-high";
  if (v >= 6) return "g-good";
  if (v >= 4) return "g-mid";
  return "g-low";
}

export default function GradebookPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("grades");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      classesApi.listClasses(),
      subjectsApi.listSubjects(),
      usersApi.listUsers("student"),
      scheduleApi.listSchedule({ teacherId: user.id }),
    ]).then(([c, s, st, sch]) => {
      setClasses(c);
      setSubjects(s);
      setStudents(st);
      setSchedule(sch);
      const firstGroup = sch[0]?.groupId ?? c[0]?.id ?? "";
      const firstSubject = sch[0]?.subjectId ?? user.subjectIds?.[0] ?? s[0]?.id ?? "";
      setGroupId(firstGroup);
      setSubjectId(firstSubject);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!groupId || !subjectId) return;
    if (mode === "grades") {
      gradesApi.listGrades({ groupId, subjectId }).then(setGrades);
    } else {
      assessmentsApi.listAssessments({ groupId, subjectId }).then(setAssessments);
    }
  }, [groupId, subjectId, mode]);

  const myGroupOptions = useMemo(() => {
    const ids = Array.from(new Set(schedule.map((s) => s.groupId)));
    const list = classes.filter((c) => ids.includes(c.id));
    return (list.length ? list : classes).map((c) => ({ value: c.id, label: c.name }));
  }, [schedule, classes]);

  const mySubjectOptions = useMemo(() => {
    const ids = Array.from(new Set(schedule.map((s) => s.subjectId)));
    const list = subjects.filter((s) => ids.includes(s.id));
    return (list.length ? list : subjects).map((s) => ({ value: s.id, label: s.name }));
  }, [schedule, subjects]);

  const dates = useMemo(() => {
    const arr: string[] = [];
    const d = new Date();
    while (arr.length < 10) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) arr.unshift(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() - 1);
    }
    return arr;
  }, []);

  const currentGroup = classes.find((c) => c.id === groupId);
  const groupStudents = students.filter((s) => currentGroup?.studentIds.includes(s.id));

  const gradeFor = (studentId: string, date: string) =>
    grades.find((g) => g.studentId === studentId && g.date === date);

  async function saveGrade(studentId: string, date: string, raw: string) {
    const parsed = parseGrade(raw);
    if (parsed === null) return;
    const existing = gradeFor(studentId, date);
    setSaving(true);
    try {
      if (parsed === "" && existing) {
        await gradesApi.deleteGrade(existing.id);
      } else if (parsed !== "") {
        await gradesApi.upsertGrade({
          id: existing?.id,
          studentId,
          subjectId,
          groupId,
          teacherId: user!.id,
          date,
          value: parsed,
        });
      }
      const fresh = await gradesApi.listGrades({ groupId, subjectId });
      setGrades(fresh);
    } finally {
      setSaving(false);
    }
  }

  function average(studentId: string): string {
    const nums = grades
      .filter((g) => g.studentId === studentId && typeof g.value === "number" && (g.value as number) > 0)
      .map((g) => g.value as number);
    if (!nums.length) return "—";
    return (nums.reduce((s, v) => s + v, 0) / nums.length).toFixed(2);
  }

  const latestAssessmentFor = (studentId: string) =>
    assessments
      .filter((a) => a.studentId === studentId)
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0];

  async function toggleAssessment(studentId: string, current?: Assessment) {
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await assessmentsApi.upsertAssessment({
        id: current?.id,
        studentId,
        subjectId,
        groupId,
        teacherId: user!.id,
        date: current?.date ?? today,
        passed: !(current?.passed ?? false),
      });
      const fresh = await assessmentsApi.listAssessments({ groupId, subjectId });
      setAssessments(fresh);
    } finally {
      setSaving(false);
    }
  }

  async function clearAssessment(a: Assessment) {
    setSaving(true);
    try {
      await assessmentsApi.deleteAssessment(a.id);
      const fresh = await assessmentsApi.listAssessments({ groupId, subjectId });
      setAssessments(fresh);
    } finally {
      setSaving(false);
    }
  }

  // === Экспорт ===
  function exportMeta() {
    const groupName = classes.find((c) => c.id === groupId)?.name ?? "";
    const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? "";
    return { groupName, subjectName };
  }

  function buildGradeRows(): (string | number)[][] {
    const header = ["Студент", ...dates.map((d) => `${d.slice(8, 10)}.${d.slice(5, 7)}`), "Средний"];
    const body = groupStudents.map((s) => {
      const row: (string | number)[] = [`${s.lastName} ${s.firstName}`];
      for (const d of dates) {
        const v = gradeFor(s.id, d)?.value;
        row.push(v === "Н" ? "Н" : typeof v === "number" && v > 0 ? v : "");
      }
      row.push(average(s.id));
      return row;
    });
    return [header, ...body];
  }

  function exportCsv() {
    const { groupName, subjectName } = exportMeta();
    downloadCsv(`Журнал_${groupName}_${subjectName}`, buildGradeRows());
  }

  function exportPdf() {
    const { groupName, subjectName } = exportMeta();
    const rows = buildGradeRows();
    const head = rows[0]
      .map((c, i) => `<th class="${i === 0 ? "name" : ""}">${c}</th>`)
      .join("");
    const bodyRows = rows
      .slice(1)
      .map(
        (r) =>
          "<tr>" +
          r.map((c, i) => `<td class="${i === 0 ? "name" : ""}">${c}</td>`).join("") +
          "</tr>"
      )
      .join("");
    const html = `
      <h1>Журнал оценок — группа ${groupName}</h1>
      <div class="meta">Предмет: ${subjectName} · Дата формирования: ${new Date().toLocaleDateString("ru-RU")}</div>
      <table><thead><tr>${head}</tr></thead><tbody>${bodyRows}</tbody></table>`;
    printHtml(`Журнал ${groupName} ${subjectName}`, html);
  }

  if (loading) return <Loader />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Журнал {mode === "grades" ? "оценок" : "зачётов"}</h1>
          <p>
            {mode === "grades"
              ? "Кликните по ячейке. Допустимы: 1–10 или «Н» (не был)."
              : "Кликните по кнопке, чтобы выставить или снять зачёт."}
          </p>
        </div>
        {saving && <span className="muted">Сохранение…</span>}
      </div>

      <div className="toolbar">
        <Select label="Группа" value={groupId} onChange={(e) => setGroupId(e.target.value)} options={myGroupOptions} />
        <Select label="Предмет" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} options={mySubjectOptions} />
        <div className="flex-1" />
        {mode === "grades" && groupStudents.length > 0 && (
          <div className="row gap-12">
            <Button variant="secondary" size="sm" onClick={exportCsv} title="Скачать таблицу для Excel">
              ⬇ Excel
            </Button>
            <Button variant="secondary" size="sm" onClick={exportPdf} title="Печать / сохранить в PDF">
              🖨 PDF
            </Button>
          </div>
        )}
        <div className="row gap-12">
          <Button variant={mode === "grades" ? "primary" : "ghost"} size="sm" onClick={() => setMode("grades")}>
            Оценки
          </Button>
          <Button variant={mode === "assessments" ? "primary" : "ghost"} size="sm" onClick={() => setMode("assessments")}>
            Зачёты
          </Button>
        </div>
      </div>

      {groupStudents.length === 0 ? (
        <div className="empty">В этой группе нет студентов.</div>
      ) : mode === "grades" ? (
        <div className="gradebook">
          <table>
            <thead>
              <tr>
                <th className="student-cell">Студент</th>
                {dates.map((d) => (
                  <th key={d}>{d.slice(8, 10)}.{d.slice(5, 7)}</th>
                ))}
                <th>Средн.</th>
              </tr>
            </thead>
            <tbody>
              {groupStudents.map((s) => (
                <tr key={s.id}>
                  <td className="student-cell">{s.lastName} {s.firstName}</td>
                  {dates.map((d) => {
                    const g = gradeFor(s.id, d);
                    const val = g?.value;
                    const display = val === "Н" ? "Н" : typeof val === "number" && val > 0 ? String(val) : "";
                    return (
                      <td key={d} className="grade-cell" style={{ width: 64 }}>
                        <input
                          className={`grade-input ${gradeClass(val ?? "")}`}
                          defaultValue={display}
                          maxLength={2}
                          onBlur={(e) => {
                            if (e.target.value !== display) saveGrade(s.id, d, e.target.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                        />
                      </td>
                    );
                  })}
                  <td style={{ fontWeight: 700, color: "var(--primary-700)" }}>{average(s.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Студент</th>
                <th>Дата</th>
                <th>Статус</th>
                <th style={{ textAlign: "right" }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {groupStudents.map((s) => {
                const a = latestAssessmentFor(s.id);
                return (
                  <tr key={s.id}>
                    <td><strong>{s.lastName} {s.firstName}</strong></td>
                    <td className="muted">{a ? formatDate(a.date) : "—"}</td>
                    <td>
                      {a ? (
                        <span className={`badge ${a.passed ? "badge--success" : "badge--danger"}`}>
                          {a.passed ? "Зачёт" : "Незачёт"}
                        </span>
                      ) : (
                        <span className="muted">не выставлен</span>
                      )}
                    </td>
                    <td className="table__actions">
                      <Button size="sm" variant={a?.passed ? "ghost" : "primary"} onClick={() => toggleAssessment(s.id, a)}>
                        {a?.passed ? "Снять зачёт" : "Поставить зачёт"}
                      </Button>
                      {a && (
                        <Button size="sm" variant="danger" onClick={() => clearAssessment(a)}>
                          Очистить
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
