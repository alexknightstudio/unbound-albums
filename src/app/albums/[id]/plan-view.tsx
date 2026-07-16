/* eslint-disable @next/next/no-img-element */
import { TEMPLATES_BY_CODE } from "@/lib/engine/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type SpreadRow = {
  id: string;
  position: number;
  template_code: string;
  slots: Record<string, string>;
};

type PhotoRow = {
  id: string;
  thumb_path: string | null;
  set_aside_reason: string | null;
};

/**
 * The raw spread plan, reviewable. This is the Phase 2 milestone surface —
 * Alex reads the plan with a professional eye and prompt corrections become
 * new prompt versions. Phase 3 replaces this with the real spread renderer.
 */
export async function PlanView({ albumId }: { albumId: string }) {
  const supabase = await createClient();

  const { data: spreads } = await supabase
    .from("spreads")
    .select("id, position, template_code, slots")
    .eq("album_id", albumId)
    .order("position", { ascending: true })
    .returns<SpreadRow[]>();

  const { data: photos } = await supabase
    .from("photos")
    .select("id, thumb_path, set_aside_reason")
    .eq("album_id", albumId)
    .returns<PhotoRow[]>();

  if (!spreads || spreads.length === 0 || !photos) return null;

  // Signed URLs for the private thumbs bucket, one batch call.
  const admin = createAdminClient();
  const thumbPaths = photos
    .map((p) => p.thumb_path)
    .filter((p): p is string => p !== null);
  const { data: signed } = await admin.storage
    .from("thumbs")
    .createSignedUrls(thumbPaths, 60 * 60);

  const urlByPath = new Map(
    (signed ?? [])
      .filter((s) => s.signedUrl)
      .map((s) => [s.path as string, s.signedUrl]),
  );
  const urlByPhotoId = new Map(
    photos
      .filter((p) => p.thumb_path && urlByPath.has(p.thumb_path))
      .map((p) => [p.id, urlByPath.get(p.thumb_path as string) as string]),
  );

  const setAside = photos.filter((p) => p.set_aside_reason !== null);

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-3xl text-parchment">Your album.</h2>
        <p className="text-sm text-pewter">
          {spreads.length} spreads. The full editor arrives soon — this is the
          designer&apos;s plan.
        </p>
      </header>

      <ol className="flex flex-col gap-6">
        {spreads.map((spread) => {
          const template = TEMPLATES_BY_CODE.get(spread.template_code);
          const slotIds = template
            ? template.slots.map((s) => s.id)
            : Object.keys(spread.slots);
          return (
            <li
              key={spread.id}
              className="flex flex-col gap-3 rounded-md border border-stone bg-charcoal p-4"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-parchment">
                  Spread {spread.position}
                </span>
                <span className="text-xs text-slate">
                  {spread.template_code}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {slotIds.map((slotId) => {
                  const photoId = spread.slots[slotId];
                  const url = photoId ? urlByPhotoId.get(photoId) : undefined;
                  return (
                    <figure key={slotId} className="flex flex-col gap-1">
                      {url ? (
                        <img
                          src={url}
                          alt=""
                          className="h-24 w-24 rounded-sm object-cover"
                        />
                      ) : (
                        <div className="h-24 w-24 rounded-sm bg-stone" />
                      )}
                      <figcaption className="text-[11px] text-slate">
                        {slotId}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>

      {setAside.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-md border border-stone p-4">
          <h3 className="text-sm text-parchment">We set these aside.</h3>
          <ul className="flex flex-col gap-3">
            {setAside.map((photo) => (
              <li key={photo.id} className="flex items-center gap-3">
                {urlByPhotoId.get(photo.id) ? (
                  <img
                    src={urlByPhotoId.get(photo.id)}
                    alt=""
                    className="h-14 w-14 rounded-sm object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-sm bg-stone" />
                )}
                <span className="text-xs text-pewter">
                  {photo.set_aside_reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
