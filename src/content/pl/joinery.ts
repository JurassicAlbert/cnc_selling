/**
 * Real Polish copy for the Yato-yane joined-panel technique — see
 * `src/domain/joinery/yato-yane.ts` for why this exists and why it's
 * deliberately not imported anywhere yet. Written ready for a future
 * configurator step or product-page section to render, once the owner
 * decides to enable `Product.supportsPanelJoinery`.
 */
export const JOINERY = {
  yatoYaneNamePl: 'Łączenie na obce pióro (Yato-yane)',
  yatoYaneShortDescPl:
    'Większe blaty łączymy z kilku paneli tradycyjną japońską techniką stolarską — nie jest to ograniczenie, tylko świadomy wybór konstrukcyjny.',
  yatoYaneDetailPl:
    'Krawędzie łączonych paneli są żłobione wzdłuż długości, a w powstały rowek wsuwana jest osobna, twarda listwa drewna (obce pióro). Takie połączenie utrzymuje panele w jednej płaszczyźnie i skutecznie zapobiega wypaczaniu się blatu na łączeniu — sprawdzona metoda stosowana od wieków w meblarstwie japońskim, w pełni możliwa do wykonania na frezarce CNC.',
} as const;
