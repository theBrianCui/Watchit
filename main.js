var config = require('./config.json');
var fs = require('fs');
var request = require('request');
var readlineSync = require('readline-sync');

//Interpret arguments
var argList = process.argv;
if(process.IsEmbedded) argList.unshift(process.argv[0]);
var argv = {
    log: false,
    silent: false,
    key: '',
    debug: 0
};

for(var arg in argv) {
    switch (typeof argv[arg]) {
    case 'boolean':
	argv[arg] = (argList.indexOf('-' + arg.charAt(0)) !== -1
		     || argList.indexOf('--' + arg) !== -1);
	break;
    case 'string':
    case 'number':
	var index = argList.indexOf('-' + arg.charAt(0));
	if(index === -1) index = argList.indexOf('--' + arg);
	//A bit silly, but -1 isn't falsy and we have to get the actual index value
	if(index !== -1 && argList[index + 1] != null && !(/^-{1,2}[a-z]+$/g.test(argList[index + 1]))) {
	    argv[arg] = argList[index + 1];
	}
	break;
    }
}

//Monkey patching console.log isn't ideal, so we'll go with this instead
//We can call this.log anywhere, which will either refer to this prototype or the object's
Object.prototype.log = function(message, debug) {
    //The higher the value of `debug`, the less important it is
    //If no argument is provided (or if 0), always log the message
    if(!debug || debug <= argv.debug) {
	message = (new Date).toISOString().replace(/z|t/gi,' ').substring(0, 19) + " : " + message;
	
	if(!argv.silent) console.log(message);
	if(argv.log) {
	    fs.appendFile('Watchit.log', message + '\n', function(err) {
		if(err) {
		    argv.log = false;
		    this.log('Error: could not write to file Watchit.log. ' + err);
		    this.log('Disabling logging mode.');
		}
	    });
	}
    }
}

function promptExit(code) {
    this.log('Press any key to exit...');
    if(!argv.silent)
	readlineSync.keyIn();
    process.exit(code == null ? 0 : code);
}

this.log("Launching Watchit!");

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
    this.log(service + " is not a supported email service. Please check the README.md file for details.");
    promptExit(1);
}

