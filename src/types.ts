export type Role = "admin" | "teacher" | "student";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  email: string;
  role: Role;
  groupId?: string | null;
  subjectIds?: string[];
}

export interface Subject {
  id: string;
  name: string;
  description?: string | null;
  teacherIds: string[];
}

// Студенческая группа (раньше SchoolClass)
export interface Group {
  id: string;
  name: string;
  year: number;
  homeroomTeacherId?: string | null;
  studentIds: string[];
}

// Алиас для обратной совместимости в существующем коде
export type SchoolClass = Group;

// 10-балльная система. "Н" = не был.
export type GradeValue = number | "Н" | "";

export interface Grade {
  id: string;
  studentId: string;
  subjectId: string;
  groupId: string;
  teacherId: string;
  date: string;
  value: GradeValue;
  comment?: string | null;
}

// Зачёт / Незачёт — отдельная сущность
export interface Assessment {
  id: string;
  studentId: string;
  subjectId: string;
  groupId: string;
  teacherId: string;
  date: string;
  passed: boolean;
  comment?: string | null;
}

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface Attendance {
  id: string;
  studentId: string;
  subjectId: string;
  groupId: string;
  date: string;
  status: AttendanceStatus;
}

export interface ScheduleEntry {
  id: string;
  groupId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6;
  lessonNumber: number;
  room?: string | null;
}

export interface Homework {
  id: string;
  groupId: string;
  subjectId: string;
  teacherId: string;
  title: string;
  description?: string | null;
  dueDate: string; // YYYY-MM-DD
  createdAt?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginPayload {
  email: string;
  password: string;
  role?: Role;
}

export interface ApiError {
  message: string;
}
