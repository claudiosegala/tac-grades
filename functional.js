let html = {}
let data = {}
let state = {}
let users = {}
let handles = {}
let contests = []

// Loader
const infoLoader = (t) => $("#loading-text").text(t)
const initLoader = () => $("#preloader").css('width', '0%')
const updLoader  = (i, j) => $("#preloader").css('width', Math.round(100 * (i+1)/j) + '%')
const showLoader = () => $("#loading").removeClass("hidden")
const hidLoader  = () => $("#loading").addClass("hidden")

const invalid = (i) => {
	if (state.invalids == 0) {
		$("#invalids").append("<b>The following handles were not found:</b><br>")
	}

	state.invalids++
	$("#invalids").append(state.handles[i]+"<br>")
	state.handles.splice(i,1)
	updLoader(i, state.handles.length)
}

// Put the grade in the form of UnB
const calculateGrade = (score) => {
	let s = $("#scale").val()
	let n = (10 * score) / s

	if (n < 1) return "SR"
	if (n < 3) return "II"
	if (n < 5) return "MI"
	if (n < 7) return "MM"
	if (n < 9) return "MS"

	return "SS"
} 

const showResults = (results) => {
	hidLoader()
    
	each(results, (r, i) => {
		let n = "<td>"+(i+1)+"</td>"
		let handle = "<td>"+r.handle+"</td>"
		let n_rounds = "<td>"+r.n_rounds+"</td>"
		let score = "<td>"+r.score+"</td>"
		let grade = "<td>"+r.grade+"</td>"
		let scores = "<td>"+r.scores[0]+" | "+r.scores[1]+" | "+r.scores[2]+" | "+r.scores[3]+" | "+r.scores[4]+"</td>"

		html.resultsTable.append($("<tr>" + n + handle + n_rounds + score + grade + scores + "</tr>"))
	})

	$("#results").removeClass("hidden")
}

const processContests = () => {
	let result = []

	for (let handle in users) {
		if ("scores" in users[handle]) {
			let scores = users[handle].scores
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

const computeScoresCF = (rows) => {
    each(rows, (row) => {
        const score = reduce(row.problemResults, (s, k) => (s + k.points), 0)
        const handle = row.party.members[0].handle
        users[handle].scores.push(score)
    });
}

const computeScoresICPC = (rows) => {
    each(data.rows, (row) => {
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
        users[handle].scores.push(score)
    })
} 

const computeScores = (type, rows) => {
    if (type === "CF") {
        computeScoresCF(rows)
    } else if (type === "ICPC") {
        computeScoresICPC(rows)
    }
}

const request_contests = (_handles, i = 0) => {
	if (_handles == "") return
	if (i >= contests.length) {
		const results = processContests()
		showResults(results)
		return
	}	
  
	$.ajax({
		crossDomain: true,
		url: "https://codeforces.com/api/contest.standings?contestId="+contests[i]+"&handles="+_handles,
		error: (res) => {
			console.log("Error! Response: ")
			console.log(res)
		},
		success: (res) => {
			updLoader(i, contests.length)
			computeScores(res.result.contest.type, res.result.rows)
			request_contests(_handles, i+1)
		}
	})
}

// Filter all contest received to get only their ids
const filterContests = () => {
	contests = filter(contests, c => c.ratingUpdateTimeSeconds >= start && c.ratingUpdateTimeSeconds <= finish)
	contests = map(contests, c => c.contestId) // we only need the contest id
	contests = unique(contests)
}

// Init user
const initUsers = () => {
    each(state.handles, (handle) => users[handle] = { score: [] })
}

const initRequestContests = () => {
	initLoader()
	infoLoader("Requesting contests...")
	request_contests(state.handles.join(";"))
}

// Get rating changes for each user
// With that get all the contest each participated
const request_users = (i = 0) => {
	if (i >= state.handles.length) { // stop recursion and prepare data for requesting contests
		filterContests()
		initUsers()
		initRequestContests()
		return
	}

	$.ajax({
		crossDomain: true,
		url: "https://codeforces.com/api/user.rating?handle=" + state.handles[i],
		error:   (res) => {
			invalid(i)
		},
		success: (res) => {
			updLoader(i, state.handles.length)

			// fix handle (search in case insensitive)
			state.handles[i] = empty(res.result) ? state.handles[i] : res.result[0].handle

			// add to the contests
			contests = concat(contests, res.result)

			// call for next user
			request_users(i+1)
		}
	})
}

const initRequestUsers = () => {
	initLoader()
	infoLoader("Requesting users...")
	showLoader()

	request_users()	
}

const validateState = () => {
    if (state.handles && state.handles.length) {
        return true;
    } 

    console.log("No valid handles given!");

    return false;
}

const fillState = () => {
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

    start = state.start
	finish = state.finish
}

const init = () => {
    resultsTable.html('')
}

// Prepare data for requesting codeforces
const compute = () => {
    init()
	fillState()
    if (validateState()) {
	    initRequestUsers()
    }
}

// Prepare DOM letiable and init computation
$(document).ready(() => {
	// state.start = $('#first_day').datepicker()
	// state.finish = $('#last_day').datepicker()

	html = {
		loading: $("#loading"),
		invalidHandles: document.getElementById('invalidHandles'),
		results: document.getElementById('results'),
        resultsTable: $("#results-rows")
	}

	contests = [] // init contests

	$("#init").click(compute)
})
