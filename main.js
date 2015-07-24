var config = require('./config.json');
var argv = require('yargs').argv;
var request = require('request');

function log(message) {
    console.log((new Date).toISOString().replace(/z|t/gi,' ').substring(0, 19)
		+ " : " + message);
}

log("Launching Watchit!");

var supportedServices = {
    sendgrid: "SendGrid",
    mandrill: "Mandrill",
    mailgun: "Mailgun"
};
var service = config.service.toLowerCase();
//API key provided as command line argument:
if(argv.key)
    config.apikey = argv.key;

if(!supportedServices[service]) {
    log(service + " is not a supported email service. Please check the README.md file for details.");
    process.exit(1);
}

if(config.apikey == "paste-your-api-key-here" || !config.apikey) {
    log("You have not provided a " + supportedServices[service] + " API key for email notifications.\n"
	+ "Please either supply a " + supportedServices[service] + " API key in the config.json file.\n"	
	+ "Check out the README.md file for more information on how to get one.");
    process.exit(1);
}

//Setup sendgrid
var sendgrid = {};
if(service == "sendgrid")
    sendgrid = require('sendgrid')(config.apikey);

//Setup mailgun and mailcomposer
var mailgun = {};
var MailComposer = {};
if(service == "mailgun") {
    var Mg = require('mailgun').Mailgun;
    mailgun = new Mg(config.apikey);
    MailComposer = require("mailcomposer").MailComposer;
}

log(supportedServices[service] + " API Key: " + config.apikey);

