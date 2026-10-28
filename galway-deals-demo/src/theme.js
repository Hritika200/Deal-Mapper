// Colours taken from Galway itself: the painted houses on the Long Walk,
// the bunting over Quay Street, and the river and sky around them.
export const GALWAY = {
  river: '#1d3557',
  sky: '#3a7cc2',
  red: '#e4572e',
  mustard: '#f2b705',
  mint: '#3fa77a',
  pink: '#e5487f',
};

// Each kind of place gets its own house colour on the map.
export const CATEGORY = {
  coffee: { label: 'Coffee', color: GALWAY.mustard, text: '#1d3557' },
  food: { label: 'Food & drink', color: GALWAY.red, text: '#ffffff' },
  books: { label: 'Books', color: GALWAY.mint, text: '#ffffff' },
  shopping: { label: 'Shopping', color: GALWAY.pink, text: '#ffffff' },
  market: { label: 'Markets', color: GALWAY.sky, text: '#ffffff' },
};

export const categoryColor = (id) => CATEGORY[id]?.color ?? GALWAY.river;
