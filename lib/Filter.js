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
    var stringFilter = function (str, content) {
        str = str.toLowerCase();
        if (!content) return true;

        if (Array.isArray(content)) {
            //'anyString'.indexOf('') returns true
            for (var i = 0; i < content.length; i++) {
                if (str.indexOf(content[i].toLowerCase()) != -1) return true;
            }
            return false;
        }
        return str.indexOf(content.toLowerCase()) != -1;
    };

    this.test = function (post) {
        //Compare booleans
        //If the filter value is unset, don't check
        if ((this.selfPost != null) && this.selfPost !== post.selfPost) return false;
        if ((this.over18 != null) && this.over18 !== post.over18) return false;

        //Compare values
        if (this.score > post.score) return false;
        if (this.comments > post.comments) return false;
        if (this.age > post.age) return false;

        //All string filters are the same
        for (var prop in this) {
            var value = post[prop];
            if (typeof value === 'string' || value instanceof String) {
                if (!stringFilter(value, this[prop])) {
                    return false;
                }
            }
        }

        //All filters passed
        return true;
    };
}

module.exports = Filter;