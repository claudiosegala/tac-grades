function invalid(i) {
    if (invalids == 0) $("#invalids").append("<b>The following handles were not found:</b><br>");
    invalids++;
    $("#invalids").append(handles[i]+"<br>");
    handles.splice(i,1);
    handles_cnt++;
    $("#users").html(Math.round(100*handles_cnt/handles_tot));
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
    handles = {};
    var tmp = $("#handles").val().split("\n");
    for (var i = 0; i < tmp.length; i++) {
      tmp[i] = tmp[i].trim().toLowerCase();
      if (tmp[i].length == 0) continue;
      handles[tmp[i]] = "handle";
    }
    var tmp = [];
    for (var handle in handles) if (handles[handle] == "handle") {
      tmp.push(handle); 
    }
    handles = tmp;
    handles_tot = handles.length;
    handles_cnt = 0;
    
    // init invalid handles count
    invalids = 0;
    
    // init contests
    contests = {};
    
    request_user(0);
  }
  
  function request_contest(i) {
    // stop recursion
    if (i >= contests.length) {
      // update view
      var result = [];
      var rounds = $("#rounds").val();
      var scale = $("#scale").val();
      for (var handle in users) if ("scores" in users[handle]) {
        var scores = users[handle].scores;
        scores.sort(function(a,b){return b-a;});
        var tmp = {};
        tmp.handle = handle;
        tmp.n = scores.length;
        tmp.score = 0;
        tmp.scores = scores;
        if (rounds <= tmp.n) {
          for (var j = 0; j < rounds; j++) tmp.score += scores[j];
          tmp.score /= rounds;
          tmp.score = Math.round(tmp.score);
        }
        tmp.grade = 10*tmp.score/scale;
             if (tmp.grade < 0.1) tmp.grade = "SR";
        else if (tmp.grade <   3) tmp.grade = "II";
        else if (tmp.grade <   5) tmp.grade = "MI";
        else if (tmp.grade <   7) tmp.grade = "MM";
        else if (tmp.grade <   9) tmp.grade = "MS";
        else                      tmp.grade = "SS";
        result.push(tmp);
      }
      result.sort(function(a,b) {
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
      console.log(result);  
      $("#contests").html("100");
      return;
    }
    
    // call Codeforces method
    $.ajax({
      crossDomain: true,
      url: "http://codeforces.com/api/contest.standings?contestId="+contests[i]+"&handles="+handles,
      error: function() {
        request_contest(i);
      },
      success: function(response) {
        // call again for this contest
        if (response.status == "FAILED") {
          request_contest(i);
          return;
        }
        
        // update view
        $("#contests").html(Math.round(100*(i+1)/contests.length));
        
        if (response.result.contest.type === "CF") {
            // compute scores
            for (var j = 0; j < response.result.rows.length; j++) {
                var score = 0;
                for (var k = 0; k < response.result.rows[j].problemResults.length; k++) {
                    score += response.result.rows[j].problemResults[k].points;
                }
                var handle = response.result.rows[j].party.members[0].handle;
                console.log(handle + " " + contests[i]);
                users[handle].scores.push(score);
            }
        }
        else if (response.result.contest.type === "ICPC") {
            // compute scores
            for (var j = 0; j < response.result.rows.length; j++) {
                var score = 0;
                for (var k = 0; k < response.result.rows[j].problemResults.length; k++) {
                    if (response.result.rows[j].problemResults[k].points === 0) continue;
                    var bestSubmission = Math.floor(response.result.rows[j].problemResults[k].bestSubmissionTimeSeconds / 60);
                    var rejectedAttempts = response.result.rows[j].problemResults[k].rejectedAttemptCount;
                    var problem_score = 500 * (k+1);
                    var score_when_solved = problem_score * (1 - (0.004) * (bestSubmission));
                    var score_with_penalties = score_when_solved - (50 * rejectedAttempts);
                    var final_score = Math.max(score_with_penalties, problem_score * 0.3);
                    score += final_score;
                }
                var handle = response.result.rows[j].party.members[0].handle;
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
      // update view
      $("#users").html("100");
      
      // compute contest ids
      var tmp = [];
      for (var j in contests) if (contests[j] == "contest") tmp.push(j);
      contests = tmp;
      
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
      url: "http://codeforces.com/api/user.rating?handle="+handles[i],
      error: function(xhr) {
        if (xhr.status == 400) invalid(i);
        request_user(i);
      },
      success: function(response) {
        // call again for this user
        if (response.status == "FAILED") {
          if (response.comment.indexOf("not found") != -1) invalid(i);
          request_user(i);
          return;
        }
        
        // update view
        handles_cnt++;
        $("#users").html(Math.round(100*handles_cnt/handles_tot));
        
        // fix handle
        if (response.result.length > 0) handles[i] = response.result[0].handle;
        
        // compute contests
        for (var j = 0; j < response.result.length; j++) {
          var t = response.result[j].ratingUpdateTimeSeconds;
          if (t < start || finish <= t) continue;
          contests[response.result[j].contestId] = "contest";
        }
        
        // call for next user
        request_user(i+1);
      }
    })
  }
  
  $(document).ready(function() {
    $("button").click(compute);
  });
