import { Injectable } from '@nestjs/common';
import { McpService, SessionExpiredError } from '../mcp/mcp.service';

/** MCP tools/call 返回体中 result.content[0].text 解析后的工作项对象 */
export function parseMcpContentText(raw: unknown): unknown {
  if (raw == null) {
    throw new Error('MCP 返回为空');
  }

  const root = raw as Record<string, unknown>;
  const result =
    (root.result as Record<string, unknown> | undefined) ??
    (root as Record<string, unknown>);

  const content = result?.content;
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error('MCP 返回缺少 result.content');
  }

  const first = content[0] as { type?: string; text?: string } | undefined;
  const text = first?.text;
  if (text == null || text === '') {
    throw new Error('MCP 返回 content[0].text 为空');
  }

  if (typeof text === 'string') {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error('content[0].text 不是合法 JSON');
    }
  }

  return text;
}

export interface SyncItem {
  branch: string;
  workItemId: string;
  info: unknown;
}

export interface SyncSnapshot {
  syncedAt: number;
  items: SyncItem[];
}

export interface WorkItemInfoResult {
  workItemId: string;
  info: unknown;
}

export interface WorkItemInfoError {
  workItemId: string;
  error: string;
}

@Injectable()
export class WorkItemsService {
  // 内存存储：最新同步快照（单实例）
  private latestSnapshot: SyncSnapshot | null = null;

  constructor(private readonly mcpService: McpService) {}

  getSnapshot(): SyncSnapshot | null {
    return this.latestSnapshot;
  }

  /**
   * 按工作项单号批量查询飞书项目工作项概况（get_workitem_brief）。
   * 纯数字单号按 work_item_id 查，否则按 name 查。
   */
  async fetchWorkItemsByNos(
    sessionToken: string,
    projectKey: string,
    workItemIds: string[],
  ): Promise<{ items: WorkItemInfoResult[]; errors: WorkItemInfoError[] }> {
    const { default: pLimit } = await import('p-limit');
    const limit = pLimit(5);

    const unique = [...new Set(workItemIds.map((s) => s.trim()).filter(Boolean))];
    const items: WorkItemInfoResult[] = [];
    const errors: WorkItemInfoError[] = [];

    await Promise.all(
      unique.map((workItemId) =>
        limit(async () => {
          try {
            const args: Record<string, unknown> = { project_key: projectKey };
            if (/^\d+$/.test(workItemId)) {
              args.work_item_id = workItemId;
            } else {
              args.name = workItemId;
            }
            const raw = await this.mcpService.callWithSession(sessionToken, 'tools/call', {
              name: 'get_workitem_brief',
              arguments: args,
            });
            const info = parseMcpContentText(raw);
            items.push({ workItemId, info });
          } catch (e) {
            errors.push({
              workItemId,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }),
      ),
    );

    return { items, errors };
  }

  /**
   * 批量同步：接收前端分支→工作项单号映射，查询飞书工作项详情，覆盖存储。
   */
  async sync(
    sessionToken: string,
    inputItems: Array<{ branch: string; workItemId: string }>,
  ): Promise<SyncSnapshot> {
    const projectKey = process.env.FEISHU_PROJECT_KEY || '';
    if (!projectKey) {
      throw new Error('服务端未配置 FEISHU_PROJECT_KEY');
    }

    const workItemIds = [...new Set(inputItems.map((i) => i.workItemId).filter(Boolean))];
    const { items: results } = await this.fetchWorkItemsByNos(sessionToken, projectKey, workItemIds);

    const infoMap = new Map<string, unknown>();
    for (const { workItemId, info } of results) {
      infoMap.set(workItemId, info);
    }

    const syncItems: SyncItem[] = inputItems.map((i) => ({
      branch: i.branch,
      workItemId: i.workItemId,
      info: infoMap.get(i.workItemId) ?? null,
    }));

    const snapshot: SyncSnapshot = {
      syncedAt: Date.now(),
      items: syncItems,
    };

    this.latestSnapshot = snapshot;
    return snapshot;
  }
}
