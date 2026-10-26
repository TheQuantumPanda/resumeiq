import { BRAND } from "~/lib/brand";
import { Link, NavLink } from "react-router";
import { usePuterStore } from "~/lib/puter";

const Navbar = () => {
  const { auth } = usePuterStore();
  return (
    <nav className="navbar" aria-label="Main navigation">
      <Link to="/" className="brand" aria-label={`${BRAND.name} home`}>
        <span className="brand-mark" aria-hidden="true">
          RI
        </span>
        <div>
          <p className="wordmark">{BRAND.name}</p>
          <p className="brand-note">A considered next step</p>
        </div>
      </Link>
      <div className="nav-actions">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `nav-link nav-dashboard ${isActive ? "nav-link-active" : ""}`
          }
        >
          Dashboard
        </NavLink>
        {auth.isAuthenticated && auth.user?.username && (
          <span className="nav-user" title={auth.user.username}>
            {auth.user.username}
          </span>
        )}
        <Link to="/upload" className="primary-button">
          New review <span aria-hidden="true">↗</span>
        </Link>
        {!auth.isAuthenticated && (
          <Link className="nav-link" to="/auth?next=/upload">
            Sign in
          </Link>
        )}
        {auth.isAuthenticated && (
          <button
            type="button"
            onClick={auth.signOut}
            className="nav-link"
            title="Log out"
          >
            Log out
          </button>
        )}
      </div>
    </nav>
  );
};
export default Navbar;
