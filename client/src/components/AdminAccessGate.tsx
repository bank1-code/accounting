import React, { type ReactNode } from "react";
import { canAccessAdmin, type UserRole } from "@/lib/permissions";

type AdminAccessGateProps = {
  role?: UserRole;
  allowed?: boolean;
  loading?: boolean;
  children: ReactNode;
};

export function AdminAccessGate({ role, allowed, loading = false, children }: AdminAccessGateProps) {
  if (loading) return <div data-testid="admin-route-loading" />;
  if (!(allowed ?? canAccessAdmin(role))) {
    return <div data-testid="admin-route-denied" className="flex h-64 items-center justify-center text-sm text-muted-foreground">ليس لديك صلاحية الوصول إلى قسم الإدارة.</div>;
  }
  return <div data-testid="admin-route-allowed">{children}</div>;
}
