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
import { Plus, Loader2, Monitor, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function PosSessions() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: sessions, isLoading } = trpc.posSessions.list.useQuery();
  const { data: branchesList } = trpc.branches.list.useQuery();
  const openMut = trpc.posSessions.open.useMutation({ onSuccess: () => { utils.posSessions.list.invalidate(); setOpen(false); toast.success(t.success); }, onError: () => toast.error(t.error) });
  const closeMut = trpc.posSessions.close.useMutation({ onSuccess: () => { utils.posSessions.list.invalidate(); setCloseOpen(false); toast.success(t.success); } });
  const [open, setOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [form, setForm] = useState({ branchId: 0, openingBalance: "0" });
  const [closingBalance, setClosingBalance] = useState("0");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t.nav.posSessions}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <PermissionAction permissions={["pos.session.open"]}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{t.pos.openSession}</Button></DialogTrigger>
          </PermissionAction>
          <DialogContent>
            <DialogHeader><DialogTitle>{t.pos.openSession}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>{t.nav.branches}</Label>
                <Select value={String(form.branchId || "")} onValueChange={v => setForm({...form, branchId: Number(v)})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{branchesList?.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t.pos.openingCash}</Label><Input type="number" value={form.openingBalance} onChange={e => setForm({...form, openingBalance: e.target.value})} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>{t.cancel}</Button>
                <Button onClick={() => { if (!form.branchId) { toast.error(t.required); return; } openMut.mutate(form); }} disabled={openMut.isPending}>
                  {openMut.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t.pos.openSession}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.pos.closeSession}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t.pos.closingCash}</Label><Input type="number" value={closingBalance} onChange={e => setClosingBalance(e.target.value)} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCloseOpen(false)}>{t.cancel}</Button>
              <PermissionAction permissions={["pos.session.close"]}>
                <Button variant="destructive" onClick={() => { if (!selectedSession) return; closeMut.mutate({ id: selectedSession.id, closingBalance }); }} disabled={closeMut.isPending}>
                  {closeMut.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t.pos.closeSession}
                </Button>
              </PermissionAction>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : !sessions?.length ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><Monitor className="h-12 w-12 mb-3 opacity-50" /><p>{t.noData}</p></div>
          ) : (
            <Table><TableHeader><TableRow><TableHead>{t.nav.branches}</TableHead><TableHead>{t.pos.openingCash}</TableHead><TableHead>{t.pos.closingCash}</TableHead><TableHead>{t.pos.totalSales}</TableHead><TableHead>{t.date}</TableHead><TableHead>{t.status}</TableHead><TableHead>{t.actions}</TableHead></TableRow></TableHeader>
              <TableBody>{sessions.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>{branchesList?.find((b: any) => b.id === s.branchId)?.name || "-"}</TableCell>
                  <TableCell>{parseFloat(s.openingBalance || "0").toLocaleString()} SAR</TableCell>
                  <TableCell>{s.closingBalance ? `${parseFloat(s.closingBalance).toLocaleString()} SAR` : "-"}</TableCell>
                  <TableCell className="font-bold">{parseFloat(s.totalSales || "0").toLocaleString()} SAR</TableCell>
                  <TableCell>{new Date(s.openedAt).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant={s.status === "open" ? "default" : "secondary"}>{s.status === "open" ? t.active : t.close}</Badge></TableCell>
                  <TableCell>{s.status === "open" && <PermissionAction permissions={["pos.session.close"]}><Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setSelectedSession(s); setClosingBalance("0"); setCloseOpen(true); }}><XCircle className="h-4 w-4 me-1" />{t.pos.closeSession}</Button></PermissionAction>}</TableCell>
                </TableRow>
              ))}</TableBody></Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
