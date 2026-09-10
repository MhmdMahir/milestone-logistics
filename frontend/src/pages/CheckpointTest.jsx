import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { getContract, CHAIN_ID } from '../contracts';

function CheckpointTest() {
  const [account, setAccount] = useState('');
  const [agreement, setAgreement] = useState('');
  const [milestoneIndex, setMilestoneIndex] = useState('0');
  const [checkpointIndex, setCheckpointIndex] = useState('0');

  const [checkpoint, setCheckpoint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // ------------------------------------------------------------
  // CONNECT METAMASK
  // ------------------------------------------------------------

  async function connectWallet() {
    try {
      setError('');
      setMessage('');

      if (!window.ethereum) {
        throw new Error('MetaMask is not installed.');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);

      const network = await provider.getNetwork();

      if (Number(network.chainId) !== CHAIN_ID) {
        throw new Error(
          `Wrong network. Please connect MetaMask to Ganache (Chain ID ${CHAIN_ID}).`
        );
      }

      await provider.send('eth_requestAccounts', []);

      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      setAccount(address);

      setMessage(`Connected: ${address}`);
    } catch (err) {
      console.error(err);
      setError(err.shortMessage || err.message);
    }
  }

  // ------------------------------------------------------------
  // LOAD CHECKPOINT FROM BLOCKCHAIN
  // ------------------------------------------------------------

  async function loadCheckpoint() {
    try {
      setError('');

      if (!agreement) {
        throw new Error('Enter an agreement address first.');
      }

      if (!ethers.isAddress(agreement)) {
        throw new Error('Invalid agreement address.');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);

      const agreementContract = new ethers.Contract(
        agreement,
        [
          'function getMilestone(uint256) view returns (uint256 deadline, uint256 payoutPercent, string title, uint8 status, tuple(string description, bool isRequested, bool isCompleted)[] checkpoints)'
        ],
        provider
      );

      const milestone = await agreementContract.getMilestone(
        Number(milestoneIndex)
      );

      const cp = milestone.checkpoints[Number(checkpointIndex)];

      setCheckpoint({
        description: cp.description,
        requested: cp.isRequested,
        completed: cp.isCompleted,
      });

      setMessage('Checkpoint state loaded from blockchain.');
    } catch (err) {
      console.error(err);
      setError(err.shortMessage || err.message);
    }
  }

  // ------------------------------------------------------------
  // REQUEST CHECKPOINT
  // ------------------------------------------------------------

  async function requestCheckpoint() {
    try {
      setLoading(true);
      setError('');
      setMessage('');

      if (!account) {
        throw new Error('Connect MetaMask first.');
      }

      if (!ethers.isAddress(agreement)) {
        throw new Error('Enter a valid agreement address.');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // This is the deployed LogisticsClient contract.
      const logisticsClient = getContract(
        'LogisticsClient',
        CHAIN_ID,
        signer
      );

      setMessage('Waiting for MetaMask confirmation...');

      const tx = await logisticsClient.requestCheckpoint(
        agreement,
        Number(milestoneIndex),
        Number(checkpointIndex)
      );

      setMessage(`Transaction submitted: ${tx.hash}`);

      await tx.wait();

      setMessage(
        'Checkpoint request confirmed on the blockchain.'
      );

      await loadCheckpoint();
    } catch (err) {
      console.error(err);

      setError(
        err.shortMessage ||
        err.reason ||
        err.message ||
        'Transaction failed.'
      );
    } finally {
      setLoading(false);
    }
  }

  // ------------------------------------------------------------
  // APPROVE CHECKPOINT
  // ------------------------------------------------------------

  async function approveCheckpoint() {
    try {
      setLoading(true);
      setError('');
      setMessage('');

      if (!account) {
        throw new Error('Connect MetaMask first.');
      }

      if (!ethers.isAddress(agreement)) {
        throw new Error('Enter a valid agreement address.');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const logisticsClient = getContract(
        'LogisticsClient',
        CHAIN_ID,
        signer
      );

      setMessage('Waiting for MetaMask confirmation...');

      const tx = await logisticsClient.approveCheckpoint(
        agreement,
        Number(milestoneIndex),
        Number(checkpointIndex)
      );

      setMessage(`Transaction submitted: ${tx.hash}`);

      await tx.wait();

      setMessage(
        'Checkpoint approval confirmed on the blockchain.'
      );

      await loadCheckpoint();
    } catch (err) {
      console.error(err);

      setError(
        err.shortMessage ||
        err.reason ||
        err.message ||
        'Transaction failed.'
      );
    } finally {
      setLoading(false);
    }
  }

  // ------------------------------------------------------------
  // AUTO REFRESH ACCOUNT WHEN METAMASK ACCOUNT CHANGES
  // ------------------------------------------------------------

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
      } else {
        setAccount('');
      }
    };

    window.ethereum.on(
      'accountsChanged',
      handleAccountsChanged
    );

    return () => {
      window.ethereum.removeListener(
        'accountsChanged',
        handleAccountsChanged
      );
    };
  }, []);

  // ------------------------------------------------------------
  // DISPLAY STATUS
  // ------------------------------------------------------------

  function getStatus() {
    if (!checkpoint) {
      return 'UNKNOWN';
    }

    if (checkpoint.completed) {
      return 'APPROVED';
    }

    if (checkpoint.requested) {
      return 'PENDING';
    }

    return 'NOT REQUESTED';
  }

  return (
    <div className="container py-5">

      <h1 className="mb-2">
        Checkpoint Test
      </h1>

      <p className="text-muted mb-4">
        Real blockchain test for milestone checkpoint
        request and approval.
      </p>

      {/* -------------------------------------------------- */}
      {/* WALLET */}
      {/* -------------------------------------------------- */}

      <div className="card mb-4">
        <div className="card-body">

          <h5>1. Wallet</h5>

          <button
            className="btn btn-primary"
            onClick={connectWallet}
          >
            Connect MetaMask
          </button>

          {account && (
            <div className="mt-3">
              <strong>Connected account:</strong>
              <br />
              <small>{account}</small>
            </div>
          )}

        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* AGREEMENT */}
      {/* -------------------------------------------------- */}

      <div className="card mb-4">
        <div className="card-body">

          <h5>2. Test Agreement</h5>

          <label className="form-label">
            Agreement Address
          </label>

          <input
            className="form-control mb-3"
            placeholder="0x..."
            value={agreement}
            onChange={(e) => setAgreement(e.target.value)}
          />

          <div className="row">

            <div className="col-md-6">
              <label className="form-label">
                Milestone Index
              </label>

              <input
                type="number"
                min="0"
                className="form-control"
                value={milestoneIndex}
                onChange={(e) =>
                  setMilestoneIndex(e.target.value)
                }
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">
                Checkpoint Index
              </label>

              <input
                type="number"
                min="0"
                className="form-control"
                value={checkpointIndex}
                onChange={(e) =>
                  setCheckpointIndex(e.target.value)
                }
              />
            </div>

          </div>

          <button
            className="btn btn-secondary mt-3"
            onClick={loadCheckpoint}
          >
            Load Checkpoint
          </button>

        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* CHECKPOINT */}
      {/* -------------------------------------------------- */}

      <div className="card mb-4">
        <div className="card-body">

          <h5>3. Checkpoint</h5>

          {checkpoint ? (
            <>
              <p>
                <strong>Description:</strong>{' '}
                {checkpoint.description}
              </p>

              <p>
                <strong>Status:</strong>{' '}

                <span
                  className={
                    getStatus() === 'APPROVED'
                      ? 'badge bg-success'
                      : getStatus() === 'PENDING'
                      ? 'badge bg-warning text-dark'
                      : 'badge bg-secondary'
                  }
                >
                  {getStatus()}
                </span>
              </p>

              <p>
                <strong>Requested:</strong>{' '}
                {checkpoint.requested ? 'Yes' : 'No'}
              </p>

              <p>
                <strong>Completed:</strong>{' '}
                {checkpoint.completed ? 'Yes' : 'No'}
              </p>
            </>
          ) : (
            <p className="text-muted">
              Load a checkpoint to see its blockchain state.
            </p>
          )}

        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* ACTIONS */}
      {/* -------------------------------------------------- */}

      <div className="card">
        <div className="card-body">

          <h5>4. Actions</h5>

          <div className="d-flex gap-2 flex-wrap">

            <button
              className="btn btn-warning"
              onClick={requestCheckpoint}
              disabled={loading}
            >
              {loading
                ? 'Processing...'
                : 'Request Checkpoint'}
            </button>

            <button
              className="btn btn-success"
              onClick={approveCheckpoint}
              disabled={loading}
            >
              {loading
                ? 'Processing...'
                : 'Approve Checkpoint'}
            </button>

          </div>

          <div className="mt-4">

            {message && (
              <div className="alert alert-info">
                {message}
              </div>
            )}

            {error && (
              <div className="alert alert-danger">
                {error}
              </div>
            )}

          </div>

        </div>
      </div>

    </div>
  );
}

export default CheckpointTest;