import { MCP_RESOURCE } from './feishu-oauth.util';

export class McpUnauthorizedError extends Error {
  constructor(message = 'unauthorized') {
    super(message);
    this.name = 'McpUnauthorizedError';
  }
}

const PROTOCOL_VERSION = '2025-06-18';

function parseMcpBody(contentType: string, text: string): unknown {
  if (contentType.includes('text/event-stream')) {
    const dataLines = text
      .split(/\r?\n/)
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);
    const last = dataLines[dataLines.length - 1];
    if (!last) throw new Error(`SSE 响应未包含 data 行：${text.slice(0, 200)}`);
    return JSON.parse(last);
  }
  return JSON.parse(text);
}

async function postJsonRpc(
  accessToken: string,
  payload: Record<string, unknown>,
  sessionId?: string,
): Promise<{ status: number; sessionId?: string; body?: unknown }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${accessToken}`,
    'MCP-Protocol-Version': PROTOCOL_VERSION,
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;

  const res = await fetch(MCP_RESOURCE, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (res.status === 401) throw new McpUnauthorizedError();

  const respSession = res.headers.get('mcp-session-id') || undefined;
  const text = await res.text();
  if (!text.trim()) return { status: res.status, sessionId: respSession };

  const contentType = res.headers.get('content-type') || '';
  return { status: res.status, sessionId: respSession, body: parseMcpBody(contentType, text) };
}

/**
 * 完成一次完整 MCP 调用：initialize -> notifications/initialized -> 目标方法。
 * 抛出 McpUnauthorizedError 时由上层用 refresh_token 刷新后重试。
 */
export async function mcpCall(
  accessToken: string,
  method: string,
  params: Record<string, unknown> = {},
): Promise<unknown> {
  const init = await postJsonRpc(accessToken, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'feishu-project-mcp-web', version: '0.1.0' },
    },
  });
  const sessionId = init.sessionId;

  if (method === 'initialize') return init.body;

  await postJsonRpc(
    accessToken,
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    sessionId,
  ).catch(() => undefined);

  const result = await postJsonRpc(
    accessToken,
    { jsonrpc: '2.0', id: 2, method, params },
    sessionId,
  );
  return result.body;
}
