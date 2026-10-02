export type DesktopSettingsPanelState = "expanded" | "collapsed";

export function toggleDesktopSettingsPanel(state: DesktopSettingsPanelState): DesktopSettingsPanelState {
  return state === "expanded" ? "collapsed" : "expanded";
}

export function getDesktopSettingsPanelCopy(state: DesktopSettingsPanelState) {
  return state === "expanded"
    ? { label: "收合設定", description: "收合右側設定以擴大相片預覽" }
    : { label: "展開設定", description: "顯示右側處理設定" };
}
