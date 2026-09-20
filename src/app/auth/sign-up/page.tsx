import { SignUpForm } from "@/components/SignUpForm";

export const metadata = { title: "Sign up · Assignment Reminders" };

export default function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Friends can create their own account. Each person only sees their assignments.
        </p>
      </div>
      <SignUpForm />
    </main>
  );
}
