const { DateTime } = require('luxon');

class TrendsDataConverter {
    /**
     * Convert interest over time data to structured format
     * @param {Object} data Raw API response data
     * @param {string[]} keywords Keywords used in the request
     * @returns {Object} Processed data
     */
    static interestOverTime(data, keywords) {
        if (!data || !data.default || !data.default.timelineData) {
            return {};
        }

        const timelineData = data.default.timelineData;
        const result = {
            timestamps: [],
            values: {}
        };

        // Initialize arrays for each keyword
        keywords.forEach(keyword => {
            result.values[keyword] = [];
        });

        // Process timeline data
        timelineData.forEach(point => {
            result.timestamps.push(point.time * 1000); // Convert to milliseconds
            point.value.forEach((value, index) => {
                const keyword = keywords[index];
                result.values[keyword].push(value);
            });
        });

        return result;
    }

    /**
     * Convert related queries data to structured format
     * @param {Object} data Raw API response data
     * @returns {Object} Processed data with 'top' and 'rising' queries
     */
    static relatedQueries(data) {
        if (!data || !data.default) {
            return { top: [], rising: [] };
        }

        const rankedList = data.default.rankedList;
        if (!Array.isArray(rankedList) || rankedList.length === 0) {
            return { top: [], rising: [] };
        }

        const result = {
            top: [],
            rising: []
        };

        // Process top queries
        if (rankedList[0] && rankedList[0].rankedKeyword) {
            result.top = rankedList[0].rankedKeyword.map(item => ({
                query: item.query,
                value: item.value
            }));
        }

        // Process rising queries
        if (rankedList[1] && rankedList[1].rankedKeyword) {
            result.rising = rankedList[1].rankedKeyword.map(item => ({
                query: item.query,
                value: item.value
            }));
        }

        return result;
    }

    /**
     * Convert geographical interest data to structured format
     * @param {Object} data Raw API response data
     * @param {Array} bullets Metadata about the request
     * @returns {Object} Processed geographical data
     */
    static geoData(data, bullets) {
        if (!data || !data.default || !data.default.geoMapData) {
            return {};
        }

        const result = {
            regions: [],
            values: {}
        };

        // Initialize arrays for each keyword
        bullets.forEach(bullet => {
            result.values[bullet.text] = [];
        });

        // Process geographical data
        data.default.geoMapData.forEach(region => {
            result.regions.push(region.geoCode);
            region.value.forEach((value, index) => {
                const keyword = bullets[index].text;
                result.values[keyword].push(value);
            });
        });

        return result;
    }

    /**
     * Convert suggestions data to structured format
     * @param {Object} data Raw API response data
     * @returns {Array} Processed suggestions
     */
    static suggestions(data) {
        if (!data || !data.default || !Array.isArray(data.default.topics)) {
            return [];
        }

        return data.default.topics.map(topic => ({
            title: topic.title,
            type: topic.type,
            mid: topic.mid
        }));
    }

    /**
     * Extract bullets (metadata) from token
     * @param {Object} token API token containing request metadata
     * @returns {Array} Extracted bullets
     */
    static tokenToBullets(token) {
        if (!token || !token.bullets) {
            return [];
        }
        return token.bullets.map(bullet => ({
            text: bullet.text,
            color: bullet.color
        }));
    }

    /**
     * Parse RSS feed items
     * @param {string} xmlText Raw RSS XML content
     * @returns {Array} Parsed RSS items
     */
    static rssItems(xmlText) {
        // This is a simplified implementation
        // In a real application, you would want to use a proper XML parser
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        const titleRegex = /<title>(.*?)<\/title>/;
        const linkRegex = /<link>(.*?)<\/link>/;
        const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/;
        
        let match;
        while ((match = itemRegex.exec(xmlText)) !== null) {
            const itemContent = match[1];
            const title = titleRegex.exec(itemContent);
            const link = linkRegex.exec(itemContent);
            const pubDate = pubDateRegex.exec(itemContent);
            
            if (title && link) {
                items.push({
                    title: title[1],
                    link: link[1],
                    pubDate: pubDate ? pubDate[1] : null
                });
            }
        }
        
        return items;
    }

    /**
     * Process trending now showcase timeline data
     * @param {Array} data Raw timeline data
     * @param {number} requestTimestamp Timestamp of the request
     * @returns {Object} Processed timeline data
     */
    static trendingNowShowcaseTimeline(data, requestTimestamp) {
        if (!Array.isArray(data)) {
            return {};
        }

        const result = {
            timestamps: [],
            values: {}
        };

        data.forEach(series => {
            const keyword = series[0];
            result.values[keyword] = [];

            series[1].forEach((point, index) => {
                if (index === 0) {
                    // First point contains timestamps
                    point.forEach(timestamp => {
                        result.timestamps.push(timestamp * 1000); // Convert to milliseconds
                    });
                } else {
                    // Subsequent points contain values
                    result.values[keyword] = point;
                }
            });
        });

        return result;
    }
}

module.exports = TrendsDataConverter; 