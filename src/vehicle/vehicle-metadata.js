import { VEHICLE_MODEL_BY_ORDINAL } from '../../public/js/vehicle-model-catalog.js';
import {
  BASE_THEME_COUNT,
  DEFAULT_THEME_ID,
  REGION_IDS,
  THEME_REGISTRY,
  VEHICLE_POWERTRAIN_TO_DISPLAY,
  VEHICLE_REGION_TO_THEME_REGION,
  VEHICLE_THEME_ID_MAP,
  VEHICLE_YEAR_BAND_TO_ERA,
} from '../../public/js/themes/theme-registry.js';

export const UNKNOWN = 'unknown';

// Exact vehicle-country values from the official FH6 roster take precedence.
// The roster does not provide carOrdinal; these entries were cross-checked against the local ordinal catalog.
export const VEHICLE_COUNTRY_BY_ORDINAL = Object.freeze({
  '368': 'USA',
  '422': 'USA',
  '1006': 'Italy',
  '1034': 'Japan',
  '1041': 'USA',
  '1667': 'UK',
  '2133': 'Germany',
  '2290': 'Germany',
  '3445': 'Germany',
  '3449': 'UK',
  '3625': 'Croatia',
  '3692': 'USA',
  '3722': 'USA',
  '3767': 'USA',
  '3771': 'USA',
  '3789': 'China',
  '3827': 'Korea',
  '3891': 'Italy',
  '3908': 'Japan',
  '4126': 'Japan',
  '4200': 'UK',
});

// Reviewed country defaults for catalog makes. The Null Car placeholder remains unknown
// because it does not identify the actual vehicle selected by the game.
// Acura follows FH6's make-country convention (USA); China is deliberately grouped
// into the Japan presentation region by the project convention below.
export const VEHICLE_COUNTRY_BY_BRAND = Object.freeze({
  'AMG Transport Dynamics': 'USA',
  'Abarth': 'Italy',
  'Acura': 'USA',
  'Alfa Romeo': 'Italy',
  'Alumicraft': 'USA',
  'Apollo': 'Germany',
  'Ariel': 'UK',
  'Aston Martin': 'UK',
  'Audi': 'Germany',
  'Austin-Healey': 'UK',
  'Autozam': 'Japan',
  'BAC': 'UK',
  'Bentley': 'UK',
  'Bently': 'UK',
  'BMW': 'Germany',
  'Buick': 'USA',
  'Cadillac': 'USA',
  'Can-Am': 'Canada',
  'Casey Currie Motorsports': 'USA',
  'Chevrolet': 'USA',
  'Datsun': 'Japan',
  'De Tomaso': 'Italy',
  'DeBerti': 'USA',
  'DeLorean': 'USA',
  'Dodge': 'USA',
  'Exomotive': 'USA',
  'Ferrari': 'Italy',
  'Fiat': 'Italy',
  'Ford': 'USA',
  'Formula Drift': 'USA',
  'Funco': 'USA',
  'Ginetta': 'UK',
  'GMC': 'USA',
  'Gordon Murray': 'UK',
  'GR': 'Japan',
  'Hennessey': 'USA',
  'Holden': 'Australia',
  'Honda': 'Japan',
  'Hyundai': 'South Korea',
  'Jaguar': 'UK',
  'Jeep': 'USA',
  'Jimco': 'USA',
  'Koenigsegg': 'Sweden',
  'KTM': 'Austria',
  'Lamborghini': 'Italy',
  'Lancia': 'Italy',
  'Land Rover': 'UK',
  'Lexus': 'Japan',
  'Lincoln': 'USA',
  'Lotus': 'UK',
  'Lucid': 'USA',
  'Maserati': 'Italy',
  'Mazda': 'Japan',
  'Mazdaspeed': 'Japan',
  'McLaren': 'UK',
  'Mercedes-AMG': 'Germany',
  'Mercedes-Benz': 'Germany',
  'Merceds-AMG': 'Germany',
  'Meyers': 'USA',
  'MG': 'UK',
  'MINI': 'UK',
  'Mitsubishi': 'Japan',
  'Nisan': 'Japan',
  'Nissan': 'Japan',
  'Noble': 'UK',
  'Opel': 'Germany',
  'Pagani': 'Italy',
  'Peel': 'UK',
  'Penhall': 'USA',
  'Peugeot': 'France',
  'Plymouth': 'USA',
  'Polaris': 'USA',
  'Playground': 'UK',
  'Pontiac': 'USA',
  'Porsche': 'Germany',
  'Radical': 'UK',
  'Ram': 'USA',
  'Reliant': 'UK',
  'Renault': 'France',
  'Rimac': 'Croatia',
  'Rivian': 'USA',
  'RJ Anderson': 'USA',
  'Saleen': 'USA',
  'Shelby': 'USA',
  'Sierra Cars': 'USA',
  'Subaru': 'Japan',
  'Toyota': 'Japan',
  'TVR': 'UK',
  'Ultima': 'UK',
  'Vauxhall': 'UK',
  'Viper': 'USA',
  'Volkswagen': 'Germany',
  'Volvo': 'Sweden',
  'Wuling': 'China',
  'Zenvo': 'Denmark',
});

