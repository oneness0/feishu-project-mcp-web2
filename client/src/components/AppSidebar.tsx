import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { GitBranch, Zap, Gitlab, ChevronRight, ChevronLeft, Power, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMcpContext } from '../hooks/use-mcp-context';
import { cn } from '../lib/utils';

const navItems = [
  { label: '分支需求同步', icon: GitBranch, to: '/' },
  { label: '测试 MCP', icon: Zap, to: '/mcp' },
  { label: '测试 GitLab', icon: Gitlab, to: '/gitlab' },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const { connected, readonly, connect, disconnect } = useMcpContext();
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    setLoading(true);
    try {
      await connect();
      toast.success('成功连接飞书项目');
    } catch (e) {
      toast.error('连接失败', {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    try {
      await disconnect();
      toast.info('已断开飞书项目连接');
    } catch (e) {
      toast.error('断开连接失败', {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-screen fixed left-0 top-0 z-50 border-r border-border bg-muted/30',
        'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden',
        collapsed ? 'w-16' : 'w-[220px]',
      )}
      style={{ padding: '20px 12px' }}
    >
      {/* Logo + Title */}
      <div className="flex items-center gap-3 pb-5 px-1">
        <img
          src="https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20251121-114942.png"
          alt="Feishu Project Logo"
          width={36}
          height={36}
          className="shrink-0 rounded"
        />
        {!collapsed && (
          <div className="text-[15px] leading-snug text-foreground whitespace-nowrap overflow-hidden">
            <div>飞书项目</div>
            <div>MCP SDK</div>
          </div>
        )}
      </div>

      {/* Connection status */}
      <div className="px-1 mb-3 flex flex-col gap-2">
        <div
          title={connected ? '已成功连接到飞书项目 MCP 服务' : '尚未连接到飞书项目 MCP 服务'}
          className={cn(
            'inline-flex items-center gap-2 px-2 py-[5px] rounded-md cursor-help text-xs font-semibold',
            connected
              ? 'bg-green-500/15 border border-green-500/25 text-green-600'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {connected ? (
            <span className="relative flex size-[7px] shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-75 animate-ping" />
              <span className="relative inline-flex size-[7px] rounded-full bg-current" />
            </span>
          ) : (
            <span className="size-[7px] min-w-[7px] rounded-full bg-current" />
          )}
          {!collapsed && <span>{connected ? '已连接' : '未连接'}</span>}
        </div>

        {readonly && !collapsed && (
          <div
            title="只读模式：写类工具调用已被后端拦截"
            className="inline-flex items-center gap-2 px-2 py-[5px] rounded-md cursor-help bg-red-500/10 text-red-500 text-xs font-semibold"
          >
            <span className="size-[7px] min-w-[7px] rounded-full bg-current" />
            <span>只读</span>
          </div>
        )}

        <button
          onClick={connected ? handleDisconnect : handleConnect}
          disabled={loading}
          className={cn(
            'flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors',
            'h-8 px-3 w-full',
            connected
              ? 'border border-border bg-background hover:bg-muted text-foreground'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
            loading && 'opacity-60 cursor-not-allowed',
            collapsed && 'px-0',
          )}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : connected ? (
            <Power className="size-4" />
          ) : (
            <ArrowRight className="size-4" />
          )}
          {!collapsed && <span>{connected ? '断开' : '连接'}</span>}
        </button>
      </div>

      <div className="my-3 border-t border-border" />

      {/* Navigation */}
      <nav className="flex-1 overflow-hidden flex flex-col gap-1">
        {navItems.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-md px-2 py-[7px] text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                collapsed && 'justify-center',
              )
            }
            title={collapsed ? label : undefined}
          >
            <Icon className="size-4 shrink-0" />
            {!collapsed && <span className="whitespace-nowrap overflow-hidden">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer collapse toggle */}
      <div className="pt-3 border-t border-border flex items-center justify-end">
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>
    </aside>
  );
}
