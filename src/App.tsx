import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Login } from './components/Login';
import { MainLayout } from './layout/MainLayout';

// Placeholder Pages
import { Dashboard } from './components/Dashboard';
import { ProductList as Products } from './components/ProductList';
import { POS } from './components/POS';
import { History } from './components/History';
import { UserManagement } from './components/UserManagement';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <HashRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="products" element={<AdminRoute><Products /></AdminRoute>} />
              <Route path="pos" element={<POS />} />
              <Route path="history" element={<History />} />
              <Route path="users" element={<AdminRoute><UserManagement /></AdminRoute>} />
            </Route>
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </HashRouter>
  );
}

export default App;
