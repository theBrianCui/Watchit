var fs = require('fs');
var request = require('request');
var readlineSync = require('readline-sync');

//Custom modules: Stored in ./lib/
//Objects and static functions
var config = require('./config.json');
var argv = require('./lib/arguments.js')({
    log: false,
    silent: false,
    key: '',
    debug: 0
});
var replaceAll = require('./lib/stringReplaceAll.js');

//Classes
var RedditPost = require('./lib/RedditPost.js');
var Filter = require('./lib/Filter.js');

//Monkey patching console.log isn't ideal, so we'll go with this instead
//We can call this.toLog anywhere, which will either refer to this prototype or the object's
global.toLog = function (message, debug) {
    //The higher the value of `debug`, the less important it is
    //If no argument is provided (or if 0), always log the message
    if (!debug || debug <= argv.debug) {
        var messages = message.split('\n');
        messages.forEach(function(message) {
            message = (new Date).toISOString().replace(/z|t/gi, ' ').substring(0, 19) + " : " + message;

            if (!argv.silent) console.log(message);
            if (argv.log) {
                fs.appendFile('Watchit.log', message + '\n', function (err) {
                    if (err) {
                        argv.log = false;
                        global.toLog('Error: could not write to file Watchit.log. ' + err + '\n'
                        + 'Disabling logging mode.');
                    }
                });
            }
        })
    }
};

function promptExit(code) {
    global.toLog('Press any key to exit...');
    if (!argv.silent)
        readlineSync.keyIn();
    process.exit(code == null ? 0 : code);
}

global.toLog("Launching Watchit!");

var supportedServices = {
    sendgrid: "SendGrid",
    mandrill: "Mandrill",
    mailgun: "Mailgun"
};
var service = config.service.toLowerCase();
//API key provided as command line argument:
if (argv.key) config.apikey = argv.key;

if (!supportedServices[service]) {
    global.toLog(service + " is not a supported email service. Please check the README.md file for details.");
    promptExit(1);
} else if (!config.apikey || config.apikey == "paste-your-api-key-here") {
    global.toLog("You have not provided a " + supportedServices[service] + " API key for email notifications.\n"
    + "Please supply a " + supportedServices[service] + " API key in the config.json file.\n"
    + "Check out the README.md file for more information on how to obtain an API key.");
    promptExit(1);
}

//Setup sendgrid
var sendgrid;
var mailgun;
var MailComposer;
if (service == "sendgrid")
    sendgrid = require('sendgrid')(config.apikey);

//Setup mailgun and mailcomposer
if (service == "mailgun") {
    var Mg = require('mailgun').Mailgun;
    mailgun = new Mg(config.apikey);
    MailComposer = require("mailcomposer").MailComposer;
}

global.toLog(supportedServices[service] + " API Key: " + config.apikey);

function Dispatcher(watchers) {
    var _lock = false;
    var _queue = 0;

    var _watcherMap = {};
    watchers.forEach(function (watcher) {
        _watcherMap[watcher.subreddit] = watcher;
    });

    var scheduleDispatch = function (subreddit) {
        setTimeout(function () {
                dispatch(subreddit)
            },
            _watcherMap[subreddit].interval);
    };

    var delayDispatch = function (subreddit) {
        setTimeout(function () {
                dispatch(subreddit)
            },
            2000 * _queue);
    };

    var dispatch = function (subreddit) {
        if (!_lock) {
            _lock = true;
            _watcherMap[subreddit].checkSubreddit(
                function () {
                    scheduleDispatch(subreddit);
                }
            );

            if (_queue > 0) _queue--;
            setTimeout(function () {
                _lock = false;
            }, 2000);

        } else {
            _queue++;
            delayDispatch(subreddit);
        }
    };

    this.start = function () {
        for (var subreddit in _watcherMap) {
            if (_watcherMap.hasOwnProperty(subreddit)) {
                scheduleDispatch(subreddit);
            }
        }
    };
}

function Watcher(configWatcher) {
    this.subreddit = configWatcher.subreddit;
    this.email = configWatcher.emailTemplate;
    this.interval = (parseInt(configWatcher.interval)) >= 5000 ? parseInt(configWatcher.interval) : 60000;
    this.oldPosts = [];

    this.filters = [];
    if (Array.isArray(configWatcher.filters)) {
        this.filters = configWatcher.filters.map(function (filter) {
            return new Filter(filter);
        });
    }
    global.toLog('This subreddit has ' + this.filters.length + ' filters.');
}

