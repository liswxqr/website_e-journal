import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { signToken } from "../services/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import { publicUser } from "../services/serialize.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  role: z.enum(["admin", "teacher", "student"]).optional(),
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password, role } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { taughtSubjects: true },
    });
    if (!user) return res.status(401).json({ message: "Пользователь не найден" });
    if (role && user.role !== role)
      return res.status(401).json({ message: "Неверная роль" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Неверный пароль" });

    const token = signToken({ userId: user.id, role: user.role as any });
    res.json({ token, user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { taughtSubjects: true },
    });
    if (!user) return res.status(401).json({ message: "Не авторизован" });
    res.json(publicUser(user));
  } catch (e) {
    next(e);
  }
});

router.post("/logout", requireAuth, (_req, res) => {
  // JWT-токены stateless: фронт просто стирает токен
  res.json({ ok: true });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(4),
});

// Любой залогиненный пользователь меняет свой пароль
router.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(401).json({ message: "Не авторизован" });

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(400).json({ message: "Текущий пароль неверный" });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
