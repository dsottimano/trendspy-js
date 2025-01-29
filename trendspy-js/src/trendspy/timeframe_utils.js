const { DateTime, Duration } = require('luxon');
const { ensureList } = require('./utils');

/**
 * @constant {RegExp}
 * Pattern to validate date strings in format YYYY-MM-DD or YYYY-MM-DDTHh
 */
const VALID_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2})?$/;

/**
 * @constant {RegExp}
 * Pattern to validate offset strings in format n-[Hdmy] (e.g., 1-H, 24-d, 3-m, 1-y)
 */
const OFFSET_PATTERN = /\d+[-]?[Hdmy]$/;

/**
 * @constant {Set<string>}
 * Predefined timeframe strings supported by the Google Trends API
 */
const FIXED_TIMEFRAMES = new Set([
    'now 1-H', 'now 4-H', 'now 1-d', 'now 7-d',
    'today 1-m', 'today 3-m', 'today 5-y', 'today 12-m',
    'all'
]);

/**
 * @constant {string}
 * Format string for dates without time (YYYY-MM-DD)
 */
const DATE_FORMAT = 'yyyy-MM-dd';

/**
 * @constant {string}
 * Format string for dates with hour (YYYY-MM-DDTHh)
 */
const DATE_T_FORMAT = "yyyy-MM-dd'T'HH";

/**
 * @constant {Object.<string, string>}
 * Maps short time unit codes to Luxon duration units
 */
const UNIT_MAP = {
    'H': 'hours',
    'd': 'days',
    'm': 'months',
    'y': 'years'
};

/**
 * Validates if a string matches the required date format.
 * Accepts dates in YYYY-MM-DD or YYYY-MM-DDTHh format.
 * 
 * @param {string} dateStr - The date string to validate
 * @returns {boolean} True if the date string is valid, false otherwise
 * 
 * @example
 * isValidDate('2024-03-15')      // returns true
 * isValidDate('2024-03-15T14')   // returns true
 * isValidDate('2024/03/15')      // returns false
 * isValidDate('invalid')         // returns false
 */
function isValidDate(dateStr) {
    return VALID_DATE_PATTERN.test(dateStr);
}

/**
 * Validates if a string matches the required offset format.
 * Accepts offsets in n-[Hdmy] format where:
 * - H: hours
 * - d: days
 * - m: months
 * - y: years
 * 
 * @param {string} offsetStr - The offset string to validate
 * @returns {boolean} True if the offset string is valid, false otherwise
 * 
 * @example
 * isValidFormat('1-H')    // returns true
 * isValidFormat('7-d')    // returns true
 * isValidFormat('3-m')    // returns true
 * isValidFormat('1-y')    // returns true
 * isValidFormat('1H')     // returns false
 * isValidFormat('invalid') // returns false
 */
function isValidFormat(offsetStr) {
    return OFFSET_PATTERN.test(offsetStr);
}

/**
 * Extracts the numeric value and unit from an offset string.
 * 
 * @param {string} offsetStr - The offset string to parse (e.g., "5-H", "1-d")
 * @returns {[number, string]|null} An array containing [value, unit] or null if invalid
 * 
 * @example
 * extractTimeParts('5-H')     // returns [5, 'H']
 * extractTimeParts('24-d')    // returns [24, 'd']
 * extractTimeParts('invalid') // returns null
 */
function extractTimeParts(offsetStr) {
    const match = offsetStr.match(/(\d+)[-]?([Hdmy]+)/);
    return match ? [parseInt(match[1]), match[2]] : null;
}

/**
 * Parses a date string into a Luxon DateTime object.
 * Handles both YYYY-MM-DD and YYYY-MM-DDTHh formats.
 * 
 * @param {string} dateStr - The date string to parse
 * @returns {DateTime} A Luxon DateTime object
 * @throws {InvalidArgumentError} If the date string cannot be parsed
 * 
 * @example
 * decodeTrendDatetime('2024-03-15')    // returns DateTime for 2024-03-15 00:00:00
 * decodeTrendDatetime('2024-03-15T14')  // returns DateTime for 2024-03-15 14:00:00
 */
