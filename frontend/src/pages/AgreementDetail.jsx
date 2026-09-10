import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ethers } from 'ethers';
import { Badge, Button } from 'react-bootstrap';
import Header from '../components/Header';
import FixedFooter from '../components/FixedFooter';
import { getLogisticsClient } from '../contracts';
import { revertReason, simulatedNow } from '../contracts/LogisticsClient';

function AgreementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const account = localStorage.getItem('account');
  const [agreement, setAgreement] = useState(null);
  const [shipperProfile, setShipperProfile] = useState(null);
  const [carrierProfile, setCarrierProfile] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const client = await getLogisticsClient();
      let details = await client.getAgreementDetails(id);

      // Free, local check first — only pay for the real checkDeadlines() call
      // when it actually looks overdue, instead of firing it on every view.
      const inProgress = details.milestones.find((m) => m.status === 'InProgress');
      if (details.status === 'Activated' && inProgress && simulatedNow() > inProgress.deadline) {
        await client.checkDeadlines(id);
        details = await client.getAgreementDetails(id);
      }

      setAgreement(details);
      const [shipper, carrier] = await Promise.all([
        client.getUserProfile(details.shipper),
        client.getUserProfile(details.carrier),
      ]);
      setShipperProfile(shipper);
      setCarrierProfile(carrier);
    } catch (err) {
      setError(revertReason(err));
    }
  }, [id]);

  useEffect(() => {
    load();
    window.ethereum?.on('accountsChanged', load);
    return () => window.ethereum?.removeListener('accountsChanged', load);
  }, [load]);

  const runAction = async (action) => {
    try {
      const client = await getLogisticsClient();
      await action(client);
      await load();
    } catch (err) {
      alert(revertReason(err));
    }
  };

  if (error) {
    return (
      <div className="container pt-5 mt-4 pb-5 text-start">
        <Header />
        <div className="mt-4 mb-4">
          <h1 className="h2 mb-3">Agreement not found</h1>
          <p className="text-muted">{error}</p>
          <Link to="/main" className="btn btn-primary">Back to Agreements</Link>
        </div>
        <FixedFooter />
      </div>
    );
  }

  if (!agreement) return null;

  const totalPayout = Number(ethers.formatEther(agreement.totalPayoutValue));
  const isCarrier = account === agreement.carrier;
  const isShipper = account === agreement.shipper;
  const activeMilestoneIndex = agreement.milestones.findIndex((m) => m.status === 'InProgress');

  return (
    <div className="container pt-5 mt-4 pb-5 text-start" style={{ maxWidth: '840px' }}>
      <Header />

      <Button variant="link" className="ps-0 mb-2 text-decoration-none" onClick={() => navigate('/main')}>
        &larr; Back to Agreements
      </Button>

      <div className="d-flex justify-content-between align-items-start mb-4">
        <h1 className="h2 fw-bold text-dark mb-0">Agreement {agreement.address.slice(0, 8)}</h1>
        <div className="d-flex gap-2 align-items-center">
          <Badge bg={agreement.status === 'Activated' ? 'success' : 'secondary'} className="mt-1">
            {agreement.status}
          </Badge>
        </div>
      </div>

      {/* Overview */}
      <section className="mb-5">
        <h2 className="h4 fw-bold text-dark border-bottom pb-2 mb-3">Agreement Details</h2>
        <div className="row g-3">
          <div className="col-md-6">
            <span className="text-muted d-block small">Shipper</span>
            {shipperProfile?.name && (
              <span className="d-block">{shipperProfile.name} ({shipperProfile.mail})</span>
            )}
            <span className="fw-semibold text-dark">{agreement.shipper}</span>
          </div>
          <div className="col-md-6">
            <span className="text-muted d-block small">Carrier</span>
            {carrierProfile?.name && (
              <span className="d-block">{carrierProfile.name} ({carrierProfile.mail})</span>
            )}
            <span className="fw-semibold text-dark">{agreement.carrier}</span>
          </div>
          <div className="col-md-6">
            <span className="text-muted d-block small">Total Escrow Amount</span>
            <span className="fw-semibold text-dark">{totalPayout.toFixed(4)} ETH</span>
          </div>
        </div>
      </section>

      {/* Milestones */}
      <section className="mb-5">
        <h2 className="h4 fw-bold text-dark border-bottom pb-2 mb-3">Milestones</h2>

        {/* Progress stepper */}
        <div className="d-flex align-items-center bg-white rounded-pill shadow-sm px-4 py-3 mb-4">
          {agreement.milestones.map((m, index) => {
            const isCompleted = m.status === 'Completed';
            const isCurrent = m.status === 'InProgress';
            const isFailed = m.status === 'Failed';
            return (
              <div key={index} className="d-flex align-items-center flex-grow-1">
                <div className="d-flex flex-column align-items-center" style={{ minWidth: '90px' }}>
                  <div
                    className={`d-flex align-items-center justify-content-center rounded-circle fw-bold ${
                      isCompleted
                        ? 'bg-success text-white'
                        : isFailed
                        ? 'bg-danger text-white'
                        : isCurrent
                        ? 'bg-primary text-white'
                        : 'bg-light text-muted border'
                    }`}
                    style={{ width: '28px', height: '28px', fontSize: '0.8rem' }}
                  >
                    {isCompleted ? '✓' : isFailed ? '✕' : index + 1}
                  </div>
                  <span className={`small mt-1 text-center ${isCurrent ? 'fw-semibold text-dark' : 'text-muted'}`}>
                    {m.title}
                  </span>
                </div>
                {index < agreement.milestones.length - 1 && (
                  <div
                    className={`flex-grow-1 ${isCompleted ? 'bg-success' : isFailed ? 'bg-danger' : 'bg-light'}`}
                    style={{ height: '2px' }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {agreement.milestones.map((m, index) => {
          const milestonePayout = ((totalPayout * Number(m.payoutPercent)) / 100).toFixed(4);
          return (
            <div key={index} className="card mb-3 shadow-sm">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-bold">
                    Milestone #{index + 1}: {m.title}
                  </span>
                  <Badge bg={m.status === 'Completed' ? 'success' : m.status === 'Failed' ? 'danger' : 'secondary'}>
                    {m.status}
                  </Badge>
                </div>
                <div className="d-flex gap-4 mb-3 small text-muted">
                  <span>Deadline: {new Date(m.deadline * 1000).toISOString().split('T')[0]}</span>
                  <span>Payout: {m.payoutPercent}% ({milestonePayout} ETH)</span>
                </div>

                <div className="bg-light p-3 rounded border">
                  <span className="fw-bold small text-dark d-block mb-2">Checkpoints</span>
                  {m.checkpoints.map((cp, cpIdx) => (
                    <div key={cpIdx} className="d-flex align-items-center justify-content-between gap-2 mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <span className={`badge ${cp.isCompleted ? 'bg-success' : 'bg-secondary'}`}>
                          {cp.isCompleted ? '✓' : cpIdx + 1}
                        </span>
                        <span className={cp.isCompleted ? 'text-dark' : 'text-muted'}>
                          {cp.description}
                          {cp.isCompleted && (
                            <span className="text-muted small ms-2">
                              ({new Date(cp.completedAt * 1000).toLocaleString()})
                            </span>
                          )}
                        </span>
                      </div>
                      {index === activeMilestoneIndex && !cp.isCompleted && isCarrier && !cp.isRequested && (
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => runAction((c) => c.requestCheckpoint(id, index, cpIdx))}
                        >
                          Request
                        </Button>
                      )}
                      {index === activeMilestoneIndex && !cp.isCompleted && isShipper && cp.isRequested && (
                        <Button
                          size="sm"
                          variant="outline-success"
                          onClick={() => runAction((c) => c.approveCheckpoint(id, index, cpIdx))}
                        >
                          Approve
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Payment Summary */}
      <section className="mb-4">
        <h2 className="h4 fw-bold text-dark border-bottom pb-2 mb-3">Payment Summary</h2>
        <div className="card p-4">
          <div className="table-responsive mb-0">
            <table className="table table-borderless align-middle mb-0">
              <tbody>
                <tr>
                  <td className="ps-0 text-muted">Total Escrow Amount</td>
                  <td className="pe-0 text-end fw-semibold text-dark">{totalPayout.toFixed(4)} ETH</td>
                </tr>
                <tr className="border-top">
                  <td className="ps-0 fw-bold fs-5 text-dark pt-3">Payout Remaining</td>
                  <td className="pe-0 text-end fw-bold fs-4 text-primary pt-3">
                    {Number(ethers.formatEther(agreement.payoutRemaining)).toFixed(4)} ETH
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <FixedFooter />
    </div>
  );
}

export default AgreementDetail;
