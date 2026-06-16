import React, { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import NotFound from './pages/NotFound/NotFound';

const HomePage = lazy(() => import('./pages/HomePage/HomePage'));
const McpPage = lazy(() => import('./pages/McpPage/McpPage'));
const GitlabPage = lazy(() => import('./pages/GitlabPage/GitlabPage'));

const RoutesComponent = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          index
          element={
            <Suspense fallback={null}>
              <HomePage />
            </Suspense>
          }
        />
        <Route
          path="mcp"
          element={
            <Suspense fallback={null}>
              <McpPage />
            </Suspense>
          }
        />
        <Route
          path="gitlab"
          element={
            <Suspense fallback={null}>
              <GitlabPage />
            </Suspense>
          }
        />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
