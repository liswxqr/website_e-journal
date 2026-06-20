import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res, next) => {
  try {
    const items = await prisma.subject.findMany({
      include: { teachers: true },
      orderBy: { name: "asc" },
    });
    res.json(
      items.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        stream: s.stream,
        teacherIds: s.teachers.map((t) => t.teacherId),
      }))
    );
  } catch (e) {
    next(e);
  }
});

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  stream: z.enum(["poit", "jurist", "economist"]).optional().nullable(),
  teacherIds: z.array(z.string()).default([]),
});

router.post("/", requireRole("admin"), async (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    const created = await prisma.subject.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        stream: data.stream ?? null,
        teachers: { create: data.teacherIds.map((teacherId) => ({ teacherId })) },
      },
      include: { teachers: true },
    });
    res.status(201).json({
      id: created.id,
      name: created.name,
      description: created.description,
      stream: created.stream,
      teacherIds: created.teachers.map((t) => t.teacherId),
    });
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const data = schema.partial().parse(req.body);
    const updated = await prisma.subject.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        description: data.description ?? undefined,
        stream: data.stream === undefined ? undefined : data.stream,
      },
    });
    if (data.teacherIds) {
      await prisma.teacherSubject.deleteMany({ where: { subjectId: updated.id } });
      if (data.teacherIds.length) {
        await prisma.teacherSubject.createMany({
          data: data.teacherIds.map((teacherId) => ({ teacherId, subjectId: updated.id })),
        });
      }
    }
    const full = await prisma.subject.findUnique({
      where: { id: updated.id },
      include: { teachers: true },
    });
    res.json({
      id: full!.id,
      name: full!.name,
      description: full!.description,
      stream: full!.stream,
      teacherIds: full!.teachers.map((t) => t.teacherId),
    });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    await prisma.subject.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
