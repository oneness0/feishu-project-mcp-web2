import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GitBranch,
  RefreshCw,
  History,
  Clock,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  ExternalLink,
  Trash2,
  FileText,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { useMcpContext } from '../../hooks/use-mcp-context';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { cn } from '../../lib/utils';

interface SyncItem {
  branch: string;
  workItemId: string;
  info: any;
}

interface SyncSnapshot {
  syncedAt: number;
  items: SyncItem[];
}

type DisplayItem = SyncItem & {
  displayName: string;
  displayStatus: string;
  statusVariant: 'default' | 'secondary' | 'destructive' | 'outline';
  weight: number;
  link: string;
};

// ── Helpers ────────────────────────────────────────────────

function attr(info: any) {
  return info?.work_item_attribute || {};
}

function getWorkItemName(info: any): string {
  return attr(info).work_item_name || '';
}

function getWorkItemStatus(info: any): string {
  return attr(info).work_item_status?.name || '';
}

function getWorkItemLink(info: any, workItemId: string): string {
  const simpleName = attr(info).owned_project?.simple_name;
  const typeKey = attr(info).work_item_type?.key || 'story';
  return simpleName
    ? `https://project.feishu.cn/${simpleName}/${typeKey}/detail/${workItemId}`
    : '';
}

function getStatusVariant(status: string): DisplayItem['statusVariant'] {
  const map: Record<string, DisplayItem['statusVariant']> = {
    开发中: 'default',
    测试中: 'secondary',
    待上线: 'outline',
    已结束: 'secondary',
  };
  return map[status] ?? 'outline';
}

const STATUS_OPTIONS = ['开发中', '测试中', '待上线', '已结束', '未找到'];
const STATUS_WEIGHT: Record<string, number> = { 开发中: 1, 测试中: 2, 待上线: 3, 已结束: 4 };

