import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CreditCard, LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type UserProfileMenuProps = {
  /** Compact: avatar only (mobile-friendly). Default shows name/email on sm+. */
  compact?: boolean;
};

/**
 * Shared account menu for Layout and billing pages (pricing / account / checkout).
 * Ensures the user profile stays visible even when SubscriptionGuard blocks the app shell.
 */
export function UserProfileMenu({ compact = false }: UserProfileMenuProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-medium">
            {user.name?.charAt(0).toUpperCase() || 'U'}
          </span>
        </div>
        {!compact && (
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-20 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                navigate('/account');
                setOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <User className="w-4 h-4" />
              Account Settings
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                navigate('/pricing');
                setOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              Subscription
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                logout();
                setOpen(false);
                navigate('/login');
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
