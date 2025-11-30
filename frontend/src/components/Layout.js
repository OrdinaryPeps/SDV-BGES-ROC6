import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Ticket, TrendingUp, Users, LogOut, UserCog, Menu } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export default function Layout({ user, onLogout, children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => location.pathname === path;

  const NavLinks = () => (
    <nav className="space-y-1">
      <Link
        to="/dashboard"
        data-testid="nav-dashboard"
        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive('/dashboard')
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
          : 'text-slate-700 hover:bg-white hover:shadow-md'
          }`}
      >
        <Home className="w-5 h-5" />
        <span className="font-medium">Dashboard</span>
      </Link>

      <Link
        to="/tickets"
        data-testid="nav-tickets"
        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive('/tickets') || location.pathname.startsWith('/tickets/')
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
          : 'text-slate-700 hover:bg-white hover:shadow-md'
          }`}
      >
        <Ticket className="w-5 h-5" />
        <span className="font-medium">Tickets</span>
      </Link>

      {user.role === 'agent' && (
        <Link
          to="/performance"
          data-testid="nav-performance"
          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive('/performance')
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
            : 'text-slate-700 hover:bg-white hover:shadow-md'
            }`}
        >
          <TrendingUp className="w-5 h-5" />
          <span className="font-medium">My Performance</span>
        </Link>
      )}

      {user.role === 'admin' && (
        <Link
          to="/users"
          data-testid="nav-users"
          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive('/users')
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
            : 'text-slate-700 hover:bg-white hover:shadow-md'
            }`}
        >
          <Users className="w-5 h-5" />
          <span className="font-medium">User Management</span>
        </Link>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              {/* Mobile Menu */}
              <div className="md:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="mr-2">
                      <Menu className="w-6 h-6 text-slate-700" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-64 p-0">
                    <div className="p-6 border-b border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                          <Ticket className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-slate-900">BGES Bot</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <NavLinks />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center hidden md:flex">
                <Ticket className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 hidden md:block">Fulfillment Provisioning BGES Bot Dashboard</h1>
                <h1 className="text-lg font-bold text-slate-900 md:hidden">BGES Dashboard</h1>
                <p className="text-xs text-slate-500 hidden md:block">Ticket Management System</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2" data-testid="user-menu">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                      {user.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="text-left hidden md:block">
                      <p className="text-sm font-medium text-slate-900">{user.username}</p>
                      <p className="text-xs text-slate-500 capitalize">{user.role}</p>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => navigate('/account')}
                    data-testid="account-menu-item"
                  >
                    <UserCog className="mr-2 h-4 w-4" />
                    Account Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogout} data-testid="logout-menu-item">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar - Desktop */}
          <aside className="w-64 flex-shrink-0 hidden md:block">
            <NavLinks />
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
