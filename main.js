var fs = require('fs');
var request = require('request');
var readlineSync = require('readline-sync');

//Classes
var RedditPost = require('./lib/RedditPost.js');
var Filter = require('./lib/Filter.js');

//The global watchit object, used for namespacing
var watchit = new (function(userConfig){
    this.args = require('./lib/arguments.js')({
        log: false,
        silent: false,
        key: '',
        debug: 0
    });

    this.config = (function(userConfig, args) {
        var cfg = userConfig;
        if(args.key) cfg.apikey = args.key;
        return cfg;
    })(userConfig, this.args);

    this.utils =  {
        log: function (message, debug) {
            //The higher the value of `debug`, the less important it is
            //If no argument is provided (or if 0), always log the message
            if (!debug || debug <= this.args.debug) {
                var messages = message.split('\n');
                for(var i = 0; i < messages.length; i++){
                    var output = (new Date).toISOString().replace(/z|t/gi, ' ').substring(0, 19) + " : " + messages[i];

                    if (!this.args.silent) console.log(output);
                    this.utils.writeToLogFile(output);
                }
            }
        }.bind(this),
        writeToLogFile: function(message) {
            if (this.args.log) {
                fs.appendFile('Watchit.log', message + '\n', function (err) {
                    if (err) {
                        this.args.log = false;
                        this.utils.log('Error: could not write to file Watchit.log. ' + err + '\n'
                        + 'Disabling logging mode.');
                    }
                }.bind(this));
            }
        }.bind(this),
        replaceAll: require('./lib/stringReplaceAll.js'),
        promptExit: function(code) {
            this.utils.log("Press any key to exit...");
            if (!this.args.silent)
                readlineSync.keyIn();
            process.exit(code == null ? 0 : code);
        }.bind(this)
    };

    this.utils.log("Launching Watchit!");

    this.supportedServices = {
        sendgrid: "SendGrid",
        mandrill: "Mandrill",
        mailgun: "Mailgun"
    };

    this.service = this.config.service && this.config.service.toLowerCase();
    if(!this.supportedServices[this.service]) {
        this.utils.log(this.service + " is not a supported email service. Please check the README.md file for details.");
        this.utils.promptExit(1);
    } else if (this.config.apikey === '' || this.config.apikey === 'paste-your-api-key-here') {
        this.utils.log("You have not provided a " + this.supportedServices[this.service] + " API key for email notifications.\n"
        + "Please supply a " + this.supportedServices[this.service] + " API key in the config.json file.\n"
        + "Check out the README.md file for more information on how to obtain an API key.");
        this.utils.promptExit(1);
    }

    this.services = {
        sendgrid: (this.service === 'sendgrid' ? require('sendgrid')(this.config.apikey) : null),
        mailgun: (this.service === 'mailgun' ? new (require('mailgun').Mailgun)(this.config.apikey) : null),
        MailComposer: require("mailcomposer").MailComposer
    };
    
    this.sendEmail = function(emailHash, successCallback, failureCallback) {
        //emailHash should contain properties to, from, subject, body

        //Cut off a subject that ends up being too long
        if (emailHash.subject !== emailHash.subject.substring(0, 77))
            emailHash.subject = emailHash.subject.substring(0, 74) + '...';

        if (this.service == "sendgrid") {

            var sendgrid = this.services.sendgrid;
            sendgrid.send(new sendgrid.Email({
                to: emailHash.to,
                from: emailHash.from,
                subject: emailHash.subject,
                html: emailHash.body
            }), (function (error, response) {
                if (response && response.message == "success") {
                    successCallback();
                } else {
                    failureCallback(error, response);
                }
            }).bind(this));

        } else if (this.service == "mandrill") {
            request({
                'url': 'https://mandrillapp.com/api/1.0/messages/send.json',
                'method': 'POST',
                'json': {
                    'key': this.config.apikey,
                    'message': {
                        'from_email': emailHash.from,
                        'to': [
                            {
                                'email': emailHash.to,
                                'type': 'to'
                            }],
                        'autotext': 'true',
                        'subject': emailHash.subject,
                        'html': emailHash.body
                    }
                }
            }, (function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    successCallback();
                } else {
                    failureCallback(error, response, body);
                }
            }).bind(this));

        } else if (this.service == "mailgun") {
            var mc = new this.services.MailComposer();
            mc.setMessageOption({
                from: emailHash.from,
                to: emailHash.to,
                subject: emailHash.subject,
                html: emailHash.body
            });

            mc.buildMessage((function (error, messageSource) {
                if (!error && messageSource) {
                    this.services.mailgun.sendRaw(emailHash.from, emailHash.to,
                        messageSource,
                        (function (error) {
                            if (error) failureCallback(error);
                            else successCallback();
                        }).bind(this));
                } else {
                    failureCallback(error);
                }
            }).bind(this));
        }
    };

    this.utils.log(this.supportedServices[this.service] + " API Key: " + this.config.apikey);
})(require('./config.json'));

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
    this.log('This subreddit has ' + this.filters.length + ' filters.');
}

