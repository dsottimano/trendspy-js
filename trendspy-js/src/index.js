const { TrendKeyword, TrendKeywordLite } = require('./trendspy/trend_keyword');
const { 
    convertTimeframe,
    timeframeToDuration,
    verifyConsistentTimeframes,
    getResolutionAndRange,
    checkTimeframeResolution
} = require('./trendspy/timeframe_utils');
const {
    flattenTree,
    HierarchicalIndex,
    createHierarchicalIndex
} = require('./trendspy/hierarchical_search');
const { Trends } = require('./trendspy/client');

module.exports = {
    // Main client
    Trends,
    
    // Trend keyword classes
    TrendKeyword,
    TrendKeywordLite,
    
    // Timeframe utilities
    convertTimeframe,
    timeframeToDuration,
    verifyConsistentTimeframes,
    getResolutionAndRange,
    checkTimeframeResolution,
    
    // Hierarchical search utilities
    flattenTree,
    HierarchicalIndex,
    createHierarchicalIndex
}; 