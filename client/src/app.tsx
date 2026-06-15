import React from 'react';
import { Route, Routes } from 'react-router-dom';

import HomePage from './pages/HomePage/HomePage';

import Layout from './components/Layout';
import NotFound from './pages/NotFound/NotFound';

const RoutesComponent = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
