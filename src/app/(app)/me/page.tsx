import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import { SelfPhotos } from "@/components/self-photos";
import { StyleNotes } from "@/components/style-notes";
import { button, pill } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";
import { db } from "@/lib/db";
import { aiEnabled } from "@/lib/gemini";
import { imageModelLabel } from "@/lib/image-gen";

export const metadata: Metadata = { title: "Me" };

export default async function MePage() {
  const user = await requireUser();
  const photos = await db.selfPhoto.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });

  const status = [
    {
      name: "Photo tagging, outfits and advice",
      on: aiEnabled(),
      detail: aiEnabled() ? process.env.GEMINI_MODEL || "gemini-3.8-flash" : "Add GEMINI_API_KEY",
    },
    {
      name: "Studio photos and try-on",
      on: imageModelLabel() !== null,
      detail: imageModelLabel() ?? "Add OPENAI_API_KEY (paid)",
    },
    { name: "Cutting out photos", on: true, detail: "Runs on your server, free" },
  ];

  return (
    <>
      <p className="text-[13px] font-medium text-muted">{user.email}</p>
      <h1 className="mt-1 text-[28px] font-semibold tracking-tight">{user.name}</h1>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Photos of you</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          For trying outfits on. Full length, facing the camera, in good light. Only you can see them.
        </p>
        <SelfPhotos photos={photos.map((p) => ({ id: p.id, path: p.path }))} />
      </section>

      <section className="mt-7">
        <h2 className="text-lg font-semibold">Your style</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Tell the stylist what you like and what you avoid. It reads this before every outfit and shop tip.
        </p>
        <StyleNotes initial={user.styleNotes ?? ""} />
      </section>

      <section className="mt-7">
        <h2 className="text-lg font-semibold">AI</h2>
        <ul className="mt-2.5 rounded-2xl bg-ground px-4 py-1">
          {status.map((s) => (
            <li key={s.name} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
              <span className="min-w-0">
                <span className="block text-sm font-medium">{s.name}</span>
                <span className="block truncate text-xs text-muted">{s.detail}</span>
              </span>
              <span className={pill(s.on ? "green" : "amber")}>{s.on ? "On" : "Off"}</span>
            </li>
          ))}
        </ul>
      </section>

      <form action={signOut} className="mt-7">
        <button type="submit" className={button.secondary}>
          <LogOut size={16} /> Sign out
        </button>
      </form>
    </>
  );
}
