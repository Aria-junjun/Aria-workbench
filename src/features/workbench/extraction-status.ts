export type ExtractionNotice = {
  title: string;
  message: string;
};

export function getExtractionNotice(notes: string[]): ExtractionNotice | null {
  const usedLocalFallback = notes.some(
    (note) => note.includes("AI 未完成整理") || note.includes("AI 调用失败")
  );

  if (!usedLocalFallback) return null;

  return {
    title: "整理方式",
    message: "AI 当前不可用，已使用本地整理结果。已提取可识别的文字字段，复杂内容请在确认页复核。"
  };
}
