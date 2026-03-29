const axios = require("axios");

exports.getRoute = async (from, to) => {
    console.log("Surprise madafaka 🤯");
	const url = `https://router.project-osrm.org/route/v1/driving/${from};${to}?alternatives=true&overview=full&geometries=geojson`;

    console.log(url);

	const response = await axios.get(url);
	return response.data;
};
