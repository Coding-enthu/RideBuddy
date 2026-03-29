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
		const result = await pool.query(`SELECT * FROM hazards`);
		return result.rows;
	}

	const result = await pool.query(
		`SELECT * FROM hazards
        WHERE lat BETWEEN $1 AND $2
        AND lng BETWEEN $3 AND $4`,
		[minLat, maxLat, minLng, maxLng],
	);

	return result.rows;
};
