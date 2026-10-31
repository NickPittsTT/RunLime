import { describe, expect, it } from 'vitest';
import { distanceM, nominatimSearchUrl, parseNominatim, pinFarFromAddress, precisionOf } from '../src/location';

describe('distance (same formula as the database)', () => {
  it('0.002° of latitude ≈ 222 m', () => {
    expect(Math.round(distanceM(10.67, -61.51, 10.672, -61.51))).toBe(222);
  });
});

describe('venue search (Nominatim usage policy)', () => {
  it('builds a search URL limited to the country, 5 results, no type-ahead parameters', () => {
    const u = new URL(nominatimSearchUrl("  Queen's Park Savannah "));
    expect(u.origin).toBe('https://nominatim.openstreetmap.org');
    expect(u.searchParams.get('q')).toBe("Queen's Park Savannah");
    expect(u.searchParams.get('countrycodes')).toBe('tt');
    expect(u.searchParams.get('limit')).toBe('5');
  });
  it('labels precision: a place is exact, a road is street only, a town forces manual placement', () => {
    expect(precisionOf({ category: 'leisure', type: 'park', addresstype: 'leisure' })).toBe('exact');
    expect(precisionOf({ category: 'highway', type: 'primary', addresstype: 'road' })).toBe('street');
    expect(precisionOf({ category: 'place', type: 'town', addresstype: 'town' })).toBe('town');
    expect(precisionOf({ category: 'boundary', type: 'administrative', addresstype: 'city' })).toBe('town');
  });
  it('parses results and drops broken entries', () => {
    const r = parseNominatim([
      { lat: '10.6718', lon: '-61.5146', display_name: "Queen's Park Savannah, Port of Spain", category: 'leisure', type: 'park', addresstype: 'leisure' },
      { lat: 'x', lon: '1', display_name: 'broken' },
    ]);
    expect(r).toEqual([{ label: "Queen's Park Savannah, Port of Spain", lat: 10.6718, lng: -61.5146, precision: 'exact' }]);
    expect(parseNominatim({ error: 'x' })).toEqual([]);
  });
  it('warns when the pin is more than 1 km from the address found', () => {
    expect(pinFarFromAddress({ lat: 10.67, lng: -61.51 }, { lat: 10.68, lng: -61.51 })).toBe(true); // 1.1 km
    expect(pinFarFromAddress({ lat: 10.67, lng: -61.51 }, { lat: 10.675, lng: -61.51 })).toBe(false); // 556 m
  });
});
