import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { useAuthMock, permissionsQueryMock, t } = vi.hoisted(() => {
  const useAuthMock = vi.fn();
  const permissionsQueryMock = vi.fn();
  const nav = new Proxy<Record<string, string>>({}, { get: (_target, key) => String(key) });
  const t = new Proxy<Record<string, unknown>>({ nav, appName: "دكتره", signOut: "تسجيل الخروج" }, { get: (target, key) => target[String(key)] ?? String(key) });
  return { useAuthMock, permissionsQueryMock, t };
});

vi.mock("../client/src/_core/hooks/useAuth", () => ({ useAuth: useAuthMock }));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t, locale: "ar", setLocale: vi.fn(), dir: "rtl" }) }));
vi.mock("@/hooks/useMobile", () => ({ useIsMobile: () => false }));
vi.mock("@/lib/trpc", () => ({ trpc: { accessControl: { myPermissions: { useQuery: permissionsQueryMock } } } }));
vi.mock("wouter", () => ({ useLocation: () => ["/", vi.fn()] }));
vi.mock("@/components/ui/avatar", () => ({ Avatar: ({ children }: { children: unknown }) => children, AvatarFallback: ({ children }: { children: unknown }) => children }));
vi.mock("@/components/ui/collapsible", () => ({ Collapsible: ({ children }: { children: unknown }) => children, CollapsibleContent: ({ children }: { children: unknown }) => children, CollapsibleTrigger: ({ children }: { children: unknown }) => children }));
vi.mock("@/components/ui/dropdown-menu", () => ({ DropdownMenu: ({ children }: { children: unknown }) => children, DropdownMenuContent: ({ children }: { children: unknown }) => children, DropdownMenuItem: ({ children }: { children: unknown }) => children, DropdownMenuSeparator: () => null, DropdownMenuTrigger: ({ children }: { children: unknown }) => children }));
vi.mock("@/components/ui/sidebar", () => ({ SidebarProvider: ({ children }: { children: unknown }) => children, Sidebar: ({ children }: { children: unknown }) => children, SidebarContent: ({ children }: { children: unknown }) => children, SidebarFooter: ({ children }: { children: unknown }) => children, SidebarHeader: ({ children }: { children: unknown }) => children, SidebarInset: ({ children }: { children: unknown }) => children, SidebarMenu: ({ children }: { children: unknown }) => children, SidebarMenuButton: ({ children }: { children: unknown }) => children, SidebarMenuItem: ({ children }: { children: unknown }) => children, SidebarTrigger: () => null, useSidebar: () => ({ state: "expanded", toggleSidebar: vi.fn() }) }));
vi.mock("../client/src/components/ui/button", () => ({ Button: ({ children }: { children: unknown }) => children }));
vi.mock("../client/src/components/PWAInstallButton", () => ({ PWAInstallButton: () => null }));

import DashboardLayout from "../client/src/components/DashboardLayout";

Object.defineProperty(globalThis, "localStorage", {
  value: { getItem: vi.fn(() => null), setItem: vi.fn() },
  configurable: true,
});

function renderForRole(role: "admin" | "user", permissionCodes: string[] = []) {
  useAuthMock.mockReturnValue({ loading: false, user: { id: 1, name: "Local", username: "local", role }, logout: vi.fn() });
  permissionsQueryMock.mockReturnValue({ data: permissionCodes });
  return renderToStaticMarkup(createElement(DashboardLayout, null, createElement("main", null, "Dashboard content")));
}

describe("DashboardLayout RBAC", () => {
  it("يعرض مجموعة الإدارة للمستخدم الإداري", () => {
    expect(renderForRole("admin", ["admin.roles.manage"])).toContain("admin");
  });

  it("يخفي مجموعة الإدارة عن المستخدم العادي مع إبقاء الأقسام الأخرى", () => {
    const html = renderForRole("user", ["inventory.view"]);
    expect(html).not.toContain("admin");
    expect(html).toContain("inventory");
  });
});
