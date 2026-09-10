import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ethers } from 'ethers';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import MainPage from './pages/MainPage.jsx';
import CreateAgreement from './pages/CreateAgreement.jsx';
import AgreementDetail from './pages/AgreementDetail.jsx';
import Transactions from './pages/Transactions.jsx';
import CounterDemo from './pages/CounterDemo.jsx';
import CheckpointTest from './pages/CheckpointTest.jsx';

function isRegistered(account) {
  return account ? !!localStorage.getItem(`profile:${account}`) : false;
}

function ProtectedRoute({ children }) {
  const account = localStorage.getItem('account');

  if (!account) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function RegisterRoute({ children }) {
  const account = localStorage.getItem('account');

  if (!account) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  return children;
}

// Login.jsx caches the connected wallet in localStorage so pages can gate on
// role (isCarrier/isShipper, ProtectedRoute) without an async wallet call.
// If the user switches accounts in MetaMask afterwards, that cache goes
// stale while the signer used to actually send transactions doesn't — so a
// stale-carrier button could sign with the wrong account and get rejected
// on-chain. Keep the cache synced to MetaMask's live account everywhere.
function useSyncedAccount() {
  useEffect(() => {
    const onAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        localStorage.removeItem('account');
      } else {
        localStorage.setItem('account', ethers.getAddress(accounts[0]));
      }
    };

    window.ethereum?.on('accountsChanged', onAccountsChanged);
    return () => window.ethereum?.removeListener('accountsChanged', onAccountsChanged);
  }, []);
}

function App() {
  useSyncedAccount();

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
        <Route path="/checkpoint-test" element={<CheckpointTest />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;