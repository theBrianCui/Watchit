var config = require('./config.json');
var configNew = require('./config-new.json');
var request = require('request');


function log(message) {
    console.log((new Date).toISOString().replace(/z|t/gi,' ').substring(0, 19)
		+ " : " + message);
}

log("Launching Watchit!");
log("Mandrill API Key: " + config.mandrillKey);

function dispatchMail(subject, body) {
    log("Email dispatching...");
    request({ 'url': 'https://mandrillapp.com/api/1.0/messages/send.json',
	      'method': 'POST',
	      'json': { 'key': config.mandrillKey,
			'message': {
			    'from_email': config.email.from,
			    'to': [
				{
				    'email': config.email.to,
				    'type': 'to'
				}],
			    'autotext': 'true',
			    'subject': subject,
			    'html': body,
			}
		      }
	    }, function(error, response, body) {
		if (!error && response.statusCode == 200) {
		    log("Email successfully dispatched.");
		} else {
		    log("Email Dispatch Error!");
		    log('error ' + JSON.stringify(error));
		    log('response ' + JSON.stringify(response));
		    log('body ' + JSON.stringify(body));
		}
	    });
};

function Dispatcher(watchers) {
    var _lock = false;
    var _queue = 0;

    var _watcherMap = {};
    watchers.forEach(function(watcher) {
	_watcherMap[watcher.subreddit] = watcher;
    });
    
    var scheduleInitialDispatch = function(subreddit) {	
	setTimeout(function() { dispatch(subreddit) },
		   _watcherMap[subreddit].interval);
    };

    var delayDispatch = function(subreddit) {
	setTimeout(function() { dispatch(subreddit) },
		   2000 * _queue);
    };

    var dispatch = function(subreddit) {
	if(!_lock) {
	    _lock = true;
	    _watcherMap[subreddit].checkSubreddit();

	    if(_queue > 0) queue--;
	    setTimeout(function() {
		_lock = false;
	    }, 2000);
	    
	} else {
	    queue++;
	    delayDispatch(subreddit);
	}
    };

    this.start = function() {
	for(var subreddit in _watcherMap) {
	    if (object.hasOwnProperty(subreddit)) {
		scheduleInitialDispatch(subreddit);
	    }
	}	
    };
};

function Watcher(configWatcher) {
    this.subreddit = configWatcher.subreddit;
    this.email = configWatcher.email;
    this.interval = configWatcher.interval;
    this.maxFailures = configWatcher.alertOnFailures;
    this.oldPosts = [];
};

Watcher.prototype.checkSubreddit = function () {
    log('Watcher /r/' + this.subreddit + ' is checking for new posts...');
    request({ 'url': 'https://reddit.com/r/' + this.subreddit + '/new.json' },
	function(error, response, body) {
	    if (!error && response.statusCode == 200) {

		//Take all posts and turn them into redditPost objects
		var loadedPosts = JSON.parse(body).data.children.map(function (post) {
		    return new redditPost(post);
		});

		//Step through each post from the loadedPosts and compare with oldPosts
		//Since listings are sorted by submission date, we can stop as soon as an old post is seen
		var newPosts = [];
		for(var k = 0; k < loadedPosts.length; k++) {
		    if(!loadedPosts[k].equals(this.oldPosts[k]))
			newPosts.push(loadedPosts[k])
		    else
			break;
		}

		var message = this.composeEmail(newPosts);
		this.sendEmail(this.email.subject, message);
		    
	    } else {
		log("Subreddit " + this.subreddit + " read failure!");
		log("error" + JSON.stringify(error));
		log("response" + JSON.stringify(response));
		log("body" + JSON.stringify(body));
	    }
	});
};

Watcher.prototype.composeEmail = function(posts) {
    var response = '';
    posts.forEach(function(post) {
	response.push('<p>' + this.body
		      .replace('[title]', post.title)
		      .replace('[url]', post.url)
		      .replace('[permalink]', post.permalink)
		     + '</p>');
    })
    return response;
};

