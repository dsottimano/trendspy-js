const { DateTime } = require('luxon');
const { ensureList, truncateString } = require('./utils');
const { NewsArticle } = require('./news_article');

/**
 * Represents a trending search term with associated metadata.
 */
class TrendKeyword {
    /**
     * @param {Array} item - Raw data array from API
     */
    constructor(item) {
        [
            this.keyword,
            this.news,
            this.geo,
            this.startedTimestamp,
            this.endedTimestamp,
            this._unk2,
            this.volume,
            this._unk3,
            this.volumeGrowthPct,
            this.trendKeywords,
            this.topics,
            this.newsTokens,
            this.normalizedKeyword
        ] = item;

        if (this.news) {
            this.news = this.news.map(n => NewsArticle.fromApi(n));
        }
    }

    /**
     * Converts time in seconds to a DateTime object with UTC timezone
     * @private
     * @param {number} rawTime - Raw timestamp
     * @returns {DateTime|null}
     */
    _convertToDatetime(rawTime) {
        return rawTime ? DateTime.fromSeconds(rawTime).setZone('utc') : null;
    }

    /**
     * Checks if the trend is finished
     * @returns {boolean}
     */
    get isTrendFinished() {
        return this.endedTimestamp !== null;
    }

    /**
     * Returns the number of hours elapsed since the trend started
     * @returns {number}
     */
    hoursSinceStarted() {
        if (!this.startedTimestamp) {
            return 0;
        }
        const start = DateTime.fromSeconds(this.startedTimestamp[0]).setZone('utc');
        const now = DateTime.now().setZone('utc');
        return now.diff(start, 'hours').hours;
    }

    /**
     * String representation of the trend
     * @returns {string}
     */
    toString() {
        const startTime = DateTime.fromSeconds(this.startedTimestamp[0])
            .toFormat('yyyy-MM-dd HH:mm:ss');
        
        let timeframe = startTime;
        if (this.isTrendFinished) {
            timeframe += ' - ' + DateTime.fromSeconds(this.endedTimestamp[0])
                .toFormat('yyyy-MM-dd HH:mm:ss');
        } else {
            timeframe += ' - now';
        }

        let s = `Keyword        : ${this.keyword}`;
        s += `\nGeo            : ${this.geo}`;
        s += `\nVolume         : ${this.volume} (${this.volumeGrowthPct}%)`;
        s += `\nTimeframe      : ${timeframe}`;
        s += `\nTrend keywords : ${this.trendKeywords.length} keywords (${
            truncateString(this.trendKeywords.join(','), 50)
        })`;
        s += `\nNews tokens    : ${this.newsTokens.length} tokens`;
        return s;
    }
}

/**
 * A lightweight version of TrendKeyword for simple trend representation.
 */
class TrendKeywordLite {
    /**
     * @param {string} keyword - The trending search term
     * @param {string} volume - Approximate search volume
     * @param {Array} trendKeywords - Related keywords
     * @param {string} link - URL to more information
     * @param {string} started - Start timestamp
     * @param {string} picture - URL to related image
     * @param {string} pictureSource - Source of the picture
     * @param {Array} news - Related news articles
     */
    constructor(keyword, volume, trendKeywords, link, started, picture, pictureSource, news) {
        this.keyword = keyword;
        this.volume = volume;
        this.trendKeywords = trendKeywords;
        this.link = link;
        this.started = null;
        this.picture = picture;
        this.pictureSource = pictureSource;
        this.news = news;

        if (started) {
            this.started = this._parsePubDate(started);
        } else if (news && news.length > 0) {
            this.started = Math.min(...news.map(item => item.time));
        }
    }

    /**
     * Parse publication date string
     * @private
     * @param {string} pubDate - Publication date string
     * @returns {number} Unix timestamp
     */
    static _parsePubDate(pubDate) {
        return DateTime.fromFormat(
            pubDate,
            'EEE, dd MMM yyyy HH:mm:ss ZZZ',
            { zone: 'utc' }
        ).toSeconds();
    }

    /**
     * Create instance from API data
     * @param {Object} data - Raw API data
     * @returns {TrendKeywordLite}
     */
    static fromApi(data) {
        const title = typeof data.title === 'object' ? data.title.query : data.title;
        const volume = data.formattedTraffic || data.approx_traffic;
        
        let trendKeywords = data.relatedQueries?.map(item => item.query);
        if (!trendKeywords && data.description) {
            trendKeywords = data.description.split(', ');
        }
        if (!trendKeywords && data.idsForDedup) {
            trendKeywords = Array.from(new Set(
                data.idsForDedup.flatMap(item => item.split(' '))
            ));
        }

        const link = data.shareUrl || data.link;
        const started = data.pubDate;
        const picture = data.picture || data.image?.imageUrl;
        const pictureSource = data.picture_source || data.image?.source;
        const articles = data.articles || data.news_item || [];

        return new TrendKeywordLite(
            title,
            volume,
            trendKeywords,
            link,
            started,
            picture,
            pictureSource,
            ensureList(articles).map(item => NewsArticle.fromApi(item))
        );
    }

    /**
     * String representation of the trend
     * @returns {string}
     */
    toString() {
        let s = `Keyword        : ${this.keyword}`;
        if (this.volume) s += `\nVolume         : ${this.volume}`;
        if (this.started) {
            s += `\nStarted        : ${DateTime.fromSeconds(this.started)
                .toFormat('yyyy-MM-dd HH:mm:ss')}`;
        }
        if (this.trendKeywords) {
            s += `\nTrend keywords : ${this.trendKeywords.length} keywords (${
                truncateString(this.trendKeywords.join(','), 50)
            })`;
        }
        if (this.news) s += `\nNews           : ${this.news.length} news`;
        return s;
    }
}

module.exports = {
    TrendKeyword,
    TrendKeywordLite
}; 