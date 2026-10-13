export type UserRole = "admin" | "user" | null | undefined;

export function canAccessAdmin(role: UserRole) {
  return role === "admin";
}

export function canShowNavigationGroup(groupKey: string, role: UserRole) {
  return groupKey !== "admin" || canAccessAdmin(role);
}
