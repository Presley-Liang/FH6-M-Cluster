// Serialized into the standalone page. Each display override uses its own axis.
export function mapInstrumentLiveFractions(themeId, fractions = {}) {
  const maxima = {
    'y1950_1959.europe': 280, 'y1960_1975.europe': 280,
    'y1960_1975.japan': 280, 'y1976_1985.japan': 280,
    'y1995_2002.japan': 280, 'y2003_2008.japan': 280,
    'y2009_2014.europe': 280, 'y2009_2014.japan': 280,
    'y2020_2024.america': 260, 'y1995_2002.europe': 260,
    'y1960_1975.america': 260, 'y1976_1985.america': 260,
    'y2003_2008.america': 260,
    'y1950_1959.america': 160 / 0.621371,
  };
  const maximum = maxima[themeId];
  if (!maximum) return { ...fractions };
  const stops = [0, 20, 40, 60, 100, 140, 200, 260];
  const position = Math.max(0, Math.min(1, fractions.speed || 0)) * 7;
  const index = Math.min(6, Math.floor(position));
  const speed = Number.isFinite(fractions.speedKmh) ? fractions.speedKmh
    : stops[index] + (stops[index + 1] - stops[index]) * (position - index);
  return { ...fractions, speed: Math.max(0, Math.min(1, speed / maximum)) };
}
