import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowUpDown } from "lucide-react";

export default function StockMovements() {
  const { t } = useI18n();
  const { data: movements, isLoading } = trpc.stock.movements.useQuery();
  const { data: productsList } = trpc.products.list.useQuery();
  const { data: warehousesList } = trpc.warehouses.list.useQuery();

  const typeLabels: Record<string, string> = {
    purchase: t.inv.purchase, sale: t.inv.sale, transfer_in: t.inv.transferIn, transfer_out: t.inv.transferOut,
    production_in: t.inv.productionIn, production_out: t.inv.productionOut, waste: t.inv.waste, adjustment: t.inv.adjustment, return: t.inv.return_,
  };
  const typeColors: Record<string, string> = {
    purchase: "default", sale: "destructive", transfer_in: "default", transfer_out: "secondary",
    production_in: "default", production_out: "secondary", waste: "destructive", adjustment: "outline", return: "outline",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t.nav.stockMovements}</h1>
      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : !movements?.length ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><ArrowUpDown className="h-12 w-12 mb-3 opacity-50" /><p>{t.noData}</p></div>
          ) : (
            <Table><TableHeader><TableRow><TableHead>{t.date}</TableHead><TableHead>{t.inv.productName}</TableHead><TableHead>{t.inv.warehouse}</TableHead><TableHead>{t.type}</TableHead><TableHead>{t.inv.quantity}</TableHead><TableHead>{t.notes}</TableHead></TableRow></TableHeader>
              <TableBody>{movements.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell>{new Date(m.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{productsList?.find((p: any) => p.id === m.productId)?.name || m.productId}</TableCell>
                  <TableCell>{warehousesList?.find((w: any) => w.id === m.warehouseId)?.name || m.warehouseId}</TableCell>
                  <TableCell><Badge variant={(typeColors[m.type] || "outline") as any}>{typeLabels[m.type] || m.type}</Badge></TableCell>
                  <TableCell className="font-mono">{m.quantity}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{m.notes || "-"}</TableCell>
                </TableRow>
              ))}</TableBody></Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
