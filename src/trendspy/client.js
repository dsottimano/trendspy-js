const axios = require('axios');
const { DateTime } = require('luxon');
const { URLSearchParams } = require('url');
const { ensureList, decodeEscapeText, convertTimeframe, checkTimeframeResolution } = require('./utils');
const TrendsDataConverter = require('./converter');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

// Constants
const BATCH_URL = 'https://trends.google.com/_/TrendsUi/data/batchexecute';
const HOT_TRENDS_URL = 'https://trends.google.com/trends/hottrends/visualize/internal/data';

// API Links
const API_URL = 'https://trends.google.com/trends/api';
const API_EXPLORE_URL = `${API_URL}/explore`;
const API_GEO_DATA_URL = `${API_URL}/explore/pickers/geo`;
const API_CATEGORY_URL = `${API_URL}/explore/pickers/category`;
const API_TOPCHARTS_URL = `${API_URL}/topcharts`;
const API_AUTOCOMPLETE = `${API_URL}/autocomplete/`;
const DAILY_SEARCHES_URL = `${API_URL}/dailytrends`;
const REALTIME_SEARCHES_URL = `${API_URL}/realtimetrends`;

const API_TOKEN_URL = 'https://trends.google.com/trends/api/widgetdata';
const API_TIMELINE_URL = `${API_TOKEN_URL}/multiline`;
const API_MULTIRANGE_URL = `${API_TOKEN_URL}/multirange`;
const API_GEO_URL = `${API_TOKEN_URL}/comparedgeo`;
const API_RELATED_QUERIES_URL = `${API_TOKEN_URL}/relatedsearches`;

// Embed Links
const EMBED_URL = 'https://trends.google.com/trends/embed/explore';
const EMBED_GEO_URL = `${EMBED_URL}/GEO_MAP`;
const EMBED_TOPICS_URL = `${EMBED_URL}/RELATED_TOPICS`;
const EMBED_QUERIES_URL = `${EMBED_URL}/RELATED_QUERIES`;
const EMBED_TIMESERIES_URL = `${EMBED_URL}/TIMESERIES`;

// RSS Links
const DAILY_RSS = 'https://trends.google.com/trends/trendingsearches/daily/rss';
const REALTIME_RSS = 'https://trends.google.com/trending/rss';

// Batch periods enum
const BatchPeriod = {
    Past4H: 2,  // 31 points (new points every 8 min)
    Past24H: 3, // 91 points (every 16 min)
    Past48H: 5, // 181 points (every 16 min)
    Past7D: 4   // 43 points (every 4 hours)
};

class TrendsQuotaExceededError extends Error {
    constructor() {
        super(
            "API quota exceeded for related queries/topics. " +
            "To resolve this, you can try:\n" +
            "1. Use a different referer in request headers:\n" +
            "   tr.relatedQueries(keyword, { headers: { referer: 'https://www.google.com/' } })\n" +
            "2. Use a different IP address by configuring a proxy:\n" +
            "   tr.setProxy('http://proxy:port')\n" +
            "   # or\n" +
            "   new Trends({ proxy: { http: 'http://proxy:port', https: 'https://proxy:port' } })\n" +
            "3. Wait before making additional requests"
        );
        this.name = 'TrendsQuotaExceededError';
    }
}

