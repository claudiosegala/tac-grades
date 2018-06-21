let state = {}
let result = {}

// Loader
const loader = {
	info: (t) => $("#loading-text").text(t),
	start: () => $("#preloader").css('width', '0%'),
	update: (i, j) => $("#preloader").css('width', Math.round(100 * (i+1)/j) + '%'),
	show: () => $("#loading").removeClass("hidden"),
	hide: () => $("#loading").addClass("hidden")
}

function invalidHandle (handle) {
	if (result.invalidHandles.length == 0) {
		$("#invalidHandles").append("<b>The following handles were not found:</b><br>")
	}

	result.invalidHandles.push(handle)
	$("#invalidHandles").append(handle+"<br>")
}

// Put the grade in the form of UnB
function calculateGrade (score) {
	let s = $("#scale").val()
	let n = (10 * score) / s

	if (n < 1) return "SR"
	if (n < 3) return "II"
	if (n < 5) return "MI"
	if (n < 7) return "MM"
	if (n < 9) return "MS"

	return "SS"
} 

function showResults (results) {
	loader.hide()


	let resultsTable = $("#results-rows")
	
	each(results, (r, i) => {
		let n = "<td>"+(i+1)+"</td>"
		let handle = "<td>"+r.handle+"</td>"
		let n_rounds = "<td>"+r.n_rounds+"</td>"
		let score = "<td>"+r.score+"</td>"
		let grade = "<td>"+r.grade+"</td>"
		let scores = "<td>"+r.scores[0]+" | "+r.scores[1]+" | "+r.scores[2]+" | "+r.scores[3]+" | "+r.scores[4]+"</td>"

		resultsTable.append($("<tr>" + n + handle + n_rounds + score + grade + scores + "</tr>"))
	})

	$("#results").removeClass("hidden")
}

function processContests () {
	let res = []

	for (let handle in result.users) {
		if ("scores" in result.users[handle]) {
			let scores = result.users[handle].scores
			scores.sort((a, b) => (b - a))

			let user = {
				handle:   handle,
				n_rounds: scores.length,
				score:    0,
				scores:   scores	
			}

			const hasEnoughRounds = user.n_rounds >= state.rounds

			if (hasEnoughRounds) {
				for (let j = 0; j < state.rounds; j++) {
					user.score += scores[j]
				}
				user.score /= state.rounds
				user.score = Math.round(user.score)
			}

			user.grade = calculateGrade(user.score)

			res.push(user)
		}
	}

	res.sort((a, b) => {
		if (a.grade != "SR" && b.grade == "SR") return -1
		if (a.grade == "SR" && b.grade != "SR") return  1
		if (a.score != b.score) return b.score - a.score
		if (a.n != b.n) return b.n - a.n
		return 0
	})

	return res
}

function computeScores_CF (rows) {
	each(rows, (row) => {
		const score = reduce(row.problemResults, (s, k) => (s + k.points), 0)
		const handle = row.party.members[0].handle
		console.log(result.users[handle])
		result.users[handle].scores.push(score)
	});
}

function computeScores_ICPC (rows) {
	each(rows, (row) => {
		let score = 0

		row.problemResults = filter(row.problemResults, (res) => (res.points !== 0))

		each(row.problemResults, (res, i) => {
			let bestSubmission = Math.floor(res.bestSubmissionTimeSeconds / 60)
			let rejectedAttempts = res.rejectedAttemptCount
			let problem_score = 500 * (i+1)
			let score_when_solved = problem_score * (1 - (0.004) * (bestSubmission))
			let score_with_penalties = score_when_solved - (50 * rejectedAttempts)
			let final_score = Math.max(score_with_penalties, problem_score * 0.3)
			score += final_score
		})

		const handle = row.party.members[0].handle
		result.users[handle].scores.push(score)
	})
} 

function computeScores (type, rows) {
	if (type === "CF") {
		computeScores_CF(rows)
	} else if (type === "ICPC") {
		computeScores_ICPC(rows)
	}
}

