const hazardService = require("../services/hazard.service.js");

exports.createHazard = async (req, res) => {
	try {
		const hazard = await hazardService.createHazard(req.body);
		res.status(201).json(hazard);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

exports.getHazards = async (req, res) => {
	try {
		const hazards = await hazardService.getHazards(req.query);
		res.json(hazards);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

/**
 * GET /api/hazards/nearby?lat=22.57&lng=88.36&radius=500
 */
exports.getNearbyHazards = async (req, res) => {
	try {
		const { lat, lng, radius } = req.query;

		if (!lat || !lng) {
			return res.status(400).json({ error: "lat and lng are required" });
		}

		const radiusMeters = parseFloat(radius) || 500;
		const hazards = await hazardService.getNearbyHazards(
			parseFloat(lat),
			parseFloat(lng),
			radiusMeters,
		);

		res.json(hazards);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};