async function fetchGitlabFeatureBranches(url: string): Promise<{ name: string }[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GitLab 请求失败（HTTP ${res.status}）`);
  return res.json();
}

export function SyncBranches() {
  const { sessionToken, connected } = useMcpContext();
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<SyncSnapshot | null>(null);

  const [sortCol, setSortCol] = useState<'workItemId' | 'workItemStatus'>('workItemId');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [deleteModal, setDeleteModal] = useState(false);
  const [deletingItem, setDeletingItem] = useState<DisplayItem | null>(null);

  // 同步时间文字
  const syncTimeText = useMemo(() => {
    if (!snapshot?.syncedAt) return '从未同步';
    const diff = Math.floor((Date.now() - snapshot.syncedAt) / 1000);
    if (diff < 10) return '刚刚';
    if (diff < 60) return `${diff} 秒前`;
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    return `${Math.floor(diff / 3600)} 小时前`;
  }, [snapshot?.syncedAt]);

  const loadSnapshot = useCallback(async () => {
    try {
      const res = await fetch('/api/work-items/query', { method: 'POST' });
      const data = await res.json();
      if (data?.syncedAt != null) setSnapshot(data);
    } catch {
      // 忽略
    }
  }, []);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  async function syncWorkItemsFromBranches() {
    if (!connected || !sessionToken) {
      toast.error('请先连接飞书项目');
      return;
    }
    setLoading(true);
    try {
      const cfgRes = await fetch('/api/gitlab/branches-config', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const cfg = await cfgRes.json();
      if (!cfgRes.ok) throw new Error(cfg.error || 'branches-config 失败');

      const branches = await fetchGitlabFeatureBranches(cfg.url);
      const prefix: string = cfg.branchPrefix.endsWith('/')
        ? cfg.branchPrefix
        : `${cfg.branchPrefix}/`;

      const items = branches.reduce(
        (acc, b) => {
          if (b.name.toLowerCase().startsWith(prefix.toLowerCase())) {
            const rawNo = b.name.slice(prefix.length).trim();
            const workItemId = rawNo.match(/^\d+/)?.[0] || rawNo;
            if (workItemId) acc.push({ branch: b.name, workItemId });
          }
          return acc;
        },
        [] as { branch: string; workItemId: string }[],
      );

      if (!items.length) throw new Error('未从 feature 分支解析到任何需求单号');

      const res = await fetch('/api/work-items/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ items }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `同步失败（HTTP ${res.status}）`);

      setSnapshot(data);
      toast.success(`同步完成，共 ${data.items.length} 条分支需求映射`);
    } catch (e: any) {
      toast.error('分支需求同步失败', { description: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  }

  // ── Table ──────────────────────────────────────────────────

  const enrichedItems = useMemo<DisplayItem[]>(() => {
    return (snapshot?.items || []).map((item) => {
      const status = getWorkItemStatus(item.info);
      const isNotFound = !item.info;
      const displayStatus = status || (isNotFound ? '未找到' : '');
      const weight = status ? (STATUS_WEIGHT[status] ?? 5) : isNotFound ? 5 : 6;
      return {
        ...item,
        displayName: getWorkItemName(item.info),
        displayStatus,
        statusVariant: getStatusVariant(status),
        weight,
        link: getWorkItemLink(item.info, item.workItemId),
      };
    });
  }, [snapshot]);

  const tableData = useMemo<DisplayItem[]>(() => {
    let items = [...enrichedItems];

    if (selectedStatus) {
      items = items.filter((item) => item.displayStatus === selectedStatus);
    }

    const dir = sortDir === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      if (sortCol === 'workItemStatus') return (a.weight - b.weight) * dir;
      const numA = Number(a.workItemId);
      const numB = Number(b.workItemId);
      if (!isNaN(numA) && !isNaN(numB)) return (numA - numB) * dir;
      return a.workItemId.localeCompare(b.workItemId) * dir;
    });

    return items;
  }, [enrichedItems, selectedStatus, sortCol, sortDir]);

  function toggleSort(col: 'workItemId' | 'workItemStatus', defaultDir: 'asc' | 'desc') {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir(defaultDir);
    }
  }

  function openDeleteConfirm(item: DisplayItem) {
    setDeletingItem(item);
    setDeleteModal(true);
  }

  function confirmDelete() {
    if (!deletingItem) return;
    // 打开 GitLab 分支管理页
    const gitlabBaseUrl = (window as any).__FEISHU_MCP_GITLAB_BASE_URL__ || '';
    const gitlabProjectId = (window as any).__FEISHU_MCP_GITLAB_PROJECT_ID__ || '';

    if (!gitlabBaseUrl || !gitlabProjectId) {
      toast.error('未获取到 GitLab 配置，请检查服务端环境变量');
      setDeleteModal(false);
      return;
    }
    const deleteUrl = `${gitlabBaseUrl}/${decodeURIComponent(gitlabProjectId)}/-/branches/all?utf8=%E2%9C%93&search=${encodeURIComponent(deletingItem.branch)}`;
    window.open(deleteUrl, '_blank');
    setDeleteModal(false);
    setDeletingItem(null);
  }

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <ChevronsUpDown className="size-3.5 ml-1 text-muted-foreground opacity-40 shrink-0" />;
    return sortDir === 'asc'
      ? <ArrowUp className="size-3.5 ml-1 text-primary shrink-0" />
      : <ArrowDown className="size-3.5 ml-1 text-primary shrink-0" />;
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Control card */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-stretch">
          <div className="flex flex-col justify-center items-center px-8 py-6">
            <Button
              disabled={!connected || loading}
              onClick={syncWorkItemsFromBranches}
              className="gap-2"
            >
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
              {loading ? '同步中...' : '执行同步'}
            </Button>
          </div>

          <div className="border-l border-border my-6" />

          <div className="flex-1 flex items-center px-8 py-6 gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
              {snapshot?.syncedAt ? (
                <History className="size-3.5" />
              ) : (
                <Clock className="size-3.5" />
              )}
              上次同步：{syncTimeText}
            </span>
            {snapshot?.items.length ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-sm">
                <GitBranch className="size-3.5 opacity-80" />
                共 {snapshot.items.length} 条映射
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Filter */}
      {snapshot?.items.length ? (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="按需求状态筛选" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedStatus && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedStatus('')}
                className="gap-1.5 text-muted-foreground"
              >
                <Trash2 className="size-3.5" />
                清除筛选
              </Button>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            已筛选显示：<span className="text-foreground font-semibold">{tableData.length}</span>{' '}
            / {snapshot.items.length} 条分支
          </div>
        </div>
      ) : null}

      {/* Table */}
      {tableData.length ? (
        <div className="flex-1 rounded-lg border border-border overflow-auto mb-10">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground w-[35%]">
                  分支
                </th>
                <th className="text-left px-4 py-3 w-[14%] whitespace-nowrap">
                  <button
                    className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground"
                    onClick={() => toggleSort('workItemId', 'desc')}
                  >
                    需求单号
                    <SortIcon col="workItemId" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground w-[35%]">
                  需求名称
                </th>
                <th className="text-left px-4 py-3 w-[16%] whitespace-nowrap">
                  <button
                    className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground"
                    onClick={() => toggleSort('workItemStatus', 'asc')}
                  >
                    需求状态
                    <SortIcon col="workItemStatus" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row) => (
                <tr
                  key={row.branch}
                  className={cn(
                    'border-t border-border hover:bg-muted/30 transition-colors',
                    (!row.info || row.displayStatus === '已结束') && 'opacity-55',
                  )}
                >
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 font-mono text-xs text-foreground">
                      <GitBranch className="size-3 text-muted-foreground shrink-0" />
                      {row.branch}
                      <button
                        title="删除分支"
                        onClick={() => openDeleteConfirm(row)}
                        className="ml-1 opacity-50 hover:opacity-100 text-destructive hover:text-destructive transition-opacity"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {row.link ? (
                      <a
                        href={row.link}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {row.workItemId}
                        <ExternalLink className="size-3 opacity-50" />
                      </a>
                    ) : (
                      <span className="font-mono text-xs font-semibold text-primary">
                        {row.workItemId}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.displayName ? (
                      <span className="text-foreground">{row.displayName}</span>
                    ) : (
                      <span className="text-muted-foreground opacity-40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.displayStatus ? (
                      <Badge variant={row.statusVariant}>{row.displayStatus}</Badge>
                    ) : (
                      <span className="text-muted-foreground opacity-40">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 rounded-lg border border-dashed border-border">
          <GitBranch className="size-8 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">等待执行同步操作...</p>
        </div>
      )}

      {/* Delete confirm dialog */}
      <Dialog open={deleteModal} onOpenChange={setDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除分支</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground mb-3">
              确认要前往 GitLab 删除以下分支吗？
            </p>
            <div className="rounded-lg border border-border bg-muted px-4 py-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <GitBranch className="size-3.5 text-muted-foreground shrink-0" />
                <span className="font-mono text-xs text-foreground break-all">
                  {deletingItem?.branch}
                </span>
              </div>
              {deletingItem?.displayName && (
                <div className="flex items-center gap-2">
                  <FileText className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">{deletingItem.displayName}</span>
                </div>
              )}
              {deletingItem?.displayStatus && (
                <div className="flex items-center gap-2">
                  <Tag className="size-3.5 text-muted-foreground shrink-0" />
                  <Badge variant={deletingItem.statusVariant}>{deletingItem.displayStatus}</Badge>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModal(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete} className="gap-1.5">
              <ExternalLink className="size-4" />
              前往 GitLab 删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
