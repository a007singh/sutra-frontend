export function globalToast(message: string, type: "success" | "error" | "info" | "warning" = "success") {
  window.dispatchEvent(new CustomEvent("toast", { detail: { message, type } }));
}