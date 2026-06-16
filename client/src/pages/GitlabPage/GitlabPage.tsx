import React, { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { GitBranch, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { cn } from '../../lib/utils';

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  wordWrap: 'on' as const,
  formatOnPaste: true,
  fontSize: 13,
  scrollBeyondLastLine: false,
  automaticLayout: true,
};

export default function GitlabPage() {
  const [gitlabOrigin, setGitlabOrigin] = useState('');
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState('');
  const [lastApiName, setLastApiName] = useState('');

  useEffect(() => {
    fetch('/api/gitlab/config')
      .then((r) => r.json())
      .then((res) => {
        if (res.origin) setGitlabOrigin(res.origin);
      })
      .catch(() => {});
  }, []);

  async function fetchGitlabBranches() {
    setLoading(true);
    setOutput('');
    setLastApiName('GET /api/v4/projects/.../branches');
    try {
      // 通过服务端 branches-config 获取带 token 的 URL
      const cfgRes = await fetch('/api/gitlab/branches-config');
      const cfg = await cfgRes.json();

      if (!cfgRes.ok || cfg.error) {
        // 未授权时降级调用代理
        const proxyRes = await fetch('/api/gitlab/proxy?path=/api/v4/projects');
        const data = await proxyRes.json();
        setOutput(JSON.stringify(data, null, 2));
        toast.info('未授权，已调用代理接口');
        return;
      }

      const res = await fetch(cfg.url);
      const data = await res.json();
      setOutput(JSON.stringify(data, null, 2));
      toast.success('成功获取 GitLab 分支信息');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('调用失败', { description: msg });
      setOutput(JSON.stringify({ error: msg }, null, 2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="mb-2">
        <h1 className="text-xl font-semibold text-foreground">测试 GitLab</h1>
        <p className="text-sm text-muted-foreground mt-1">测试内网 GitLab API 连通性</p>
      </div>

      {/* Control card */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-stretch">
          {/* Left */}
          <div className="flex flex-col gap-4 p-8 w-[45%]">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">GitLab 地址</label>
              <div className="h-9 flex items-center px-3 rounded-md border border-border bg-muted text-sm text-muted-foreground font-mono">
                {gitlabOrigin || '加载中...'}
              </div>
            </div>
            <Button
              disabled={loading}
              onClick={fetchGitlabBranches}
              className="gap-2"
            >
              <GitBranch className="size-4" />
              {loading ? '请求中...' : '获取分支信息'}
            </Button>
          </div>

          <div className="border-l border-border my-6" />

          {/* Right: status + API info */}
          <div className="flex-1 flex flex-col justify-center px-8 py-6 gap-4">
            <div className="flex items-center gap-2">
              {output ? (
                <CheckCircle className="size-3 text-green-500" />
              ) : (
                <XCircle className="size-3 text-muted-foreground" />
              )}
              <span className="text-sm text-muted-foreground">
                上次调用：{lastApiName || '无'}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="font-mono text-xs font-bold">GET</Badge>
                <code className="text-sm text-foreground break-all">
                  /api/v4/projects/coreproject%2Fprjc/repository/branches
                </code>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                直接请求目标接口获取分支信息，URL 中包含了{' '}
                <code className="bg-muted border border-border px-1 py-0.5 rounded text-[11px] font-mono">
                  private_token
                </code>{' '}
                进行鉴权。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Output */}
      <div className="flex-1 rounded-xl border border-border overflow-hidden min-h-[400px] flex flex-col">
        {output ? (
          <Editor
            height="100%"
            language="json"
            theme="vs-light"
            value={output}
            options={{ ...EDITOR_OPTIONS, readOnly: true }}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
            <GitBranch className="size-8 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">GitLab 分支信息将以 JSON 格式显示在此处</p>
          </div>
        )}
      </div>
    </div>
  );
}
