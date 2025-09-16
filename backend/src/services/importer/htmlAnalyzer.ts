export function detectSlots(_html: string) {
  // TODO: 基于启发式识别 header/hero/pricing/team 等组件槽位
  return [] as Array<{ slug: string; start: number; end: number }>;
}

