export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start Google sign-in. The server sets the one-time state cookie and redirects
// to Google, so this is just a navigation; call it from an event handler.
export const startLogin = () => {
  window.location.href = "/api/auth/google";
};
