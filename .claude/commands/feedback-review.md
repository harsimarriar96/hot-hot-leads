Review the Feedback Log and surface quality patterns, improvement suggestions, and ICP refinement ideas.

Usage: /feedback-review

Steps:
1. Ask which product (or "all")
2. Ask time period (default: last 7 days)
3. Call FeedbackAgent.getWeeklySummary() for each product:
   - Load all entries from Notion Output/[Product]/Feedback Log
   - Calculate average quality score per agent type
   - Find the top 3 recurring issues
   - Find the top 3 improvement suggestions
   - Check if ICP criteria might need updating (e.g. consistent low scores on company size)
4. Return a structured report:

## Feedback Summary — [Product] — Last 7 Days

| Agent | Avg Score | Runs |
|-------|-----------|------|
| prospect-discovery | 7.2 | 5 |
| outreach | 8.1 | 3 |

### Top Issues
1. ...

### Suggestions
1. ...

### ICP Refinement Recommendations
- Consider narrowing company size to 50–500 employees (frequent mismatches)
