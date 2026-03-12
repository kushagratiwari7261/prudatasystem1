require('./env');
const { Client } = require('@elastic/elasticsearch');

let esClient = null;
let esAvailable = false;

try {
    esClient = new Client({
        node: process.env.ES_URL || 'http://localhost:9200',
    });
} catch (err) {
    console.warn('⚠️  Elasticsearch client creation failed:', err.message);
}


/**
 * Creates the 'products' index with appropriate mappings if it doesn't exist
 */
const createProductIndex = async () => {
    if (!esClient) {
        console.warn('⚠️  Elasticsearch not available — search features disabled.');
        return;
    }

    try {
        // Test connectivity first
        await esClient.ping();
        esAvailable = true;
    } catch (error) {
        console.warn('⚠️  Elasticsearch not available — search features disabled.');
        return;
    }

    try {
        const exists = await esClient.indices.exists({ index: 'products' });

        if (!exists) {
            await esClient.indices.create({
                index: 'products',
                body: {
                    settings: {
                        analysis: {
                            analyzer: {
                                autocomplete: {
                                    tokenizer: 'autocomplete',
                                    filter: ['lowercase'],
                                },
                                autocomplete_search: {
                                    tokenizer: 'lowercase',
                                },
                            },
                            tokenizer: {
                                autocomplete: {
                                    type: 'edge_ngram',
                                    min_gram: 2,
                                    max_gram: 20,
                                    token_chars: ['letter', 'digit'],
                                },
                            },
                        },
                    },
                    mappings: {
                        properties: {
                            id: { type: 'keyword' },
                            title: {
                                type: 'text',
                                analyzer: 'autocomplete',
                                search_analyzer: 'autocomplete_search',
                            },
                            slug: { type: 'keyword' },
                            description: { type: 'text' },
                            category_id: { type: 'keyword' },
                            brand_id: { type: 'keyword' },
                            base_price: { type: 'double' },
                            discount_price: { type: 'double' },
                            tags: { type: 'keyword' },
                            is_active: { type: 'boolean' },
                            created_at: { type: 'date' },
                        },
                    },
                },
            });
            console.log("✅ Elasticsearch 'products' index created successfully.");
        } else {
            console.log("✅ Elasticsearch 'products' index already exists.");
        }
    } catch (error) {
        console.error('Error creating Elasticsearch products index:', error.message);
    }
};

module.exports = {
    get esClient() { return esClient; },
    get esAvailable() { return esAvailable; },
    createProductIndex,
};

