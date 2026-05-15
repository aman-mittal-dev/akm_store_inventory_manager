import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';
import { AuthProvider } from './context/AuthContext';
import { GoogleAuthGate } from './components/GoogleAuthGate';

export default function App() {
  return (
    <GoogleAuthGate>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster />
      </AuthProvider>
    </GoogleAuthGate>
  );
}