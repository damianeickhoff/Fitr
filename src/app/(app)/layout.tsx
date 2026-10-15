import Link from "next/link";
import { Nav } from "@/components/nav";
import { Wordmark } from "@/components/wordmark";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { imageUrl } from "@/lib/storage-url";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const avatar = await db.selfPhoto.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper/95 px-4 backdrop-blur-md">
        <Link href="/" aria-label="FITR wardrobe">
          <Wordmark />
        </Link>
        <Link href="/me" aria-label="Your profile" className="block size-[34px] overflow-hidden rounded-full bg-ground">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- private self photo
            <img src={imageUrl(avatar.path)} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            <span className="grid h-full w-full place-items-center text-sm font-semibold text-muted">{user.name.slice(0, 1)}</span>
          )}
        </Link>
      </header>
      <main className="px-4 pt-5 pb-32">{children}</main>
      <Nav />
    </>
  );
}
