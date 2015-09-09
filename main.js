var fs = require('fs');
var readlineSync = require('readline-sync');

//Classes
var Watcher = require('./lib/Watcher.js');
//var RedditPost = require('./lib/RedditPost.js');
//var Filter = require('./lib/Filter.js');

//The global watchit object, used for namespacing
var watchit = new (function(userConfig){
    var _args = require('./lib/arguments.js')({
        log: false,
        silent: false,
        key: '',
        debug: 0
    });

    this.config = (function(userConfig, args) {
        var cfg = userConfig;
        if(args.key) cfg.apikey = args.key;
        return cfg;
    })(userConfig, _args);

    this.utils = {
        log: function (message, debug) {
            //The higher the value of `debug`, the less important it is
            //If no argument is provided (or if 0), always log the message
            if (!debug || debug <= _args.debug) {
                var messages = message.split('\n');
                for(var i = 0; i < messages.length; i++){
                    var output = (new Date).toISOString().replace(/z|t/gi, ' ').substring(0, 19) + " : " + messages[i];

                    if (!_args.silent) console.log(output);
                    this.utils.writeToLogFile(output);
                }
            }
        }.bind(this),

        writeToLogFile: function(message) {
            if (_args.log) {
                fs.appendFile('Watchit.log', message + '\n', function (err) {
                    if (err) {
                        _args.log = false;
                        this.utils.log('Error: could not write to file Watchit.log. ' + err + '\n'
                        + 'Disabling logging mode.');
                    }
                }.bind(this));
            }
        }.bind(this),

        replaceAll: require('./lib/stringReplaceAll.js'),

        promptExit: function(code) {
            this.utils.log("Press any key to exit...");
            if (!_args.silent)
                readlineSync.keyIn();
            process.exit(code == null ? 0 : code);
        }.bind(this),

        validateEmailTemplate: function(emailTemplate) {
            if (!emailTemplate) return false;

            var properties = ['from', 'to', 'subject', 'body', 'post'];
            //Taken from the HTML5 Email spec
            //See: https://html.spec.whatwg.org/multipage/forms.html#e-mail-state-%28type=email%29
            var emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

            for(var i = 0; i < properties.length; i++) {
                var value = emailTemplate[properties[i]];
                if(!value) {
                    return false;
                } else if (properties[i] === 'from' || properties[i] === 'to') {
                    if(!emailRegex.test(value)) return false;
                }
            }
            return emailTemplate;
        }
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

    var _services = {
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

            var sendgrid = _services.sendgrid;
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
            var mc = new _services.MailComposer();
            mc.setMessageOption({
                from: emailHash.from,
                to: emailHash.to,
                subject: emailHash.subject,
                html: emailHash.body
            });

            mc.buildMessage((function (error, messageSource) {
                if (!error && messageSource) {
                    _services.mailgun.sendRaw(emailHash.from, emailHash.to,
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

(function main(master) {
    var watchers = [];
    var defaultEmailTemplate = master.utils.validateEmailTemplate(master.config.defaultEmailTemplate);

    if (Array.isArray(master.config.watchers)) {
        watchers = master.config.watchers.map(function (watcher) {
            var selectedWatcher = new Watcher(watcher, master);

            //TODO: move validation code into Watcher
            if (!master.utils.validateEmailTemplate(selectedWatcher.email)) {
                selectedWatcher.log("An invalid email template was provided for this Watcher.");

                if(!defaultEmailTemplate) {
                    master.utils.log("The default email template is invalid.\n"
                    + "Please ensure a valid default email template is provided,\n"
                    + "or a valid email template is provided for each Watcher.");
                    master.utils.promptExit(1);
                }
                selectedWatcher.log("The default email template will be used instead.");
                selectedWatcher.email = master.config.defaultEmailTemplate;
            }

            return selectedWatcher;
        });
    }

    var Dispatch = new Dispatcher(watchers);
    Dispatch.start();
    master.utils.log('Watchit is now running.');
})(watchit);
