import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, ChefHat, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Recipes() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: recipesList, isLoading } = trpc.recipes.list.useQuery();
  const { data: productsList } = trpc.products.list.useQuery();
  const createMut = trpc.recipes.create.useMutation({
    onSuccess: () => { utils.recipes.list.invalidate(); setOpen(false); toast.success(t.success); },
    onError: () => toast.error(t.error),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ productId: 0, name: "", outputQuantity: "1", yieldPercent: "100", instructions: "" });
  const [lines, setLines] = useState<Array<{ ingredientId: number; quantity: string; wastePercent: string; unitCost: string }>>([]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t.nav.recipes}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{t.mfg.addRecipe}</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{t.mfg.addRecipe}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t.mfg.recipeName}</Label>
                  <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div>
                  <Label>{t.mfg.outputProduct}</Label>
                  <Select value={String(form.productId || "")} onValueChange={v => setForm({...form, productId: Number(v)})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{productsList?.filter((p: any) => p.type === "finished" || p.type === "semi_finished").map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>{t.mfg.outputQuantity}</Label><Input type="number" value={form.outputQuantity} onChange={e => setForm({...form, outputQuantity: e.target.value})} /></div>
                <div><Label>{t.mfg.yieldPercent} %</Label><Input type="number" value={form.yieldPercent} onChange={e => setForm({...form, yieldPercent: e.target.value})} /></div>
                <div><Label>{t.mfg.standardCost}</Label><div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">{t.mfg.recipeCostCalculated}</div></div>
              </div>
              <div><Label>التعليمات</Label><Textarea value={form.instructions} onChange={e => setForm({...form, instructions: e.target.value})} rows={3} /></div>
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t.mfg.ingredients}</Label>
                <Button variant="outline" size="sm" onClick={() => setLines([...lines, { ingredientId: 0, quantity: "1", wastePercent: "0", unitCost: "0" }])}><Plus className="h-3 w-3 me-1" />{t.mfg.addIngredient}</Button>
              </div>
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 items-end">
                  <Select value={String(line.ingredientId || "")} onValueChange={v => { const nl = [...lines]; nl[i].ingredientId = Number(v); setLines(nl); }}>
                    <SelectTrigger><SelectValue placeholder={t.mfg.ingredient} /></SelectTrigger>
                    <SelectContent>{productsList?.filter((p: any) => p.type === "raw_material" || p.type === "semi_finished").map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" placeholder={t.inv.quantity} value={line.quantity} onChange={e => { const nl = [...lines]; nl[i].quantity = e.target.value; setLines(nl); }} />
                  <Input type="number" placeholder={t.mfg.wastePercent + " %"} value={line.wastePercent} onChange={e => { const nl = [...lines]; nl[i].wastePercent = e.target.value; setLines(nl); }} />
                  <Input type="number" placeholder={t.inv.costPrice} value={line.unitCost} onChange={e => { const nl = [...lines]; nl[i].unitCost = e.target.value; setLines(nl); }} />
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>{t.cancel}</Button>
                <Button onClick={() => { if (!form.name || !form.productId) { toast.error(t.required); return; } createMut.mutate({ ...form, lines: lines.filter(l => l.ingredientId > 0) }); }} disabled={createMut.isPending}>
                  {createMut.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t.save}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : !recipesList?.length ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><ChefHat className="h-12 w-12 mb-3 opacity-50" /><p>{t.noData}</p></div>
          ) : (
            <Table><TableHeader><TableRow><TableHead>{t.mfg.recipeName}</TableHead><TableHead>{t.mfg.outputProduct}</TableHead><TableHead>{t.mfg.outputQuantity}</TableHead><TableHead>{t.mfg.yieldPercent}</TableHead><TableHead>{t.mfg.standardCost}</TableHead></TableRow></TableHeader>
              <TableBody>{recipesList.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{productsList?.find((p: any) => p.id === r.productId)?.name || "-"}</TableCell>
                  <TableCell>{r.outputQuantity}</TableCell>
                  <TableCell>{r.yieldPercent}%</TableCell>
                  <TableCell>
                    <div>{parseFloat(String(r.costBreakdown?.totalCost ?? r.standardCost)).toLocaleString()} SAR</div>
                    {Number(r.costBreakdown?.includedAddonCost || 0) > 0 && <div className="text-xs text-muted-foreground">{t.mfg.includedAddonsCost}: {parseFloat(String(r.costBreakdown.includedAddonCost)).toLocaleString()} SAR</div>}
                  </TableCell>
                </TableRow>
              ))}</TableBody></Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
