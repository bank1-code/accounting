import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PermissionAction } from "@/components/PermissionAction";
import { Plus, Loader2, FileText, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Documents() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: docs, isLoading } = trpc.documents.list.useQuery();
  const uploadMut = trpc.documents.create.useMutation({
    onSuccess: () => { utils.documents.list.invalidate(); setOpen(false); toast.success(t.success); },
    onError: () => toast.error(t.error),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "invoice" as string, relatedType: "", relatedId: 0, notes: "" });

  const typeLabels: Record<string, string> = { invoice: t.adm.invoice, contract: t.adm.contract, certificate: t.adm.certificate, report: t.adm.report, other: t.adm.other };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t.nav.documents}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <PermissionAction permissions={["admin.documents.manage"]}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{t.adm.uploadDocument}</Button></DialogTrigger>
          </PermissionAction>
          <DialogContent>
            <DialogHeader><DialogTitle>{t.adm.uploadDocument}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>{t.name_}</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div><Label>{t.type}</Label>
                <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">{t.adm.invoice}</SelectItem>
                    <SelectItem value="contract">{t.adm.contract}</SelectItem>
                    <SelectItem value="certificate">{t.adm.certificate}</SelectItem>
                    <SelectItem value="report">{t.adm.report}</SelectItem>
                    <SelectItem value="other">{t.adm.other}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t.notes}</Label><Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              <p className="text-xs text-muted-foreground">* {t.adm.fileUploadNote}</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>{t.cancel}</Button>
                <Button onClick={() => { if (!form.name) { toast.error(t.required); return; } uploadMut.mutate({ ...form, fileUrl: "", fileKey: "", mimeType: "application/pdf", fileSize: 0 }); }} disabled={uploadMut.isPending}>
                  {uploadMut.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t.save}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : !docs?.length ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><FileText className="h-12 w-12 mb-3 opacity-50" /><p>{t.noData}</p></div>
          ) : (
            <Table><TableHeader><TableRow><TableHead>{t.name_}</TableHead><TableHead>{t.type}</TableHead><TableHead>{t.date}</TableHead><TableHead>{t.actions}</TableHead></TableRow></TableHeader>
              <TableBody>{docs.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell><Badge variant="outline">{typeLabels[d.type] || d.type}</Badge></TableCell>
                  <TableCell>{new Date(d.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>{d.fileUrl && <Button variant="ghost" size="sm" onClick={() => window.open(d.fileUrl, "_blank")}><Download className="h-4 w-4" /></Button>}</TableCell>
                </TableRow>
              ))}</TableBody></Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
