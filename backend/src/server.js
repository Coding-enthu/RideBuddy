require("dotenv").config();
const app = require("./app");
const pool = require("./config/db.js");

const PORT = process.env.PORT || 5000;

// Start server immediately — don't block on DB connection
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT} 🚀`);
	console.log(`API endpoint: http://localhost:${PORT}`);
});

// Test DB connection separately (soft fail — Neon may drop idle connections)
pool.connect()
	.then((client) => {
		console.log("Connected to Neon DB ✅");
		client.release();
	})
	.catch((err) => {
		console.warn("DB connection warning (will retry on demand):", err.message);
	});
