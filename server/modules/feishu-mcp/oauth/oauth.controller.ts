import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { OAuthService } from './oauth.service';
import { SessionStoreService } from '../shared/session-store.service';
import { isReadOnlyMode } from '../shared/policy.util';

@Controller('api/oauth')
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly sessionStore: SessionStoreService,
  ) {}

  /** GET /api/oauth/start — 发起飞书项目 OAuth2 PKCE 授权 */
  @Get('start')
  async start(@Req() req: Request, @Res() res: Response) {
    await this.oauthService.startOAuth(req, res);
  }

  /** GET /api/oauth/callback — 飞书项目授权回调 */
  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response) {
    await this.oauthService.handleCallback(req, res);
  }

  /** POST /api/oauth/logout — 断开连接，销毁服务端会话 */
  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const token = SessionStoreService.extractSessionToken(
      req.headers.authorization,
      req.query.session_token as string | undefined,
    );
    this.sessionStore.deleteSession(token);
    return res.json({ ok: true });
  }

  /** GET /api/oauth/status — 查询当前会话状态 */
  @Get('status')
  async status(@Req() req: Request, @Res() res: Response) {
    const token = SessionStoreService.extractSessionToken(
      req.headers.authorization,
      req.query.session_token as string | undefined,
    );
    const session = this.sessionStore.getSession(token);
    return res.json({
      connected: Boolean(session),
      expiresAt: session?.expiresAt,
      hasRefreshToken: Boolean(session?.refreshToken),
      readonly: isReadOnlyMode(),
    });
  }
}
