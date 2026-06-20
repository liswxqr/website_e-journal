import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { publicUser } from "../services/serialize.js";

const router = Router();

router.use(requireAuth);

// Список — админу всё, остальным только базовая инфа (для UI: показать имя/класс соседа)
router.get("/", async (req, res, next) => {
  try {
    const role = req.query.role as string | undefined;
    const where = role ? { role } : undefined;
    const users = await prisma.user.findMany({
      where,
      include: { taughtSubjects: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    res.json(users.map(publicUser));
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const u = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { taughtSubjects: true },
    });
    if (!u) return res.status(404).json({ message: "Не найдено" });
    res.json(publicUser(u));
  } catch (e) {
    next(e);
  }
});

const createSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().optional().nullable(),
  email: z.string().email(),
  role: z.enum(["admin", "teacher", "student"]),
  groupId: z.string().optional().nullable(),
  stream: z.enum(["poit", "jurist", "economist"]).optional().nullable(),
  subjectIds: z.array(z.string()).optional(),
  password: z.string().min(4).optional(),
});

router.post("/", requireRole("admin"), async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password ?? "123456", 10);
    const created = await prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName ?? null,
        email: data.email.toLowerCase(),
        role: data.role,
        passwordHash,
        groupId: data.role === "student" ? data.groupId ?? null : null,
        stream: data.role === "student" ? data.stream ?? null : null,
        taughtSubjects:
          data.role === "teacher" && data.subjectIds?.length
            ? {
                create: data.subjectIds.map((subjectId) => ({ subjectId })),
              }
            : undefined,
      },
      include: { taughtSubjects: true },
    });
    res.status(201).json(publicUser(created));
  } catch (e) {
    next(e);
  }
});

const updateSchema = createSchema.partial();

router.patch("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    // Обновим базовые поля
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName ?? undefined,
        email: data.email?.toLowerCase(),
        role: data.role,
        groupId:
          data.role === "student"
            ? data.groupId ?? undefined
            : data.role
            ? null
            : undefined,
        stream:
          data.role === "student"
            ? data.stream ?? undefined
            : data.role
            ? null
            : undefined,
        ...(data.password
          ? { passwordHash: await bcrypt.hash(data.password, 10) }
          : {}),
      },
    });
    // Обновим связи преподавателя если пришёл subjectIds
    if (data.subjectIds) {
      await prisma.teacherSubject.deleteMany({ where: { teacherId: updated.id } });
      if (data.subjectIds.length) {
        await prisma.teacherSubject.createMany({
          data: data.subjectIds.map((subjectId) => ({ teacherId: updated.id, subjectId })),
        });
      }
    }
    const full = await prisma.user.findUnique({
      where: { id: updated.id },
      include: { taughtSubjects: true },
    });
    res.json(publicUser(full!));
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
