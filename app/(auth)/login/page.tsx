import Image from "next/image";
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
    <Card className="w-full">
      <CardHeader className="flex flex-col items-center text-center">
        <Image
          src="/assets/logo.png"
          alt="ShiftSync"
          width={140}
          height={40}
          className="mb-4 h-10 w-auto object-contain"
          priority
        />
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
