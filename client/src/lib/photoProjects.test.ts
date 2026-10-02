import { describe, expect, it } from "vitest";
import { filterPhotoLibraryByProject, getProjectLabel, getProjectOptionLabel, INBOX_PROJECT_VALUE, normalizeProjectCreateInput, normalizeProjectName } from "./photoProjects";

describe("photo project helpers", () => {
  const projects = [{ id: 3, name: "秋季產品圖", clientName: "陳小姐", description: "秋季新品上架", brandPresetId: null, createdAt: new Date() }];
  const records = [{ projectId: 3 }, { projectId: null }, {}];

  it("uses a clear inbox label and client-aware option label", () => {
    expect(getProjectLabel(null, projects)).toBe("未分類");
    expect(getProjectLabel(3, projects)).toBe("秋季產品圖");
    expect(getProjectOptionLabel(projects[0])).toBe("秋季產品圖 · 陳小姐");
  });

  it("filters project and inbox records safely", () => {
    expect(filterPhotoLibraryByProject(records, "3")).toHaveLength(1);
    expect(filterPhotoLibraryByProject(records, INBOX_PROJECT_VALUE)).toHaveLength(2);
    expect(filterPhotoLibraryByProject(records, "all")).toHaveLength(3);
  });

  it("normalizes concise project names and optional metadata", () => {
    expect(normalizeProjectName("  九月   新品  ")).toBe("九月 新品");
    expect(normalizeProjectName(" ")).toBe("");
    expect(normalizeProjectCreateInput({ name: "  九月   新品  ", clientName: "  Green   Tea  ", description: "  首批   上架素材 " })).toEqual({
      name: "九月 新品",
      clientName: "Green Tea",
      description: "首批 上架素材",
    });
    expect(normalizeProjectCreateInput({ name: "測試", clientName: "", description: "" })).toMatchObject({ clientName: null, description: null });
  });
});
