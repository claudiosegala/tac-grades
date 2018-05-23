let html = {}
let data = {}

const min = (a, b) => {
	return a > b ? b : a;
};

// Update the handle bar percentage
const updHandlesBar = () => {
	handles_cnt++;
	var percentage = Math.round(100 * min(handles_cnt/handles.length, 1));

	html.handlesPercentage.textContent = percentage;
};

const toggleVisibility = (x) => {
	const isCurrentlyNone = (x.style.display === "none" || x.style.display === "")
	x.style.display = isCurrentlyNone ? "block" : "none"
}

function invalid(i) {
	if (invalids == 0) {
		$("#invalids").append("<b>The following handles were not found:</b><br>");
	}

	invalids++;
	$("#invalids").append(handles[i]+"<br>");
	handles.splice(i,1);
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

function request_contest(i) {
	if (i >= contests.length) { // stop recursion
		// update view
		var result = [];
		var rounds = $("#rounds").val();

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

				let hasEnoughRounds = user.n_rounds >= rounds

				if (hasEnoughRounds) {
					for (var j = 0; j < rounds; j++) user.score += scores[j];
					user.score /= rounds;
					user.score = Math.round(user.score);
				}

				user.grade = calculateGrade(user.score);

				result.push(user);
			}
		}

		result.sort((a, b) => {
			if (a.grade != "SR" && b.grade == "SR") return -1;
			if (a.grade == "SR" && b.grade != "SR") return  1;
			if (a.score != b.score) return b.score - a.score;
			if (a.n != b.n) return b.n - a.n;
			return 0;
		});

		toggleVisibility(html.loadingHandles)
		toggleVisibility(html.loadingContests)

		$("#results").html("");
		$("#results").append($("<tr><th>#</th><th>Handle</th><th>Competições</th><th>Score</th><th>Menção</th><th>Maiores 5 pontuações</th></tr>"));
		for (var j = 0; j < result.length; j++) {
			$("#results").append($("<tr><td>"+(j+1)+"</td><td>"+result[j].handle+"</td><td>"+result[j].n+"</td><td>"+result[j].score+"</td><td>"+result[j].grade+"</td><td>"+result[j].scores[0]+" | "+result[j].scores[1]+" | "+result[j].scores[2]+" | "+result[j].scores[3]+" | "+result[j].scores[4]+"</td></tr>"));
		}

		$("#contests").html("100");

		return;
	}	
  
	// call Codeforces method
	$.ajax({
		crossDomain: true,
		url: "http://codeforces.com/api/contest.standings?contestId="+contests[i]+"&handles="+handles,
		error: (res) => {
			console.log("Error! Response: ");
			console.log(res);
		},
		success: function(res) {
			// update view
			$("#contests").html(Math.round(100*(i+1)/contests.length));

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
			
			// call for next contest
			request_contest(i+1);
		}
	});
}

function request_user(i) {
	// stop recursion
	if (i >= handles.length) {
		updHandlesBar();

		// get contest ids
		contests = map(contests, c => c.contestId)
		contests = unique(contests);

		// compute handle list with semicolon and init users object
		tmp = "";
		users = {};
		if (handles.length > 0) {
			tmp += handles[0];
			users[handles[0]] = {scores: []};
		}
		for (var j = 1; j < handles.length; j++) {
			tmp += ";"+handles[j];
			users[handles[j]] = {scores: []};
		}
		handles = tmp;
		if (handles == "") return;
		
		toggleVisibility(html.loadingContests)
		request_contest(0);
		return;
	}

	// call Codeforces method
	$.ajax({
		crossDomain: true,
		url: "http://codeforces.com/api/user.rating?handle=" + handles[i],
		error:   (res) => {
			invalid(i);
		},
		success: (res) => {
			updHandlesBar()

			// fix handle (search in case insensitive)
			handles[i] = empty(res.result) ? handles[i] : res.result[0].handle

			// filter contest and get only the valid ones
			var aux = filter(res.result, r => {
				let time = r.ratingUpdateTimeSeconds;
				return time >= start && time <= finish;
			})

			contests = concat(contests, aux);

			// call for next user
			request_user(i+1)
		}
	})
}

const getUser = (handle) => {
	return $.ajax({
		crossDomain: true,
		url: "http://codeforces.com/api/user.rating?handle=" + handle,
		error: (res) => {
			console.log(res);
		},
		success: (res) => {
			console.log(res);
		}
	})
}

function compute() {
	toggleVisibility(html.loadingHandles)

	// init start time
	start = new Date(html.start.val()).getTime()/1000;
	finish = new Date(html.finish.val()).getTime()/1000 + 86400;

	// init handles
	let aux = html.handles.val().split("\n");

	handles = map(aux, a => a.trim().toLowerCase());
	handles = filter(handles, h => h.length);
	handles = unique(handles);
	handles_cnt = 0;

	invalids = 0; // init invalid handles count

	contests = []; // init contests

	// request_user(0);

	var promises = [] 

	promises = map(handles, handle => getUser(handle))
	Promise.all(promises,(resuls) => () => {
		toggleVisibility(html.loadingHandles)
	})
}

$(document).ready(function() {
	html.start = $("#start")
	html.finish = $("#finish")
	html.handles = $("#handles")
	html.handlesPercentage = document.getElementById('users')
	html.loadingHandles = document.getElementById('loadingHandles')
	html.loadingContests = document.getElementById('loadingContests')
	html.invalidHandles = document.getElementById('invalidHandles')
	html.results = document.getElementById('results')

	$("button").click(compute);
});
