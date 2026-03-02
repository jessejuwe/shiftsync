import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your ShiftSync account",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/";
  const error = params.error;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in to ShiftSync</CardTitle>
        <CardDescription>
          Enter your email and password to access your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm callbackUrl={callbackUrl} error={error} />
      </CardContent>
    </Card>
  );
}
