const express = require("express");
const router = express.Router();

const { getRoute } = require("../controllers/route.controller.js");

router.get("/", getRoute);

module.exports = router;