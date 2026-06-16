/**
 * 只读护栏：在后端层面强制限制只能调用读类工具。
 */

// 读类工具的名称前缀（飞书项目 MCP 工具命名规律）。
const READ_PREFIXES = ['get_', 'list_', 'search_'];

export function isReadOnlyMode(): boolean {
  return process.env.FEISHU_MCP_READONLY === 'true';
}

/** 判断一个工具名是否属于"读"操作（可在只读模式下放行）。 */
export function isReadTool(name: string): boolean {
  if (!name) return false;
  const extra = String(process.env.FEISHU_MCP_READONLY_ALLOW || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (extra.includes(name)) return true;
  const n = name.toLowerCase();
  return READ_PREFIXES.some((p) => n.startsWith(p));
}

/**
 * 只读模式下，若该工具不是读操作则返回拒绝原因；允许时返回 null。
 */
export function readonlyRejectReason(name: string): string | null {
  if (isReadOnlyMode() && !isReadTool(name)) {
    return `只读模式已开启，禁止调用写工具：${name}`;
  }
  return null;
}