function decodeTrendDatetime(dateStr) {
    const format = dateStr.includes('T') ? DATE_T_FORMAT : DATE_FORMAT;
    return DateTime.fromFormat(dateStr, format);
}

/**
 * Processes two dates and returns a formatted date range string.
 * Handles mixing of date-only and date-time formats.
 * 
 * @param {string} datePart1 - Start date in YYYY-MM-DD or YYYY-MM-DDTHh format
 * @param {string} datePart2 - End date in YYYY-MM-DD or YYYY-MM-DDTHh format
 * @returns {string} Formatted date range string
 * @throws {Error} If date difference exceeds 7 days when using hours
 * 
 * @example
 * processTwoDates('2024-03-15', '2024-03-16')           // returns "2024-03-15 2024-03-16"
 * processTwoDates('2024-03-15T14', '2024-03-15T18')     // returns "2024-03-15T14 2024-03-15T18"
 * processTwoDates('2024-03-15', '2024-03-15T18')        // returns "2024-03-15T00 2024-03-15T18"
 */
function processTwoDates(datePart1, datePart2) {
    const isT1 = datePart1.includes('T');
    const isT2 = datePart2.includes('T');
    
    if (!isT1 && !isT2) {
        return `${datePart1} ${datePart2}`;
    }

    let date1 = decodeTrendDatetime(datePart1);
    let date2 = decodeTrendDatetime(datePart2);

    if (isT1 && !isT2) {
        date2 = date2.startOf('day');
    } else if (!isT1 && isT2) {
        date1 = date1.startOf('day');
    }

    if ((isT1 || isT2) && Math.abs(date2.diff(date1, 'days').days) > 7) {
        throw new Error(`Date difference cannot exceed 7 days for format with hours: ${datePart1} ${datePart2}`);
    }

    return `${date1.toFormat(DATE_T_FORMAT)} ${date2.toFormat(DATE_T_FORMAT)}`;
}

/**
 * Processes a date and an offset to calculate a date range.
 * Handles different time units (hours, days, months, years) with special rules for each.
 * 
 * @param {string} datePart1 - Reference date in YYYY-MM-DD or YYYY-MM-DDTHh format
 * @param {string} offsetPart - Time offset in n-[Hdmy] format
 * @returns {string} Formatted date range string
 * @throws {Error} If using hours format with offset > 7 days
 * 
 * @example
 * processDateWithOffset('2024-03-15', '24-H')     // returns "2024-03-14 2024-03-15"
 * processDateWithOffset('2024-03-15T14', '5-H')   // returns "2024-03-15T09 2024-03-15T14"
 * processDateWithOffset('2024-03-15', '1-m')      // returns "2024-02-16 2024-03-15"
 * processDateWithOffset('2024-03-15', '1-y')      // returns "2023-03-15 2024-03-15"
 */
function processDateWithOffset(datePart1, offsetPart) {
    const date1 = decodeTrendDatetime(datePart1);
    const [count, unit] = extractTimeParts(offsetPart);

    const duration = {};
    duration[UNIT_MAP[unit]] = count;

    if (unit === 'm' || unit === 'y') {
        // For months and years, we need to calculate from date1 backwards
        let date2 = date1.minus(duration);
        if (unit === 'm') {
            date2 = date2.plus({ days: 1 }); // Add one day for month calculations
        }
        const format = datePart1.includes('T') ? DATE_T_FORMAT : DATE_FORMAT;
        return `${date2.toFormat(format)} ${date1.toFormat(format)}`;
    }

    if (datePart1.includes('T') && 
        ((unit === 'd' && count > 7) || (unit === 'H' && count > 7 * 24))) {
        throw new Error(
            `Offset cannot exceed 7 days for format with time: ${datePart1} ${offsetPart}. ` +
            `Use YYYY-MM-DD format or "today".`
        );
    }

    const format = datePart1.includes('T') ? DATE_T_FORMAT : DATE_FORMAT;
    const date2 = date1.minus(duration);
    return `${date2.toFormat(format)} ${date1.toFormat(format)}`;
}