// FH6 telemetry catalog omits the fictional make prefix on these generic traffic assets.
export const VEHICLE_BRAND_BY_ORDINAL = Object.freeze({
  '2713': 'Playground', // 2014 Box Truck (Traffic)
  '2714': 'Playground', // 2014 Bus (Traffic)
  '2902': 'Playground', // 2018 Flatbed Truck (Traffic)
});

export const BRAND_REGION_DEFAULT_SOURCE = 'brand-presentation-region-default';

const COUNTRY_REGION_DEFAULTS = Object.freeze({
  'USA': 'americas', 'Canada': 'americas', 'Mexico': 'americas',
  'Japan': 'japan', 'China': 'japan', 'Korea': 'japan', 'South Korea': 'japan', 'Australia': 'japan',
  'UK': 'europe', 'Germany': 'europe', 'Italy': 'europe', 'France': 'europe',
  'Spain': 'europe', 'Sweden': 'europe', 'Denmark': 'europe', 'Croatia': 'europe',
  'Netherlands': 'europe', 'Belgium': 'europe', 'Austria': 'europe',
  'Czech Republic': 'europe', 'Finland': 'europe', 'Poland': 'europe',
  'Norway': 'europe', 'Portugal': 'europe', 'Switzerland': 'europe',
});

// Presentation grouping only; this is not telemetry or a nationality claim.
// Country groups take precedence when the FH6 roster supplied a country; brand defaults fill the rest.
export const BRAND_REGION_DEFAULTS = Object.freeze({
  // Europe
  'Abarth': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Alfa Romeo': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Ariel': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Aston Martin': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Apollo': Object.freeze({ region: 'europe', confidence: 'high' }),
  'BAC': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Bentley': Object.freeze({ region: 'europe', confidence: 'high' }),
  'BMW': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Bugatti': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Caterham': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Citroen': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Cupra': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Dallara': Object.freeze({ region: 'europe', confidence: 'medium' }),
  'De Tomaso': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Donkervoort': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Audi': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Ginetta': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Gordon Murray': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Gordon Murray Automotive': Object.freeze({ region: 'europe', confidence: 'high' }),
  'MG': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Opel': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Reliant': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Ultima': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Volvo': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Austin-Healey': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Bently': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Merceds-AMG': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Mercedes-AMG': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Peel': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Ferrari': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Fiat': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Italdesign': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Jaguar': Object.freeze({ region: 'europe', confidence: 'high' }),
  'KTM': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Koenigsegg': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Lamborghini': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Lancia': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Land Rover': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Lola': Object.freeze({ region: 'europe', confidence: 'medium' }),
  'Lotus': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Maserati': Object.freeze({ region: 'europe', confidence: 'high' }),
  'McLaren': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Mercedes-Benz': Object.freeze({ region: 'europe', confidence: 'high' }),
  'MINI': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Morgan': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Noble': Object.freeze({ region: 'europe', confidence: 'medium' }),
  'Pagani': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Peugeot': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Pininfarina': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Polestar': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Porsche': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Radical': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Renault': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Rimac': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Rolls-Royce': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Spania GTA': Object.freeze({ region: 'europe', confidence: 'medium' }),
  'TVR': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Vauxhall': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Volkswagen': Object.freeze({ region: 'europe', confidence: 'high' }),
  'Zenvo': Object.freeze({ region: 'europe', confidence: 'high' }),

  // Americas
  'AMC': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Buick': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Alumicraft': Object.freeze({ region: 'americas', confidence: 'high' }),
  'AMG Transport Dynamics': Object.freeze({ region: 'americas', confidence: 'medium' }),
  'Can-Am': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Cadillac': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Casey Currie Motorsports': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Chevrolet': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Chrysler': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Dodge': Object.freeze({ region: 'americas', confidence: 'high' }),
  'DeBerti': Object.freeze({ region: 'americas', confidence: 'high' }),
  'DeLorean': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Exomotive': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Ford': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Formula Drift': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Funco': Object.freeze({ region: 'americas', confidence: 'high' }),
  'GMC': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Hennessey': Object.freeze({ region: 'americas', confidence: 'high' }),
  'International': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Jimco': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Jeep': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Holden': Object.freeze({ region: 'americas', confidence: 'medium' }),
  'Lincoln': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Lucid': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Mercury': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Meyers': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Mosler': Object.freeze({ region: 'americas', confidence: 'medium' }),
  'Oldsmobile': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Plymouth': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Pontiac': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Penhall': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Polaris': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Ram': Object.freeze({ region: 'americas', confidence: 'high' }),
  'RJ Anderson': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Rivian': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Sierra Cars': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Saleen': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Shelby': Object.freeze({ region: 'americas', confidence: 'high' }),
  'Viper': Object.freeze({ region: 'americas', confidence: 'high' }),

  // Japan
  'Hyundai': Object.freeze({ region: 'japan', confidence: 'high' }),
  'Autozam': Object.freeze({ region: 'japan', confidence: 'high' }),
  'GR': Object.freeze({ region: 'japan', confidence: 'high' }),
  'Mazdaspeed': Object.freeze({ region: 'japan', confidence: 'high' }),
  'Nisan': Object.freeze({ region: 'japan', confidence: 'high' }),
  'Acura': Object.freeze({ region: 'japan', confidence: 'high' }),
  'Datsun': Object.freeze({ region: 'japan', confidence: 'high' }),
  'Honda': Object.freeze({ region: 'japan', confidence: 'high' }),
  'Infiniti': Object.freeze({ region: 'japan', confidence: 'high' }),
  'Lexus': Object.freeze({ region: 'japan', confidence: 'high' }),
  'Mazda': Object.freeze({ region: 'japan', confidence: 'high' }),
  'Mitsubishi': Object.freeze({ region: 'japan', confidence: 'high' }),
  'Nissan': Object.freeze({ region: 'japan', confidence: 'high' }),
  'Subaru': Object.freeze({ region: 'japan', confidence: 'high' }),
  'Suzuki': Object.freeze({ region: 'japan', confidence: 'high' }),
  'Toyota': Object.freeze({ region: 'japan', confidence: 'high' }),
  // East Asian makes use the Japan-style theme group; Chinese makes are included as requested.
  'Wuling': Object.freeze({ region: 'japan', confidence: 'medium' }),
});

