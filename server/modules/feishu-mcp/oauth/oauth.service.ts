import { Injectable } from '@nestjs/common';
import {
  buildAuthorizeUrl,
  createPkce,
  discoverMetadata,
  randomToken,
  resolveClientId,
} from '../shared/feishu-oauth.util';
import {
  exchangeCodeForToken,
} from '../shared/feishu-oauth.util';
import { SessionStoreService } from '../shared/session-store.service';
import type { Request, Response } from 'express';

/** 授权进行中使用的临时 httpOnly Cookie 名称 */
export const TEMP_COOKIE = {
  pkceVerifier: 'fs_pkce_verifier',
  state: 'fs_oauth_state',
  clientId: 'fs_client_id',
  returnOrigin: 'fs_return_origin',
} as const;

const TEMP_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 10 * 60 * 1000, // 10分钟 (Express takes ms)
};

@Injectable()
export class OAuthService {
  constructor(private readonly sessionStore: SessionStoreService) {}

  resolveRedirectUri(req: Request): string {
    // 优先使用环境变量；兜底按请求头推断（本地开发用）
    const configured =
      process.env.OAUTH_REDIRECT_URI ||
      process.env.FEISHU_OAUTH_REDIRECT_URI ||
      '';
    if (configured) return configured;
    const proto = req.secure ? 'https' : 'http';
    const host = req.get('host');
    return `${proto}://${host}/api/oauth/callback`;
  }

  /**
   * 发起授权（popup 流程）：
   * 发现元数据 -> 解析 client_id -> 生成 PKCE/state ->
   * 把临时数据存入 httpOnly Cookie -> 302 跳转飞书授权页。
   */
  async startOAuth(req: Request, res: Response): Promise<void> {
    const redirectUri = this.resolveRedirectUri(req);
    const returnOrigin = (req.query.return_origin as string) || '';

    const metadata = await discoverMetadata();
    const fallbackClientId = process.env.FEISHU_MCP_CLIENT_ID || 'feishu-project-mcp-web';
    const clientId = await resolveClientId(metadata, redirectUri, fallbackClientId);

    const { verifier, challenge } = createPkce();
    const state = randomToken(16);

    const secure = req.secure;
    const cookieOpts = { ...TEMP_COOKIE_OPTIONS, secure };

    res.cookie(TEMP_COOKIE.pkceVerifier, verifier, cookieOpts);
    res.cookie(TEMP_COOKIE.state, state, cookieOpts);
    res.cookie(TEMP_COOKIE.clientId, clientId, cookieOpts);
    res.cookie(TEMP_COOKIE.returnOrigin, returnOrigin, cookieOpts);

    const authorizeUrl = buildAuthorizeUrl({
      metadata,
      clientId,
      redirectUri,
      state,
      codeChallenge: challenge,
    });

    res.redirect(302, authorizeUrl);
  }

  /**
   * 授权回调：校验 state -> 换 token -> 建会话 ->
   * 返回 HTML 页面，通过 postMessage 把 sessionToken 回传给宿主页并关闭弹窗。
   */
  async handleCallback(req: Request, res: Response): Promise<void> {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const oauthError = req.query.error as string | undefined;

    const expectedState = req.cookies?.[TEMP_COOKIE.state];
    const verifier = req.cookies?.[TEMP_COOKIE.pkceVerifier];
    const clientId = req.cookies?.[TEMP_COOKIE.clientId];
    const returnOrigin = req.cookies?.[TEMP_COOKIE.returnOrigin] || '';

    // 清除临时 Cookie
    const clearOpts = { ...TEMP_COOKIE_OPTIONS, maxAge: 0 };
    res.clearCookie(TEMP_COOKIE.pkceVerifier, clearOpts);
    res.clearCookie(TEMP_COOKIE.state, clearOpts);
    res.clearCookie(TEMP_COOKIE.clientId, clearOpts);
    res.clearCookie(TEMP_COOKIE.returnOrigin, clearOpts);

    res.setHeader('content-type', 'text/html; charset=utf-8');

    if (oauthError) {
      res.send(
        this.renderResult(returnOrigin, {
          ok: false,
          error: (req.query.error_description as string) || oauthError,
        }),
      ).end();
      return;
    }

    if (!code || !state || !expectedState || state !== expectedState || !verifier || !clientId) {
      res.send(
        this.renderResult(returnOrigin, {
          ok: false,
          error: 'state 校验失败或缺少必要参数，请重新发起授权',
        }),
      ).end();
      return;
    }

    try {
      const redirectUri = this.resolveRedirectUri(req);
      const metadata = await discoverMetadata();
      const token = await exchangeCodeForToken({
        metadata,
        clientId,
        redirectUri,
        code,
        codeVerifier: verifier,
      });
      const sessionToken = this.sessionStore.createSession({ token, clientId });
      res.send(this.renderResult(returnOrigin, { ok: true, sessionToken })).end();
    } catch (e) {
      res.send(
        this.renderResult(returnOrigin, {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        }),
      ).end();
    }
  }

  private renderResult(
    returnOrigin: string,
    payload: { ok: boolean; sessionToken?: string; error?: string },
  ): string {
    const target = returnOrigin ? JSON.stringify(returnOrigin) : '"*"';
    const data = JSON.stringify({ type: 'feishu-mcp-auth', ...payload });
    const tip = payload.ok ? '授权成功，正在返回…' : `授权失败：${payload.error ?? ''}`;
    return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>飞书项目授权</title>
<style>body{font-family:-apple-system,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;background:#0b1020;color:#e6e9f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.box{text-align:center;padding:24px 32px;border:1px solid #273049;border-radius:12px;background:#151b2e}</style>
</head><body>
<div class="box"><p>${tip}</p><p style="color:#9aa3b8;font-size:13px">可关闭此窗口</p></div>
<script>
(function(){
  var data = ${data};
  try { if (window.opener) { window.opener.postMessage(data, ${target}); } } catch (e) {}
  setTimeout(function(){ try { window.close(); } catch(e){} }, 300);
})();
</script>
</body></html>`;
  }
}
