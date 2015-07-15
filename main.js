var config = require('./config.json');
var request = require('request');

console.log("Hello, world!");
console.log(config.mandrillKey);

function dispatchMail(subject, body) {
    console.log("Email dispatching...");
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
		    console.log("Email successfully dispatched.");
		} else {
		    console.log("Email Dispatch Error!");
		    console.log('error ' + JSON.stringify(error));
		    console.log('response ' + JSON.stringify(response));
		    console.log('body ' + JSON.stringify(body));
		}
	});
};

function checkSubreddit() {
    request({ 'url': 'https://reddit.com/r/buildapcsales/new.json' },
	    function(error, response, body) {
		if (!error && response.statusCode == 200) {
		    console.log("Reddit read OK");
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
			console.log("No new posts...");
		    }
		    fails = 0;
		    oldListing = listing;
		} else {
		    console.log("Reddit read error!");
		    failsResponses.push("Error: " + JSON.stringify(error) + ", Response: " + JSON.stringify(response));
		    fails++;
		}
	    });
    main();
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
    return (this.domain == post.domain
	    && this.subreddit == post.subreddit
	    && this.url == post.url
	    && this.permalink == post.permalink
	    && this.title == post.title
	    && this.author == post.author);
}

var oldListing = new redditListing(null);
var failsBeforeAlert = 6;
var fails = 0;
var failsResponses = [];
var attempts = 0;

function main() {
    attempts++;
    if(fails >= failsBeforeAlert) {
	var errorResponseBody = "";
	for(var i = 0; i < failsResponses.length; i++) {
	    errorResponseBody += (failsResponses[i] + '<br/>');
	}
	dispatchMail("Error accessing Reddit!", errorResponseBody);
	fails = 0;
	failsResponses = [];
    }
    if(attempts % 5 == 0)
	console.log("Status: " + attempts + " attempts, " + fails + " fails in queue.");
    setTimeout(checkSubreddit, 6000);
}

main();
