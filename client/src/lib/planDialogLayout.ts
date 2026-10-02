export const PLAN_DIALOG_CONTAINER_CLASS = "flex max-h-[calc(100svh-1rem)] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden border-[#c9d7e8] bg-[#f8fbff] p-0 sm:max-w-lg";

export const PLAN_DIALOG_SCROLL_BODY_CLASS = "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 [-webkit-overflow-scrolling:touch] sm:px-6 sm:pb-6";

export function supportsCompletePlanDialogView(containerClasses: string, bodyClasses: string) {
  return containerClasses.includes("max-h-[calc(100svh-1rem)]")
    && containerClasses.includes("overflow-hidden")
    && bodyClasses.includes("overflow-y-auto")
    && bodyClasses.includes("overscroll-contain");
}
