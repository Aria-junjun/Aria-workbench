// 数据迁移脚本：把本地 JSON 数据导入 Supabase
// 运行方式：npx ts-node scripts/migrate-to-supabase.ts

import { createClient } from "@supabase/supabase-js";
import workbenchData from "../src/data/workbench-data.json";

const supabaseUrl = "https://ggdhgpklhwuwcgeqysho.supabase.co";
const supabaseKey = "sb_publishable_-or7ucKU_7AqKvDlM0umlA_p5Xyxl9T";

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log("开始迁移数据到 Supabase...");

  try {
    // 检查是否已有数据
    const { data: existing } = await supabase
      .from("workbench_data")
      .select("id")
      .limit(1)
      .single();

    if (existing?.id) {
      console.log("已有数据存在，执行更新...");
      const { error } = await supabase
        .from("workbench_data")
        .update({
          data: workbenchData as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id);

      if (error) {
        console.error("更新失败:", error);
        return;
      }
      console.log("数据更新成功！");
    } else {
      console.log("插入新数据...");
      const { error } = await supabase
        .from("workbench_data")
        .insert({ data: workbenchData as unknown as Record<string, unknown> });

      if (error) {
        console.error("插入失败:", error);
        return;
      }
      console.log("数据插入成功！");
    }

    // 验证数据
    const { data: verify } = await supabase
      .from("workbench_data")
      .select("data")
      .single();

    if (verify?.data) {
      const parsed = verify.data as { suppliers?: unknown[]; offers?: unknown[]; tasks?: unknown[] };
      console.log("\n验证结果:");
      console.log(`- 供应商: ${parsed.suppliers?.length || 0} 条`);
      console.log(`- 报价单: ${parsed.offers?.length || 0} 条`);
      console.log(`- 任务: ${parsed.tasks?.length || 0} 条`);
      console.log("\n迁移完成！");
    }
  } catch (err) {
    console.error("迁移出错:", err);
    console.log("\n可能原因：");
    console.log("1. Supabase 表的 RLS (Row Level Security) 未关闭");
    console.log("2. 网络连接问题");
    console.log("3. 表结构不正确");
    console.log("\n解决方法：");
    console.log("在 Supabase Dashboard -> Authentication -> Policies 中，");
    console.log("找到 workbench_data 表，关闭 Enable RLS 或添加匿名写入策略。");
  }
}

migrate();
