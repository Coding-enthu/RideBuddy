const express = require("express");
const router = express.Router();

const {
    createHazard,
    getHazards
} = require("../controllers/hazard.controller.js");

router.post("/", createHazard);
router.get("/", getHazards);

module.exports = router;