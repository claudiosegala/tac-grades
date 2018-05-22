const min = (a, b) => {
	return a > b ? b : a;
};

// Update the handle bar percentage
const updHandlesBar = () => {
	handles_cnt++;
	var percentage = Math.round(100 * min(handles_cnt/handles.length, 1));
	$("#users").html(percentage);
};

function invalid(i) {
	if (invalids == 0) {
		$("#invalids").append("<b>The following handles were not found:</b><br>");
	}

	invalids++;
	$("#invalids").append(handles[i]+"<br>");
	handles.splice(i,1);
	updHandlesBar()
}

function request_contest(i) {
	if (i >= contests.length) { // stop recursion
		// update view
		var result = [];
		var rounds = $("#rounds").val();
		var scale = $("#scale").val();

		for (var handle in users) if ("scores" in users[handle]) {
			var scores = users[handle].scores;
			scores.sort((a, b) => (b - a));

			var tmp = {
				handle: handle,
				n:      scores.length,
				score:  0,
				scores: scores	
			};

			if (rounds <= tmp.n) {
				for (var j = 0; j < rounds; j++) tmp.score += scores[j];
				tmp.score /= rounds;
				tmp.score = Math.round(tmp.score);
			}

			tmp.grade = 10*tmp.score/scale;

			if (tmp.grade < 0.1)    tmp.grade = "SR";
			else if (tmp.grade < 3) tmp.grade = "II";
			else if (tmp.grade < 5) tmp.grade = "MI";
			else if (tmp.grade < 7) tmp.grade = "MM";
			else if (tmp.grade < 9) tmp.grade = "MS";
			else                    tmp.grade = "SS";

			result.push(tmp);
		}

		result.sort((a, b) => {
			if (a.grade != "SR" && b.grade == "SR") return -1;
			if (a.grade == "SR" && b.grade != "SR") return  1;
			if (a.score != b.score) return b.score - a.score;
			if (a.n != b.n) return b.n - a.n;
			return 0;
		});

		$("#result").html("");
		$("#result").append($("<tr><th>#</th><th>Handle</th><th>Competições</th><th>Score</th><th>Menção</th><th>Maiores 5 pontuações</th></tr>"));
		for (var j = 0; j < result.length; j++) {
			$("#result").append($("<tr><td>"+(j+1)+"</td><td>"+result[j].handle+"</td><td>"+result[j].n+"</td><td>"+result[j].score+"</td><td>"+result[j].grade+"</td><td>"+result[j].scores[0]+" | "+result[j].scores[1]+" | "+result[j].scores[2]+" | "+result[j].scores[3]+" | "+result[j].scores[4]+"</td></tr>"));
		}

		$("#contests").html("100");
	}	
  
	// call Codeforces method
	$.ajax({
		crossDomain: true,
		url: "http://codeforces.com/api/contest.standings?contestId="+contests[i]+"&handles="+handles,
		error: (res) => {
			console.log("Error! Response: " + res);
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

function compute() {
	// update view
	$("#msg1").html("Requisitando usuários: <span id=\"users\">0</span>%");
	$("#msg2").html("Requisitando competições: <span id=\"contests\">0</span>%");
	$("#invalids").html("");
	$("#result").html("");

	// init start time
	start = new Date($("#start").val()).getTime()/1000;
	finish = new Date($("#finish").val()).getTime()/1000 + 86400;

	// init handles
	let aux = $("#handles").val().split("\n");

	handles = map(aux, a => a.trim().toLowerCase());
	handles = filter(handles, h => h.length);
	handles = unique(handles);
	handles_cnt = 0;

	invalids = 0; // init invalid handles count

	contests = []; // init contests

	request_user(0);
}

$(document).ready(function() {
	$("button").click(compute);
});
