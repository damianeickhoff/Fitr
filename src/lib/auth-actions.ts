"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession, rememberProfile } from "./auth";
import { db } from "./db";
import { getT } from "./locale";

export type AuthState = { error?: string } | undefined;

const signUpSchema = z.object({
  name: z.string().trim().min(1, "err.name").max(60, "err.name"),
  email: z.email("err.email").trim().toLowerCase(),
  password: z.string().min(8, "err.password"),
});

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const t = await getT();
  const parsed = signUpSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: t(parsed.error.issues[0].message as "err.name") };
  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: t("err.taken") };

  // The account's first profile is the person signing up; the household adds the rest from Me.
  const user = await db.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 10), profiles: { create: { name, locale: t.locale } } },
    include: { profiles: true },
  });
  await createSession(user.id, user.tokenVersion);
  await rememberProfile(user.profiles[0].id);
  redirect("/");
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: (await getT())("err.noMatch") };
  }
  await createSession(user.id, user.tokenVersion);
  redirect("/");
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}
