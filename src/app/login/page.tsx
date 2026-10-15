import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { pill } from "@/components/ui";
import { Wordmark } from "@/components/wordmark";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 py-12">
      <Wordmark className="text-2xl" />
      <h1 className="mt-8 text-[32px] leading-tight font-semibold tracking-tight">
        Your wardrobe,
        <br />
        shopped like a store.
      </h1>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <span className={pill("blue")}>Photo to listing</span>
        <span className={pill("pink")}>Outfits</span>
        <span className={pill("green")}>What to add</span>
        <span className={pill("amber")}>What to buy</span>
      </div>
      <p className="mt-4 mb-10 text-muted">
        Photograph what you own. FITR lists every piece, puts outfits together and tells you what would finish them.
      </p>
      <AuthForm />
    </main>
  );
}