Watcher.prototype.checkSubreddit = function (callback) {
    global.toLog('Checking for new posts...');
    request({'url': 'https://reddit.com/r/' + this.subreddit + '/new.json'},
        (function (error, response, body) {
            if (!error && response.statusCode == 200) {

                //Take all posts and turn them into RedditPost objects
                var loadedPosts = JSON.parse(body).data.children.map(function (post) {
                    return new RedditPost(post);
                });
                global.toLog('' + loadedPosts.length + ' posts loaded.');

                //Filter loadedPosts
                loadedPosts = loadedPosts.filter((function (post) {

                    var filterCount = this.filters.length;
                    //At least one filter must pass
                    if (filterCount > 0) {
                        for (var u = 0; u < filterCount; u++) {
                            if (this.filters[u].test(post)) return true;
                        }
                        return false;
                    }

                    //If no filters are defined, let all posts pass
                    return true;
                }).bind(this));
                global.toLog(loadedPosts.length + ' posts remain after applying '
                + this.filters.length + ' filters.');

                //Step through each post from the loadedPosts and compare with oldPosts
                //Since listings are sorted by submission date, we can stop as soon as an old post is seen
                var newPosts = [];
                for (var k = 0; k < loadedPosts.length; k++) {
                    if (!loadedPosts[k].equals(this.oldPosts[0])) {
                        newPosts.push(loadedPosts[k])
                    } else {
                        //When we reach a matching post, we know the rest of the posts will match
                        //This works because posts are sorted by age
                        break;
                    }
                }

                global.toLog(newPosts.length + ' filtered posts are new.');
                if (newPosts.length > 0) {
                    global.toLog(newPosts[0].ageString + ' is the age of the newest filtered post.');
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
                global.toLog('Reddit read failure!');
                global.toLog('Error: ' + JSON.stringify(error));
                global.toLog('Response: ' + JSON.stringify(response), 1);
                global.toLog('Body: ' + JSON.stringify(body));
            }

            callback();
        }).bind(this));
};

Watcher.prototype.composeEmail = function (posts) {
    var body = this.email.body;
    var bodyPosts = '';

    for (var i = 0; i < posts.length; i++) {
        var post = posts[i];

        //Any post property saved should be substituted in the template
        var postReplacements = {};
        for (var prop in post) {
            var value = post[prop];
            //Skip functions
            if (Object.prototype.toString.call(value) != '[object Function]')
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
    if (subject !== subject.substring(0, 77))
        subject = subject.substring(0, 74) + '...';

    if (service == "sendgrid") {

        sendgrid.send(new sendgrid.Email({
            to: this.email.to,
            from: this.email.from,
            subject: subject,
            html: body
        }), (function (error, response) {
            if (response && response.message == "success") {
                this.logEmailSuccess();
            } else {
                this.logEmailError(error, response);
            }
        }).bind(this));

    } else if (service == "mandrill") {
        request({
            'url': 'https://mandrillapp.com/api/1.0/messages/send.json',
            'method': 'POST',
            'json': {
                'key': config.apikey,
                'message': {
                    'from_email': this.email.from,
                    'to': [
                        {
                            'email': this.email.to,
                            'type': 'to'
                        }],
                    'autotext': 'true',
                    'subject': subject,
                    'html': body
                }
            }
        }, (function (error, response, body) {
            if (!error && response.statusCode == 200) {
                this.logEmailSuccess();
            } else {
                this.logEmailError(error, response, body);
            }
        }).bind(this));

    } else if (service == "mailgun") {
        var mc = new MailComposer();
        mc.setMessageOption({
            from: this.email.from,
            to: this.email.to,
            subject: subject,
            html: body
        });

        mc.buildMessage((function (error, messageSource) {
            if (!error && messageSource) {
                mailgun.sendRaw(this.email.from, this.email.to,
                    messageSource,
                    (function (error) {
                        if (error) this.logEmailError(this);
                        else this.logEmailSuccess();
                    }).bind(this));
            } else {
                this.logEmailError(error);
            }
        }).bind(this));
    }
};

Watcher.prototype.logEmailSuccess = function () {
    global.toLog('Successfully sent alert email to '
    + this.email.to + ' via ' + supportedServices[service] + '.');
};

Watcher.prototype.logEmailError = function (error, response, body) {
    global.toLog('Failed to deliver alert email to '
    + this.email.to + ' via ' + supportedServices[service] + '.');
    global.toLog('Check that the provided API key is valid, the chosen service is up, ' +
    'and the from/to email addresses are valid.');

    if (error) global.toLog('Error: ' + JSON.stringify(error));
    //The response tends to be long and confusing, so log it on debug level 1
    if (response) global.toLog('Response: ' + JSON.stringify(response), 1);
    if (body) global.toLog('Body: ' + JSON.stringify(body));
};

function main() {
    var watchers = [];
    if (Array.isArray(config.watchers)) {
        watchers = config.watchers.map(function (watcher) {
            if (!watcher.emailTemplate)
                watcher.emailTemplate = config.defaultEmailTemplate;
            return new Watcher(watcher);
        });
    }

    var Dispatch = new Dispatcher(watchers);
    Dispatch.start();
    global.toLog('Watchit is now running.');
}

main();
