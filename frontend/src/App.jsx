import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './app/AppLayout.jsx'
import { DashboardPage } from './pages/DashboardPage.jsx'
import { TransactionsPage } from './pages/TransactionsPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