/**
 * Converts various timeframe formats to Google Trends API format.
 * Handles fixed timeframes, relative offsets, and explicit date ranges.
 * 
 * @param {string} timeframe - Input timeframe string
 * @param {boolean} [convertFixedTimeframesToDates=false] - Whether to convert fixed timeframes to explicit dates
 * @returns {string} Converted timeframe string in Google Trends format
 * @throws {Error} If timeframe format is invalid or constraints are violated
 * 
 * @example
 * // Fixed timeframes
 * convertTimeframe('now 1-H')                    // returns "now 1-H"
 * convertTimeframe('today 1-m')                  // returns "today 1-m"
 * 
 * // Date with offset
 * convertTimeframe('2024-03-15T14 5-H')         // returns "2024-03-15T09 2024-03-15T14"
 * convertTimeframe('2024-03-15 1-m')            // returns "2024-02-16 2024-03-15"
 * 
 * // Explicit date range
 * convertTimeframe('2024-03-15 2024-03-16')     // returns "2024-03-15 2024-03-16"
 * convertTimeframe('2024-03-15T14 2024-03-15T18') // returns "2024-03-15T14 2024-03-15T18"
 */
function convertTimeframe(timeframe, convertFixedTimeframesToDates = false) {
    if (FIXED_TIMEFRAMES.has(timeframe) && !convertFixedTimeframesToDates) {
        return timeframe;
    }

    const utcNow = DateTime.now().setZone('utc');
    if (convertFixedTimeframesToDates && timeframe === 'all') {
        return `2024-01-01 ${utcNow.toFormat(DATE_FORMAT)}`;
    }

    timeframe = timeframe
        .replace('now', utcNow.toFormat(DATE_T_FORMAT))
        .replace('today', utcNow.toFormat(DATE_FORMAT));

    const parts = timeframe.split(' ');
    if (parts.length !== 2) {
        throw new Error(
            `Invalid timeframe format: ${timeframe}. ` +
            `Expected format: '<date> <offset>' or '<date> <date>'.`
        );
    }

    const [datePart1, datePart2] = parts;

    if (isValidDate(datePart1)) {
        if (isValidDate(datePart2)) {
            return processTwoDates(datePart1, datePart2);
        } else if (isValidFormat(datePart2)) {
            return processDateWithOffset(datePart1, datePart2);
        }
    }

    throw new Error(`Could not process timeframe: ${timeframe}`);
}

/**
 * Converts a timeframe string to a Luxon Duration object.
 * Useful for calculating time differences and comparing timeframes.
 * 
 * @param {string} timeframe - Timeframe string to convert
 * @returns {Duration} Luxon Duration object representing the timeframe
 * 
 * @example
 * timeframeToDuration('now 1-H').as('seconds')     // returns 3600
 * timeframeToDuration('now 4-H').as('hours')       // returns 4
 * timeframeToDuration('2024-03-15 2024-03-16')     // returns Duration of 1 day
 */
function timeframeToDuration(timeframe) {
    const result = convertTimeframe(timeframe, true);
    const [date1, date2] = result.split(' ').map(decodeTrendDatetime);
    return date2.diff(date1);
}

/**
 * Verifies that all provided timeframes have consistent durations.
 * Used to ensure that multiple timeframes can be compared meaningfully.
 * 
 * @param {string|string[]} timeframes - Single timeframe string or array of timeframe strings
 * @returns {boolean} True if timeframes are consistent
 * @throws {Error} If timeframes have inconsistent durations
 * 
 * @example
 * verifyConsistentTimeframes(['now 1-H', 'now 1-H'])           // returns true
 * verifyConsistentTimeframes(['now 1-H', 'now 4-H'])           // throws Error
 * verifyConsistentTimeframes('2024-03-15 2024-03-16')         // returns true
 */
function verifyConsistentTimeframes(timeframes) {
    if (typeof timeframes === 'string') {
        return true;
    }

    const durations = timeframes.map(timeframeToDuration);
    const firstDuration = durations[0];
    
    if (durations.every(d => d.equals(firstDuration))) {
        return true;
    }

    throw new Error(
        `Inconsistent timeframes detected: ${durations.map(d => d.toISO())}`
    );
}

