import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PermissionAction } from "@/components/PermissionAction";
import { Building2, CheckCircle2, FileText, Loader2, Plus, ReceiptText, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";

const initialProfile = {
  legalName: "",
  tradeName: "",
  vatNumber: "",
  commercialRegistrationNumber: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  district: "",
  postalCode: "",
  countryCode: "SA",
  currencyCode: "SAR",
  isVatRegistered: false,
  eInvoicingMode: "disabled" as "disabled" | "sandbox" | "production",
};

export default function SaudiCompliance() {
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.saudiCompliance.companyProfile.useQuery();
  const { data: taxCodes } = trpc.saudiCompliance.taxCodes.list.useQuery();
  const { data: invoices } = trpc.saudiCompliance.invoices.list.useQuery({ limit: 10 });
  const [form, setForm] = useState(initialProfile);
  const [taxDialogOpen, setTaxDialogOpen] = useState(false);
  const [qrInvoice, setQrInvoice] = useState<any | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [taxForm, setTaxForm] = useState({ code: "VAT-15", name: "ضريبة القيمة المضافة الأساسية", category: "standard" as const, rate: "15" });
  const [connectionForm, setConnectionForm] = useState({ status: "not_configured" as "not_configured" | "ready" | "testing" | "active" | "error" | "suspended", credentialReference: "", csidReference: "" });
  const selectedEnvironment = form.eInvoicingMode === "production" ? "production" : "sandbox";
  const { data: zatcaConnection } = trpc.saudiCompliance.zatca.connection.useQuery({ companyProfileId: profile?.id ?? 0, environment: selectedEnvironment });
  const { data: zatcaSubmissions } = trpc.saudiCompliance.zatca.submissions.useQuery({ limit: 10 });
  const { data: zatcaReadiness } = trpc.saudiCompliance.zatca.readiness.useQuery();
  const [vatPeriod] = useState(() => {
    const endDate = new Date();
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    return { startDate, endDate };
  });
  const { data: vatReconciliation, isLoading: vatReconciliationLoading } = trpc.reports.vatReconciliation.useQuery(vatPeriod);

  useEffect(() => {
    if (!profile) return;
    setForm({
      legalName: profile.legalName,
      tradeName: profile.tradeName ?? "",
      vatNumber: profile.vatNumber ?? "",
      commercialRegistrationNumber: profile.commercialRegistrationNumber ?? "",
      addressLine1: profile.addressLine1 ?? "",
      addressLine2: profile.addressLine2 ?? "",
      city: profile.city ?? "",
      district: profile.district ?? "",
      postalCode: profile.postalCode ?? "",
      countryCode: profile.countryCode,
      currencyCode: profile.currencyCode,
      isVatRegistered: profile.isVatRegistered,
      eInvoicingMode: profile.eInvoicingMode,
    });
  }, [profile]);

  useEffect(() => {
    if (!zatcaConnection) return;
    setConnectionForm({ status: zatcaConnection.status, credentialReference: zatcaConnection.credentialReference ?? "", csidReference: zatcaConnection.csidReference ?? "" });
  }, [zatcaConnection]);

  useEffect(() => {
    let cancelled = false;
    if (!qrInvoice?.qrPayload) { setQrImageUrl(""); return; }
    QRCode.toDataURL(qrInvoice.qrPayload, { width: 280, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => { if (!cancelled) setQrImageUrl(url); })
      .catch(() => { if (!cancelled) setQrImageUrl(""); });
    return () => { cancelled = true; };
  }, [qrInvoice]);

  const saveProfile = trpc.saudiCompliance.saveCompanyProfile.useMutation({
    onSuccess: () => {
      utils.saudiCompliance.companyProfile.invalidate();
      toast.success("تم حفظ إعدادات المنشأة والامتثال");
    },
    onError: (error) => toast.error(error.message),
  });
  const createTaxCode = trpc.saudiCompliance.taxCodes.create.useMutation({
    onSuccess: () => {
      utils.saudiCompliance.taxCodes.list.invalidate();
      setTaxDialogOpen(false);
      toast.success("تمت إضافة الرمز الضريبي");
    },
    onError: (error) => toast.error(error.message),
  });
  const saveZatcaConnection = trpc.saudiCompliance.zatca.saveConnection.useMutation({
    onSuccess: () => { utils.saudiCompliance.zatca.connection.invalidate(); toast.success("تم حفظ حالة إعداد اتصال زاتكا دون تخزين أي أسرار"); },
    onError: (error) => toast.error(error.message),
  });

  const statusText = form.eInvoicingMode === "production" ? "إنتاج" : form.eInvoicingMode === "sandbox" ? "بيئة اختبار" : "غير مفعّل";
  const statusVariant = form.eInvoicingMode === "production" ? "default" : form.eInvoicingMode === "sandbox" ? "secondary" : "outline";

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">الامتثال السعودي والفوترة الإلكترونية</h1>
          <p className="mt-1 text-sm text-muted-foreground">بيانات المنشأة، ضريبة القيمة المضافة، وحالة الفواتير الإلكترونية.</p>
        </div>
        <Badge variant={statusVariant as "default" | "secondary" | "outline"} className="w-fit gap-1.5 px-3 py-1.5">
          <ShieldCheck className="h-4 w-4" /> الفوترة الإلكترونية: {statusText}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> بيانات المنشأة</CardTitle>
            <CardDescription>تستخدم هذه البيانات في إعداد الفواتير الضريبية والتكامل الرسمي لاحقاً.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div> : <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>الاسم القانوني للمنشأة</Label><Input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} /></div>
                <div className="space-y-2"><Label>الاسم التجاري</Label><Input value={form.tradeName} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} /></div>
                <div className="space-y-2"><Label>الرقم الضريبي</Label><Input dir="ltr" value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} /></div>
                <div className="space-y-2"><Label>رقم السجل التجاري</Label><Input dir="ltr" value={form.commercialRegistrationNumber} onChange={(e) => setForm({ ...form, commercialRegistrationNumber: e.target.value })} /></div>
                <div className="space-y-2"><Label>العنوان</Label><Input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} /></div>
                <div className="space-y-2"><Label>الحي</Label><Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></div>
                <div className="space-y-2"><Label>المدينة</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div className="space-y-2"><Label>الرمز البريدي</Label><Input dir="ltr" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></div>
              </div>
              <div className="flex flex-wrap items-center gap-5 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-2"><Switch checked={form.isVatRegistered} onCheckedChange={(isVatRegistered) => setForm({ ...form, isVatRegistered })} /><Label>المنشأة مسجلة في ضريبة القيمة المضافة</Label></div>
                <div className="min-w-48 flex-1 space-y-1"><Label>وضع الفوترة الإلكترونية</Label><Select value={form.eInvoicingMode} onValueChange={(value) => setForm({ ...form, eInvoicingMode: value as typeof form.eInvoicingMode })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="disabled">غير مفعّل</SelectItem><SelectItem value="sandbox">بيئة اختبار</SelectItem><SelectItem value="production">إنتاج</SelectItem></SelectContent></Select></div>
              </div>
              <div className="flex justify-end"><PermissionAction permissions={["compliance.vat.manage"]}><Button disabled={!form.legalName || saveProfile.isPending} onClick={() => saveProfile.mutate(form)}>{saveProfile.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}حفظ إعدادات المنشأة</Button></PermissionAction></div>
            </>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> جاهزية النظام</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="flex items-center justify-between"><span>العملة الافتراضية</span><strong>{form.currencyCode}</strong></p>
            <p className="flex items-center justify-between"><span>بلد المنشأة</span><strong>{form.countryCode}</strong></p>
            <p className="flex items-center justify-between"><span>رموز ضريبية مفعلة</span><strong>{taxCodes?.filter((code) => code.isActive).length ?? 0}</strong></p>
            <p className="border-t pt-3 text-muted-foreground">لا يتم إرسال أي فاتورة إلى جهة خارجية من هذه الصفحة. يجب تهيئة بيئة الاختبار واعتمادات المنشأة أولاً.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20">
        <CardHeader><CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" />مطابقة ضريبة القيمة المضافة مع دفتر الأستاذ</CardTitle><CardDescription>الفترة الحالية من أول الشهر إلى اليوم. تقارن المطابقة بين المستندات المعتمدة والقيود المرحلة، ولا تعدل أي رصيد.</CardDescription></CardHeader>
        <CardContent>{vatReconciliationLoading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div> : !vatReconciliation?.configured ? <div className="rounded-lg border border-amber-500/30 bg-amber-50 p-4 text-sm text-amber-900">يلزم ضبط خريطة حسابات نقاط البيع، ومنها حسابا ضريبة المخرجات والمدخلات، من صفحة الإعدادات قبل تشغيل المطابقة مع دفتر الأستاذ.</div> : <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><Badge variant={vatReconciliation.matched ? "default" : "destructive"}>{vatReconciliation.matched ? "المستندات والدفتر متطابقان" : "فروقات VAT تحتاج مراجعة"}</Badge><span className="text-sm text-muted-foreground">صافي المستندات: {vatReconciliation.netDocumentVat} SAR · صافي الدفتر: {vatReconciliation.netLedgerVat} SAR</span></div><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">ضريبة مخرجات المستندات</p><p className="mt-1 font-semibold">{vatReconciliation.documentOutputTax} SAR</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">ضريبة مخرجات الدفتر</p><p className="mt-1 font-semibold">{vatReconciliation.outputTaxLedger} SAR</p><p className="mt-1 text-xs text-muted-foreground">الفرق: {vatReconciliation.outputDifference} SAR</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">ضريبة مدخلات المستندات</p><p className="mt-1 font-semibold">{vatReconciliation.documentInputTax} SAR</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">ضريبة مدخلات الدفتر</p><p className="mt-1 font-semibold">{vatReconciliation.inputTaxLedger} SAR</p><p className="mt-1 text-xs text-muted-foreground">الفرق: {vatReconciliation.inputDifference} SAR</p></div></div><p className="text-xs text-muted-foreground">تشمل ضريبة المخرجات أثر مردودات POS المكتملة في الفترة. أي فرق يعني أن مستنداً أو قيداً أو خريطة حسابات يحتاج مراجعة قبل الإقرار.</p></div>}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> اتصال زاتكا / فاتورة</CardTitle>
          <CardDescription>تُحفظ حالة الربط ومراجع الأسرار فقط. أدخل المفاتيح والشهادات لاحقاً من إعدادات الأسرار، وليس هنا.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2"><Label>البيئة</Label><Input readOnly value={selectedEnvironment === "production" ? "إنتاج" : "بيئة اختبار"} /></div>
            <div className="space-y-2"><Label>الحالة</Label><Select value={connectionForm.status} onValueChange={(value) => setConnectionForm({ ...connectionForm, status: value as typeof connectionForm.status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="not_configured">غير مهيأ</SelectItem><SelectItem value="ready">جاهز للاختبار</SelectItem><SelectItem value="testing">قيد الاختبار</SelectItem><SelectItem value="active">نشط</SelectItem><SelectItem value="error">خطأ</SelectItem><SelectItem value="suspended">معلّق</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>مرجع اعتماد البيئة</Label><Input dir="ltr" placeholder="ZATCA_SANDBOX_CREDENTIAL" value={connectionForm.credentialReference} onChange={(e) => setConnectionForm({ ...connectionForm, credentialReference: e.target.value })} /></div>
            <div className="space-y-2"><Label>مرجع CSID</Label><Input dir="ltr" placeholder="ZATCA_SANDBOX_CSID" value={connectionForm.csidReference} onChange={(e) => setConnectionForm({ ...connectionForm, csidReference: e.target.value })} /></div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3 text-sm"><div className="space-y-1"><Badge variant={zatcaReadiness?.ready ? "default" : "outline"}>{zatcaReadiness?.ready ? "جاهز لمسار الاختبار" : "غير جاهز للإرسال"}</Badge><p className="text-muted-foreground">{zatcaReadiness?.issues?.length ? `متطلبات متبقية: ${zatcaReadiness.issues.join("، ")}` : "لا يتم الإرسال خارجياً قبل إدخال الاعتمادات الرسمية واجتياز بيئة الاختبار."}</p></div><PermissionAction permissions={["compliance.zatca.manage"]}><Button disabled={!profile?.id || saveZatcaConnection.isPending} onClick={() => saveZatcaConnection.mutate({ companyProfileId: profile!.id, environment: selectedEnvironment, ...connectionForm, credentialReference: connectionForm.credentialReference || null, csidReference: connectionForm.csidReference || null })}>{saveZatcaConnection.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}حفظ إعداد الاتصال</Button></PermissionAction></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0"><div><CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" /> الرموز الضريبية</CardTitle><CardDescription>تستخدم في البنود والفواتير والتقارير الضريبية.</CardDescription></div><Dialog open={taxDialogOpen} onOpenChange={setTaxDialogOpen}><DialogTrigger asChild><Button size="sm"><Plus className="me-2 h-4 w-4" />إضافة رمز</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>إضافة رمز ضريبي</DialogTitle></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>الرمز</Label><Input value={taxForm.code} onChange={(e) => setTaxForm({ ...taxForm, code: e.target.value })} /></div><div className="space-y-2"><Label>الاسم</Label><Input value={taxForm.name} onChange={(e) => setTaxForm({ ...taxForm, name: e.target.value })} /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>الفئة</Label><Select value={taxForm.category} onValueChange={(value) => setTaxForm({ ...taxForm, category: value as typeof taxForm.category })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">أساسية</SelectItem><SelectItem value="zero_rated">صفرية</SelectItem><SelectItem value="exempt">معفاة</SelectItem><SelectItem value="out_of_scope">خارج النطاق</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>النسبة</Label><Input dir="ltr" value={taxForm.rate} onChange={(e) => setTaxForm({ ...taxForm, rate: e.target.value })} /></div></div><Button className="w-full" disabled={createTaxCode.isPending} onClick={() => createTaxCode.mutate(taxForm)}>حفظ الرمز</Button></div></DialogContent></Dialog></CardHeader>
        <CardContent><Table><TableHeader><TableRow><TableHead>الرمز</TableHead><TableHead>الاسم</TableHead><TableHead>الفئة</TableHead><TableHead>النسبة</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader><TableBody>{taxCodes?.length ? taxCodes.map((code) => <TableRow key={code.id}><TableCell className="font-mono">{code.code}</TableCell><TableCell>{code.name}</TableCell><TableCell>{code.category}</TableCell><TableCell>{code.rate}%</TableCell><TableCell><Badge variant={code.isActive ? "default" : "secondary"}>{code.isActive ? "مفعّل" : "موقوف"}</Badge></TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">لم تتم إضافة رموز ضريبية بعد.</TableCell></TableRow>}</TableBody></Table></CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> آخر الفواتير الضريبية</CardTitle><CardDescription>يتاح رمز QR للمرحلة الأولى عند إصدار الفاتورة، أما التوقيع الرسمي فيستلزم شهادة بيئة زاتكا.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>رقم الفاتورة</TableHead><TableHead>النوع</TableHead><TableHead>الحالة</TableHead><TableHead>الإجمالي</TableHead><TableHead>الامتثال</TableHead><TableHead>QR</TableHead></TableRow></TableHeader><TableBody>{invoices?.length ? invoices.map((invoice) => <TableRow key={invoice.id}><TableCell className="font-mono">{invoice.invoiceNumber}</TableCell><TableCell>{invoice.invoiceType}</TableCell><TableCell>{invoice.status}</TableCell><TableCell>{invoice.totalAmount} {invoice.currencyCode}</TableCell><TableCell><Badge variant={invoice.complianceStatus === "accepted" ? "default" : "outline"}>{invoice.complianceStatus}</Badge></TableCell><TableCell>{invoice.qrPayload ? <Button size="sm" variant="outline" onClick={() => setQrInvoice(invoice)}>عرض QR</Button> : <span className="text-xs text-muted-foreground">غير متاح</span>}</TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">لا توجد فواتير ضريبية صادرة حتى الآن.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>

      <Dialog open={Boolean(qrInvoice)} onOpenChange={(open) => { if (!open) setQrInvoice(null); }}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>رمز QR للفاتورة {qrInvoice?.invoiceNumber}</DialogTitle></DialogHeader><div className="space-y-3 text-center"><p className="text-sm text-muted-foreground">حمولة TLV للمرحلة الأولى من زاتكا، مولدة من بيانات الفاتورة المحفوظة.</p>{qrImageUrl ? <img src={qrImageUrl} alt={`رمز QR للفاتورة ${qrInvoice?.invoiceNumber}`} className="mx-auto h-64 w-64 rounded-lg border bg-white p-2" /> : <Loader2 className="mx-auto h-8 w-8 animate-spin" />}<p className="break-all rounded-md bg-muted p-2 text-[10px] text-muted-foreground" dir="ltr">{qrInvoice?.qrPayload}</p></div></DialogContent></Dialog>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> طابور زاتكا وسجل الإرسال</CardTitle><CardDescription>التسجيل محلي حالياً؛ سيظهر Reporting للفواتير المبسطة وClearance للفواتير الضريبية القياسية.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>الفاتورة</TableHead><TableHead>المسار</TableHead><TableHead>الحالة</TableHead><TableHead>المحاولة</TableHead><TableHead>آخر تحديث</TableHead></TableRow></TableHeader><TableBody>{zatcaSubmissions?.length ? zatcaSubmissions.map((attempt) => <TableRow key={attempt.id}><TableCell className="font-mono">#{attempt.salesInvoiceId}</TableCell><TableCell>{attempt.submissionType}</TableCell><TableCell><Badge variant={attempt.status === "accepted" ? "default" : attempt.status === "rejected" ? "destructive" : "outline"}>{attempt.status}</Badge></TableCell><TableCell>{attempt.attemptNumber}</TableCell><TableCell>{new Date(attempt.createdAt).toLocaleString("ar-SA")}</TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">لا توجد فواتير في طابور زاتكا بعد.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
    </div>
  );
}
