// Loader
const loader = {
	info: (t) => $("#loading-text").text(t),
	start: () => $("#preloader").css('width', '0%'),
	update: (i, j) => $("#preloader").css('width', Math.round(100 * (i+1)/j) + '%'),
	show: () => $("#loading").removeClass("hidden"),
	hide: () => $("#loading").addClass("hidden")
}

function invalid (state, i) {
	if (state.invalids == 0) {
		$("#invalids").append("<b>The following handles were not found:</b><br>")
	}

	state.invalids++
	$("#invalids").append(state.handles[i]+"<br>")
	state.handles.splice(i,1)
	loader.update(i, state.handles.length)
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

function processContests (state) {
	let result = []

	for (let handle in state.users) {
		if ("scores" in state.users[handle]) {
			let scores = state.users[handle].scores
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

			result.push(user)
		}
	}

	result.sort((a, b) => {
		if (a.grade != "SR" && b.grade == "SR") return -1
		if (a.grade == "SR" && b.grade != "SR") return  1
		if (a.score != b.score) return b.score - a.score
		if (a.n != b.n) return b.n - a.n
		return 0
	})

	return result
}

function computeScores_CF (state, rows) {
    each(rows, (row) => {
        const score = reduce(row.problemResults, (s, k) => (s + k.points), 0)
        const handle = row.party.members[0].handle
        state.users[handle].scores.push(score)
    });
}

function computeScores_ICPC (state, rows) {
    each(rows, (row) => {
        const score = 0
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
        state.users[handle].scores.push(score)
    })
} 

function computeScores (state, type, rows) {
    if (type === "CF") {
        computeScores_CF(state, rows)
    } else if (type === "ICPC") {
        computeScores_ICPC(state, rows)
    }
}

function requestContests (state, i = 0) {
	if (i >= state.contests.length) {
		const results = processContests(state)
		showResults(results)
		return
	}	
  
	$.ajax({
		crossDomain: true,
		url: "https://codeforces.com/api/contest.standings?contestId="+state.contests[i]+"&handles="+state.handlesStr,
		error: (res) => {
			console.log("Error! Response: ")
			console.log(res)
		},
		success: (res) => {
			loader.update(i, state.contests.length)
			computeScores(state, res.result.contest.type, res.result.rows)
			requestContests(state, i+1)
		}
	})
}

// Filter all contest received to get only their ids
function filterContests (state) {
	state.contests = filter(state.contests, c => (c.ratingUpdateTimeSeconds >= state.start) && (c.ratingUpdateTimeSeconds <= state.finish))
	state.contests = map(state.contests, c => c.contestId) // we only need the contest id
	state.contests = unique(state.contests)
}

// Init user
function initUsers (state) {
    each(state.handles, (handle) => state.users[handle] = { score: [] })
}

function initRequestContests (state) {
	loader.start()
	loader.info("Requesting contests...")

	state.handlesStr = state.handles.join(";")

	if (state.handlesStr != "") {
		requestContests(state)	
	}
}

// Get rating changes for each user
// With that get all the contest each participated
function requestUsers (state, i = 0) {
	if (i >= state.handles.length) {
		filterContests(state)
		initUsers(state)
		initRequestContests(state)
		return
	}

	$.ajax({
		crossDomain: true,
		url: "https://codeforces.com/api/user.rating?handle=" + state.handles[i],
		error:   (res) => {
			invalid(state, i)
		},
		success: (res) => {
			loader.update(i, state.handles.length)

			// fix handle (search in case insensitive)
			state.handles[i] = empty(res.result) ? state.handles[i] : res.result[0].handle

			// add to the contests
			state.contests = concat(state.contests, res.result)

			// call for next user
			requestUsers(state, i+1)
		}
	})
}

function initRequestUsers (state) {
	loader.start()
	loader.info("Requesting users...")
	loader.show()

	requestUsers(state)	
}

function validateState (state) {
    if (state.handles && state.handles.length) {
        return true;
    } 

    console.log("No valid handles given!");

    return false;
}

function fillState (state) {
	// get time
	// let f = $('#first_day').datepicker().pickadate() // init datepicker
	// let l = $('#last_day').datepicker().pickadate() // init datepicker
	// l.set('select', '10-04-2016', { format: 'dd-mm-yyyy' })
	// console.log(state.start.pickadate().get())
	// console.log($("#start").val())

	let aux = $("#handles").val().split("\n")

	aux = map(aux, a => a.trim().toLowerCase())
	aux = filter(aux, h => h.length)
	aux = unique(aux)

	state.handles = aux
	state.invalids = 0
    state.start = new Date($("#start").val()).getTime()/1000
	state.finish = new Date($("#finish").val()).getTime()/1000 + 86400
	state.rounds = $("#rounds").val()
}

function init () {
	let resultsTable = $("#results-rows")

    resultsTable.html('')
}

// Prepare data for requesting codeforces
function compute () {
	let state = {}

    init()
	fillState(state)
    if (validateState(state)) {
	    initRequestUsers(state)
    }
}

// Prepare DOM letiable and init computation
$(document).ready(() => {
	// state.start = $('#first_day').datepicker()
	// state.finish = $('#last_day').datepicker()

	$("#init").click(compute)
})
