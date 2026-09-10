import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import MainPage from './pages/MainPage.jsx';
import CreateAgreement from './pages/CreateAgreement.jsx';
import AgreementDetail from './pages/AgreementDetail.jsx';
import Transactions from './pages/Transactions.jsx';
import CounterDemo from './pages/CounterDemo.jsx';
import RefundDemo from './pages/RefundDemo.jsx';

function isRegistered(account) {
  return account ? !!localStorage.getItem(`profile:${account}`) : false;
}

function isRegistered(account) {
  return account ? !!localStorage.getItem(`profile:${account}`) : false;
}

function ProtectedRoute({ children }) {
  const account = localStorage.getItem('account');
  if (!account) {
    return <Navigate to="/" replace />;
  }
  if (!isRegistered(account)) {
    return <Navigate to="/register" replace />;
  }
  return children;
}

function RegisterRoute({ children }) {
  const account = localStorage.getItem('account');
  if (!account) {
    return <Navigate to="/" replace />;
  }
  if (isRegistered(account)) {
    return <Navigate to="/main" replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  const account = localStorage.getItem('account');
  if (account) {
    return <Navigate to={isRegistered(account) ? '/main' : '/register'} replace />;
  }
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<RegisterRoute><Register /></RegisterRoute>} />
        <Route path="/main" element={<ProtectedRoute><MainPage /></ProtectedRoute>} />
        <Route path="/create" element={<ProtectedRoute><CreateAgreement /></ProtectedRoute>} />
        <Route path="/agreement/:id" element={<ProtectedRoute><AgreementDetail /></ProtectedRoute>} />
        <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
        <Route path="/counter-demo" element={<CounterDemo />} />
        <Route path="/refund-demo" element={<RefundDemo />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
