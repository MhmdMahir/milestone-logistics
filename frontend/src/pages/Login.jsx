import { ethers } from 'ethers';
import { useNavigate } from 'react-router-dom';
import FixedFooter from '../components/FixedFooter';
import { getLogisticsClient } from '../contracts';

function Login() {
  const navigate = useNavigate();

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("No crypto wallet found. Please install MetaMask.");
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);

      await provider.send("eth_requestAccounts", []);

      const signer = await provider.getSigner();
      const accountAddress = await signer.getAddress();

      localStorage.setItem('account', accountAddress);

      const client = await getLogisticsClient();

      try {
        await client.login();

        // Wallet is registered on the blockchain
        navigate('/main');
      } catch (err) {
        if (err.message?.includes('not registered')) {
          // Wallet exists, but has not registered
          navigate('/register');
        } else {
          throw err;
        }
      }

    } catch (err) {
      console.error(err);

      alert(
        err.reason ||
        err.shortMessage ||
        err.message ||
        "Failed to connect wallet."
      );
    }
  };

  return (
    <div className="container d-flex align-items-center justify-content-center min-vh-100">
      <form
        className="w-100"
        style={{ maxWidth: '360px' }}
        onSubmit={(e) => e.preventDefault()}
      >
        <h1 className="h3 mb-3 fw-normal text-center">
          Please sign in
        </h1>

        <button
          className="btn btn-warning w-100 py-2"
          type="button"
          onClick={connectWallet}
        >
          Sign in via MetaMask
        </button>
      </form>

      <FixedFooter />
    </div>
  );
}

export default Login;