if(config.apikey == "paste-your-api-key-here" || !config.apikey) {
    this.log("You have not provided a " + supportedServices[service] + " API key for email notifications.\n"
	+ "Please either supply a " + supportedServices[service] + " API key in the config.json file.\n"	
	+ "Check out the README.md file for more information on how to get one.");
    promptExit(1);
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

this.log(supportedServices[service] + " API Key: " + config.apikey);

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

// Multiple string replace in one pass
// https://stackoverflow.com/questions/15604140/replace-multiple-strings-with-multiple-other-strings
function replaceAll(str,mapObj){
    var re = new RegExp(Object.keys(mapObj).join("|"),"gi");
    
    return str.replace(re, function(matched){
	return mapObj[matched.toLowerCase()];
    });
}

function Watcher(configWatcher) {
    this.subreddit = configWatcher.subreddit;
    this.email = configWatcher.emailTemplate;
    this.interval = configWatcher.interval;
    this.maxFailures = configWatcher.alertOnFailures;
    this.oldPosts = [];

    this.filters = [];
    if(Array.isArray(configWatcher.filters)) {
	this.filters = configWatcher.filters.map(function(filter) {
	    return new Filter(filter);
	});
    }
    this.log('This subreddit has ' + this.filters.length + ' filters.');
};

Watcher.prototype.checkSubreddit = function (callback) {
    this.log('Checking for new posts...');
    request({ 'url': 'https://reddit.com/r/' + this.subreddit + '/new.json' },
	    (function(error, response, body) {
		if (!error && response.statusCode == 200) {

		    //Take all posts and turn them into RedditPost objects
		    var loadedPosts = JSON.parse(body).data.children.map(function (post) {
			return new RedditPost(post);
		    });
		    this.log('' + loadedPosts.length + ' posts loaded.');
		    
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
		    this.log(loadedPosts.length + ' posts remain after applying '
			+ this.filters.length + ' filters.');
		    
		    //Step through each post from the loadedPosts and compare with oldPosts
		    //Since listings are sorted by submission date, we can stop as soon as an old post is seen
		    var newPosts = [];
		    for(var k = 0; k < loadedPosts.length; k++) {
			if(!loadedPosts[k].equals(this.oldPosts[0])) {
			    newPosts.push(loadedPosts[k])
			} else {
			    //When we reach a matching post, we know the rest of the posts will match
			    //This works because posts are sorted by age
			    break;
			}
		    }

		    this.log(newPosts.length + ' filtered posts are new.');
		    if(newPosts.length > 0) {
			this.log(newPosts[0].ageString + ' is the age of the newest filtered post.');

			var replacements = {};
			replacements['{subreddit}'] = this.subreddit;
			replacements['{count}'] = newPosts.length;
			replacements['{titles}'] = (newPosts.map(function (post) {
			    return post.title;
			})).join(', ');
			
			var message = replaceAll(this.composeEmail(newPosts), replacements);
			var subject = replaceAll(this.email.subject, replacements);
			this.sendEmail(subject, message);
		    }

		    this.oldPosts = loadedPosts;
		    
		} else {
		    this.log('Reddit read failure!');
		    this.log('Error: ' + JSON.stringify(error));
		    this.log('Response: ' + JSON.stringify(response), 1);
		    this.log('Body: ' + JSON.stringify(body));
		}

		callback();
	    }).bind(this));
};

Watcher.prototype.composeEmail = function(posts) {
    var body = this.email.body;
    var bodyPosts = '';

    for(var i = 0; i < posts.length; i++){
	var post = posts[i];

	//Any post property saved should be substituted in the template
	var postReplacements = {};
	for(var prop in post) {
	    var value = post[prop];
	    //Skip functions
	    if(Object.prototype.toString.call(value) != '[object Function]')
		postReplacements['{' + prop.toLowerCase() + '}'] = post[prop];
	}

	bodyPosts += replaceAll(this.email.post, postReplacements);
    }

    var replacements = {};
    replacements['{posts}'] = bodyPosts;
    return replaceAll(body, replacements);
};

Watcher.prototype.sendEmail = function (subject, body) {
    //Cut off a subject that ends up being too long
    if(subject !== subject.substring(0, 77))
	subject = subject.substring(0, 74) + '...';
    
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

Watcher.prototype.log = function(message) {
    //Call the global logger function
    Object.prototype.log(this.subreddit + ': ' + message);
};

Watcher.prototype.logEmailSuccess = function() {
    this.log('Successfully sent alert email to '
	+ this.email.to + ' via ' + supportedServices[service] + '.');
};

Watcher.prototype.logEmailError = function(error, response, body) {
    this.log('Failed to deliver alert email to '
	+ this.email.to + ' via ' + supportedServices[service] + '.');
    this.log('Check that the provided API key is valid, the chosen service is up, ' +
	'and the from/to email addresses are valid.');
    
    if(error) this.log('Error: ' + JSON.stringify(error));
    //The response tends to be long and confusing, so log it on debug level 1
    if(response) this.log('Response: ' + JSON.stringify(response), 1);
    if(body) this.log('Body: ' + JSON.stringify(body));
};

function RedditPost(rawPost) {
    rawPost = rawPost.data;
    this.domain = rawPost.domain;
    this.subreddit = rawPost.subreddit;
    this.url = (rawPost.is_self ? '(text only/self post)' : rawPost.url);
    this.permalink = 'http://reddit.com' + rawPost.permalink;
    this.title = rawPost.title;
    this.author = rawPost.author;
    this.score = rawPost.score;
    this.selfPost = rawPost.is_self;
    this.selfText = rawPost.selftext;
    this.comments = rawPost.num_comments;
    this.over18 = rawPost.over_18;
    this.createdAt = rawPost.created_utc;
    
    this.age = (function() {
	return Math.floor((new Date).getTime()/1000) - this.createdAt;
    }).call(this);

    this.ageString = (function() {
	var age = this.age;
	
	var hours = Math.floor(age/3600);
	var minutes = Math.floor((age - (hours * 3600))/60);

	if(hours == 0 && minutes == 0)
	    return '<1 minute';
	else
	    return hours + ' hour(s) ' + minutes + ' minute(s)';
    }).call(this);
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
    this.selfText = rawFilter.selfText || '';

    //Value filters
    this.score = rawFilter.score || -1;
    this.comments = rawFilter.comments || -1;
    this.age = rawFilter.age || -1;

    //Boolean filters
    this.selfPost = (typeof rawFilter.selfPost === 'boolean') ? rawFilter.selfPost : null;
    this.over18 = (typeof rawFilter.over18 === 'boolean') ? rawFilter.over18 : null;

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
	return str.indexOf(content.toLowerCase()) != -1;
    };
    
    this.test = function(post) {
	//Compare booleans
	//If the filter value is unset, don't check
	if((this.selfPost != null) && this.selfPost !== post.selfPost) return false;
	if((this.over18 != null) && this.over18 !== post.over18) return false;

	//Compare values
	if(this.score > post.score) return false;
	if(this.comments > post.comments) return false;
	if(this.age > post.age) return false;
	
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
    this.log('Watchit is now running.');
};

main();
