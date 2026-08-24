import { SITE } from '@/content/pl/site';

export type MaterialFilterOption = {
  readonly slug: string;
  readonly namePl: string;
};

type CategoryFilterFormProps = {
  readonly actionPath: string;
  readonly materials: readonly MaterialFilterOption[];
  readonly selectedMaterialSlug: string | null;
  readonly sort: string | null;
};

/**
 * A real filter/sort sidebar with zero client JavaScript. A native `<form
 * method="get">` re-navigates the browser with new query params on submit —
 * the server re-renders the category page against them (see
 * `src/app/(shop)/[category]/page.tsx`). No client island needed for
 * something this simple, which keeps a static category page static: no MUI,
 * no Emotion, no hydration cost, for a page under `(shop)` that has no other
 * reason to ship any client JS at all.
 *
 * Honestly scoped: with 0-1 products per category today there is very
 * little to actually filter down from. It's real and correctly wired —
 * ready to matter once the catalogue grows — not decoration.
 */
export function CategoryFilterForm({
  actionPath,
  materials,
  selectedMaterialSlug,
  sort,
}: CategoryFilterFormProps) {
  return (
    <form
      method="get"
      action={actionPath}
      style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 200 }}
    >
      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend
          style={{
            font: 'var(--mui-font-subtitle2)',
            color: 'var(--mui-palette-text-primary)',
            padding: 0,
            marginBottom: 8,
          }}
        >
          {SITE.filterMaterialLabelPl}
        </legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ font: 'var(--mui-font-body2)', color: 'var(--mui-palette-text-primary)' }}>
            <input type="radio" name="material" value="" defaultChecked={selectedMaterialSlug === null} />{' '}
            {SITE.filterAllMaterialsPl}
          </label>
          {materials.map((material) => (
            <label
              key={material.slug}
              style={{ font: 'var(--mui-font-body2)', color: 'var(--mui-palette-text-primary)' }}
            >
              <input
                type="radio"
                name="material"
                value={material.slug}
                defaultChecked={selectedMaterialSlug === material.slug}
              />{' '}
              {material.namePl}
            </label>
          ))}
        </div>
      </fieldset>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ font: 'var(--mui-font-subtitle2)', color: 'var(--mui-palette-text-primary)' }}>
          {SITE.sortLabelPl}
        </span>
        <select
          name="sort"
          defaultValue={sort ?? ''}
          style={{
            font: 'var(--mui-font-body2)',
            padding: 8,
            border: '1px solid var(--mui-palette-divider)',
            borderRadius: 2,
            backgroundColor: 'var(--mui-palette-background-paper)',
            color: 'var(--mui-palette-text-primary)',
          }}
        >
          <option value="">{SITE.sortRelevancePl}</option>
          <option value="price_asc">{SITE.sortPriceAscPl}</option>
          <option value="price_desc">{SITE.sortPriceDescPl}</option>
        </select>
      </label>

      <button
        type="submit"
        style={{
          font: 'var(--mui-font-button)',
          textTransform: 'none',
          padding: '10px 16px',
          border: 'none',
          borderRadius: 2,
          backgroundColor: 'var(--mui-palette-primary-main)',
          color: 'var(--mui-palette-background-paper)',
          cursor: 'pointer',
        }}
      >
        {SITE.filterApplyPl}
      </button>
    </form>
  );
}
