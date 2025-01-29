const { DateTime } = require('luxon');

class NewsArticle {
    constructor(title, snippet, source, url, time) {
        this.title = title;
        this.snippet = snippet;
        this.source = source;
        this.url = url;
        this.time = time;
    }

    static fromApi(data) {
        let title = data.title || data.snippet;
        let snippet = data.snippet || data.title;
        let source = data.source;
        let url = data.url || data.link;
        let time = null;

        if (data.time) {
            time = typeof data.time === 'number' 
                ? data.time 
                : DateTime.fromISO(data.time).toSeconds();
        } else if (data.pubDate) {
            time = DateTime.fromFormat(
                data.pubDate,
                'EEE, dd MMM yyyy HH:mm:ss ZZZ',
                { zone: 'utc' }
            ).toSeconds();
        }

        return new NewsArticle(title, snippet, source, url, time);
    }

    toString() {
        let s = `Title   : ${this.title}`;
        if (this.source) s += `\nSource  : ${this.source}`;
        if (this.time) {
            s += `\nTime    : ${DateTime.fromSeconds(this.time)
                .toFormat('yyyy-MM-dd HH:mm:ss')}`;
        }
        if (this.snippet) s += `\nSnippet : ${this.snippet}`;
        return s;
    }
}

module.exports = {
    NewsArticle
}; 