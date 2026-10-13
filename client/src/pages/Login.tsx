import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Building2, Eye, EyeOff, Loader2, LockKeyhole, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Login() {
  const [, setLocation] = useLocation();
  const { t, dir, locale, setLocale } = useI18n();
  const utils = trpc.useUtils();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = trpc.auth.login.useMutation({
    onSuccess: async () => { await utils.auth.me.invalidate(); setLocation("/"); },
    onError: () => toast.error(t.login.invalidCredentials),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (username.trim() && password) login.mutate({ username: username.trim(), password });
  };

  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4" dir={dir}>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,.20),transparent_28%),radial-gradient(circle_at_80%_70%,rgba(14,165,233,.16),transparent_30%)]" />
    <Card className="relative w-full max-w-md border-white/10 bg-white/95 shadow-2xl"><CardHeader className="space-y-3 text-center"><div className="flex justify-end"><button type="button" className="text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}>{locale === "ar" ? "English" : "العربية"}</button></div><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white"><Building2 className="h-7 w-7" /></div><div><CardTitle className="text-2xl">{t.login.title}</CardTitle><CardDescription className="mt-1">{t.login.description}</CardDescription></div></CardHeader><CardContent><form className="space-y-5" onSubmit={submit}><div className="space-y-2"><Label htmlFor="username">{t.login.username}</Label><div className="relative"><UserRound className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="username" autoComplete="username" className="ps-10" value={username} onChange={(event) => setUsername(event.target.value)} disabled={login.isPending} /></div></div><div className="space-y-2"><Label htmlFor="password">{t.login.password}</Label><div className="relative"><LockKeyhole className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" className="ps-10 pe-10" value={password} onChange={(event) => setPassword(event.target.value)} disabled={login.isPending} /><button type="button" aria-label={t.login.togglePassword} className="absolute end-3 top-2.5 text-muted-foreground" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div><Button type="submit" className="w-full" disabled={login.isPending || !username.trim() || !password}>{login.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{t.login.submit}</Button></form><p className="mt-6 text-center text-xs leading-5 text-muted-foreground">{t.login.securityNote}</p></CardContent></Card>
  </main>;
}
