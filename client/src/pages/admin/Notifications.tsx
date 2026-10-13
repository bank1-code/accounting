import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Check, CircleAlert, Inbox, Loader2, Package, ShieldAlert, Wallet } from "lucide-react";

const iconForNotification = (type: string) => {
  if (type.includes("stock") || type.includes("expiry")) return Package;
  if (type.includes("cash") || type.includes("sales")) return Wallet;
  if (type.includes("security") || type.includes("backup")) return ShieldAlert;
  return CircleAlert;
};

export default function Notifications() {
  const { t, locale } = useI18n();
  const utils = trpc.useUtils();
  const { data: notifications, isLoading, error } = trpc.notifications.list.useQuery();
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
  });

  const formatDate = (value?: Date | string | number | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString(locale === "ar" ? "ar-SA" : "en-US");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.nav.notifications}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.notifications.description}</p>
      </div>

      {isLoading ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : error ? (
        <Card><CardContent className="p-6 text-sm text-destructive">{t.notifications.loadError}</CardContent></Card>
      ) : !notifications?.length ? (
        <Card><CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center text-muted-foreground"><Inbox className="h-12 w-12" /><p>{t.notifications.empty}</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const Icon = iconForNotification(notification.type);
            return <Card key={notification.id} className={notification.isRead ? "opacity-75" : "border-primary/30"}>
              <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
                <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base">{notification.title}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(notification.createdAt)}</p>
                </div>
                <Badge variant={notification.isRead ? "secondary" : "default"}>{notification.isRead ? t.notifications.read : t.notifications.unread}</Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 ps-14 sm:flex-row sm:items-end sm:justify-between">
                <p className="text-sm text-muted-foreground">{notification.content || notification.type}</p>
                {!notification.isRead && <Button size="sm" variant="outline" disabled={markRead.isPending} onClick={() => markRead.mutate({ id: notification.id })}><Check className="me-1 h-4 w-4" />{t.notifications.markRead}</Button>}
              </CardContent>
            </Card>;
          })}
        </div>
      )}
    </div>
  );
}
