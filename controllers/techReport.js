const Report = require("../models/Report");
const UsersInfo = require("../models/UsersInfo");

module.exports = async (req, res) => {
	try {
    let temp = await UsersInfo.findOne({where : {userId : req.user.id}});
	let username = temp.dataValues.username;
    await Report.create({
    	username,
    	indictedType :"tech",
    	type : req.body.title,
    	indictedId:0,
    	indicted: "tech",
    	reportDetails : req.body.description

    } );
    }catch(err){
    console.log(err);    
    res.redirect("/");
    }
}