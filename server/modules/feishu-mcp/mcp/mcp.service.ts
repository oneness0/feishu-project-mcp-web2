import { Injectable } from '@nestjs/common';
import {
  discoverMetadata,
  refreshAccessToken,
} from '../shared/feishu-oauth.util';
import { mcpCall, McpUnauthorizedError } from '../shared/mcp-client.util';
import { SessionStoreService } from '../shared/session-store.service';

export class SessionExpiredError extends Error {
  constructor(message = '会话已失效，请重新授权') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

const inFlightRefreshes = new Map<string, Promise<any>>();

@Injectable()
export class McpService {
  constructor(private readonly sessionStore: SessionStoreService) {}

  /**
   * 按 sessionToken 调用 MCP：用会话内的 access_token 调用，
   * 401 时自动用 refresh_token 刷新并更新会话后重试一次。
   */
  async callWithSession(
    sessionToken: string,
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<unknown> {
    const session = this.sessionStore.getSession(sessionToken);
    if (!session) throw new SessionExpiredError('未找到会话，请先连接授权');

    try {
      return await mcpCall(session.accessToken, method, params);
    } catch (e) {
      if (!(e instanceof McpUnauthorizedError)) throw e;
    }

    const refreshToken = session.refreshToken;
    if (!refreshToken) throw new SessionExpiredError();

    let refreshPromise = inFlightRefreshes.get(sessionToken);
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const metadata = await discoverMetadata();
        const refreshed = await refreshAccessToken({
          metadata,
          clientId: session.clientId,
          refreshToken,
        });
        this.sessionStore.updateSession(sessionToken, refreshed);
        return refreshed;
      })();
      inFlightRefreshes.set(sessionToken, refreshPromise);
      refreshPromise.finally(() => {
        inFlightRefreshes.delete(sessionToken);
      });
    }

    const refreshed = await refreshPromise;
    return mcpCall(refreshed.access_token, method, params);
  }
}
