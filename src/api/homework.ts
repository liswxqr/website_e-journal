import type { Homework } from "@/types";
import { request } from "./client";

export interface HomeworkFilter {
  groupId?: string;
  subjectId?: string;
}

export async function listHomework(filter: HomeworkFilter = {}): Promise<Homework[]> {
  return request<Homework[]>("/homework", { query: filter as Record<string, string> });
}

export async function upsertHomework(
  data: Omit<Homework, "id" | "createdAt"> & { id?: string }
): Promise<Homework> {
  if (data.id) return request<Homework>(`/homework/${data.id}`, { method: "PUT", body: data });
  return request<Homework>("/homework", { method: "POST", body: data });
}

export async function deleteHomework(id: string): Promise<void> {
  return request<void>(`/homework/${id}`, { method: "DELETE" });
}
