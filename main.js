var config = require('./config.json');
var request = require('request');

console.log("Hello, world!");
console.log(config.mandrillKey);

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
			'subject': config.email.subject,
			'html': config.email.body,
		    }
		  }
	}, function(error, response, body) {
	    console.log('error ' + JSON.stringify(error));
	    console.log('response ' + JSON.stringify(response));
	    console.log('body ' + JSON.stringify(body));
	});

	


