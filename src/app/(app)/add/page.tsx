import type { Metadata } from "next";
import { AddPhotos } from "@/components/add-photos";
import { aiEnabled } from "@/lib/gemini";

export const metadata: Metadata = { title: "Add pieces" };

export default function AddPage() {
  return (
    <>
      <p className="text-[13px] font-medium text-muted">Add to your wardrobe</p>
      <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight">Snap it, we&rsquo;ll list it</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Hang it on a door or lay it flat, with a plain background and good light. A photo of a whole outfit works too:
        every piece gets its own listing.
      </p>
      {!aiEnabled() && (
        <p className="mt-4 rounded-xl bg-[#fdeccb] p-3 text-sm text-[#8a5300]">
          AI tagging is off, so photos are cut out but saved untagged for you to fill in. Add a{" "}
          <code>GEMINI_API_KEY</code> to have them named, categorised and described automatically.
        </p>
      )}
      <AddPhotos />
    </>
  );
}
