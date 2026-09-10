import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ethers } from 'ethers';
import Header from '../components/Header';
import FixedFooter from '../components/FixedFooter';
import { getLogisticsClient } from '../contracts';

const TYPE_BADGE = {
  AgreementCreation: 'bg-primary',
  Payoff: 'bg-success',
  Refund: 'bg-danger'
};

function Transactions() {
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState({});

  useEffect(() => {
    const load = async () => {
      const client = await getLogisticsClient();
      const addresses = await client.listMyAgreements();
      const perAgreement = await Promise.all(
        addresses.map(async (address) => {
          const txs = await client.listTransactions(address);
          return txs.map((t, i) => ({ ...t, agreementId: address, key: `${address}-${i}` }));
        })
      );
      const flat = perAgreement.flat().sort((a, b) => b.timestamp - a.timestamp);
      setRows(flat);

      const uniqueWallets = [...new Set(flat.flatMap((t) => [t.sender, t.receiver]))];
      const resolved = await Promise.all(uniqueWallets.map((w) => client.getUserName(w)));
      setNames(Object.fromEntries(uniqueWallets.map((w, i) => [w, resolved[i]])));
    };
    load();
    window.ethereum?.on('accountsChanged', load);
    return () => window.ethereum?.removeListener('accountsChanged', load);
  }, []);

  return (
    <div className="container pt-5 mt-4 pb-5 text-start">
      <Header />
      <h1 className="h2 fw-bold text-dark mb-4">Transactions</h1>

      {rows.length === 0 ? (
        <p className="text-muted">No transactions yet.</p>
      ) : (
        <div className="card p-3">
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Agreement</th>
                  <th>Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th className="text-end">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.key}>
                    <td className="text-muted small">{new Date(t.timestamp * 1000).toISOString().split('T')[0]}</td>
                    <td>
                      <Link to={`/agreement/${t.agreementId}`} className="text-decoration-none">
                        {t.agreementId.slice(0, 8)}
                      </Link>
                    </td>
                    <td>
                      <span className={`badge ${TYPE_BADGE[t.txType]}`}>{t.txType}</span>
                    </td>
                    <td className="small">{names[t.sender] ?? t.sender.slice(0, 10)}</td>
                    <td className="small">{names[t.receiver] ?? t.receiver.slice(0, 10)}</td>
                    <td className="text-end fw-semibold text-dark">{ethers.formatEther(t.amount)} ETH</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FixedFooter />
    </div>
  );
}

export default Transactions;
