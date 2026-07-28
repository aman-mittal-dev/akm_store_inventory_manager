import { Link } from 'react-router';
import { ShoppingCart } from 'lucide-react';
import { UserProfileMenu } from './UserProfileMenu';

type AuthAppHeaderProps = {
  /** Optional left-side control (e.g. Back to Dashboard). */
  leftSlot?: React.ReactNode;
};

/**
 * Top bar for authenticated pages outside the main Layout
 * (pricing, account, checkout) so the user profile remains visible.
 */
export function AuthAppHeader({ leftSlot }: AuthAppHeaderProps) {
  return (
    <header className="bg-white/90 backdrop-blur border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {leftSlot}
            <Link to="/pricing" className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <span className="text-base font-semibold text-gray-900 truncate hidden sm:inline">
                Store Inventory Manager
              </span>
            </Link>
          </div>
          <UserProfileMenu />
        </div>
      </div>
    </header>
  );
}
