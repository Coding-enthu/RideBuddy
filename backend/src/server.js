require("dotenv").config();
const app = require("./app");
const pool = require("./config/db.js");

const PORT = process.env.PORT || 5000;

console.log("hello: ", process.env.DATABASE_URL);

pool.connect()
	.then(() => {
		console.log("Connected to Neon DB ✅");

		app.listen(PORT, () => {
			console.log(`Server running on port ${PORT}`);
			console.log(`API endpoint: http://localhost:${PORT}`);
		});
	})
	.catch((err) => {
		console.error("DB connection failed ❌", err);
	});