function requestContests (i = 0) {
	if (i >= result.contests.length) {
		const results = processContests()
		showResults(results)
		return
	}	
  
	$.ajax({
		crossDomain: true,
		url: "https://codeforces.com/api/contest.standings?contestId="+result.contests[i]+"&handles="+result.handlesStr,
		error: (res) => {
			console.log("Error! Response: " + res)
		},
		success: (res) => {
			loader.update(i, result.contests.length)
			computeScores(res.result.contest.type, res.result.rows)
			requestContests(i+1)
		}
	})
}

function initRequestContests () {
	loader.start()
	loader.info("Requesting contests...")

	result.handlesStr = result.handles.join(";")

	if (result.handlesStr != "") {
		requestContests()	
	}
}

// Init user
function initUsers () {
	each(result.handles, (handle) => result.users[handle] = { scores: [] })
}

// Filter all contest received to get only their ids
function filterContests () {
	result.contests = filter(result.contests, c => (c.ratingUpdateTimeSeconds >= state.startTime) && (c.ratingUpdateTimeSeconds <= state.finishTime))

	if (!state.enableDiv1) {
		result.contests = filter(result.contests, c => c.contestName.toLowerCase().search("div. 1") == -1)
	}

	if (!state.enableDiv2) {
		result.contests = filter(result.contests, c => c.contestName.toLowerCase().search("div. 2") == -1)
	}

	// if (!(state.enableDiv1 && state.enableDiv2)) {
	// 	result.contests = filter(result.contests, c => c.contestName.toLowerCase().search("div.") != -1)
	// }

	if (!state.enableDiv3) {
		result.contests = filter(result.contests, c => c.contestName.toLowerCase().search("div. 3") == -1)
	}

	console.log(result.contests)
	
	result.contests = map(result.contests, c => c.contestId) // we only need the contest id
	result.contests = unique(result.contests)
}

// Get rating changes for each user
// With that get all the contest each participated
// TODO: see how it behaves with invalid handle
function requestUsers (i = 0) {
	if (i >= state.handles.length) {
		filterContests()
		initUsers()
		initRequestContests()
		return
	}

	$.ajax({
		crossDomain: true,
		url: "https://codeforces.com/api/user.rating?handle=" + state.handles[i],
		error:   (res) => {
			loader.update(i, state.handles.length)

			invalidHandle(state.handles[i])

			requestUsers(i+1)
		},
		success: (res) => {
			const contests = res.result;

			loader.update(i, state.handles.length)

			const handle = empty(contests) ? state.handles[i] : contests[0].handle
			result.handles.push(handle); // get handles correct (search is case insensitive)

			result.contests = concat(result.contests, contests)

			requestUsers(i+1)
		}
	})
}

function initRequestUsers () {
	loader.start()
	loader.info("Requesting users...")
	loader.show()

	requestUsers()	
}

function validateState () {
	if (state.handles && state.handles.length) {
		return true;
	} 

	console.log("No valid handles given!"); // TODO: give an alert to user

	return false;
}

function getState () {
	// get time
	// let f = $('#first_day').datepicker().pickadate() // init datepicker
	// let l = $('#last_day').datepicker().pickadate() // init datepicker
	// l.set('select', '10-04-2016', { format: 'dd-mm-yyyy' })
	// console.log(state.startTime.pickadate().get())
	// console.log($("#start").val())

	let aux = $("#handles").val().split("\n")

	aux = map(aux, a => a.trim().toLowerCase())
	aux = filter(aux, h => h.length)
	aux = unique(aux)

	state.enableDiv1 = $('#div1').prop('checked')
	state.enableDiv2 = $('#div2').prop('checked')
	state.enableDiv3 = $('#div3').prop('checked')
	state.handles = aux
	state.startTime = new Date($("#start").val()).getTime()/1000
	state.finishTime = new Date($("#finish").val()).getTime()/1000 + 86400
	state.rounds = $("#rounds").val()
}

// prepare the result object
function init () {
	$("#results-rows").html('')

	result = {
		contests: [],
		users: {},
		handles: [],
		handlesStr: "",
		invalidHandles: []
	}
}

// Prepare data for requesting codeforces
function compute () {
	init()
	getState()

	if (validateState()) {
		initRequestUsers()
	}
}

// Prepare DOM letiable and init computation
$(document).ready(() => {
	// state.startTime = $('#first_day').datepicker()
	// state.finishTime = $('#last_day').datepicker()

	$("#init").click(compute)
})
