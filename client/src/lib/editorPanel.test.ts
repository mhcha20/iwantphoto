import { describe, expect, it } from "vitest";
import { getDesktopSettingsPanelCopy, toggleDesktopSettingsPanel } from "./editorPanel";

describe("desktop settings panel controls", () => {
  it("requires an explicit action to toggle the desktop settings panel", () => {
    expect(toggleDesktopSettingsPanel("expanded")).toBe("collapsed");
    expect(toggleDesktopSettingsPanel("collapsed")).toBe("expanded");
  });

  it("provides clear manual control copy for each panel state", () => {
    expect(getDesktopSettingsPanelCopy("expanded")).toMatchObject({ label: "收合設定" });
    expect(getDesktopSettingsPanelCopy("collapsed")).toMatchObject({ label: "展開設定" });
  });
});
