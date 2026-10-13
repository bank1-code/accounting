import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Tags, Ruler } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Categories() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: cats, isLoading: catsLoading } = trpc.categories.list.useQuery();
  const { data: unitsList, isLoading: unitsLoading } = trpc.units.list.useQuery();
  const createCatMut = trpc.categories.create.useMutation({ onSuccess: () => { utils.categories.list.invalidate(); setCatOpen(false); toast.success(t.success); }, onError: () => toast.error(t.error) });
  const createUnitMut = trpc.units.create.useMutation({ onSuccess: () => { utils.units.list.invalidate(); setUnitOpen(false); toast.success(t.success); }, onError: () => toast.error(t.error) });

  const [catOpen, setCatOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [unitForm, setUnitForm] = useState({ name: "", symbol: "" });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t.nav.categories} & {t.nav.units}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">{t.nav.categories}</CardTitle>
            <Dialog open={catOpen} onOpenChange={setCatOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-3 w-3 me-1" />{t.add}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t.add} {t.inv.category}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>{t.name_}</Label><Input value={catName} onChange={e => setCatName(e.target.value)} /></div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setCatOpen(false)}>{t.cancel}</Button>
                    <Button onClick={() => { if (!catName) { toast.error(t.required); return; } createCatMut.mutate({ name: catName }); }} disabled={createCatMut.isPending}>
                      {createCatMut.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t.save}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0">
            {catsLoading ? <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin" /></div> : !cats?.length ? (
              <div className="flex flex-col items-center p-8 text-muted-foreground"><Tags className="h-10 w-10 mb-2 opacity-50" /><p>{t.noData}</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t.name_}</TableHead></TableRow></TableHeader>
                <TableBody>{cats.map((c: any) => <TableRow key={c.id}><TableCell>{c.id}</TableCell><TableCell className="font-medium">{c.name}</TableCell></TableRow>)}</TableBody></Table>
            )}
          </CardContent>
        </Card>
        {/* Units */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">{t.nav.units}</CardTitle>
            <Dialog open={unitOpen} onOpenChange={setUnitOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-3 w-3 me-1" />{t.add}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t.add} {t.inv.unit}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>{t.name_}</Label><Input value={unitForm.name} onChange={e => setUnitForm({...unitForm, name: e.target.value})} placeholder="كيلوجرام" /></div>
                  <div><Label>الرمز</Label><Input value={unitForm.symbol} onChange={e => setUnitForm({...unitForm, symbol: e.target.value})} placeholder="كجم" /></div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setUnitOpen(false)}>{t.cancel}</Button>
                    <Button onClick={() => { if (!unitForm.name || !unitForm.symbol) { toast.error(t.required); return; } createUnitMut.mutate(unitForm); }} disabled={createUnitMut.isPending}>
                      {createUnitMut.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t.save}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0">
            {unitsLoading ? <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin" /></div> : !unitsList?.length ? (
              <div className="flex flex-col items-center p-8 text-muted-foreground"><Ruler className="h-10 w-10 mb-2 opacity-50" /><p>{t.noData}</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>{t.name_}</TableHead><TableHead>الرمز</TableHead></TableRow></TableHeader>
                <TableBody>{unitsList.map((u: any) => <TableRow key={u.id}><TableCell className="font-medium">{u.name}</TableCell><TableCell>{u.symbol}</TableCell></TableRow>)}</TableBody></Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
