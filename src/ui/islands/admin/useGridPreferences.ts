'use client';

/**
 * Persists a `DataGrid`'s density/sort/column-visibility across visits -
 * `docs/CHECKLIST.md`'s "Column config, density and sort persisted per
 * user" and "Dense grid mode by default with comfortable toggle" (P7c
 * slice 8). One `localStorage` entry per `storageKey` (the grid's own
 * `basePath`, or a literal key for the three standalone grids).
 *
 * Deliberately loads from `localStorage` in a `useEffect`, NOT a lazy
 * `useState` initializer. A `DataGrid` living inside a `'use client'`
 * island still gets server-rendered for the initial HTML (Client
 * Components are SSR'd too) - reading `localStorage` during that initial
 * render would make the client's first paint disagree with the server's,
 * a real hydration mismatch (different visible columns, different row
 * order), not a hypothetical one. Loading in an effect means the first
 * paint always matches the default SSR'd state, then flips a tick after
 * mount if the user has saved different preferences - the standard safe
 * pattern for this class of client-only-storage state.
 */

import { useCallback, useEffect, useState } from 'react';
import type { GridColumnVisibilityModel, GridDensity, GridSortModel } from '@mui/x-data-grid';

export type GridPreferences = {
  readonly density: GridDensity;
  readonly sortModel: GridSortModel;
  readonly columnVisibilityModel: GridColumnVisibilityModel;
};

const DEFAULT_PREFERENCES: GridPreferences = { density: 'compact', sortModel: [], columnVisibilityModel: {} };

function storageKeyFor(key: string): string {
  return `admin-grid:${key}`;
}

function readPreferences(storageKey: string): GridPreferences {
  try {
    const raw = window.localStorage.getItem(storageKeyFor(storageKey));
    if (raw === null) {
      return DEFAULT_PREFERENCES;
    }
    const parsed = JSON.parse(raw) as Partial<GridPreferences>;
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    // Private browsing, disabled storage, or corrupt JSON - fall back to
    // defaults; the grid still works, it just won't remember this session.
    return DEFAULT_PREFERENCES;
  }
}

export function useGridPreferences(storageKey: string) {
  const [preferences, setPreferences] = useState<GridPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    setPreferences(readPreferences(storageKey));
  }, [storageKey]);

  const update = useCallback(
    (partial: Partial<GridPreferences>) => {
      setPreferences((prev) => {
        const next = { ...prev, ...partial };
        try {
          window.localStorage.setItem(storageKeyFor(storageKey), JSON.stringify(next));
        } catch {
          // Quota exceeded or storage disabled - the in-memory state above
          // still applies for the rest of this session.
        }
        return next;
      });
    },
    [storageKey],
  );

  return {
    density: preferences.density,
    onDensityChange: (density: GridDensity) => update({ density }),
    sortModel: preferences.sortModel,
    onSortModelChange: (sortModel: GridSortModel) => update({ sortModel }),
    columnVisibilityModel: preferences.columnVisibilityModel,
    onColumnVisibilityModelChange: (columnVisibilityModel: GridColumnVisibilityModel) => update({ columnVisibilityModel }),
  };
}