Watcher.prototype.sendEmail = function (subject, body) {
    request({ 'url': 'https://mandrillapp.com/api/1.0/messages/send.json',
	  'method': 'POST',
	  'json': { 'key': config.mandrillKey,
		    'message': {
			'from_email': this.email..from,
			'to': [
			    {
				'email': this..email.to,
				'type': 'to'
			    }],
			'autotext': 'true',
			'subject': subject,
			'html': body,
		    }
		  }
	    }, function(error, response, body) {
		if (!error && response.statusCode == 200) {
		    log("Alert Email by " + this.subreddit
			+ " successfully dispatched.");
		} else {
		    log("Alert Email by " + this.subreddit
			+ " Dispatch Error!");
		    log('error ' + JSON.stringify(error));
		    log('response ' + JSON.stringify(response));
		    log('body ' + JSON.stringify(body));
		}
	});
};

function redditPost(rawPost) {
    rawPost = rawPost.data;
    this.domain = rawPost.domain;
    this.subreddit = rawPost.subreddit;
    this.url = rawPost.url;
    this.permalink = rawPost.permalink;
    this.title = rawPost.title;
    this.author = rawPost.author;
}

redditPost.prototype.equals = function(post) {
    return (this.permalink == post.permalink);
}    

function checkSubreddit() {
    log("Pollling for new posts...");
    request({ 'url': 'https://reddit.com/r/' + config.subreddit + '/new.json' },
	    function(error, response, body) {
		if (!error && response.statusCode == 200) {
		    var listing = new redditListing(body);
		    var newPosts = [];
		    for(var i = 0; i < listing.posts.length; i++) {
			var listingSeenBefore = false;
			for(var v = 0; v < oldListing.posts.length; v++){
			    if(listing.posts[i].equals(oldListing.posts[v])) {
				listingSeenBefore = true;
				break;
			    }
			}
			if(!listingSeenBefore) {
			    newPosts.push(listing.posts[i]);
			}
		    }
		    if(newPosts.length > 0) {
			var emailTitle = "";
			var emailBody = "";
			for(var i = 0; i < newPosts.length; i++) {
			    emailTitle += (newPosts[i].title + ", ");
			    emailBody += ("<p>" + newPosts[i].title + "<br/>"
					  + "https://reddit.com" + newPosts[i].permalink + "<br/>"
					  + newPosts[i].url + "</p>");
			}
			emailTitle = emailTitle.substring(0, 70);
			dispatchMail(emailTitle, emailBody);
		    } else {
			log("No new posts...");
		    }
		    fails = 0;
		    oldListing = listing;
		} else {
		    log("Reddit read error!");
		    failsResponses.push("Error: " + JSON.stringify(error) + ", Response: " + JSON.stringify(response));
		    fails++;
		}
		main();
	    });

}

function redditListing(json) {
    if(json == null) {
	this.posts = [];
    } else {
    var listing = JSON.parse(json);
    var rawPosts = listing.data.children;
    this.posts = [];
    for(var i = 0; i < rawPosts.length; i++)
	this.posts.push(new redditPost(rawPosts[i]));
    }
}

var oldListing = new redditListing(null);
var fails = 0;
var failsResponses = [];
var attempts = 0;

function main() {
    attempts++;
    if(fails >= config.alertOnFailures) {
	var errorResponseBody = "";
	for(var i = 0; i < failsResponses.length; i++) {
	    errorResponseBody += (failsResponses[i] + '<br/>');
	}
	dispatchMail("Error accessing Reddit!", errorResponseBody);
	fails = 0;
	failsResponses = [];
    }
    if(attempts % 5 == 0)
	log("Status: " + attempts + " attempts, " + fails + " fails in queue.");
    if(attempts != 1)
	setTimeout(checkSubreddit, config.interval);
    else
	checkSubreddit();
}

if(config.interval >= 4000)
    main();
else
    log("Interval is invalid or too small!");
   
