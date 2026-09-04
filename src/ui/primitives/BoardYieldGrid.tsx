import Image from 'next/image';
import { Box, Chip, Stack, Typography } from '@mui/material';

import { WAREHOUSE } from '@/content/pl/admin';
import { formatPln } from '@/domain/money/money';
import type { BoardFitReport } from '@/server/stock/what-fits';

/**
 * "What can I make from this board", as a grid of the shop's own product
 * photographs at 96px.
 *
 * The owner asked for the shop's real item images at 64 or 96 px, not icons,
 * and explicitly for the feel of an inventory screen in a game: a wall of
 * recognisable things with a number on each. 96 is the size that lets a
 * photograph still read as the object it shows; 64 was tested and turns a
 * wooden board into a brown square.
 *
 * The count on each tile is the yield from ONE board, cutting in rows. It is
 * deliberately conservative (`howManyFitOnBoard` takes the better of two
 * orientations and no more) because an operator plans a real cut against it,
 * and a number the machine cannot deliver is worse than a smaller true one.
 */
export function BoardYieldGrid({ report }: { readonly report: BoardFitReport }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {WAREHOUSE.canMakeHeadingPl}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        {WAREHOUSE.canMakeIntroPl}
      </Typography>

      {report.items.length === 0 ? (
        <Typography color="text.secondary" variant="body2">
          {WAREHOUSE.canMakeNonePl}
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            // Fills the row and wraps, so the grid reads the same on a laptop
            // and on the workshop's wide monitor.
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 2,
          }}
        >
          {report.items.map((item) => (
            <Box
              key={item.slug}
              sx={{
                p: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
              }}
            >
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    position: 'relative',
                    width: 96,
                    height: 96,
                    flexShrink: 0,
                    borderRadius: 1,
                    overflow: 'hidden',
                    bgcolor: 'action.hover',
                  }}
                >
                  {item.imageUrl !== null && (
                    // No photo means no photo. A placeholder graphic here
                    // would look like a product that exists and does not.
                    <Image src={item.imageUrl} alt="" fill sizes="96px" style={{ objectFit: 'cover' }} />
                  )}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {item.namePl}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {item.categoryNamePl}
                  </Typography>
                  <Chip
                    size="small"
                    color="primary"
                    label={`${item.fitsPerBoard} ${WAREHOUSE.perBoardPl}`}
                    sx={{ my: 0.75 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {item.bestSize.labelPl}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {WAREHOUSE.materialCostPl}: {formatPln(item.materialCostGrosze)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {WAREHOUSE.cataloguePricePl}:{' '}
                    {item.startingPriceGrossGrosze === null
                      ? WAREHOUSE.noCataloguePricePl
                      : formatPln(item.startingPriceGrossGrosze)}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Box>
      )}

      {report.tooLarge.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {WAREHOUSE.canMakeTooLargeHeadingPl}: {report.tooLarge.map((p) => p.namePl).join(', ')}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