class Trends {
    /**
     * Initialize the Trends client
     * @param {Object} options Configuration options
     * @param {string} [options.language='en'] Language code (e.g., 'en', 'es', 'fr')
     * @param {number} [options.tzs=360] Timezone offset in minutes
     * @param {number} [options.requestDelay=5.0] Minimum time interval between requests in seconds
     * @param {number} [options.maxRetries=3] Maximum number of retry attempts for failed requests
     * @param {boolean} [options.useEntityNames=false] Whether to use entity names instead of keywords
     * @param {Object|string} [options.proxy=null] Proxy configuration
     */
    constructor(options = {}) {
        const {
            language = 'en',
            tzs = 360,
            requestDelay = 5.0,
            maxRetries = 3,
            useEntityNames = false,
            proxy = null
        } = options;

        this.language = this._validateLanguage(language);
        this.tzs = tzs || -DateTime.local().offset;
        this._defaultParams = { hl: this.language, tz: this.tzs };
        this.useEntityNames = useEntityNames;
        this._headers = {
            'accept-language': this.language,
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'en-US,en;q=0.9',
            'cache-control': 'no-cache',
            'pragma': 'no-cache',
            'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"windows"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1'
        };
        this._geoCache = new Map();
        this._categoryCache = new Map();
        this.requestDelay = requestDelay;
        this.maxRetries = maxRetries;
        this.lastRequestTimes = new Set([0, 1]);
        
        // Setup cookie jar
        this.cookieJar = new tough.CookieJar();
        
        // Initialize axios instance with default config
        this.session = wrapper(axios.create({
            headers: this._headers,
            jar: this.cookieJar,
            withCredentials: true
        }));
        
        // Set proxy if provided
        if (proxy) {
            this.setProxy(proxy);
        }
    }

    /**
     * Validate and normalize language code
     * @private
     */
    _validateLanguage(language) {
        if (typeof language === 'string' && language.length >= 2) {
            return language.slice(0, 2).toLowerCase();
        }
        return 'en';
    }

    /**
     * Set or update proxy configuration
     * @param {Object|string} proxy Proxy configuration
     */
    setProxy(proxy) {
        if (typeof proxy === 'string') {
            proxy = {
                http: proxy,
                https: proxy
            };
        }

        if (proxy) {
            this.session.defaults.proxy = proxy;
        } else {
            delete this.session.defaults.proxy;
        }
    }

    /**
     * Extract keywords from token
     * @private
     */
    _extractKeywordsFromToken(token) {
        if (this.useEntityNames) {
            return token.bullets.map(item => item.text);
        }
        return token.request.comparisonItem.map(item => 
            item.complexKeywordsRestriction.keyword[0].value
        );
    }

    /**
     * Parse protected JSON response
     * @private
     */
    static _parseProtectedJson(response) {
        const validContentTypes = [
            'application/json',
            'application/javascript',
            'text/javascript'
        ];

        const contentType = (response.headers['content-type'] || '')
            .split(';')[0]
            .trim()
            .toLowerCase();

        if (response.status !== 200 || !validContentTypes.includes(contentType)) {
            throw new Error(
                `Invalid response: status ${response.status}, ` +
                `content type '${contentType}'`
            );
        }

        try {
            const jsonData = response.data.split('\n').pop();
            return JSON.parse(jsonData);
        } catch (error) {
            throw new Error('Failed to parse JSON data');
        }
    }

    /**
     * Initialize session with Google Trends
     * @private
     */
    async _initSession() {
        try {
            // Visit the main page first to get initial cookies
            await this.session.get('https://trends.google.com/', {
                headers: {
                    ...this._headers,
                    'referer': 'https://www.google.com/'
                }
            });

            // Small delay to appear more human-like
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Visit the explore page to get additional cookies
            await this.session.get('https://trends.google.com/trends/explore', {
                headers: {
                    ...this._headers,
                    'referer': 'https://trends.google.com/'
                }
            });

            return true;
        } catch (error) {
            console.error('Failed to initialize session:', error.message);
            return false;
        }
    }

