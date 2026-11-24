import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import CustomerPage from './pages/CustomerPage.jsx';
import AdminPage from './pages/AdminPage.jsx';

export default function App() {
  return (
    <main>
      <Routes>
        <Route path="/store" element={<AdminPage />} />
        <Route path="/store/:storeHash" element={<CustomerPage />} />
        <Route path="/admin" element={<Navigate to="/store" replace />} />
        <Route path="*" element={<Navigate to="/store" replace />} />
      </Routes>
    </main>
  );
}
