const { DateTime } = require('luxon');
const {
    convertTimeframe,
    timeframeToDuration,
    verifyConsistentTimeframes,
    getResolutionAndRange,
    checkTimeframeResolution
} = require('../src/trendspy/timeframe_utils');

// Import private functions for testing
const {
    isValidDate,
    isValidFormat,
    extractTimeParts,
    decodeTrendDatetime
} = require('../src/trendspy/timeframe_utils');

describe('Timeframe Utils Tests', () => {
    describe('isValidDate', () => {
        test('validates date formats correctly', () => {
            expect(isValidDate('2024-09-13')).toBe(true);
            expect(isValidDate('2024-09-13T22')).toBe(true);
            expect(isValidDate('2024/09/13')).toBe(false);
            expect(isValidDate('invalid')).toBe(false);
        });
    });

    describe('isValidFormat', () => {
        test('validates offset formats correctly', () => {
            expect(isValidFormat('1-H')).toBe(true);
            expect(isValidFormat('5-y')).toBe(true);
            expect(isValidFormat('10-m')).toBe(true);
            expect(isValidFormat('invalid')).toBe(false);
        });
    });

    describe('extractTimeParts', () => {
        test('extracts time parts correctly', () => {
            expect(extractTimeParts('5-H')).toEqual([5, 'H']);
            expect(extractTimeParts('10-d')).toEqual([10, 'd']);
            expect(extractTimeParts('invalid')).toBeNull();
        });
    });

    describe('decodeTrendDatetime', () => {
        test('decodes trend datetime correctly', () => {
            const expected1 = DateTime.fromObject({ year: 2024, month: 9, day: 13, hour: 22 });
            const expected2 = DateTime.fromObject({ year: 2024, month: 9, day: 13 });
            
            expect(decodeTrendDatetime('2024-09-13T22').toMillis())
                .toBe(expected1.toMillis());
            expect(decodeTrendDatetime('2024-09-13').toMillis())
                .toBe(expected2.toMillis());
        });
    });

    describe('convertTimeframe', () => {
        test('converts various timeframe formats correctly', () => {
            expect(convertTimeframe('now 1-H')).toBe('now 1-H');
            expect(convertTimeframe('2024-09-12T23 5-H')).toBe('2024-09-12T18 2024-09-12T23');
            expect(convertTimeframe('2024-09-12T23 1-d')).toBe('2024-09-11T23 2024-09-12T23');
            expect(convertTimeframe('2024-09-12 1-y')).toBe('2023-09-12 2024-09-12');
            expect(convertTimeframe('2024-09-12T23 2024-09-13')).toBe('2024-09-12T23 2024-09-13T00');
            expect(convertTimeframe('2024-09-12 2024-09-13T12')).toBe('2024-09-12T00 2024-09-13T12');
        });

        test('handles month difference correctly', () => {
            expect(convertTimeframe('2024-09-12 1-m')).toBe('2024-08-13 2024-09-12');
        });

        test('throws error for invalid formats', () => {
            expect(() => convertTimeframe('2024-09-12T23 invalid')).toThrow();
            expect(() => convertTimeframe('2024-09-12T23 8-d')).toThrow();
            expect(() => convertTimeframe('2024-09-12T23 all')).toThrow();
        });
    });

    describe('timeframeToDuration', () => {
        test('converts timeframe to duration correctly', () => {
            const oneHourDuration = timeframeToDuration('now 1-H');
            const fiveHourDuration = timeframeToDuration('now 5-H');
            
            expect(oneHourDuration.as('seconds')).toBe(60 * 60);
            expect(fiveHourDuration.as('seconds')).toBe(5 * 60 * 60);
        });
    });
}); 