Check for recent GTM signals across all products or a specific product.

Usage: /check-signals

Steps:
1. Ask which product (or "all products")
2. Ask how many days back to check (default: 7)
3. Run SignalMonitorAgent for each product:
   - Load the Sources from Notion Knowledge/[Product]/Sources
   - Search each source topic via Exa with a date filter
   - Classify results into signal types (funding, hiring, news, leadership_change, product_launch)
   - Save new signals to Notion Knowledge/[Product]/Signals database
4. Return a summary grouped by signal type with company, description, and source URL

Format output as:
## [Product Name] — [N] new signals

### 🚀 Funding
- **Acme Corp**: Raised $20M Series B (source: techcrunch.com)

### 👥 Hiring
...
