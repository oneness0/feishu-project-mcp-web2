import { Injectable } from '@nestjs/common';
import { randomToken } from './feishu-oauth.util';
import type { TokenResponse } from './feishu-oauth.util';

export interface Session {
  accessToken: string;
  refreshToken?: string;
  clientId: string;
  expiresAt?: number; // epoch ms
  createdAt: number;
}

/**
 * 内存会话存储：opaque sessionToken -> 真实飞书凭证。
 * 真实 access_token/refresh_token 永不下发给前端，前端只持有 sessionToken。
 *
 * 注意：内存存储仅适合单实例/开发环境。生产请替换为 Redis 等共享存储。
 */
@Injectable()
export class SessionStoreService {
  private readonly store = new Map<string, Session>();

  createSession(data: { token: TokenResponse; clientId: string }): string {
    const sessionToken = randomToken(32);
    const sessionData: Session = {
      accessToken: data.token.access_token,
      refreshToken: data.token.refresh_token,
      clientId: data.clientId,
      expiresAt: data.token.expires_in
        ? Date.now() + data.token.expires_in * 1000
        : undefined,
      createdAt: Date.now(),
    };
    this.store.set(sessionToken, sessionData);
    return sessionToken;
  }

  getSession(sessionToken: string | undefined): Session | undefined {
    if (!sessionToken) return undefined;
    return this.store.get(sessionToken);
  }

  updateSession(sessionToken: string, token: TokenResponse): void {
    const s = this.store.get(sessionToken);
    if (!s) return;
    s.accessToken = token.access_token;
    if (token.refresh_token) s.refreshToken = token.refresh_token;
    s.expiresAt = token.expires_in ? Date.now() + token.expires_in * 1000 : undefined;
    this.store.set(sessionToken, s);
  }

  deleteSession(sessionToken: string | undefined): void {
    if (sessionToken) {
      this.store.delete(sessionToken);
    }
  }

  /** 从请求头 Authorization: Bearer <sessionToken> 取出会话令牌。 */
  static extractSessionToken(authHeader?: string, queryToken?: string): string | undefined {
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7).trim();
    // 兼容 query 传参
    return typeof queryToken === 'string' ? queryToken : undefined;
  }
}
