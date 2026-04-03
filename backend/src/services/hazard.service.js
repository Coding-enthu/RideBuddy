const pool = require("../config/db.js");

exports.createHazard = async ({ type, lat, lng, severity }) => {
	const result = await pool.query(
		`INSERT INTO hazards(type, lat, lng, severity)
        VALUES($1, $2, $3, $4)
        RETURNING *`,
		[type, lat, lng, severity || 1],
	);

	return result.rows[0];
};

exports.getHazards = async ({ minLat, maxLat, minLng, maxLng }) => {
	if (!minLat) {
		const result = await pool.query(`SELECT * FROM hazards ORDER BY id DESC`);
		return result.rows;
	}

	const result = await pool.query(
		`SELECT * FROM hazards
        WHERE lat BETWEEN $1 AND $2
        AND lng BETWEEN $3 AND $4
        ORDER BY id DESC`,
		[minLat, maxLat, minLng, maxLng],
	);

	return result.rows;
};

/**
 * Get hazards within a given radius (meters) of a lat/lng point.
 * Uses the spherical law of cosines approximation directly in SQL.
 */
exports.getNearbyHazards = async (lat, lng, radiusMeters = 500) => {
	const result = await pool.query(
		`SELECT *,
			(6371000 * acos(
				LEAST(1.0, cos(radians($1)) * cos(radians(lat)) * cos(radians(lng) - radians($2))
				+ sin(radians($1)) * sin(radians(lat)))
			)) AS distance_meters
		FROM hazards
		WHERE (6371000 * acos(
			LEAST(1.0, cos(radians($1)) * cos(radians(lat)) * cos(radians(lng) - radians($2))
			+ sin(radians($1)) * sin(radians(lat)))
		)) < $3
		ORDER BY distance_meters ASC`,
		[lat, lng, radiusMeters],
	);

	return result.rows;
};
