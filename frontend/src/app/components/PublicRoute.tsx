import { Navigate } from 'react-router';
import { useAuth, resolvePostAuthPath } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, hasActiveSubscription } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={resolvePostAuthPath(hasActiveSubscription)} replace />;
  }

  return <>{children}</>;
}
