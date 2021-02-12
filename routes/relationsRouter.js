const express = require("express");
const router = express.Router({ mergeParams: true });
const Department = require("./../models/departmentModel");
const Course = require("./../models/courseModel");
const Teacher = require("./../models/teacherModel");
const ObjectId = require('mongoose').Types.ObjectId;

function updateCourseDepartmentsHelper(course, department, oldDepartment, callback) {
	if (department !== "") {
		Course.findOneAndUpdate({code: course}, {department}, function(err, updatedCourse) {
			if (err) {
				console.log("ERROR while updating course object!");
				callback(err);
				// Redirect to admin courses with an error message
			}
			else {
				if (oldDepartment !== "") {
					Department.findOneAndUpdate({_id: oldDepartment}, {$pull: {courses: updatedCourse._id}}, function(err, updatedDepartment) {
						if (err) {
							console.log("ERROR while adding course to department!");
							callback(err);
						}
					});
				}
				Department.findOneAndUpdate({_id: department}, {$addToSet: {courses: updatedCourse._id}}, function(err, updatedDepartment) {
					if (err) {
						console.log("ERROR while adding course to department!");
						callback(err);
					}
					else {
						callback();
					}
				});
			}
		});
	}
	else {
		Course.findOneAndUpdate({code: course}, {$unset: {department: ""}}, function(err, updatedCourse) {
			if (err) {
				console.log("ERROR while updating course object!");
				callback(err);
				// Redirect to admin courses with an error message
			}
			else {
				if (oldDepartment !== "") {
					Department.findOneAndUpdate({_id: oldDepartment}, {$pull: {courses: updatedCourse._id}}, function(err, updatedDepartment) {
						if (err) {
							console.log("ERROR while adding course to department!");
							callback(err);
						}
						else {
							callback();
						}
					});
				}
				else {
					callback();
				}
			}
		});
	}
}

// get add course to department
router.get("/assign-courses", function(req, res) {
	Department.find({}, (err, departments) => {
		if (err) {
			console.log(err);
			req.flash("error", "Oops! Something went wrong.");
		}
		else {
			Course.find({}, function(err, courses) {
				if (err) {
					console.log(err);
					req.flash("error", "Oops! Something went wrong.");
				}
				else {
					res.render("relations/department-course", {departments, courses});
				}
			});
		}
	});
});

// get add teacher to course
router.get("/assign-teachers", function(req, res) {
	Course.find({}, (err, departments) => {
		if (err) {
			console.log(err);
			req.flash("error", "Oops! Something went wrong.");
		}
		else {
			Teacher.find({}, function(err, courses) {
				if (err) {
					console.log(err);
					req.flash("error", "Oops! Something went wrong.");
				}
				else {
					res.render("relations/course-teacher", { departments, courses });
				}
			});
		}
	});
});

// put add course to department
router.put("/assign-courses", async function(req, res) {
	const courses = req.body.courses;
	const departments = req.body.departments;
	var oldDepartments = new Array();
	var isValid = true;

	if (courses.length === 0) {
		console.log("ERROR please create courses before attempting to assign them to departments!");
		req.flash("error", "ERROR please create courses before attempting to assign them to departments!");
		res.redirect("/assign-courses");
	}

	else {
		await Promise.all(departments.map(async function(department) {
			if (department) {
				if (await ObjectId.isValid(department)) {
					let foundDepartment = await Department.findOne({_id: department});
					if (foundDepartment === null || foundDepartment === undefined || !foundDepartment) {
						req.flash("error", "Oops! Something went wrong.");
						isValid = false;
					}
				} else {
					isValid = false;
				}
			}
		}));

		if (!isValid) {
			console.log("ERROR in departments submitted!");
			req.flash("error", "ERROR in departments submitted!");
			res.redirect("/assign-courses");
		}

		else {
			await Promise.all(courses.map(async function(course) {
				let foundCourse = await Course.findOne({code: course});
				if (foundCourse === null || foundCourse === undefined || !foundCourse) {
					req.flash("error", "Oops! Something went wrong.");
					isValid = false;
				}
				else {
					if (foundCourse.department === undefined) {
						oldDepartments.push("");
					} else {
						oldDepartments.push(foundCourse.department);
					}
				}
			}));

			if (!isValid) {
				console.log("ERROR in course codes submitted!");
				req.flash("error", "ERROR in course codes submitted!");
				res.redirect("/assign-courses");
			}

			else {
				if (courses.length !== departments.length || courses.length !== oldDepartments.length) {
					console.log("ERROR (array mismatch) while updating course departments!");
					req.flash("error", "ERROR (array mismatch) while updating course departments!");
					res.redirect("/assign-courses");
				}

				else {
					let updateCourseDepartments = courses.map(async function(course, i) {
						await updateCourseDepartmentsHelper(course, departments[i], oldDepartments[i], function(err) {
							if (err) {
								console.log(err);
								req.flash("error", "Oops! Something went wrong.");
							}
						});
					});
					await Promise.all(updateCourseDepartments);
					res.redirect("/assign-courses");
				}
			}
		}
	}
});

