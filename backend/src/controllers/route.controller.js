const routingService = require("../services/routing.service.js");

exports.getRoute = async (req, res) => {
	try {
		// const { from, to } = req.query;

		const from = req.query.from;
		const to = req.query.to;

		console.log("from: ", from);
		console.log("to: ", to);

		if (!from || !to) {
			return res.status(400).json({ error: "from and to required" });
		}

		const route = await routingService.getRoute(from, to);

		res.json(route);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};
