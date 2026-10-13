import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const installed = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(installed);
    setIsIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1));
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setIsInstalled(true); setDeferredPrompt(null); };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (isInstalled) return null;
  if (deferredPrompt) return <Button variant="ghost" size="icon" aria-label="تثبيت دكتره كتطبيق" title="تثبيت التطبيق" onClick={async () => {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") setDeferredPrompt(null);
  }}><Download className="h-4 w-4" /></Button>;
  if (!isIos) return null;
  return <Dialog><DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="إرشادات تثبيت دكتره على iPhone أو iPad" title="تثبيت التطبيق"><Download className="h-4 w-4" /></Button></DialogTrigger><DialogContent dir="rtl" className="max-w-sm"><DialogHeader><DialogTitle>تثبيت دكتره على iPhone أو iPad</DialogTitle><DialogDescription>من Safari اضغط زر المشاركة، ثم اختر «إضافة إلى الشاشة الرئيسية»، وأكد الإضافة لتشغيل دكتره كتطبيق مستقل.</DialogDescription></DialogHeader></DialogContent></Dialog>;
}
