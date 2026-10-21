import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { LocaleProvider } from "@/components/locale";
import { pill } from "@/components/ui";
import { Wordmark } from "@/components/wordmark";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/lib/locale";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const t = await getT();
  return (
    <LocaleProvider locale={t.locale}>
      <main className="flex min-h-dvh flex-col justify-center px-6 py-12">
        <Wordmark className="text-3xl" />
        <h1 className="mt-8 text-[32px] leading-tight font-extrabold tracking-tight whitespace-pre-line">{t("login.title")}</h1>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <span className={pill("blue")}>{t("login.pill1")}</span>
          <span className={pill("pink")}>{t("login.pill2")}</span>
          <span className={pill("green")}>{t("login.pill3")}</span>
          <span className={pill("amber")}>{t("login.pill4")}</span>
        </div>
        <p className="mt-4 mb-10 font-semibold text-muted">{t("login.body")}</p>
        <AuthForm />
      </main>
    </LocaleProvider>
  );
}
