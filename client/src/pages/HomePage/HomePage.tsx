import React from 'react';
import { SyncBranches } from './SyncBranches';

export default function HomePage() {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">分支需求同步</h1>
        <p className="text-sm text-muted-foreground mt-1">
          将 GitLab feature 分支与飞书项目工作项进行关联同步
        </p>
      </div>
      <SyncBranches />
    </div>
  );
}
