import { ethers } from 'ethers';
import { useNavigate } from 'react-router-dom';
import FixedFooter from '../components/FixedFooter';

function Login() {
  const navigate = useNavigate();

  const connectWallet = async () => {
    if (!window.ethereum) {
      console.error("No crypto wallet found. Please install it.");
      alert("No crypto wallet found. Please install it.");
      return;
    }
    // Reference 
    // https://ethereum.stackexchange.com/questions/103229/how-to-connect-ethers-js-with-metamask-and-other-wallets
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const accountAddress = await signer.getAddress();
    console.log(accountAddress);
    localStorage.setItem('account', accountAddress);
    navigate('/main');
  };

  return (
    <div className="container d-flex align-items-center justify-content-center min-vh-100">
      <form className="w-100" style={{ maxWidth: '360px' }}>
        <h1 className="h3 mb-3 fw-normal text-center">Please sign in</h1>

        <button className="btn btn-warning w-100 py-2" type="button" onClick={connectWallet}>
          Sign in via MetaMask
        </button>
      </form>
      <FixedFooter />
    </div>
  );
}

export default Login;
