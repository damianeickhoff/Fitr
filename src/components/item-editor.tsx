"use client";

import { useActionState } from "react";
import type { Item } from "@/generated/prisma/browser";
import { CATEGORIES, CATEGORY_KEYS, FORMALITY, SEASONS, parseList } from "@/lib/garment";
import { updateItem } from "@/lib/item-actions";
import { SubmitButton } from "./submit-button";
import { field, label } from "./ui";

export function ItemEditor({ item }: { item: Item }) {
  const [state, action] = useActionState(updateItem.bind(null, item.id), undefined);
  const seasons = parseList(item.seasons);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="name" className={label}>Name</label>
        <input id="name" name="name" defaultValue={item.name} required className={field} />
      </div>
      <div>
        <label htmlFor="category" className={label}>Category</label>
        <select id="category" name="category" defaultValue={item.category} className={field}>
          {CATEGORY_KEYS.map((key) => (
            <option key={key} value={key}>{CATEGORIES[key].one}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="subcategory" className={label}>Type</label>
        <input id="subcategory" name="subcategory" defaultValue={item.subcategory ?? ""} placeholder="e.g. chelsea boots" className={field} />
      </div>
      <div>
        <label htmlFor="colors" className={label}>Colours</label>
        <input id="colors" name="colors" defaultValue={parseList(item.colors).join(", ")} placeholder="navy, white" className={field} />
      </div>
      <div>
        <label htmlFor="brand" className={label}>Brand</label>
        <input id="brand" name="brand" defaultValue={item.brand ?? ""} className={field} />
      </div>
      <div>
        <label htmlFor="material" className={label}>Material</label>
        <input id="material" name="material" defaultValue={item.material ?? ""} className={field} />
      </div>
      <div>
        <label htmlFor="pattern" className={label}>Pattern</label>
        <input id="pattern" name="pattern" defaultValue={item.pattern ?? ""} placeholder="solid" className={field} />
      </div>
      <div>
        <label htmlFor="styles" className={label}>Style words</label>
        <input id="styles" name="styles" defaultValue={parseList(item.styles).join(", ")} placeholder="minimal, smart casual" className={field} />
      </div>
      <div>
        <label htmlFor="formality" className={label}>Dress code</label>
        <select id="formality" name="formality" defaultValue={item.formality} className={field}>
          {FORMALITY.slice(1).map((name, n) => (
            <option key={name} value={n + 1}>{name}</option>
          ))}
        </select>
      </div>
      <fieldset className="sm:col-span-2">
        <legend className={label}>Seasons</legend>
        <div className="flex flex-wrap gap-2">
          {SEASONS.map((season) => (
            <label key={season} className="flex cursor-pointer items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-sm font-semibold text-muted capitalize ring-1 ring-line has-checked:bg-ink has-checked:text-white has-checked:ring-ink">
              <input type="checkbox" name="seasons" value={season} defaultChecked={seasons.includes(season)} className="sr-only" />
              {season}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        <label htmlFor="description" className={label}>Description</label>
        <textarea id="description" name="description" rows={3} defaultValue={item.description ?? ""} className={field} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pending="Saving…">Save changes</SubmitButton>
        {state?.saved && <p className="text-sm text-muted" role="status">Saved.</p>}
        {state?.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
      </div>
    </form>
  );
}
