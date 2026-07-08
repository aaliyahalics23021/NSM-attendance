"use strict";
/**
 * Rules Service: Business logic for geofencing, shifts, face comparison, and payroll formulas
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluatePunchInStatus = exports.timeToMinutes = exports.compareFaceEmbeddings = exports.calculateDistance = void 0;
// 1. Haversine distance calculator between two lat/lng coordinates in meters
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) *
            Math.cos(phi2) *
            Math.sin(deltaLambda / 2) *
            Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
};
exports.calculateDistance = calculateDistance;
// 2. Compare Face Embeddings: calculate Euclidean Distance between two 128-float arrays
// Typically, similarity is (1 - distance). Standard threshold for match is distance <= 0.6 (similarity > 90% equivalent)
const compareFaceEmbeddings = (embedding1, embedding2) => {
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
    if (similarityPercentage < 0)
        similarityPercentage = 0;
    if (similarityPercentage > 100)
        similarityPercentage = 100;
    return {
        distance,
        isMatch,
        similarityPercentage: Math.round(similarityPercentage)
    };
};
exports.compareFaceEmbeddings = compareFaceEmbeddings;
// 3. Time converter helper ("09:30" -> minutes since midnight)
const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};
exports.timeToMinutes = timeToMinutes;
// 4. Calculate status of punch based on shift rule config
const evaluatePunchInStatus = (punchInTime, shift) => {
    const punchMinutes = punchInTime.getHours() * 60 + punchInTime.getMinutes();
    const shiftStartMinutes = (0, exports.timeToMinutes)(shift.startTime);
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
exports.evaluatePunchInStatus = evaluatePunchInStatus;
