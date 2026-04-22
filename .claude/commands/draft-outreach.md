Draft personalized outreach messages for qualified leads.

Usage: /draft-outreach

Steps:
1. Ask which product
2. Ask which company/lead (or "all outreach_ready leads")
3. Ask which sales channel (email / LinkedIn DM / cold call script)
4. Load product knowledge: salesChannels, pricing, value props, salesStrategy
5. Load the lead's enrichment data and signals from Notion
6. Run OutreachAgent to draft the message:
   - Open with a specific signal reference
   - Tie signal to ICP pain point
   - Connect to value prop + pricing CTA
   - Match length/tone to channel
7. Save draft to Notion Output/[Product]/Outreach Queue
8. Run FeedbackAgent on the draft
9. Return the draft + feedback score

Channels:
- email: Subject line + 3 paragraph body
- linkedin: < 300 chars, casual
- cold_call: Opener + discovery questions + mini pitch
