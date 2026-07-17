"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  CAMEO_OPTIONS,
  COVER_MATERIALS,
  type CoverMaterial,
  DESIGN_MOODS,
  FONT_STYLES,
} from "@/lib/albums/brief";
import {
  ALBUM_SIZES,
  ALBUM_SIZE_SPECS,
  type AlbumSize,
  BASE_SPREAD_COUNT,
  formatPrice,
} from "@/lib/albums/sizes";

import { submitBrief, type ActionState } from "./actions";

const IDLE: ActionState = { status: "idle" };

function OptionCard({
  name,
  value,
  label,
  description,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer flex-col gap-1 rounded-md border p-4 transition-colors ${
        checked ? "border-parchment bg-charcoal" : "border-stone hover:border-pewter"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span className="text-sm text-parchment">{label}</span>
      <span className="text-xs leading-relaxed text-slate">{description}</span>
    </label>
  );
}

function Fieldset({
  legend,
  children,
}: {
  legend: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-xs uppercase tracking-[0.3em] text-slate">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-md bg-parchment px-8 py-3.5 text-sm text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Sending." : "Send it to your designer"}
    </button>
  );
}

export function BriefForm({
  albumId,
  initialSize,
}: {
  albumId: string;
  initialSize: AlbumSize;
}) {
  const [state, formAction] = useActionState(
    submitBrief.bind(null, albumId),
    IDLE,
  );

  const [size, setSize] = useState<AlbumSize>(initialSize);
  const [material, setMaterial] = useState<CoverMaterial>("linen");
  const [color, setColor] = useState<string>(COVER_MATERIALS[0].colors[0]);
  const [cameo, setCameo] = useState<string>("none");
  const [font, setFont] = useState<string>("serif");
  const [mood, setMood] = useState<string>("classic");

  const activeMaterial = COVER_MATERIALS.find((m) => m.value === material)!;

  return (
    <form action={formAction} className="flex flex-col gap-12">
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-3xl text-parchment">
          Tell us the look.
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-pewter">
          Six choices and a note. Your designer takes it from here.
        </p>
      </div>

      <Fieldset legend="The size">
        <div className="grid grid-cols-3 gap-3">
          {ALBUM_SIZES.map((option) => {
            const spec = ALBUM_SIZE_SPECS[option];
            const selected = size === option;
            return (
              <label
                key={option}
                className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-md border px-3 py-5 transition-colors ${
                  selected
                    ? "border-parchment bg-charcoal"
                    : "border-stone hover:border-pewter"
                }`}
              >
                <input
                  type="radio"
                  name="size"
                  value={option}
                  checked={selected}
                  onChange={() => setSize(option)}
                  className="sr-only"
                />
                <span
                  className={`font-display text-2xl ${selected ? "text-parchment" : "text-pewter"}`}
                >
                  {spec.label}
                </span>
                <span className="text-xs text-slate">
                  {formatPrice(spec.priceCents)}
                </span>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-slate">
          {BASE_SPREAD_COUNT} spreads — {BASE_SPREAD_COUNT * 2} lay-flat pages,
          hardcover. The design is free; you pay only when you order.
        </p>
      </Fieldset>

      <Fieldset legend="Cover material">
        <div className="grid gap-3 sm:grid-cols-2">
          {COVER_MATERIALS.map((option) => (
            <OptionCard
              key={option.value}
              name="cover_material"
              value={option.value}
              label={option.label}
              description={option.description}
              checked={material === option.value}
              onChange={() => {
                setMaterial(option.value);
                setColor(option.colors[0]);
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {activeMaterial.colors.map((c) => (
            <label
              key={c}
              className={`cursor-pointer rounded-md border px-4 py-2 text-xs transition-colors ${
                color === c
                  ? "border-parchment bg-charcoal text-parchment"
                  : "border-stone text-pewter hover:border-pewter"
              }`}
            >
              <input
                type="radio"
                name="cover_color"
                value={c}
                checked={color === c}
                onChange={() => setColor(c)}
                className="sr-only"
              />
              {c}
            </label>
          ))}
        </div>
      </Fieldset>

      <Fieldset legend="Cameo">
        <div className="grid gap-3 sm:grid-cols-2">
          {CAMEO_OPTIONS.map((option) => (
            <OptionCard
              key={option.value}
              name="cameo"
              value={option.value}
              label={option.label}
              description={option.description}
              checked={cameo === option.value}
              onChange={() => setCameo(option.value)}
            />
          ))}
        </div>
      </Fieldset>

      <Fieldset legend="Foil font">
        <div className="grid gap-3 sm:grid-cols-3">
          {FONT_STYLES.map((option) => (
            <OptionCard
              key={option.value}
              name="font_style"
              value={option.value}
              label={option.label}
              description={option.description}
              checked={font === option.value}
              onChange={() => setFont(option.value)}
            />
          ))}
        </div>
      </Fieldset>

      <Fieldset legend="The feel of the design">
        <div className="grid gap-3 sm:grid-cols-3">
          {DESIGN_MOODS.map((option) => (
            <OptionCard
              key={option.value}
              name="mood"
              value={option.value}
              label={option.label}
              description={option.description}
              checked={mood === option.value}
              onChange={() => setMood(option.value)}
            />
          ))}
        </div>
      </Fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="title_text" className="text-xs uppercase tracking-[0.3em] text-slate">
          The cover should say
        </label>
        <input
          id="title_text"
          name="title_text"
          type="text"
          required
          maxLength={120}
          placeholder="Alex & Laura — June 14, 2025"
          className="w-full rounded-md border border-stone bg-charcoal px-4 py-3.5 text-base text-parchment placeholder:text-slate focus:border-pewter focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="notes" className="text-xs uppercase tracking-[0.3em] text-slate">
          Anything your designer should know
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          maxLength={2000}
          placeholder="People who matter, moments we love, photos that must make it in."
          className="w-full rounded-md border border-stone bg-charcoal px-4 py-3.5 text-base text-parchment placeholder:text-slate focus:border-pewter focus:outline-none"
        />
      </div>

      <SubmitButton />

      {state.status === "error" ? (
        <p role="alert" className="text-sm text-pewter">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
