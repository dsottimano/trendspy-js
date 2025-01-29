const { DateTime } = require('luxon');

/**
 * Ensure input is a list/array
 * @param {*} item Item to convert to array if not already
 * @returns {Array}
 */
function ensureList(item) {
    return Array.isArray(item) ? item : [item];
}

/**
 * Decode escaped text from Google Trends response
 * @param {string} text Escaped text to decode
 * @returns {string}
 */
function decodeEscapeText(text) {
    return text
        .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\(.)/g, '$1');
}

/**
 * Convert timeframe string to standardized format
 * @param {string} timeframe Timeframe string to convert
 * @returns {string}
 */
function convertTimeframe(timeframe) {
    if (!timeframe) return "today 12-m";
    
    const now = DateTime.local();
    const timeframeLower = timeframe.toLowerCase();
    
    // Handle 'all' timeframe
    if (timeframeLower === 'all') return timeframe;
    
    // Handle date range format (YYYY-MM-DD YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2} \d{4}-\d{2}-\d{2}$/.test(timeframe)) return timeframe;
    
    // Handle hourly format (YYYY-MM-DDTHH YYYY-MM-DDTHH)
    if (/^\d{4}-\d{2}-\d{2}T\d{2} \d{4}-\d{2}-\d{2}T\d{2}$/.test(timeframe)) return timeframe;
    
    // Parse 'now' format (e.g., 'now 4-H', 'now 1-d')
    const nowMatch = timeframeLower.match(/^now (\d+)-([hd])$/i);
    if (nowMatch) {
        const [_, value, unit] = nowMatch;
        const duration = {};
        duration[unit.toLowerCase() === 'h' ? 'hours' : 'days'] = parseInt(value);
        const startDate = now.minus(duration);
        return `${startDate.toFormat("yyyy-MM-dd'T'HH")} ${now.toFormat("yyyy-MM-dd'T'HH")}`;
    }
    
    // Parse 'today' format (e.g., 'today 3-m', 'today 12-m')
    const todayMatch = timeframeLower.match(/^today (\d+)-([my])$/i);
    if (todayMatch) {
        const [_, value, unit] = todayMatch;
        const duration = {};
        duration[unit.toLowerCase() === 'm' ? 'months' : 'years'] = parseInt(value);
        return `today ${value}-${unit.toLowerCase()}`;
    }
    
    // Parse date with offset (e.g., '2024-03-25 5-m')
    const dateOffsetMatch = timeframe.match(/^(\d{4}-\d{2}-\d{2}) (\d+)-([my])$/i);
    if (dateOffsetMatch) {
        const [_, dateStr, value, unit] = dateOffsetMatch;
        return `${dateStr} ${value}-${unit.toLowerCase()}`;
    }
    
    return timeframe;
}

/**
 * Check if timeframes have compatible resolutions
 * @param {string|string[]} timeframes Timeframes to check
 * @throws {Error} If timeframes have incompatible resolutions
 */
function checkTimeframeResolution(timeframes) {
    const frames = ensureList(timeframes).map(convertTimeframe);
    if (frames.length <= 1) return;
    
    // Helper function to get resolution in minutes
    const getResolution = (frame) => {
        if (frame === 'all') return 43200; // Monthly resolution (30 days)
        
        const isDateRange = /^\d{4}-\d{2}-\d{2}/.test(frame);
        if (!isDateRange) return 1440; // Daily resolution
        
        const dates = frame.split(' ').map(d => DateTime.fromISO(d.replace('T', ' ')));
        const minutes = dates[1].diff(dates[0], 'minutes').minutes;
        
        if (minutes < 300) return 1;        // < 5 hours: 1 minute
        if (minutes < 2160) return 8;       // < 36 hours: 8 minutes
        if (minutes < 4320) return 16;      // < 72 hours: 16 minutes
        if (minutes < 11520) return 60;     // < 8 days: 1 hour
        if (minutes < 388800) return 1440;  // < 270 days: 1 day
        if (minutes < 2736000) return 10080;// < 1900 days: 1 week
        return 43200;                       // >= 1900 days: 1 month
    };
    
    const resolutions = frames.map(getResolution);
    const maxRes = Math.max(...resolutions);
    const minRes = Math.min(...resolutions);
    
    if (maxRes !== minRes) {
        throw new Error(
            'All timeframes must have the same resolution. ' +
            `Current resolutions: ${resolutions.join(', ')} minutes`
        );
    }
}

module.exports = {
    ensureList,
    decodeEscapeText,
    convertTimeframe,
    checkTimeframeResolution
}; 