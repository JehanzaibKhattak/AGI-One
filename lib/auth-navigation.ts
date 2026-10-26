/** Invitation continuation is the only user-supplied destination accepted by auth pages. */
export function authDestination(next?: string | null) {
  return next?.startsWith("/onboarding?") && !/[\\\r\n]/.test(next)
    ? next
    : "/dashboard";
}