function Dispatcher(watchers) {
    var _lock = false;
    var _queue = 0;

    var _watcherMap = {};
    watchers.forEach(function(watcher) {
	_watcherMap[watcher.subreddit] = watcher;
    });
    
    var scheduleDispatch = function(subreddit) {
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
	    _watcherMap[subreddit].checkSubreddit(
		function() {
		    scheduleDispatch(subreddit);
		}
	    );

	    if(_queue > 0) _queue--;
	    setTimeout(function() {
		_lock = false;
	    }, 2000);
	    
	} else {
	    _queue++;
	    delayDispatch(subreddit);
	}
    };

    this.start = function() {
	for(var subreddit in _watcherMap) {
	    if (_watcherMap.hasOwnProperty(subreddit)) {
		scheduleDispatch(subreddit);
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

    this.filters = [];
    if(Array.isArray(configWatcher.filters)) {
	this.filters = configWatcher.filters.map(function(filter) {
	    return new Filter(filter);
	});
    }
    log(this.subreddit + ' watcher has ' + this.filters.length + ' filters.');
};

Watcher.prototype.checkSubreddit = function (callback) {
    log('Checking ' + this.subreddit + ' for new posts...');
    request({ 'url': 'https://reddit.com/r/' + this.subreddit + '/new.json' },
	    (function(error, response, body) {
		if (!error && response.statusCode == 200) {

		    //Take all posts and turn them into RedditPost objects
		    var loadedPosts = JSON.parse(body).data.children.map(function (post) {
			return new RedditPost(post);
		    });
		    log(loadedPosts.length + ' were loaded from ' + this.subreddit);
		    
		    //Filter loadedPosts
		    loadedPosts = loadedPosts.filter((function (post) {

			var filterCount = this.filters.length;
			//At least one filter must pass
			if(filterCount > 0) {
			    for(var u = 0; u < filterCount; u++) {
				if(this.filters[u].test(post)) return true;
			    }
			    return false;
			}

			//If no filters are defined, let all posts pass
			return true;
		    }).bind(this));
		    log(loadedPosts.length + ' pass the filters defined for ' + this.subreddit);
		    
		    //Step through each post from the loadedPosts and compare with oldPosts
		    //Since listings are sorted by submission date, we can stop as soon as an old post is seen
		    var newPosts = [];
		    for(var k = 0; k < loadedPosts.length; k++) {
			if(!loadedPosts[k].equals(this.oldPosts[0]))
			    newPosts.push(loadedPosts[k])
			else
			    break;
		    }

		    log(newPosts.length + ' new, filtered posts were found on ' + this.subreddit);
		    if(newPosts.length > 0) {
			log('The newest post is ' + newPosts[0].ageString() + ' old.');
			var message = this.composeEmail(newPosts);
			this.sendEmail(this.email.subject.replace('[subreddit]', this.subreddit),
				       message);
		    }

		    this.oldPosts = loadedPosts;
		    
		} else {
		    log("Subreddit " + this.subreddit + " read failure!");
		    log("error" + JSON.stringify(error));
		    log("response" + JSON.stringify(response));
		    log("body" + JSON.stringify(body));
		}
		callback();
	    }).bind(this));
};

Watcher.prototype.composeEmail = function(posts) {
    var response = '';
    posts.forEach((function(post) {
	response += ('<p>' + this.email.body
		     .replace('[title]', post.title)
		     .replace('[url]', (post.selfPost ? '(text only/self post)' : post.url))
		     .replace('[permalink]', 'http://reddit.com' + post.permalink)
		     + '</p>');
    }).bind(this))
    return response;
};

Watcher.prototype.sendEmail = function (subject, body) {
    if(service == "sendgrid") {
	sendgrid.send(new sendgrid.Email({
	    to: this.email.to,
	    from: this.email.from,
	    subject: subject,
	    html: body
	}), (function(error, response, body) {
	    if (response.message == "success") {
		this.logEmailSuccess();
	    } else {
		this.logEmailError(error, response, body);
	    }
	}).bind(this));
	
    } else if(service == "mandrill") {
	request({ 'url': 'https://mandrillapp.com/api/1.0/messages/send.json',
		  'method': 'POST',
		  'json': { 'key': config.apikey,
			    'message': {
				'from_email': this.email.from,
				'to': [
				    {
					'email': this.email.to,
					'type': 'to'
				    }],
				'autotext': 'true',
				'subject': subject,
				'html': body,
			    }
			  }
		}, (function(error, response, body) {
		    if (!error && response.statusCode == 200) {
			this.logEmailSuccess();
		    } else {
			this.logEmailError(error, response, body);
		    }
		}).bind(this));
	
    } else if(service == "mailgun") {
	var mc = new MailComposer();
	mc.setMessageOption({
	    from: this.email.from,
	    to: this.email.to,
	    subject: subject,
	    html: body,
	});

	mc.buildMessage((function(error, messageSource) {
	    if(!error && messageSource) {
		mailgun.sendRaw(this.email.from, this.email.to,
				messageSource,
				(function(error) {
				    if(error) this.logEmailError(this);
				    else this.logEmailSuccess();
				}).bind(this));
	    } else {
		this.logEmailError(error);
	    }
	}).bind(this));
    }
};

Watcher.prototype.logEmailSuccess = function() {
    log("Successfully sent " + this.subreddit
	+ " alert email to " + this.email.to
	+ " via " + supportedServices[service]);
};

Watcher.prototype.logEmailError = function(error, response, body) {
    log("Failed to send " + this.subreddit
	+ " alert email to " + this.email.to
	+ "via " + supportedServices[service]);
    if(error) log("Error: " + JSON.stringify(error));
    if(response) log("Response: " + JSON.stringify(response));
    if(body) log("Body: " + JSON.stringify(body));
};

function RedditPost(rawPost) {
    rawPost = rawPost.data;
    this.domain = rawPost.domain;
    this.subreddit = rawPost.subreddit;
    this.url = rawPost.url;
    this.permalink = rawPost.permalink;
    this.title = rawPost.title;
    this.author = rawPost.author;
    this.score = rawPost.score;
    this.selfPost = rawPost.is_self;
    this.selfText = rawPost.selftext;
    this.comments = rawPost.num_comments;
    this.over18 = rawPost.over_18;
    this.createdAt = rawPost.created_utc;
    this.age = function() {
	return Math.floor((new Date).getTime()/1000) - this.createdAt;
    };
    this.ageString = function() {
	var age = this.age();
	
	var hours = Math.floor(age/3600);
	var minutes = Math.floor((age - (hours * 3600))/60);

	if(hours == 0 && minutes == 0)
	    return '<1 minute';
	else
	    return hours + ' hour(s) ' + minutes + ' minute(s)';
    };
};

RedditPost.prototype.equals = function(post) {
    if(!post)
	return false;
    return (this.permalink == post.permalink);
};

function Filter(rawFilter) {
    //String filters. Can also be arrays.
    this.domain = rawFilter.domain || '';
    this.title = rawFilter.title || '';
    this.url = rawFilter.url || '';
    this.permalink = rawFilter.permalink || '';
    this.title = rawFilter.title || '';
    this.author = rawFilter.author || '';

    //Value filters
    this.score = rawFilter.score || -1;
    this.comments = rawFilter.comments || -1;
    this.age = rawFilter.age || -1;

    //If string contains content, return true
    var stringFilter = function(str, content) {
	str = str.toLowerCase();
	if(!content) return true;
	
	if(Array.isArray(content)) {
	    //'anyString'.indexOf('') returns true
	    for(var i = 0; i < content.length; i++) {
		if(str.indexOf(content[i].toLowerCase()) != -1) return true;
	    }
	    return false;
	}
	return str.indexOf(content.toLowerCase()) == -1;
    };
    
    this.test = function(post) {
	if(this.score > post.score) return false;
	if(this.comments > post.comments) return false;
	if(this.age > post.age()) return false;
	
	//All string filters are the same
	for (var prop in this) {
	    var value = post[prop];
	    if(typeof value === 'string' || value instanceof String) {
		if(!stringFilter(value, this[prop])) {
		    return false;
		}
	    }
	}

	//All filters passed
	return true;
    };
};

function main() {
    var watchers = [];
    if(Array.isArray(config.watchers)) {
	watchers = config.watchers.map(function(watcher) {
	    return new Watcher(watcher);
	});
    }

    var Dispatch = new Dispatcher(watchers);
    Dispatch.start();
    log('Watchit is now running.');
};

main();
