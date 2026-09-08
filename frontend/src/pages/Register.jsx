import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FixedFooter from '../components/FixedFooter';
import { getLogisticsClient } from '../contracts';

const ROLES = ['Shipper', 'Carrier'];

function Register() {
  const navigate = useNavigate();
  const account = localStorage.getItem('account');

  const [name, setName] = useState('');
  const [mail, setMail] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const goBack = () => {
    localStorage.removeItem('account');
    navigate('/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError('');

    if (!name || !mail || !role) {
      setError('Please fill in your name, email, and role.');
      return;
    }

    try {
      setLoading(true);

      const client = await getLogisticsClient();

      // Sends the registration transaction to the blockchain.
      // MetaMask will ask the user to confirm the transaction.
      await client.register(mail, name, role);

      // Registration succeeded and transaction was mined.
      navigate('/main');

    } catch (err) {
      console.error(err);

      setError(
        err.reason ||
        err.shortMessage ||
        err.message ||
        'Registration failed.'
      );

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container d-flex align-items-center justify-content-center min-vh-100">
      <form
        className="w-100"
        style={{ maxWidth: '400px' }}
        onSubmit={handleSubmit}
      >
        <button
          type="button"
          className="btn btn-link ps-0 mb-2 text-decoration-none"
          onClick={goBack}
          disabled={loading}
        >
          &larr; Back
        </button>

        <h1 className="h3 mb-1 fw-normal text-center">
          Complete your registration
        </h1>

        <p className="text-muted text-center small mb-4">
          {account}
        </p>

        <div className="mb-3">
          <label className="form-label fw-semibold">
            Name
          </label>

          <input
            type="text"
            className="form-control"
            placeholder="e.g. Jane Tan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div className="mb-3">
          <label className="form-label fw-semibold">
            Email
          </label>

          <input
            type="email"
            className="form-control"
            placeholder="e.g. jane@example.com"
            value={mail}
            onChange={(e) => setMail(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div className="mb-4">
          <label className="form-label fw-semibold d-block">
            Role
          </label>

          <div
            className="d-flex gap-2"
            role="group"
            aria-label="Role"
          >
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                className={`btn flex-fill ${
                  role === r ? 'btn-dark' : 'btn-light'
                }`}
                onClick={() => setRole(r)}
                disabled={loading}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="alert alert-danger small p-2">
            {error}
          </div>
        )}

        <button
          className="btn btn-warning w-100 py-2 fw-bold"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>

      <FixedFooter />
    </div>
  );
}

export default Register;