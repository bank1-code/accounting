import { useEffect, useState } from "react";
import { Bell, BookOpenCheck, Database, Globe, Loader2, Palette, Save, Settings as SettingsIcon, Shield } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionAction } from "@/components/PermissionAction";
import { trpc } from "@/lib/trpc";

type PosPostingMap = {
  cashAccountId: number;
  cardClearingAccountId: number;
  salesRevenueAccountId: number;
  outputVatAccountId: number;
  inputVatAccountId: number;
  inventoryAccountId: number;
  workInProgressAccountId: number;
  finishedGoodsInventoryAccountId: number;
  inventoryGainAccountId: number;
  inventoryLossAccountId: number;
  wasteExpenseAccountId: number;
  cogsAccountId: number;
  accountsPayableAccountId: number;
};

const emptyMap: PosPostingMap = {
  cashAccountId: 0,
  cardClearingAccountId: 0,
  salesRevenueAccountId: 0,
  outputVatAccountId: 0,
  inputVatAccountId: 0,
  inventoryAccountId: 0,
  workInProgressAccountId: 0,
  finishedGoodsInventoryAccountId: 0,
  inventoryGainAccountId: 0,
  inventoryLossAccountId: 0,
  wasteExpenseAccountId: 0,
  cogsAccountId: 0,
  accountsPayableAccountId: 0,
};

