let html = {}
let data = {}
let state = {}
let users = {}
let handles = {}

const min = (a, b) => {
	return a > b ? b : a;
};

// Update the handle bar percentage
const updHandlesBar = (i) => html.handlesPercentage.textContent = Math.round(100 * (i+1)/state.handles.length)

// Update the contest bar percentage
const updContestsBar = (i) => html.contestsPercentage.textContent = Math.round(100 * (i+1)/contests.length)

// Hid if shown and show if hidden
const toggleVisibility = (x) => {
	const isCurrentlyNone = (x.style.display === "none" || x.style.display === "")
	x.style.display = isCurrentlyNone ? "block" : "none"
}

function invalid(i) {
	if (invalids == 0) {
		$("#invalids").append("<b>The following handles were not found:</b><br>");
	}

	invalids++;
	$("#invalids").append(state.handles[i]+"<br>");
	state.handles.splice(i,1);
	updHandlesBar()
}

const calculateGrade = (score) => {
	var s = $("#scale").val()
	let n = (10 * score) / s

	if (n < 1) return "SR";
	if (n < 3) return "II";
	if (n < 5) return "MI";
	if (n < 7) return "MM";
	if (n < 9) return "MS";

	return "SS";
} 

const showResults = (results) => {
	var resultsTable = $("#results")
	resultsTable.html("");
	resultsTable.append($("<tr><th>#</th><th>Handle</th><th>Competições</th><th>Score</th><th>Menção</th><th>Maiores 5 pontuações</th></tr>"));
	each(results, (r, i) => {
		let n = "<td>"+i+1+"</td>"
		let handle = "<td>"+r.handle+"</td>"
		let n_rounds = "<td>"+r.n_rounds+"</td>"
		let score = "<td>"+r.score+"</td>"
		let grade = "<td>"+r.grade+"</td>"
		let scores = "<td>"+r.scores[0]+" | "+r.scores[1]+" | "+r.scores[2]+" | "+r.scores[3]+" | "+r.scores[4]+"</td>"
		resultsTable.append($("<tr>" + n + handle + n_rounds + score + grade + scores + "</tr>"));
	})
}

function request_contests(_handles, i = 0) {
	if (_handles == "") return;
	if (i >= contests.length) {
		var result = [];

		for (var handle in users) {
			if ("scores" in users[handle]) {
				var scores = users[handle].scores;
				scores.sort((a, b) => (b - a));

				var user = {
					handle:   handle,
					n_rounds: scores.length,
					score:    0,
					scores:   scores	
				};

				let hasEnoughRounds = user.n_rounds >= state.rounds

				if (hasEnoughRounds) {
					for (var j = 0; j < state.rounds; j++) {
						user.score += scores[j];
					}
					user.score /= state.rounds;
					user.score = Math.round(user.score);
				}

				user.grade = calculateGrade(user.score);

				result.push(user);
			}
		}

		toggleVisibility(html.loadingHandles)
		toggleVisibility(html.loadingContests)

		result.sort((a, b) => {
			if (a.grade != "SR" && b.grade == "SR") return -1;
			if (a.grade == "SR" && b.grade != "SR") return  1;
			if (a.score != b.score) return b.score - a.score;
			if (a.n != b.n) return b.n - a.n;
			return 0;
		});

		showResults(result)

		return
	}	
  
	$.ajax({
		crossDomain: true,
		url: "https://codeforces.com/api/contest.standings?contestId="+contests[i]+"&handles="+_handles,
		error: (res) => {
			console.log("Error! Response: ");
			console.log(res);
		},
		success: function(res) {
			updContestsBar(i)

			let data = res.result
			
			if (data.contest.type === "CF") {
				// compute scores
				for (var j = 0; j < data.rows.length; j++) {
					var score = 0;
					for (var k = 0; k < data.rows[j].problemResults.length; k++) {
						score += data.rows[j].problemResults[k].points;
					}
					var handle = data.rows[j].party.members[0].handle;
					users[handle].scores.push(score);
				}
			} else if (data.contest.type === "ICPC") {
				// compute scores
				for (var j = 0; j < data.rows.length; j++) {
					var score = 0;
					for (var k = 0; k < data.rows[j].problemResults.length; k++) {
						if (data.rows[j].problemResults[k].points === 0) continue;
						var bestSubmission = Math.floor(data.rows[j].problemResults[k].bestSubmissionTimeSeconds / 60);
						var rejectedAttempts = data.rows[j].problemResults[k].rejectedAttemptCount;
						var problem_score = 500 * (k+1);
						var score_when_solved = problem_score * (1 - (0.004) * (bestSubmission));
						var score_with_penalties = score_when_solved - (50 * rejectedAttempts);
						var final_score = Math.max(score_with_penalties, problem_score * 0.3);
						score += final_score;
					}
					var handle = data.rows[j].party.members[0].handle;
					users[handle].scores.push(score);
				}
			}
			
			request_contests(_handles, i+1);
		}
	});
}

// Filter all contest received to get only their ids
const filterContests = () => {
	contests = filter(contests, c => c.ratingUpdateTimeSeconds >= start && c.ratingUpdateTimeSeconds <= finish)
	contests = map(contests, c => c.contestId) // we only need the contest id
	contests = unique(contests);
}

// Init user
const initUsers = () => {
	for (var j = 0; j < state.handles.length; j++) {
		users[state.handles[j]] = {scores: []};
	}
}

// Get rating changes for each user
// With that get all the contest each participated
function request_users (i = 0) {
	if (i >= state.handles.length) { // stop recursion and prepare data for requesting contests
		filterContests()

		initUsers()

		toggleVisibility(html.loadingContests)

		request_contests(state.handles.join(";"))
		
		return;
	}

	$.ajax({
		crossDomain: true,
		url: "https://codeforces.com/api/user.rating?handle=" + state.handles[i],
		error:   (res) => {
			invalid(i);
		},
		success: (res) => {
			updHandlesBar(i)

			// fix handle (search in case insensitive)
			state.handles[i] = empty(res.result) ? state.handles[i] : res.result[0].handle

			// add to the contests
			contests = concat(contests, res.result);

			// call for next user
			request_users(i+1)
		}
	})
}

// Prepare data for requesting codeforces
function compute() {
	state.start = new Date($("#start").val()).getTime()/1000;
	state.finish = new Date($("#finish").val()).getTime()/1000 + 86400;
	state.rounds = $("#rounds").val()

	start = state.start
	finish = state.finish

	let aux = $("#handles").val().split("\n")

	aux = map(aux, a => a.trim().toLowerCase())
	aux = filter(aux, h => h.length)
	aux = unique(aux)

	state.handles = aux
	
	handles_cnt = 0;
	invalids = 0; // init invalid handles count
	contests = []; // init contests

	toggleVisibility(html.loadingHandles)

	request_users();
}

// Prepare DOM variable and init computation
$(document).ready(function() {
	html = {
		handlesPercentage: document.getElementById('users'),
		contestsPercentage: document.getElementById('contests'),
		loadingHandles: document.getElementById('loadingHandles'),
		loadingContests: document.getElementById('loadingContests'),
		invalidHandles: document.getElementById('invalidHandles'),
		results: document.getElementById('results')
	}

	$("button").click(compute);
});
