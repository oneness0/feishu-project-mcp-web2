import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';

const Layout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <main
        className="flex-1 flex flex-col min-h-screen transition-all duration-300"
        style={{ marginLeft: collapsed ? 64 : 220 }}
      >
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