export default function Settings() {
  const utils = trpc.useUtils();
  const accounts = trpc.accounts.list.useQuery();
  const postingMap = trpc.accountingPosting.posMap.useQuery();
  const cashVarianceThreshold = trpc.accountingPosting.posCashVarianceAlertThreshold.useQuery();
  const expiryAlertDays = trpc.accountingPosting.inventoryExpiryAlertDays.useQuery();
  const notificationRules = trpc.accountingPosting.notificationRules.useQuery();
  const [map, setMap] = useState<PosPostingMap>(emptyMap);
  const [varianceThreshold, setVarianceThreshold] = useState("0.00");
  const [expiryDays, setExpiryDays] = useState("");
  const [lastExpiryScan, setLastExpiryScan] = useState<{ scanned: number; created: number } | null>(null);
  const [rules, setRules] = useState({ inventoryReorder: true, inventoryExpiry: true, posCashVariance: true });

  useEffect(() => {
    if (postingMap.data) setMap(postingMap.data);
  }, [postingMap.data]);

  useEffect(() => {
    if (cashVarianceThreshold.data !== undefined && cashVarianceThreshold.data !== null) setVarianceThreshold(cashVarianceThreshold.data);
  }, [cashVarianceThreshold.data]);

  useEffect(() => {
    if (expiryAlertDays.data !== undefined && expiryAlertDays.data !== null) setExpiryDays(expiryAlertDays.data);
  }, [expiryAlertDays.data]);

  useEffect(() => { if (notificationRules.data) setRules(notificationRules.data); }, [notificationRules.data]);

  const saveMap = trpc.accountingPosting.savePosMap.useMutation({
    onSuccess: async () => { await utils.accountingPosting.posMap.invalidate(); toast.success("تم حفظ خريطة حسابات نقاط البيع"); },
    onError: (error) => toast.error(error.message),
  });

  const saveVarianceThreshold = trpc.accountingPosting.savePosCashVarianceAlertThreshold.useMutation({
    onSuccess: async () => { await utils.accountingPosting.posCashVarianceAlertThreshold.invalidate(); toast.success("تم حفظ حد تنبيه فرق النقد"); },
    onError: (error) => toast.error(error.message),
  });

  const saveExpiryAlertDays = trpc.accountingPosting.saveInventoryExpiryAlertDays.useMutation({
    onSuccess: async () => { await utils.accountingPosting.inventoryExpiryAlertDays.invalidate(); toast.success("تم حفظ حد تنبيه قرب انتهاء الصلاحية"); },
    onError: (error) => toast.error(error.message),
  });

  const scanExpiryAlerts = trpc.accountingPosting.scanInventoryExpiryAlerts.useMutation({
    onSuccess: (result) => {
      setLastExpiryScan(result);
      toast.success(result.created ? `تم فحص ${result.scanned} دفعة وإنشاء ${result.created} تنبيه صلاحية` : `تم فحص ${result.scanned} دفعة؛ لا توجد تنبيهات جديدة ضمن الحد`);
    },
    onError: (error) => toast.error(error.message),
  });

  const saveNotificationRules = trpc.accountingPosting.saveNotificationRules.useMutation({
    onSuccess: async () => { await utils.accountingPosting.notificationRules.invalidate(); toast.success("تم حفظ قواعد الإشعارات"); },
    onError: (error) => toast.error(error.message),
  });

  const mapComplete = Object.values(map).every((accountId) => Number.isInteger(accountId) && accountId > 0);
  const chooseAccount = (field: keyof PosPostingMap, label: string, helper: string) => <div className="space-y-2" key={field}>
    <Label>{label}</Label>
    <Select value={String(map[field])} onValueChange={(value) => setMap((current) => ({ ...current, [field]: Number(value) }))}>
      <SelectTrigger><SelectValue placeholder="اختر حساباً" /></SelectTrigger>
      <SelectContent><SelectItem value="0" disabled>اختر حساباً</SelectItem>{accounts.data?.map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.code} — {account.name}</SelectItem>)}</SelectContent>
    </Select>
    <p className="text-xs text-muted-foreground">{helper}</p>
  </div>;

  const settingsSections = [
    { icon: Database, title: "إعدادات النظام", desc: "إعدادات قاعدة البيانات والنسخ الاحتياطي", color: "text-blue-600 bg-blue-100" },
    { icon: Shield, title: "الأمان", desc: "إعدادات الأمان والحماية", color: "text-red-600 bg-red-100" },
    { icon: Globe, title: "اللغة والمنطقة", desc: "إعدادات اللغة والعملة والتوقيت", color: "text-green-600 bg-green-100" },
    { icon: Bell, title: "الإشعارات", desc: "إعدادات التنبيهات والإشعارات", color: "text-yellow-600 bg-yellow-100" },
    { icon: Palette, title: "المظهر", desc: "تخصيص واجهة المستخدم", color: "text-purple-600 bg-purple-100" },
  ];

  return <div className="space-y-6 pb-8">
    <div><h1 className="text-2xl font-bold tracking-tight">الإعدادات</h1><p className="mt-1 text-sm text-muted-foreground">إعدادات تشغيلية محكومة بالصلاحيات وتُراجع قبل تأثيرها على القيود.</p></div>
    <Card className="border-primary/30">
      <CardHeader><CardTitle className="flex items-center gap-2"><BookOpenCheck className="h-5 w-5 text-primary" />خريطة حسابات نقاط البيع</CardTitle><CardDescription>لا ينشئ النظام قيد بيع أو مردود تلقائياً على أرقام مفترضة. اختر الحسابات الفعلية من دليل الحسابات أولاً.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        {accounts.isLoading || postingMap.isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : <>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {chooseAccount("cashAccountId", "حساب الصندوق النقدي", "يستخدم للبيع والاسترداد النقدي.")}
            {chooseAccount("cardClearingAccountId", "حساب بطاقات/تحويلات تحت التسوية", "يستخدم للبطاقات والتحويلات حتى المطابقة البنكية.")}
            {chooseAccount("salesRevenueAccountId", "حساب إيراد المبيعات", "دائن عند البيع ومدين عند استرداد البيع.")}
            {chooseAccount("outputVatAccountId", "حساب ضريبة المخرجات", "دائن عند استحقاق الضريبة ومدين عند عكسها.")}
            {chooseAccount("inputVatAccountId", "حساب ضريبة المدخلات", "مدين عند اعتماد فاتورة الشراء ويستخدم في مطابقة الإقرار.")}
            {chooseAccount("inventoryAccountId", "حساب المخزون", "دائن عند البيع ومدين عند إعادة البضاعة.")}
            {chooseAccount("workInProgressAccountId", "حساب إنتاج تحت التشغيل", "يستقبل تكلفة المواد عند بدء الإقفال ويقفل عند تحويل المنتج التام.")}
            {chooseAccount("finishedGoodsInventoryAccountId", "حساب مخزون المنتج التام", "مدين عند إقفال أمر الإنتاج بقيمة التكلفة الفعلية.")}
            {chooseAccount("inventoryGainAccountId", "حساب مكاسب فروقات الجرد", "دائن عند زيادة الجرد الفعلية عن الرصيد الدفتري.")}
            {chooseAccount("inventoryLossAccountId", "حساب خسائر فروقات الجرد", "مدين عند نقص الجرد الفعلي عن الرصيد الدفتري.")}
            {chooseAccount("wasteExpenseAccountId", "حساب مصروف الهدر والتوالف", "مدين عند اعتماد إذن توالف متعدد البنود.")}
            {chooseAccount("cogsAccountId", "حساب تكلفة المبيعات", "مدين عند البيع ودائن عند إعادة التكلفة.")}
            {chooseAccount("accountsPayableAccountId", "حساب الموردين / الدائنون", "دائن عند اعتماد فاتورة الشراء ويُستخدم لمطابقة ضريبة المدخلات.")}
          </div>
          {!accounts.data?.length && <p className="rounded-lg border border-amber-500/30 bg-amber-50 p-3 text-sm text-amber-900">أضف الحسابات الفعلية إلى دليل الحسابات أولاً؛ لا توجد حسابات افتراضية منشأة تلقائياً.</p>}
          <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 p-3"><p className="text-sm text-muted-foreground">{mapComplete ? "الخريطة مكتملة؛ لا تزال القيود المستقبلية خاضعة لفحص الفترة المفتوحة والحسابات النشطة." : "الخريطة غير مكتملة؛ سيمنع النظام البيع والمردود والإنتاج والشراء والجرد والتوالف المرحل حتى تكتمل الحسابات الثلاثة عشر."}</p><PermissionAction permissions={["admin.settings.manage"]}><Button onClick={() => saveMap.mutate(map)} disabled={!mapComplete || saveMap.isPending}>{saveMap.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}حفظ الخريطة</Button></PermissionAction></div>
        </>}
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-amber-600" />حد تنبيه فرق النقد</CardTitle><CardDescription>عند إقفال جلسة POS، ينشئ النظام تنبيهاً إذا بلغ فرق النقد المطلق هذا الحد. أدخل 0 لتعطيل التنبيه حتى مرحلة التشغيل.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="w-full max-w-xs space-y-2"><Label htmlFor="cash-variance-threshold">الحد بالريال السعودي</Label><Input id="cash-variance-threshold" type="number" min="0" step="0.01" inputMode="decimal" value={varianceThreshold} onChange={(event) => setVarianceThreshold(event.target.value)} /></div>
        <PermissionAction permissions={["admin.settings.manage"]}><Button onClick={() => saveVarianceThreshold.mutate({ value: varianceThreshold })} disabled={saveVarianceThreshold.isPending || !/^\d+(\.\d{1,2})?$/.test(varianceThreshold)}>{saveVarianceThreshold.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}حفظ الحد</Button></PermissionAction>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-orange-600" />حد تنبيه قرب انتهاء الصلاحية</CardTitle><CardDescription>عند استلام دفعة لها تاريخ صلاحية ضمن هذا العدد من الأيام، ينشئ النظام تنبيهاً واحداً للدفعة. سيضاف الفحص الدوري لاحقاً عند تفعيل التشغيل الفعلي.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="w-full max-w-xs space-y-2"><Label htmlFor="expiry-alert-days">عدد الأيام</Label><Input id="expiry-alert-days" type="number" min="1" max="3650" step="1" inputMode="numeric" value={expiryDays} onChange={(event) => setExpiryDays(event.target.value)} /></div>
        <div className="flex flex-wrap gap-2"><PermissionAction permissions={["admin.settings.manage"]}><Button onClick={() => saveExpiryAlertDays.mutate({ value: Number(expiryDays) })} disabled={saveExpiryAlertDays.isPending || !/^\d+$/.test(expiryDays) || Number(expiryDays) < 1 || Number(expiryDays) > 3650}>{saveExpiryAlertDays.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}حفظ الحد</Button></PermissionAction><PermissionAction permissions={["admin.settings.manage"]}><Button variant="outline" onClick={() => scanExpiryAlerts.mutate()} disabled={scanExpiryAlerts.isPending || !expiryAlertDays.data}>{scanExpiryAlerts.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Bell className="me-2 h-4 w-4" />}فحص الدفعات الآن</Button></PermissionAction></div>
        <p className="w-full rounded-md bg-muted/60 p-3 text-sm text-muted-foreground" role="status">{!expiryAlertDays.data ? "لم يُضبط حد قرب انتهاء الصلاحية بعد؛ احفظ عدد الأيام أولاً لتفعيل الفحص." : lastExpiryScan ? `آخر فحص: ${lastExpiryScan.scanned} دفعة مفحوصة، و${lastExpiryScan.created} تنبيه جديد.` : `الحد الحالي: ${expiryAlertDays.data} يوم. لم يُشغّل فحص يدوي في هذه الجلسة بعد.`}</p>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />إدارة قواعد الإشعارات</CardTitle><CardDescription>عطّل أو فعّل نوع التنبيه مركزياً دون حذف السجل التاريخي للإشعارات السابقة.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {([ ["inventoryReorder", "تنبيه إعادة الطلب"], ["inventoryExpiry", "تنبيه قرب انتهاء الصلاحية"], ["posCashVariance", "تنبيه فرق نقد POS"] ] as const).map(([key, label]) => <div key={key} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-medium">{label}</p><p className="text-xs text-muted-foreground">{rules[key] ? "مفعل" : "معطل"}</p></div><Button type="button" variant={rules[key] ? "default" : "outline"} size="sm" onClick={() => setRules((current) => ({ ...current, [key]: !current[key] }))}>{rules[key] ? "تعطيل" : "تفعيل"}</Button></div>)}
        <PermissionAction permissions={["admin.settings.manage"]}><Button onClick={() => saveNotificationRules.mutate(rules)} disabled={saveNotificationRules.isPending}>{saveNotificationRules.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}حفظ قواعد الإشعارات</Button></PermissionAction>
      </CardContent>
    </Card>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {settingsSections.map((section) => <Card key={section.title}><CardContent className="flex items-start gap-4 p-6"><div className={`rounded-lg p-3 ${section.color}`}><section.icon className="h-6 w-6" /></div><div><h3 className="font-bold">{section.title}</h3><p className="mt-1 text-sm text-muted-foreground">{section.desc}</p></div></CardContent></Card>)}
    </div>
  </div>;
}
