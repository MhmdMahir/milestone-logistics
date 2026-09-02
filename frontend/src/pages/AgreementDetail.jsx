import { useParams, useNavigate, Link } from 'react-router-dom';
import { Badge, Button } from 'react-bootstrap';
import Header from '../components/Header';
import FixedFooter from '../components/FixedFooter';

const ADMIN_FEE = 60;
const PROCESSING_FEE = 40;

const mockAgreements = {
  1: {
    title: 'Milestone Logistics Escrow #1041',
    amount: '1.5 ETH',
    totalEscrowAmount: 1500,
    carrier: 'DHL Express',
    shipper: 'Maersk Global',
    requiresAttention: true,
    statusText: 'Action Needed: Milestone 2 awaits your approval',
    milestones: [
      {
        name: 'Milestone 1: Origin Loading & Customs',
        deadline: '2026-08-05',
        payoutPercentage: 50,
        completed: true,
        checkpoints: [
          { description: 'Cargo loaded at origin warehouse', completed: true },
          { description: 'Customs clearance approved', completed: true }
        ]
      },
      {
        name: 'Milestone 2: Final Destination Delivery',
        deadline: '2026-09-10',
        payoutPercentage: 50,
        completed: false,
        checkpoints: [
          { description: 'Arrived at destination port', completed: true },
          { description: 'Delivered to recipient address', completed: false }
        ]
      }
    ]
  },
  2: {
    title: 'Freight Delivery Service #1042',
    amount: '4.2 ETH',
    totalEscrowAmount: 4200,
    carrier: 'FedEx Supply',
    shipper: 'Amazon Logistics',
    requiresAttention: false,
    statusText: 'No Action Needed: Order operating normally',
    milestones: [
      {
        name: 'Milestone 1: Warehouse Pickup',
        deadline: '2026-08-20',
        payoutPercentage: 30,
        completed: true,
        checkpoints: [{ description: 'Goods picked up from warehouse', completed: true }]
      },
      {
        name: 'Milestone 2: In-Transit Checkpoint',
        deadline: '2026-09-01',
        payoutPercentage: 30,
        completed: false,
        checkpoints: [{ description: 'Passed regional distribution hub', completed: false }]
      },
      {
        name: 'Milestone 3: Final Delivery',
        deadline: '2026-09-15',
        payoutPercentage: 40,
        completed: false,
        checkpoints: [{ description: 'Delivered to recipient address', completed: false }]
      }
    ]
  },
  3: {
    title: 'Customs Clearance Contract #1043',
    amount: '0.8 ETH',
    totalEscrowAmount: 800,
    carrier: 'UPS Worldwide',
    shipper: 'Kuehne + Nagel',
    requiresAttention: true,
    statusText: 'Action Needed: Evidence submission requested',
    milestones: [
      {
        name: 'Milestone 1: Documentation Filed',
        deadline: '2026-08-15',
        payoutPercentage: 100,
        completed: false,
        checkpoints: [
          { description: 'Customs paperwork submitted', completed: true },
          { description: 'Inspection evidence uploaded', completed: false }
        ]
      }
    ]
  }
};

function AgreementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const agreement = mockAgreements[id];

  if (!agreement) {
    return (
      <div className="container pt-5 mt-4 pb-5 text-start">
        <Header />
        <div className="mt-4 mb-4">
          <h1 className="h2 mb-3">Agreement not found</h1>
          <p className="text-muted">No agreement exists with id "{id}".</p>
          <Link to="/main" className="btn btn-primary">Back to Agreements</Link>
        </div>
        <FixedFooter />
      </div>
    );
  }

  const totalPayout = agreement.totalEscrowAmount;
  const totalPayable = totalPayout + ADMIN_FEE + PROCESSING_FEE;

  return (
    <div className="container pt-5 mt-4 pb-5 text-start" style={{ maxWidth: '840px' }}>
      <Header />

      <Button variant="link" className="ps-0 mb-2 text-decoration-none" onClick={() => navigate('/main')}>
        &larr; Back to Agreements
      </Button>

      <div className="d-flex justify-content-between align-items-start mb-4">
        <h1 className="h2 fw-bold text-dark mb-0">{agreement.title}</h1>
        <Badge bg={agreement.requiresAttention ? 'danger' : 'success'} className="mt-1">
          {agreement.requiresAttention ? 'Action Needed' : 'On Track'}
        </Badge>
      </div>
      <p className="text-muted mb-4">{agreement.statusText}</p>

      {/* Overview */}
      <section className="mb-5">
        <h2 className="h4 fw-bold text-dark border-bottom pb-2 mb-3">Agreement Details</h2>
        <div className="row g-3">
          <div className="col-md-6">
            <span className="text-muted d-block small">Shipper</span>
            <span className="fw-semibold text-dark">{agreement.shipper}</span>
          </div>
          <div className="col-md-6">
            <span className="text-muted d-block small">Carrier</span>
            <span className="fw-semibold text-dark">{agreement.carrier}</span>
          </div>
          <div className="col-md-6">
            <span className="text-muted d-block small">Total Escrow Amount</span>
            <span className="fw-semibold text-dark">{agreement.amount}</span>
          </div>
        </div>
      </section>

      {/* Milestones */}
      <section className="mb-5">
        <h2 className="h4 fw-bold text-dark border-bottom pb-2 mb-3">Milestones</h2>
        {agreement.milestones.map((m, index) => {
          const milestonePayout = ((totalPayout * m.payoutPercentage) / 100).toFixed(2);
          return (
            <div key={index} className="card mb-3 shadow-sm">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-bold">
                    Milestone #{index + 1}: {m.name}
                  </span>
                  <Badge bg={m.completed ? 'success' : 'secondary'}>
                    {m.completed ? 'Completed' : 'Pending'}
                  </Badge>
                </div>
                <div className="d-flex gap-4 mb-3 small text-muted">
                  <span>Deadline: {m.deadline}</span>
                  <span>Payout: {m.payoutPercentage}% (RM {milestonePayout})</span>
                </div>

                <div className="bg-light p-3 rounded border">
                  <span className="fw-bold small text-dark d-block mb-2">Checkpoints</span>
                  {m.checkpoints.map((cp, cpIdx) => (
                    <div key={cpIdx} className="d-flex align-items-center gap-2 mb-2">
                      <span className={`badge ${cp.completed ? 'bg-success' : 'bg-secondary'}`}>
                        {cp.completed ? '✓' : cpIdx + 1}
                      </span>
                      <span className={cp.completed ? 'text-dark' : 'text-muted'}>
                        {cp.description}
                      </span>
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
                  <td className="ps-0 text-muted">Total Escrow Payout</td>
                  <td className="pe-0 text-end fw-semibold text-dark">RM {totalPayout.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="ps-0 text-muted">Admin Fee</td>
                  <td className="pe-0 text-end fw-semibold text-dark">RM {ADMIN_FEE.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="ps-0 text-muted">Processing Fee</td>
                  <td className="pe-0 text-end fw-semibold text-dark">RM {PROCESSING_FEE.toFixed(2)}</td>
                </tr>
                <tr className="border-top">
                  <td className="ps-0 fw-bold fs-5 text-dark pt-3">Total Payable Amount</td>
                  <td className="pe-0 text-end fw-bold fs-4 text-primary pt-3">RM {totalPayable.toFixed(2)}</td>
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
