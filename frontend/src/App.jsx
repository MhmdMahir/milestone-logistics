import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login.jsx';
import MainPage from './pages/MainPage.jsx';
import CreateAgreement from './pages/CreateAgreement.jsx';

function ProtectedRoute({ children }) {
  const account = localStorage.getItem('account');
  if (!account) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  const account = localStorage.getItem('account');
  if (account) {
    return <Navigate to="/main" replace />;
  }
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/main" element={<ProtectedRoute><MainPage /></ProtectedRoute>} />
        <Route path="/create" element={<ProtectedRoute><CreateAgreement /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
