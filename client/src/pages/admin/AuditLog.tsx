import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileSearch } from "lucide-react";

export default function AuditLog() {
  const { t } = useI18n();
  const { data: logs, isLoading } = trpc.auditLog.list.useQuery();

  const actionColors: Record<string, string> = { create: "default", update: "secondary", delete: "destructive" };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t.nav.auditLog}</h1>
      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : !logs?.length ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><FileSearch className="h-12 w-12 mb-3 opacity-50" /><p>{t.noData}</p></div>
          ) : (
            <Table><TableHeader><TableRow><TableHead>{t.adm.user}</TableHead><TableHead>{t.adm.action}</TableHead><TableHead>{t.adm.entity}</TableHead><TableHead>{t.date}</TableHead></TableRow></TableHeader>
              <TableBody>{logs.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.userName || `User ${l.userId}`}</TableCell>
                  <TableCell><Badge variant={(actionColors[l.action] || "outline") as any}>{l.action}</Badge></TableCell>
                  <TableCell>{l.entityType} #{l.entityId}</TableCell>
                  <TableCell>{new Date(l.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}</TableBody></Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
