var sendgrid = require('sendgrid')('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');

Object.prototype.myNewTestFunction = function() {};

sendgrid.send(new sendgrid.Email({
    to: 'test@test.com',
    from: 'destination@test.com',
    subject: 'test mail',
    html: 'test body',
}), function(err, json) {
    if(err) console.log(err);
    console.log(json);
});
