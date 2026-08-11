"use client";

import { useEffect, useState } from "react";
import { loadWorkbenchData } from "@/features/workbench/local-store";
import { useWorkbenchData, getWorkbenchSnapshot, setWorkbenchSnapshot } from "@/features/workbench/workbench-store";
import { supabase } from "@/lib/supabase";

export default function DebugClientPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [supabaseResult, setSupabaseResult] = useState<string>("");
  const [syncResult, setSyncResult] = useState<string>("");
  const storeData = useWorkbenchData();

  function log(msg: string) {
    console.log("[Debug]", msg);
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${msg}`]);
  }

  useEffect(() => {
    log("页面加载");
    log(`初始 store 数据: products=${storeData.products.length}`);
    log(`setWorkbenchSnapshot 类型: ${typeof setWorkbenchSnapshot}`);

    // 1. 直接测试 Supabase 查询
    (async () => {
      try {
        log("开始 Supabase 查询...");
        const { data, error } = await supabase
          .from("workbench_data")
          .select("data")
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        if (error) {
          log(`Supabase 错误: ${error.message} (code: ${error.code})`);
          setSupabaseResult(`错误: ${error.message}`);
          return;
        }

        if (data?.data) {
          const products = (data.data as Record<string, unknown[]>).products as Array<Record<string, unknown>>;
          log(`Supabase 成功: products=${products.length}`);
          products.forEach(p => {
            log(`  - ${p.name} | specs=${Array.isArray(p.specifications) ? p.specifications.length : 0} | quotes=${Array.isArray(p.procurementQuotes) ? p.procurementQuotes.length : 0}`);
          });
          setSupabaseResult(`成功: ${products.length}个产品 (${products.map(p => p.name).join(", ")})`);
        } else {
          log("Supabase 返回空数据");
          setSupabaseResult("空数据");
        }
      } catch (e) {
        log(`Supabase 异常: ${e instanceof Error ? e.message : String(e)}`);
        setSupabaseResult(`异常: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();

    // 2. 测试 loadWorkbenchData
    (async () => {
      try {
        log("开始 loadWorkbenchData...");
        const result = await loadWorkbenchData();
        log(`loadWorkbenchData 完成: products=${result.products.length}`);
        result.products.forEach(p => {
          log(`  - ${p.name} | specs=${p.specifications.length} | quotes=${p.procurementQuotes.length}`);
        });
        setSyncResult(`成功: ${result.products.length}个产品`);

        // 手动更新 store
        log("手动调用 setWorkbenchSnapshot...");
        setWorkbenchSnapshot(result);
        log("setWorkbenchSnapshot 完成");

        // 检查 store 是否更新了
        const snapshot = getWorkbenchSnapshot();
        log(`store 快照: products=${snapshot.products.length}`);
      } catch (e) {
        log(`loadWorkbenchData 异常: ${e instanceof Error ? e.message : String(e)}`);
        setSyncResult(`异常: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
  }, []);

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">客户端同步调试</h1>

      <div className="rounded border p-4">
        <h2 className="font-semibold mb-2">当前 Store 数据（useWorkbenchData）</h2>
        <p>产品数量: {storeData.products.length}</p>
        {storeData.products.map(p => (
          <div key={p.id} className="text-sm">
            - {p.name} | specs={p.specifications.length} | quotes={p.procurementQuotes.length}
          </div>
        ))}
      </div>

      <div className="rounded border p-4">
        <h2 className="font-semibold mb-2">Supabase 直接查询</h2>
        <p>{supabaseResult || "测试中..."}</p>
      </div>

      <div className="rounded border p-4">
        <h2 className="font-semibold mb-2">loadWorkbenchData 结果</h2>
        <p>{syncResult || "测试中..."}</p>
      </div>

      <div className="rounded border p-4 max-h-96 overflow-auto">
        <h2 className="font-semibold mb-2">日志</h2>
        {logs.map((line, i) => (
          <div key={i} className="text-xs font-mono">{line}</div>
        ))}
      </div>
    </div>
  );
}