    /**
     * Make HTTP GET request with retry logic
     * @private
     */
    async _get(url, params = null, headers = null) {
        // Initialize session if needed
        if (!this.cookieJar.store.idx?.['trends.google.com']) {
            await this._initSession();
        }

        let retries = this.maxRetries;
        const responseCodes = [];
        let lastResponse = null;

        while (retries > 0) {
            try {
                if (this.requestDelay) {
                    const minTime = Math.min(...this.lastRequestTimes);
                    const sleepTime = Math.max(
                        0,
                        this.requestDelay * 1000 - (Date.now() - minTime)
                    );
                    if (sleepTime > 0) {
                        await new Promise(resolve => setTimeout(resolve, sleepTime));
                    }
                    this.lastRequestTimes = new Set([
                        ...Array.from(this.lastRequestTimes)
                            .filter(t => t !== minTime),
                        Date.now()
                    ]);
                }

                const requestHeaders = {
                    ...this._headers,
                    ...headers,
                    'referer': 'https://trends.google.com/trends/explore'
                };

                const response = await this.session.get(url, {
                    params,
                    headers: requestHeaders,
                    maxRedirects: 5
                });

                lastResponse = response;
                responseCodes.push(response.status);

                if (response.status === 200) {
                    return response;
                }

                if ([429, 302].includes(response.status)) {
                    const waitTime = Math.pow(2, this.maxRetries - retries) * 5;
                    console.log(`Rate limit hit, waiting ${waitTime} seconds before retry`);
                    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                }
                retries--;
            } catch (error) {
                console.error('Request error:', error.message);
                if (error.response) {
                    console.error('Response status:', error.response.status);
                    console.error('Response data:', error.response.data);
                }
                if (retries === 0) throw error;
                retries--;

                // If session seems invalid, try to reinitialize
                if (error.response?.status === 401 || error.response?.status === 403) {
                    await this._initSession();
                }
            }
        }

        if (responseCodes.filter(code => code === 429).length > responseCodes.length / 2) {
            const currentDelay = this.requestDelay || 1;
            console.warn(
                `\nWarning: Too many rate limit errors (429). Consider increasing requestDelay ` +
                `to new Trends({ requestDelay: ${currentDelay * 2} }) before Google implements ` +
                `a long-term rate limit!`
            );
        }

        throw new Error(`Failed after ${this.maxRetries} retries`);
    }

    /**
     * Encode request items for API calls
     * @private
     */
    _encodeItems(keywords, timeframe = "today 12-m", geo = '') {
        const data = [keywords, timeframe, geo].map(item => 
            Array.isArray(item) ? item : [item]
        );
        const lengths = data.map(arr => arr.length);
        const maxLen = Math.max(...lengths);
        
        if (!lengths.every(len => maxLen % len === 0)) {
            throw new Error(
                `Ambiguous input sizes: unable to determine how to combine ` +
                `inputs of lengths ${lengths.join(', ')}`
            );
        }

        data.forEach((arr, i) => {
            while (arr.length < maxLen) {
                arr.push(...arr);
            }
        });

        return data[0].map((_, i) => ({
            keyword: data[0][i],
            time: data[1][i],
            geo: data[2][i]
        }));
    }

    /**
     * Encode request parameters for API calls
     * @private
     */
    _encodeRequest(params) {
        if ('keyword' in params) {
            const keywords = Array.isArray(params.keyword) ? params.keyword : [params.keyword];
            if (keywords.length !== 1) {
                throw new Error("This endpoint only supports a single keyword");
            }
            delete params.keyword;
            params.keywords = keywords;
        }

        const items = this._encodeItems(
            params.keywords,
            params.timeframe || "today 12-m",
            params.geo || ''
        );

        const req = {
            req: JSON.stringify({
                comparisonItem: items,
                category: params.cat || 0,
                property: params.gprop || ''
            })
        };

        return { ...req, ...this._defaultParams };
    }

