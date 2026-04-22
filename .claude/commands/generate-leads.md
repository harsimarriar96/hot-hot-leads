Generate leads for a product by running the full pipeline: discovery → enrichment → scoring → feedback.

Usage: /generate-leads

Ask the user:
1. Which product? (call `listProducts()` from ProductsRepository if unsure)
2. How many leads? (default 10)
3. Any specific focus? (e.g. "Series B fintech in NYC", optional)

Then run:
1. Load product knowledge from Notion (generalInfo, ICP, signals, salesStrategy)
2. Use ProspectDiscoveryAgent to find matching companies via Exa
3. Run EnrichmentAgent on each company
4. Run ScoringAgent — only keep leads with score >= 60
5. Save qualified leads to Notion Output/[Product]/Generated Leads
6. Automatically run FeedbackAgent on the batch
7. Return a markdown table of leads with: Company | Score | Top Signal | Status
