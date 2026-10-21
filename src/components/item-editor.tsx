"use client";

import { useActionState } from "react";
import type { Item } from "@/generated/prisma/browser";
import { CATEGORY_KEYS, SEASONS, parseList } from "@/lib/garment";
import { categoryLabel, formalityLabel, type MessageKey } from "@/lib/i18n";
import { updateItem } from "@/lib/item-actions";
import { useT } from "./locale";
import { SubmitButton } from "./submit-button";
import { field, label } from "./ui";

export function ItemEditor({ item }: { item: Item }) {
  const t = useT();
  const [state, action] = useActionState(updateItem.bind(null, item.id), undefined);
  const seasons = parseList(item.seasons);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="name" className={label}>{t("edit.name")}</label>
        <input id="name" name="name" defaultValue={item.name} required className={field} />
      </div>
      <div>
        <label htmlFor="category" className={label}>{t("edit.category")}</label>
        <select id="category" name="category" defaultValue={item.category} className={field}>
          {CATEGORY_KEYS.map((key) => (
            <option key={key} value={key}>{categoryLabel(t, key)}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="subcategory" className={label}>{t("edit.type")}</label>
        <input id="subcategory" name="subcategory" defaultValue={item.subcategory ?? ""} placeholder={t("edit.typeHint")} className={field} />
      </div>
      <div>
        <label htmlFor="colors" className={label}>{t("edit.colours")}</label>
        <input id="colors" name="colors" defaultValue={parseList(item.colors).join(", ")} placeholder={t("edit.coloursHint")} className={field} />
      </div>
      <div>
        <label htmlFor="brand" className={label}>{t("edit.brand")}</label>
        <input id="brand" name="brand" defaultValue={item.brand ?? ""} className={field} />
      </div>
      <div>
        <label htmlFor="material" className={label}>{t("edit.material")}</label>
        <input id="material" name="material" defaultValue={item.material ?? ""} className={field} />
      </div>
      <div>
        <label htmlFor="pattern" className={label}>{t("edit.pattern")}</label>
        <input id="pattern" name="pattern" defaultValue={item.pattern ?? ""} placeholder={t("edit.patternHint")} className={field} />
      </div>
      <div>
        <label htmlFor="styles" className={label}>{t("edit.styles")}</label>
        <input id="styles" name="styles" defaultValue={parseList(item.styles).join(", ")} placeholder={t("edit.stylesHint")} className={field} />
      </div>
      <div>
        <label htmlFor="formality" className={label}>{t("edit.dressCode")}</label>
        <select id="formality" name="formality" defaultValue={item.formality} className={field}>
          {[1, 2, 3, 4, 5].map((level) => (
            <option key={level} value={level}>{formalityLabel(t, level)}</option>
          ))}
        </select>
      </div>
      <fieldset className="sm:col-span-2">
        <legend className={label}>{t("edit.seasons")}</legend>
        <div className="flex flex-wrap gap-2">
          {SEASONS.map((season) => (
            <label key={season} className="flex cursor-pointer items-center gap-2 rounded-full bg-ground px-3.5 py-2 text-[13px] font-bold text-muted capitalize ring-1 ring-line ring-inset has-checked:bg-ink has-checked:text-paper has-checked:ring-ink">
              <input type="checkbox" name="seasons" value={season} defaultChecked={seasons.includes(season)} className="sr-only" />
              {t(`season.${season}` as MessageKey)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        <label htmlFor="description" className={label}>{t("edit.description")}</label>
        <textarea id="description" name="description" rows={3} defaultValue={item.description ?? ""} className={field} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pending={t("common.saving")}>{t("edit.save")}</SubmitButton>
        {state?.saved && <p className="text-sm font-semibold text-muted" role="status">{t("common.saved")}</p>}
        {state?.error && <p className="text-sm font-semibold text-danger" role="alert">{state.error}</p>}
      </div>
    </form>
  );
}
