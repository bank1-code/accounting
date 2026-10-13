import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Save, ShieldCheck, UsersRound } from "lucide-react";
import { toast } from "sonner";

const moduleLabels: Record<string, string> = {
  admin: "الإدارة", accounting: "المحاسبة", treasury: "الخزينة", pos: "نقاط البيع",
  inventory: "المخزون", production: "الإنتاج", purchasing: "المشتريات", compliance: "الامتثال",
};

export default function Users() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: roles, isLoading: rolesLoading } = trpc.accessControl.roles.useQuery();
  const { data: permissions } = trpc.accessControl.permissions.useQuery();
  const { data: users } = trpc.accessControl.users.useQuery();
  const { data: branches } = trpc.branches.list.useQuery();
  const { data: warehouses } = trpc.warehouses.list.useQuery();
  const { data: costCenters } = trpc.costCenters.list.useQuery();
  const [roleId, setRoleId] = useState(0);
  const [userId, setUserId] = useState(0);
  const { data: rolePermissionRows } = trpc.accessControl.rolePermissions.useQuery({ roleId }, { enabled: roleId > 0 });
  const { data: assignments } = trpc.accessControl.userRoles.useQuery({ userId }, { enabled: userId > 0 });
  const { data: overrides } = trpc.accessControl.userPermissionOverrides.useQuery({ userId }, { enabled: userId > 0 });
  const [allowed, setAllowed] = useState<number[]>([]);
  const [denied, setDenied] = useState<number[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [roleForm, setRoleForm] = useState({ code: "", name: "", nameEn: "", description: "" });
  const [assignment, setAssignment] = useState({ roleId: "", branchId: "all", warehouseId: "all", costCenterId: "" });
  const [override, setOverride] = useState({ permissionId: "", effect: "allow" as "allow" | "deny", branchId: "all", warehouseId: "all", costCenterId: "", reason: "" });

  useEffect(() => {
    if (!roleId && roles?.[0]) setRoleId(roles[0].id);
  }, [roleId, roles]);
  useEffect(() => {
    if (!userId && users?.[0]) setUserId(users[0].id);
  }, [userId, users]);
  useEffect(() => {
    setAllowed((rolePermissionRows || []).filter((row) => row.effect === "allow").map((row) => row.permissionId));
    setDenied((rolePermissionRows || []).filter((row) => row.effect === "deny").map((row) => row.permissionId));
  }, [rolePermissionRows, roleId]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof permissions>>();
    for (const permission of permissions || []) {
      const group = groups.get(permission.module) || [];
      group.push(permission);
      groups.set(permission.module, group);
    }
    return Array.from(groups.entries());
  }, [permissions]);

  const createRole = trpc.accessControl.createRole.useMutation({
    onSuccess: async () => {
      await utils.accessControl.roles.invalidate();
      setCreateOpen(false); setRoleForm({ code: "", name: "", nameEn: "", description: "" });
      toast.success("تم إنشاء الدور بنجاح");
    },
    onError: (error) => toast.error(error.message),
  });
  const savePermissions = trpc.accessControl.setRolePermissions.useMutation({
    onSuccess: async () => { await utils.accessControl.rolePermissions.invalidate(); toast.success("تم حفظ الصلاحيات الذرية"); },
    onError: (error) => toast.error(error.message),
  });
  const assignRole = trpc.accessControl.assignUserRole.useMutation({
    onSuccess: async () => { await utils.accessControl.userRoles.invalidate(); toast.success("تم إسناد الدور للمستخدم"); },
    onError: (error) => toast.error(error.message),
  });
  const setAssignmentActive = trpc.accessControl.setUserRoleActive.useMutation({
    onSuccess: async () => { await utils.accessControl.userRoles.invalidate(); toast.success("تم تحديث حالة الدور"); },
    onError: (error) => toast.error(error.message),
  });
  const saveOverride = trpc.accessControl.setUserPermissionOverride.useMutation({
    onSuccess: async () => {
      await utils.accessControl.userPermissionOverrides.invalidate();
      setOverride({ permissionId: "", effect: "allow", branchId: "all", warehouseId: "all", costCenterId: "", reason: "" });
      toast.success("تم حفظ التجاوز الفردي");
    },
    onError: (error) => toast.error(error.message),
  });

  const togglePermission = (permissionId: number, checked: boolean) => {
    setAllowed((current) => checked ? Array.from(new Set([...current, permissionId])) : current.filter((id) => id !== permissionId));
    setDenied((current) => current.filter((id) => id !== permissionId));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">الأدوار والصلاحيات الذرية</h1>
          <p className="text-sm text-muted-foreground">إدارة الوصول حسب الدور والإجراء ونطاق الفرع أو المخزن، مع سجل تدقيق لكل تغيير.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button><Plus className="me-2 h-4 w-4" />دور جديد</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>إنشاء دور ديناميكي</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>رمز الدور</Label><Input dir="ltr" placeholder="branch_manager" value={roleForm.code} onChange={(e) => setRoleForm({ ...roleForm, code: e.target.value.toLowerCase().replace(/\s+/g, "_") })} /></div>
              <div><Label>اسم الدور بالعربية</Label><Input value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} /></div>
              <div><Label>اسم الدور بالإنجليزية</Label><Input dir="ltr" value={roleForm.nameEn} onChange={(e) => setRoleForm({ ...roleForm, nameEn: e.target.value })} /></div>
              <div><Label>الوصف</Label><Input value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} /></div>
              <Button className="w-full" disabled={!roleForm.code || !roleForm.name || createRole.isPending} onClick={() => createRole.mutate({ code: roleForm.code, name: roleForm.name, nameEn: roleForm.nameEn || undefined, description: roleForm.description || undefined })}>
                {createRole.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}إنشاء الدور
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-5 w-5 text-primary" />الأدوار</CardTitle><CardDescription>اختر دوراً لتعديل صلاحياته.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {rolesLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : roles?.map((role) => (
              <button key={role.id} onClick={() => setRoleId(role.id)} className={`w-full rounded-lg border p-3 text-start transition-colors ${roleId === role.id ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>
                <div className="flex items-center justify-between gap-2"><span className="font-medium">{role.name}</span>{role.isSystem && <Badge variant="secondary">نظامي</Badge>}</div>
                <p className="mt-1 text-xs text-muted-foreground" dir="ltr">{role.code}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div><CardTitle>مصفوفة الصلاحيات</CardTitle><CardDescription>تمنح كل عملية بشكل مستقل. إلغاء التحديد يسحب الإذن من الدور.</CardDescription></div>
            <Button disabled={!roleId || savePermissions.isPending} onClick={() => savePermissions.mutate({ roleId, permissionIds: allowed, deniedPermissionIds: denied })}><Save className="me-2 h-4 w-4" />حفظ</Button>
          </CardHeader>
          <CardContent className="space-y-5">
            {groupedPermissions.map(([module, items]) => (
              <section key={module} className="rounded-lg border">
                <div className="border-b bg-muted/40 px-4 py-2 font-semibold">{moduleLabels[module] || module}</div>
                <div className="grid gap-2 p-4 md:grid-cols-2">
                  {items.map((permission) => {
                    const checked = allowed.includes(permission.id);
                    return <label key={permission.id} className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted">
                      <input type="checkbox" className="mt-1 h-4 w-4" checked={checked} onChange={(e) => togglePermission(permission.id, e.target.checked)} />
                      <span><span className="block text-sm font-medium">{permission.name}</span><span className="block text-xs text-muted-foreground" dir="ltr">{permission.code}</span></span>
                    </label>;
                  })}
                </div>
              </section>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-primary" />إسناد الدور والنطاق التشغيلي</CardTitle><CardDescription>يُسمح بإسناد أكثر من دور للمستخدم وتقييده بفرع أو مخزن محدد.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            <div><Label>المستخدم</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={userId} onChange={(e) => setUserId(Number(e.target.value))}>{users?.map((user) => <option key={user.id} value={user.id}>{user.name || user.username || `#${user.id}`}</option>)}</select></div>
            <div><Label>الدور</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={assignment.roleId} onChange={(e) => setAssignment({ ...assignment, roleId: e.target.value })}><option value="">اختر دوراً</option>{roles?.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></div>
            <div><Label>نطاق الفرع</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={assignment.branchId} onChange={(e) => setAssignment({ ...assignment, branchId: e.target.value })}><option value="all">كل الفروع</option>{branches?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
            <div><Label>نطاق المخزن</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={assignment.warehouseId} onChange={(e) => setAssignment({ ...assignment, warehouseId: e.target.value })}><option value="all">كل المخازن</option>{warehouses?.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></div>
            <div><Label>نطاق مركز التكلفة</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={assignment.costCenterId} onChange={(e) => setAssignment({ ...assignment, costCenterId: e.target.value })}><option value="">كل مراكز التكلفة</option>{costCenters?.map((center) => <option key={center.id} value={center.id}>{center.code} — {center.name}</option>)}</select></div>
          </div>
          <Button disabled={!userId || !assignment.roleId || assignRole.isPending} onClick={() => assignRole.mutate({ userId, roleId: Number(assignment.roleId), branchId: assignment.branchId === "all" ? undefined : Number(assignment.branchId), warehouseId: assignment.warehouseId === "all" ? undefined : Number(assignment.warehouseId), costCenterId: assignment.costCenterId ? Number(assignment.costCenterId) : undefined })}>إسناد الدور</Button>
          <div className="rounded-lg border">
            <div className="border-b px-4 py-2 text-sm font-semibold">الأدوار المسندة للمستخدم</div>
            {!assignments?.length ? <p className="p-4 text-sm text-muted-foreground">لا توجد أدوار مسندة.</p> : assignments.map((item) => <div key={item.assignmentId} className="flex flex-wrap items-center justify-between gap-3 border-b p-3 last:border-0">
              <div><span className="font-medium">{item.roleName}</span><p className="text-xs text-muted-foreground">{item.branchId ? `فرع #${item.branchId}` : "كل الفروع"} · {item.warehouseId ? `مخزن #${item.warehouseId}` : "كل المخازن"} · {item.costCenterId ? `مركز تكلفة #${item.costCenterId}` : "كل مراكز التكلفة"}</p></div>
              <Button variant={item.isActive ? "outline" : "default"} size="sm" onClick={() => setAssignmentActive.mutate({ id: item.assignmentId, isActive: !item.isActive })}>{item.isActive ? "تعطيل" : "تفعيل"}</Button>
            </div>)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>تجاوزات فردية للصلاحيات</CardTitle><CardDescription>تمنح أو تمنع صلاحية محددة لمستخدم بعينه ضمن نطاق دقيق. المنع الفردي يتقدم على أي منح صادر من الدور.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div><Label>الصلاحية</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={override.permissionId} onChange={(e) => setOverride({ ...override, permissionId: e.target.value })}><option value="">اختر صلاحية</option>{permissions?.map((permission) => <option key={permission.id} value={permission.id}>{permission.code}</option>)}</select></div>
            <div><Label>الأثر</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={override.effect} onChange={(e) => setOverride({ ...override, effect: e.target.value as "allow" | "deny" })}><option value="allow">منح</option><option value="deny">منع</option></select></div>
            <div><Label>نطاق الفرع</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={override.branchId} onChange={(e) => setOverride({ ...override, branchId: e.target.value })}><option value="all">كل الفروع</option>{branches?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
            <div><Label>نطاق المخزن</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={override.warehouseId} onChange={(e) => setOverride({ ...override, warehouseId: e.target.value })}><option value="all">كل المخازن</option>{warehouses?.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></div>
            <div><Label>نطاق مركز التكلفة</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={override.costCenterId} onChange={(e) => setOverride({ ...override, costCenterId: e.target.value })}><option value="">كل المراكز</option>{costCenters?.map((center) => <option key={center.id} value={center.id}>{center.code} — {center.name}</option>)}</select></div>
            <div><Label>سبب التجاوز</Label><Input value={override.reason} onChange={(e) => setOverride({ ...override, reason: e.target.value })} placeholder="سبب إداري موثق" /></div>
          </div>
          <Button disabled={!userId || !override.permissionId || override.reason.trim().length < 3 || saveOverride.isPending} onClick={() => saveOverride.mutate({ userId, permissionId: Number(override.permissionId), effect: override.effect, branchId: override.branchId === "all" ? undefined : Number(override.branchId), warehouseId: override.warehouseId === "all" ? undefined : Number(override.warehouseId), costCenterId: override.costCenterId ? Number(override.costCenterId) : undefined, reason: override.reason.trim() })}>حفظ التجاوز</Button>
          <div className="rounded-lg border">
            <div className="border-b px-4 py-2 text-sm font-semibold">التجاوزات الفعالة للمستخدم</div>
            {!overrides?.length ? <p className="p-4 text-sm text-muted-foreground">لا توجد تجاوزات فردية.</p> : overrides.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-3 last:border-0">
              <div><div className="flex items-center gap-2"><span className="font-medium" dir="ltr">{item.permissionCode}</span><Badge variant={item.effect === "allow" ? "default" : "destructive"}>{item.effect === "allow" ? "منح" : "منع"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{item.reason || "بدون سبب"} · {item.branchId ? `فرع #${item.branchId}` : "كل الفروع"} · {item.warehouseId ? `مخزن #${item.warehouseId}` : "كل المخازن"} · {item.costCenterId ? `مركز تكلفة #${item.costCenterId}` : "كل المراكز"}</p></div>
            </div>)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
