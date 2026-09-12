import { useNavigate, NavLink } from 'react-router-dom';

function Header() {
    const navigate = useNavigate();

    const account = localStorage.getItem('account');
    const profileRaw = account && localStorage.getItem(`profile:${account}`);
    const isShipper = profileRaw && JSON.parse(profileRaw).role === 'Shipper';

    const logOut = () => {
        localStorage.removeItem('account');
        navigate('/');
    };

    return (
        <header className="mb-4">
            <nav className="navbar navbar-expand-lg bg-primary fixed-top px-3 shadow-sm" data-bs-theme="light">
                <div className="container-fluid">
                    <span className="navbar-brand fw-bold">Escrow Platform</span>
                    <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarColor01" aria-controls="navbarColor01" aria-expanded="false" aria-label="Toggle navigation">
                        <span className="navbar-toggler-icon"></span>
                    </button>
                    <div className="collapse navbar-collapse" id="navbarColor01">
                        <ul className="navbar-nav me-auto">
                            <li className="nav-item">
                                <NavLink to="/main" end className="nav-link">
                                    Agreements
                                </NavLink>
                            </li>
                            <li className="nav-item">
                                <NavLink to="/transactions" className="nav-link">
                                    Transactions
                                </NavLink>
                            </li>
                        </ul>
                        <div className="btn-group" role="group" aria-label="Button group with nested dropdown">
                            {isShipper && (
                                <NavLink to="/create" className="btn btn-primary d-inline-flex align-items-center">
                                    Create Agreement
                                </NavLink>
                            )}
                            <div className="btn-group" role="group">
                                <button id="btnGroupDrop1" type="button" className="btn btn-primary dropdown-toggle" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false"></button>
                                <div className="dropdown-menu dropdown-menu-end" aria-labelledby="btnGroupDrop1">
                                    <button type="button" className="dropdown-item" onClick={logOut}>Log Out</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
        </header>
    );
}

export default Header;
