import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ethers } from 'ethers';
import { Toast, ToastContainer } from 'react-bootstrap';
import Header from '../components/Header';
import CardList from '../components/CardList';
import FixedFooter from '../components/FixedFooter';
import FloatAction from '../components/FloatAction';
import { getLogisticsClient } from '../contracts';

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
        carrier: details.carrier,
        shipper: details.shipper,
        status: details.status,
        requiresAttention: Boolean(attentionCheckpoint),
        tooltipText: attentionCheckpoint
            ? `Action Needed: ${milestone.title} awaits your ${isCarrier ? 'checkpoint request' : 'approval'}`
            : 'No Action Needed: Order operating normally',
    };
}

function MainPage() {
    const location = useLocation();
    const [name, setName] = useState('');
    const [agreements, setAgreements] = useState([]);
    const [showCreatedToast, setShowCreatedToast] = useState(Boolean(location.state?.created));

    useEffect(() => {
        const load = async () => {
            const client = await getLogisticsClient();
            const account = localStorage.getItem('account');
            const profile = await client.login();
            setName(profile.name);

            const addresses = await client.listMyAgreements();
            await Promise.all(addresses.map((a) => client.checkDeadlines(a)));
            const details = await Promise.all(addresses.map((a) => client.getAgreementDetails(a)));
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
                <CardList agreements={agreements.filter((a) => a.status !== 'Completed' && a.status !== 'Terminated')} />
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
