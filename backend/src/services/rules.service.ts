/**
 * Rules Service: Business logic for geofencing, shifts, face comparison, and payroll formulas
 */

// 1. Haversine distance calculator between two lat/lng coordinates in meters
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

// 2. Compare Face Embeddings: calculate Euclidean Distance between two 128-float arrays
// Typically, similarity is (1 - distance). Standard threshold for match is distance <= 0.6 (similarity > 90% equivalent)
export const compareFaceEmbeddings = (
  embedding1: number[],
  embedding2: number[]
): { distance: number; isMatch: boolean; similarityPercentage: number } => {
  if (embedding1.length !== embedding2.length) {
    return { distance: 9.9, isMatch: false, similarityPercentage: 0 };
  }

  let sumSquaredDiffs = 0;
  for (let i = 0; i < embedding1.length; i++) {
    sumSquaredDiffs += Math.pow(embedding1[i] - embedding2[i], 2);
  }

  const distance = Math.sqrt(sumSquaredDiffs);
  // standard threshold is 0.6 for Face Recognition.
  const isMatch = distance <= 0.6;
  
  // Convert distance to standard human-friendly similarity percentage
  // 0 distance = 100%, 0.6 distance = 90%, >1.2 distance = 0%
  let similarityPercentage = 100 - (distance / 1.2) * 100;
  if (similarityPercentage < 0) similarityPercentage = 0;
  if (similarityPercentage > 100) similarityPercentage = 100;

  return {
    distance,
    isMatch,
    similarityPercentage: Math.round(similarityPercentage)
  };
};

// 3. Time converter helper ("09:30" -> minutes since midnight)
export const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// 4. Calculate status of punch based on shift rule config
export const evaluatePunchInStatus = (
  punchInTime: Date,
  shift: {
    startTime: string;
    gracePeriod: number;
    lateAfter: number;
    halfDayAfter: number;
    absentAfter: number;
  }
): { status: string; lateMinutes: number } => {
  const punchMinutes = punchInTime.getHours() * 60 + punchInTime.getMinutes();
  const shiftStartMinutes = timeToMinutes(shift.startTime);

  const lateMinutes = punchMinutes - shiftStartMinutes;

  if (lateMinutes <= shift.gracePeriod) {
    return { status: 'PRESENT', lateMinutes: 0 };
  }

  if (lateMinutes > shift.absentAfter) {
    return { status: 'ABSENT', lateMinutes };
  }

  if (lateMinutes > shift.halfDayAfter) {
    return { status: 'HALFDAY', lateMinutes };
  }

  return { status: 'LATE', lateMinutes };
};