// Exact catalog ordinals confirmed against manufacturer sources. This is not a
// brand/name heuristic: other models and unverified conversions stay unknown.
export const VERIFIED_EV_SOURCES = Object.freeze({
  3359: 'https://www.audi-mediacenter.com/en/photos/detail/audi-e-tron-55-quattro-68666',
  3445: 'https://newsroom.porsche.com/en_US/products/taycan/powertrain-18555.html',
  3625: 'https://www.rimac-automobili.com/nevera/',
  3657: 'https://assets.rivian.com/2md5qhoeajym/qPvr9g8P9P8LsY9VwHrDI/e3f8ab3d005b938c14232ab81da10c40/r1t-erg-en-us-20240610.pdf',
  3737: 'https://www.bmwusa.com/vehicles/bmw-i-series.html',
  3755: 'https://media.ford.com/content/fordmedia/feu/gb/en/news/2022/06/23/here_s-how-to-accelerate-a-business-2-000-ps-wild-styled-ford.html',
  3811: 'https://lucidmotors.com/air',
  3827: 'https://www.hyundai-n.com/en/models/n/ioniq-5-n',
});
export const VERIFIED_EV_ORDINALS = Object.freeze([...new Set([...Object.keys(VERIFIED_EV_SOURCES).map(Number), ...Object.entries(VEHICLE_MODEL_BY_ORDINAL)
  .filter(([, name]) => /\bEV\b/i.test(name) && !/\bEV\s+Edition\b/i.test(name))
  .map(([ordinal]) => Number(ordinal))])]);

