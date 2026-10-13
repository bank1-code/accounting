import { useEffect, useState } from "react";
import { ArchiveRestore, CheckCircle2, DatabaseBackup, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { PermissionAction } from "@/components/PermissionAction";

export default function Backups() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: backups, isLoading } = trpc.backups.list.useQuery();
  const [label, setLabel] = useState("");
  const [verifyId, setVerifyId] = useState<number | null>(null);
  const [restoreResult, setRestoreResult] = useState<{ backupId: number; tablesCount: number; recordsCount: number; durationMs: number } | null>(null);
  const verification = trpc.backups.verifyEncrypted.useQuery({ backupId: verifyId || 0 }, { enabled: Boolean(verifyId), retry: false });
  const createBackup = trpc.backups.createEncrypted.useMutation({
    onSuccess: async (result) => {
      await utils.backups.list.invalidate();
      setLabel("");
      toast.success(`تم إنشاء نسخة مشفرة تشمل ${result.recordsCount} سجل`);
    },
    onError: (error) => toast.error(error.message),
  });
  const testRestore = trpc.backups.testRestoreIsolated.useMutation({
    onSuccess: (result, variables) => {
      setRestoreResult({ backupId: variables.backupId, ...result });
      toast.success(`نجح اختبار الاستعادة المعزولة خلال ${(result.durationMs / 1000).toFixed(2)} ثانية`);
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (verification.data) toast.success(`تم التحقق من النسخة: ${verification.data.tablesCount} جدول و${verification.data.recordsCount} سجل`);
    if (verification.error) toast.error(verification.error.message);
  }, [verification.data, verification.error]);

  return <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{t.nav.backups}</h1>
      <p className="text-sm text-muted-foreground">نسخ منطقي مشفر بتشفير AES-256-GCM، محفوظ خارج قاعدة البيانات ومرفق بسجل تدقيق.</p>
    </div>
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader><CardTitle className="flex items-center gap-2"><DatabaseBackup className="h-5 w-5 text-primary" />إنشاء نسخة احتياطية مشفرة</CardTitle><CardDescription>لا تخزن مفاتيح التشفير أو محتوى البيانات في سجل النسخ. يجب اختبار الاستعادة في بيئة منفصلة قبل اعتمادها تشغيلياً.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row">
        <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="اسم اختياري للنسخة" maxLength={255} />
        <PermissionAction permissions={["admin.backups.manage"]}>
          <Button disabled={createBackup.isPending} onClick={() => createBackup.mutate({ label: label.trim() || undefined })}>
            {createBackup.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="me-2 h-4 w-4" />}إنشاء نسخة مشفرة
          </Button>
        </PermissionAction>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle>سجل النسخ الاحتياطية</CardTitle><CardDescription>التحقق يختبر تنزيل النسخة وفك تشفيرها. اختبار الاستعادة ينشئ قاعدة مؤقتة معزولة، يتحقق من الصفوف، ثم يحذفها دون كتابة إلى قاعدة التشغيل.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : !backups?.length ? <p className="py-8 text-center text-sm text-muted-foreground">لا توجد نسخ احتياطية بعد.</p> : backups.map((backup) => <div key={backup.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex items-center gap-2"><span className="font-medium">{backup.name}</span><Badge variant={backup.status === "completed" ? "default" : backup.status === "failed" ? "destructive" : "secondary"}>{backup.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{new Date(backup.createdAt).toLocaleString()} · {backup.tablesCount || 0} جدول · {backup.recordsCount || 0} سجل · {backup.fileSize ? `${(backup.fileSize / 1024).toFixed(1)} KB` : ""}</p></div>
          <div className="flex flex-wrap gap-2"><PermissionAction permissions={["admin.backups.manage"]}><Button size="sm" variant="outline" disabled={backup.status !== "completed" || !backup.fileKey || verification.isFetching} onClick={() => setVerifyId(backup.id)}><CheckCircle2 className="me-2 h-4 w-4" />تحقق</Button></PermissionAction><PermissionAction permissions={["admin.backups.manage"]}><Button size="sm" variant="outline" disabled={backup.status !== "completed" || !backup.fileKey || testRestore.isPending} onClick={() => testRestore.mutate({ backupId: backup.id })}>{testRestore.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ArchiveRestore className="me-2 h-4 w-4" />}اختبار الاستعادة</Button></PermissionAction></div>
          {restoreResult?.backupId === backup.id && <p className="text-xs text-emerald-700">استعادة معزولة ناجحة: {restoreResult.tablesCount} جدول، {restoreResult.recordsCount} سجل، {(restoreResult.durationMs / 1000).toFixed(2)} ثانية.</p>}
        </div>)}
      </CardContent>
    </Card>
    <Card className="border-amber-500/30"><CardContent className="flex gap-3 p-4 text-sm text-muted-foreground"><ArchiveRestore className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><p><strong className="text-foreground">الاستعادة محمية:</strong> لا يمكن تنفيذ استعادة مباشرة على قاعدة تشغيل من هذه الشاشة. ستتطلب عملية الاستعادة مراجعة نسخة مؤقتة، مطابقة المخطط، وموافقة صريحة لمنع فقد البيانات.</p></CardContent></Card>
  </div>;
}
