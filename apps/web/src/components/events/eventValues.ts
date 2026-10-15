/** Event editor values (plain module: usable from server and client components). */

export interface EventFormValues {
  id?: string;
  listingSource: 'organiser' | 'runlime';
  organisationId?: string;
  name: string;
  description: string;
  startsLocal: string;
  timezone: string;
  regionId: string;
  venueName: string;
  startLat: number | null;
  startLng: number | null;
  registrationUrl: string;
  registrationInstructions: string;
  packageCollection: string;
  parking: string;
  contactEmail: string;
  contactPhone: string;
  cause: string;
  charityName: string;
  walkFriendly: boolean;
  feeMin: number;
  feeMax: number | null;
  route: [number, number][] | null;
  distances: { km: number; label: string }[];
}

export const emptyEvent = (listingSource: 'organiser' | 'runlime', organisationId?: string): EventFormValues => ({
  listingSource,
  organisationId,
  name: '',
  description: '',
  startsLocal: '',
  timezone: 'America/Port_of_Spain',
  regionId: '',
  venueName: '',
  startLat: null,
  startLng: null,
  registrationUrl: '',
  registrationInstructions: '',
  packageCollection: '',
  parking: '',
  contactEmail: '',
  contactPhone: '',
  cause: '',
  charityName: '',
  walkFriendly: false,
  feeMin: 0,
  feeMax: null,
  route: null,
  distances: [{ km: 5, label: '5K' }],
});

