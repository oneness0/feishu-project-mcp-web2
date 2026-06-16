import crypto from 'node:crypto';

/**
 * 飞书项目 MCP OAuth 2.1（授权码 + PKCE）工具集。
 * 端点来自实测的服务端 well-known 元数据，全程无需 plugin_secret。
 */

export const ISSUER = 'https://project.feishu.cn';
export const MCP_RESOURCE = 'https://project.feishu.cn/mcp_server/v1';

const FALLBACK_METADATA: AuthServerMetadata = {
  issuer: ISSUER,
  authorization_endpoint: 'https://project.feishu.cn/b/auth/mcp',
  token_endpoint: 'https://project.feishu.cn/mcp_server/oauth/token',
  registration_endpoint: 'https://project.feishu.cn/mcp_server/oauth/register',
  code_challenge_methods_supported: ['S256', 'plain'],
};

export interface AuthServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  code_challenge_methods_supported?: string[];
}

export interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function randomToken(bytes = 24): string {
  return base64url(crypto.randomBytes(bytes));
}

export async function discoverMetadata(): Promise<AuthServerMetadata> {
  try {
    const res = await fetch(`${ISSUER}/.well-known/oauth-authorization-server`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const json = (await res.json()) as Partial<AuthServerMetadata>;
      if (json.authorization_endpoint && json.token_endpoint) {
        return {
          issuer: json.issuer ?? ISSUER,
          authorization_endpoint: json.authorization_endpoint,
          token_endpoint: json.token_endpoint,
          registration_endpoint: json.registration_endpoint,
          code_challenge_methods_supported: json.code_challenge_methods_supported,
        };
      }
    }
  } catch {
    // 走兜底
  }
  return FALLBACK_METADATA;
}

export async function tryRegisterClient(
  metadata: AuthServerMetadata,
  redirectUri: string,
): Promise<string | null> {
  if (!metadata.registration_endpoint) return null;
  try {
    const res = await fetch(metadata.registration_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_name: 'feishu-project-mcp-web',
        redirect_uris: [redirectUri],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    const clientId =
      (json.client_id as string | undefined) ??
      ((json.data as Record<string, unknown> | undefined)?.client_id as string | undefined);
    return typeof clientId === 'string' && clientId.length > 0 ? clientId : null;
  } catch {
    return null;
  }
}

export async function resolveClientId(
  metadata: AuthServerMetadata,
  redirectUri: string,
  fallbackClientId: string,
): Promise<string> {
  const registered = await tryRegisterClient(metadata, redirectUri);
  return registered ?? (fallbackClientId || 'feishu-project-mcp-web');
}

export function buildAuthorizeUrl(params: {
  metadata: AuthServerMetadata;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const { metadata, clientId, redirectUri, state, codeChallenge } = params;
  const url = new URL(metadata.authorization_endpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('resource', MCP_RESOURCE);
  return url.toString();
}

export async function exchangeCodeForToken(params: {
  metadata: AuthServerMetadata;
  clientId: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  const { metadata, clientId, redirectUri, code, codeVerifier } = params;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
    resource: MCP_RESOURCE,
  });
  return postToken(metadata.token_endpoint, body);
}

export async function refreshAccessToken(params: {
  metadata: AuthServerMetadata;
  clientId: string;
  refreshToken: string;
}): Promise<TokenResponse> {
  const { metadata, clientId, refreshToken } = params;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    resource: MCP_RESOURCE,
  });
  return postToken(metadata.token_endpoint, body);
}

async function postToken(tokenEndpoint: string, body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`token 接口返回非 JSON（HTTP ${res.status}）：${text.slice(0, 300)}`);
  }
  if (!res.ok || typeof json.access_token !== 'string') {
    const errMsg =
      (json.error_description as string) ||
      (json.error as string) ||
      (json.msg as string) ||
      text.slice(0, 300);
    throw new Error(`token 换取失败（HTTP ${res.status}）：${errMsg}`);
  }
  return json as unknown as TokenResponse;
}