export const YEAR_BANDS = Object.freeze([
  { id: 'pre-1949', label: '1949以前｜古典机械', minYear: null, maxYear: 1949 },
  { id: '1950-1959', label: '1950-1959｜复古经典', minYear: 1950, maxYear: 1959 },
  { id: '1960-1975', label: '1960-1975｜经典机械', minYear: 1960, maxYear: 1975 },
  { id: '1976-1985', label: '1976-1985｜后期机械', minYear: 1976, maxYear: 1985 },
  { id: '1986-1994', label: '1986-1994｜复古数字', minYear: 1986, maxYear: 1994 },
  { id: '1995-2002', label: '1995-2002｜90年代运动', minYear: 1995, maxYear: 2002 },
  { id: '2003-2008', label: '2003-2008｜千禧年代', minYear: 2003, maxYear: 2008 },
  { id: '2009-2014', label: '2009-2014｜混合仪表', minYear: 2009, maxYear: 2014 },
  { id: '2015-2019', label: '2015-2019｜现代性能', minYear: 2015, maxYear: 2019 },
  { id: '2020-2024', label: '2020-2024｜全数字座舱', minYear: 2020, maxYear: 2024 },
  { id: '2025+', label: '2025以后｜次世代座舱', minYear: 2025, maxYear: null },
]);

export const REGIONS = Object.freeze({
  europe: Object.freeze({ id: 'europe', label: '欧系', style: '精密、克制、规整、细刻度、信息层级清楚' }),
  americas: Object.freeze({ id: 'americas', label: '美系', style: '粗、大、高对比、力量感、驾驶模式视觉变化明显' }),
  japan: Object.freeze({ id: 'japan', label: '日系', style: '机能、信息密度高、强调转速/挡位/温度/压力/Boost' }),
});

