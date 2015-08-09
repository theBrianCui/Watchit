function RedditPost(rawPost) {
    rawPost = rawPost.data;
    this.domain = rawPost.domain;
    this.subreddit = rawPost.subreddit;
    this.url = (rawPost.is_self ? '(text only/self post)' : rawPost.url);
    this.permalink = 'http://reddit.com' + rawPost.permalink;
    this.title = rawPost.title;
    this.author = rawPost.author;
    this.score = rawPost.score;
    this.selfPost = rawPost.is_self;
    this.selfText = rawPost.selftext;
    this.comments = rawPost.num_comments;
    this.over18 = rawPost.over_18;
    this.createdAt = rawPost.created_utc;

    this.age = (function (createdAt) {
        return Math.floor((new Date).getTime() / 1000) - createdAt;
    })(this.createdAt);

    this.ageString = (function (age) {
        var hours = Math.floor(age / 3600);
        var minutes = Math.floor((age - (hours * 3600)) / 60);

        if (hours == 0 && minutes == 0)
            return '<1 minute';
        else
            return hours + ' hour(s) ' + minutes + ' minute(s)';
    })(this.age);
}

RedditPost.prototype.equals = function (post) {
    if (!post)
        return false;
    return (this.permalink == post.permalink);
};

module.exports = RedditPost;