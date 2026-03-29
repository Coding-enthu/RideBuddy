const express = require("express");
const cors = require("cors");

const hazardRoutes = require("./routes/hazard.routes.js");
const routeRoutes = require("./routes/route.routes.js");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/hazards", hazardRoutes);
app.use("/api/route", routeRoutes);

// test route
app.get("/", (req, res) => {
	res.send("API is running 🚀");
});

module.exports = app;
