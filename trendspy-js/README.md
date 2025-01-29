# trendspy-js

A powerful JavaScript library for analyzing Google Trends data. This is a JavaScript port of the Python `trendspy` library, providing the same functionality with a JavaScript/Node.js-friendly interface.

## Features

- 📈 **Interest Over Time Analysis**: Track search interest trends across custom timeframes
- 🔍 **Trending Searches**: Get real-time trending search terms
- 🌍 **Geographic Data**: Support for region-specific trend analysis
- ⏰ **Flexible Timeframes**: Multiple time range formats with automatic resolution handling
- 🔄 **Rate Limiting**: Built-in rate limiting and retry mechanisms
- 📊 **Data Processing**: Tools for processing and analyzing trends data

## Installation

```bash
npm install trendspy-js
```

## Quick Start

```javascript
const { Trends } = require('trendspy-js');

async function main() {
    // Initialize with options
    const trends = new Trends({
        language: 'en',
        tz: -440,  // Timezone offset in minutes
        requestDelay: 8.0,  // Delay between requests in seconds
        maxRetries: 3
    });

    try {
        // Get interest over time for keywords
        const data = await trends.interestOverTime(['NBA', 'basketball'], {
            geo: 'US',
            timeframe: 'now 4-H'  // Last 4 hours
        });

        console.log(data);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();
```

## Timeframe Formats

The library supports various timeframe formats:

```javascript
// Fixed timeframes
'now 1-H'    // Last hour
'now 4-H'    // Last 4 hours
'now 1-d'    // Last day
'now 7-d'    // Last 7 days
'today 1-m'  // Last month
'today 3-m'  // Last 3 months
'today 12-m' // Last year
'all'        // All available data

// Custom date ranges
'2024-03-15 2024-03-16'           // Specific dates
'2024-03-15T14 2024-03-15T18'     // Specific dates with hours

// Relative timeframes
'2024-03-15 1-H'     // One hour before March 15, 2024
'2024-03-15T14 5-H'  // 5 hours before 2PM on March 15, 2024
'2024-03-15 1-m'     // One month before March 15, 2024
'2024-03-15 1-y'     // One year before March 15, 2024
```

## API Reference

### Trends Class

#### Constructor Options
```javascript
{
    language: string,     // Language code (default: 'en')
    tz: number,          // Timezone offset in minutes
    requestDelay: number, // Delay between requests in seconds
    maxRetries: number   // Maximum number of retry attempts
}
```

#### Methods

##### interestOverTime(keywords, options)
```javascript
// Input options
const options = {
    geo: string,           // Geographic location (e.g., 'US')
    timeframe: string,     // Time range to analyze
    category: number,      // Category ID (optional)
    property: string,      // Property filter (optional)
    resolution: string     // Time resolution (optional)
};

// Response format
{
    "timestamps": [
        1710432000000,  // Unix timestamps in milliseconds
        1710433800000,
        // ...
    ],
    "values": {
        "NBA": [
            45,        // Interest values (0-100)
            62,
            // ...
        ],
        "basketball": [
            38,
            57,
            // ...
        ]
    },
    "averages": {      // Average interest over the timeframe
        "NBA": 52.5,
        "basketball": 48.2
    },
    "timeframe": {
        "start": "2024-03-14T12:00:00-04:00",
        "end": "2024-03-14T16:00:00-04:00",
        "resolution": "1 minute"
    }
}
```

##### trendingSearches(options)
```javascript
// Input options
const options = {
    geo: string,           // Geographic location
    date: string,         // Date to get trends for
    category: string      // Category filter (optional)
};

// Response format
{
    "trending": [
        {
            "keyword": "March Madness",
            "traffic": "1M+",
            "trendKeywords": ["NCAA", "basketball", "tournament"],
            "news": [
                {
                    "title": "March Madness 2024: Latest Updates",
                    "link": "https://example.com/news",
                    "source": "Sports News",
                    "publishedAt": "2024-03-14T15:30:00Z"
                }
            ],
            "startedAt": "2024-03-14T12:00:00Z"
        },
        // ... more trending items
    ],
    "date": "2024-03-14",
    "geo": "US"
}
```

##### trendingNowShowcaseTimeline(keywords, options)
```javascript
// Input options
const options = {
    geo: string,           // Geographic location
    timeframe: string,     // Time range to analyze
    category: string      // Category filter (optional)
};

// Response format
{
    "timeline": [
        {
            "timestamp": "2024-03-14T12:00:00Z",
            "trends": [
                {
                    "keyword": "NBA",
                    "rank": 1,
                    "volume": "500K+",
                    "status": "rising"
                },
                // ... more trends
            ]
        },
        // ... more timeline entries
    ],
    "metadata": {
        "timeframe": {
            "start": "2024-03-14T12:00:00Z",
            "end": "2024-03-14T16:00:00Z",
            "resolution": "16 minutes"
        },
        "geo": "US"
    }
}
```

### Utility Functions

#### Timeframe Utilities

```javascript
const { convertTimeframe, timeframeToDuration } = require('trendspy-js');

// Convert timeframe to API format
const apiTimeframe = convertTimeframe('2024-03-15 1-H');
// Returns: "2024-03-15T00 2024-03-15T01"

// Get duration object
const duration = timeframeToDuration('now 4-H');
// Returns Luxon Duration object: { hours: 4 }
```

#### Hierarchical Search

```javascript
const { HierarchicalIndex } = require('trendspy-js');

// Sample data structure
const items = [
    { name: "United States", id: "US" },
    { name: "New York", id: "US-NY" }
];

// Create search index
const index = new HierarchicalIndex(items);

// Search by name
const result = index.exactSearch('United States');
// Returns: { name: "United States", id: "US" }

// Partial search
const matches = index.partialSearch('Unit');
// Returns: [{ name: "United States", id: "US" }]

// ID search
const locationMatch = index.idSearch('US-NY');
// Returns: [{ name: "New York", id: "US-NY" }]
```

## Error Handling

The library includes built-in error handling for common scenarios:

```javascript
try {
    const data = await trends.interestOverTime(['keyword'], {
        geo: 'US',
        timeframe: 'now 1-H'
    });
} catch (error) {
    if (error.name === 'TrendsQuotaExceededError') {
        console.log('Rate limit exceeded. Try increasing requestDelay.');
    } else if (error.name === 'TrendsRequestError') {
        console.log('API request failed:', error.message);
    } else {
        console.log('Unexpected error:', error);
    }
}
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build package
npm run build
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Acknowledgments

This is a JavaScript port of the Python [trendspy](https://github.com/example/trendspy) library. 