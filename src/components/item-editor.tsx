"use client";

import { useActionState } from "react";
import { CATEGORY_KEYS, SEASONS } from "@/lib/garment";
import { categoryLabel, formalityLabel, type MessageKey } from "@/lib/i18n";
import { updateItem, type EditState } from "@/lib/item-actions";
import type { DetailKey, DetailValues } from "@/lib/suggest";
import { useT } from "./locale";
import { SubmitButton } from "./submit-button";
import { cx, field, label, pill } from "./ui";

/**
 * The form starts from `values` and is uncontrolled from there; the parent
 * remounts it (by key) when a re-check brings new values. `changed` marks
 * the fields that re-check moved.
 */
export function ItemEditor({
  id,
  values,
  changed = [],
  onSaved,
}: {
  id: string;
  values: DetailValues;
  changed?: DetailKey[];
  onSaved?: () => void;
}) {
  const t = useT();
  const [state, action] = useActionState(async (prev: EditState, form: FormData) => {
    const result = await updateItem(id, prev, form);
    if (result?.saved) onSaved?.();
    return result;
  }, undefined);
  const moved = new Set(changed);

  const head = (key: DetailKey, text: string, htmlFor?: string) => (
    <span className={cx(label, "flex items-center gap-1.5")}>
      {htmlFor ? <label htmlFor={htmlFor}>{text}</label> : text}
      {moved.has(key) && (
        <span className={pill("violet")} title={t("recheck.markLabel")}>
          {t("recheck.mark")}
        </span>
      )}
    </span>
  );
  const ring = (key: DetailKey) => cx(field, moved.has(key) && "ring-2 ring-accent!");

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="colorHex" defaultValue={values.colorHex} />
      <div className="sm:col-span-2">
        {head("name", t("edit.name"), "name")}
        <input id="name" name="name" defaultValue={values.name} required className={ring("name")} />
      </div>
      <div>
        {head("category", t("edit.category"), "category")}
        <select id="category" name="category" defaultValue={values.category} className={ring("category")}>
          {CATEGORY_KEYS.map((key) => (
            <option key={key} value={key}>{categoryLabel(t, key)}</option>
          ))}
        </select>
      </div>
      <div>
        {head("subcategory", t("edit.type"), "subcategory")}
        <input id="subcategory" name="subcategory" defaultValue={values.subcategory} placeholder={t("edit.typeHint")} className={ring("subcategory")} />
      </div>
      <div>
        {head("colors", t("edit.colours"), "colors")}
        <input id="colors" name="colors" defaultValue={values.colors} placeholder={t("edit.coloursHint")} className={ring("colors")} />
      </div>
      <div>
        {head("brand", t("edit.brand"), "brand")}
        <input id="brand" name="brand" defaultValue={values.brand} className={ring("brand")} />
      </div>
      <div>
        {head("material", t("edit.material"), "material")}
        <input id="material" name="material" defaultValue={values.material} className={ring("material")} />
      </div>
      <div>
        {head("pattern", t("edit.pattern"), "pattern")}
        <input id="pattern" name="pattern" defaultValue={values.pattern} placeholder={t("edit.patternHint")} className={ring("pattern")} />
      </div>
      <div>
        {head("styles", t("edit.styles"), "styles")}
        <input id="styles" name="styles" defaultValue={values.styles} placeholder={t("edit.stylesHint")} className={ring("styles")} />
      </div>
      <div>
        {head("formality", t("edit.dressCode"), "formality")}
        <select id="formality" name="formality" defaultValue={values.formality} className={ring("formality")}>
          {[1, 2, 3, 4, 5].map((level) => (
            <option key={level} value={level}>{formalityLabel(t, level)}</option>
          ))}
        </select>
      </div>
      <fieldset className="sm:col-span-2">
        <legend>{head("seasons", t("edit.seasons"))}</legend>
        <div className="flex flex-wrap gap-2">
          {SEASONS.map((season) => (
            <label key={season} className="flex cursor-pointer items-center gap-2 rounded-full bg-ground px-3.5 py-2 text-[13px] font-bold text-muted capitalize ring-1 ring-line ring-inset has-checked:bg-ink has-checked:text-paper has-checked:ring-ink">
              <input type="checkbox" name="seasons" value={season} defaultChecked={values.seasons.includes(season)} className="sr-only" />
              {t(`season.${season}` as MessageKey)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        {head("description", t("edit.description"), "description")}
        <textarea id="description" name="description" rows={3} defaultValue={values.description} className={ring("description")} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pending={t("common.saving")}>{t("edit.save")}</SubmitButton>
        {state?.saved && <p className="text-sm font-semibold text-muted" role="status">{t("common.saved")}</p>}
        {state?.error && <p className="text-sm font-semibold text-danger" role="alert">{state.error}</p>}
      </div>
    </form>
  );
}
