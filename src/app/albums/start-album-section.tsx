import { NewAlbumForm } from "./new-album-form";

/**
 * The onboarding moment — implemented from the Claude Design "Start Your
 * Album Page" (Unbound Albums Marketing Site project). Form on the left;
 * on the right, the answers a couple needs before handing over their day:
 * why we ask, what happens next, how it's stored.
 */

const STEPS = [
  {
    number: "01",
    body: "Add around 150 favorites — the photos you keep coming back to.",
  },
  {
    number: "02",
    body: "Your album is designed for you. A full proof, page by page, within one to three days.",
  },
  {
    number: "03",
    body: "Review it, choose your cover, foil, and size, and request changes until it's right.",
  },
];

export function StartAlbumSection({ heading }: { heading: string }) {
  return (
    <div className="flex flex-wrap items-start gap-x-[clamp(64px,8vw,120px)] gap-y-20">
      <section
        aria-label="Album details"
        className="enter max-w-[480px] flex-[1_1_400px]"
      >
        <div className="mb-8 h-[1.5px] w-20 bg-white" />
        <h1 className="font-display text-[clamp(42px,4.5vw,56px)] leading-[1.05] tracking-[-0.5px] text-parchment">
          {heading}
        </h1>
        <p className="mb-14 mt-5 text-base leading-[1.7] text-pewter">
          Three details. Then your photos. We do the rest.
        </p>
        <NewAlbumForm />
      </section>

      <aside
        aria-label="About this step"
        className="max-w-[500px] flex-[1_1_400px] pt-2.5"
      >
        <div className="enter enter-2">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-[3px] text-white">
            Why we ask
          </h2>
          <p className="text-[15px] leading-[1.75] text-pewter [text-wrap:pretty]">
            Your names become the foil on the cover. The date and the place
            tell your designer the story — a June garden reads differently
            than a December loft.
          </p>
        </div>

        <div className="enter enter-3 mt-10 border-t border-stone pt-10">
          <h2 className="mb-5 text-xs font-medium uppercase tracking-[3px] text-white">
            What happens next
          </h2>
          <ol className="flex flex-col gap-5">
            {STEPS.map((step) => (
              <li key={step.number} className="flex items-baseline gap-5">
                <span
                  className="min-w-[30px] font-display text-[22px] text-parchment"
                  style={{ fontWeight: 500 }}
                >
                  {step.number}
                </span>
                <span className="text-[15px] leading-[1.7] text-pewter [text-wrap:pretty]">
                  {step.body}
                </span>
              </li>
            ))}
          </ol>
          <p
            className="mt-7 font-display text-lg italic leading-[1.6] text-pewter [text-wrap:pretty]"
            style={{ fontWeight: 400 }}
          >
            The design is free. Pay only to print — or take the print-ready
            files anywhere for $99.
          </p>
        </div>

        <div className="enter enter-4 mt-10 border-t border-stone pt-10">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-[3px] text-white">
            Private by default
          </h2>
          <p className="text-[15px] leading-[1.75] text-pewter [text-wrap:pretty]">
            Your photos are seen by you and your designer. No one else.
            Nothing is public unless you share it, and we delete everything
            the moment you ask.
          </p>
        </div>
      </aside>
    </div>
  );
}
