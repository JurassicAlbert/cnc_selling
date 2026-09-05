/**
 * Group-level loading fallback for `(marketing)` - same reasoning as
 * `(shop)/loading.tsx`. `blog/` already has its own and keeps it; the home
 * page, FAQ, o-nas, the pattern gallery and the static-page route all had
 * none despite each doing a real database read.
 */
export { RouteLoading as default } from '@/ui/primitives/RouteLoading';
