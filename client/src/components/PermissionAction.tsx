import { type ReactNode } from "react";
import { trpc } from "@/lib/trpc";

type PermissionActionProps = {
  permissions: string[];
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * يخفي الإجراء الدقيق عندما لا يحمل المستخدم إحدى صلاحياته الذرية.
 * يظل الخادم مصدر الإلزام النهائي؛ هذا المكوّن يمنع عرض زر غير قابل للتنفيذ.
 */
export function PermissionAction({ permissions, children, fallback = null }: PermissionActionProps) {
  const permissionsQuery = trpc.accessControl.myPermissions.useQuery();
  if (permissionsQuery.isLoading) return null;
  return permissions.some((permission) => permissionsQuery.data?.includes(permission)) ? <>{children}</> : <>{fallback}</>;
}
