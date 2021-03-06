const Courses = require("../../models/Courses");
const Chapters = require("../../models/Chapters");
const Lectures = require("../../models/Lectures");
const Progress = require("../../models/Progress");


module.exports = async (req, res) => {
    try {

        var courseId = req.params.course;
        var progress = await Progress.findOne({
            where: {
                userId: req.user.id,
                courseId
            }
        });
        if (!progress) {
            return res.render("404");
        }
        var content = await Lectures.findByPk(req.params.lecture);
        if (content.type == "quiz") {
            return res.redirect("/courses/classroom/quiz/" + courseId + "/" + content.chapter);
        }
        if (!content) {
            return res.render("404");
        }
        if (req.params.lecture == progress.lastLecture + 1) {
            await Progress.update({ lastLecture: req.params.lecture }, {
                where: {
                    userId: req.user.id,
                    courseId
                }
            });
        } else if (req.params.lecture > progress.lastLecture) {
            return res.render("404");
        }
        var newProgress = await Progress.findOne({
            where: {
                userId: req.user.id,
                courseId
            }
        });
        var course = await Courses.findByPk(courseId);
        var chaptersList = [];
        var chaps = await Chapters.findAll({ where: { formation: courseId } });
        var firstLecture = {};
        var lastLecture = {};
        for (let i = 0; i < chaps.length; i++) {
            var currentChap = {};
            currentChap.title = chaps[i].title;
            currentChap.id = chaps[i].id;
            var lects = await Lectures.findAll({ where: { chapter: chaps[i].id } });
            var currentLects = [];
            for (let j = 0; j < lects.length; j++) {
                if (i == 0 && j == 0) {
                    firstLecture = lects[j].dataValues;
                }
                if (i == chaps.length - 1 && j == lects.length - 1) {
                    lastLecture = lects[j].dataValues;
                }
                let obj = {};
                obj.id = lects[j].id;
                obj.title = lects[j].title;
                currentLects.push(obj);
            };
            currentChap.lectures = currentLects;
            chaptersList.push(currentChap);
        };
        if (req.params.lecture < firstLecture.id || req.params.lecture > lastLecture.id) {
            return res.render("404");
        }
        if (req.params.lecture == lastLecture.id) {
            await Progress.update({ state: "finished" }, {
                where: {
                    userId: req.user.id,
                    courseId
                }
            });
        }
        let messages = req.flash();
            if (Object.keys(messages).length === 0) {
                messages = undefined;
            }
        res.render("courses.course", {
            messages,
            pageTitle: content.title,
            chaptersList,
            content,
            newProgress,
            courseId,
            lastLecture
        });

    }
    catch (err) {
        console.log(err.message);
        res.redirect("/error");
    }

}