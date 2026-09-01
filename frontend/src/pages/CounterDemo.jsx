import { useState } from 'react';
import { ethers } from 'ethers';
import { getContract } from '../contracts';

const CHAIN_ID = 1337; // Ganache

function CounterDemo() {
  const [value, setValue] = useState(null);
  const [status, setStatus] = useState('');

  const connectContract = async () => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send('eth_requestAccounts', []);
    const signer = await provider.getSigner();
    return getContract('Counter', CHAIN_ID, signer);
  };

  const readValue = async () => {
    setStatus('reading...');
    const contract = await connectContract();
    const x = await contract.x();
    setValue(x.toString());
    setStatus('');
  };

  const incrementBy5 = async () => {
    setStatus('waiting for confirmation in MetaMask...');
    const contract = await connectContract();
    const tx = await contract.incBy(5);
    setStatus('mining...');
    await tx.wait();
    setStatus('done');
    await readValue();
  };

  return (
    <div className="container py-5" style={{ maxWidth: '480px' }}>
      <h1 className="h4 mb-3">Counter demo</h1>
      <p className="fs-3">{value ?? '—'}</p>
      <div className="d-flex gap-2">
        <button className="btn btn-outline-secondary" onClick={readValue}>Read value</button>
        <button className="btn btn-warning" onClick={incrementBy5}>Increment by 5</button>
      </div>
      {status && <p className="text-muted small mt-3">{status}</p>}
    </div>
  );
}

export default CounterDemo;
