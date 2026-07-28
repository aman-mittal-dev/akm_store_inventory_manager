import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { Package, LayoutDashboard, ShoppingCart, ArrowDownToLine, ArrowUpFromLine, History, BarChart3, Settings, Users } from 'lucide-react';
import { InventoryProvider } from '../context/InventoryContext';
import { UserProfileMenu } from './UserProfileMenu';

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/inventory', label: 'Inventory', icon: Package },
    { path: '/incoming-stock', label: 'Purchase Stock', icon: ArrowDownToLine },
    { path: '/outgoing-stock', label: 'Record Sale', icon: ArrowUpFromLine },
    { path: '/transactions', label: 'Transaction History', icon: History },
    { path: '/parties', label: 'Parties', icon: Users },
    { path: '/analytics', label: 'Analytics & Reports', icon: BarChart3 },
    { path: '/settings', label: 'Store Settings', icon: Settings },
  ];

  return (
    <InventoryProvider>
      <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
        <header className="bg-white border-b border-gray-200 flex-shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <ShoppingCart className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-semibold text-gray-900 hidden sm:block">Store Inventory Manager</h1>
                <h1 className="text-lg font-semibold text-gray-900 sm:hidden">Inventory</h1>
              </button>

              <UserProfileMenu />
            </div>
          </div>
        </header>

        <nav className="bg-white border-b border-gray-200 flex-shrink-0 overflow-x-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-1 sm:space-x-4">
              {navItems.map(({ path, label, icon: Icon }) => {
                const isActive =
                  path === '/parties'
                    ? location.pathname.startsWith('/parties')
                    : location.pathname === path;
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`flex items-center gap-2 px-3 py-4 border-b-2 transition-colors whitespace-nowrap text-sm ${
                      isActive
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden text-xs">{label.split(' ')[0]}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </InventoryProvider>
  );
}
