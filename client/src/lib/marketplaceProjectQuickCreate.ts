import { normalizeProjectCreateInput } from "./photoProjects";

export function getMarketplaceProjectQuickCreateState(input: { name: string; clientName?: string; description?: string }) {
  const project = normalizeProjectCreateInput(input);
  return { ...project, canCreate: project.name.length > 0 };
}
