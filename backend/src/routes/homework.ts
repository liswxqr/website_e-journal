import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function publicHomework(h: {
  id: string;
  groupId: string;
  subjectId: string;
  teacherId: string;
  title: string;
  description: string | null;
  dueDate: Date;
  createdAt: Date;
}) {
  return {
    ...h,
    dueDate: isoDate(h.dueDate),
    createdAt: h.createdAt.toISOString(),
  };
}

router.get("/", async (req, res, next) => {
  try {
    const { groupId, subjectId } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (groupId) where.groupId = groupId;
    if (subjectId) where.subjectId = subjectId;

    // Студент видит только ДЗ своей группы
    if (req.user!.role === "student") {
      const me = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (!me?.groupId) return res.json([]);
      where.groupId = me.groupId;
    }
    // Преподаватель — только им заданные
    if (req.user!.role === "teacher") {
      where.teacherId = req.user!.userId;
    }

    const items = await prisma.homework.findMany({
      where,
      orderBy: { dueDate: "asc" },
    });
    res.json(items.map(publicHomework));
  } catch (e) {
    next(e);
  }
});

const schema = z.object({
  id: z.string().optional(),
  groupId: z.string(),
  subjectId: z.string(),
  teacherId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  dueDate: z.string(),
});

router.post("/", requireRole("teacher", "admin"), async (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    const created = await prisma.homework.create({
      data: {
        groupId: data.groupId,
        subjectId: data.subjectId,
        teacherId: data.teacherId ?? req.user!.userId,
        title: data.title,
        description: data.description ?? null,
        dueDate: new Date(data.dueDate),
      },
    });
    res.status(201).json(publicHomework(created));
  } catch (e) {
    next(e);
  }
});

router.put("/:id", requireRole("teacher", "admin"), async (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    const updated = await prisma.homework.update({
      where: { id: req.params.id },
      data: {
        groupId: data.groupId,
        subjectId: data.subjectId,
        teacherId: data.teacherId ?? req.user!.userId,
        title: data.title,
        description: data.description ?? null,
        dueDate: new Date(data.dueDate),
      },
    });
    res.json(publicHomework(updated));
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireRole("teacher", "admin"), async (req, res, next) => {
  try {
    await prisma.homework.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
