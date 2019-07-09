const express = require("express");
const router = express.Router();

//require controllers 
const reportAddController = require('../controllers/report/add.js');
//handling requests
router.post("/add/:id/:type", reportAddController);
router.get("/add/:id",(req, res) => {
	console.log("oki=============");
	res.render("404");
});







module.exports = router;


