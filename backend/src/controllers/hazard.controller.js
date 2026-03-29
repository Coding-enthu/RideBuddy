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