    /**
     * Extract embedded data from response
     * @private
     */
    _extractEmbeddedData(text) {
        const pattern = /JSON\.parse\('([^']+)'\)/;
        const matches = text.match(pattern);
        if (matches) {
            return JSON.parse(decodeEscapeText(matches[1]));
        }
        console.warn("Failed to extract JSON data");
        return null;
    }

    /**
     * Convert token to data using appropriate API endpoint
     * @private
     */
    async _tokenToData(token) {
        const urlMap = {
            'fe_line_chart': API_TIMELINE_URL,
            'fe_multi_range_chart': API_MULTIRANGE_URL,
            'fe_multi_heat_map': API_GEO_URL,
            'fe_geo_chart_explore': API_GEO_URL,
            'fe_related_searches': API_RELATED_QUERIES_URL
        };

        const url = urlMap[token.type];
        const params = {
            req: JSON.stringify(token.request),
            token: token.token,
            ...this._defaultParams
        };

        const response = await this._get(url, params);
        return Trends._parseProtectedJson(response);
    }

    /**
     * Get token data from Google Trends API
     * @private
     */
    async _getTokenData(url, params = null, requestFix = null, headers = null, raiseQuotaError = false) {
        const encodedParams = this._encodeRequest(params);
        const response = await this._get(url, encodedParams, headers);
        const token = this._extractEmbeddedData(response.data);

        if (requestFix) {
            token.request = { ...token.request, ...requestFix };
        }

        if (raiseQuotaError) {
            const userType = token?.request?.userConfig?.userType;
            if (userType === "USER_TYPE_EMBED_OVER_QUOTA") {
                throw new TrendsQuotaExceededError();
            }
        }

        const data = await this._tokenToData(token);
        return [token, data];
    }

    /**
     * Make batch request to Google Trends API
     * @private
     */
    async _getBatch(reqId, data) {
        const reqData = JSON.stringify([[[reqId, JSON.stringify(data), null, "generic"]]]);
        const postData = `f.req=${encodeURIComponent(reqData)}`;
        const headers = {
            "content-type": "application/x-www-form-urlencoded;charset=UTF-8"
        };

        const response = await this.session.post(BATCH_URL, postData, { headers });
        return response;
    }

    /**
     * Get interest over time data
     * @param {string|string[]} keywords Keywords to analyze
     * @param {string} [timeframe="today 12-m"] Time range for analysis
     * @param {string} [geo=""] Geographic location code
     * @param {number} [cat=0] Category ID
     * @param {string} [gprop=""] Google property filter
     * @param {boolean} [returnRaw=false] Return raw API response
     * @param {Object} [headers=null] Custom request headers
     */
    async interestOverTime(keywords, options = {}) {
        const {
            timeframe = "today 12-m",
            geo = "",
            cat = 0,
            gprop = "",
            returnRaw = false,
            headers = null
        } = options;

        checkTimeframeResolution(timeframe);
        const timeframes = ensureList(timeframe).map(convertTimeframe);

        const [token, data] = await this._getTokenData(
            EMBED_TIMESERIES_URL,
            { keywords, timeframe: timeframes, geo, cat, gprop },
            null,
            headers
        );

        if (returnRaw) {
            return [token, data];
        }

        if (token.type === 'fe_line_chart') {
            const extractedKeywords = this._extractKeywordsFromToken(token);
            return TrendsDataConverter.interestOverTime(data, extractedKeywords);
        }

        if (token.type === 'fe_multi_range_chart') {
            const bullets = TrendsDataConverter.tokenToBullets(token);
            return TrendsDataConverter.multirangeInterestOverTime(data, bullets);
        }

        return data;
    }

    /**
     * Get related queries for a keyword
     */
    async relatedQueries(keyword, options = {}) {
        const {
            timeframe = "today 12-m",
            geo = "",
            cat = 0,
            gprop = "",
            returnRaw = false,
            headers = { referer: "https://trends.google.com/trends/explore" }
        } = options;

        const [token, data] = await this._getTokenData(
            EMBED_QUERIES_URL,
            { keyword, timeframe, geo, cat, gprop },
            null,
            headers,
            true
        );

        if (returnRaw) {
            return [token, data];
        }

        return TrendsDataConverter.relatedQueries(data);
    }

    /**
     * Get related topics for a keyword
     */
    async relatedTopics(keyword, options = {}) {
        const {
            timeframe = "today 12-m",
            geo = "",
            cat = 0,
            gprop = "",
            returnRaw = false,
            headers = { referer: "https://trends.google.com/trends/explore" }
        } = options;

        const [token, data] = await this._getTokenData(
            EMBED_TOPICS_URL,
            { keyword, timeframe, geo, cat, gprop },
            null,
            headers,
            true
        );

        if (returnRaw) {
            return [token, data];
        }

        return TrendsDataConverter.relatedQueries(data);
    }

    /**
     * Get interest by region data
     */
    async interestByRegion(keywords, options = {}) {
        const {
            timeframe = "today 12-m",
            geo = "",
            cat = 0,
            gprop = "",
            resolution = null,
            incLowVol = false,
            returnRaw = false
        } = options;

        const actualResolution = resolution || ((!geo || geo === '') ? 'COUNTRY' : 'REGION');
        const requestFix = {
            resolution: actualResolution,
            includeLowSearchVolumeGeos: incLowVol
        };

        const [token, data] = await this._getTokenData(
            EMBED_GEO_URL,
            { keywords, timeframe, geo, cat, gprop },
            requestFix
        );

        if (returnRaw) {
            return [token, data];
        }

        // Extract keywords from token if bullets are not available
        const keywordsList = Array.isArray(keywords) ? keywords : [keywords];
        const bullets = token.bullets || keywordsList.map(k => ({ text: k }));
        return TrendsDataConverter.geoData(data, bullets);
    }

    /**
     * Get search suggestions for a keyword
     */
    async suggestions(keyword, options = {}) {
        const { language = null, returnRaw = false } = options;
        const params = language ? 
            { hz: language, tz: this.tzs } : 
            this._defaultParams;

        const encodedKeyword = encodeURIComponent(keyword.replace("'", ""));
        const response = await this._get(API_AUTOCOMPLETE + encodedKeyword, params);
        const data = Trends._parseProtectedJson(response);

        if (returnRaw) {
            return data;
        }

        return TrendsDataConverter.suggestions(data);
    }

    /**
     * Get hot trends data
     */
    async hotTrends() {
        const response = await this.session.get(HOT_TRENDS_URL);
        return JSON.parse(response.data);
    }

    /**
     * Get top charts for a specific year
     */
    async topYearCharts(year = '2023', geo = 'GLOBAL') {
        const params = {
            date: year,
            geo: geo,
            isMobile: false,
            ...this._defaultParams
        };

        const response = await this._get(API_TOPCHARTS_URL, params);
        return Trends._parseProtectedJson(response);
    }

    /**
     * Get trending stories
     */
    async trendingStories(options = {}) {
        const {
            geo = 'US',
            category = 'all',
            maxStories = 200,
            returnRaw = false
        } = options;

        const params = {
            ns: 15,
            geo: geo,
            tz: this.tzs,
            hl: 'en',
            cat: category,
            fi: '0',
            fs: '0',
            ri: maxStories,
            rs: maxStories,
            sort: 0
        };

        const response = await this._get(REALTIME_SEARCHES_URL, params);
        const data = Trends._parseProtectedJson(response);

        if (returnRaw) {
            return data;
        }

        const stories = data?.storySummaries?.trendingStories || [];
        return stories.map(item => ({
            title: item.title,
            entityNames: item.entityNames,
            articles: item.articles
        }));
    }

    /**
     * Get trending searches (real-time)
     */
    async trendingNow(options = {}) {
        const {
            geo = 'US',
            language = 'en',
            hours = 24,
            numNews = 0,
            returnRaw = false
        } = options;

        const reqData = [null, null, geo, numNews, language, hours, 1];
        const response = await this._getBatch('i0OFE', reqData);
        const data = Trends._parseProtectedJson(response);

        if (returnRaw) {
            return data;
        }

        const parsedData = JSON.parse(data[0][2]);
        return parsedData[1].map(item => ({
            title: item.title,
            formattedTraffic: item.formattedTraffic,
            articles: item.articles || []
        }));
    }

    /**
     * Get trending searches via RSS feed
     */
    async trendingNowByRss(options = {}) {
        const { geo = 'US', returnRaw = false } = options;
        const params = { geo };

        const response = await this._get(REALTIME_RSS, params);
        
        if (returnRaw) {
            return response.data;
        }

        return TrendsDataConverter.rssItems(response.data);
    }

    /**
     * Get news articles for trending search IDs
     */
    async trendingNowNewsByIds(newsIds, maxNews = 3, returnRaw = false) {
        const response = await this._getBatch('w4opAf', [newsIds, maxNews]);
        const data = Trends._parseProtectedJson(response);

        if (returnRaw) {
            return data;
        }

        const parsedData = JSON.parse(data[0][2]);
        return parsedData[0].map(article => ({
            title: article.title,
            url: article.url,
            source: article.source,
            time: article.time,
            snippet: article.snippet
        }));
    }
}

module.exports = {
    Trends,
    TrendsQuotaExceededError,
    BatchPeriod
}; 
