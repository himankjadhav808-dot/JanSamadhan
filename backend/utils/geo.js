const EARTH_RADIUS_METERS = 6371000;
const MAX_RESOLVE_DISTANCE_METERS = 100;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const parseCoordinate = (value, label) => {
  const num = Number(value);
  if (value === undefined || value === null || value === '' || Number.isNaN(num)) {
    return { error: `${label} is required and must be a number` };
  }
  return { value: num };
};

const toGeoPoint = (longitude, latitude) => ({
  type: 'Point',
  coordinates: [longitude, latitude],
});

const haversineMeters = (lng1, lat1, lng2, lat2) => {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
};

module.exports = {
  EARTH_RADIUS_METERS,
  MAX_RESOLVE_DISTANCE_METERS,
  parseCoordinate,
  toGeoPoint,
  haversineMeters,
};
