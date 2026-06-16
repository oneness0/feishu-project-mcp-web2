import React, { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Play, List, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useMcpContext } from '../../hooks/use-mcp-context';
import { Button } from '../../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { cn } from '../../lib/utils';

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  wordWrap: 'on' as const,
  formatOnPaste: true,
  fontSize: 13,
  scrollBeyondLastLine: false,
  automaticLayout: true,
};

export default function McpPage() {
  const { sessionToken, connected } = useMcpContext();
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState('');
  const [tools, setTools] = useState<any[]>([]);
  const [selectedToolName, setSelectedToolName] = useState('');
  const [toolArgs, setToolArgs] = useState('{\n  \n}');

  const selectedTool = tools.find((t) => t.name === selectedToolName);

  useEffect(() => {
    if (!selectedTool) {
      setToolArgs('{\n  \n}');
      return;
    }
    const schema = selectedTool.inputSchema;
    if (schema?.properties) {
      const template: Record<string, any> = {};
      for (const [key, val] of Object.entries<any>(schema.properties)) {
        const type = val.type;
        if (type === 'string') template[key] = '';
        else if (type === 'number') template[key] = 0;
        else if (type === 'boolean') template[key] = false;
        else if (type === 'array') template[key] = [];
        else if (type === 'object') template[key] = {};
        else template[key] = null;
      }
      setToolArgs(JSON.stringify(template, null, 2));
    } else {
      setToolArgs('{\n  \n}');
    }
  }, [selectedToolName]);

  async function authHeaders() {
    return sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};
  }

  async function handleListTools() {
    setLoading(true);
    setOutput('');
    try {
      const res = await fetch('/api/mcp/tools', { headers: await authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      const toolsArray =
        data?.tools || data?.result?.tools || data?.result?.result?.tools || data?.data?.tools;
      if (Array.isArray(toolsArray)) {
        setTools(toolsArray);
        if (toolsArray.length > 0 && !selectedToolName) {
          setSelectedToolName(toolsArray[0].name);
        }
      }
      setOutput(JSON.stringify(data, null, 2));
      toast.success('成功获取 Tools 列表');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('调用失败', { description: msg });
      setOutput(JSON.stringify({ error: msg }, null, 2));
    } finally {
      setLoading(false);
    }
  }

  async function handleCallTool() {
    if (!selectedToolName) {
      toast.warning('请先获取并选择工具');
      return;
    }
    let parsedArgs = {};
    if (toolArgs.trim()) {
      try {
        parsedArgs = JSON.parse(toolArgs);
      } catch {
        toast.error('参数错误', { description: '请输入合法的 JSON 格式' });
        return;
      }
    }
    setLoading(true);
    setOutput('');
    try {
      const res = await fetch('/api/mcp/tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ name: selectedToolName, arguments: parsedArgs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setOutput(JSON.stringify(data, null, 2));
      toast.success(`成功调用工具 ${selectedToolName}`);
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
        <h1 className="text-xl font-semibold text-foreground">测试 MCP</h1>
        <p className="text-sm text-muted-foreground mt-1">调用飞书项目 MCP 工具进行功能测试</p>
      </div>

      {/* Control card */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-stretch" style={{ height: 384 }}>
          {/* Left: inputs + actions */}
          <div className="flex flex-col gap-4 p-6 w-[45%] border-r border-border overflow-y-auto">
            <Button
              variant="outline"
              disabled={!connected || loading}
              onClick={handleListTools}
              className="gap-2 justify-start"
            >
              <List className="size-4" />
              1. 获取可用 Tools 列表
            </Button>

            <Select
              value={selectedToolName}
              onValueChange={setSelectedToolName}
              disabled={!connected || tools.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="2. 请选择要调用的工具" />
              </SelectTrigger>
              <SelectContent>
                {tools.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="h-[220px] border border-border rounded-md overflow-hidden">
              <Editor
                height="100%"
                language="json"
                theme="vs-light"
                value={toolArgs}
                onChange={(v) => setToolArgs(v ?? '')}
                options={EDITOR_OPTIONS}
              />
            </div>

            <Button
              disabled={!connected || !selectedToolName || loading}
              onClick={handleCallTool}
              className="gap-2"
            >
              <Play className="size-4" />
              {loading ? '执行中...' : '4. 执行工具调用'}
            </Button>
          </div>

          {/* Right: tool description */}
          <div className="flex-1 p-6 bg-muted/20 flex flex-col gap-6 overflow-y-auto">
            {!selectedTool ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                <ChevronDown className="size-8 mb-2" />
                <p>在左侧选择工具以查看说明</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <div className="text-sm text-foreground font-semibold">工具说明</div>
                  <p className="text-xs text-muted-foreground leading-relaxed break-all whitespace-pre-wrap">
                    {selectedTool.description || '暂无说明'}
                  </p>
                </div>
                {selectedTool.inputSchema && (
                  <div className="flex flex-col gap-2 flex-1 min-h-0">
                    <div className="text-sm text-foreground font-semibold">
                      参数定义 (Input Schema)
                    </div>
                    <div className="flex-1 overflow-y-auto rounded border border-border bg-muted/50 p-3">
                      <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-all">
                        {JSON.stringify(selectedTool.inputSchema, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </>
            )}
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
            <span className="text-4xl opacity-20">{ }</span>
            <p className="text-sm text-muted-foreground">测试结果将以 JSON 数据格式显示在此处</p>
          </div>
        )}
      </div>
    </div>
  );
}
