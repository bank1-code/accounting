import React, { type ReactNode } from "react";

type PermissionAccessGateProps = {
  allowed: boolean;
  loading?: boolean;
  children: ReactNode;
};

export function PermissionAccessGate({ allowed, loading = false, children }: PermissionAccessGateProps) {
  if (loading) return <div data-testid="permission-route-loading" />;
  if (!allowed) {
    return <div data-testid="permission-route-denied" className="flex h-64 items-center justify-center text-sm text-muted-foreground">ليس لديك صلاحية الوصول إلى هذه الوحدة.</div>;
  }
  return <div data-testid="permission-route-allowed">{children}</div>;
}
