var stringContains = require('./stringContains.js');

function Filter(rawFilter) {
    //String filters. Can also be arrays.
    this.stringFilters = ['domain', 'title', 'url', 'permalink', 'author', 'selfText'];
    this.stringFilters.forEach(function(filter) {
        var value = rawFilter[filter];
        this[filter] = (!value || (Array.isArray(value) && value.length === 0)) ? '' : value;
    }, this);

    //Value filters
    //Just to be safe, call parseInt
    this.score = parseInt(rawFilter.score) || -1;
    this.comments = parseInt(rawFilter.comments) || -1;
    this.age = parseInt(rawFilter.age) || -1;

    //Boolean filters
    this.selfPost = (typeof rawFilter.selfPost === 'boolean') ? rawFilter.selfPost : null;
    this.over18 = (typeof rawFilter.over18 === 'boolean') ? rawFilter.over18 : null;
}

Filter.prototype.test = function(post) {
    //Compare booleans
    //If the filter value is unset, don't check
    if ((this.selfPost != null) && this.selfPost !== post.selfPost) return false;
    if ((this.over18 != null) && this.over18 !== post.over18) return false;

    //Compare values
    if (this.score > post.score) return false;
    if (this.comments > post.comments) return false;
    if (this.age > post.age) return false;

    //Call stringContains with the post value and the filter value
    for(var i = 0; i < this.stringFilters.length; i++) {
        var filter = this.stringFilters[i];
        if (!stringContains(post[filter], this[filter])) return false;
    }

    //All filters passed
    return true;
};

module.exports = Filter;