Watcher.prototype.checkSubreddit = function (callback) {
    this.log('Checking for new posts...');
    request({'url': 'https://reddit.com/r/' + this.subreddit + '/new.json'},
        (function (error, response, body) {
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
                    if (filterCount > 0) {
                        for (var u = 0; u < filterCount; u++) {
                            if (this.filters[u].test(post)) return true;
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
                for (var k = 0; k < loadedPosts.length; k++) {
                    if (!loadedPosts[k].equals(this.oldPosts[0])) {
                        newPosts.push(loadedPosts[k])
                    } else {
                        //When we reach a matching post, we know the rest of the posts will match
                        //This works because posts are sorted by age
                        break;
                    }
                }

                this.log(newPosts.length + ' filtered posts are new.');
                if (newPosts.length > 0) {
                    this.log(newPosts[0].ageString + ' is the age of the newest filtered post.');
                    var replacements = {};
                    replacements['{subreddit}'] = this.subreddit;
                    replacements['{count}'] = newPosts.length;
                    replacements['{titles}'] = (newPosts.map(function (post) {
                        return post.title;
                    })).join(', ');

                    var message = watchit.utils.replaceAll(this.composeEmail(newPosts), replacements);
                    var subject = watchit.utils.replaceAll(this.email.subject, replacements);
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

Watcher.prototype.composeEmail = function (posts) {
    var body = this.email.body;
    var bodyPosts = '';

    for (var i = 0; i < posts.length; i++) {
        var post = posts[i];

        //Any post property saved should be substituted in the template
        var postReplacements = {};
        for (var prop in post) {
            if(post.hasOwnProperty(prop)) {
                var value = post[prop];
                //Skip functions
                if (Object.prototype.toString.call(value) != '[object Function]')
                    postReplacements['{' + prop.toLowerCase() + '}'] = post[prop];
            }
        }

        bodyPosts += watchit.utils.replaceAll(this.email.post, postReplacements);
    }

    var replacements = {};
    replacements['{posts}'] = bodyPosts;
    return watchit.utils.replaceAll(body, replacements);
};

//TODO: Make watchit a parameter/property of a Watcher instead of a global
Watcher.prototype.sendEmail = function (subject, body) {
    watchit.sendEmail({
        from: this.email.from,
        to: this.email.to,
        subject: subject,
        body: body
    }, this.logEmailSuccess.bind(this), this.logEmailError.bind(this));
};

Watcher.prototype.log = function(message, debug) {
    watchit.utils.log(this.subreddit + ' : ' + message, debug);
};

Watcher.prototype.logEmailSuccess = function () {
    this.log('Successfully sent alert email to '
    + this.email.to + ' via ' + watchit.supportedServices[watchit.service] + '.');
};

Watcher.prototype.logEmailError = function (error, response, body) {
    this.log('Failed to deliver alert email to '
    + this.email.to + ' via ' + watchit.supportedServices[watchit.service] + '.');
    this.log('Check that the provided API key is valid, the chosen service is up, ' +
    'and the from/to email addresses are valid.');

    if (error) this.log('Error: ' + JSON.stringify(error));
    //The response tends to be long and confusing, so log it on debug level 1
    if (response) this.log('Response: ' + JSON.stringify(response), 1);
    if (body) this.log('Body: ' + JSON.stringify(body));
};

(function main(watchit) {
    var watchers = [];
    if (Array.isArray(watchit.config.watchers)) {
        watchers = watchit.config.watchers.map(function (watcher) {
            if (!watcher.emailTemplate)
                watcher.emailTemplate = watchit.config.defaultEmailTemplate;
            return new Watcher(watcher);
        });
    }

    var Dispatch = new Dispatcher(watchers);
    Dispatch.start();
    watchit.utils.log('Watchit is now running.');
})(watchit);
