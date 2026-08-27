'use client';

/**
 * Global search (Ctrl/⌘+K), mounted once in `panel/layout.tsx` so it's
 * live on every `/panel/*` page. A small inline debounce (`setTimeout`/
 * `clearTimeout`, no dependency — matches `mailer.ts`'s own "no SDK for
 * one small thing" discipline) calls the real `searchGlobal` Server
 * Action as the user types; only groups with real results render, never
 * an empty heading (the same discipline the homepage's reviews/FAQ
 * sections already follow).
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Dialog, DialogContent, List, ListItemButton, ListItemText, TextField, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { searchGlobal } from '@/server/actions/admin-global-search';
import type { GlobalSearchResult, GlobalSearchResults } from '@/server/repositories/admin-global-search';

const DEBOUNCE_MS = 250;

const EMPTY_RESULTS: GlobalSearchResults = { orders: [], customers: [], designs: [], products: [] };

function ResultGroup({ heading, results, onSelect }: { readonly heading: string; readonly results: readonly GlobalSearchResult[]; readonly onSelect: () => void }) {
  if (results.length === 0) {
    return null;
  }
  return (
    <>
      <Typography variant="overline" color="text.secondary" sx={{ px: 2, display: 'block', mt: 1 }}>
        {heading}
      </Typography>
      <List dense disablePadding>
        {results.map((result) => (
          <ListItemButton key={`${result.type}-${result.id}`} component={Link} href={result.href} onClick={onSelect}>
            <ListItemText primary={result.label} secondary={result.sublabel} />
          </ListItemButton>
        ))}
      </List>
    </>
  );
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY_RESULTS);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
    if (query.trim().length === 0) {
      setResults(EMPTY_RESULTS);
      return;
    }
    timeoutRef.current = setTimeout(() => {
      void searchGlobal(query).then(setResults);
    }, DEBOUNCE_MS);
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query]);

  function handleClose() {
    setOpen(false);
    setQuery('');
    setResults(EMPTY_RESULTS);
  }

  const hasResults = results.orders.length > 0 || results.customers.length > 0 || results.designs.length > 0 || results.products.length > 0;

  return (
    <>
      <Button size="small" variant="text" onClick={() => setOpen(true)} sx={{ justifyContent: 'flex-start', textTransform: 'none' }}>
        {ADMIN.globalSearchTriggerPl}
      </Button>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogContent sx={{ p: 0 }}>
          <TextField
            autoFocus
            fullWidth
            placeholder={ADMIN.globalSearchPlaceholderPl}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            variant="standard"
            slotProps={{ input: { disableUnderline: true, sx: { p: 2, fontSize: '1.1rem' } } }}
          />
          <div style={{ maxHeight: 360, overflowY: 'auto', paddingBottom: 8 }}>
            {query.trim().length === 0 ? (
              <Typography color="text.secondary" sx={{ px: 2, py: 2 }}>
                {ADMIN.globalSearchHintPl}
              </Typography>
            ) : hasResults ? (
              <>
                <ResultGroup heading={ADMIN.globalSearchOrdersHeadingPl} results={results.orders} onSelect={handleClose} />
                <ResultGroup heading={ADMIN.globalSearchCustomersHeadingPl} results={results.customers} onSelect={handleClose} />
                <ResultGroup heading={ADMIN.globalSearchDesignsHeadingPl} results={results.designs} onSelect={handleClose} />
                <ResultGroup heading={ADMIN.globalSearchProductsHeadingPl} results={results.products} onSelect={handleClose} />
              </>
            ) : (
              <Typography color="text.secondary" sx={{ px: 2, py: 2 }}>
                {ADMIN.globalSearchNoResultsPl}
              </Typography>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
