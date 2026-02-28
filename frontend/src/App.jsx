import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Layout from './pages/Layout'
import ProtectedRoute from './pages/ProtectedRoute'
import { AuthProvider } from './pages/AuthContext'
import { DataProvider } from './pages/DataContext'

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <DataProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
              </Route>
            </Route>
          </Routes>
        </DataProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
