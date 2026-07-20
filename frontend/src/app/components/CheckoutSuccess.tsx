import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { verifyStripeCheckoutSession } from "../services/paymentService";
import { humanizeApiError } from "../utils/apiErrors";
import { Card } from "./ui/card";
import { Loader2, CheckCircle } from "lucide-react";

export function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const refreshRef = useRef(refreshUser);
  refreshRef.current = refreshUser;

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      navigate("/pricing", { replace: true });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await verifyStripeCheckoutSession(sessionId);
        await refreshRef.current();
        if (!cancelled) {
          toast.success("Your subscription is active.");
          navigate("/", { replace: true });
        }
      } catch (e) {
        if (cancelled) return;
        const msg = humanizeApiError(e, "Could not confirm your payment.");
        setError(msg);
        toast.error(msg);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <Card className="max-w-md w-full p-8 text-center">
          <p className="text-gray-800 mb-4">{error}</p>
          <button
            type="button"
            className="text-blue-600 underline"
            onClick={() => navigate("/account")}
          >
            Go to account
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-green-50 to-white">
      <Card className="max-w-md w-full p-8 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
        <div className="flex items-center justify-center gap-2 text-gray-700">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span>Confirming your subscription…</span>
        </div>
      </Card>
    </div>
  );
}
