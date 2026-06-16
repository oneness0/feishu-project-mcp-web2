import {
  Controller,
  Get,
  HttpStatus,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { GitlabService } from './gitlab.service';
import { SessionStoreService } from '../shared/session-store.service';

@Controller('api/gitlab')
export class GitlabController {
  constructor(
    private readonly gitlabService: GitlabService,
    private readonly sessionStore: SessionStoreService,
  ) {}

  private requireSession(req: Request, res: Response): string | null {
    const token = SessionStoreService.extractSessionToken(
      req.headers.authorization,
      req.query.session_token as string | undefined,
    );
    if (!token || !this.sessionStore.getSession(token)) {
      res.status(HttpStatus.UNAUTHORIZED).json({ error: '未连接，请先完成飞书项目授权' });
      return null;
    }
    return token;
  }

  /**
   * GET /api/gitlab/branches-config
   * 返回供浏览器直连内网 GitLab 的分支列表 URL（含 private_token）。
   */
  @Get('branches-config')
  async branchesConfig(@Req() req: Request, @Res() res: Response) {
    const token = this.requireSession(req, res);
    if (!token) return;

    const result = this.gitlabService.getBranchesConfig();
    if ('error' in result) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(result);
    }
    return res.json(result);
  }

  /**
   * GET /api/gitlab/config
   * 返回 GitLab 实例基础地址（不含 token），供前端自动填充地址栏。
   */
  @Get('config')
  async config(@Res() res: Response) {
    const result = this.gitlabService.getConfig();
    if ('error' in result) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(result);
    }
    return res.json(result);
  }

  /**
   * GET /api/gitlab/proxy
   * 服务端用 GITLAB_PRIVATE_TOKEN 代理请求内网 GitLab。
   * 用法：/api/gitlab/proxy?path=/api/v4/user
   */
  @Get('proxy')
  async proxy(@Query('path') path: string, @Res() res: Response) {
    const { status, data } = await this.gitlabService.proxy(path);
    return res.status(status).json(data);
  }
}
