import { useNavigate, NavLink } from 'react-router-dom';

function Header() {
    const navigate = useNavigate();

    const logOut = () => {
        localStorage.clear();
        navigate('/')
    }

    return (
        <header className="mb-4">
            <nav className="navbar navbar-expand navbar-dark bg-dark rounded px-3 mt-3">
                <span className="navbar-brand">Escrow Platform</span>
                
                <div className="navbar-collapse">
                    <div className="navbar-nav me-auto">
                        <NavLink to="/main" end className="nav-link">Agreements</NavLink>
                        <NavLink to="/create" className="nav-link">Create</NavLink>
                    </div>
                    <div className="navbar-nav">
                        <button className="btn btn-outline-light btn-sm" onClick={logOut}>Logout</button>
                    </div>
                </div>
            </nav>
        </header>
    )
}

export default Header