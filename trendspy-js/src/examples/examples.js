const { Trends } = require('../index');

// Initialize the Trends client
const trends = new Trends({
    language: 'en',
    tz: -460
});

async function runExamples() {
    try {
        // Example 1: Interest Over Time for a single keyword
        // console.log('\n=== Example 1: Interest Over Time (Single Keyword) ===');
        // const singleData = await trends.interestOverTime('bitcoin', {
        //     timeframe: 'now 4-H',
        //     geo: 'US',
        //     headers: {
        //         'referer': 'https://trends.google.com/'
        //     }
        // });
        // console.log(singleData);

        // // Example 2: Interest Over Time for multiple keywords
        // console.log('\n=== Example 2: Interest Over Time (Multiple Keywords) ===');
        // const multiData = await trends.interestOverTime(['artificial intelligence', 'machine learning'], {
        //     timeframe: 'today 3-m',
        //     geo: 'US'
        // });
        // console.log(multiData);

        // Example 3: Related Queries
        console.log('\n=== Example 3: Related Queries ===');
        const relatedQueries = await trends.relatedQueries('nba', {
            timeframe: 'now 4-H',
            geo: 'US',
            headers: {
                'referer': 'https://www.google.com/',
                'user-agent' : 'macos'
            }
        });
        console.log(relatedQueries);

        // // Example 4: Related Topics
        // console.log('\n=== Example 4: Related Topics ===');
        // const relatedTopics = await trends.relatedTopics('tesla', {
        //     timeframe: 'today 3-m'
        // });
        // console.log(relatedTopics);

        // // Example 5: Interest by Region
        // console.log('\n=== Example 5: Interest by Region ===');
        // const regionalInterest = await trends.interestByRegion('electric cars', {
        //     timeframe: 'today 12-m',
        //     resolution: 'COUNTRY'
        // });
        // console.log(regionalInterest);

        // // Example 6: Search Suggestions
        // console.log('\n=== Example 6: Search Suggestions ===');
        // const suggestions = await trends.suggestions('smartphone');
        // console.log(suggestions);

        // // Example 7: Hot Trends
        // console.log('\n=== Example 7: Hot Trends ===');
        // const hotTrends = await trends.hotTrends();
        // console.log(hotTrends);

        // // Example 8: Trending Stories
        // console.log('\n=== Example 8: Trending Stories ===');
        // const trendingStories = await trends.trendingStories({
        //     category: 'all',
        //     geo: 'US'
        // });
        // console.log(trendingStories);

    } catch (error) {
        console.error('Error running examples:', error);
    }
}

// Run all examples
runExamples().then(() => console.log('Examples completed'));