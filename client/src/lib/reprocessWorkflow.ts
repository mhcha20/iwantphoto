export type ReprocessMode = "background" | "cleanup";
export type ReprocessBackgroundStyle = "transparent" | "white";
export type ReprocessOption = "background-transparent" | "background-white" | "cleanup";

export function getReprocessRequest(option: ReprocessOption, currentBackgroundStyle: ReprocessBackgroundStyle) {
  if (option === "background-transparent") return { mode: "background" as const, backgroundStyle: "transparent" as const };
  if (option === "background-white") return { mode: "background" as const, backgroundStyle: "white" as const };
  return { mode: "cleanup" as const, backgroundStyle: currentBackgroundStyle };
}

export function getReprocessOptionLabel(option: ReprocessOption) {
  if (option === "background-transparent") return "重新去背 · 透明底";
  if (option === "background-white") return "重新去背 · 純白底";
  return "重新依清除設定處理";
}
