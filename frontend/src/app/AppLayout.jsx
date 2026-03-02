import { NavLink, Outlet } from 'react-router-dom'

export function AppLayout() {
  return (
    <div className="container">
      <header className="appHeader">
        <div className="brand">
          <div className="brandTitle">My Food Tracker</div>
          <div className="brandSub">
            Personal dashboard for tracking ingredients, spending, and profit.
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/transactions">Transactions</NavLink>
        </nav>
      </header>

      <main style={{ marginTop: 14 }}>
        <Outlet />
      </main>
    </div>
  )
}

