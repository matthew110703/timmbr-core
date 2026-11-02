import { TaxRegime } from '@prisma/client';
import { InvoiceInvalidShippingStateException } from '@/common/exceptions/invoice.exception';

export interface GstStateInfo {
  code: string;
  name: string;
}

/**
 * Canonical 2-digit Indian GST State & Union Territory codes (01 to 38).
 */
export const GST_STATES_BY_CODE: Readonly<Record<string, string>> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

/** Normalized lowercase state/UT names and common aliases mapped to 2-digit GST codes. */
const STATE_NAME_TO_CODE: Readonly<Record<string, string>> = {
  'jammu and kashmir': '01',
  'jammu & kashmir': '01',
  jk: '01',
  'himachal pradesh': '02',
  hp: '02',
  punjab: '03',
  pb: '03',
  chandigarh: '04',
  ch: '04',
  uttarakhand: '05',
  uttaranchal: '05',
  uk: '05',
  haryana: '06',
  hr: '06',
  delhi: '07',
  'new delhi': '07',
  'nct of delhi': '07',
  dl: '07',
  rajasthan: '08',
  rj: '08',
  'uttar pradesh': '09',
  up: '09',
  bihar: '10',
  br: '10',
  sikkim: '11',
  sk: '11',
  'arunachal pradesh': '12',
  ar: '12',
  nagaland: '13',
  nl: '13',
  manipur: '14',
  mn: '14',
  mizoram: '15',
  mz: '15',
  tripura: '16',
  tr: '16',
  meghalaya: '17',
  ml: '17',
  assam: '18',
  as: '18',
  'west bengal': '19',
  wb: '19',
  jharkhand: '20',
  jh: '20',
  odisha: '21',
  orissa: '21',
  od: '21',
  or: '21',
  chhattisgarh: '22',
  chhatisgarh: '22',
  cg: '22',
  'madhya pradesh': '23',
  mp: '23',
  gujarat: '24',
  gj: '24',
  'dadra and nagar haveli and daman and diu': '26',
  'dadra and nagar haveli': '26',
  'daman and diu': '26',
  dd: '26',
  dn: '26',
  maharashtra: '27',
  mh: '27',
  karnataka: '29',
  ka: '29',
  goa: '30',
  ga: '30',
  lakshadweep: '31',
  ld: '31',
  kerala: '32',
  kl: '32',
  'tamil nadu': '33',
  tamilnadu: '33',
  tn: '33',
  puducherry: '34',
  pondicherry: '34',
  py: '34',
  'andaman and nicobar islands': '35',
  'andaman & nicobar islands': '35',
  'andaman and nicobar': '35',
  an: '35',
  telangana: '36',
  tg: '36',
  ts: '36',
  'andhra pradesh': '37',
  ap: '37',
  ladakh: '38',
  la: '38',
};

function normalizeStateKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,]/g, '');
}

/**
 * Resolves a state name or 2-digit GST state code to canonical `{ code, name }`.
 * Returns `null` if missing or unrecognized.
 */
export function resolveGstState(rawState?: string | null): GstStateInfo | null {
  if (!rawState || typeof rawState !== 'string') {
    return null;
  }

  const trimmed = rawState.trim();
  if (!trimmed) {
    return null;
  }

  if (/^[0-9]{2}$/.test(trimmed) && GST_STATES_BY_CODE[trimmed]) {
    return { code: trimmed, name: GST_STATES_BY_CODE[trimmed] };
  }

  const normalized = normalizeStateKey(trimmed);
  const code = STATE_NAME_TO_CODE[normalized];
  if (!code || !GST_STATES_BY_CODE[code]) {
    return null;
  }

  return {
    code,
    name: GST_STATES_BY_CODE[code],
  };
}

export interface PlaceOfSupplyResolution {
  sellerStateCode: string;
  sellerStateName: string;
  placeOfSupplyCode: string;
  placeOfSupplyState: string;
  taxRegime: TaxRegime;
}

/**
 * Resolves Place of Supply and TaxRegime strictly from seller state code and shipping destination state.
 * Never falls back to billing state and never guesses an unknown state.
 */
export function resolvePlaceOfSupply(params: {
  sellerStateCode: string;
  sellerStateName?: string;
  shippingState?: string | null;
}): PlaceOfSupplyResolution {
  const sellerInfo = resolveGstState(params.sellerStateCode);
  if (!sellerInfo) {
    throw new InvoiceInvalidShippingStateException(params.sellerStateCode);
  }

  const destinationInfo = resolveGstState(params.shippingState);
  if (!destinationInfo) {
    throw new InvoiceInvalidShippingStateException(params.shippingState);
  }

  const taxRegime =
    sellerInfo.code === destinationInfo.code ? TaxRegime.INTRA_STATE : TaxRegime.INTER_STATE;

  return {
    sellerStateCode: sellerInfo.code,
    sellerStateName: params.sellerStateName?.trim() || sellerInfo.name,
    placeOfSupplyCode: destinationInfo.code,
    placeOfSupplyState: destinationInfo.name,
    taxRegime,
  };
}
