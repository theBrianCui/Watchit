//If string contains content, or any element in content, return true
module.exports = function (str, content) {
    str = str.toLowerCase();
    if (!content) return true;

    if (Array.isArray(content)) {
        //'anyString'.indexOf('') returns true
        for (var i = 0; i < content.length; i++) {
            if (str.indexOf(content[i].toLowerCase()) !== -1) return true;
        }
        return false;
    }
    return str.indexOf(content.toLowerCase()) !== -1;
};