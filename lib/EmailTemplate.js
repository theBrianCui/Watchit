//Define module-accessible constants
const EMAIL_TEMPLATE_PROPERTIES = ['from', 'to', 'subject', 'body', 'post'];
//Taken from the HTML5 Email spec
//See: https://html.spec.whatwg.org/multipage/forms.html#e-mail-state-%28type=email%29
const VALID_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

function EmailTemplate (config) {
    EMAIL_TEMPLATE_PROPERTIES.forEach(function(property) {
        this[property] = config[property] || '';
    }, this)
}

//Static check function
//Returns the EmailTemplate if it is valid, otherwise returns false
EmailTemplate.validate = function (emailTemplate) {
    if (!emailTemplate && !(emailTemplate instanceof EmailTemplate)) return false;

    for (var i = 0; i < EMAIL_TEMPLATE_PROPERTIES.length; i++) {
        var value = emailTemplate[EMAIL_TEMPLATE_PROPERTIES[i]];
        if (!value) {
            return false;
        } else if (EMAIL_TEMPLATE_PROPERTIES[i] === 'from' || EMAIL_TEMPLATE_PROPERTIES[i] === 'to') {
            if (!VALID_EMAIL_REGEX.test(value)) return false;
        }
    }
    return emailTemplate;
};

module.exports = EmailTemplate;