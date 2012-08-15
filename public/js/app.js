$(document).ready(function(){
    var sock      = null;
    var rv        = null;
    var nickname  = null;
    var textInput = $('#text_input');
    var nicks     = []; //could be an object if later we decide to add the nick attributes (+,... @)
    var webNicks  = []; //web irc users
    var logBox    = $('#wrapper');
    var statusBar = $('#statusBar');
    var statusMsg = $('#statusmsg');
    var chatBody  = $('#chat_body');
    var nick_ul   = $('#nick_ul');
    var chatForm  = $('#chat-form');
    var joinForm  = $('#join-form');
    var audio     = $('.notification audio').get(0);
    var loginStatus = $('#login-status-text');
    var doNotReconnect = false; //prohibit reconnect to freenode server after a socket disconnect, no retries
    var motdPrevLineEmpty = false; //flag for determining if the prev motd line was only spaces and asterisks

    //used in tab completion
    var prevKeyWasTab = false;
    var pattern = ""; //text fragment respective pattern to look for
    var candidate = ""; //candidate
    var source = []; //array of values to be matched
    var sourcePos = 0; //the search sartting position
    //-

    window.counter = 0;
    $('#nick').focus();

    var Container = function() {
        var bIrcNoticesEnabled = false; //allow display of "notice" messages during login, default false
        var bAutoScrollEnabled = true; //allow chat page scroll, default true
        var bTonesEnabled = true; //allow tones on pm (yellow) messages, default true
        var bStatsEnabled = false; //display statistics
        var opts = {
            lines     : 12,
            length    : 7,
            width     : 4,
            radius    : 2.8,
            color     : '#000',
            speed     : 1,
            trail     : 40,
            shadow    : false,
            hwaccel   : false,
            className : 'spinner',
            zIndex    : 2e9,
            top       : 'auto',
            left      : 'auto'
        };
        var stats = null; //statistics
        var serverStartTime = null; //server start time

        this.getOpts = function() {
            return opts;
        };

        this.setIrcNoticesEnabled = function(enabled) {
            bIrcNoticesEnabled = enabled;
        };
        this.getIrcNoticesEnabled = function() {
            return bIrcNoticesEnabled;
        };

        this.setAutoScrollEnabled = function(enabled) {
            bAutoScrollEnabled = enabled;
        };
        this.getAutoScrollEnabled = function() {
            return bAutoScrollEnabled;
        };

        this.setTonesEnabled = function(enabled) {
            bTonesEnabled = enabled;
        };
        this.getTonesEnabled = function() {
            return bTonesEnabled;
        };

        this.updateStats = function(sts) {
            stats = sts;
            serverStartTime = new Date(stats.st);
        };
        this.getServerTime = function() {
            return (serverStartTime !== null) ? serverStartTime.toRelativeTime() : 0;
        };
        this.getRss = function() {
            return (stats !== null) ? (stats.current/1024/1024).toFixed(1) + "M" : "";
        };
        this.getMinRss = function () {
            return (stats !== null) ? (stats.min/1024/1024).toFixed(1) + "M" : "";
        };
        this.getMaxRss = function () {
            return (stats !== null) ? (stats.max/1024/1024).toFixed(1) + "M" : "";
        };
        this.setStatsEnabled = function(enabled) {
            bStatsEnabled = enabled;
        };
        this.getStatsEnabled = function() {
            return bStatsEnabled;
        };
    };
    var c = new Container();

    var scrollBody = function() {
        $("#chat_scroller").animate({ scrollTop: $("#chat_scroller").prop("scrollHeight") }, 100);
    };

    joinForm.on('submit',function(e) {
        e.preventDefault();
        doNotReconnect = false;
        if ($('#nick').val() !== '') {
            $('#wrong').addClass('off');
            $('#login-msg').removeClass('off');
            chatBody.text("");
            if (sock !== null && sock.socket.connected === false) {
                sock.socket.reconnect();
            } else {
                sock = io.connect('http://'+window.location.host);
                sock.on('message', handleMessage);
                sock.on('disconnect', handleDisconnect);
                sock.on('connect', handleConnect);
            };
        } else {
            $('#wrong').removeClass('off');
        }
    });

    window.onfocus = function(){
        Tinycon.setBubble(0);
        window.counter = 0;
    };

    var getNickname = function (name) {
        var name = name || window.nick || 'Guest' + Math.round(Math.random(0,10)*25);
        nickname = name;
        return name;
    };

    var appendMessage = function (from, message, isSelf) {
        var row = $('<tr/>');
        if (typeof isSelf !== 'undefined' && isSelf === true) {
            row.addClass('me btn btn-info');
        } else {
            row.addClass('btn');
        }

        var row_class = '';
        if (window.nick){
            var reg = window.nick.replace(/\s+/, "|");
            var regexp = new RegExp(reg,'gi');
            if (regexp.test(message)){
                Tinycon.setBubble(++window.counter);
                row_class='gold';
                if (c.getTonesEnabled() == true) {
                    audio.play();
                }
            } else {
                row_class='default';
            }
        }

        message = _.escapeHTML(message);
        message = giveMeColors(message);
        message = message.replace(/(https?:\/\/[-_.a-zA-Z0-9&?\/=\[\]()$!#+:]+)/g, "<a href=\"$1\" target=\"_BLANK\">$1</a>");
        message = message.replace(/\[[0-9][0-9]m/g,'');
        var stats_class = (c.getStatsEnabled() == true) ? 'line-stats' : 'line-stats off';
        var html =  '<th class="author">' + from + '</th>'
                 +  '<td class="msg '+row_class+'">' + message
                 +  '<span class="time">'+ (new Date()).toTimeString().substr(0,9)+'</span>';
        if (c.getRss() == "") {
            html += '</td>';
        } else {
            html += '<span class="'+stats_class+'">' + c.getRss() + '</span></td>';
        }
        row.html(html);
        chatBody.append(row);
        if (c.getAutoScrollEnabled() == true) {
            scrollBody();
        }
    };

    var appendEvent = function (from, event, isSelf) {
        var row = $('<tr/>');
        if (typeof isSelf !== 'undefined' && isSelf === true) {
            row.addClass('me btn btn-info');
        } else {
            row.addClass('btn');
        }

        var message = '';

        switch (event) {
        case "join":
            message = "<strong>joined the channel</strong>";
            break;
        case "quit":
        case "part":
            message = "<strong>left the channel</strong>";
            break;
        case "endmotd":
            message = motd;
            break;
        case "connected":
            message = "<strong>Welcome to http://chat.lullabot.com/</strong>";
            message = message.replace(/(https?:\/\/[-_.a-zA-Z0-9&?\/=\[\]()$!#+:]+)/g, "<a href=\"$1\" target=\"_BLANK\">$1</a>");
            break;
        case "disconnected":
            message = "<strong>You've been disconnected from http://chat.lullabot.com/<br />Cross your fingers and refresh your browser!</strong>";
            message = message.replace(/(https?:\/\/[-_.a-zA-Z0-9&?\/=\[\]()$!#+:]+)/g, "<a href=\"$1\" target=\"_BLANK\">$1</a>");
            break;
        default:
            message = "<u>unknown event type oO</u>";
            break;
        }

        var stats_class = (c.getStatsEnabled() == true) ? 'line-stats' : 'line-stats off';
        var html =  '<th class="author">' + from + '</th>'
                  + '<td class="msg">' + message
                  + '<span class="time">' + (new Date()).toTimeString().substr(0,9)+'</span>';
        if (c.getRss() == "") {
            html += '</td>';
        } else {
            html += '<span class="'+stats_class+'">' + c.getRss() + '</span></td>';
        };
        row.html(html);
        chatBody.append(row);
        if (c.getAutoScrollEnabled() == true) {
            scrollBody();
        }
    };

    var appendExtras = function (from, message) {
        message = message.substring(2);
        if ($('#extra').text() == "") {
            //we arrived here for the first time
            var row = $('<tr/>');
            row.addClass('btn');
            row.html(
                '<th class="author">' + from + '</th>'
                + '<td class="msg" id="extra">' + message +'</td>');
            chatBody.append(row);
        } else {
            var text = $('#extra').html();
            if (message == " ") {
                text += "<br /><br />";
            } else {
                message = message.replace(/(https?:\/\/[-_.a-zA-Z0-9&?\/=\[\]()$!#+:]+)/g, "<a href=\"$1\" target=\"_BLANK\">$1</a>");
                if (motdPrevLineEmpty == true) {
                    text += "<br />" + message;
                } else {
                    text += " " + message;
                }
                motdPrevLineEmpty = (message.replace(/[* ]+/g, '') == "" ? true : false)
            }
            $('#extra').html(text);
        };
        if (c.getAutoScrollEnabled() == true) {
            scrollBody();
        }
    };

    var nicksToList = function () {
        var content = "";
        if (webNicks.length > 0) {
            for (var i = 0; i < nicks.length; i++) {
                idx = webNicks.indexOf(nicks[i]);
                (idx != -1) ? (content += '<li data-nick="' + nicks[i] + '"><p><span class="webnick">' + nicks[i] + '</span></p></li>') :
                              (content += '<li data-nick="' + nicks[i] + '">' + nicks[i] + '</li>');
            }
        } else {
            for (var i = 0; i < nicks.length; i++) {
                content += '<li data-nick="' + nicks[i] + '">' + nicks[i] + '</li>';
            }
        }
        nick_ul.html(content);
    };

    var handleMessage = function (data) {
        var obj = JSON.parse(data);
        //window.spinner.stop();
        //statusBar.addClass('off');
        if (obj && obj.messagetype) {
            var isSelf = (obj.from == nickname) ? true : false;
            switch (obj.messagetype) {
                case "nick":
                    nicks.splice(nicks.indexOf("nickname"), 1);
                    nickname = window.nick = obj.message;
                    nicks.push(nickname);
                    nicks.sort(cisort);
                    nicksToList();
                    break;
                case "433":  //nick already in use
                    window.spinner.stop();
                    sock.disconnect();
                    $('#login-msg').addClass('off');
                    $('#wrong').text("");
                    $('#wrong').removeClass('off');
                    $('#wrong').text(obj.message);
                    $('#join').removeAttr("disabled");
                    return;
                //notice at login
                case "notice":
                case "notice-err":
                //notice for content
                case "notice-msg":
                    if (c.getIrcNoticesEnabled() == true) {
                        appendMessage(obj.from, obj.message, false);
                    } else {
                        //redirect to login screen
                        var html = loginStatus.html();
                        html += "<br />" + obj.message;
                        loginStatus.html(html);
                    }
                    break;
                case "error":  //nick already in use
                    window.spinner.stop();
                    sock.disconnect();
                    $('#login-msg').addClass('off');
                    $('#wrong').text("");
                    $('#wrong').removeClass('off');
                    $('#wrong').text("Oh well, try again!");
                    $('#join').removeAttr("disabled");
                    return;
                case "message":
                    appendMessage(obj.from, obj.message, false);
                    requestStatistics();
                    break;
                case "topic":
                    appendMessage("Topic", obj.message, false);
                    break;
                case "names":
                    for (var i = 0; i < obj.users.length; i++) {
                        nicks.push(obj.users[i]);
                    }
                    break;
                case "endnames":
                    nicks.sort(cisort);
                    nicksToList();
                    for (var i = 0; i < nicks.length; i++) {
                      nick = nicks[i];
                      if (nick.charAt(0) == '@') {
                        nick = nick.substring(1);
                      }

                      // Don't do away checking for ourselves.
                      if (nick == nickname) {
                        continue;
                      }

                      // Set the initial away check for all channel members.
                      setTimeout(perNickAwayPoller(nick, i), (i + 1) * 1000);
                    }

                    break;
                    /*
                     * motd is currently disabled
                     * just uncomment if you want it
                     * you must enable the server corresponding part as well in irc.js
                     */
                case "motd":
                    appendExtras(obj.from, obj.message);
                    break;
                case "endmotd":
                    //do nothing
                    break;
                case "001":
                    //here we use end of motd to signal web irc login completed
                    c.setIrcNoticesEnabled(true);
                    window.spinner.stop();
                    $('<meta/>', {content: nick, name: 'nick'}).appendTo($('head'));
                    $('#chat_wrapper').removeClass('off');
                    $('#text_input').focus();
                    appendEvent("#lullabuddies", "connected", false);
                    $("#chat_scroller").height($("#nick_list").height()-1);
                    logBox.slideToggle();
                    $("#nickLabel").text(nickname);
                    $('#join').removeAttr("disabled");
                    break;
                case "join":
                    appendEvent(obj.from, obj.messagetype, isSelf);
                    if (isSelf == false) {
                        nicks.push(obj.from);
                        nicks.sort(cisort);
                        nicksToList();
                        // Query WHOIS right away.
                        setTimeout(perNickAwayPoller(obj.from, 0), 1000);
                    }

                    requestStatistics();
                    break;
                case "quit":
                case "part":
                    appendEvent(obj.from, obj.messagetype, isSelf);
                    for (var i = 0; i < nicks.length; i++) {
                        if (nicks[i] == obj.from || nicks[i] == "@" + obj.from) {
                            nicks.splice(i,1);
                            break;
                        }
                    }
                    nicksToList();
                    requestStatistics();
                    break;
                case "statistics":
                    c.updateStats(obj);
                    if (obj.wud == true) {
                        //the webusers list has been changed, we initiate retrieval
                        requestWebUsers();
                    }
                    var header_class = (c.getStatsEnabled() == true) ? 'header-stats' : 'header-stats off';
                    $("#nickLabel").html('<span class="'+header_class+'">Server up for: ' + c.getServerTime()
                        + ', rss: ' + c.getMinRss() + '/' + c.getMaxRss() + '</span> ' + nickname);
                    break;
                case "webusers":
                    webNicks = obj.wu;
                    nicksToList();
                    break;
                case "away":
                    $('ul#nick_ul li:not(".info")').each(function() {
                      // Ignore operator prefixes.
                      var nick = $(this).data('nick');
                      if (nick.charAt(0) == '@') {
                        nick = nick.substring(1);
                      }
                      if (nick == obj.nick) {
                        $(this).css('font-style', 'italic');
                        $(this).attr('title', obj.message);

                        // Store the time this nickname's away status was last
                        // updated. We need to do this due to the fact that
                        // clearing an away status is not a push operation, but
                        // a poll on WHOIS by the client with a missing 301
                        // resposne.
                        $(this).data('nick-time', Math.round(new Date().getTime() / 1000));
                      }
                    });
                    break;
                case "whois-info":
                    $('ul#nick_ul li').each(function() {
                      // Ignore operator prefixes.
                      var nick = $(this).data('nick');
                      if (typeof nick != 'undefined' && nick.charAt(0) == '@') {
                        nick = nick.substring(1);
                      }

                      if (nick == obj.nick) {
                        var contents = obj.info + "<br />" + obj.address;
                        var $info = $(this).find('li.info');
                        if ($info.length == 0) {
                          $(this).append('<li class="info"></li>');
                          $info = $(this).find('li.info');
                        }
                        $info.html(contents);
                      }
                    });
                    break;
                case "whois-end":
                    $('ul#nick_ul li:not(".info")').each(function() {
                      // Ignore operator prefixes.
                      var nick = $(this).data('nick');
                      var nick_time = $(this).data('nick-time');
                      if (nick.charAt(0) == '@') {
                        nick = nick.substring(1);
                      }
                      // Clear away statuses if it looks like we did a WHOIS
                      // that didn't respond with an away status. We give
                      // ourselves a nice long 10 seconds for the response
                      // to a WHOIS to finish.
                      if (nick == obj.nick && nick_time < (Math.round(new Date().getTime() / 1000) - 10)) {
                        $(this).css('font-style', '');
                        $(this).attr('title', '');
                        $(this).data('nick-time', '');
                      }
                    });
                    break;
                default:
                    alert(data);
                    break;
            };
        } else {
            console.log(data);
        }
    };

    var handleConnect = function() {
        //cancel reconnect
        if (doNotReconnect == true) {
            return;
        }
        $('#login-msg').text("");
        loginStatus.html("");
        var nick = window.nick = getNickname($('#nick').val());
        var password = window.password = $('#password').val();
        $('#login-msg').text("Joining as " + nick + "...");
        $('#join').prop("disabled", "disabled");
        c.setIrcNoticesEnabled(false);
        sock.send(JSON.stringify({ nickname: nick, password: password }));
        //start spinner
        window.target = document.getElementById('join-form');
        window.spinner = new Spinner(c.getOpts()).spin(window.target);
    };

    /*
     * set a time delay for disconnect
     *
     * in case we exit the form we do not want the user to see it
     * the socket has a reconnect timeout that does not help us with irc here
     * so we make sure the socket won't reconnect: doNotReconnect = true
     */
    var handleDisconnect = function() {
        doNotReconnect = true;
        setTimeout( function () {
            appendEvent("*", "disconnected", false);
            nicks = [];
            nicksToList();
        }, 1000);
    };

    var sendMessage = function () {
        appendMessage(nickname, textInput.val(), true);
        sock.send(JSON.stringify({
            messagetype: "message",
            message: textInput.val()
        }));
        textInput.val('');
    };

    /*
     * setTimeout() callback to poll each username's WHOIS response to look for
     * away statuses.
     *
     * @param n
     *   The nickname to query.
     * @param delay
     *   The delay in seconds to add to the next WHOIS check, on top of the
     *   default 60 second wait.
     */
    var perNickAwayPoller = function(n, delay) {
        // We return an anonymous function so that we can
        // keep the current nickname in scope, instead of
        // referencing the last nickname in the array.
        // @url http://stackoverflow.com/questions/6564814/passing-argument-to-settimeout-in-a-for-loop
        return function() {

          // Only check and continue to check if the user is
          // still part of this channel.
          if (nicks.indexOf(n) >= 0) {
            sock.send(JSON.stringify({
                messagetype: "message",
                message: "/whois " + n
            }));

            // To avoid flooding the server we space our
            // WHOIS queries by one second and check only
            // once per minute per nickname. Since we support
            // /whois from the client, the end user can always
            // force a referesh on a given nickname.
            setTimeout(perNickAwayPoller(n, delay), delay * 1000 + 60 * 1000);
          }
        }
    };

    /*
     * requesting statistics is user action triggered
     * in case it is proven to be to resource intensive
     * another solution can be sought, e.g., on a timer
     */
    var requestStatistics = function () {
        sock.send(JSON.stringify({ statistics: ""}))
    };

    var requestWebUsers = function () {
        sock.send(JSON.stringify({ webusers: ""}))
    };

    chatForm.on('submit',function(e){
  	e.preventDefault();
        if (textInput.val() !== '') {
            sendMessage();
        } else {
            alert('<p> You need to input a name</p>');
        }
        $('#text_input').focus();
        return false;
    });

/*  var ocolors = {
      'bold'      : ['\033[1m',  '\033[22m'],
      'italic'    : ['\033[3m',  '\033[23m'],
      'underline' : ['\033[4m',  '\033[24m'],
      'inverse'   : ['\033[7m',  '\033[27m'],
      'white'     : ['\033[37m', '\033[39m'],
      'grey'      : ['\033[90m', '\033[39m'],
      'black'     : ['\033[30m', '\033[39m'],
      'blue'      : ['\033[34m', '\033[39m'],
      'cyan'      : ['\033[36m', '\033[39m'],
      'green'     : ['\033[32m', '\033[39m'],
      'magenta'   : ['\033[35m', '\033[39m'],
      'red'       : ['\033[31m', '\033[39m'],
      'yellow'    : ['\033[33m', '\033[39m']
    };
*/
    var colors = {
       'p'    :['<p>','</p>'],
       '[1m'  :['<strong>','</strong>'],
       '[22m' :['<strong>','</strong>'],
       '[3m'  :['<i>','</i>'],
       '[23m' :['<i>','</i>'],
       '[4m'  :['<u>','</u>'],
       '[24m' :['<u>','</u>'],
       '[7m'  :['<span>','</span>'],
       '[27m' :['<span>','</span>'],
       '[37m' :['<span style="color:white">','</span>'],
       '[90m' :['<span style="color:grey">','</span>'],
       '[30m' :['<span style="color:#444">','</span>'],
       '[34m' :['<span style="color:blue">','</span>'],
       '[36m' :['<span style="color:cyan">','</span>'],
       '[32m' :['<span style="color:green">','</span>'],
       '[35m' :['<span style="color:magenta">','</span>'],
       '[31m' :['<span style="color:red">','</span>'],
       '[33m' :['<span style="color:yellow">','</span>']
    };

    var giveMeColors = function(str) {
        var old = str = str || '[44m'+str+'[43m';
        str = str.split(str.search(/\[[0-9][0-9]m/));
        var text  = str.join('').split(/\[[0-9][0-9]m/g);
        var color = str.join('').match(/\[[0-9][0-9]m|\[[0-9]m/g)||'';
        var loop  = -1;
        var dohs  = 0;
        while (color[loop + 1]){
            var prev = ++loop;
            var next = ++loop;
            if (color[prev]){
                if (colors[color[prev]]){
                    var math = (old.search('\\'+color[next])-old.search('\\'+color[prev]))
                    if (!(math > 0 && math < 5)){
                        old = old.replace(new RegExp('\\'+color[prev]), colors[color[prev]][0])
                        old = old.replace(new RegExp('\\'+color[next]),colors[color[prev]][1]);
                    } else {
                        old = old.replace(new RegExp('\\'+color[prev]), colors[color[prev]][0])
                        old = old.replace(new RegExp('\\'+color[next]), colors[color[next]][0])
                        old = old.replace(new RegExp('\\'+color[++loop]), colors[color[next]][1])
                        old = old.replace(new RegExp('\\'+color[++loop]),colors[color[prev]][1]);
                    }
                }
            }
        }
        return old.replace(/\[[0-9]m|\[|[0-9][0-9]m|/g,'');
    };

    /*
     * case insensitive compare
     * will not remove attributes like +, @ before comparison
     */
    var cisort = function(x, y){
        var a = x.toUpperCase();
        var b = y.toUpperCase();
        if (a > b) {
            return 1;
        } else if (a < b) {
            return -1;
        } else {
            return 0;
        }
    };

    //to resize "chat_scroller" to the size of screen
    $(window).resize(function() {
        $("#chat_scroller").height($("#nick_list").height()-1);
    });

    var fn = function(obj) {
        c.setAutoScrollEnabled(false);
        if(obj.scrollTop() + obj.height() >= obj.prop("scrollHeight"))
        {
            c.setAutoScrollEnabled(true);
        }
    };

    $("#chat_scroller").on('scroll', function() {
        fn($(this));
    });

    $("#btnTones").on('click', function() {
        //will not remember the tones status yet :), cookies, mmm
        c.setTonesEnabled(!c.getTonesEnabled());
        if (c.getTonesEnabled() == true) {
            $("#btnTones").text("Disable tones");
        } else {
            $("#btnTones").text("Enable tones");
        }
    });

    $('#btnStats').on('click', function() {
        //will not remember the stats status yet :), cookies, mmm
        c.setStatsEnabled(!c.getStatsEnabled());
        if (c.getStatsEnabled() == true) {
            $('#btnStats').text("Disable stats");
            $('.line-stats').removeClass('off');
            $('.header-stats').removeClass('off');
        } else {
            $('#btnStats').text("Enable stats");
            $('.line-stats').addClass('off');
            $('.header-stats').addClass('off');
        }
    });

    $("#text_input").tabComplete(nicks);
});
