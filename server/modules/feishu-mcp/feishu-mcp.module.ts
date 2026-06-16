import { Module } from '@nestjs/common';
import { SessionStoreService } from './shared/session-store.service';
import { OAuthService } from './oauth/oauth.service';
import { OAuthController } from './oauth/oauth.controller';
import { McpService } from './mcp/mcp.service';
import { McpController } from './mcp/mcp.controller';
import { GitlabService } from './gitlab/gitlab.service';
import { GitlabController } from './gitlab/gitlab.controller';
import { WorkItemsService } from './work-items/work-items.service';
import { WorkItemsController } from './work-items/work-items.controller';

@Module({
  controllers: [
    OAuthController,
    McpController,
    GitlabController,
    WorkItemsController,
  ],
  providers: [
    SessionStoreService,
    OAuthService,
    McpService,
    GitlabService,
    WorkItemsService,
  ],
  exports: [SessionStoreService],
})
export class FeishuMcpModule {}