// put add teacher to course //same copypasta as above get req
router.put("/teacher/:code", function(req, res) {
  var course = {
    name: req.body.courseName,
    code: req.body.courseCode,
    description: req.body.courseDescription,
    grade: req.body.courseGrade,
    pace: req.body.coursePace,
    department: req.body.courseDepartment,
    prereq: req.body.coursePrerequisites
  };

  // Search for existing courses with the course code to check for duplicates
  Course.find({code: course.code}, function(err, searchResults) {
    if (err) {
			console.log(err);
			req.flash("error", "Oops! Something went wrong.");
    }
    // If no OTHER COURSE results are found, proceed
    else if (!searchResults.length || searchResults[0].code === req.params.code) {
      // Check that the course prerequisites is valid
      checkPrereq(course.prereq, course.code, function(isValid) {
        if (isValid) {
          Department.countDocuments({_id: course.department}, function(err, count) {
            // Remove old course department
            Course.findOneAndUpdate({code: req.params.code}, {$unset: {department: ""}}, function(err, updatedCourse) {
              if (err) {
								console.log("ERROR while updating course object!");
								req.flash("error", "ERROR while updating course object!");
                console.log(err);
                // Redirect to admin courses with an error message
              }
              else {
                if (count === 0 || count === undefined) {
                  delete course.department;
                }
                Course.findOneAndUpdate({code: req.params.code}, course, async function(err, updatedCourse) {
                  if (err) {
										console.log("ERROR while updating course object!");
										req.flash("error", "ERROR while updating course object!");
                    console.log(err);
                    // Redirect to admin courses with an error message
                  }
                  else {
                    if (!(searchResults[0].department === undefined)) {
                      await Department.findOneAndUpdate({_id: searchResults[0].department}, {$pull: {courses: updatedCourse._id}}, function(err, updatedDepartment) {
                        if (err) {
													console.log("ERROR while adding course to department!");
													req.flash("error", "ERROR while adding course to department!");
                          console.log(err);
                        }
                      });
                    }
                    if (!(course.department === undefined)) {
                      await Department.findOneAndUpdate({_id: course.department}, {$addToSet: {courses: updatedCourse._id}}, function(err, updatedDepartment) {
                        if (err) {
													console.log("ERROR while adding course to department!");
													req.flash("error", "ERROR while adding course to department!");
                          console.log(err);
                        }
                      });
                    }
										console.log("Course updated!");
										req.flash("success", "Course updated!");
                    res.redirect("/courses");
                  }
                });
              }
            });
          });
        }
        else {
					console.log("Course prerequisites is not valid.");
					req.flash("error", "Course prerequisites is not valid.");
          let url = "/courses/" + course.code + "/edit";
          res.redirect(url);
          // Redirect to admin courses with an error message
        }
      });
    }
    // If course code already exists, display error message
    else {
			console.log("Course code already exists!");
			req.flash("error", "Course already exists!");
      let url = "/courses/" + course.code + "/edit";
      res.redirect(url);
      // Redirect to admin courses with an error message
    }
  });
});

module.exports = router;
