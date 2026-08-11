import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Accordion, Button, Form, ProgressBar } from 'react-bootstrap';
import Header from '../components/Header';
import FixedFooter from '../components/FixedFooter';

function CreateAgreement() {
    const navigate = useNavigate();

    const [shipper, setShipper] = useState('');
    const [carrier, setCarrier] = useState('');
    const [totalEscrowAmount, setTotalEscrowAmount] = useState(1000);

    const [milestones, setMilestones] = useState([
        {
            id: Date.now(),
            name: 'Milestone 1: Origin Loading & Customs',
            deadline: '',
            payoutPercentage: 50,
            checkpoints: [
                { id: Date.now() + 1, description: 'Cargo loaded at origin warehouse' }
            ]
        },
        {
            id: Date.now() + 10,
            name: 'Milestone 2: Final Destination Delivery',
            deadline: '',
            payoutPercentage: 50,
            checkpoints: [
                { id: Date.now() + 11, description: 'Delivered to recipient address' }
            ]
        }
    ]);

    const ADMIN_FEE = 60;
    const PROCESSING_FEE = 40;

    // Date calculation
    const getSimDate = () => {
        const saved = localStorage.getItem('simDate');
        return saved ? new Date(saved) : new Date();
    };

    const simDateObj = getSimDate();
    const maxAllowedDate = new Date(simDateObj);
    maxAllowedDate.setDate(maxAllowedDate.getDate() + 90);
    const maxAllowedDateStr = maxAllowedDate.toISOString().split('T')[0];
    const simDateStr = simDateObj.toISOString().split('T')[0];

    // Totals
    const totalPayout = Number(totalEscrowAmount) || 0;
    const totalPayable = totalPayout + ADMIN_FEE + PROCESSING_FEE;
    const totalPercentage = milestones.reduce((sum, m) => sum + (Number(m.payoutPercentage) || 0), 0);

    // Validate last milestone deadline
    const lastMilestone = milestones[milestones.length - 1];
    const lastDeadlineInvalid = lastMilestone?.deadline && lastMilestone.deadline > maxAllowedDateStr;

    // Milestone Handlers
    const addMilestone = () => {
        setMilestones([
            ...milestones,
            {
                id: Date.now(),
                name: `Milestone ${milestones.length + 1}`,
                deadline: '',
                payoutPercentage: 0,
                checkpoints: [{ id: Date.now() + 1, description: '' }]
            }
        ]);
    };

    const removeMilestone = (id) => {
        if (milestones.length <= 1) {
            alert('Agreement must have at least one milestone.');
            return;
        }
        setMilestones(milestones.filter((m) => m.id !== id));
    };

    const updateMilestone = (id, field, value) => {
        setMilestones(
            milestones.map((m) => (m.id === id ? { ...m, [field]: value } : m))
        );
    };

    // Checkpoint Handlers
    const addCheckpoint = (milestoneId) => {
        setMilestones(
            milestones.map((m) => {
                if (m.id === milestoneId) {
                    return {
                        ...m,
                        checkpoints: [...m.checkpoints, { id: Date.now(), description: '' }]
                    };
                }
                return m;
            })
        );
    };

    const removeCheckpoint = (milestoneId, checkpointId) => {
        setMilestones(
            milestones.map((m) => {
                if (m.id === milestoneId) {
                    if (m.checkpoints.length <= 1) {
                        alert('A milestone must have at least one checkpoint.');
                        return m;
                    }
                    return {
                        ...m,
                        checkpoints: m.checkpoints.filter((c) => c.id !== checkpointId)
                    };
                }
                return m;
            })
        );
    };

    const updateCheckpoint = (milestoneId, checkpointId, description) => {
        setMilestones(
            milestones.map((m) => {
                if (m.id === milestoneId) {
                    return {
                        ...m,
                        checkpoints: m.checkpoints.map((c) =>
                            c.id === checkpointId ? { ...c, description } : c
                        )
                    };
                }
                return m;
            })
        );
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!shipper || !carrier) {
            alert('Please enter Shipper and Carrier names.');
            return;
        }
        if (totalPercentage !== 100) {
            alert(`Milestone payout percentages must sum to 100% (currently ${totalPercentage}%).`);
            return;
        }
        if (lastDeadlineInvalid) {
            alert('The last milestone deadline cannot exceed 90 days from the current date.');
            return;
        }
        alert('Logistics Escrow Agreement created successfully!');
        navigate('/main');
    };

    return (
        <div className="container pt-5 mt-4 pb-5 text-start" style={{ maxWidth: '840px' }}>
            <Header />

            <h1 className="h2 fw-bold text-dark mb-4">Create Escrow Agreement</h1>

            <Form onSubmit={handleSubmit}>
                {/* Basic Details Section */}
                <section className="mb-5">
                    <h2 className="h4 fw-bold text-dark border-bottom pb-2 mb-3">Agreement Details</h2>
                    <div className="row g-3">
                        <div className="col-md-6">
                            <Form.Group>
                                <Form.Label className="fw-semibold">Shipper Name</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="e.g. Maersk Global"
                                    value={shipper}
                                    onChange={(e) => setShipper(e.target.value)}
                                    required
                                />
                            </Form.Group>
                        </div>
                        <div className="col-md-6">
                            <Form.Group>
                                <Form.Label className="fw-semibold">Carrier Name (Account)</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="e.g. DHL Express Cargo"
                                    value={carrier}
                                    onChange={(e) => setCarrier(e.target.value)}
                                    required
                                />
                            </Form.Group>
                        </div>
                        <div className="col-md-12">
                            <Form.Group>
                                <Form.Label className="fw-semibold">Total Escrow Amount (RM)</Form.Label>
                                <Form.Control
                                    type="number"
                                    min="1"
                                    placeholder="1000"
                                    value={totalEscrowAmount}
                                    onChange={(e) => setTotalEscrowAmount(e.target.value)}
                                    required
                                />
                            </Form.Group>
                        </div>
                    </div>
                </section>

                {/* Milestones Accordion Section */}
                <section className="mb-5">
                    <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                        <h2 className="h4 fw-bold text-dark mb-0">Milestones</h2>
                        <Button variant="outline-primary" size="sm" onClick={addMilestone}>
                            + Add Milestone
                        </Button>
                    </div>

                    <Accordion defaultActiveKey="0" className="mb-3">
                        {milestones.map((m, index) => {
                            const milestonePayout = ((totalPayout * (Number(m.payoutPercentage) || 0)) / 100).toFixed(2);
                            return (
                                <Accordion.Item key={m.id} eventKey={String(index)} className="mb-2 border rounded shadow-sm">
                                    <Accordion.Header>
                                        <div className="d-flex justify-content-between align-items-center w-100 pe-3">
                                            <span className="fw-bold">
                                                Milestone #{index + 1}: {m.name || 'Untitled'}
                                            </span>
                                            <span className="badge bg-light text-dark border me-2">
                                                {m.payoutPercentage}% (RM {milestonePayout})
                                            </span>
                                        </div>
                                    </Accordion.Header>
                                    <Accordion.Body className="p-4">
                                        <div className="row g-3 mb-4">
                                            <div className="col-md-6">
                                                <Form.Label className="fw-semibold small">Milestone Name</Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    value={m.name}
                                                    onChange={(e) => updateMilestone(m.id, 'name', e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="col-md-3">
                                                <Form.Label className="fw-semibold small">Deadline</Form.Label>
                                                <Form.Control
                                                    type="date"
                                                    min={simDateStr}
                                                    max={index === milestones.length - 1 ? maxAllowedDateStr : undefined}
                                                    value={m.deadline}
                                                    onChange={(e) => updateMilestone(m.id, 'deadline', e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="col-md-3">
                                                <Form.Label className="fw-semibold small">Payout Percentage (%)</Form.Label>
                                                <div className="input-group">
                                                    <Form.Control
                                                        type="number"
                                                        min="1"
                                                        max="100"
                                                        value={m.payoutPercentage}
                                                        onChange={(e) => updateMilestone(m.id, 'payoutPercentage', e.target.value)}
                                                        required
                                                    />
                                                    <span className="input-group-text">%</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Checkpoints List */}
                                        <div className="bg-light p-3 rounded border mb-3">
                                            <div className="d-flex justify-content-between align-items-center mb-2">
                                                <span className="fw-bold small text-dark">Checkpoints</span>
                                                <Button
                                                    variant="outline-primary"
                                                    size="sm"
                                                    className="py-0 px-2 fw-bold"
                                                    onClick={() => addCheckpoint(m.id)}
                                                >
                                                    +
                                                </Button>
                                            </div>
                                            {m.checkpoints.map((cp, cpIdx) => (
                                                <div key={cp.id} className="d-flex gap-2 align-items-center mb-2">
                                                    <span className="badge bg-secondary">{cpIdx + 1}</span>
                                                    <Form.Control
                                                        type="text"
                                                        size="sm"
                                                        placeholder="Checkpoint description"
                                                        value={cp.description}
                                                        onChange={(e) => updateCheckpoint(m.id, cp.id, e.target.value)}
                                                        required
                                                    />
                                                    {m.checkpoints.length > 1 && (
                                                        <Button
                                                            variant="outline-danger"
                                                            size="sm"
                                                            className="py-0 px-2"
                                                            onClick={() => removeCheckpoint(m.id, cp.id)}
                                                        >
                                                            &times;
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {milestones.length > 1 && (
                                            <div className="text-end">
                                                <Button
                                                    variant="outline-danger"
                                                    size="sm"
                                                    onClick={() => removeMilestone(m.id)}
                                                >
                                                    Remove Milestone
                                                </Button>
                                            </div>
                                        )}
                                    </Accordion.Body>
                                </Accordion.Item>
                            );
                        })}
                    </Accordion>
                </section>

                {/* Cost Summary Section Below Form */}
                <section className="mb-4">
                    <h2 className="h4 fw-bold text-dark border-bottom pb-2 mb-3">Payment Summary</h2>
                    <div className="card border-secondary-subtle p-4">
                        <div className="row g-3">
                            <div className="col-md-4">
                                <span className="text-muted d-block small">Total Escrow Payout</span>
                                <span className="fs-5 fw-bold text-dark">RM {totalPayout.toFixed(2)}</span>
                            </div>
                            <div className="col-md-4">
                                <span className="text-muted d-block small">Admin Fee</span>
                                <span className="fs-5 fw-semibold text-dark">RM {ADMIN_FEE.toFixed(2)}</span>
                            </div>
                            <div className="col-md-4">
                                <span className="text-muted d-block small">Processing Fee</span>
                                <span className="fs-5 fw-semibold text-dark">RM {PROCESSING_FEE.toFixed(2)}</span>
                            </div>
                        </div>

                        <hr />

                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <span className="fs-5 fw-bold text-dark">Total Payable Amount</span>
                            <span className="fs-4 fw-bold text-primary">RM {totalPayable.toFixed(2)}</span>
                        </div>

                        {/* Percentage validation bar */}
                        <div className="mb-3">
                            <div className="d-flex justify-content-between small text-muted mb-1">
                                <span>Milestone Distribution Total</span>
                                <span className={totalPercentage === 100 ? 'text-success fw-bold' : 'text-danger fw-bold'}>
                                    {totalPercentage}% {totalPercentage !== 100 && '(Must equal 100%)'}
                                </span>
                            </div>
                            <ProgressBar
                                now={Math.min(totalPercentage, 100)}
                                variant={totalPercentage === 100 ? 'success' : 'warning'}
                                style={{ height: '8px' }}
                            />
                        </div>

                        {/* Deadline rule warning */}
                        {lastDeadlineInvalid && (
                            <div className="alert alert-danger small p-2 mb-3">
                                ⚠️ The last milestone deadline cannot exceed 90 days from the current date ({maxAllowedDateStr}).
                            </div>
                        )}

                        <Button
                            type="submit"
                            variant="warning"
                            size="lg"
                            className="w-100 fw-bold mt-2 py-2"
                            disabled={totalPercentage !== 100 || lastDeadlineInvalid}
                        >
                            Create Agreement
                        </Button>
                    </div>
                </section>
            </Form>

            <FixedFooter />
        </div>
    );
}

export default CreateAgreement;
