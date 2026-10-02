export type PhotoProject = {
  id: number;
  name: string;
  clientName: string | null;
  description: string | null;
  brandPresetId: number | null;
  createdAt: Date | string;
};

export type PhotoProjectCreateInput = {
  name: string;
  clientName: string | null;
  description: string | null;
};

export type ProjectScopedImage = {
  projectId?: number | null;
};

export const INBOX_PROJECT_VALUE = "inbox";

export function getProjectLabel(projectId: number | null | undefined, projects: PhotoProject[]) {
  if (!projectId) return "未分類";
  return projects.find((project) => project.id === projectId)?.name || "未分類";
}

export function getProjectOptionLabel(project: Pick<PhotoProject, "name" | "clientName">) {
  return project.clientName ? `${project.name} · ${project.clientName}` : project.name;
}

export function filterPhotoLibraryByProject<T extends ProjectScopedImage>(records: T[], projectValue: string) {
  if (projectValue === "all") return records;
  if (projectValue === INBOX_PROJECT_VALUE) return records.filter((record) => !record.projectId);
  const projectId = Number(projectValue);
  if (!Number.isInteger(projectId) || projectId < 1) return records;
  return records.filter((record) => record.projectId === projectId);
}

export function normalizeProjectName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 60);
}

export function normalizeOptionalProjectMetadata(value: string, maxLength: number) {
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  return normalized || null;
}

export function normalizeProjectCreateInput(input: { name: string; clientName?: string; description?: string }): PhotoProjectCreateInput {
  return {
    name: normalizeProjectName(input.name),
    clientName: normalizeOptionalProjectMetadata(input.clientName ?? "", 60),
    description: normalizeOptionalProjectMetadata(input.description ?? "", 160),
  };
}
