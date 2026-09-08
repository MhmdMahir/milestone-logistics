import { useCallback, useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { Badge, Button } from 'react-bootstrap';
import { getLogisticsClient } from '../contracts';

function formatDate(seconds) {
  return new Date(Number(seconds) * 1000).toISOString().split('T')[0];
}

function simulatedDate() {
  return localStorage.getItem('simDate') || new Date().toISOString().split('T')[0];
}

function RefundDemo() {
  const [agreement, setAgreement] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [simDate, setSimDate] = useState(simulatedDate);

  const load = useCallback(async () => {
    try {
      const client = await getLogisticsClient();
      const addresses = await client.listMyAgreements();
      const demoAddress = addresses.find((address) => address.startsWith('refund-demo-'));
      if (!demoAddress) {
        setAgreement(null);
        setTransactions([]);
      } else {
        setAgreement(await client.getAgreementDetails(demoAddress));
        setTransactions(await client.listTransactions(demoAddress));
      }
      setSimDate(simulatedDate());
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action) => {
    try {
      const client = await getLogisticsClient();
      await action(client);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const resetDemo = () => run(async (client) => {
    const address = await client.createRefundDemoAgreement();
    localStorage.setItem('simDate', new Date().toISOString().split('T')[0]);
    setMessage(`Created ${address}`);
  });

  const expireDemo = () => {
    if (!agreement) return;
    const expired = new Date(Number(agreement.milestones[0].deadline) * 1000 + 86400000);
    const value = expired.toISOString().split('T')[0];
    localStorage.setItem('simDate', value);
    setSimDate(value);
    setMessage(`Simulated date moved to ${value}`);
  };

  const activeMilestone = agreement?.milestones.find((milestone) => milestone.status === 'InProgress');
  const activeIndex = agreement?.milestones.findIndex((milestone) => milestone.status === 'InProgress') ?? -1;

  return (
    <main className="container py-5" style={{ maxWidth: '840px' }}>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <p className="text-uppercase text-muted small fw-semibold mb-1">Standalone simulation</p>
          <h1 className="h2 fw-bold mb-2">Refund demo</h1>
          <p className="text-muted mb-0">The connected wallet acts as both shipper and carrier for this local mock.</p>
        </div>
        <Button variant="outline-primary" onClick={resetDemo}>Reset demo</Button>
      </div>

      {message && <div className="alert alert-info">{message}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {!agreement ? (
        <section className="border rounded p-4">
          <h2 className="h5">No demo agreement</h2>
          <p className="text-muted">Create a local agreement, leave a checkpoint incomplete, then expire its deadline.</p>
          <Button onClick={resetDemo}>Create mock agreement</Button>
        </section>
      ) : (
        <>
          <section className="border rounded p-4 mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">Agreement state</h2>
              <Badge bg={agreement.status === 'Terminated' ? 'danger' : 'success'}>{agreement.status}</Badge>
            </div>
            <div className="row g-3 small">
              <div className="col-md-6"><span className="text-muted d-block">Shipper / carrier</span>{agreement.shipper}</div>
              <div className="col-md-6"><span className="text-muted d-block">Simulated date</span>{simDate}</div>
              <div className="col-md-6"><span className="text-muted d-block">Escrow remaining</span>{ethers.formatEther(agreement.payoutRemaining)} ETH</div>
              <div className="col-md-6"><span className="text-muted d-block">Active deadline</span>{activeMilestone ? formatDate(activeMilestone.deadline) : 'none'}</div>
            </div>
          </section>

          <section className="border rounded p-4 mb-4">
            <h2 className="h5 mb-3">Milestones and checkpoints</h2>
            {agreement.milestones.map((milestone, milestoneIndex) => (
              <div className="border rounded p-3 mb-3" key={milestone.title}>
                <div className="d-flex justify-content-between mb-2">
                  <strong>{milestone.title}</strong>
                  <Badge bg="secondary">{milestone.status}</Badge>
                </div>
                <p className="small text-muted mb-3">Deadline: {formatDate(milestone.deadline)}</p>
                {milestone.checkpoints.map((checkpoint, checkpointIndex) => (
                  <div className="d-flex justify-content-between align-items-center border-top py-2 gap-2" key={checkpoint.description}>
                    <span>{checkpoint.description}</span>
                    <span className="small text-muted">
                      {checkpoint.isCompleted ? 'Completed' : checkpoint.isRequested ? 'Requested' : 'Pending'}
                    </span>
                    {milestoneIndex === activeIndex && !checkpoint.isCompleted && !checkpoint.isRequested && (
                      <Button size="sm" variant="outline-primary" onClick={() => run((client) => client.requestCheckpoint(agreement.address, milestoneIndex, checkpointIndex))}>Request</Button>
                    )}
                    {milestoneIndex === activeIndex && checkpoint.isRequested && !checkpoint.isCompleted && (
                      <Button size="sm" variant="outline-success" onClick={() => run((client) => client.approveCheckpoint(agreement.address, milestoneIndex, checkpointIndex))}>Approve</Button>
                    )}
                  </div>
                ))}
              </div>
            ))}
            <div className="d-flex gap-2">
              <Button variant="outline-secondary" onClick={expireDemo} disabled={agreement.status !== 'Activated'}>Move past deadline</Button>
              <Button variant="danger" onClick={() => run((client) => client.checkDeadlines(agreement.address))} disabled={agreement.status !== 'Activated'}>Run checkDeadlines()</Button>
            </div>
          </section>

          <section className="border rounded p-4">
            <h2 className="h5 mb-3">Transactions</h2>
            {transactions.map((transaction) => (
              <div className="d-flex justify-content-between border-top py-2 small" key={`${transaction.txType}-${transaction.timestamp}`}>
                <span>{transaction.txType} to {transaction.receiver}</span>
                <span>{ethers.formatEther(transaction.amount)} ETH</span>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}

export default RefundDemo;