export const THEME_IDS = Object.freeze(Object.keys(THEME_REGISTRY));
export const THEME_COUNT = BASE_THEME_COUNT;
export const LEGACY_ANCHOR_THEME_ID = DEFAULT_THEME_ID;
const regionIds = new Set(Object.keys(REGIONS));
const powertrainIds = new Set(['combustion', 'hybrid', 'electric', UNKNOWN]);
const evOrdinals = new Set(VERIFIED_EV_ORDINALS.map(String));
const brandAliases = [
  'AMG Transport Dynamics', 'Casey Currie Motorsports', 'Gordon Murray Automotive',
  'Austin-Healey', 'Mercedes-Benz', 'Mercedes-AMG', 'Merceds-AMG', 'Formula Drift',
  'Sierra Cars', 'RJ Anderson', 'Gordon Murray', 'Aston Martin', 'Alfa Romeo', 'Land Rover', 'Rolls-Royce',
  'Mitsubishi', 'Volkswagen', 'Lamborghini', 'Chevrolet', 'Plymouth', 'Cadillac',
  'Maserati', 'Vauxhall', 'Volkswagen', 'McLaren', 'Koenigsegg', 'Bugatti',
  'Pagani', 'Polestar', 'Porsche', 'Ferrari', 'Nissan', 'Toyota', 'Honda',
  'Subaru', 'Suzuki', 'Acura', 'Lancia', 'Jaguar', 'Bentley', 'Bently', 'Renault',
  'Peugeot', 'Citroen', 'Dodge', 'Chrysler', 'Lincoln', 'Mercury', 'Shelby',
  'Pontiac', 'Oldsmobile', 'Buick', 'GMC', 'Ford', 'BMW', 'Audi', 'Lotus',
  'MINI', 'Hyundai', 'Kia', 'Genesis', 'Mazda', 'Mazdaspeed', 'Lexus', 'Infiniti', 'Rimac',
  'Wuling', 'TVR', 'De Tomaso', 'Talon', 'Hennessey', 'Zenvo', 'W Motors',
  'DeBerti', 'DeLorean', 'Holden', 'Viper', 'Meyers', 'Opel', 'Penhall', 'Alumicraft',
  'Reliant', 'Ultima', 'Peel', 'AMG Transport Dynamics', 'Exomotive', 'Can-Am', 'Funco',
  'Polaris', 'Autozam', 'GR', 'Apollo', 'Ginetta', 'Jimco', 'Sierra Cars', 'Volvo', 'MG', 'Nisan',
  'Morgan', 'Tamo', 'Donkervoort', 'Caterham', 'Abarth', 'Fiat', 'Lola',
  'Datsun', 'Eagle', 'AMC', 'International', 'Jeep', 'Ram', 'Lucid', 'Rivian',
  'Cupra', 'BAC', 'Radical', 'Ariel', 'KTM', 'Pininfarina', 'Noble', 'Saleen',
  'Rossion', 'Mosler', 'Spania GTA', 'Quant', 'Italdesign', 'Toyota',
].sort((a, b) => b.length - a.length);

function parseCatalogName(name) {
  const match = /^(\d{4})\s+(.+)$/.exec(name);
  if (!match) return { year: null, brand: UNKNOWN, model: name || UNKNOWN };
  const year = Number(match[1]);
  const remainder = match[2];
  const alias = brandAliases.find(candidate => remainder.toLowerCase().startsWith(candidate.toLowerCase() + ' '));
  if (!alias) return { year, brand: UNKNOWN, model: remainder };
  return { year, brand: alias, model: remainder.slice(alias.length).trim() || UNKNOWN };
}

function normalizeOrdinal(value) {
  const ordinal = Number(value);
  return Number.isSafeInteger(ordinal) && ordinal > 0 ? String(ordinal) : null;
}

function validRegion(value) {
  return regionIds.has(value) ? value : UNKNOWN;
}

function validPowertrain(value) {
  return powertrainIds.has(value) ? value : UNKNOWN;
}

function resolveRegion(brand, supplied, country = UNKNOWN) {
  if (Object.hasOwn(supplied, 'region')) {
    const region = validRegion(supplied.region);
    return {
      region,
      source: supplied.regionSource || 'vehicle-explicit-override',
      confidence: supplied.regionConfidence || (region === UNKNOWN ? 'none' : 'high'),
    };
  }
  const countryRegion = COUNTRY_REGION_DEFAULTS[country];
  if (countryRegion) {
    return { region: countryRegion, source: 'country-presentation-group', confidence: 'high' };
  }
  const brandDefault = BRAND_REGION_DEFAULTS[brand];
  if (brandDefault) {
    return { region: brandDefault.region, source: BRAND_REGION_DEFAULT_SOURCE, confidence: brandDefault.confidence };
  }
  return { region: UNKNOWN, source: 'unclassified-brand', confidence: 'none' };
}

export function getYearBand(year) {
  if (!Number.isSafeInteger(year)) return null;
  return YEAR_BANDS.find(band =>
    (band.minYear === null || year >= band.minYear) &&
    (band.maxYear === null || year <= band.maxYear)) || null;
}

