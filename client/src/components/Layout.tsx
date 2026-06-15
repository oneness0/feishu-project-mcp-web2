import React from 'react';
import { Outlet } from 'react-router-dom';

const Layout: React.FC = () => {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Outlet />
    </main>
  );
};

export default Layout;
