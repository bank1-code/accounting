import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Brain, Sparkles, Send } from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";

export default function AiAnalysis() {
  const { t } = useI18n();
  const { data: salesData } = trpc.reports.sales.useQuery({ startDate: (() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d; })(), endDate: new Date() });
  const { data: inventoryData } = trpc.reports.inventory.useQuery();
  const { data: branchesList } = trpc.branches.list.useQuery();

  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const quickQueries = [
    "حلل أداء المبيعات خلال الشهر الماضي وقدم توصيات",
    "ما هي المنتجات الأكثر ربحية؟",
    "هل يوجد فروع تحتاج تحسين أداء؟",
    "توقع المبيعات للأسبوع القادم",
    "اكتشف أنماط غير طبيعية في البيانات",
    "اقترح طرق لتقليل الهدر في الإنتاج",
  ];

  const analyzeWithAI = async (q: string) => {
    setLoading(true);
    setResponse("");
    try {
      const context = `
بيانات النظام:
- عدد الفروع: ${branchesList?.length || 0}
- عدد الطلبات (3 أشهر): ${salesData?.length || 0}
- إجمالي المبيعات: ${salesData?.reduce((s: number, r: any) => s + parseFloat(r.totalAmount || "0"), 0).toLocaleString() || 0} SAR
- عدد أصناف المخزون: ${inventoryData?.length || 0}
- أصناف منخفضة المخزون: ${inventoryData?.filter((r: any) => r.reorderLevel && parseFloat(r.quantity || "0") <= r.reorderLevel).length || 0}
`;
      const res = await fetch("/api/trpc/system.notifyOwner", { method: "POST" });
      // Simulate AI response for now - in production this would call the LLM
      setResponse(`## تحليل: ${q}\n\n### ملخص البيانات\n${context}\n\n### التوصيات\n\n1. **تحسين إدارة المخزون**: مراجعة الأصناف المنخفضة وضبط حدود إعادة الطلب\n2. **تحليل الفروع**: مقارنة أداء الفروع وتحديد الأفضل والأضعف\n3. **تحسين الربحية**: التركيز على المنتجات ذات الهامش الأعلى\n\n> هذه التوصيات مبنية على البيانات المتاحة في النظام. يمكنك طرح أسئلة أكثر تحديداً للحصول على تحليل أعمق.`);
    } catch (err) {
      setResponse("حدث خطأ أثناء التحليل. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">{t.rep.aiInsights}</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />استعلام باللغة الطبيعية</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Textarea value={query} onChange={e => setQuery(e.target.value)} placeholder="اسأل عن أي شيء يخص بيانات النظام..." rows={2} className="flex-1" />
            <Button onClick={() => analyzeWithAI(query)} disabled={loading || !query} className="self-end">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickQueries.map((q, i) => (
              <Button key={i} variant="outline" size="sm" className="text-xs" onClick={() => { setQuery(q); analyzeWithAI(q); }}>{q}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {response && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary" />نتائج التحليل</CardTitle></CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <Streamdown>{response}</Streamdown>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6 text-center">
            <Sparkles className="h-8 w-8 text-primary mx-auto mb-3" />
            <h3 className="font-bold mb-1">توقع الطلب</h3>
            <p className="text-sm text-muted-foreground">تحليل أنماط المبيعات وتوقع الطلب المستقبلي</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-6 text-center">
            <Brain className="h-8 w-8 text-orange-600 mx-auto mb-3" />
            <h3 className="font-bold mb-1">كشف الهدر</h3>
            <p className="text-sm text-muted-foreground">اكتشاف أنماط الهدر غير الطبيعية في الإنتاج</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6 text-center">
            <Sparkles className="h-8 w-8 text-green-600 mx-auto mb-3" />
            <h3 className="font-bold mb-1">تحسين الربحية</h3>
            <p className="text-sm text-muted-foreground">اقتراحات ذكية لتحسين ربحية كل فرع</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
