import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ethers } from 'ethers';
import { Toast, ToastContainer, Form } from 'react-bootstrap';
import Header from '../components/Header';
import CardList from '../components/CardList';
import FixedFooter from '../components/FixedFooter';
import FloatAction from '../components/FloatAction';
import { getLogisticsClient } from '../contracts';
import { simulatedNow } from '../contracts/LogisticsClient';

function resolveName(address) {
    const raw = localStorage.getItem(`profile:${address}`);
    if (raw) return JSON.parse(raw).name;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function summarize(details, account) {
    const milestone = details.milestones.find((m) => m.status === 'InProgress');
    const isCarrier = account === details.carrier;
    const attentionCheckpoint = milestone?.checkpoints.find((cp) =>
        isCarrier ? !cp.isRequested && !cp.isCompleted : cp.isRequested && !cp.isCompleted
    );
    return {
        id: details.address,
        title: `Agreement ${details.address.slice(0, 8)}`,
        amount: `${ethers.formatEther(details.totalPayoutValue)} ETH`,
        carrier: resolveName(details.carrier),
        shipper: resolveName(details.shipper),
        status: details.status,
        requiresAttention: Boolean(attentionCheckpoint),
        tooltipText: attentionCheckpoint
            ? `Action Needed: ${milestone.title} awaits your ${isCarrier ? 'checkpoint request' : 'approval'}`
            : 'No Action Needed: Order operating normally',
    };
}

function byAttentionFirst(a, b) {
    return Number(b.requiresAttention) - Number(a.requiresAttention);
}

function matchesSearch(agreement, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    return [agreement.title, agreement.carrier, agreement.shipper].some((field) =>
        field.toLowerCase().includes(q)
    );
}

function MainPage() {
    const location = useLocation();
    const [name, setName] = useState('');
    const [agreements, setAgreements] = useState([]);
    const [showCreatedToast, setShowCreatedToast] = useState(Boolean(location.state?.created));
    const [search, setSearch] = useState('');
    const [attentionOnly, setAttentionOnly] = useState(false);

    useEffect(() => {
        const load = async () => {
            const client = await getLogisticsClient();
            const account = localStorage.getItem('account');
            const profile = await client.login();
            setName(profile.name);
            localStorage.setItem(`profile:${account}`, JSON.stringify(profile));

            const addresses = await client.listMyAgreements();
            let details = await Promise.all(addresses.map((a) => client.getAgreementDetails(a)));

            // Free, local check first — only pay for the real checkDeadlines()
            // call on the agreements that actually look overdue, instead of
            // firing it for every agreement on every load.
            const now = simulatedNow();
            const overdue = details.filter((d) => {
                const inProgress = d.milestones.find((m) => m.status === 'InProgress');
                return d.status === 'Activated' && inProgress && now > inProgress.deadline;
            });
            if (overdue.length) {
                await Promise.all(overdue.map((d) => client.checkDeadlines(d.address)));
                details = await Promise.all(addresses.map((a) => client.getAgreementDetails(a)));
            }

            setAgreements(details.map((d) => summarize(d, account)));
        };
        load();
        window.addEventListener('simDateChanged', load);
        window.ethereum?.on('accountsChanged', load);
        return () => {
            window.removeEventListener('simDateChanged', load);
            window.ethereum?.removeListener('accountsChanged', load);
        };
    }, []);

    const activeAgreements = agreements
        .filter((a) => a.status !== 'Completed' && a.status !== 'Terminated')
        .filter((a) => matchesSearch(a, search))
        .filter((a) => !attentionOnly || a.requiresAttention)
        .sort(byAttentionFirst);

    return (
        <div className="container pt-5 mt-4 pb-5 text-start">
            <Header />
            <ToastContainer position="top-end" className="p-3" style={{ zIndex: 1050 }}>
                <Toast bg="success" show={showCreatedToast} onClose={() => setShowCreatedToast(false)} delay={4000} autohide>
                    <Toast.Body className="text-white fw-semibold">Agreement created successfully!</Toast.Body>
                </Toast>
            </ToastContainer>
            <div className="mt-4 mb-4">
                <h1 className="h2 mb-4">Hello, {name || 'there'} !</h1>
                <div className="d-flex gap-3 align-items-center mb-3">
                    <Form.Control
                        type="search"
                        placeholder="Search by name or agreement..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ maxWidth: '320px' }}
                    />
                    <Form.Check
                        type="switch"
                        id="attention-only-switch"
                        label="Needs attention only"
                        checked={attentionOnly}
                        onChange={(e) => setAttentionOnly(e.target.checked)}
                    />
                </div>
                {activeAgreements.length === 0 && (search || attentionOnly) ? (
                    <p className="text-muted">No agreements match your filters.</p>
                ) : (
                    <CardList agreements={activeAgreements} />
                )}
            </div>

            {agreements.some((a) => a.status === 'Completed' || a.status === 'Terminated') && (
                <div className="mb-4">
                    <h2 className="h4 fw-bold text-dark border-bottom pb-2 mb-3">Archive</h2>
                    <CardList agreements={agreements.filter((a) => a.status === 'Completed' || a.status === 'Terminated')} />
                </div>
            )}
            <FloatAction />
            <FixedFooter />
        </div>
    );
}

export default MainPage;
