/**
 * Address fields for a point, shaped like the address form. Fields the
 * provider doesn't know are empty strings; the user completes them.
 */
export class ReverseGeocodeResponseDto {
  line1!: string;
  line2!: string;
  city!: string;
  state!: string;
  /** 6-digit PIN code, or "" when the provider has none. */
  postalCode!: string;
  country!: string;
  /** The requested point (not snapped to the matched address). */
  latitude!: number;
  longitude!: number;
  /** One-line address, for display. */
  formatted!: string;
}