const metadataEntries = Object.entries(VEHICLE_MODEL_BY_ORDINAL).map(([ordinal, name]) => {
  const parsed = parseCatalogName(name);
  const brand = parsed.brand === UNKNOWN ? VEHICLE_BRAND_BY_ORDINAL[ordinal] || parsed.brand : parsed.brand;
  const resolvedCountry = VEHICLE_COUNTRY_BY_ORDINAL[ordinal] || VEHICLE_COUNTRY_BY_BRAND[brand] || UNKNOWN;
  const region = resolveRegion(brand, {}, resolvedCountry);
  const powertrain = validPowertrain(evOrdinals.has(ordinal) ? 'electric' : UNKNOWN);
  return [ordinal, Object.freeze({
    ordinal: Number(ordinal),
    name,
    brand,
    model: parsed.model,
    year: parsed.year,
    region: region.region,
    regionSource: region.source,
    regionConfidence: region.confidence,
    country: resolvedCountry,
    powertrain,
    powertrainSource: VERIFIED_EV_SOURCES[ordinal] || (powertrain === 'electric' ? 'local-ordinal-name-ev-marker' : 'unknown'),
    source: VERIFIED_EV_SOURCES[ordinal] ? 'local-ordinal-manufacturer-verified-ev' : evOrdinals.has(ordinal) && powertrain === 'electric' ? 'local-ordinal-name-ev-marker' : 'local-ordinal-name',
  })];
});

export const VEHICLE_METADATA_BY_ORDINAL = Object.freeze(Object.fromEntries(metadataEntries));

export function lookupVehicleMetadata(carOrdinal) {
  const key = normalizeOrdinal(carOrdinal);
  return key ? VEHICLE_METADATA_BY_ORDINAL[key] || null : null;
}

export function resolveVehicleTheme(vehicle, { driveMode = null } = {}) {
  const year = Number.isSafeInteger(vehicle?.year) ? vehicle.year : null;
  const yearBand = getYearBand(year);
  const region = validRegion(vehicle?.region);
  const powertrain = validPowertrain(vehicle?.powertrain);
  const baseThemeId = yearBand && region !== UNKNOWN && REGION_IDS.some(id => VEHICLE_REGION_TO_THEME_REGION[region] === id)
    ? `${yearBand.id}.${region}` : null;
  const eraId = yearBand ? VEHICLE_YEAR_BAND_TO_ERA[yearBand.id] ?? null : null;
  const regionId = VEHICLE_REGION_TO_THEME_REGION[region] ?? null;
  const themeId = baseThemeId ? VEHICLE_THEME_ID_MAP[baseThemeId] ?? LEGACY_ANCHOR_THEME_ID : LEGACY_ANCHOR_THEME_ID;
  // `baseThemeId`, `yearBandId`, `region`, and `powertrain` are the stable
  // source-side contract consumed by mapVehicleThemeMetadata() in theme-registry.
  return Object.freeze({
    themeId,
    eraId,
    regionId,
    baseThemeId,
    yearBandId: yearBand?.id ?? null,
    region,
    powertrain,
    powertrainOverride: powertrain === 'electric' ? 'electric' : null,
    modeOverlay: driveMode === 'race' || driveMode === 'freeRoam' ? driveMode : null,
    fallbackThemeId: baseThemeId ? null : LEGACY_ANCHOR_THEME_ID,
    fallback: baseThemeId === null,
    resolved: baseThemeId !== null,
  });
}

export function getThemeRegistry() {
  return Object.freeze(YEAR_BANDS.flatMap(year => Object.values(REGIONS).map(region => Object.freeze({
    id: `${VEHICLE_YEAR_BAND_TO_ERA[year.id]}.${VEHICLE_REGION_TO_THEME_REGION[region.id]}`,
    sourceId: `${year.id}.${region.id}`,
    eraId: VEHICLE_YEAR_BAND_TO_ERA[year.id],
    yearBandId: year.id,
    yearLabel: year.label,
    regionId: region.id,
    regionLabel: region.label,
    visualDirection: region.style,
  }))));
}
