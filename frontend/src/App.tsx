import { Routes, Route, Outlet } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/Login'
import { DashboardPage } from './pages/Dashboard'
import { IngredientsPage } from './pages/Ingredients'
import { RecipesPage } from './pages/Recipes'
import { RecipeDetailPage } from './pages/RecipeDetail'
import { BatchesPage } from './pages/Batches'
import { BatchNewPage } from './pages/BatchNew'
import { BatchDetailPage } from './pages/BatchDetail'

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Outlet />
      </AppShell>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/ingredients" element={<IngredientsPage />} />
        <Route path="/recipes" element={<RecipesPage />} />
        <Route path="/recipes/:id" element={<RecipeDetailPage />} />
        <Route path="/batches" element={<BatchesPage />} />
        <Route path="/batches/new" element={<BatchNewPage />} />
        <Route path="/batches/:id" element={<BatchDetailPage />} />
      </Route>
    </Routes>
  )
}
