import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  Query,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { McpService, SessionExpiredError } from './mcp.service';
import { SessionStoreService } from '../shared/session-store.service';
import { readonlyRejectReason } from '../shared/policy.util';

@Controller('api/mcp')
export class McpController {
  constructor(
    private readonly mcpService: McpService,
    private readonly sessionStore: SessionStoreService,
  ) {}

  private extractToken(req: Request): string | undefined {
    return SessionStoreService.extractSessionToken(
      req.headers.authorization,
      req.query.session_token as string | undefined,
    );
  }

  private requireSession(req: Request, res: Response): string | null {
    const token = this.extractToken(req);
    if (!token || !this.sessionStore.getSession(token)) {
      res.status(HttpStatus.UNAUTHORIZED).json({ error: '未连接，请先完成授权' });
      return null;
    }
    return token;
  }

  /** GET /api/mcp/tools — 列出可用工具 */
  @Get('tools')
  async listTools(@Req() req: Request, @Res() res: Response) {
    const token = this.requireSession(req, res);
    if (!token) return;

    try {
      const result = await this.mcpService.callWithSession(token, 'tools/list');
      return res.json(result);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: e.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /** POST /api/mcp/tool — 调用单个 MCP 工具（tools/call 包装） */
  @Post('tool')
  async callTool(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { name?: string; arguments?: Record<string, unknown> },
  ) {
    const token = this.requireSession(req, res);
    if (!token) return;

    if (!body?.name) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: '缺少 name 字段' });
    }

    const rejected = readonlyRejectReason(body.name);
    if (rejected) {
      return res.status(HttpStatus.FORBIDDEN).json({ error: rejected });
    }

    try {
      const result = await this.mcpService.callWithSession(token, 'tools/call', {
        name: body.name,
        arguments: body.arguments ?? {},
      });
      return res.json(result);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: e.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /** POST /api/mcp/rpc — 通用 JSON-RPC 透传 */
  @Post('rpc')
  async rpc(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { method?: string; params?: Record<string, unknown> },
  ) {
    const token = this.requireSession(req, res);
    if (!token) return;

    if (!body?.method) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: '缺少 method 字段' });
    }

    // 通用通道里走 tools/call 的写工具同样受只读护栏拦截
    if (body.method === 'tools/call') {
      const name = (body.params as { name?: string } | undefined)?.name ?? '';
      const rejected = readonlyRejectReason(name);
      if (rejected) {
        return res.status(HttpStatus.FORBIDDEN).json({ error: rejected });
      }
    }

    try {
      const result = await this.mcpService.callWithSession(
        token,
        body.method,
        body.params ?? {},
      );
      return res.json(result);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: e.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
