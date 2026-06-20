import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { errorHandler, notFound } from "./middleware/error.js";

import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import subjectsRoutes from "./routes/subjects.js";
import groupsRoutes from "./routes/groups.js";
import gradesRoutes from "./routes/grades.js";
import assessmentsRoutes from "./routes/assessments.js";
import attendanceRoutes from "./routes/attendance.js";
import scheduleRoutes from "./routes/schedule.js";
import homeworkRoutes from "./routes/homework.js";

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "e-journal-backend" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/subjects", subjectsRoutes);
app.use("/api/groups", groupsRoutes);
app.use("/api/grades", gradesRoutes);
app.use("/api/assessments", assessmentsRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/homework", homeworkRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`\n🚀 e-journal-backend → http://localhost:${config.port}`);
  console.log(`   CORS origin: ${config.corsOrigin}`);
});
