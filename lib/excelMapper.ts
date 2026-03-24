// Diccionario de aliases para archivo de posiciones
const POSITIONS_ALIASES: Record<string, string[]> = {
  fundId:           ['IIC', 'Código IIC', 'Cod IIC', 'COD_IIC', 'Fondo'],
  ticker:           ['Ticker Instrumento', 'Ticker Instru', 'Ticker', 'TICKER'],
  issuerCode:       ['Código Emisora', 'Código Emis', 'Cod. Emisor', 'Codigo Emisora', 'COD_EMISOR'],
  name:             ['Nombre Activo', 'Nombre', 'Descripción', 'Descripcion', 'NOMBRE'],
  isin:             ['ISIN', 'Cod. ISIN', 'Código ISIN', 'Codigo ISIN'],
  quantity:         ['Títulos', 'Titulos', 'Cantidad', 'TITULOS', 'Núm. Títulos'],
  lastPrice:        ['Precio', 'Precio Cierre', 'PRECIO', 'Último Precio'],
  marketValue:      ['Riesgo€', 'Riesgo EUR', 'Riesgo', 'Valor Mercado', 'VM EUR'],
  currency:         ['Moneda', 'Divisa', 'MONEDA'],
  exchangeRate:     ['Cambio', 'Tipo Cambio', 'FX', 'CAMBIO', 'Tipo de Cambio'],
  typology:         ['Tipología', 'Tipologia', 'Tipo Activo', 'Tipo', 'Clase', 'TIPOLOGIA'],
  derivativeType:   ['Tipo Der', 'Tipo Derivado', 'TIPO_DER', 'TipoDer'],
  multiplier:       ['Multi', 'Multiplicador', 'Mult.', 'MULTI'],
  rating:           ['Rating', 'Calificación', 'Calificacion', 'RATING'],
  nominal:          ['Nominal', 'NOM', 'Valor Nominal', 'NOMINAL'],
};

// Diccionario de aliases para archivo de datos oficiales
const OFFICIAL_ALIASES: Record<string, string[]> = {
  fundId:               ['IIC', 'Código IIC', 'Cod IIC', 'COD_IIC'],
  name:                 ['Nombre Cartera', 'Nombre Fondo', 'Nombre', 'NOMBRE', 'Denominación'],
  aum:                  ['Patrimonio', 'AUM', 'Patrimonio Total', 'PATRIMONIO', 'Patrimonio Neto'],
  cash:                 ['Liquidez', 'Tesorería', 'Tesoreria', 'Cash', 'CASH', 'Liquidez EUR', 'Efectivo'],
  equityExposure:       ['Exposición RV', 'Exposicion RV', 'Exp. RV', 'RV%', '% RV', 'Renta Variable', 'Exp RV'],
  derivativeCommitment: ['Compromiso Derivados', 'Comp. Der', '% Derivados', 'Derivados%', 'Compromiso Der'],
  valuationDate:        ['Fecha', 'Fecha Valoración', 'Fecha Valoracion', 'Fecha Valor', 'DATE'],
};

function normalizeStr(s: string): string {
  return s.trim().toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Busca en headers el primero que coincida con algún alias
// Nivel 1: exacto | Nivel 2: case-insensitive | Nivel 3: sin acentos
function findHeader(aliases: string[], headers: string[]): string {
  // Nivel 1: exacto
  for (const alias of aliases) {
    if (headers.includes(alias)) return alias;
  }
  // Nivel 2: case-insensitive
  for (const alias of aliases) {
    const found = headers.find(h => h.toLowerCase() === alias.toLowerCase());
    if (found) return found;
  }
  // Nivel 3: sin acentos
  for (const alias of aliases) {
    const normAlias = normalizeStr(alias);
    const found = headers.find(h => normalizeStr(h) === normAlias);
    if (found) return found;
  }
  return ''; // no encontrado — parseNumeric/getRowValue lo maneja como undefined
}

// Función principal exportada — misma forma de respuesta que la Edge Function
export function mapExcelColumns(
  posHeaders: string[],
  offHeaders: string[]
): { positionsMapping: Record<string, string>; officialMapping: Record<string, string> } {
  const positionsMapping: Record<string, string> = {};
  for (const [field, aliases] of Object.entries(POSITIONS_ALIASES)) {
    positionsMapping[field] = findHeader(aliases, posHeaders);
  }

  const officialMapping: Record<string, string> = {};
  for (const [field, aliases] of Object.entries(OFFICIAL_ALIASES)) {
    officialMapping[field] = findHeader(aliases, offHeaders);
  }

  return { positionsMapping, officialMapping };
}
