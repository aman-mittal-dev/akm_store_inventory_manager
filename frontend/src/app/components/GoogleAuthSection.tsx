import { GoogleLogin } from "@react-oauth/google";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || "";

type Props = {
  variant: "login" | "signup";
  onCredential: (jwt: string) => void;
  onError: () => void;
};

export function GoogleAuthSection({ variant, onCredential, onError }: Props) {
  const divider = variant === "login" ? "Or continue with" : "Or sign up with";

  return (
    <div className="mt-6 space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs font-medium uppercase tracking-wide">
          <span className="bg-white px-3 text-gray-500">{divider}</span>
        </div>
      </div>

      {googleClientId ? (
        <div className="flex justify-center [&>div]:w-full">
          <GoogleLogin
            theme="outline"
            size="large"
            width="384"
            text={variant === "login" ? "continue_with" : "signup_with"}
            onSuccess={(res) => {
              if (res.credential) onCredential(res.credential);
            }}
            onError={onError}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-950 leading-relaxed">
          <p className="font-semibold text-amber-950 mb-1">Google sign-in is not configured yet</p>
          <p className="text-amber-900">
            Create a <code className="rounded bg-white/80 px-1 py-0.5 font-mono text-[11px]">.env</code> file in the project root (copy from{" "}
            <code className="font-mono text-[11px]">.env.example</code>) and set{" "}
            <code className="rounded bg-white/80 px-1 py-0.5 font-mono text-[11px]">VITE_GOOGLE_CLIENT_ID</code> to your Google OAuth{" "}
            <strong>Web client ID</strong> (same value as backend{" "}
            <code className="font-mono text-[11px]">GOOGLE_CLIENT_ID</code>). Then <strong>restart</strong>{" "}
            <code className="font-mono text-[11px]">npm run dev</code> so Vite picks up the variable.
          </p>
        </div>
      )}
    </div>
  );
}
