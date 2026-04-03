const axios = require("axios");
const pool = require("../config/db.js");

function haversineDistance(point, hazard) {
	const [lng1, lat1] = point;
	const { lng: lng2, lat: lat2 } = hazard;

	const R = 6371e3;
	const toRad = (deg) => (deg * Math.PI) / 180;

	const φ1 = toRad(lat1);
	const φ2 = toRad(lat2);
	const Δφ = toRad(lat2 - lat1);
	const Δλ = toRad(lng2 - lng1);

	const a =
		Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
		Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

function isNear(point, hazard, threshold = 100) {
	return haversineDistance(point, hazard) < threshold;
}

function getBoundingBox(coords) {
	let minLat = Infinity, maxLat = -Infinity;
	let minLng = Infinity, maxLng = -Infinity;

	coords.forEach(([lng, lat]) => {
		minLat = Math.min(minLat, lat);
		maxLat = Math.max(maxLat, lat);
		minLng = Math.min(minLng, lng);
		maxLng = Math.max(maxLng, lng);
	});

	return { minLat, maxLat, minLng, maxLng };
}

exports.getRoute = async (from, to) => {
	const url = `https://router.project-osrm.org/route/v1/driving/${from};${to}?alternatives=true&overview=full&geometries=geojson`;

	console.log("[routing] OSRM request:", url);

	const response = await axios.get(url);
	const routes = response.data.routes;

	let bestRoute = null;
	let bestScore = Infinity;
	let bestDetails = null;
	let bestHazardsOnRoute = [];

	for (const route of routes) {
		const coords = route.geometry.coordinates;
		const { minLat, maxLat, minLng, maxLng } = getBoundingBox(coords);

		const hazardRes = await pool.query(
			`SELECT * FROM hazards
            WHERE lat BETWEEN $1 AND $2
            AND lng BETWEEN $3 AND $4`,
			[minLat, maxLat, minLng, maxLng],
		);

		const hazards = hazardRes.rows;

		let hazardCount = 0;
		let penalty = 0;
		let typeBreakdown = {};
		const hazardsOnRoute = [];

		hazards.forEach((h) => {
			for (let i = 0; i < coords.length; i += 5) {
				if (isNear(coords[i], h)) {
					// Use severity for penalty (works with existing schema)
					const weight = (h.severity || 1) * 30;
					penalty += weight;
					hazardCount++;
					typeBreakdown[h.type] = (typeBreakdown[h.type] || 0) + 1;

					// Avoid duplicates in hazardsOnRoute
					if (!hazardsOnRoute.find((x) => x.id === h.id)) {
						hazardsOnRoute.push(h);
					}
					break;
				}
			}
		});

		const score = route.duration + penalty;

		if (score < bestScore) {
			bestScore = score;
			bestRoute = route;
			bestHazardsOnRoute = hazardsOnRoute;
			bestDetails = {
				score,
				hazardCount,
				penalty,
				typeBreakdown,
			};
		}
	}

	return {
		bestRoute,
		allRoutes: routes,
		analysis: bestDetails,
		hazardsOnRoute: bestHazardsOnRoute,
	};
};
