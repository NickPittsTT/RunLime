/* global jest */
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// MapLibre is a native view; render its components as plain Views in tests.
jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const passthrough = (name) => {
    const C = ({ children, ...props }) => React.createElement(View, { testID: props.testID ?? `maplibre-${name}` }, children);
    C.displayName = name;
    return C;
  };
  return { Map: passthrough('Map'), Camera: passthrough('Camera'), GeoJSONSource: passthrough('GeoJSONSource'), Layer: passthrough('Layer'), Marker: passthrough('Marker') };
});
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getLastKnownPositionAsync: jest.fn(async () => ({ coords: { latitude: 10.65, longitude: -61.5 } })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 10.65, longitude: -61.5 } })),
}));
