import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { WorkItemsService } from './work-items.service';
import { SessionStoreService } from '../shared/session-store.service';
import { SessionExpiredError } from '../mcp/mcp.service';

@Controller('api/work-items')
export class WorkItemsController {
  constructor(
    private readonly workItemsService: WorkItemsService,
    private readonly sessionStore: SessionStoreService,
  ) {}

  private requireSession(req: Request, res: Response): string | null {
    const token = SessionStoreService.extractSessionToken(
      req.headers.authorization,
      req.query.session_token as string | undefined,
    );
    if (!token || !this.sessionStore.getSession(token)) {
      res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ error: '未连接，请先完成飞书项目授权' });
      return null;
    }
    return token;
  }

  /**
   * POST /api/work-items/sync
   * 接收前端已解析的分支→工作项单号映射，实时查询飞书工作项详情，写入快照。
   * Body: { items: Array<{ branch: string; workItemId: string }> }
   */
  @Post('sync')
  async sync(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { items?: Array<{ branch: string; workItemId: string }> },
  ) {
    const token = this.requireSession(req, res);
    if (!token) return;

    if (!process.env.FEISHU_PROJECT_KEY) {
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: '服务端未配置 FEISHU_PROJECT_KEY' });
    }

    const inputItems = body?.items;
    if (!Array.isArray(inputItems) || inputItems.length === 0) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: 'items 必须为非空数组' });
    }

    try {
      const snapshot = await this.workItemsService.sync(token, inputItems);
      return res.json(snapshot);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: e.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /**
   * POST /api/work-items/query
   * 返回最近一次同步快照（无需鉴权，供内网其他应用直接调用）。
   */
  @Post('query')
  async query(@Res() res: Response) {
    const snapshot = this.workItemsService.getSnapshot();
    if (!snapshot) {
      return res.json({ syncedAt: null, items: [] });
    }
    return res.json(snapshot);
  }
}