/**
 * Determines the time resolution and range description for a given timeframe.
 * Used to understand the granularity of data points within the timeframe.
 * 
 * @param {string} timeframe - Timeframe string to analyze
 * @returns {[string, string]} Tuple of [resolution, range description]
 * 
 * @example
 * getResolutionAndRange('now 4-H')  // returns ["1 minute", "delta < 5 hours"]
 * getResolutionAndRange('now 1-d')  // returns ["8 minutes", "5 hours <= delta < 36 hours"]
 * getResolutionAndRange('today 1-m') // returns ["1 day", "8 days <= delta < 270 days"]
 */
function getResolutionAndRange(timeframe) {
    const duration = timeframeToDuration(timeframe);
    const hours = duration.as('hours');

    if (hours < 5) {
        return ["1 minute", "delta < 5 hours"];
    } else if (hours < 36) {
        return ["8 minutes", "5 hours <= delta < 36 hours"];
    } else if (hours < 72) {
        return ["16 minutes", "36 hours <= delta < 72 hours"];
    } else if (hours < 24 * 8) {
        return ["1 hour", "72 hours <= delta < 8 days"];
    } else if (hours < 24 * 270) {
        return ["1 day", "8 days <= delta < 270 days"];
    } else if (hours < 24 * 1900) {
        return ["1 week", "270 days <= delta < 1900 days"];
    } else {
        return ["1 month", "delta >= 1900 days"];
    }
}

/**
 * Checks if all provided timeframes have the same resolution and acceptable duration ratios.
 * Ensures that timeframes can be meaningfully compared and analyzed together.
 * 
 * @param {string|string[]} timeframes - Single timeframe string or array of timeframe strings
 * @throws {Error} If timeframes have different resolutions or if max duration is >= 2x min duration
 * 
 * @example
 * // These work:
 * checkTimeframeResolution(['now 1-H', 'now 1-H'])
 * checkTimeframeResolution('2024-03-15T14 2024-03-15T15')
 * 
 * // These throw errors:
 * checkTimeframeResolution(['now 1-H', 'now 24-H'])  // Different resolutions
 * checkTimeframeResolution(['now 1-H', 'now 3-H'])   // Duration ratio too large
 */
function checkTimeframeResolution(timeframes) {
    timeframes = ensureList(timeframes);
    const resolutions = timeframes.map(getResolutionAndRange);
    const resolutionValues = resolutions.map(r => r[0]);

    const durations = timeframes.map(timeframeToDuration);
    if (new Set(resolutionValues).size > 1) {
        let errorMessage = "Error: Different resolutions detected for the timeframes:\n";
        timeframes.forEach((timeframe, i) => {
            errorMessage += 
                `Timeframe: ${timeframe}, Delta: ${durations[i].toISO()}, ` +
                `Resolution: ${resolutions[i][0]} (based on range: ${resolutions[i][1]})\n`;
        });
        throw new Error(errorMessage);
    }

    const [minDuration, minTimeframe] = durations.reduce((min, curr, i) => 
        curr.as('milliseconds') < min[0].as('milliseconds') ? [curr, timeframes[i]] : min,
        [durations[0], timeframes[0]]
    );

    const [maxDuration, maxTimeframe] = durations.reduce((max, curr, i) => 
        curr.as('milliseconds') > max[0].as('milliseconds') ? [curr, timeframes[i]] : max,
        [durations[0], timeframes[0]]
    );

    if (maxDuration.as('milliseconds') >= minDuration.as('milliseconds') * 2) {
        throw new Error(
            `Error: The maximum delta ${maxDuration.toISO()} (from timeframe ${maxTimeframe}) ` +
            `should be less than twice the minimum delta ${minDuration.toISO()} (from timeframe ${minTimeframe}).`
        );
    }
}

module.exports = {
    convertTimeframe,
    timeframeToDuration,
    verifyConsistentTimeframes,
    getResolutionAndRange,
    checkTimeframeResolution,
    // Expose private functions for testing
    isValidDate,
    isValidFormat,
    extractTimeParts,
    decodeTrendDatetime
}; 
