import { useState, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { Accordion, Button, Form } from 'react-bootstrap';
import Header from '../components/Header';
import FixedFooter from '../components/FixedFooter';
import { getLogisticsClient } from '../contracts';

function MultiThumbSplitter({ milestones, setMilestones, totalPayout }) {
    const containerRef = useRef(null);

    // Compute cumulative cut points (percentages from 0 to 100)
    const cuts = [];
    let accum = 0;
    for (let i = 0; i < milestones.length - 1; i++) {
        accum += Number(milestones[i].payoutPercentage) || 0;
        cuts.push(accum);
    }

    const handleMouseDown = (index, e) => {
        e.preventDefault();

        const onMouseMove = (moveEvent) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const rawPct = Math.round(((moveEvent.clientX - rect.left) / rect.width) * 100);

            const minVal = index > 0 ? cuts[index - 1] + 1 : 1;
            const maxVal = index < cuts.length - 1 ? cuts[index + 1] - 1 : 99;
            const clampedPct = Math.max(minVal, Math.min(maxVal, rawPct));

            // Rebuild milestone payout percentages
            const newCuts = [...cuts];
            newCuts[index] = clampedPct;

            const newMilestones = milestones.map((m, i) => {
                const prevCut = i > 0 ? newCuts[i - 1] : 0;
                const currentCut = i < newCuts.length ? newCuts[i] : 100;
                return {
                    ...m,
                    payoutPercentage: currentCut - prevCut
                };
            });

            setMilestones(newMilestones);
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const bgColors = ['#20262E', '#38598b', '#fa984a', '#68d391', '#ea4998'];

    return (
        <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="fw-semibold small text-dark">Payout Distribution</span>
            </div>

            <div
                ref={containerRef}
                className="position-relative w-100 rounded-3 shadow-sm"
                style={{ height: '38px', backgroundColor: '#e9ecef', userSelect: 'none' }}
            >
                {/* Milestone Color Segments */}
                <div className="d-flex w-100 h-100 rounded-3 overflow-hidden">
                    {milestones.map((m, idx) => {
                        const pct = Number(m.payoutPercentage) || 0;
                        const bg = bgColors[idx % bgColors.length];
                        const val = ((totalPayout * pct) / 100).toFixed(4);
                        return (
                            <div
                                key={m.id}
                                className="h-100 d-flex align-items-center justify-content-center text-white small fw-bold px-1 text-truncate"
                                style={{
                                    width: `${pct}%`,
                                    backgroundColor: bg,
                                    transition: 'width 0.03s ease-out',
                                    fontSize: '0.75rem'
                                }}
                            >
                                {pct >= 10 && `M${idx + 1}: ${pct}% (${val} ETH)`}
                            </div>
                        );
                    })}
                </div>

                {/* Draggable Handles */}
                {cuts.map((cutPct, handleIdx) => (
                    <div
                        key={handleIdx}
                        className="position-absolute top-0 bottom-0 d-flex align-items-center justify-content-center"
                        style={{
                            left: `${cutPct}%`,
                            transform: 'translateX(-50%)',
                            cursor: 'col-resize',
                            zIndex: 10,
                            width: '24px'
                        }}
                        onMouseDown={(e) => handleMouseDown(handleIdx, e)}
                    >
                        <div
                            className="bg-white border border-2 border-dark shadow-sm rounded-pill d-flex align-items-center justify-content-center"
                            style={{ width: '14px', height: '28px', fontSize: '10px', color: '#000' }}
                        >
                            ║
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function CreateAgreement() {
    const navigate = useNavigate();

    const account = localStorage.getItem('account');
    const profileRaw = account && localStorage.getItem(`profile:${account}`);
    const isCarrier = profileRaw && JSON.parse(profileRaw).role === 'Carrier';

    const [carrier, setCarrier] = useState('');
    const [totalEscrowAmount, setTotalEscrowAmount] = useState(0.1);

    const [milestones, setMilestones] = useState([
        {
            id: Date.now(),
            name: 'Origin Loading & Customs',
            deadline: '',
            payoutPercentage: 50,
            checkpoints: [
                { id: Date.now() + 1, description: 'Cargo loaded at origin warehouse' }
            ]
        },
        {
            id: Date.now() + 10,
            name: 'Final Destination Delivery',
            deadline: '',
            payoutPercentage: 50,
            checkpoints: [
                { id: Date.now() + 11, description: 'Delivered to recipient address' }
            ]
        }
    ]);

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
    const totalPercentage = milestones.reduce((sum, m) => sum + (Number(m.payoutPercentage) || 0), 0);

    // Validate last milestone deadline
    const lastMilestone = milestones[milestones.length - 1];
    const lastDeadlineInvalid = lastMilestone?.deadline && lastMilestone.deadline > maxAllowedDateStr;

    // Milestone Handlers
    const addMilestone = () => {
        const newCount = milestones.length + 1;
        const basePct = Math.floor(100 / newCount);
        const remainder = 100 - basePct * newCount;

        const updated = [
            ...milestones.map((m, idx) => ({
                ...m,
                payoutPercentage: idx === newCount - 2 ? basePct : m.payoutPercentage
            })),
            {
                id: Date.now(),
                name: `Milestone ${newCount}`,
                deadline: '',
                payoutPercentage: basePct + remainder,
                checkpoints: [{ id: Date.now() + 1, description: '' }]
            }
        ];

        // Equalize percentages on add
        const equalPct = Math.floor(100 / newCount);
        const rem = 100 - equalPct * newCount;
        setMilestones(
            updated.map((m, idx) => ({
                ...m,
                payoutPercentage: idx === newCount - 1 ? equalPct + rem : equalPct
            }))
        );
    };

    const removeMilestone = (id) => {
        if (milestones.length <= 1) {
            alert('Agreement must have at least one milestone.');
            return;
        }
        const filtered = milestones.filter((m) => m.id !== id);
        const equalPct = Math.floor(100 / filtered.length);
        const rem = 100 - equalPct * filtered.length;
        setMilestones(
            filtered.map((m, idx) => ({
                ...m,
                payoutPercentage: idx === filtered.length - 1 ? equalPct + rem : equalPct
            }))
        );
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!carrier) {
            alert('Please enter the carrier\'s wallet address.');
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

        const duration = Math.floor((new Date(lastMilestone.deadline).getTime() - simDateObj.getTime()) / 1000);
        const milestoneInputs = milestones.map((m) => ({
            deadline: Math.floor(new Date(m.deadline).getTime() / 1000),
            payoutPercent: Number(m.payoutPercentage),
            title: m.name,
            checkpointDescriptions: m.checkpoints.map((c) => c.description),
        }));

        try {
            const client = await getLogisticsClient();
            await client.createAgreement(carrier, ethers.parseEther(String(totalEscrowAmount)), duration, milestoneInputs);
            navigate('/main', { state: { created: true } });
        } catch (err) {
            alert(err.message);
        }
    };

    if (!isCarrier) {
        return <Navigate to="/main" replace />;
    }

    return (
        <div className="container pt-5 mt-4 pb-5 text-start" style={{ maxWidth: '840px' }}>
            <Header />

            <h1 className="h2 fw-bold text-dark mb-4">Create Escrow Agreement</h1>

            <Form onSubmit={handleSubmit}>
                {/* Basic Details Section */}
                <section className="mb-5">
                    <h2 className="h4 fw-bold text-dark border-bottom pb-2 mb-3">Agreement Details</h2>
                    <div className="row g-3">
                        <div className="col-md-12">
                            <Form.Group>
                                <Form.Label className="fw-semibold">Carrier Wallet Address</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="0x..."
                                    value={carrier}
                                    onChange={(e) => setCarrier(e.target.value)}
                                    required
                                />
                            </Form.Group>
                        </div>
                        <div className="col-md-12">
                            <Form.Group>
                                <Form.Label className="fw-semibold">Total Escrow Amount (ETH)</Form.Label>
                                <Form.Control
                                    type="number"
                                    min="0.0001"
                                    step="0.0001"
                                    placeholder="0.1"
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
                        <div className="d-flex gap-2">
                            <Button variant="outline-primary" size="sm" onClick={addMilestone}>
                                + Add Milestone
                            </Button>
                        </div>
                    </div>

                    {/* Interactive Multi-Thumb Splitter Bar */}
                    <MultiThumbSplitter
                        milestones={milestones}
                        setMilestones={setMilestones}
                        totalPayout={totalPayout}
                    />

                    <Accordion defaultActiveKey="0" className="mb-3">
                        {milestones.map((m, index) => {
                            const milestonePayout = ((totalPayout * (Number(m.payoutPercentage) || 0)) / 100).toFixed(4);
                            return (
                                <Accordion.Item key={m.id} eventKey={String(index)} className="mb-2 border rounded shadow-sm">
                                    <Accordion.Header>
                                        <div className="d-flex justify-content-between align-items-center w-100 pe-3">
                                            <span className="fw-bold">
                                                Milestone #{index + 1}: {m.name || 'Untitled'}
                                            </span>
                                            <span className="badge bg-light text-dark border me-2">
                                                {m.payoutPercentage}% ({milestonePayout} ETH)
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
                                            <div className="col-md-6">
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
                    <div className="card p-4">
                        <div className="table-responsive mb-2">
                            <table className="table table-borderless align-middle mb-0">
                                <tbody>
                                    <tr className="border-top">
                                        <td className="ps-0 fw-bold fs-5 text-dark pt-3">Total Escrow Amount</td>
                                        <td className="pe-0 text-end fw-bold fs-4 text-primary pt-3">{totalPayout.toFixed(4)} ETH</td>
                                    </tr>
                                </tbody>
                            </table>
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
                            className="w-100 fw-bold mt-2 py-2 shadow-sm"
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
