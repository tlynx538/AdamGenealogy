export const Utils = {
  normalizeName: (str) => str.trim().replace(/\s+/g, ' '),
  clamp: (v, min, max) => Math.min(Math.max(v, min), max),
  sleep: (ms) => new Promise(r => setTimeout(r, ms)),

  // Biblical name variants mapping (KJV → modern)
  nameMap: {
    'enos':         'enosh',
    'cainan':       'kenan',
    'mahalaleel':   'mahalalel',
    'methushelah':  'methuselah',
    'lamekh':       'lamech',
    'noe':          'noah',
    'sem':          'shem',
    'abram':        'abraham',
    'isac':         'isaac',
    'israel':       'jacob',
  },

  normalizeId:  (id)  => id.trim(),
  getWikiId:    (url) => { const m = url.match(/Q\d+/); return m ? m[0] : null; },
  edgeKey:      (from, to, type) => `${from}|${to}|${type}`,
};