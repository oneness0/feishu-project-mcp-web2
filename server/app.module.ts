import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { PlatformModule } from '@lark-apaas/fullstack-nestjs-core';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { ViewModule } from './modules/view/view.module';
import { FeishuMcpModule } from './modules/feishu-mcp/feishu-mcp.module';

@Module({
  imports: [
    // 平台 Module，提供平台能力
    // enableCsrf:false — OAuth callback 是飞书外部 GET 跳转，无法携带 CSRF token。
    // API 已有 Authorization: Bearer sessionToken 保护，禁用 CSRF 不影响安全性。
    PlatformModule.forRoot({ enableCsrf: false }),
    // ====== @route-section: business-modules START ======
    // Place all business modules here.Do NOT add fallback modules here.
    FeishuMcpModule,
    // ====== @route-section: business-modules END ======

    // ⚠️ @route-order: last
    // ViewModule is the fallback route module, must be registered last.
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
