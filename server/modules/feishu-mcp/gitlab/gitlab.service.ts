import { Injectable } from '@nestjs/common';
import { SessionStoreService } from '../shared/session-store.service';

/** GitLab 分支列表项（API v4 常见结构） */
export interface GitLabBranch {
  name: string;
}

@Injectable()
export class GitlabService {
  constructor(private readonly sessionStore: SessionStoreService) {}

  /**
   * 从 feature/* 分支名解析需求单号。
   * 默认规则：分支名 feature/<需求单号>，取 / 后一段（如 feature/6995496915 → 6995496915）。
   */
  parseRequirementNosFromBranches(branches: GitLabBranch[], prefix = 'feature/'): string[] {
    const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
    const set = new Set<string>();
    for (const b of branches) {
      const name = b?.name?.trim();
      if (!name) continue;
      if (name.toLowerCase().startsWith(normalizedPrefix.toLowerCase())) {
        const rawNo = name.slice(normalizedPrefix.length).trim();
        const match = rawNo.match(/^\d+/);
        const no = match ? match[0] : rawNo;
        if (no) set.add(no);
      }
    }
    return [...set];
  }

  /** 拼装带 private_token 的 GitLab 分支查询 URL */
  buildGitlabBranchesUrl(baseUrl: string, privateToken: string): string {
    const url = new URL(baseUrl);
    url.searchParams.set('private_token', privateToken);
    return url.toString();
  }

  /** 获取分支配置（供前端构建带 token 的 URL） */
  getBranchesConfig(): {
    url: string;
    branchPrefix: string;
  } | { error: string } {
    const baseUrl = process.env.GITLAB_BASE_URL || '';
    const projectId = process.env.GITLAB_PROJECT_ID || '';
    const branchesUrl = process.env.GITLAB_BRANCHES_URL || '';
    const token = process.env.GITLAB_PRIVATE_TOKEN || '';
    const branchPrefix = process.env.GITLAB_BRANCH_PREFIX || 'feature/';

    let targetUrl = '';
    if (baseUrl && projectId) {
      const origin = baseUrl.replace(/\/$/, '');
      const safeProjectId = projectId.includes('%2F')
        ? projectId
        : encodeURIComponent(projectId);
      const searchPrefix = branchPrefix ? `^${branchPrefix}` : '^feature/';
      targetUrl = `${origin}/api/v4/projects/${safeProjectId}/repository/branches?search=${encodeURIComponent(searchPrefix)}`;
    } else if (branchesUrl) {
      targetUrl = branchesUrl;
    }

    if (!targetUrl || !token) {
      return {
        error:
          '服务端未配置 GITLAB_BASE_URL+GITLAB_PROJECT_ID 或 GITLAB_BRANCHES_URL，或者缺失 GITLAB_PRIVATE_TOKEN',
      };
    }

    return {
      url: this.buildGitlabBranchesUrl(targetUrl, token),
      branchPrefix,
    };
  }

  /** 获取 GitLab 公开配置（不含 token） */
  getConfig(): { origin: string; projectId: string } | { error: string } {
    const baseUrl = process.env.GITLAB_BASE_URL || '';
    const branchesUrl = process.env.GITLAB_BRANCHES_URL || '';

    let origin = '';
    if (baseUrl) {
      origin = baseUrl;
    } else if (branchesUrl) {
      origin = new URL(branchesUrl).origin;
    }

    if (origin) {
      return {
        origin,
        projectId: process.env.GITLAB_PROJECT_ID || '',
      };
    }

    return { error: '服务端未配置 GITLAB_BASE_URL 或 GITLAB_BRANCHES_URL' };
  }

  /** 代理请求内网 GitLab */
  async proxy(gitlabPath: string): Promise<{ status: number; data: unknown }> {
    const baseUrl = process.env.GITLAB_BASE_URL || '';
    const branchesUrl = process.env.GITLAB_BRANCHES_URL || '';
    const privateToken = process.env.GITLAB_PRIVATE_TOKEN || '';

    const origin = baseUrl || (branchesUrl ? new URL(branchesUrl).origin : null);

    if (!origin || !privateToken) {
      return {
        status: 500,
        data: {
          error:
            '服务端未配置 GITLAB_BASE_URL (或 GITLAB_BRANCHES_URL) 或 GITLAB_PRIVATE_TOKEN',
        },
      };
    }

    const targetUrl = new URL(gitlabPath || '/api/v4/user', origin);
    targetUrl.searchParams.set('private_token', privateToken);

    const res = await fetch(targetUrl.toString(), {
      headers: { accept: 'application/json' },
    });

    return { status: res.status, data: await res.json() };
  }
}
